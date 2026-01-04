import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './bildirim.routes.js';

const router = express.Router();

// Tüm kullanıcıları listele (mesajlaşma için)
router.get('/kullanicilar', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.ad_soyad, k.email, k.rol, 
              b.brans_adi, e.ekip_adi
       FROM kullanicilar k
       LEFT JOIN branslar b ON k.brans_id = b.id
       LEFT JOIN ekipler e ON k.ekip_id = e.id
       WHERE k.id != $1
       ORDER BY k.ad_soyad ASC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Konuşma listesini getir (her kullanıcıyla son mesaj)
router.get('/konusmalar', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (CASE 
          WHEN km.gonderen_id = $1 THEN km.alici_id 
          ELSE km.gonderen_id 
        END)
        CASE 
          WHEN km.gonderen_id = $1 THEN km.alici_id 
          ELSE km.gonderen_id 
        END as kullanici_id,
        k.ad_soyad,
        k.rol,
        b.brans_adi,
        km.mesaj as son_mesaj,
        km.olusturulma_tarihi,
        km.gonderen_id = $1 as ben_gonderdim,
        CASE WHEN km.gonderen_id != $1 AND km.okundu = false THEN 1 ELSE 0 END as okunmamis_sayisi
      FROM kullanici_mesajlari km
      JOIN kullanicilar k ON (
        CASE 
          WHEN km.gonderen_id = $1 THEN km.alici_id 
          ELSE km.gonderen_id 
        END = k.id
      )
      LEFT JOIN branslar b ON k.brans_id = b.id
      WHERE km.gonderen_id = $1 OR km.alici_id = $1
      ORDER BY CASE 
          WHEN km.gonderen_id = $1 THEN km.alici_id 
          ELSE km.gonderen_id 
        END, km.olusturulma_tarihi DESC`,
      [req.user.id]
    );

    // Okunmamış mesaj sayılarını doğru hesapla
    const konusmalarPromises = result.rows.map(async (konusma) => {
      const okunmamisResult = await pool.query(
        `SELECT COUNT(*) as sayi 
         FROM kullanici_mesajlari 
         WHERE alici_id = $1 AND gonderen_id = $2 AND okundu = false`,
        [req.user.id, konusma.kullanici_id]
      );
      
      return {
        ...konusma,
        okunmamis_sayisi: parseInt(okunmamisResult.rows[0].sayi)
      };
    });

    const konusmalar = await Promise.all(konusmalarPromises);

    res.json({
      success: true,
      data: konusmalar
    });
  } catch (error) {
    next(error);
  }
});

// Bir kullanıcıyla mesaj geçmişini getir
router.get('/konusma/:kullaniciId', authenticate, async (req, res, next) => {
  try {
    const { kullaniciId } = req.params;

    const result = await pool.query(
      `SELECT km.*, 
              k.ad_soyad as gonderen_adi,
              k.rol as gonderen_rol
       FROM kullanici_mesajlari km
       JOIN kullanicilar k ON km.gonderen_id = k.id
       WHERE (km.gonderen_id = $1 AND km.alici_id = $2) 
          OR (km.gonderen_id = $2 AND km.alici_id = $1)
       ORDER BY km.olusturulma_tarihi ASC`,
      [req.user.id, kullaniciId]
    );

    // Alınan mesajları okundu olarak işaretle
    await pool.query(
      `UPDATE kullanici_mesajlari 
       SET okundu = true 
       WHERE alici_id = $1 AND gonderen_id = $2 AND okundu = false`,
      [req.user.id, kullaniciId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Mesaj gönder
router.post('/gonder', authenticate, async (req, res, next) => {
  try {
    const { alici_id, mesaj, dosya_url } = req.body;

    if (!alici_id || !mesaj) {
      throw new AppError('Alıcı ID ve mesaj gerekli', 400);
    }

    // Alıcıyı kontrol et
    const aliciResult = await pool.query(
      'SELECT ad_soyad FROM kullanicilar WHERE id = $1',
      [alici_id]
    );

    if (aliciResult.rows.length === 0) {
      throw new AppError('Alıcı bulunamadı', 404);
    }

    // Mesajı kaydet
    const result = await pool.query(
      `INSERT INTO kullanici_mesajlari (gonderen_id, alici_id, mesaj, dosya_url) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [req.user.id, alici_id, mesaj, dosya_url]
    );

    // Bildirim gönder
    await createNotification(
      alici_id,
      'Yeni Mesaj',
      `${req.user.ad_soyad}: ${mesaj.substring(0, 50)}${mesaj.length > 50 ? '...' : ''}`,
      'info',
      '/mesajlar'
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Mesaj sil (sadece kendi mesajı)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM kullanici_mesajlari WHERE id = $1 AND gonderen_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Mesaj bulunamadı veya silme yetkiniz yok', 404);
    }

    res.json({
      success: true,
      message: 'Mesaj silindi'
    });
  } catch (error) {
    next(error);
  }
});

// Okunmamış mesaj sayısı
router.get('/okunmamis-sayisi', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as sayi FROM kullanici_mesajlari WHERE alici_id = $1 AND okundu = false',
      [req.user.id]
    );

    res.json({
      success: true,
      data: { sayi: parseInt(result.rows[0].sayi) }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
