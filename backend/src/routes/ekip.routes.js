import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Tüm ekipleri getir
router.get('/', authenticate, async (req, res, next) => {
  try {
    let query = `
      SELECT e.*, 
             COUNT(DISTINCT b.id) as brans_sayisi,
             COUNT(DISTINCT k.id) as kullanici_sayisi
      FROM ekipler e
      LEFT JOIN branslar b ON e.id = b.ekip_id
      LEFT JOIN kullanicilar k ON e.id = k.ekip_id
    `;
    const params = [];

    if (req.user.rol !== 'admin' && req.user.rol !== 'incelemeci') {
      query += ` WHERE e.id = $1`;
      params.push(req.user.ekip_id);
    }

    query += ` GROUP BY e.id ORDER BY e.olusturulma_tarihi DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Ekip detayı
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const ekipResult = await pool.query('SELECT * FROM ekipler WHERE id = $1', [id]);

    if (ekipResult.rows.length === 0) {
      throw new AppError('Ekip bulunamadı', 404);
    }

    const branslarResult = await pool.query('SELECT * FROM branslar WHERE ekip_id = $1', [id]);

    res.json({
      success: true,
      data: {
        ...ekipResult.rows[0],
        branslar: branslarResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

// Yeni ekip oluştur (Sadece admin)
router.post('/', [
  authenticate,
  authorize('admin'),
  body('ekip_adi').trim().notEmpty().withMessage('Ekip adı gerekli')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { ekip_adi, aciklama } = req.body;

    const result = await pool.query(
      'INSERT INTO ekipler (ekip_adi, aciklama) VALUES ($1, $2) RETURNING *',
      [ekip_adi, aciklama]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      next(new AppError('Bu ekip adı zaten kullanılıyor', 400));
    } else {
      next(error);
    }
  }
});

// Ekip güncelle (Sadece admin)
router.put('/:id', [
  authenticate,
  authorize('admin'),
  body('ekip_adi').trim().notEmpty().withMessage('Ekip adı gerekli')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { ekip_adi, aciklama } = req.body;

    const result = await pool.query(
      'UPDATE ekipler SET ekip_adi = $1, aciklama = $2 WHERE id = $3 RETURNING *',
      [ekip_adi, aciklama, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Ekip bulunamadı', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Ekip sil (Sadece admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM ekipler WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Ekip bulunamadı', 404);
    }

    res.json({
      success: true,
      message: 'Ekip silindi'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
