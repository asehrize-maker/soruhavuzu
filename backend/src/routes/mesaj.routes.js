import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { createNotification } from './bildirim.routes.js';

const router = express.Router();

// Bir soruya ait tüm mesajları getir
router.get('/soru/:soruId', authenticate, async (req, res, next) => {
  try {
    const { soruId } = req.params;

    const result = await pool.query(
      `SELECT m.*, 
              k.ad_soyad as gonderen_adi,
              k.rol as gonderen_rol
       FROM mesajlar m
       JOIN kullanicilar k ON m.gonderen_id = k.id
       WHERE m.soru_id = $1
       ORDER BY m.olusturulma_tarihi ASC`,
      [soruId]
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
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { soru_id, mesaj, dosya_url } = req.body;

    if (!soru_id || !mesaj) {
      throw new AppError('Soru ID ve mesaj gerekli', 400);
    }

    // Soruyu kontrol et
    const soruResult = await pool.query(
      'SELECT s.*, k.id as yazici_id, s.dizgici_id FROM sorular s JOIN kullanicilar k ON s.kullanici_id = k.id WHERE s.id = $1',
      [soru_id]
    );

    if (soruResult.rows.length === 0) {
      throw new AppError('Soru bulunamadı', 404);
    }

    const soru = soruResult.rows[0];

    // Mesajı kaydet
    const result = await pool.query(
      `INSERT INTO mesajlar (soru_id, gonderen_id, mesaj, dosya_url) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [soru_id, req.user.id, mesaj, dosya_url]
    );

    // Bildirim gönder (mesajı gönderene değil, karşı tarafa)
    const alici_id = req.user.id === soru.yazici_id ? soru.dizgici_id : soru.yazici_id;
    
    if (alici_id) {
      await createNotification(
        alici_id,
        'Yeni Mesaj',
        `Soru #${soru_id} için yeni mesaj: ${mesaj.substring(0, 50)}...`,
        'info',
        `/sorular/${soru_id}`
      );
    }

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
      'DELETE FROM mesajlar WHERE id = $1 AND gonderen_id = $2 RETURNING *',
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

export default router;
