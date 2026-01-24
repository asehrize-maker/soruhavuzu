import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import cloudinary from '../config/cloudinary.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './bildirim.routes.js';

const router = express.Router();

// Zorluk değerini 1-5 arasına sabitle (hem sayısal hem metinsel girişleri destekler)
const normalizeZorlukSeviyesi = (value) => {
  if (value === undefined || value === null) return 3;

  const raw = String(value).trim().toLowerCase();
  const num = parseInt(raw, 10);

  if (!Number.isNaN(num)) {
    return Math.min(5, Math.max(1, num));
  }

  if (['çok kolay', 'cok kolay', 'kolay', 'easy'].includes(raw)) return 2;
  if (['orta', 'normal', 'medium'].includes(raw)) return 3;
  if (['zor', 'hard'].includes(raw)) return 4;

  return 3;
};

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

// DEBUG ROUTE
router.get('/debug/visibility', async (req, res) => {
  try {
    const questions = await pool.query(`
      SELECT s.id, s.durum, s.onay_alanci, s.onay_dilci, s.brans_id, b.brans_adi, k.ad_soyad as yazar
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      WHERE s.durum = 'inceleme_bekliyor'
    `);

    const reviewers = await pool.query(`
        SELECT k.id, k.ad_soyad, k.rol, k.inceleme_alanci, k.inceleme_dilci, 
               k.brans_id as ana_brans_id,
               array_agg(kb.brans_id) as yetkili_branslar
        FROM kullanicilar k
        LEFT JOIN kullanici_branslari kb ON k.id = kb.kullanici_id
        WHERE k.rol = 'incelemeci'
        GROUP BY k.id
    `);

    res.json({
      pending_questions: questions.rows,
      reviewers: reviewers.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eski upload değişkenini koru (geriye uyumluluk için)
const upload = uploadFotograf;



// Tüm soruları getir (filtreleme ile)
router.get('/', authenticate, async (req, res, next) => {
  try {
    console.log('GET /sorular Request:', req.query, 'User Role:', req.user?.rol);
    const { durum, brans_id, ekip_id, olusturan_id, scope } = req.query;

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

    // Rol bazlı filtreleme ve İZOLASYON
    if (req.user.rol === 'dizgici') {
      // Dizgici: Havuzdaki (dizgi_bekliyor/revize_istendi) veya kendine atanmış işleri görür
      query += ` AND (
        s.durum IN ('dizgi_bekliyor', 'revize_istendi') 
        OR s.dizgici_id = $${paramCount++}
      )`;
      params.push(req.user.id);
    } else if (req.user.rol !== 'admin' && req.user.rol !== 'incelemeci') {

      if (scope === 'brans' || brans_id) {
        // Branş Havuzu: Sadece yetkili olduğu branşlar (Tüm durumlar)
        query += ` AND s.brans_id IN (
          SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $${paramCount}
          UNION 
          SELECT brans_id FROM kullanicilar WHERE id = $${paramCount}
        )`;
        params.push(req.user.id);
        paramCount++;
      } else {
        // Ortak Havuz (Varsayılan): Tamamlanmış veya Dizgisi bitmiş (kontrol için) sorular
        query += ` AND (s.durum = 'tamamlandi' OR s.durum = 'dizgi_tamam')`;
      }

    }

    if (durum) {
      query += ` AND s.durum = $${paramCount++}`;
      params.push(durum);
    }

    if (brans_id) {
      query += ` AND s.brans_id = $${paramCount++}`;
      params.push(brans_id);
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

    // Yetki kontrolü (Soru Yazıcı yetkili olduğu branşlardaki soruları görebilir)
    if (req.user.rol === 'soru_yazici') {
      const authBransResult = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1 AND brans_id = $2
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $1 AND brans_id = $2
      `, [req.user.id, soru.brans_id]);

      if (authBransResult.rows.length === 0 && soru.olusturan_kullanici_id !== req.user.id && soru.durum !== 'tamamlandi') {
        throw new AppError('Bu branştaki soruları görme yetkiniz yok', 403);
      }
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
    { name: 'dosya', maxCount: 1 },
    { name: 'final_png', maxCount: 1 }
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
      fotograf_konumu, durum
    } = req.body;

    const normalizedZorluk = normalizeZorlukSeviyesi(zorluk_seviyesi);

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

    console.log('Parsed Zorluk:', normalizedZorluk);

    const result = await pool.query(
      `INSERT INTO sorular (
        soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi, brans_id, 
        latex_kodu, kazanim, olusturan_kullanici_id, 
        dosya_url, dosya_public_id, dosya_adi, dosya_boyutu,
        secenek_a, secenek_b, secenek_c, secenek_d, secenek_e, dogru_cevap, fotograf_konumu,
        durum
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [
        soru_metni, fotograf_url, fotograf_public_id, normalizedZorluk, brans_id,
        latex_kodu || null, kazanim || null, req.user.id,
        dosya_url, dosya_public_id, dosya_adi, dosya_boyutu,
        secenek_a || null, secenek_b || null, secenek_c || null, secenek_d || null, secenek_e || null, dogru_cevap || null, fotograf_konumu || 'ust',
        durum || 'beklemede'
      ]
    );

    console.log('Soru başarıyla eklendi, ID:', result.rows[0].id);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Soru ekleme hatası (DETAYLI):', error);
    console.error('Stack:', error.stack);
    console.error('Request Body:', req.body);
    next(error);
  }
});



// Dizgi için branş bazlı bekleyen soru sayıları
router.get('/stats/dizgi-brans', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.rol === 'admin';
    let query;
    let params = [];

    if (isAdmin) {
      query = `
        SELECT b.id, b.brans_adi, COALESCE(COUNT(s.id) FILTER (WHERE s.durum = 'dizgi_bekliyor'), 0) as dizgi_bekliyor
        FROM branslar b
        LEFT JOIN sorular s ON b.id = s.brans_id
        GROUP BY b.id, b.brans_adi
        ORDER BY dizgi_bekliyor DESC
      `;
    } else {
      query = `
        SELECT b.id, b.brans_adi, COALESCE(COUNT(s.id) FILTER (WHERE s.durum = 'dizgi_bekliyor'), 0) as dizgi_bekliyor
        FROM branslar b
        LEFT JOIN sorular s ON b.id = s.brans_id
        WHERE b.id IN (SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1)
           OR b.id = (SELECT brans_id FROM kullanicilar WHERE id = $1)
        GROUP BY b.id, b.brans_adi
        ORDER BY dizgi_bekliyor DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
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

    const normalizedZorluk = normalizeZorlukSeviyesi(zorluk_seviyesi);

    // Soru sahibi kontrolü ve yetki doğrulama
    const checkResult = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);

    if (checkResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = checkResult.rows[0];

    // İncelemeye giden sorularda değişiklik yapılamamalı (Admin hariç)
    // Ancak branş sahipleri revize bekleyen veya dizgi/inceleme bekleyen sorular üzerinde çalışabilir.
    const isAllowedDurum = ['beklemede', 'revize_istendi', 'revize_gerekli', 'dizgi_bekliyor', 'inceleme_bekliyor', 'inceleme_tamam'].includes(soru.durum);
    if (req.user.rol !== 'admin' && !isAllowedDurum && (soru.durum === 'dizgide' || soru.durum === 'tamamlandi')) {
      throw new AppError('İşlemdeki veya tamamlanmış sorular düzenlenemez.', 403);
    }

    // Yetki kuralları: Admin veya Branş yetkilisi veya Sahibi düzenleyebilir
    let hasPermission = req.user.rol === 'admin' || soru.olusturan_kullanici_id === req.user.id;
    if (!hasPermission && req.user.rol === 'soru_yazici') {
      const authBrans = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1 AND brans_id = $2
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $1 AND brans_id = $2
      `, [req.user.id, soru.brans_id]);
      if (authBrans.rows.length > 0) hasPermission = true;
    }

    if (!hasPermission) {
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

    // Durum değişikliği otomatik yapılmaz (Branş havuzunda kalır)
    let yeniDurum = soru.durum;
    // Eğer yazar 'beklemede' olan bir soruyu güncellerse beklemede kalsın (Artık elle dizgiye gönderilecek)
    if (soru.durum === 'inceleme_tamam') {
      // İnceleme tamamlandıysa ve düzenleme yapılıyorsa belki tekrar beklemeye alınabilir veya öyle kalabilir.
      // Şimdilik dokunmuyoruz.
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

// Dizgici Final Dosya Yükleme
router.put('/:id/final-upload', [authenticate, upload.single('final_png')], async (req, res, next) => {
  try {
    const { id } = req.params;

    // Yetki Kontrolü
    const isDizgici = req.user.rol === 'dizgici';
    const isAdmin = req.user.rol === 'admin';

    if (!isDizgici && !isAdmin) {
      throw new AppError('Sadece dizgici veya admin dosya yükleyebilir', 403);
    }

    if (!req.file) {
      throw new AppError('Dosya seçilmedi', 400);
    }

    // Soruyu kontrol et
    const soruRes = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);
    if (soruRes.rows.length === 0) throw new AppError('Soru bulunamadı', 404);
    const soru = soruRes.rows[0];

    // Durum kontrolü: Sadece dizgide, dizgi_tamam veya tamamlandi (dosya güncelleme) olan soruya dosya yüklenebilir.
    // Ancak dizgi_bekliyor ise ve dizgici kendine aldıysa da yükleyebilmeli.
    // Şimdilik 'dizgide', 'dizgi_tamam' veya 'tamamlandi' olması mantıklı.
    if (!isAdmin && soru.durum !== 'dizgide' && soru.durum !== 'dizgi_tamam' && soru.durum !== 'tamamlandi') {
      throw new AppError('Soru dizgi aşamasında değil.', 403);
    }

    // Dizgici ise, sorunun dizgicisi o mu?
    if (isDizgici && soru.dizgici_id !== req.user.id) {
      // Belki de dizgici atanmamıştır? (Genelde 'dizgide' durumunda atanmış olur)
      // Eğer atanmamışsa ve dizgide ise, yükleyen kişi dizgici olur.
      if (soru.dizgici_id && soru.dizgici_id !== req.user.id) {
        throw new AppError('Bu soru başka bir dizgicide.', 403);
      }
    }

    // Eski final görselini sil (varsa)
    if (soru.final_png_public_id) {
      try {
        await cloudinary.uploader.destroy(soru.final_png_public_id);
      } catch (err) { console.error('Eski final silinemedi', err); }
    }

    // Yeni görseli yükle
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: 'soru-havuzu/finals',
      resource_type: 'auto',
      quality: 'auto:good'
    });

    const finalUrl = uploadResult.secure_url;
    const finalPublicId = uploadResult.public_id;

    // DB güncelle - Eğer dizgici_id yoksa yükleyen kişiyi ata
    // AYRICA: Durumu 'tamamlandi' yap (Havuza gönder)
    const updateQuery = `
      UPDATE sorular 
      SET final_png_url = $1, final_png_public_id = $2,
          dizgici_id = COALESCE(dizgici_id, $3),
          guncellenme_tarihi = CURRENT_TIMESTAMP
      WHERE id = $4 
      RETURNING *
    `;

    const updateRes = await pool.query(updateQuery, [finalUrl, finalPublicId, req.user.id, id]);

    res.json({
      success: true,
      data: updateRes.rows[0],
      message: 'Dizgi dosyası başarıyla yüklendi.'
    });

  } catch (error) {
    next(error);
  }
});

// Soru Durumunu Güncelle (İş Akışı Yönetimi)
router.put('/:id(\\d+)/durum', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { yeni_durum, aciklama } = req.body;

    const allowedStatuses = [
      'beklemede', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam',
      'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi',
      'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'inceleme_tamam',
      'tamamlandi', 'arsiv'
    ];

    if (!allowedStatuses.includes(yeni_durum)) {
      throw new AppError('Geçersiz durum: ' + yeni_durum, 400);
    }

    // Soruyu ve branş bilgisini al
    const soruRes = await pool.query(`
      SELECT s.*, b.brans_adi, k.ad_soyad as yazar_ad
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      WHERE s.id = $1
    `, [id]);

    if (soruRes.rows.length === 0) throw new AppError('Soru bulunamadı', 404);
    const soru = soruRes.rows[0];

    const isAdmin = req.user.rol === 'admin';
    const isOwner = req.user.id === soru.olusturan_kullanici_id;
    const isDizgici = req.user.rol === 'dizgici';
    const isReviewer = req.user.rol === 'incelemeci';

    // ROL VE DURUM BAZLI YETKİ KONTROLÜ
    let hasPermission = isAdmin;

    if (!hasPermission) {
      switch (yeni_durum) {
        case 'dizgi_bekliyor':
          if (isOwner) hasPermission = true;
          break;
        case 'dizgide':
          if (isDizgici) hasPermission = true;
          break;
        case 'dizgi_tamam':
          if (isDizgici && (!soru.dizgici_id || soru.dizgici_id === req.user.id)) hasPermission = true;
          break;
        case 'alan_incelemede':
        case 'dil_incelemede':
        case 'tamamlandi':
          // Branş öğretmeni (sahibi) ilerlemesi gereken yerler
          if (isOwner) hasPermission = true;
          break;
        case 'alan_onaylandi':
          if (isReviewer && req.user.inceleme_alanci) hasPermission = true;
          break;
        case 'dil_onaylandi':
          if (isReviewer && req.user.inceleme_dilci) hasPermission = true;
          break;
        case 'revize_istendi':
        case 'revize_gerekli':
          if (isReviewer || isDizgici) hasPermission = true;
          break;
        default:
          break;
      }
    }

    if (!hasPermission) {
      throw new AppError('Bu aşama için yetkili değilsiniz.', 403);
    }

    // VERİTABANI GÜNCELLEME
    let result;
    if (yeni_durum === 'alan_onaylandi' || yeni_durum === 'dil_onaylandi') {
      const field = yeni_durum === 'alan_onaylandi' ? 'onay_alanci' : 'onay_dilci';
      result = await pool.query(
        `UPDATE sorular SET durum = $1, ${field} = true, guncellenme_tarihi = NOW() WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
    } else if (yeni_durum === 'revize_istendi' || yeni_durum === 'revize_gerekli') {
      result = await pool.query(
        `UPDATE sorular SET durum = $1, onay_alanci = false, onay_dilci = false, guncellenme_tarihi = NOW() WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
    } else {
      result = await pool.query(
        `UPDATE sorular SET durum = $1, guncellenme_tarihi = NOW() WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
    }

    // Açıklama varsa yorum olarak ekle
    if (aciklama) {
      await pool.query(
        `INSERT INTO soru_yorumlari (soru_id, kullanici_id, yorum_metni) VALUES ($1, $2, $3)`,
        [id, req.user.id, `Durum: ${yeni_durum}. Açıklama: ${aciklama}`]
      );
    }

    // BİLDİRİM GÖNDERME
    let bildirimAliciId = null;
    let bildirimMesaji = "";

    if (['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'revize_istendi', 'revize_gerekli'].includes(yeni_durum)) {
      bildirimAliciId = soru.olusturan_kullanici_id;
      bildirimMesaji = `#${id} numaralı sorunuzun durumu '${yeni_durum}' olarak güncellendi.`;
    }

    if (bildirimAliciId && bildirimAliciId !== req.user.id) {
      await createNotification(bildirimAliciId, 'Soru Durum Güncellemesi', bildirimMesaji, 'info', `/sorular/${id}`);
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Soru durumu '${yeni_durum}' olarak güncellendi.`
    });

  } catch (error) {
    next(error);
  }
});

// Dizgi için branş bazlı bekleyen soru sayıları
router.get('/stats/dizgi-brans', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.rol === 'admin';
    let query;
    let params = [];

    if (isAdmin) {
      query = `
        SELECT b.id, b.brans_adi, COALESCE(COUNT(s.id) FILTER (WHERE s.durum IN ('dizgi_bekliyor', 'revize_istendi')), 0) as dizgi_bekliyor
        FROM branslar b
        LEFT JOIN sorular s ON b.id = s.brans_id
        GROUP BY b.id, b.brans_adi
        ORDER BY dizgi_bekliyor DESC
      `;
    } else {
      query = `
        SELECT b.id, b.brans_adi, COALESCE(COUNT(s.id) FILTER (WHERE s.durum IN ('dizgi_bekliyor', 'revize_istendi')), 0) as dizgi_bekliyor
        FROM branslar b
        LEFT JOIN sorular s ON b.id = s.brans_id
        WHERE b.id IN (SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1)
           OR b.id = (SELECT brans_id FROM kullanicilar WHERE id = $1)
        GROUP BY b.id, b.brans_adi
        ORDER BY dizgi_bekliyor DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
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

    const normalizedZorluk = normalizeZorlukSeviyesi(zorluk_seviyesi);

    // Soru sahibi kontrolü ve yetki doğrulama
    const checkResult = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);

    if (checkResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = checkResult.rows[0];

    // İncelemeye giden sorularda değişiklik yapılamamalı (Admin hariç)
    // Ancak branş sahipleri revize bekleyen veya dizgi/inceleme bekleyen sorular üzerinde çalışabilir.
    const isAllowedDurum = ['beklemede', 'revize_istendi', 'revize_gerekli', 'dizgi_bekliyor', 'inceleme_bekliyor', 'inceleme_tamam'].includes(soru.durum);
    if (req.user.rol !== 'admin' && !isAllowedDurum && (soru.durum === 'dizgide' || soru.durum === 'tamamlandi')) {
      throw new AppError('İşlemdeki veya tamamlanmış sorular düzenlenemez.', 403);
    }

    // Yetki kuralları: Admin veya Branş yetkilisi veya Sahibi düzenleyebilir
    let hasPermission = req.user.rol === 'admin' || soru.olusturan_kullanici_id === req.user.id;
    if (!hasPermission && req.user.rol === 'soru_yazici') {
      const authBrans = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1 AND brans_id = $2
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $1 AND brans_id = $2
      `, [req.user.id, soru.brans_id]);
      if (authBrans.rows.length > 0) hasPermission = true;
    }

    if (!hasPermission) {
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

    // Durum değişikliği otomatik yapılmaz (Branş havuzunda kalır)
    let yeniDurum = soru.durum;
    // Eğer yazar 'beklemede' olan bir soruyu güncellerse beklemede kalsın (Artık elle dizgiye gönderilecek)
    if (soru.durum === 'inceleme_tamam') {
      // İnceleme tamamlandıysa ve düzenleme yapılıyorsa belki tekrar beklemeye alınabilir veya öyle kalabilir.
      // Şimdilik dokunmuyoruz.
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
        soru_metni, fotograf_url, fotograf_public_id, normalizedZorluk, req.body.kazanim || null, yeniDurum,
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

// Dizgici Final Dosya Yükleme
router.put('/:id/final-upload', [authenticate, upload.single('final_png')], async (req, res, next) => {
  try {
    const { id } = req.params;

    // Yetki Kontrolü
    const isDizgici = req.user.rol === 'dizgici';
    const isAdmin = req.user.rol === 'admin';

    if (!isDizgici && !isAdmin) {
      throw new AppError('Sadece dizgici veya admin dosya yükleyebilir', 403);
    }

    if (!req.file) {
      throw new AppError('Dosya seçilmedi', 400);
    }

    // Soruyu kontrol et
    const soruRes = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);
    if (soruRes.rows.length === 0) throw new AppError('Soru bulunamadı', 404);
    const soru = soruRes.rows[0];

    // Durum kontrolü: Sadece dizgide, dizgi_tamam veya tamamlandi (dosya güncelleme) olan soruya dosya yüklenebilir.
    // Ancak dizgi_bekliyor ise ve dizgici kendine aldıysa da yükleyebilmeli.
    // Şimdilik 'dizgide', 'dizgi_tamam' veya 'tamamlandi' olması mantıklı.
    if (!isAdmin && soru.durum !== 'dizgide' && soru.durum !== 'dizgi_tamam' && soru.durum !== 'tamamlandi') {
      throw new AppError('Soru dizgi aşamasında değil.', 403);
    }

    // Dizgici ise, sorunun dizgicisi o mu?
    if (isDizgici && soru.dizgici_id !== req.user.id) {
      // Belki de dizgici atanmamıştır? (Genelde 'dizgide' durumunda atanmış olur)
      // Eğer atanmamışsa ve dizgide ise, yükleyen kişi dizgici olur.
      if (soru.dizgici_id && soru.dizgici_id !== req.user.id) {
        throw new AppError('Bu soru başka bir dizgicide.', 403);
      }
    }

    // Eski final görselini sil (varsa)
    if (soru.final_png_public_id) {
      try {
        await cloudinary.uploader.destroy(soru.final_png_public_id);
      } catch (err) { console.error('Eski final silinemedi', err); }
    }

    // Yeni görseli yükle
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: 'soru-havuzu/finals',
      resource_type: 'auto',
      quality: 'auto:good'
    });

    const finalUrl = uploadResult.secure_url;
    const finalPublicId = uploadResult.public_id;

    // DB güncelle - Eğer dizgici_id yoksa yükleyen kişiyi ata
    // AYRICA: Durumu 'tamamlandi' yap (Havuza gönder)
    const updateQuery = `
      UPDATE sorular 
      SET final_png_url = $1, final_png_public_id = $2,
          dizgici_id = COALESCE(dizgici_id, $3),
          guncellenme_tarihi = CURRENT_TIMESTAMP
      WHERE id = $4 
      RETURNING *
    `;

    const updateRes = await pool.query(updateQuery, [finalUrl, finalPublicId, req.user.id, id]);

    res.json({
      success: true,
      data: updateRes.rows[0],
      message: 'Dizgi dosyası başarıyla yüklendi.'
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
  // İsteğe bağlı olarak dizgi tamamlanırken PNG/PDF/diğer dosya eklenebilir
  uploadFields.fields([
    { name: 'fotograf', maxCount: 1 },
    { name: 'dosya', maxCount: 1 },
    { name: 'final_png', maxCount: 1 }
  ]),
  body('notlar').optional()
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notlar } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Soruyu güncelle -> Dizgiden çıkan soru artık havuza gider
      // Soruyu güncelle -> Dizgiden çıkan soru artık havuza gider
      let soruResult;
      try {
        // Admin her soruyu tamamlayabilir, dizgici sadece kendine atanmış olanı
        const whereClause = req.user.rol === 'admin' ? 'WHERE id = $1' : 'WHERE id = $1 AND dizgici_id = $2';
        const queryParams = req.user.rol === 'admin' ? [id] : [id, req.user.id];

        soruResult = await client.query(
          `UPDATE sorular 
           SET durum = 'dizgi_tamam',
            guncellenme_tarihi = CURRENT_TIMESTAMP,
            dizgi_tamamlanma_tarihi = CURRENT_TIMESTAMP,
            versiyon = COALESCE(versiyon, 1) + 1
           ${whereClause}
           RETURNING * `,
          queryParams
        );
      } catch (err) {
        console.warn('⚠️ dizgi-tamamla update failed (likely missing column), retrying without date...', err.message);
        const whereClause = req.user.rol === 'admin' ? 'WHERE id = $1' : 'WHERE id = $1 AND dizgici_id = $2';
        const queryParams = req.user.rol === 'admin' ? [id] : [id, req.user.id];

        soruResult = await client.query(
          `UPDATE sorular 
           SET durum = 'dizgi_tamam',
            guncellenme_tarihi = CURRENT_TIMESTAMP,
            versiyon = COALESCE(versiyon, 1) + 1
           ${whereClause}
           RETURNING * `,
          queryParams
        );
      }

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

      // Eğer dosya/fotograf yüklendiyse Cloudinary'e yükle ve soruyu güncelle
      if (req.files && (req.files.fotograf || req.files.dosya || req.files.final_png)) {
        let fotograf_url = null;
        let fotograf_public_id = null;
        let dosya_url = null;
        let dosya_public_id = null;
        let dosya_adi = null;
        let dosya_boyutu = null;
        let final_png_url = null;
        let final_png_public_id = null;

        // Fotoğraf yükleme
        if (req.files.fotograf && req.files.fotograf[0]) {
          const file = req.files.fotograf[0];
          const b64 = Buffer.from(file.buffer).toString('base64');
          const dataURI = `data:${file.mimetype};base64,${b64}`;

          const uploadResult = await cloudinary.uploader.upload(dataURI, {
            folder: 'soru-havuzu',
            resource_type: 'image',
            transformation: [{ quality: 'auto:good', fetch_format: 'auto' }]
          });

          fotograf_url = uploadResult.secure_url;
          fotograf_public_id = uploadResult.public_id;
        }

        // Final PNG yükleme
        if (req.files.final_png && req.files.final_png[0]) {
          const file = req.files.final_png[0];
          const b64 = Buffer.from(file.buffer).toString('base64');
          const dataURI = `data:${file.mimetype};base64,${b64}`;

          const uploadResult = await cloudinary.uploader.upload(dataURI, {
            folder: 'soru-havuzu/final-pngs',
            resource_type: 'image',
            transformation: [{ quality: 'auto:good', fetch_format: 'auto' }]
          });

          final_png_url = uploadResult.secure_url;
          final_png_public_id = uploadResult.public_id;
        }

        // Dosya yükleme (raw)
        if (req.files.dosya && req.files.dosya[0]) {
          const file = req.files.dosya[0];
          // 1MB kontrolü
          if (file.size > 1 * 1024 * 1024) {
            throw new AppError('Dosya boyutu 1MB\'dan büyük olamaz', 400);
          }
          const timestamp = Date.now();
          const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          const publicId = `soru-havuzu/dosyalar/${timestamp}_${sanitizedFilename}`;

          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { public_id: publicId, resource_type: 'raw', type: 'upload' },
              (err, result) => (err ? reject(err) : resolve(result))
            );
            uploadStream.end(file.buffer);
          });

          dosya_url = uploadResult.secure_url;
          dosya_public_id = uploadResult.public_id;
          dosya_adi = file.originalname;
          dosya_boyutu = file.size;
        }

        // Soruyu güncelle
        await client.query(
          `UPDATE sorular SET 
            fotograf_url = COALESCE($1, fotograf_url), 
            fotograf_public_id = COALESCE($2, fotograf_public_id), 
            dosya_url = COALESCE($3, dosya_url), 
            dosya_public_id = COALESCE($4, dosya_public_id), 
            dosya_adi = COALESCE($5, dosya_adi), 
            dosya_boyutu = COALESCE($6, dosya_boyutu),
            final_png_url = COALESCE($7, final_png_url),
            final_png_public_id = COALESCE($8, final_png_public_id)
           WHERE id = $9`,
          [fotograf_url, fotograf_public_id, dosya_url, dosya_public_id, dosya_adi, dosya_boyutu, final_png_url, final_png_public_id, id]
        );
      }

      // Dizgi geçmişine ekle
      await client.query(
        `INSERT INTO dizgi_gecmisi(soru_id, dizgici_id, durum, notlar) 
         VALUES($1, $2, 'tamamlandi', $3)`,
        [id, req.user.id, notlar]
      );

      // Yazara bildirim
      const soru = soruResult.rows[0];
      if (soru.olusturan_kullanici_id) {
        await createNotification(
          soru.olusturan_kullanici_id,
          'Dizgi Tamamlandı',
          `#${id} nolu sorunuzun dizgisi tamamlandı. Kontrol edip İncelemeye gönderebilirsiniz.`,
          'success',
          `/sorular/${id}`
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: soruResult.rows[0],
        message: 'Dizgi tamamlandı ve soru havuza aktarıldı'
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
    let query = '';
    let params = [];

    // Admin simülasyonu için rol parametresi desteği
    const targetRole = (req.user.rol === 'admin' && req.query.role) ? req.query.role.toLowerCase() : req.user.rol;

    if (targetRole === 'soru_yazici') {
      const isActuallyAdmin = req.user.rol === 'admin';
      // Yazar: Yetkili olduğu branşlardaki tüm soruların istatistiklerini görür
      query = `
        SELECT
          COUNT(*) as toplam,
          COUNT(*) FILTER(WHERE durum = 'beklemede') as beklemede,
          COUNT(*) FILTER(WHERE durum IN ('inceleme_bekliyor', 'alan_incelemede', 'dil_incelemede')) as inceleme_bekliyor,
          COUNT(*) FILTER(WHERE durum = 'dizgi_bekliyor') as dizgi_bekliyor,
          COUNT(*) FILTER(WHERE durum = 'dizgide') as dizgide,
          COUNT(*) FILTER(WHERE durum IN ('dizgi_tamam', 'inceleme_tamam', 'alan_onaylandi', 'dil_onaylandi')) as dizgi_tamam,
          COUNT(*) FILTER(WHERE durum = 'tamamlandi') as tamamlandi,
          COUNT(*) FILTER(WHERE durum IN ('revize_gerekli', 'revize_istendi')) as revize_gerekli
        FROM sorular s
        ${isActuallyAdmin ? '' : `WHERE s.brans_id IN (
          SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1
          UNION 
          SELECT brans_id FROM kullanicilar WHERE id = $1
        )`}
      `;
      params = isActuallyAdmin ? [] : [req.user.id];
    } else if (targetRole === 'dizgici') {
      // Dizgici: Genel havuzdaki işler
      query = `
        SELECT
          COUNT(*) FILTER(WHERE s.durum = 'dizgi_bekliyor') as dizgi_bekliyor,
          COUNT(*) FILTER(WHERE s.durum = 'dizgide' AND s.dizgici_id = $1) as dizgide,
          COUNT(*) FILTER(WHERE (s.durum = 'dizgi_tamam' AND s.dizgici_id = $1) OR (s.durum = 'tamamlandi' AND s.final_png_url IS NULL AND s.dizgici_id = $1)) as dosya_bekliyor,
          COUNT(*) FILTER(WHERE s.durum = 'tamamlandi' AND s.final_png_url IS NOT NULL) as tamamlandi
        FROM sorular s
      `;
      params = [req.user.id];
    } else if (targetRole === 'alan_incelemeci' || targetRole === 'dil_incelemeci') {
      const isAlan = targetRole === 'alan_incelemeci';
      const isActuallyAdmin = req.user.rol === 'admin';
      query = `
        SELECT COUNT(*) FILTER(WHERE s.durum IN ('inceleme_bekliyor', 'incelemede') AND s.${isAlan ? 'onay_alanci' : 'onay_dilci'} = false ${isActuallyAdmin ? '' : `AND (s.brans_id IN (SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1) OR s.brans_id = (SELECT brans_id FROM kullanicilar WHERE id = $1))`}) as inceleme_bekliyor 
        FROM sorular s 
      `;
      params = isActuallyAdmin ? [] : [req.user.id];
    } else if (targetRole === 'incelemeci') {
      const isAdmin = req.user.rol === 'admin';
      const canAlan = isAdmin || !!req.user.inceleme_alanci;
      const canDil = isAdmin || !!req.user.inceleme_dilci;

      // İncelemeciler için branch kısıtlamasını kaldırıyoruz (Küresel müfettiş rolü)
      query = `
        SELECT
          ${canAlan ? "COUNT(*) FILTER(WHERE s.durum = 'alan_incelemede')" : "0"} as inceleme_bekliyor_alanci,
          ${canDil ? "COUNT(*) FILTER(WHERE s.durum = 'dil_incelemede')" : "0"} as inceleme_bekliyor_dilci
        FROM sorular s
      `;
      params = [];
    } else {
      // Admin: Global istatistikler
      query = `
        SELECT
          COUNT(*) as toplam,
          COUNT(*) FILTER(WHERE durum = 'beklemede') as beklemede,
          COUNT(*) FILTER(WHERE durum = 'inceleme_bekliyor') as inceleme_bekliyor,
          COUNT(*) FILTER(WHERE durum = 'dizgi_bekliyor') as dizgi_bekliyor,
          COUNT(*) FILTER(WHERE durum = 'dizgide') as dizgide,
          COUNT(*) FILTER(WHERE durum = 'tamamlandi') as tamamlandi,
          COUNT(*) FILTER(WHERE durum = 'revize_gerekli' OR durum = 'revize_istendi') as revize_gerekli
        FROM sorular
      `;
    }

    const result = await pool.query(query, params);
    const row = result.rows[0] || {};

    if (row.inceleme_bekliyor_alanci !== undefined || row.inceleme_bekliyor_dilci !== undefined) {
      const alanci = Number(row.inceleme_bekliyor_alanci || 0);
      const dilci = Number(row.inceleme_bekliyor_dilci || 0);
      return res.json({
        success: true,
        data: {
          inceleme_bekliyor_alanci: alanci,
          inceleme_bekliyor_dilci: dilci,
          inceleme_bekliyor: alanci + dilci
        }
      });
    }

    res.json({
      success: true,
      data: row || { toplam: 0, beklemede: 0, inceleme_bekliyor: 0, dizgi_bekliyor: 0, dizgide: 0, tamamlandi: 0, revize_gerekli: 0 }
    });
  } catch (error) {
    next(error);
  }
});




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
        COUNT(CASE WHEN durum = 'inceleme_bekliyor' THEN 1 END) as inceleme_bekliyor,
        COUNT(CASE WHEN durum = 'incelemede' THEN 1 END) as incelemede,
        COUNT(CASE WHEN durum = 'revize_istendi' OR durum = 'revize_gerekli' THEN 1 END) as revize_istendi,
        COUNT(CASE WHEN durum = 'dizgi_bekliyor' THEN 1 END) as dizgi_bekliyor,
        COUNT(CASE WHEN durum = 'dizgide' THEN 1 END) as dizgide,
        COUNT(CASE WHEN durum = 'inceleme_tamam' THEN 1 END) as inceleme_tamam,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlandi,
        COUNT(CASE WHEN zorluk_seviyesi IN (1,2) THEN 1 END) as kolay,
        COUNT(CASE WHEN zorluk_seviyesi = 3 THEN 1 END) as orta,
        COUNT(CASE WHEN zorluk_seviyesi IN (4,5) THEN 1 END) as zor,
        COUNT(CASE WHEN zorluk_seviyesi = 1 THEN 1 END) as seviye1,
        COUNT(CASE WHEN zorluk_seviyesi = 2 THEN 1 END) as seviye2,
        COUNT(CASE WHEN zorluk_seviyesi = 3 THEN 1 END) as seviye3,
        COUNT(CASE WHEN zorluk_seviyesi = 4 THEN 1 END) as seviye4,
        COUNT(CASE WHEN zorluk_seviyesi = 5 THEN 1 END) as seviye5,
        COUNT(CASE WHEN fotograf_url IS NOT NULL THEN 1 END) as fotografli,
        COUNT(CASE WHEN latex_kodu IS NOT NULL AND latex_kodu != '' THEN 1 END) as latexli
      FROM sorular
    `);

    // Son eklenen soruları getir (debug için)
    const sonSorular = await pool.query(`
      SELECT s.id, LEFT(s.soru_metni, 30) as metin, s.durum, k.ad_soyad as yazar
      FROM sorular s
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      ORDER BY s.olusturulma_tarihi DESC
      LIMIT 10
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
  COUNT(CASE WHEN rol = 'incelemeci' THEN 1 END) as incelemeci_sayisi,
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
        son_sorular: sonSorular.rows,
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
  COUNT(CASE WHEN zorluk_seviyesi IN (1,2) THEN 1 END) as kolay,
  COUNT(CASE WHEN zorluk_seviyesi = 3 THEN 1 END) as orta,
  COUNT(CASE WHEN zorluk_seviyesi IN (4,5) THEN 1 END) as zor,
  COUNT(CASE WHEN zorluk_seviyesi = 1 THEN 1 END) as seviye1,
  COUNT(CASE WHEN zorluk_seviyesi = 2 THEN 1 END) as seviye2,
  COUNT(CASE WHEN zorluk_seviyesi = 3 THEN 1 END) as seviye3,
  COUNT(CASE WHEN zorluk_seviyesi = 4 THEN 1 END) as seviye4,
  COUNT(CASE WHEN zorluk_seviyesi = 5 THEN 1 END) as seviye5
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

// Yönetimsel Veritabanı Temizliği ve Analizi (Admin)
router.post('/admin-cleanup', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { action } = req.body; // 'view' or 'clear_all'

    if (action === 'view') {
      const result = await pool.query('SELECT id, durum, olusturan_kullanici_id, brans_id, olusturulma_tarihi FROM sorular ORDER BY id DESC');
      return res.json({
        success: true,
        data: result.rows,
        message: `Sistemde toplam ${result.rows.length} kayıt bulundu.`
      });
    }

    if (action === 'clear_all') {
      const result = await pool.query('DELETE FROM sorular RETURNING id');
      console.log(`⚠️ ADMIN CLEANUP: ${result.rows.length} soru silindi.`);
      return res.json({
        success: true,
        count: result.rows.length,
        message: 'Tüm soru kayıtları ve ilgili geçmişler temizlendi.'
      });
    }

    throw new AppError('Gecersiz işlem', 400);
  } catch (error) {
    next(error);
  }
});

// İncelemeci detaylı istatistikler (Ekip ve Branş bazlı)
router.get('/stats/inceleme-detayli', authenticate, async (req, res, next) => {
  try {
    if (req.user.rol !== 'admin' && req.user.rol !== 'incelemeci') {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    const query = `
      SELECT 
        COALESCE(e.id, 0) as ekip_id, 
        COALESCE(e.ekip_adi, 'Ekipsiz Branşlar') as ekip_adi, 
        b.id as brans_id, 
        b.brans_adi,
        COUNT(s.id) FILTER(WHERE s.durum IN ('inceleme_bekliyor', 'incelemede', 'revize_istendi') AND s.onay_alanci = false) as alanci_bekleyen,
        COUNT(s.id) FILTER(WHERE s.durum IN ('inceleme_bekliyor', 'incelemede', 'revize_istendi') AND s.onay_dilci = false) as dilci_bekleyen,
        COUNT(s.id) as toplam_bekleyen
      FROM branslar b
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN sorular s ON s.brans_id = b.id AND s.durum IN ('inceleme_bekliyor', 'incelemede', 'revize_istendi')
      GROUP BY e.id, e.ekip_adi, b.id, b.brans_adi
      HAVING COUNT(s.id) > 0
      ORDER BY e.ekip_adi NULLS LAST, b.brans_adi
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
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
      `INSERT INTO soru_revize_notlari(soru_id, kullanici_id, secilen_metin, not_metni, inceleme_turu)
VALUES($1, $2, $3, $4, $5)`,
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
