import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// Auto-Ensure Tables Exist (FAILSAFE for migration issues)
const ensureTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deneme_takvimi (
                id SERIAL PRIMARY KEY,
                ad VARCHAR(255) NOT NULL,
                planlanan_tarih DATE NOT NULL,
                aciklama TEXT,
                aktif BOOLEAN DEFAULT true,
                olusturan_id INTEGER REFERENCES kullanicilar(id),
                olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deneme_yuklemeleri (
                 id SERIAL PRIMARY KEY,
                 deneme_id INTEGER REFERENCES deneme_takvimi(id) ON DELETE CASCADE,
                 brans_id INTEGER REFERENCES branslar(id) ON DELETE CASCADE,
                 dosya_url TEXT NOT NULL,
                 yukleyen_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
                 yukleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('DEBUG: Deneme tables verified/created via failsafe.');
    } catch (err) {
        console.error('DEBUG: ensureTables failed:', err);
    }
};

// Multer Config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB Limit for PDFs
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Sadece PDF dosyaları yüklenebilir.'), false);
        }
    }
});

// 1. Yeni Deneme Planı Oluştur (SADECE ADMIN)
router.post('/plan', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        // Failsafe execution
        await ensureTables();

        console.log('Deneme Plan Create Request:', req.body);
        console.log('User:', req.user);

        const { ad, planlanan_tarih, aciklama } = req.body;
        if (!ad || !planlanan_tarih) {
            throw new AppError('Deneme adı ve tarihi zorunludur', 400);
        }

        const result = await pool.query(
            `INSERT INTO deneme_takvimi (ad, planlanan_tarih, aciklama, olusturan_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [ad, planlanan_tarih, aciklama, req.user.id]
        );

        console.log('Deneme Plan Created:', result.rows[0]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Deneme Plan Create Error:', error);
        next(error);
    }
});

// 2. Deneme Planlarını Listele (Tüm yetkili kullanıcılar)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { brans_id } = req.query; // Opsiyonel filtre

        // Ensure logic if table doesn't exist yet (first run)
        await ensureTables();

        let query = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM deneme_yuklemeleri dy WHERE dy.deneme_id = d.id) as toplam_yukleme
    `;

        const params = [];
        // Eğer kullanıcının branşı varsa, o branşa ait son yüklemeyi de getir
        if (req.user.brans_id) {
            query += `, (SELECT dosya_url FROM deneme_yuklemeleri dy WHERE dy.deneme_id = d.id AND dy.brans_id = $1 ORDER BY dy.yukleme_tarihi DESC LIMIT 1) as my_upload_url`;
            params.push(req.user.brans_id);
        } else {
            query += `, NULL as my_upload_url`;
        }

        query += ` FROM deneme_takvimi d WHERE d.aktif = true ORDER BY d.planlanan_tarih DESC`;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
});

// 3. Denemeye Dosya Yükle (Branş Kullanıcıları + Admin)
router.post('/:id/upload', authenticate, upload.single('pdf_dosya'), async (req, res, next) => {
    try {
        await ensureTables();

        const { id } = req.params;
        const { brans_id } = req.body;

        if (!req.file) {
            throw new AppError('Lütfen bir PDF dosyası yükleyin.', 400);
        }

        // Kullanıcının branşını doğrula veya body'den al (Admin için)
        let targetBransId = brans_id ? parseInt(brans_id) : req.user.brans_id;

        if (!targetBransId && req.user.rol !== 'admin') {
            throw new AppError('Branş bilgisi bulunamadı. Lütfen yöneticinizle iletişime geçin.', 400);
        }

        // Cloudinary Yükleme
        const timestamp = Date.now();
        const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        // folder parametresi zaten aşağıda verildiği için public_id içinde tekrar etmiyoruz
        const publicId = `${timestamp}_${sanitizedFilename}`;

        const uploadPromise = new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    public_id: publicId,
                    resource_type: 'auto', // 'raw' yerine 'auto' kullanarak PDF olarak tanınmasını sağlıyoruz
                    type: 'upload',
                    folder: 'soru-havuzu/denemeler'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload hatası:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );
            uploadStream.end(req.file.buffer);
        });

        const uploadResult = await uploadPromise;
        const dosyaUrl = uploadResult.secure_url;

        // DB Insert
        const result = await pool.query(
            `INSERT INTO deneme_yuklemeleri (deneme_id, brans_id, dosya_url, yukleyen_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, targetBransId, dosyaUrl, req.user.id]
        );

        res.status(201).json({ success: true, data: result.rows[0], message: 'Deneme başarıyla yüklendi.' });

    } catch (error) {
        next(error);
    }
});

// 4. Ajanda Verisi Getir
router.get('/ajanda', authenticate, async (req, res, next) => {
    try {
        await ensureTables();

        // 1. Tüm aktif denemeleri çek
        const denemeler = await pool.query('SELECT * FROM deneme_takvimi WHERE aktif = true ORDER BY planlanan_tarih DESC');

        // 2. Tüm branşları çek
        const branslar = await pool.query('SELECT * FROM branslar ORDER BY brans_adi');

        // 3. Tüm yüklemeleri çek
        const yuklemeler = await pool.query('SELECT * FROM deneme_yuklemeleri');

        // 4. Matris oluştur
        const agenda = [];

        // Tarih Formatlayıcı (Türkiye Saati ile Gün Bazlı Eşleştirme)
        const getTrDateString = (dateInput) => {
            if (!dateInput) return '';
            try {
                return new Date(dateInput).toLocaleDateString('tr-TR', {
                    timeZone: 'Europe/Istanbul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } catch (e) {
                return '';
            }
        };

        // Her deneme için
        for (const d of denemeler.rows) {

            const planDateStr = getTrDateString(d.planlanan_tarih);

            const row = {
                deneme: d,
                details: []
            };

            for (const b of branslar.rows) {
                // Bu branş bu denemeye dosya yüklemiş mi?
                const uploads = yuklemeler.rows.filter(y => y.deneme_id === d.id && y.brans_id === b.id);

                let completed = false;
                let uploadInfo = null;

                if (uploads.length > 0) {
                    // En son yüklemeyi al
                    const lastUpload = uploads.sort((a, b) => new Date(b.yukleme_tarihi) - new Date(a.yukleme_tarihi))[0];
                    const uploadDateStr = getTrDateString(lastUpload.yukleme_tarihi);

                    if (uploadDateStr === planDateStr) {
                        completed = true;
                    }
                    uploadInfo = lastUpload;
                }

                row.details.push({
                    brans: b,
                    completed: completed,
                    upload: uploadInfo
                });
            }
            agenda.push(row);
        }

        res.json({ success: true, data: agenda });
    } catch (error) {
        next(error);
    }
});

export default router;
