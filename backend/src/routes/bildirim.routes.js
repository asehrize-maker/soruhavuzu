import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Kullanıcının bildirimlerini getir
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM bildirimler 
       WHERE kullanici_id = $1 
       ORDER BY olusturulma_tarihi DESC 
       LIMIT 50`,
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

// Okunmamış bildirim sayısı
router.get('/okunmamis-sayisi', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as sayi FROM bildirimler WHERE kullanici_id = $1 AND okundu = false',
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

// Bildirimi okundu olarak işaretle
router.put('/:id/okundu', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE bildirimler 
       SET okundu = true 
       WHERE id = $1 AND kullanici_id = $2 
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Bildirim bulunamadı', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Tüm bildirimleri okundu işaretle
router.put('/hepsini-okundu-isaretle', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE bildirimler SET okundu = true WHERE kullanici_id = $1 AND okundu = false',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Tüm bildirimler okundu olarak işaretlendi'
    });
  } catch (error) {
    next(error);
  }
});

// Tüm kullanıcılara veya ekibe duyuru gönder
router.post('/duyuru', authenticate, async (req, res, next) => {
  try {
    const isKoordinator = req.user.rol === 'koordinator';
    if (req.user.rol !== 'admin' && !isKoordinator) {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    const { baslik, mesaj, tip, link } = req.body;

    if (!baslik || !mesaj) {
      throw new AppError('Başlık ve mesaj gerekli', 400);
    }

    // Alıcıları belirle
    let query = 'SELECT id FROM kullanicilar WHERE id != $1';
    const params = [req.user.id];

    if (isKoordinator) {
      query += ' AND ekip_id = $2';
      params.push(req.user.ekip_id);
    }

    const kullanicilarResult = await pool.query(query, params);

    // Her kullanıcıya bildirim oluştur
    const insertPromises = kullanicilarResult.rows.map(user =>
      pool.query(
        `INSERT INTO bildirimler (kullanici_id, baslik, mesaj, tip, link) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, baslik, mesaj, tip || 'duyuru', link]
      )
    );

    await Promise.all(insertPromises);

    res.json({
      success: true,
      message: `${isKoordinator ? 'Ekibinize' : 'Tüm kullanıcılara'} duyuru gönderildi (${kullanicilarResult.rows.length} kişi)`,
      count: kullanicilarResult.rows.length
    });
  } catch (error) {
    next(error);
  }
});

// Bildirim oluştur (helper function)
export async function createNotification(kullanici_id, baslik, mesaj, tip = 'info', link = null) {
  try {
    await pool.query(
      `INSERT INTO bildirimler (kullanici_id, baslik, mesaj, tip, link) 
       VALUES ($1, $2, $3, $4, $5)`,
      [kullanici_id, baslik, mesaj, tip, link]
    );
  } catch (error) {
    console.error('Bildirim oluşturma hatası:', error);
  }
}

export default router;
