import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import cloudinary from '../config/cloudinary.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './bildirim.routes.js';

const router = express.Router();

// Multer config (memory storage)
const upload = multer({
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

// Tüm soruları getir (filtreleme ile)
router.get('/', authenticate, async (req, res, next) => {
  try {
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
      // Soru yazıcı sadece kendi sorularını görür
      query += ` AND s.olusturan_kullanici_id = $${paramCount++}`;
      params.push(req.user.id);
    } else if (req.user.rol === 'dizgici') {
      // Dizgici kendi branşındaki soruları görür
      query += ` AND b.id = $${paramCount++}`;
      params.push(req.user.brans_id);
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

// Soru detayı
router.get('/:id', authenticate, async (req, res, next) => {
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
  upload.single('fotograf'),
  body('soru_metni').trim().notEmpty().withMessage('Soru metni gerekli'),
  body('brans_id').isInt().withMessage('Geçerli bir branş seçin')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { soru_metni, zorluk_seviyesi, brans_id, latex_kodu } = req.body;
    let fotograf_url = null;
    let fotograf_public_id = null;

    // Fotoğraf yükleme
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'soru-havuzu',
        resource_type: 'auto'
      });

      fotograf_url = uploadResult.secure_url;
      fotograf_public_id = uploadResult.public_id;
    }

    const result = await pool.query(
      `INSERT INTO sorular (soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi, brans_id, latex_kodu, olusturan_kullanici_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi || null, brans_id, latex_kodu || null, req.user.id]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Soru güncelle
router.put('/:id', [
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
    const { soru_metni, zorluk_seviyesi } = req.body;

    // Soru sahibi kontrolü
    const checkResult = await pool.query('SELECT * FROM sorular WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = checkResult.rows[0];

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
        resource_type: 'auto'
      });

      fotograf_url = uploadResult.secure_url;
      fotograf_public_id = uploadResult.public_id;
    }

    const result = await pool.query(
      `UPDATE sorular 
       SET soru_metni = $1, fotograf_url = $2, fotograf_public_id = $3, 
           zorluk_seviyesi = $4, guncellenme_tarihi = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [soru_metni, fotograf_url, fotograf_public_id, zorluk_seviyesi, id]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Soruyu dizgiye al (Dizgici)
router.post('/:id/dizgi-al', authenticate, authorize('dizgici', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE sorular 
       SET durum = 'dizgide', dizgici_id = $1, guncellenme_tarihi = CURRENT_TIMESTAMP
       WHERE id = $2 AND durum = 'beklemede'
       RETURNING *`,
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
router.post('/:id/dizgi-tamamla', [
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

      // Soruyu güncelle
      const soruResult = await client.query(
        `UPDATE sorular 
         SET durum = 'tamamlandi', guncellenme_tarihi = CURRENT_TIMESTAMP
         WHERE id = $1 AND dizgici_id = $2
         RETURNING *`,
        [id, req.user.id]
      );

      if (soruResult.rows.length === 0) {
        throw new AppError('Soru bulunamadı veya bu sorunun dizgicisi değilsiniz', 404);
      }

      // Dizgi geçmişine ekle
      await client.query(
        `INSERT INTO dizgi_gecmisi (soru_id, dizgici_id, durum, notlar) 
         VALUES ($1, $2, 'tamamlandi', $3)`,
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
router.delete('/:id', authenticate, async (req, res, next) => {
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
      await cloudinary.uploader.destroy(soru.fotograf_public_id);
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
      whereClause = 'WHERE brans_id = $1';
      params.push(req.user.brans_id);
    }

    const result = await pool.query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE durum = 'beklemede') as beklemede,
        COUNT(*) FILTER (WHERE durum = 'dizgide') as dizgide,
        COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlandi,
        COUNT(*) FILTER (WHERE durum = 'revize_gerekli') as revize_gerekli
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

// Soru durumunu güncelle (Dizgici)
router.put('/:id/durum', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { durum, revize_notu } = req.body;

    const validDurumlar = ['beklemede', 'dizgide', 'tamamlandi', 'revize_gerekli'];
    if (!validDurumlar.includes(durum)) {
      throw new AppError('Geçersiz durum', 400);
    }

    // Soruyu kontrol et
    const soruResult = await pool.query(
      'SELECT * FROM sorular WHERE id = $1',
      [id]
    );

    if (soruResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = soruResult.rows[0];

    // Durum bazlı kontroller
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let updateQuery = 'UPDATE sorular SET durum = $1';
      let params = [durum];
      let paramCount = 2;

      // Dizgiye alındıysa dizgici_id ve tarihleri güncelle
      if (durum === 'dizgide' && soru.durum === 'beklemede') {
        updateQuery += `, dizgici_id = $${paramCount++}, dizgi_baslama_tarihi = CURRENT_TIMESTAMP`;
        params.push(req.user.id);
      }

      // Tamamlandıysa dizgi bitiş tarihini kaydet
      if (durum === 'tamamlandi') {
        updateQuery += `, dizgi_bitis_tarihi = CURRENT_TIMESTAMP`;
      }

      // Revize isteniyorsa notu kaydet
      if (durum === 'revize_gerekli') {
        updateQuery += `, revize_notu = $${paramCount++}`;
        params.push(revize_notu || '');
        
        // Soru yazıcıya bildirim gönder
        await createNotification(
          soru.olusturan_kullanici_id,
          'Revize Talebi',
          `Soru #${id} için revize talep edildi: ${revize_notu || 'Detay yok'}`,
          'revize',
          `/sorular/${id}`
        );
      }

      updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
      params.push(id);

      const result = await client.query(updateQuery, params);

      await client.query('COMMIT');

      res.json({
        success: true,
        data: result.rows[0]
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
        COUNT(*) FILTER (WHERE durum = 'beklemede') as beklemede,
        COUNT(*) FILTER (WHERE durum = 'dizgide') as dizgide,
        COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlandi,
        COUNT(*) FILTER (WHERE durum = 'revize_gerekli') as revize_gerekli,
        COUNT(*) FILTER (WHERE zorluk_seviyesi = 'kolay') as kolay,
        COUNT(*) FILTER (WHERE zorluk_seviyesi = 'orta') as orta,
        COUNT(*) FILTER (WHERE zorluk_seviyesi = 'zor') as zor,
        COUNT(*) FILTER (WHERE fotograf_url IS NOT NULL) as fotografli,
        COUNT(*) FILTER (WHERE latex_kodu IS NOT NULL AND latex_kodu != '') as latexli
      FROM sorular
    `);

    // Branş bazlı istatistikler
    const bransStats = await pool.query(`
      SELECT 
        b.id,
        b.brans_adi,
        e.ekip_adi,
        COUNT(s.id) as soru_sayisi,
        COUNT(*) FILTER (WHERE s.durum = 'beklemede') as beklemede,
        COUNT(*) FILTER (WHERE s.durum = 'dizgide') as dizgide,
        COUNT(*) FILTER (WHERE s.durum = 'tamamlandi') as tamamlandi
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
        COUNT(*) FILTER (WHERE s.durum = 'tamamlandi') as tamamlanan
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
        AVG(EXTRACT(EPOCH FROM (dg.tamamlanma_tarihi - s.olusturulma_tarihi))/3600)::numeric(10,2) as ortalama_sure_saat
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
        COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlanan
      FROM sorular
      WHERE olusturulma_tarihi >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(olusturulma_tarihi)
      ORDER BY tarih DESC
    `);

    // Kullanıcı sayıları
    const kullaniciSayilari = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE rol = 'admin') as admin_sayisi,
        COUNT(*) FILTER (WHERE rol = 'soru_yazici') as soru_yazici_sayisi,
        COUNT(*) FILTER (WHERE rol = 'dizgici') as dizgici_sayisi,
        COUNT(*) as toplam_kullanici
      FROM kullanicilar
    `);

    // Ekip sayıları
    const ekipStats = await pool.query(`
      SELECT COUNT(*) as toplam_ekip FROM ekipler
    `);

    // Branş sayıları
    const bransStatsCount = await pool.query(`
      SELECT COUNT(*) as toplam_brans FROM branslar
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
        COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlanan,
        COUNT(*) FILTER (WHERE durum = 'beklemede') as bekleyen,
        COUNT(*) FILTER (WHERE durum = 'devam_ediyor') as devam_eden,
        COUNT(*) FILTER (WHERE durum = 'red_edildi') as reddedilen,
        COUNT(*) FILTER (WHERE fotograf_url IS NOT NULL) as fotografli,
        COUNT(*) FILTER (WHERE latex_kodu IS NOT NULL) as latexli,
        COUNT(*) FILTER (WHERE zorluk_seviyesi = 'kolay') as kolay,
        COUNT(*) FILTER (WHERE zorluk_seviyesi = 'orta') as orta,
        COUNT(*) FILTER (WHERE zorluk_seviyesi = 'zor') as zor
      FROM sorular
      WHERE olusturulma_tarihi >= $1 AND olusturulma_tarihi <= $2
    `;

    // Branş bazında detaylı rapor
    const bransQuery = `
      SELECT 
        b.brans_adi,
        e.ekip_adi,
        COUNT(s.id) as toplam_soru,
        COUNT(*) FILTER (WHERE s.durum = 'tamamlandi') as tamamlanan,
        COUNT(*) FILTER (WHERE s.durum = 'beklemede') as bekleyen,
        COUNT(*) FILTER (WHERE s.durum = 'devam_ediyor') as devam_eden,
        COUNT(*) FILTER (WHERE s.durum = 'red_edildi') as reddedilen,
        ROUND(AVG(EXTRACT(EPOCH FROM (s.tamamlanma_tarihi - s.olusturulma_tarihi))/3600), 2) as ortalama_sure_saat
      FROM branslar b
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN sorular s ON b.id = s.brans_id 
        AND s.olusturulma_tarihi >= $1 
        AND s.olusturulma_tarihi <= $2
      GROUP BY b.id, b.brans_adi, e.ekip_adi
      ORDER BY toplam_soru DESC
    `;

    // Kullanıcı performans raporu (soru yazıcılar)
    const kullaniciQuery = `
      SELECT 
        k.ad_soyad,
        k.kullanici_adi,
        b.brans_adi,
        COUNT(s.id) as olusturulan_soru,
        COUNT(*) FILTER (WHERE s.durum = 'tamamlandi') as tamamlanan,
        COUNT(*) FILTER (WHERE s.durum = 'red_edildi') as reddedilen,
        ROUND(
          (COUNT(*) FILTER (WHERE s.durum = 'tamamlandi')::float / 
          NULLIF(COUNT(s.id), 0) * 100), 2
        ) as basari_orani
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.olusturan_kullanici_id 
        AND s.olusturulma_tarihi >= $1 
        AND s.olusturulma_tarihi <= $2
      WHERE k.rol = 'soru_yazici'
      GROUP BY k.id, k.ad_soyad, k.kullanici_adi, b.brans_adi
      ORDER BY olusturulan_soru DESC
    `;

    // Dizgici performans raporu
    const dizgiQuery = `
      SELECT 
        k.ad_soyad,
        k.kullanici_adi,
        b.brans_adi,
        COUNT(s.id) as tamamlanan_soru,
        ROUND(AVG(EXTRACT(EPOCH FROM (s.tamamlanma_tarihi - s.dizgiye_gonderilme_tarihi))/3600), 2) as ortalama_sure_saat,
        COUNT(*) FILTER (WHERE s.durum = 'red_edildi') as reddedilen
      FROM kullanicilar k
      LEFT JOIN branslar b ON k.brans_id = b.id
      LEFT JOIN sorular s ON k.id = s.dizgici_id 
        AND s.dizgiye_gonderilme_tarihi >= $1 
        AND s.dizgiye_gonderilme_tarihi <= $2
        AND s.durum IN ('tamamlandi', 'red_edildi')
      WHERE k.rol = 'dizgici'
      GROUP BY k.id, k.ad_soyad, k.kullanici_adi, b.brans_adi
      ORDER BY tamamlanan_soru DESC
    `;

    // Günlük trend (rapor dönemi boyunca)
    const trendQuery = `
      SELECT 
        DATE(olusturulma_tarihi) as tarih,
        COUNT(*) as olusturulan,
        COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlanan
      FROM sorular
      WHERE olusturulma_tarihi >= $1 AND olusturulma_tarihi <= $2
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

export default router;
