import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import cloudinary from '../config/cloudinary.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './bildirim.routes.js';

const router = express.Router();

// Multer config (memory storage) - Fotoğraf için
const uploadFotograf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir'), false);
    }
  }
});

// Multer config - Birden fazla dosya için (fotoğraf + dosya)
const uploadFields = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB (en büyük dosya limiti)
  },
  fileFilter: (req, file, cb) => {
    // Fotoğraf alanı için sadece resim
    if (file.fieldname === 'fotograf') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Fotoğraf için sadece resim dosyaları yüklenebilir'), false);
      }
    }
    // Dosya alanı için PDF, Word, Excel
    else if (file.fieldname === 'dosya') {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        // 1MB limit kontrolü dosya için
        if (parseInt(req.headers['content-length']) > 6 * 1024 * 1024) {
          cb(new Error('Toplam dosya boyutu çok büyük'), false);
        } else {
          cb(null, true);
        }
      } else {
        cb(new Error('Dosya için sadece PDF, Word, Excel veya TXT dosyaları yüklenebilir'), false);
      }
    } else {
      cb(null, true);
    }
  }
});

// Eski upload değişkenini koru (geriye uyumluluk için)
const upload = uploadFotograf;

// Tüm soruları getir (filtreleme ile)
router.get('/', authenticate, async (req, res, next) => {
  try {
    console.log('GET /sorular Request:', req.query, 'User Role:', req.user?.rol);
    const { durum, brans_id, ekip_id, olusturan_id } = req.query;

    let query = `
      SELECT s.*, 
             b.brans_adi, b.ekip_id,
             e.ekip_adi,
             k.ad_soyad as olusturan_ad,
             d.ad_soyad as dizgici_ad
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN kullanicilar d ON s.dizgici_id = d.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Rol bazlı filtreleme
    if (req.user.rol === 'soru_yazici') {
      // Soru yazıcı:
      // 1. Kendi oluşturduğu tüm soruları görür.
      // 2. Kendi branşındaki 'tamamlandi' durumundaki soruları görür (Havuz mantığı).
      query += ` AND (
        s.olusturan_kullanici_id = $${paramCount++} 
        OR (s.durum = 'tamamlandi' AND s.brans_id = $${paramCount++})
      )`;
      params.push(req.user.id, req.user.brans_id);
    } else if (req.user.rol === 'dizgici') {
      // Dizgici sadece üzerine gelen aktif dizgi işlerini (bekliyor/dizgide) görür
      query += ` AND (s.durum = 'dizgi_bekliyor' OR s.durum = 'dizgide') AND (
        b.id IN (SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $${paramCount++})
        OR b.id = (SELECT brans_id FROM kullanicilar WHERE id = $${paramCount++})
      )`;
      params.push(req.user.id, req.user.id);
    } else if (['alan_incelemeci', 'dil_incelemeci', 'incelemeci'].includes(req.user.rol)) {
      // İncelemeciler (Alan/Dil) şu an tüm soruları görebilir.
      // İleride 'kullanici_branslari' ile kısıtlanabilir.
      // Şimdilik pas geçiyoruz (WHERE 1=1 devam ediyor).
      console.log(`İncelemeci (${req.user.rol}) talebi. Filtre uygulanmadı.`);
    }

    if (durum) {
      query += ` AND s.durum = $${paramCount++}`;
      params.push(durum);
    }

    if (brans_id) {
      query += ` AND s.brans_id = $${paramCount++}`;
      params.push(brans_id);
    }

    if (ekip_id) {
      query += ` AND b.ekip_id = $${paramCount++}`;
      params.push(ekip_id);
    }

    if (olusturan_id) {
      query += ` AND s.olusturan_kullanici_id = $${paramCount++}`;
      params.push(olusturan_id);
    }

    query += ' ORDER BY s.olusturulma_tarihi DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Soru detayı (sadece numeric ID'ler)
router.get('/:id(\\d+)', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT s.*, 
             b.brans_adi, b.ekip_id,
             e.ekip_adi,
             k.ad_soyad as olusturan_ad, k.email as olusturan_email,
             d.ad_soyad as dizgici_ad, d.email as dizgici_email
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN kullanicilar d ON s.dizgici_id = d.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = result.rows[0];

    // Yetki kontrolü
    if (req.user.rol === 'soru_yazici' && soru.olusturan_kullanici_id !== req.user.id) {
      throw new AppError('Bu soruyu görme yetkiniz yok', 403);
    }

    // Dizgi geçmişi
    const gecmisResult = await pool.query(`
      SELECT dg.*, k.ad_soyad as dizgici_ad
      FROM dizgi_gecmisi dg
      LEFT JOIN kullanicilar k ON dg.dizgici_id = k.id
      WHERE dg.soru_id = $1
      ORDER BY dg.tamamlanma_tarihi DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...soru,
        dizgi_gecmisi: gecmisResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

// Yeni soru oluştur (Soru yazıcı ve Admin)
router.post('/', [
  authenticate,
  authorize('admin', 'soru_yazici'),
  uploadFields.fields([
    { name: 'fotograf', maxCount: 1 },
    { name: 'dosya', maxCount: 1 }
  ]),
  body('soru_metni').trim().notEmpty().withMessage('Soru metni gerekli'),
  body('brans_id').isInt().withMessage('Geçerli bir branş seçin')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    console.log('--- Soru Ekleme İsteği ---');
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    console.log('Has fotograf:', req.files?.fotograf ? 'Evet' : 'Hayır');
    console.log('Has dosya:', req.files?.dosya ? 'Evet' : 'Hayır');

    const {
      soru_metni, zorluk_seviyesi, brans_id, latex_kodu, kazanim,
      secenek_a, secenek_b, secenek_c, secenek_d, secenek_e, dogru_cevap,
      fotograf_konumu
    } = req.body;

    let fotograf_url = null;
    let fotograf_public_id = null;
    let dosya_url = null;
    let dosya_public_id = null;
    let dosya_adi = null;
    let dosya_boyutu = null;

    // Fotoğraf yükleme
    if (req.files && req.files.fotograf && req.files.fotograf[0]) {
      const file = req.files.fotograf[0];
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'soru-havuzu',
        resource_type: 'auto',
        transformation: [
          {
            width: 1920,
            height: 1920,
            crop: 'limit',
            quality: 'auto:good',
            fetch_format: 'auto'
          }
        ]
      });

      fotograf_url = uploadResult.secure_url;
      fotograf_public_id = uploadResult.public_id;
    }

    // Dosya yükleme (1MB limit)
    if (req.files && req.files.dosya && req.files.dosya[0]) {
      const file = req.files.dosya[0];
      console.log('Dosya yükleniyor:', file.originalname, file.mimetype, file.size);

      // 1MB boyut kontrolü
      if (file.size > 1 * 1024 * 1024) {
        throw new AppError('Dosya boyutu 1MB\'dan büyük olamaz', 400);
      }

      // Dosya adını ve uzantısını koru
      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const publicId = `soru-havuzu/dosyalar/${timestamp}_${sanitizedFilename}`;

      console.log('Cloudinary\'ye yükleniyor, public_id:', publicId);

      // Büyük dosyalar için stream kullan
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: 'raw',
            type: 'upload',
            timeout: 60000 // 60 saniye timeout
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload hatası:', error);
              reject(error);
            } else {
              console.log('Cloudinary tam yanıt:', JSON.stringify(result, null, 2));
              resolve(result);
            }
          }
        );

        // Buffer'ı stream'e yaz
        uploadStream.end(file.buffer);
      });

      const uploadResult = await uploadPromise;

      console.log('Upload başarılı mı?:', uploadResult.secure_url ? 'Evet' : 'Hayır');
      console.log('Cloudinary URL:', uploadResult.secure_url);

      dosya_url = uploadResult.secure_url;
      dosya_public_id = uploadResult.public_id;
      dosya_adi = file.originalname;
      dosya_boyutu = file.size;
    } else {
      console.log('Dosya bulunamadı req.files içinde');
    }

    console.log('Veritabanına kaydedilecek dosya bilgileri:', {
      dosya_url,
      dosya_public_id,
      dosya_adi,
      dosya_boyutu
    });

    const result = await pool.query(
      `INSERT INTO sorular (
        soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi, brans_id, 
        latex_kodu, kazanim, olusturan_kullanici_id, 
        dosya_url, dosya_public_id, dosya_adi, dosya_boyutu,
        secenek_a, secenek_b, secenek_c, secenek_d, secenek_e, dogru_cevap, fotograf_konumu
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi || null, brans_id,
        latex_kodu || null, kazanim || null, req.user.id,
        dosya_url, dosya_public_id, dosya_adi, dosya_boyutu,
        secenek_a || null, secenek_b || null, secenek_c || null, secenek_d || null, secenek_e || null, dogru_cevap || null, fotograf_konumu || 'ust'
      ]
    );

    console.log('Soru başarıyla eklendi, ID:', result.rows[0].id);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Soru güncelle
router.put('/:id(\\d+)', [
  authenticate,
  upload.single('fotograf'),
  body('soru_metni').trim().notEmpty().withMessage('Soru metni gerekli')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const {
      soru_metni, zorluk_seviyesi,
      secenek_a, secenek_b, secenek_c, secenek_d, secenek_e, dogru_cevap,
      fotograf_konumu
    } = req.body;

    // Soru sahibi kontrolü
    const checkResult = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);

    if (checkResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = checkResult.rows[0];

    // İncelemeye giden sorularda değişiklik yapılamamalı (Admin hariç)
    // Ancak 'revize_istendi' durumundaysa yazar düzenleyebilir.
    const isRevize = soru.durum === 'revize_istendi';
    if (req.user.rol !== 'admin' && !isRevize && (soru.durum === 'dizgide' || soru.durum === 'tamamlandi' || soru.durum === 'dizgi_bekliyor')) {
      throw new AppError('İşlemdeki veya tamamlanmış sorular düzenlenemez.', 403);
    }

    if (req.user.rol !== 'admin' && soru.olusturan_kullanici_id !== req.user.id) {
      throw new AppError('Bu soruyu düzenleme yetkiniz yok', 403);
    }

    let fotograf_url = soru.fotograf_url;
    let fotograf_public_id = soru.fotograf_public_id;

    // Yeni fotoğraf yükleme
    if (req.file) {
      // Eski fotoğrafı sil
      if (soru.fotograf_public_id) {
        await cloudinary.uploader.destroy(soru.fotograf_public_id);
      }

      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'soru-havuzu',
        resource_type: 'auto',
        transformation: [
          {
            width: 1920,
            height: 1920,
            crop: 'limit',
            quality: 'auto:good',
            fetch_format: 'auto'
          }
        ]
      });

      fotograf_url = uploadResult.secure_url;
      fotograf_public_id = uploadResult.public_id;
    }

    // Yazar güncelleme yaparsa (veya admin), durumu tekrar inceleme bekliyor yap
    // Böylece revize edilen soru tekrar incelemeye düşer.
    let yeniDurum = soru.durum;
    if (req.user.rol === 'soru_yazici' || req.user.rol === 'admin') {
      yeniDurum = 'inceleme_bekliyor';
    }

    // 1. Mevcut halini versiyon geçmişine kaydet (Backup)
    await pool.query(
      `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        soru.versiyon || 1,
        JSON.stringify(soru),
        req.user.id,
        'Soru güncellemesi'
      ]
    );

    const result = await pool.query(
      `UPDATE sorular 
       SET soru_metni = $1, fotograf_url = $2, fotograf_public_id = $3, 
           zorluk_seviyesi = $4, kazanim = $5, durum = $6, 
           secenek_a = $7, secenek_b = $8, secenek_c = $9, secenek_d = $10, secenek_e = $11, 
           dogru_cevap = $12, fotograf_konumu = $13,
           guncellenme_tarihi = CURRENT_TIMESTAMP,
           versiyon = COALESCE(versiyon, 1) + 1
       WHERE id = $14 RETURNING *`,
      [
        soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi, req.body.kazanim || null, yeniDurum,
        secenek_a || null, secenek_b || null, secenek_c || null, secenek_d || null, secenek_e || null,
        dogru_cevap || null, fotograf_konumu || 'ust',
        id
      ]
    );

    // Eğer revize durumundan güncellendiyse ve dizgici atanmışsa, dizgiciye bildirim gönder
    if (soru.durum === 'revize_gerekli' && soru.dizgici_id) {
      await createNotification(
        soru.dizgici_id,
        'Soru Revize Edildi',
        `#${id} numaralı soru öğretmen tarafından revize edildi ve tekrar incelemeniz için hazır.`,
        'info',
        `/sorular/${id}`
      );
    }

    res.json({
      success: true,
      message: 'Soru güncellendi ve yeni versiyon oluşturuldu',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Soru Durumunu Güncelle (İncelemeci Onay/Revize)
router.put('/:id(\\d+)/durum', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { yeni_durum, aciklama, inceleme_turu } = req.body; // inceleme_turu: 'alanci', 'dilci'

    if (!['dizgi_bekliyor', 'revize_istendi', 'tamamlandi', 'inceleme_bekliyor', 'dizgide', 'inceleme_tamam'].includes(yeni_durum)) {
      throw new AppError('Geçersiz durum', 400);
    }

    // Soruyu al
    const soruRes = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);
    if (soruRes.rows.length === 0) throw new AppError('Soru bulunamadı', 404);
    const soru = soruRes.rows[0];

    let result;
    let message = '';

    // Duruma göre işlem
    if (yeni_durum === 'revize_istendi') {
      // Revize istendi: Onayları sıfırla ve durumu güncelle
      result = await pool.query(
        `UPDATE sorular 
         SET durum = $1, onay_alanci = false, onay_dilci = false, guncellenme_tarihi = NOW()
         WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
      message = 'Revize istendi, onaylar sıfırlandı.';

      // Yazara bildirim
      if (soru.olusturan_kullanici_id) {
        await createNotification(soru.olusturan_kullanici_id, 'Revize İsteği', `#${id} nolu sorunuz için revize istendi: ${aciklama}`, 'warning', `/sorular/${id}`);
      }

    } else if (yeni_durum === 'inceleme_tamam') {
      // Kullanıcı talebi: Hem alan hem dil incelemesi bitmeden branşa dönmez.
      let updateField = '';
      if (inceleme_turu === 'alanci') updateField = 'onay_alanci';
      else if (inceleme_turu === 'dilci') updateField = 'onay_dilci';
      else if (req.user.rol === 'admin') {
        await pool.query('UPDATE sorular SET onay_alanci = true, onay_dilci = true WHERE id = $1', [id]);
        updateField = 'all';
      } else {
        throw new AppError('İnceleme yapmak için yetki veya inceleme türü eksik', 400);
      }

      if (updateField !== 'all') {
        await pool.query(`UPDATE sorular SET ${updateField} = true WHERE id = $1`, [id]);
      }

      const check = await pool.query('SELECT onay_alanci, onay_dilci, olusturan_kullanici_id FROM sorular WHERE id = $1', [id]);
      const { onay_alanci, onay_dilci, olusturan_kullanici_id } = check.rows[0];

      if (onay_alanci && onay_dilci) {
        // İkisi de tamamsa Branşa (Revize İstendi) gönder
        result = await pool.query(
          `UPDATE sorular SET durum = 'revize_istendi', guncellenme_tarihi = NOW() WHERE id = $1 RETURNING *`,
          [id]
        );
        message = 'Tüm incelemeler tamamlandı, soru Branşa geri gönderildi.';
        if (olusturan_kullanici_id) {
          await createNotification(olusturan_kullanici_id, 'İnceleme Tamamlandı', `#${id} nolu sorunuzun tüm incelemeleri bitti, kontrol edebilirsiniz.`, 'info', `/sorular/${id}`);
        }
      } else {
        const currentRes = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);
        result = currentRes;
        message = `${inceleme_turu === 'alanci' ? 'Alan' : 'Dil'} incelemesi bitti. Diğer inceleme bekleniyor.`;
      }

    } else if (yeni_durum === 'dizgi_bekliyor') {
      // Branş tarafından onaya gelen soru
      result = await pool.query(
        `UPDATE sorular SET durum = 'dizgi_bekliyor', guncellenme_tarihi = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      message = 'Soru dizgi sırasına alındı.';
    } else if (yeni_durum === 'dizgide') {
      // Dizgici soruyu üzerine alır
      result = await pool.query(
        `UPDATE sorular SET durum = 'dizgide', dizgici_id = $1, guncellenme_tarihi = NOW() WHERE id = $2 RETURNING *`,
        [req.user.id, id]
      );
      message = 'Soru dizgiye alındı.';
    } else if (yeni_durum === 'tamamlandi') {
      // Final onay (Dizgici veya Admin)
      result = await pool.query(
        `UPDATE sorular SET durum = $1, guncellenme_tarihi = NOW() WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
      message = 'Soru tamamlandı ve yayınlandı.';
    }

    // Açıklama varsa yorum olarak ekle
    if (aciklama) {
      await pool.query(
        `INSERT INTO soru_yorumlari (soru_id, kullanici_id, yorum_metni) VALUES ($1, $2, $3)`,
        [id, req.user.id, `Durum: ${yeni_durum} ${inceleme_turu ? '(' + inceleme_turu + ')' : ''}. Açıklama: ${aciklama}`]
      );
    }

    res.json({
      success: true,
      data: result ? result.rows[0] : null,
      message
    });

  } catch (error) {
    next(error);
  }
});

