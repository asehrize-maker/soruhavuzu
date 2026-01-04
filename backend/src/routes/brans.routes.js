import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Tüm branşları getir veya ekibe göre filtrele
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { ekip_id } = req.query;
    
    let query = `
      SELECT b.*, e.ekip_adi,
             COUNT(DISTINCT s.id) as soru_sayisi
      FROM branslar b
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN sorular s ON b.id = s.brans_id
    `;
    
    const params = [];
    
    if (ekip_id) {
      query += ' WHERE b.ekip_id = $1';
      params.push(ekip_id);
    }
    
    query += ' GROUP BY b.id, e.ekip_adi ORDER BY b.olusturulma_tarihi DESC';
    
    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Branş detayı
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT b.*, e.ekip_adi
      FROM branslar b
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      WHERE b.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('Branş bulunamadı', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Yeni branş oluştur (Sadece admin)
router.post('/', [
  authenticate,
  authorize('admin'),
  body('brans_adi').trim().notEmpty().withMessage('Branş adı gerekli'),
  body('ekip_id').isInt().withMessage('Geçerli bir ekip seçin')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { brans_adi, ekip_id, aciklama } = req.body;

    const result = await pool.query(
      'INSERT INTO branslar (brans_adi, ekip_id, aciklama) VALUES ($1, $2, $3) RETURNING *',
      [brans_adi, ekip_id, aciklama]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      next(new AppError('Bu ekipte aynı isimde branş zaten var', 400));
    } else {
      next(error);
    }
  }
});

// Branş güncelle (Sadece admin)
router.put('/:id', [
  authenticate,
  authorize('admin'),
  body('brans_adi').trim().notEmpty().withMessage('Branş adı gerekli')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { brans_adi, aciklama } = req.body;

    const result = await pool.query(
      'UPDATE branslar SET brans_adi = $1, aciklama = $2 WHERE id = $3 RETURNING *',
      [brans_adi, aciklama, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Branş bulunamadı', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Branş sil (Sadece admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM branslar WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Branş bulunamadı', 404);
    }

    res.json({
      success: true,
      message: 'Branş silindi'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
