import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

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

// 1. Yeni Deneme Planı Oluştur (Sadece Admin)
router.post('/plan', authenticate, authorize('admin', 'koordinator'), async (req, res, next) => {
    try {
        const { ad, planlanan_tarih, aciklama } = req.body;
        if (!ad || !planlanan_tarih) {
            throw new AppError('Deneme adı ve tarihi zorunludur', 400);
        }

        const result = await pool.query(
            `INSERT INTO deneme_takvimi (ad, planlanan_tarih, aciklama, olusturan_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [ad, planlanan_tarih, aciklama, req.user.id]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// 2. Deneme Planlarını Listele (Tüm yetkili kullanıcılar)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { brans_id } = req.query; // Opsiyonel filtre

        let query = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM deneme_yuklemeleri dy WHERE dy.deneme_id = d.id) as toplam_yukleme
      FROM deneme_takvimi d
      WHERE d.aktif = true
      ORDER BY d.planlanan_tarih DESC
    `;

        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
});

// 3. Denemeye Dosya Yükle (Branş Kullanıcıları)
router.post('/:id/upload', authenticate, upload.single('pdf_dosya'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { brans_id } = req.body; // Kullanıcı seçebilir veya token'dan gelebilir

        if (!req.file) {
            throw new AppError('Lütfen bir PDF dosyası yükleyin.', 400);
        }

        // Kullanıcının branşını doğrula veya kullanıcı properties'den al
        // Not: req.user.brans_id bazen null olabilir (admin vs). Ama yükleyen rolü 'soru_yazici' ise vardır.
        let targetBransId = brans_id ? parseInt(brans_id) : req.user.brans_id;

        // Eğer admin yüklüyorsa ve brans_id göndermediyse hata veya opsiyonel handle?
        // Kullanıcı arayüzünde admin için branş seçtirmiyoruz şu an, o yüzden admin yüklerse null gidebilir, 
        // veya admin yüklemesi "genel" sayılabilir mi?
        // Senaryo: Branş öğretmeni yüklüyor.
        if (!targetBransId && req.user.rol !== 'admin') {
            throw new AppError('Branş bilgisi bulunamadı. Lütfen yöneticinizle iletişime geçin.', 400);
        }

        // Cloudinary Yükleme
        const timestamp = Date.now();
        const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const publicId = `soru-havuzu/denemeler/${timestamp}_${sanitizedFilename}`;

        const uploadPromise = new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    public_id: publicId,
                    resource_type: 'raw', // PDF için raw kullanımı daha güvenli olabilir, 'auto' da olur
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
        // 1. Tüm aktif denemeleri çek
        const denemeler = await pool.query('SELECT * FROM deneme_takvimi WHERE aktif = true ORDER BY planlanan_tarih DESC');

        // 2. Tüm branşları çek
        const branslar = await pool.query('SELECT * FROM branslar ORDER BY brans_adi');

        // 3. Tüm yüklemeleri çek
        const yuklemeler = await pool.query('SELECT * FROM deneme_yuklemeleri');

        // 4. Matris oluştur
        const agenda = [];

        // Her deneme için
        for (const d of denemeler.rows) {
            // Tarih karşılaştırması için string formatı (YYYY-MM-DD gibi veya locale string)
            // new Date(string) -> browser/server timezone farkına dikkat.
            // Veritabanı "planlanan_tarih" DATE tipinde, "2026-06-25" gelir.
            // JS'de new Date('2026-06-25') UTC olarak algılayabilir.
            // Biz sadece gün/ay/yıl eşitliğine bakacağız.

            const planDateObj = new Date(d.planlanan_tarih);
            const planDateStr = planDateObj.toISOString().split('T')[0]; // "2026-01-27"

            // Her branş için durumu kontrol et
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
                    const uploadDateObj = new Date(lastUpload.yukleme_tarihi); // Timestamp from DB
                    const uploadDateStr = uploadDateObj.toISOString().split('T')[0];

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