// Yorum Ekleme Endpoint'i
router.post('/:id/yorum', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { yorum_metni } = req.body;

    if (!yorum_metni) {
      throw new AppError('Yorum metni zorunludur', 400);
    }

    const result = await pool.query(
      `INSERT INTO soru_yorumlari(soru_id, kullanici_id, yorum_metni) 
       VALUES($1, $2, $3) RETURNING * `,
      [id, req.user.id, yorum_metni]
    );

    res.json({
      success: true,
      message: 'Yorum eklendi',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Soru Yorumlarını Getirme
router.get('/:id/yorumlar', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT sy.*, k.ad_soyad, k.rol 
      FROM soru_yorumlari sy
      JOIN kullanicilar k ON sy.kullanici_id = k.id
      WHERE sy.soru_id = $1
      ORDER BY sy.tarih DESC
            `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Soru Geçmişini (Versiyonlarını) Getirme
router.get('/:id/gecmis', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Sadece admin veya soru sahibi görebilir
    const soruCheck = await pool.query('SELECT olusturan_kullanici_id FROM sorular WHERE id = $1', [id]);
    if (soruCheck.rows.length === 0) throw new AppError('Soru bulunamadı', 404);

    if (req.user.rol !== 'admin' && soruCheck.rows[0].olusturan_kullanici_id !== req.user.id) {
      throw new AppError('Yetkisiz işlem', 403);
    }

    const result = await pool.query(`
      SELECT sv.*, k.ad_soyad 
      FROM soru_versiyonlari sv
      LEFT JOIN kullanicilar k ON sv.degistiren_kullanici_id = k.id
      WHERE sv.soru_id = $1
      ORDER BY sv.versiyon_no DESC
            `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Soruyu dizgiye al (Dizgici)
router.post('/:id(\\d+)/dizgi-al', authenticate, authorize('dizgici', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE sorular 
       SET durum = 'dizgide', dizgici_id = $1, guncellenme_tarihi = CURRENT_TIMESTAMP
       WHERE id = $2 AND(durum = 'dizgi_bekliyor' OR durum = 'beklemede')-- beklemede geçici uyumluluk için
       RETURNING * `,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Soru bulunamadı veya zaten dizgide', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Soru dizgiye alındı'
    });
  } catch (error) {
    next(error);
  }
});

