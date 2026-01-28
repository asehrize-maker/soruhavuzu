import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import jwt from 'jsonwebtoken';
import { Readable } from 'stream';

const router = express.Router();

// Görev Dosyasını Görüntüle (AUTHENTICATED STREAMING - ROBUST FIX)
router.get('/view/:uploadId', async (req, res, next) => {
    try {
        const { uploadId } = req.params;
        const { token } = req.query;

        try {
            const authToken = token || req.headers.authorization?.split(' ')[1];
            if (!authToken) throw new Error('No token');
            jwt.verify(authToken, process.env.JWT_SECRET);
        } catch (authErr) {
            throw new AppError('Yetkisiz erişim. Lütfen giriş yapın.', 401);
        }

        const upload = await pool.query('SELECT dosya_url FROM deneme_yuklemeleri WHERE id = $1', [uploadId]);
        if (upload.rowCount === 0) throw new AppError('Dosya bulunamadı', 404);

        const targetUrl = upload.rows[0].dosya_url;

        // --- GELİŞMİŞ CLOUDINARY URL PARÇALAMA ---
        const urlParts = targetUrl.split('/');
        const typeIndex = urlParts.findIndex(p => ['upload', 'private', 'authenticated'].includes(p));
        const resourceType = urlParts[typeIndex - 1] || 'image';
        const deliveryType = urlParts[typeIndex] || 'upload';

        let version = '';
        let publicIdParts = [];

        for (let i = typeIndex + 1; i < urlParts.length; i++) {
            const part = urlParts[i];
            if (part.startsWith('s--')) continue; // Güvenlik imzalarını atla
            if (part.startsWith('v') && /v\d+/.test(part)) {
                version = part.substring(1); // Versiyon numarasını al
                continue;
            }
            publicIdParts.push(part);
        }

        const publicIdWithExt = publicIdParts.join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ""); // Uzantıyı sil

        console.log(`DEBUG: Final Extraction -> PublicId: ${publicId}, Version: ${version}, Type: ${resourceType}, Delivery: ${deliveryType}`);

        // Sunucu tarafında EN YÜKSEK YETKİYLE İmzalı URL oluştur
        const authenticatedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            version: version,
            sign_url: true,
            secure: true,
            type: deliveryType
        });

        const response = await fetch(authenticatedUrl);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'No body');
            console.error(`❌ Cloudinary access failed. Status: ${response.status}, Body: ${errorBody}`);
            throw new AppError(`Dosya sunucudan çekilemedi (Bulut Hatası: ${response.status})`, response.status === 401 ? 401 : 500);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');

        const nodeStream = Readable.fromWeb(response.body);
        nodeStream.pipe(res);
    } catch (error) {
        console.error('DEBUG: View Stream Error:', error);
        next(error);
    }
});

// Görev Dosyasını İndir (AUTHENTICATED STREAMING - ROBUST FIX)
router.get('/download/:uploadId', async (req, res, next) => {
    try {
        const { uploadId } = req.params;
        const { token } = req.query;

        try {
            const authToken = token || req.headers.authorization?.split(' ')[1];
            if (!authToken) throw new Error('No token');
            jwt.verify(authToken, process.env.JWT_SECRET);
        } catch (authErr) {
            throw new AppError('Yetkisiz erişim. Lütfen giriş yapın.', 401);
        }

        const upload = await pool.query(
            `SELECT dy.dosya_url, d.ad 
             FROM deneme_yuklemeleri dy 
             JOIN deneme_takvimi d ON d.id = dy.deneme_id 
             WHERE dy.id = $1`,
            [uploadId]
        );

        if (upload.rowCount === 0) throw new AppError('Dosya bulunamadı', 404);

        const targetUrl = upload.rows[0].dosya_url;
        const urlParts = targetUrl.split('/');
        const typeIndex = urlParts.findIndex(p => ['upload', 'private', 'authenticated'].includes(p));
        const resourceType = urlParts[typeIndex - 1] || 'image';
        const deliveryType = urlParts[typeIndex] || 'upload';

        let version = '';
        let publicIdParts = [];

        for (let i = typeIndex + 1; i < urlParts.length; i++) {
            const part = urlParts[i];
            if (part.startsWith('s--')) continue;
            if (part.startsWith('v') && /v\d+/.test(part)) {
                version = part.substring(1);
                continue;
            }
            publicIdParts.push(part);
        }

        const publicIdWithExt = publicIdParts.join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

        const authenticatedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            version: version,
            sign_url: true,
            secure: true,
            type: deliveryType,
            flags: 'attachment'
        });

        const response = await fetch(authenticatedUrl);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'No body');
            console.error(`❌ Cloudinary access failed (Download). Status: ${response.status}, Body: ${errorBody}`);
            throw new AppError(`Dosya sunucudan çekilemedi (Bulut Hatası: ${response.status})`, response.status === 401 ? 401 : 500);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(upload.rows[0].ad)}.pdf"`);

        const nodeStream = Readable.fromWeb(response.body);
        nodeStream.pipe(res);
    } catch (error) {
        next(error);
    }
});

