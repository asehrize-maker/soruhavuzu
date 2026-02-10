import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import cloudinary from '../config/cloudinary.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './bildirim.routes.js';

// Helper: Aktivite Loglama
const logActivity = async (client, kullaniciId, islemTuru, aciklama, soruId = null, detay = null) => {
  if (!kullaniciId) return;
  try {
    // client can be pool or transaction client
    await client.query(`
      INSERT INTO aktivite_loglari (kullanici_id, soru_id, islem_turu, aciklama, detay)
      VALUES ($1, $2, $3, $4, $5)
    `, [kullaniciId, soruId, islemTuru, aciklama, detay]);
  } catch (err) {
    console.error('Activity Log Error:', err);
  }
};

const router = express.Router();

// ... existing code ...

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
    console.log('--- GET /sorular DEBUG ---');
    console.log('Query Params:', req.query);
    console.log('Auth User ID:', req.user?.id, 'Role:', req.user?.rol);
    const { durum, brans_id, ekip_id, olusturan_id, scope, zorluk_seviyesi, search } = req.query;

    let query = `
      SELECT s.*, 
             b.brans_adi, b.ekip_id as brans_ekip_id,
             e.ekip_adi,
             k.ad_soyad as olusturan_ad,
             d.ad_soyad as dizgici_ad
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN kullanicilar d ON s.dizgici_id = d.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    const targetRole = (req.user.rol === 'admin' && req.query.role) ? req.query.role.toLowerCase() : req.user.rol;
    console.log('Final Target Role for Isolation:', targetRole);

    // EKİP İZOLASYONU (Admin hariç herkese uygula)
    // Eğer kullanıcının bir ekibi varsa, sadece kendi ekibindeki branşlara ait soruları görebilir
    // EKİP İZOLASYONU (Admin hariç herkese uygula)
    // Eğer kullanıcının bir ekibi varsa:
    // 1. Ya sorunun branşı o ekibe aittir (b.ekip_id)
    // 2. Ya da soruyu oluşturan kişi o ekiptendir (k.ekip_id)
    if (!['admin', 'dizgici', 'incelemeci'].includes(req.user.rol) && req.user.ekip_id) {
      query += ` AND (b.ekip_id = $${paramCount} OR k.ekip_id = $${paramCount})`;
      params.push(req.user.ekip_id);
      paramCount++;
    }

    // İnceleme yetkisi kontrolü (Flag veya Rol bazlı)
    const isReviewerRole = targetRole === 'incelemeci' || targetRole === 'alan_incelemeci' || targetRole === 'dil_incelemeci';
    const hasReviewFlags = req.user.inceleme_alanci || req.user.inceleme_dilci;
    const isAnyReviewer = isReviewerRole || hasReviewFlags;

    // Rol bazlı filtreleme ve İZOLASYON
    if (targetRole === 'dizgici') {
      // Dizgici izolasyonu
      if (req.user.rol === 'admin') {
        query += ` AND s.durum IN ('dizgi_bekliyor', 'dizgide', 'revize_istendi', 'dizgi_tamam')`;
      } else {
        query += ` AND (
          s.durum IN ('dizgi_bekliyor', 'revize_istendi') 
          OR (s.durum = 'dizgide' AND s.dizgici_id = $${paramCount}::integer)
          OR (s.durum = 'dizgi_tamam' AND s.dizgici_id = $${paramCount}::integer)
        )`;
        params.push(req.user.id);
        paramCount++;
      }
    } else if (targetRole === 'koordinator') {
      // Koordinatör: Ekip izolasyonu zaten yukarda 169. satırda uygulandı.
      // Burada ekstra branş kısıtlaması yapmıyoruz ki ekibindeki TÜM branşları görsün.
      // Sadece scope 'common' değilse her şeyi görsün (scope 'brans' veya boş ise)
      if (scope === 'common') {
        query += ` AND (s.durum = 'tamamlandi' OR s.durum = 'dizgi_tamam')`;
      }
    } else if (targetRole !== 'admin' && !isAnyReviewer) {
      // Soru yazarları ve diğerleri için
      // Eğer scope 'brans' ise VEYA kullanıcı 'soru_yazici' ise ve scope 'common' değilse --> Kendi branşındaki TÜM durumu (beklemede dahil) görsün
      if (scope === 'brans' || brans_id || (targetRole === 'soru_yazici' && scope !== 'common')) {
        query += ` AND s.brans_id IN (
          SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $${paramCount}::integer
          UNION 
          SELECT brans_id FROM kullanicilar WHERE id = $${paramCount}::integer
        )`;
        params.push(req.user.id);
        paramCount++;
      } else {
        // Ortak Havuz (Sadece tamamlanmışlar)
        query += ` AND (s.durum = 'tamamlandi' OR s.durum = 'dizgi_tamam')`;
      }
    } else if (isAnyReviewer && targetRole !== 'admin') {
      // İNCELEMECİLER: Hiçbir takılma olmadan inceleme havuzunu görsün
      query += ` AND s.durum IN ('alan_incelemede', 'dil_incelemede', 'inceleme_bekliyor', 'incelemede', 'alan_onaylandi', 'dil_onaylandi', 'dizgi_tamam', 'revize_istendi', 'revize_gerekli')`;
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

    if (zorluk_seviyesi) {
      query += ` AND s.zorluk_seviyesi = $${paramCount++}`;
      params.push(zorluk_seviyesi);
    }

    if (req.query.kategori) {
      query += ` AND s.kategori = $${paramCount++}`;
      params.push(req.query.kategori);
    }

    if (req.query.kullanildi !== undefined && req.query.kullanildi !== '') {
      query += ` AND s.kullanildi = $${paramCount++}`;
      params.push(req.query.kullanildi === 'true' || req.query.kullanildi === true);
    }

    if (search) {
      query += ` AND (s.soru_metni ILIKE $${paramCount} OR s.kazanim ILIKE $${paramCount} OR b.brans_adi ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
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
             b.brans_adi, b.ekip_id as brans_ekip_id,
             e.ekip_adi,
             k.ad_soyad as olusturan_ad, k.email as olusturan_email,
             d.ad_soyad as dizgici_ad, d.email as dizgici_email
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN kullanicilar d ON s.dizgici_id = d.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = result.rows[0];

    // Yetki kontrolü
    if (req.user.rol === 'soru_yazici') {
      const authBransResult = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1::integer AND brans_id = $2::integer
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $3::integer AND brans_id = $4::integer
      `, [req.user.id, soru.brans_id, req.user.id, soru.brans_id]);

      if (authBransResult.rows.length === 0 && soru.olusturan_kullanici_id !== req.user.id && soru.durum !== 'tamamlandi') {
        throw new AppError('Bu branştaki soruları görme yetkiniz yok', 403);
      }
    } else if (req.user.rol === 'koordinator') {
      // Koordinatör kendi ekibindeki branşları veya kendi oluşturduklarını görebilir
      if (soru.ekip_id !== req.user.ekip_id && soru.olusturan_kullanici_id !== req.user.id) {
        throw new AppError('Başka ekipten soruları görüntüleme yetkiniz yok', 403);
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
  authorize(['admin', 'koordinator', 'soru_yazici']),
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
      fotograf_konumu, durum, kategori, kullanildi, kullanim_alani
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
        durum, kategori, kullanildi, kullanim_alani
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *`,
      [
        soru_metni, fotograf_url, fotograf_public_id, normalizedZorluk, brans_id,
        latex_kodu || null, kazanim || null, req.user.id,
        dosya_url, dosya_public_id, dosya_adi, dosya_boyutu,
        secenek_a || null, secenek_b || null, secenek_c || null, secenek_d || null, secenek_e || null, dogru_cevap || null, fotograf_konumu || 'ust',
        durum || 'beklemede', kategori || 'deneme',
        kullanildi === 'true' || kullanildi === true, kullanim_alani || null
      ]
    );

    console.log('Soru başarıyla eklendi, ID:', result.rows[0].id);

    // LOGLAMA
    await logActivity(pool, req.user.id, 'soru_ekleme', 'Yeni bir soru ekledi', result.rows[0].id, { brans_id });

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



// Soru Durumunu Güncelle (İş Akışı Yönetimi)
router.put('/:id(\\d+)/durum', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { yeni_durum, aciklama } = req.body;

    // Backend güncel durum listesi (DB ile hizalı)
    const allowedStatuses = [
      'beklemede',
      'dizgi_bekliyor',
      'dizgide',
      'dizgi_tamam',
      'alan_incelemede',
      'alan_onaylandi',
      'dil_incelemede',
      'dil_onaylandi',
      'revize_istendi',
      'revize_gerekli',
      'inceleme_bekliyor',
      'incelemede',       // DB kısıtında var, API listesinde eksikti
      'inceleme_tamam',
      'tamamlandi',
      'arsiv'
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

    // %%% İŞ AKIŞI KISITLAMALARI (WORKFLOW VALIDATION) %%%
    if (!isAdmin) {
      const isTaslakAşaması = ['beklemede', 'revize_gerekli'].includes(soru.durum);
      const hedefİncelemeVeyaTamam = [
        'alan_incelemede', 'dil_incelemede', 'inceleme_bekliyor',
        'incelemede', 'inceleme_tamam', 'alan_onaylandi',
        'dil_onaylandi', 'tamamlandi'
      ].includes(yeni_durum);

      // 1. Yazılan soru dizgiye girmeden inceleme veya tamamlanana gidemez
      if (isTaslakAşaması && hedefİncelemeVeyaTamam) {
        throw new AppError('Soru dizgiye gönderilmeden inceleme veya tamamlama aşamasına geçemez.', 400);
      }

      // 2. Alan ve Dil onayı olmadan tamamlanamaz
      if (yeni_durum === 'tamamlandi') {
        if (!soru.onay_alanci || !soru.onay_dilci) {
          throw new AppError('Soru hem alan hem de dil onayını almadan tamamlananlara aktarılamaz.', 400);
        }
      }
    }
    const isKoordinator = req.user.rol === 'koordinator';
    const isOwner = Number(req.user.id) == Number(soru.olusturan_kullanici_id);
    const isDizgici = req.user.rol === 'dizgici';
    const isReviewer = req.user.rol === 'incelemeci';

    // Branş yetkisi kontrolü (Kendi branşındaki soruları yönetebilme)
    let isBranchTeacher = false;
    // Soru yazarları ve koordinatörler branş bazlı yetkiye sahip olabilir
    if (req.user.rol === 'soru_yazici' || isKoordinator) {
      const authBrans = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1::integer AND brans_id = $2::integer
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $3::integer AND brans_id = $4::integer
      `, [req.user.id, soru.brans_id, req.user.id, soru.brans_id]);
      if (authBrans.rows.length > 0) isBranchTeacher = true;
    }

    // Koordinatör kendi ekibindeki branşlar için de yetkilidir
    let isTeamKoordinator = false;
    if (isKoordinator && req.user.ekip_id === soru.ekip_id) {
      isTeamKoordinator = true;
    }

    // ROL VE DURUM BAZLI YETKİ KONTROLÜ
    let hasPermission = isAdmin;

    if (!hasPermission) {
      const isCreatorOrBranchOrTeam = isOwner || isBranchTeacher || isTeamKoordinator;

      switch (yeni_durum) {
        case 'beklemede':
          if (isCreatorOrBranchOrTeam) hasPermission = true;
          break;
        case 'dizgi_bekliyor':
          if (isCreatorOrBranchOrTeam) hasPermission = true;
          break;
        case 'dizgide':
          if (isDizgici || isAdmin) hasPermission = true;
          break;
        case 'dizgi_tamam':
          if (isDizgici && (!soru.dizgici_id || soru.dizgici_id == req.user.id)) hasPermission = true;
          break;
        case 'alan_incelemede':
        case 'dil_incelemede':
        case 'inceleme_bekliyor':
        case 'incelemede':
          // Sadece Branş yetkilisi (Dizgici DEĞİL) incelemeye gönderebilir
          if (isCreatorOrBranchOrTeam) hasPermission = true;
          break;
        case 'tamamlandi':
          // Tamamlamayı sadece sorunun sahibi/branş yetkilisi veya admin yapabilir
          if (isCreatorOrBranchOrTeam) hasPermission = true;
          break;
        case 'alan_onaylandi':
          if (isReviewer && req.user.inceleme_alanci) hasPermission = true;
          break;
        case 'dil_onaylandi':
          if (isReviewer && req.user.inceleme_dilci) hasPermission = true;
          break;
        case 'revize_istendi':
        case 'revize_gerekli':
          // İncelemeci hatayı söyler, Dizgici de söyleyebilir, Yazar/Branş da kendisi çekebilir
          if (isReviewer || isDizgici || isCreatorOrBranchOrTeam) hasPermission = true;
          break;
        case 'arsiv':
          if (isAdmin || isCreatorOrBranchOrTeam) hasPermission = true;
          break;
        default:
          // Eğer durum allowedStatuses içinde ama switch'te yoksa, güvenlik için admin kontrolü kalır
          break;
      }
    }

    if (!hasPermission) {
      console.warn(`⛔ Yetkisiz Durum Güncelleme Girişimi: User=${req.user.id}, Role=${req.user.rol}, Soru=${id}, YeniDurum=${yeni_durum}`);
      throw new AppError('Bu aşama için yetkili değilsiniz veya soru size ait değil.', 403);
    }

    // 1. Mevcut halini versiyon geçmişine kaydet
    // BigInt serialization safely (just in case)
    const jsonSafeSoru = JSON.stringify(soru, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    await pool.query(
      `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, soru.versiyon || 1, jsonSafeSoru, req.user.id, `Durum değişikliği: ${yeni_durum}${aciklama ? ' - ' + aciklama : ''}`]
    );

    // 2. VERİTABANI GÜNCELLEME
    let result;
    const versiyonSqlSnippet = yeni_durum === 'dizgi_tamam'
      ? 'COALESCE(versiyon, 1) + 1'
      : 'COALESCE(versiyon, 1)';

    if (yeni_durum === 'alan_onaylandi' || yeni_durum === 'dil_onaylandi') {
      const field = yeni_durum === 'alan_onaylandi' ? 'onay_alanci' : 'onay_dilci';
      result = await pool.query(
        `UPDATE sorular SET 
           durum = $1, 
           ${field} = true, 
           guncellenme_tarihi = NOW(),
           versiyon = ${versiyonSqlSnippet}
         WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
    } else if (yeni_durum === 'revize_istendi' || yeni_durum === 'revize_gerekli') {
      // Revize istendiğinde onayları sıfırla
      result = await pool.query(
        `UPDATE sorular SET 
           durum = $1, 
           onay_alanci = false, 
           onay_dilci = false, 
           guncellenme_tarihi = NOW(),
           versiyon = ${versiyonSqlSnippet}
         WHERE id = $2 RETURNING *`,
        [yeni_durum, id]
      );
    } else {
      // Diğer durumlar (dizgi_bekliyor, bekleyim, incelemede vb.)
      // Mevcut onayları koru (eğer vardıysa)
      result = await pool.query(
        `UPDATE sorular SET 
           durum = $1, 
           guncellenme_tarihi = NOW(),
           versiyon = ${versiyonSqlSnippet}
         WHERE id = $2 RETURNING *`,
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

    // LOGLAMA
    const logDesc = `Durum: ${yeni_durum}.${aciklama ? ' Not: ' + aciklama : ''}`;
    await logActivity(pool, req.user.id, 'durum_degisikligi', logDesc, id, { brans_id: soru.brans_id, yeni_durum });

    // BİLDİRİM GÖNDERME
    let bildirimAliciId = null;
    let bildirimMesaji = "";

    if (['dizgi_tamam', 'alan_onaylandi', 'dil_onaylandi', 'revize_istendi', 'revize_gerekli'].includes(yeni_durum)) {
      bildirimAliciId = soru.olusturan_kullanici_id;
      bildirimMesaji = `#${id} numaralı sorunuzun durumu '${yeni_durum}' olarak güncellendi.`;
    }

    if (bildirimAliciId && bildirimAliciId != req.user.id) {
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
    const targetRole = (req.user.rol === 'admin' && req.query.role) ? req.query.role.toLowerCase() : req.user.rol;
    const isActuallyDizgici = targetRole === 'dizgici';
    const isActuallyAdmin = req.user.rol === 'admin';

    let query;
    let params = [];

    // Dizgiciler için genellikle branş kısıtlaması olmaz (Havuz mantığı)
    if (isActuallyAdmin || isActuallyDizgici) {
      query = `
        SELECT b.id, b.brans_adi, COALESCE(COUNT(s.id) FILTER (WHERE s.durum IN ('dizgi_bekliyor', 'revize_istendi')), 0) as dizgi_bekliyor
        FROM branslar b
        LEFT JOIN sorular s ON b.id = s.brans_id
        GROUP BY b.id, b.brans_adi
        ORDER BY dizgi_bekliyor DESC
      `;
    } else if (req.user.rol === 'koordinator') {
      // Koordinatör kendi ekibindeki TÜM branşları görsün
      query = `
        SELECT b.id, b.brans_adi, COALESCE(COUNT(s.id) FILTER (WHERE s.durum IN ('dizgi_bekliyor', 'revize_istendi')), 0) as dizgi_bekliyor
        FROM branslar b
        LEFT JOIN sorular s ON b.id = s.brans_id
        WHERE b.ekip_id = $1
        GROUP BY b.id, b.brans_adi
        ORDER BY dizgi_bekliyor DESC
      `;
      params = [req.user.id_ekip || req.user.ekip_id];
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
    const isAllowedDurum = ['beklemede', 'revize_istendi', 'revize_gerekli', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam', 'inceleme_bekliyor', 'inceleme_tamam', 'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi'].includes(soru.durum);
    if (req.user.rol !== 'admin' && !isAllowedDurum && (soru.durum === 'dizgide' || soru.durum === 'tamamlandi')) {
      throw new AppError('İşlemdeki veya tamamlanmış sorular düzenlenemez.', 403);
    }

    // Yetki kuralları: Admin veya Koordinatör (kendi ekibi) veya Branş yetkilisi veya Sahibi düzenleyebilir
    let hasPermission = req.user.rol === 'admin' || soru.olusturan_kullanici_id == req.user.id;

    if (!hasPermission && req.user.rol === 'koordinator') {
      if (soru.ekip_id === req.user.ekip_id) hasPermission = true;
    }

    if (!hasPermission && req.user.rol === 'soru_yazici') {
      const authBrans = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1::integer AND brans_id = $2::integer
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $3::integer AND brans_id = $4::integer
      `, [req.user.id, soru.brans_id, req.user.id, soru.brans_id]);
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
    const jsonSafeSoru = JSON.stringify(soru, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    await pool.query(
      `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        soru.versiyon || 1,
        jsonSafeSoru,
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
           guncellenme_tarihi = CURRENT_TIMESTAMP
       WHERE id = $14 RETURNING *`,
      [
        soru_metni, fotograf_url, fotograf_public_id, normalizedZorluk, req.body.kazanim || null, yeniDurum,
        secenek_a || null, secenek_b || null, secenek_c || null, secenek_d || null, secenek_e || null,
        dogru_cevap || null, fotograf_konumu || 'ust',
        id
      ]
    );

    // 2. Mevcut revize notlarını "çözüldü" olarak işaretle (İçerik güncellenince eskiler geçersiz kalır)
    await pool.query(
      `UPDATE soru_revize_notlari SET cozuldu = true WHERE soru_id = $1`,
      [id]
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
    if (isDizgici && soru.dizgici_id != req.user.id) {
      // Belki de dizgici atanmamıştır? (Genelde 'dizgide' durumunda atanmış olur)
      // Eğer atanmamışsa ve dizgide ise, yükleyen kişi dizgici olur.
      if (soru.dizgici_id && soru.dizgici_id != req.user.id) {
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

    // 1. Mevcut halini versiyon geçmişine kaydet
    await pool.query(
      `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, soru.versiyon || 1, JSON.stringify(soru), req.user.id, 'Dizgi dosyası yüklendi']
    );

    // 2. DB güncelle - Eğer dizgici_id yoksa yükleyen kişiyi ata
    // AYRICA: Durumu 'inceleme_bekliyor' yap (Branşa gönder) ve onayları sıfırla
    const updateQuery = `
        UPDATE sorular 
        SET final_png_url = $1, final_png_public_id = $2,
            dizgici_id = COALESCE(dizgici_id, $3),
            guncellenme_tarihi = CURRENT_TIMESTAMP,
            versiyon = COALESCE(versiyon, 1) + 1
        WHERE id = $4 
        RETURNING *
      `;

    const updateRes = await pool.query(updateQuery, [finalUrl, finalPublicId, req.user.id, id]);

    // 3. Mevcut revize notlarını "çözüldü" olarak işaretle (Yeni PNG gelince eskiler geçersiz kalır)
    await pool.query(
      `UPDATE soru_revize_notlari SET cozuldu = true WHERE soru_id = $1`,
      [id]
    );

    // LOGLAMA
    await logActivity(pool, req.user.id, 'dizgi_yukleme', 'Dizgi dosyasını yükledi', id);

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

    // 1. Önce versiyon snapshot al
    const currentSoruRes = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);
    const currentSoru = currentSoruRes.rows[0];

    if (currentSoru) {
      const jsonSafeSoru = JSON.stringify(currentSoru, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      await pool.query(
        `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentSoru.versiyon || 1, jsonSafeSoru, req.user.id, 'Soru dizgiye alındı']
      );
    }

    const result = await pool.query(
      `UPDATE sorular 
        SET durum = 'dizgide', dizgici_id = $1, guncellenme_tarihi = CURRENT_TIMESTAMP
        WHERE id = $2 AND (durum = 'dizgi_bekliyor' OR durum = 'beklemede' OR durum = 'revize_istendi')
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

      // 1. Önce mevcut hali versiyon geçmişine kaydet (Admin/Dizgici farketmeksizin)
      const currentSoruRes = await client.query('SELECT * FROM sorular WHERE id = $1', [id]);
      const currentSoru = currentSoruRes.rows[0];

      const jsonSafeSoru = JSON.stringify(currentSoru, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      await client.query(
        `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentSoru.versiyon || 1, jsonSafeSoru, req.user.id, 'Dizgi tamamlandı']
      );

      // 2. Soruyu güncelle -> Dizgiden çıkan soru artık havuza gider
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

      // LOGLAMA (Transaction client ile)
      await logActivity(client, req.user.id, 'dizgi_bitirme', `Sorunun dizgisini tamamladı. Not: ${notlar || '-'}`, id);

      // 3. Mevcut revize notlarını "çözüldü" olarak işaretle (Dizgi tamamlanınca eskiler geçersiz kalır)
      await client.query(
        `UPDATE soru_revize_notlari SET cozuldu = true WHERE soru_id = $1`,
        [id]
      );

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

    // Yetki kontrolü (Admin, Koordinatör, Soru sahibi veya Branş öğretmeni)
    let hasDeletePermission = req.user.rol === 'admin' || soru.olusturan_kullanici_id === req.user.id;

    if (!hasDeletePermission && req.user.rol === 'koordinator') {
      if (soru.ekip_id === req.user.ekip_id) hasDeletePermission = true;
    }

    if (!hasDeletePermission && req.user.rol === 'soru_yazici') {
      const authBrans = await pool.query(`
        SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1::integer AND brans_id = $2::integer
        UNION
        SELECT 1 FROM kullanicilar WHERE id = $3::integer AND brans_id = $4::integer
      `, [req.user.id, soru.brans_id, req.user.id, soru.brans_id]);
      if (authBrans.rows.length > 0) hasDeletePermission = true;
    }

    if (!hasDeletePermission) {
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
      }
    }

    // İŞLEMİ TRANSACTION İÇİNE AL (Foreign key hatalarını önlemek ve atomisite için)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. İlişkili tüm verileri temizle (CASCADE eksikliği ihtimaline karşı manuel temizlik)
      await client.query('DELETE FROM mesajlar WHERE soru_id = $1', [id]);
      await client.query('DELETE FROM soru_goruntulenme WHERE soru_id = $1', [id]);
      await client.query('DELETE FROM dizgi_gecmisi WHERE soru_id = $1', [id]);
      await client.query('DELETE FROM soru_versiyonlari WHERE soru_id = $1', [id]);
      await client.query('DELETE FROM soru_yorumlari WHERE soru_id = $1', [id]);
      await client.query('DELETE FROM soru_revize_notlari WHERE soru_id = $1', [id]);

      // 2. Aktivite loglarını yetim (orphan) bırak (soru silinse de log kalsın ama referans temizlensin)
      await client.query('UPDATE aktivite_loglari SET soru_id = NULL WHERE soru_id = $1', [id]);

      // 3. LOGLAMA (Silinmeden önce)
      await logActivity(client, req.user.id, 'soru_silme', 'Soruyu sildi', null, {
        brans_id: soru.brans_id,
        silinen_soru_id: id,
        durum: soru.durum
      });

      // 4. Soruyu sil
      await client.query('DELETE FROM sorular WHERE id = $1', [id]);

      // 5. Sequence sıfırla (İlişkili tabloların ID'lerini bozmadan en büyük ID'ye çek)
      await client.query("SELECT setval('sorular_id_seq', COALESCE((SELECT MAX(id) FROM sorular), 1), (SELECT MAX(id) FROM sorular) IS NOT NULL)");

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Soru ve ilişkili tüm veriler başarıyla silindi'
      });
    } catch (transactionError) {
      await client.query('ROLLBACK');
      console.error('Soru silme işlem hatası:', transactionError);
      throw new AppError(`Soru silinemedi: ${transactionError.message}`, 500);
    } finally {
      client.release();
    }
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
    const isAnyIncelemeci = targetRole === 'incelemeci' || targetRole === 'alan_incelemeci' || targetRole === 'dil_incelemeci';

    if (targetRole === 'soru_yazici') {
      const isActuallyAdmin = req.user.rol === 'admin';
      // Yazar: Yetkili olduğu branşlardaki tüm soruların istatistiklerini görür
      query = `
        SELECT
          COUNT(*) as toplam,
          COUNT(*) FILTER(WHERE durum = 'beklemede') as beklemede,
          COUNT(*) FILTER(WHERE durum IN ('inceleme_bekliyor', 'alan_incelemede', 'dil_incelemede', 'incelemede')) as inceleme_bekliyor,
          COUNT(*) FILTER(WHERE durum = 'dizgi_bekliyor') as dizgi_bekliyor,
          COUNT(*) FILTER(WHERE durum = 'dizgide') as dizgide,
          COUNT(*) FILTER(WHERE durum IN ('dizgi_tamam', 'inceleme_tamam', 'alan_onaylandi', 'dil_onaylandi')) as dizgi_tamam,
          COUNT(*) FILTER(WHERE durum = 'tamamlandi') as tamamlandi,
          COUNT(*) FILTER(WHERE durum IN ('revize_gerekli', 'revize_istendi')) as revize_gerekli
        FROM sorular s
        ${isActuallyAdmin ? '' : `WHERE s.brans_id IN (
          SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1::integer
          UNION 
          SELECT brans_id FROM kullanicilar WHERE id = $2::integer
        )`}
      `;
      params = isActuallyAdmin ? [] : [req.user.id, req.user.id];
    } else if (targetRole === 'dizgici') {
      // Dizgici: Genel havuzdaki işler (Sadece kendi ekibindekiler)
      // Hem branşın ekibine hem de oluşturan kişinin ekibine bakıyoruz
      query = `
        SELECT
          COUNT(*) FILTER(WHERE s.durum IN ('dizgi_bekliyor', 'revize_istendi')) as dizgi_bekliyor,
          COUNT(*) FILTER(WHERE s.durum = 'dizgide' AND s.dizgici_id = $1) as dizgide,
          COUNT(*) FILTER(WHERE (s.durum = 'dizgi_tamam' AND s.dizgici_id = $1) OR (s.durum = 'tamamlandi' AND s.final_png_url IS NULL AND s.dizgici_id = $1)) as dosya_bekliyor,
          COUNT(*) FILTER(WHERE s.durum = 'tamamlandi' AND s.final_png_url IS NOT NULL) as tamamlandi
        FROM sorular s
        Left JOIN branslar b ON s.brans_id = b.id
        LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
        WHERE (b.ekip_id = $2 OR k.ekip_id = $2)
      `;
      params = [req.user.id, req.user.ekip_id || -1];
    } else if (targetRole === 'alan_incelemeci' || targetRole === 'dil_incelemeci') {
      const isAlan = targetRole === 'alan_incelemeci';
      const isActuallyAdmin = req.user.rol === 'admin';
      query = `
        SELECT COUNT(*) FILTER(WHERE s.durum IN ('inceleme_bekliyor', 'incelemede') AND s.${isAlan ? 'onay_alanci' : 'onay_dilci'} = false ${isActuallyAdmin ? '' : `AND (s.brans_id IN (SELECT brans_id FROM kullanici_branslari WHERE kullanici_id = $1::integer) OR s.brans_id IN (SELECT brans_id FROM kullanicilar WHERE id = $2::integer))`}) as inceleme_bekliyor 
        FROM sorular s 
      `;
      params = isActuallyAdmin ? [] : [req.user.id, req.user.id];
    } else if (isAnyIncelemeci) {
      const isAdmin = req.user.rol === 'admin';
      const canAlan = isAdmin || !!req.user.inceleme_alanci;
      const canDil = isAdmin || !!req.user.inceleme_dilci;

      // İncelemeciler için branch kısıtlamasını kaldırıyoruz (Küresel müfettiş rolü)
      // ANCAK: Ekip kısıtlaması ekliyoruz. Sadece kendi ekibine ait soruların sayılarını görebilir.
      query = `
        SELECT
          ${canAlan ? "COUNT(*) FILTER(WHERE s.durum IN ('alan_incelemede', 'inceleme_bekliyor', 'incelemede'))" : "0"} as inceleme_bekliyor_alanci,
          ${canDil ? "COUNT(*) FILTER(WHERE s.durum IN ('dil_incelemede', 'inceleme_bekliyor', 'incelemede'))" : "0"} as inceleme_bekliyor_dilci
        FROM sorular s
        JOIN branslar b ON s.brans_id = b.id
        LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
        ${isAdmin ? '' : 'WHERE (b.ekip_id = $1 OR k.ekip_id = $1)'}
      `;
      params = isAdmin ? [] : [req.user.ekip_id || -1];
    } else {
      // Admin: Global istatistikler
      query = `
      SELECT
      COUNT(*) as toplam,
        COUNT(*) FILTER(WHERE durum = 'beklemede') as beklemede,
        COUNT(*) FILTER(WHERE durum IN ('inceleme_bekliyor', 'incelemede', 'alan_incelemede', 'dil_incelemede', 'alan_onaylandi', 'dil_onaylandi', 'inceleme_tamam')) as inceleme_bekliyor,
        COUNT(*) FILTER(WHERE durum IN ('dizgi_bekliyor', 'dizgi_tamam')) as dizgi_bekliyor,
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
// Admin veya Koordinatör detaylı istatistikler
router.get('/stats/detayli', authenticate, async (req, res, next) => {
  try {
    const isKoordinator = req.user.rol === 'koordinator';
    if (req.user.rol !== 'admin' && !isKoordinator) {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    const ekipId = isKoordinator ? req.user.ekip_id : null;
    const whereClause = ekipId ? 'WHERE (b.ekip_id = $1 OR k.ekip_id = $1)' : '';
    const params = ekipId ? [ekipId] : [];

    // Genel istatistikler
    const genelStats = await pool.query(`
      SELECT
        COUNT(*) as toplam_soru,
        COUNT(CASE WHEN durum = 'beklemede' THEN 1 END) as taslak,
        COUNT(CASE WHEN durum IN ('dizgi_bekliyor', 'dizgide') THEN 1 END) as dizgi,
        COUNT(CASE WHEN durum IN ('dizgi_tamam', 'revize_istendi', 'revize_gerekli') THEN 1 END) as dizgi_sonrasi,
        COUNT(CASE WHEN durum IN ('alan_incelemede', 'alan_onaylandi', 'inceleme_bekliyor', 'incelemede') AND onay_alanci = false THEN 1 END) as alan_inceleme,
        COUNT(CASE WHEN durum IN ('dil_incelemede', 'dil_onaylandi', 'inceleme_bekliyor', 'incelemede') AND onay_dilci = false THEN 1 END) as dil_inceleme,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlandi,
        COUNT(CASE WHEN zorluk_seviyesi IN(1, 2) THEN 1 END) as kolay,
        COUNT(CASE WHEN zorluk_seviyesi = 3 THEN 1 END) as orta,
        COUNT(CASE WHEN zorluk_seviyesi IN(4, 5) THEN 1 END) as zor,
        COUNT(CASE WHEN zorluk_seviyesi = 1 THEN 1 END) as seviye1,
        COUNT(CASE WHEN zorluk_seviyesi = 2 THEN 1 END) as seviye2,
        COUNT(CASE WHEN zorluk_seviyesi = 3 THEN 1 END) as seviye3,
        COUNT(CASE WHEN zorluk_seviyesi = 4 THEN 1 END) as seviye4,
        COUNT(CASE WHEN zorluk_seviyesi = 5 THEN 1 END) as seviye5,
        COUNT(CASE WHEN fotograf_url IS NOT NULL THEN 1 END) as fotografli,
        COUNT(CASE WHEN latex_kodu IS NOT NULL AND latex_kodu != '' THEN 1 END) as latexli
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      ${whereClause}
    `, params);

    // Son eklenen soruları getir
    const sonSorular = await pool.query(`
      SELECT s.id, LEFT(s.soru_metni, 30) as metin, s.durum, k.ad_soyad as yazar
      FROM sorular s
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN branslar b ON s.brans_id = b.id
      ${whereClause}
      ORDER BY s.olusturulma_tarihi DESC
      LIMIT 10
    `, params);

    // Son aktiviteler
    const sonAktiviteler = await pool.query(`
      SELECT 
        a.id, a.aciklama as metin_ozeti, a.islem_turu as durum, a.tarih,
        k.ad_soyad as kullanici_adi, k.rol as kullanici_rolu,
        COALESCE(e.ekip_adi, 'Ekipsiz') as ekip_adi,
        COALESCE(b.brans_adi, 'Belirsiz') as brans_adi
      FROM aktivite_loglari a
      JOIN kullanicilar k ON a.kullanici_id = k.id
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN sorular s ON a.soru_id = s.id
      LEFT JOIN branslar b ON s.brans_id = b.id
      ${ekipId ? 'WHERE k.ekip_id = $1 OR s.brans_id IN (SELECT id FROM branslar WHERE ekip_id = $1)' : ''}
      ORDER BY a.tarih DESC
      LIMIT 10
    `, params);

    const bransStats = await pool.query(`
      SELECT
        b.id, b.brans_adi, COALESCE(e.ekip_adi, 'Ekipsiz') as ekip_adi,
        COUNT(s.id) as soru_sayisi,
        COUNT(CASE WHEN s.durum = 'beklemede' THEN 1 END) as taslak,
        COUNT(CASE WHEN s.durum IN ('dizgi_bekliyor', 'dizgide') THEN 1 END) as dizgi,
        COUNT(CASE WHEN s.durum IN ('dizgi_tamam', 'revize_istendi', 'revize_gerekli') THEN 1 END) as dizgi_sonrasi,
        COUNT(CASE WHEN s.durum IN ('alan_incelemede', 'alan_onaylandi', 'inceleme_bekliyor', 'incelemede') AND s.onay_alanci = false THEN 1 END) as alan_inceleme,
        COUNT(CASE WHEN s.durum IN ('dil_incelemede', 'dil_onaylandi', 'inceleme_bekliyor', 'incelemede') AND s.onay_dilci = false THEN 1 END) as dil_inceleme,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlandi
      FROM branslar b
      LEFT JOIN sorular s ON b.id = s.brans_id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      ${ekipId ? 'WHERE k.ekip_id = $1' : ''}
      GROUP BY b.id, b.brans_adi, e.ekip_adi
      HAVING COUNT(s.id) > 0
      ORDER BY b.brans_adi
    `, params);

    // Kullanıcı performans
    const kullaniciStats = await pool.query(`
      SELECT
        k.id, k.ad_soyad, k.email, k.rol,
        COUNT(s.id) as olusturulan_soru,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM kullanicilar k
      LEFT JOIN sorular s ON k.id = s.olusturan_kullanici_id
      WHERE k.rol = 'soru_yazici' ${ekipId ? 'AND k.ekip_id = $1' : ''}
      GROUP BY k.id, k.ad_soyad, k.email, k.rol
      ORDER BY olusturulan_soru DESC
      LIMIT 10
    `, params);

    // Trend (30 gün)
    const trendStats = await pool.query(`
      SELECT
        DATE(s.olusturulma_tarihi) as tarih,
        COUNT(*) as soru_sayisi,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} s.olusturulma_tarihi >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(s.olusturulma_tarihi)
      ORDER BY tarih DESC
    `, params);

    // Sistem özet bilgileri
    let sistemStats = {
      toplam_kullanici: 0,
      toplam_brans: 0,
      toplam_ekip: 0
    };

    if (isKoordinator) {
      const teamRes = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM kullanicilar WHERE ekip_id = $1) as users,
          (SELECT COUNT(*) FROM branslar WHERE ekip_id = $1) as branches
      `, [ekipId]);
      sistemStats = {
        toplam_kullanici: teamRes.rows[0].users,
        toplam_brans: teamRes.rows[0].branches,
        toplam_ekip: 1,
        is_ekip_view: true
      };
    } else {
      const adminRes = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM kullanicilar) as users,
          (SELECT COUNT(*) FROM branslar) as branches,
          (SELECT COUNT(*) FROM ekipler) as teams
      `);
      sistemStats = {
        toplam_kullanici: adminRes.rows[0].users,
        toplam_brans: adminRes.rows[0].branches,
        toplam_ekip: adminRes.rows[0].teams,
        is_ekip_view: false
      };
    }

    res.json({
      success: true,
      data: {
        genel: genelStats.rows[0],
        son_sorular: sonSorular.rows,
        sonAktiviteler: sonAktiviteler.rows,
        branslar: bransStats.rows,
        kullanicilar: kullaniciStats.rows,
        trend: trendStats.rows,
        sistem: sistemStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Rapor verilerini getir
router.get('/rapor', authenticate, authorize(['admin', 'koordinator']), async (req, res, next) => {
  try {
    const { baslangic, bitis, tip } = req.query;
    const isKoordinator = req.user.rol === 'koordinator';
    const ekipId = isKoordinator ? req.user.ekip_id : null;

    if (!baslangic || !bitis) {
      throw new AppError('Başlangıç ve bitiş tarihi gerekli', 400);
    }

    const reportParams = [baslangic, bitis];
    if (ekipId) reportParams.push(ekipId);

    const pLimit = ekipId ? '$3' : null;

    // Genel istatistikler
    const genelQuery = `
      SELECT
        COUNT(*) as toplam_soru,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlanan,
        COUNT(CASE WHEN durum = 'beklemede' THEN 1 END) as bekleyen,
        COUNT(CASE WHEN durum = 'dizgide' THEN 1 END) as devam_eden,
        COUNT(CASE WHEN zorluk_seviyesi IN(4, 5) THEN 1 END) as zor
      FROM sorular s
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      WHERE s.olusturulma_tarihi >= $1::date AND s.olusturulma_tarihi < ($2::date + interval '1 day')
      ${ekipId ? `AND k.ekip_id = ${pLimit}` : ''}
    `;

    // Branş bazında detaylı rapor
    const bransQuery = `
      SELECT
        b.brans_adi, COALESCE(e.ekip_adi, 'Ekipsiz') as ekip_adi,
        COUNT(s.id) as toplam_soru,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan,
        COUNT(CASE WHEN s.durum = 'beklemede' THEN 1 END) as bekleyen,
        COUNT(CASE WHEN s.durum = 'dizgide' THEN 1 END) as devam_eden
      FROM branslar b
      LEFT JOIN sorular s ON b.id = s.brans_id 
        AND s.olusturulma_tarihi >= $1::date 
        AND s.olusturulma_tarihi < ($2::date + interval '1 day')
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      ${ekipId ? `WHERE k.ekip_id = ${pLimit}` : ''}
      GROUP BY b.id, b.brans_adi, e.ekip_adi
      ORDER BY toplam_soru DESC
    `;

    // Kullanıcı performans
    const kullaniciQuery = `
      SELECT
        k.ad_soyad, k.email, b.brans_adi,
        COUNT(s.id) as olusturulan_soru,
        COUNT(CASE WHEN s.durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.olusturan_kullanici_id 
        AND s.olusturulma_tarihi >= $1::date 
        AND s.olusturulma_tarihi < ($2::date + interval '1 day')
      WHERE k.rol = 'soru_yazici' ${ekipId ? `AND k.ekip_id = ${pLimit}` : ''}
      GROUP BY k.id, k.ad_soyad, k.email, b.brans_adi
      HAVING COUNT(s.id) > 0
      ORDER BY olusturulan_soru DESC
    `;

    // Dizgici performans
    const dizgiQuery = `
      SELECT
        k.ad_soyad, k.email, b.brans_adi,
        COUNT(s.id) as tamamlanan_soru
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.dizgici_id 
        AND s.olusturulma_tarihi >= $1::date 
        AND s.olusturulma_tarihi < ($2::date + interval '1 day')
      WHERE k.rol = 'dizgici' ${ekipId ? `AND k.ekip_id = ${pLimit}` : ''}
      GROUP BY k.id, k.ad_soyad, k.email, b.brans_adi
      HAVING COUNT(s.id) > 0
      ORDER BY tamamlanan_soru DESC
    `;

    // Günlük trend
    const trendQuery = `
      SELECT
        DATE(olusturulma_tarihi) as tarih,
        COUNT(*) as olusturulan,
        COUNT(CASE WHEN durum = 'tamamlandi' THEN 1 END) as tamamlanan
      FROM sorular s
      WHERE olusturulma_tarihi >= $1::date AND olusturulma_tarihi < ($2::date + interval '1 day')
      ${ekipId ? `AND s.brans_id IN (SELECT id FROM branslar WHERE ekip_id = ${pLimit})` : ''}
      GROUP BY DATE(olusturulma_tarihi)
      ORDER BY tarih
    `;

    const [genel, branslar, kullanicilar, dizgiciler, trend] = await Promise.all([
      pool.query(genelQuery, reportParams),
      pool.query(bransQuery, reportParams),
      pool.query(kullaniciQuery, reportParams),
      pool.query(dizgiQuery, reportParams),
      pool.query(trendQuery, reportParams)
    ]);

    res.json({
      success: true,
      data: {
        donem: { baslangic, bitis, tip: tip || 'ozel' },
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
      // Reset sequence after clearing all
      await pool.query("SELECT setval('sorular_id_seq', 1, false)");
      console.log(`⚠️ ADMIN CLEANUP: ${result.rows.length} soru silindi.`);
      return res.json({
        success: true,
        count: result.rows.length,
        message: 'Tüm soru kayıtları ve ilgili geçmişler temizlendi.'
      });
    }

    if (action === 'reindex') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Mevcut ID'leri 1'den başlayıp sıralı olacak şekilde eşleştir
        await client.query('CREATE TEMP TABLE id_mapping AS SELECT id as old_id, row_number() OVER (ORDER BY id) as new_id FROM sorular');

        // 2. Tüm ilişkili tablolardaki soru_id referanslarını güncelle
        const relatedTables = [
          { name: 'mesajlar', col: 'soru_id' },
          { name: 'soru_goruntulenme', col: 'soru_id' },
          { name: 'dizgi_gecmisi', col: 'soru_id' },
          { name: 'soru_versiyonlari', col: 'soru_id' },
          { name: 'soru_yorumlari', col: 'soru_id' },
          { name: 'soru_revize_notlari', col: 'soru_id' },
          { name: 'aktivite_loglari', col: 'soru_id' }
        ];

        for (const t of relatedTables) {
          await client.query(`UPDATE ${t.name} tbl SET ${t.col} = m.new_id FROM id_mapping m WHERE tbl.${t.col} = m.old_id`);
        }

        // 3. Ana tablo ID'lerini PK hatası almamak için önce negatif yap sonra pozitife çek
        // (Çakışmaları önlemek için geçici olarak)
        await client.query('UPDATE sorular s SET id = -m.new_id FROM id_mapping m WHERE s.id = m.old_id');
        await client.query('UPDATE sorular SET id = -id');

        // 4. Diziyi sıfırla (Bir sonraki soru son sayının bir fazlası olsun)
        await client.query("SELECT setval('sorular_id_seq', COALESCE((SELECT MAX(id) FROM sorular), 1), (SELECT MAX(id) FROM sorular) IS NOT NULL)");

        await client.query('COMMIT');
        return res.json({ success: true, message: 'Tüm soru ID\'leri ardışık olarak yeniden düzenlendi.' });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Reindex Error:', err);
        throw err;
      } finally {
        client.release();
      }
    }

    throw new AppError('Gecersiz işlem', 400);
  } catch (error) {
    next(error);
  }
});

// İncelemeci detaylı istatistikler (Ekip ve Branş bazlı)
router.get('/stats/inceleme-detayli', authenticate, async (req, res, next) => {
  try {
    const isReviewer = req.user.rol === 'admin' || req.user.rol === 'incelemeci' || req.user.rol === 'alan_incelemeci' || req.user.rol === 'dil_incelemeci' || req.user.inceleme_alanci || req.user.inceleme_dilci;

    if (!isReviewer) {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    const query = `
    SELECT
      COALESCE(e.id, 0) as ekip_id,
      COALESCE(e.ekip_adi, 'Genel / Paylaşımlı') as ekip_adi,
      b.id as brans_id,
      b.brans_adi,
      s.kategori,
      COUNT(s.id) FILTER(WHERE s.durum IN('inceleme_bekliyor', 'incelemede', 'revize_istendi', 'alan_incelemede', 'dil_incelemede') AND s.onay_alanci = false) as alanci_bekleyen,
      COUNT(s.id) FILTER(WHERE s.onay_alanci = true) as alanci_tamamlanan,
      COUNT(s.id) FILTER(WHERE s.durum IN('inceleme_bekliyor', 'incelemede', 'revize_istendi', 'alan_incelemede', 'dil_incelemede') AND s.onay_dilci = false) as dilci_bekleyen,
      COUNT(s.id) FILTER(WHERE s.onay_dilci = true) as dilci_tamamlanan,
      COUNT(s.id) as kategori_toplam
    FROM sorular s
    JOIN branslar b ON s.brans_id = b.id
    LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
    LEFT JOIN ekipler e ON k.ekip_id = e.id
    WHERE 1=1
      ${req.user.rol !== 'admin' ? `AND (b.ekip_id = ${req.user.ekip_id || -1} OR k.ekip_id = ${req.user.ekip_id || -1})` : ''}
    GROUP BY e.id, e.ekip_adi, b.id, b.brans_adi, s.kategori
    ORDER BY b.brans_adi, s.kategori
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
      LEFT JOIN ekipler e ON u.ekip_id = e.id
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
             WHERE soru_id = $1 AND cozuldu = false ORDER BY tarih ASC`,
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


// Toplu kullanım güncelleme
router.post('/bulk-usage', authenticate, async (req, res, next) => {
  try {
    const { ids, kullanildi, kullanim_alani } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Geçerli soru ID listesi gerekli', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const id of ids) {
        // Yetki kontrolü (Admin, Koordinatör veya branş yetkisi)
        const checkResult = await client.query('SELECT brans_id FROM sorular WHERE id = $1', [id]);
        if (checkResult.rows.length > 0) {
          const brans_id = checkResult.rows[0].brans_id;

          let hasPermission = req.user.rol === 'admin';
          if (!hasPermission && req.user.rol === 'koordinator') {
            const ekipResult = await client.query('SELECT ekip_id FROM branslar WHERE id = $1', [brans_id]);
            if (ekipResult.rows[0]?.ekip_id === req.user.ekip_id) hasPermission = true;
          }
          if (!hasPermission) {
            const authBrans = await client.query(`
              SELECT 1 FROM kullanici_branslari WHERE kullanici_id = $1::integer AND brans_id = $2::integer
              UNION
              SELECT 1 FROM kullanicilar WHERE id = $3::integer AND brans_id = $4::integer
            `, [req.user.id, brans_id, req.user.id, brans_id]);
            if (authBrans.rows.length > 0) hasPermission = true;
          }

          if (hasPermission) {
            // 1. Önce snapshot al
            const soruRes = await client.query('SELECT * FROM sorular WHERE id = $1', [id]);
            const soru = soruRes.rows[0];

            await client.query(
              `INSERT INTO soru_versiyonlari (soru_id, versiyon_no, data, degistiren_kullanici_id, degisim_aciklamasi)
               VALUES ($1, $2, $3, $4, $5)`,
              [id, soru.versiyon || 1, JSON.stringify(soru), req.user.id, `Toplu kullanım işaretleme: ${kullanim_alani || ''}`]
            );

            // 2. Güncelle
            await client.query(
              `UPDATE sorular SET 
               kullanildi = $1, 
               kullanim_alani = $2,
               guncellenme_tarihi = CURRENT_TIMESTAMP,
               versiyon = COALESCE(versiyon, 1) + 1
               WHERE id = $3`,
              [kullanildi === true || kullanildi === 'true', kullanim_alani || null, id]
            );

            await logActivity(client, req.user.id, 'toplu_kullanim_guncelleme',
              `Soru kullanım durumunu güncelledi: ${kullanildi ? 'Kullanıldı' : 'Kullanılmadı'} - ${kullanim_alani || ''}`, id);
          }
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: `${ids.length} soru başarıyla güncellendi.` });
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

export default router;