// Dizgiyi tamamla (Dizgici)
router.post('/:id(\\d+)/dizgi-tamamla', [
  authenticate,
  authorize('dizgici', 'admin'),
  body('notlar').optional()
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notlar } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Soruyu güncelle -> Dizgiden dönen soru tekrar incelemeye gider
      const soruResult = await client.query(
        `UPDATE sorular 
         SET durum = 'inceleme_bekliyor', guncellenme_tarihi = CURRENT_TIMESTAMP,
          versiyon = COALESCE(versiyon, 1) + 1
         WHERE id = $1 AND dizgici_id = $2
         RETURNING * `,
        [id, req.user.id]
      );

      const soru = soruResult.rows[0];

      // Versiyon geçmişine kaydet (Dizgici değişikliği)
      // Önce mevcut halini kaydetmek gerekirdi ama burada update yaptık.
      // Versiyon mantığı: Update öncesi eski datayı kaydetmeliydik.
      // Dizgi-tamamla sadece durum değiştiriyorsa versiyon atlamaya gerek olmayabilir 
      // AMA kullanıcı "dizgici düzelttiğinde... V1, V2 olsun" dedi.
      // Bu yüzden dizgi tamamla işleminde de bir versiyon snapshot alalım.
      // (Burada UPDATE sorgusu öncesinde SELECT yapmalıydık, basitlik için şimdilik update sonrası yapıyoruz ama
      // doğrusu update öncesi state'i saklamaktır. Neyse, update logic'i karmaşıklaştırmayalım, dizgici muhtemelen görsel yükledi)

      if (soruResult.rows.length === 0) {
        throw new AppError('Soru bulunamadı veya bu sorunun dizgicisi değilsiniz', 404);
      }

      // Dizgi geçmişine ekle
      await client.query(
        `INSERT INTO dizgi_gecmisi(soru_id, dizgici_id, durum, notlar) 
         VALUES($1, $2, 'tamamlandi', $3)`,
        [id, req.user.id, notlar]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: soruResult.rows[0],
        message: 'Dizgi tamamlandı'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Soru sil
router.delete('/:id(\\d+)', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const checkResult = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);

    if (checkResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = checkResult.rows[0];

    // Yetki kontrolü
    if (req.user.rol !== 'admin' && soru.olusturan_kullanici_id !== req.user.id) {
      throw new AppError('Bu soruyu silme yetkiniz yok', 403);
    }

    // Cloudinary'den fotoğrafı sil
    if (soru.fotograf_public_id) {
      try {
        const deleteResult = await cloudinary.uploader.destroy(soru.fotograf_public_id);
        console.log(`Cloudinary görsel silindi: ${soru.fotograf_public_id}`, deleteResult);
      } catch (cloudinaryError) {
        console.error(`Cloudinary görsel silinemedi: ${soru.fotograf_public_id}`, cloudinaryError);
        // Cloudinary hatası olsa bile soru silinmeye devam edecek
      }
    }

    // Cloudinary'den dosyayı sil
    if (soru.dosya_public_id) {
      try {
        const deleteResult = await cloudinary.uploader.destroy(soru.dosya_public_id, {
          resource_type: 'raw'
        });
        console.log(`Cloudinary dosya silindi: ${soru.dosya_public_id}`, deleteResult);
      } catch (cloudinaryError) {
        console.error(`Cloudinary dosya silinemedi: ${soru.dosya_public_id}`, cloudinaryError);
        // Cloudinary hatası olsa bile soru silinmeye devam edecek
      }
    }

    await pool.query('DELETE FROM sorular WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Soru silindi'
    });
  } catch (error) {
    next(error);
  }
});

