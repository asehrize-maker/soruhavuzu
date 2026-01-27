import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import uploadLogger from '../middleware/uploadLogger.js';

const router = express.Router();

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
// Her deneme için kullanıcının branşının yükleme yapıp yapmadığı bilgisini de dönebiliriz.
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
router.post('/:id/upload', authenticate, uploadLogger.single('pdf_dosya'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { brans_id } = req.body; // Kullanıcı seçebilir veya token'dan gelebilir

        // Kullanıcının branşını doğrula veya body'den al
        const targetBransId = brans_id || req.user.brans_id;

        if (!targetBransId) {
            throw new AppError('Branş bilgisi bulunamadı.', 400);
        }
        if (!req.file) {
            throw new AppError('Lütfen bir PDF dosyası yükleyin.', 400);
        }

        // Dosya URL'i (Cloudinary veya local, uploadLogger middleware'ine bağlı)
        const dosyaUrl = req.file.path || req.file.url;

        // Önceki yüklemeyi kontrol et? Yoksa direkt ekle mi?
        // Ajanda mantığı için son yüklemeyi baz alacağız, o yüzden insert yapalım.
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
// Mantık: Her deneme + Her branş kombinasyonu için durum kontrolü
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
            const plannedDate = new Date(d.planlanan_tarih).toDateString(); // "Tue Jan 27 2026"

            // Her branş için durumu kontrol et
            const row = {
                deneme: d,
                details: []
            };

            for (const b of branslar.rows) {
                // Bu branş bu denemeye dosya yüklemiş mi?
                const uploads = yuklemeler.rows.filter(y => y.deneme_id === d.id && y.brans_id === b.id);

                // Yükleme var mı ve tarihi tutuyor mu?
                let completed = false;
                let uploadInfo = null;

                if (uploads.length > 0) {
                    // En son yüklemeyi al
                    const lastUpload = uploads.sort((a, b) => new Date(b.yukleme_tarihi) - new Date(a.yukleme_tarihi))[0];
                    const uploadDate = new Date(lastUpload.yukleme_tarihi).toDateString();

                    if (uploadDate === plannedDate) {
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
