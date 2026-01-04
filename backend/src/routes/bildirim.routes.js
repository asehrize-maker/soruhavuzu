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