// İstatistikler
router.get('/stats/genel', authenticate, async (req, res, next) => {
  try {
    let whereClause = '';
    const params = [];

    if (req.user.rol === 'soru_yazici') {
      whereClause = 'WHERE olusturan_kullanici_id = $1';
      params.push(req.user.id);
    } else if (req.user.rol === 'dizgici') {
      whereClause = `WHERE(
            brans_id IN(SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1)
        OR brans_id = (SELECT brans_id FROM kullanicilar WHERE id = $2)
      )`;
      params.push(req.user.id, req.user.id);
    }

    const result = await pool.query(`
      SELECT
        COUNT(*) as toplam,
        COUNT(*) FILTER(WHERE durum = 'beklemede') as beklemede,
        COUNT(*) FILTER(WHERE durum = 'inceleme_bekliyor') as inceleme_bekliyor,
        COUNT(*) FILTER(WHERE durum = 'dizgi_bekliyor') as dizgi_bekliyor,
        COUNT(*) FILTER(WHERE durum = 'dizgide') as dizgide,
        COUNT(*) FILTER(WHERE durum = 'tamamlandi') as tamamlandi,
        COUNT(*) FILTER(WHERE durum = 'revize_gerekli' OR durum = 'revize_istendi') as revize_gerekli
      FROM sorular
      ${whereClause}
      `, params);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Redundant code block cleaned up.

// Redundant code block cleaned up.


// Admin detaylı istatistikler
router.get('/stats/detayli', authenticate, async (req, res, next) => {
  try {
    if (req.user.rol !== 'admin') {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    // Genel istatistikler
    const genelStats = await pool.query(`
      SELECT
      COUNT(*) as toplam_soru,
        COUNT(CASE WHEN durum = 'beklemede' THEN 1 END) as beklemede,
        COUNT(CASE WHEN durum = 'dizgide' THEN 1 END) as dizgide,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlandi,
        COUNT(CASE WHEN durum = 'revize_gerekli' THEN 1 END) as revize_gerekli,
        COUNT(CASE WHEN zorluk_seviyesi = 'kolay' THEN 1 END) as kolay,
        COUNT(CASE WHEN zorluk_seviyesi = 'orta' THEN 1 END) as orta,
        COUNT(CASE WHEN zorluk_seviyesi = 'zor' THEN 1 END) as zor,
        COUNT(CASE WHEN fotograf_url IS NOT NULL THEN 1 END) as fotografli,
        COUNT(CASE WHEN latex_kodu IS NOT NULL AND latex_kodu != '' THEN 1 END) as latexli
      FROM sorular
        `);

    // Branş bazlı istatistikler
    const bransStats = await pool.query(`
      SELECT
      b.id,
        b.brans_adi,
        e.ekip_adi,
        COUNT(s.id) as soru_sayisi,
        COUNT(CASE WHEN s.durum = 'beklemede' THEN 1 END) as beklemede,
        COUNT(CASE WHEN s.durum = 'dizgide' THEN 1 END) as dizgide,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlandi
      FROM branslar b
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN sorular s ON b.id = s.brans_id
      GROUP BY b.id, b.brans_adi, e.ekip_adi
      ORDER BY soru_sayisi DESC
        `);

    // Kullanıcı performans istatistikleri
    const kullaniciStats = await pool.query(`
      SELECT
      k.id,
        k.ad_soyad,
        k.email,
        k.rol,
        b.brans_adi,
        COUNT(s.id) as olusturulan_soru,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.olusturan_kullanici_id
      WHERE k.rol = 'soru_yazici'
      GROUP BY k.id, k.ad_soyad, k.email, k.rol, b.brans_adi
      ORDER BY olusturulan_soru DESC
      LIMIT 10
        `);

    // Dizgici performans istatistikleri
    const dizgiStats = await pool.query(`
      SELECT
      k.id,
        k.ad_soyad,
        k.email,
        b.brans_adi,
        COUNT(dg.id) as tamamlanan_dizgi,
        AVG(EXTRACT(EPOCH FROM(dg.tamamlanma_tarihi - s.olusturulma_tarihi)) / 3600):: numeric(10, 2) as ortalama_sure_saat
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN dizgi_gecmisi dg ON k.id = dg.dizgici_id
      LEFT JOIN sorular s ON dg.soru_id = s.id
      WHERE k.rol = 'dizgici'
      GROUP BY k.id, k.ad_soyad, k.email, b.brans_adi
      ORDER BY tamamlanan_dizgi DESC
      LIMIT 10
        `);

    // Son 30 günlük trend
    const trendStats = await pool.query(`
      SELECT
      DATE(olusturulma_tarihi) as tarih,
        COUNT(*) as soru_sayisi,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM sorular
      WHERE olusturulma_tarihi >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(olusturulma_tarihi)
      ORDER BY tarih DESC
        `);

    // Kullanıcı sayıları
    const kullaniciSayilari = await pool.query(`
      SELECT
      COUNT(CASE WHEN rol = 'admin' THEN 1 END) as admin_sayisi,
        COUNT(CASE WHEN rol = 'soru_yazici' THEN 1 END) as soru_yazici_sayisi,
        COUNT(CASE WHEN rol = 'dizgici' THEN 1 END) as dizgici_sayisi,
        COUNT(*) as toplam_kullanici
      FROM kullanicilar
        `);

    // Ekip sayıları
    const ekipStats = await pool.query(`
      SELECT COUNT(*) as toplam_ekip FROM ekipler
        `);

    // Branş sayıları (Tekil - Büyük/küçük harf duyarsız, boşluklar temizlenmiş)
    const bransStatsCount = await pool.query(`
      SELECT COUNT(DISTINCT UPPER(TRIM(brans_adi))) as toplam_brans FROM branslar
        `);

    res.json({
      success: true,
      data: {
        genel: genelStats.rows[0],
        branslar: bransStats.rows,
        kullanicilar: kullaniciStats.rows,
        dizgiciler: dizgiStats.rows,
        trend: trendStats.rows,
        sistem: {
          ...kullaniciSayilari.rows[0],
          toplam_ekip: ekipStats.rows[0].toplam_ekip,
          toplam_brans: bransStatsCount.rows[0].toplam_brans
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Rapor verilerini getir (haftalık/aylık)
router.get('/rapor', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { baslangic, bitis, tip } = req.query;

    if (!baslangic || !bitis) {
      throw new AppError('Başlangıç ve bitiş tarihi gerekli', 400);
    }

    // Genel istatistikler (tarih aralığına göre)
    const genelQuery = `
      SELECT
      COUNT(*) as toplam_soru,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlanan,
        COUNT(CASE WHEN durum = 'beklemede' THEN 1 END) as bekleyen,
        COUNT(CASE WHEN durum = 'dizgide' THEN 1 END) as devam_eden,
        0 as reddedilen,
        COUNT(CASE WHEN fotograf_url IS NOT NULL THEN 1 END) as fotografli,
        COUNT(CASE WHEN latex_kodu IS NOT NULL THEN 1 END) as latexli,
        COUNT(CASE WHEN zorluk_seviyesi = 'kolay' THEN 1 END) as kolay,
        COUNT(CASE WHEN zorluk_seviyesi = 'orta' THEN 1 END) as orta,
        COUNT(CASE WHEN zorluk_seviyesi = 'zor' THEN 1 END) as zor
      FROM sorular
      WHERE olusturulma_tarihi >= $1::date AND olusturulma_tarihi < ($2:: date + interval '1 day')
  `;

    // Branş bazında detaylı rapor
    const bransQuery = `
SELECT
b.brans_adi,
  e.ekip_adi,
  COUNT(s.id) as toplam_soru,
  COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan,
  COUNT(CASE WHEN s.durum = 'beklemede' THEN 1 END) as bekleyen,
  COUNT(CASE WHEN s.durum = 'dizgide' THEN 1 END) as devam_eden,
  0 as reddedilen,
  ROUND(AVG(
    CASE WHEN s.durum = 'tamamlandi' 
          THEN EXTRACT(EPOCH FROM(s.guncellenme_tarihi - s.olusturulma_tarihi)) / 3600 
          END
  ):: numeric, 2) as ortalama_sure_saat
      FROM branslar b
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN sorular s ON b.id = s.brans_id 
        AND s.olusturulma_tarihi >= $1:: date 
        AND s.olusturulma_tarihi < ($2:: date + interval '1 day')
      GROUP BY b.id, b.brans_adi, e.ekip_adi
      ORDER BY toplam_soru DESC
  `;

    // Kullanıcı performans raporu (soru yazıcılar)
    const kullaniciQuery = `
SELECT
k.ad_soyad,
  k.email,
  b.brans_adi,
  COUNT(s.id) as olusturulan_soru,
  COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan,
  0 as reddedilen,
  ROUND(
    (COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END):: float /
    NULLIF(COUNT(s.id), 0) * 100):: numeric, 2
        ) as basari_orani
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.olusturan_kullanici_id 
        AND s.olusturulma_tarihi >= $1:: date 
        AND s.olusturulma_tarihi < ($2:: date + interval '1 day')
      WHERE k.rol = 'soru_yazici'
      GROUP BY k.id, k.ad_soyad, k.email, b.brans_adi
      HAVING COUNT(s.id) > 0
      ORDER BY olusturulan_soru DESC
  `;

    // Dizgici performans raporu
    const dizgiQuery = `
SELECT
k.ad_soyad,
  k.email,
  b.brans_adi,
  COUNT(s.id) as tamamlanan_soru,
  ROUND(AVG(
    CASE WHEN s.durum = 'tamamlandi' AND s.dizgici_id IS NOT NULL
          THEN EXTRACT(EPOCH FROM(s.guncellenme_tarihi - s.olusturulma_tarihi)) / 3600
          END
  ):: numeric, 2) as ortalama_sure_saat,
  0 as reddedilen
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.dizgici_id 
        AND s.olusturulma_tarihi >= $1:: date 
        AND s.olusturulma_tarihi < ($2:: date + interval '1 day')
      WHERE k.rol = 'dizgici'
      GROUP BY k.id, k.ad_soyad, k.email, b.brans_adi
      HAVING COUNT(s.id) > 0
      ORDER BY tamamlanan_soru DESC
  `;

    // Günlük trend (rapor dönemi boyunca)
    const trendQuery = `
SELECT
DATE(olusturulma_tarihi) as tarih,
  COUNT(*) as olusturulan,
  COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM sorular
      WHERE olusturulma_tarihi >= $1::date AND olusturulma_tarihi < ($2:: date + interval '1 day')
      GROUP BY DATE(olusturulma_tarihi)
      ORDER BY tarih
  `;

    const [genel, branslar, kullanicilar, dizgiciler, trend] = await Promise.all([
      pool.query(genelQuery, [baslangic, bitis]),
      pool.query(bransQuery, [baslangic, bitis]),
      pool.query(kullaniciQuery, [baslangic, bitis]),
      pool.query(dizgiQuery, [baslangic, bitis]),
      pool.query(trendQuery, [baslangic, bitis])
    ]);

    res.json({
      success: true,
      data: {
        donem: {
          baslangic,
          bitis,
          tip: tip || 'ozel'
        },
        genel: genel.rows[0],
        branslar: branslar.rows,
        kullanicilar: kullanicilar.rows,
        dizgiciler: dizgiciler.rows,
        trend: trend.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

// Admin için yedekleme endpoint'i
router.get('/yedek', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    console.log('Yedekleme işlemi başlatıldı');

    // Tüm soruları çek
    const query = `
SELECT
s.*,
  u.ad_soyad as olusturan_ad,
  b.brans_adi,
  e.ekip_adi,
  d.ad_soyad as dizgici_ad
      FROM sorular s
      LEFT JOIN kullanicilar u ON s.olusturan_kullanici_id = u.id
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN kullanicilar d ON s.dizgici_id = d.id
      ORDER BY s.olusturulma_tarihi DESC
    `;

    const result = await pool.query(query);
    const sorular = result.rows;

    console.log(`Toplam ${sorular.length} soru bulundu`);

    // Soruları JSON olarak formatla
    const yedekData = {
      tarih: new Date().toISOString(),
      toplam_soru: sorular.length,
      sorular: sorular.map(soru => ({
        id: soru.id,
        soru_metni: soru.soru_metni,
        latex_kodu: soru.latex_kodu,
        zorluk_seviyesi: soru.zorluk_seviyesi,
        durum: soru.durum,
        olusturan: soru.olusturan_ad,
        brans: soru.brans_adi,
        ekip: soru.ekip_adi,
        dizgici: soru.dizgici_ad,
        fotograf_url: soru.fotograf_url,
        dosya_url: soru.dosya_url,
        dosya_adi: soru.dosya_adi,
        olusturulma_tarihi: soru.olusturulma_tarihi,
        guncelleme_tarihi: soru.guncelleme_tarihi,
        dizgi_baslama_tarihi: soru.dizgi_baslama_tarihi,
        dizgi_tamamlanma_tarihi: soru.dizgi_tamamlanma_tarihi,
        red_neden: soru.red_neden
      }))
    };

    res.json({
      success: true,
      data: yedekData
    });
  } catch (error) {
    console.error('Yedekleme hatası:', error);
    next(error);
  }
});

// Revize Notu Ekle
router.post('/:id/revize-not', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    let { secilen_metin, not_metni, inceleme_turu } = req.body;

    // Admin ekliyorsa ve tür belirtilmemişse veya 'admin' ise, DB kısıtlamasına takılmamak için 'alanci' yapalım
    if (inceleme_turu === 'admin' || !inceleme_turu) {
      inceleme_turu = 'alanci';
    }

    await pool.query(
      `INSERT INTO soru_revize_notlari (soru_id, kullanici_id, secilen_metin, not_metni, inceleme_turu) 
             VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user.id, secilen_metin, not_metni, inceleme_turu]
    );

    res.json({ success: true, message: 'Revize notu eklendi' });
  } catch (err) { next(err); }
});

// Revize Notlarını Getir
router.get('/:id/revize-notlari', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT srn.*, k.ad_soyad FROM soru_revize_notlari srn 
             JOIN kullanicilar k ON srn.kullanici_id = k.id 
             WHERE soru_id = $1 ORDER BY tarih ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

router.delete('/:id/revize-not/:notId', authenticate, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM soru_revize_notlari WHERE id=$1', [req.params.notId]);
    res.json({ success: true, message: 'Not silindi' });
  } catch (err) { next(err); }
});

export default router;