// Auto-Ensure Tables Exist (FAILSAFE for migration issues)
const ensureTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deneme_takvimi (
                id SERIAL PRIMARY KEY,
                ad VARCHAR(255) NOT NULL,
                planlanan_tarih DATE NOT NULL,
                aciklama TEXT,
                gorev_tipi VARCHAR(50) DEFAULT 'deneme',
                aktif BOOLEAN DEFAULT true,
                olusturan_id INTEGER REFERENCES kullanicilar(id),
                olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // We might also want to add the column if it doesn't exist, though migration handles it
        try {
            await pool.query(`ALTER TABLE deneme_takvimi ADD COLUMN IF NOT EXISTS gorev_tipi VARCHAR(50) DEFAULT 'deneme'`);
        } catch (colErr) { }

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

        const { ad, planlanan_tarih, aciklama, gorev_tipi } = req.body;
        if (!ad || !planlanan_tarih) {
            throw new AppError('Deneme adı ve tarihi zorunludur', 400);
        }

        const result = await pool.query(
            `INSERT INTO deneme_takvimi (ad, planlanan_tarih, aciklama, olusturan_id, gorev_tipi) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [ad, planlanan_tarih, aciklama, req.user.id, gorev_tipi || 'deneme']
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
            query += `, (SELECT id FROM deneme_yuklemeleri dy WHERE dy.deneme_id = d.id AND dy.brans_id = $1 ORDER BY dy.yukleme_tarihi DESC LIMIT 1) as my_upload_id`;
            query += `, (SELECT dosya_url FROM deneme_yuklemeleri dy WHERE dy.deneme_id = d.id AND dy.brans_id = $1 ORDER BY dy.yukleme_tarihi DESC LIMIT 1) as my_upload_url`;
            params.push(req.user.brans_id);
        } else {
            query += `, NULL as my_upload_id, NULL as my_upload_url`;
        }

        // Admin için tüm branşların yüklemelerini de getir
        if (req.user.rol === 'admin') {
            query += `, (
                SELECT json_agg(up) FROM (
                    SELECT DISTINCT ON (dy.brans_id)
                        dy.id,
                        COALESCE(b.brans_adi, 'Genel') as brans_adi,
                        dy.dosya_url,
                        dy.yukleme_tarihi
                    FROM deneme_yuklemeleri dy
                    LEFT JOIN branslar b ON dy.brans_id = b.id
                    WHERE dy.deneme_id = d.id
                    ORDER BY dy.brans_id, dy.yukleme_tarihi DESC
                ) as up
            ) as all_uploads`;
        } else {
            query += `, NULL as all_uploads`;
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
        const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const publicId = `${timestamp}_${sanitizedFilename}`;
        const uploadPromise = new Promise((resolve, reject) => {
            const cleanFileName = sanitizedFilename.split('.').slice(0, -1).join('.') || 'dosya';
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    format: 'pdf',
                    folder: 'soru-havuzu/denemeler',
                    public_id: `${timestamp}_${cleanFileName}`,
                    use_filename: false,
                    unique_filename: false,
                    access_mode: 'public',
                    type: 'upload'
                },
                (error, result) => {
                    if (error) {
                        console.error('DEBUG: Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        // Cloudinary result.secure_url format: .../image/upload/v123/folder/name.pdf
                        console.log('DEBUG: Cloudinary upload success:', result.secure_url);
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

// 5. Deneme Planını Sil (SADECE ADMIN)
router.delete('/plan/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Önce plana ait yüklemeler silinmeli (veya CASCADE varsa otomatik silinir ama biz garantiye alalım)
        // Cloudinary tarafında dosya silme işlemi de eklenebilir ancak şu an DB temizliğini ana alalım

        const result = await pool.query('DELETE FROM deneme_takvimi WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            throw new AppError('Plan bulunamadı', 404);
        }

        res.json({ success: true, message: 'Deneme planı başarıyla silindi.' });
    } catch (error) {
        next(error);
    }
});

// 6. Münferit Yüklemeyi Sil (Yükleyen veya Admin)
router.delete('/upload/:id', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Yüklemeyi bul
        const upload = await pool.query('SELECT * FROM deneme_yuklemeleri WHERE id = $1', [id]);
        if (upload.rowCount === 0) {
            throw new AppError('Yükleme bulunamadı', 404);
        }

        // Yetki kontrolü: Ya admin olmalı ya da yükleyen kişi olmalı
        if (req.user.rol !== 'admin' && upload.rows[0].yukleyen_id !== req.user.id) {
            throw new AppError('Bu işlemi yapmaya yetkiniz yok.', 403);
        }

        // DB'den sil (Cloudinary silme işlemi opsiyonel olarak eklenebilir)
        await pool.query('DELETE FROM deneme_yuklemeleri WHERE id = $1', [id]);

        res.json({ success: true, message: 'Yükleme başarıyla silindi.' });
    } catch (error) {
        next(error);
    }
});

export default router;
