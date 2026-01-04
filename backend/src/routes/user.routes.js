import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Tüm kullanıcıları getir (Sadece admin)
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT k.id, k.ad_soyad, k.email, k.rol, k.aktif,
             k.ekip_id, e.ekip_adi,
             k.brans_id, b.brans_adi,
             k.olusturulma_tarihi
      FROM kullanicilar k
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN branslar b ON k.brans_id = b.id
      ORDER BY k.olusturulma_tarihi DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Kullanıcı detayı
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Admin değilse sadece kendi bilgisini görebilir
    if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
      throw new AppError('Bu bilgilere erişim yetkiniz yok', 403);
    }

    const result = await pool.query(`
      SELECT k.id, k.ad_soyad, k.email, k.rol, k.aktif,
             k.ekip_id, e.ekip_adi,
             k.brans_id, b.brans_adi,
             k.olusturulma_tarihi
      FROM kullanicilar k
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN branslar b ON k.brans_id = b.id
      WHERE k.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Kullanıcı güncelle (Admin veya kendi bilgisi)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Admin değilse sadece kendi bilgisini güncelleyebilir
    if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    const { ad_soyad, email, ekip_id, brans_id, aktif } = req.body;
    
    // Admin değilse aktif durumunu değiştiremez
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (ad_soyad) {
      updates.push(`ad_soyad = $${paramCount++}`);
      values.push(ad_soyad);
    }
    
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (req.user.rol === 'admin') {
      if (ekip_id !== undefined) {
        updates.push(`ekip_id = $${paramCount++}`);
        values.push(ekip_id);
      }
      if (brans_id !== undefined) {
        updates.push(`brans_id = $${paramCount++}`);
        values.push(brans_id);
      }
      if (aktif !== undefined) {
        updates.push(`aktif = $${paramCount++}`);
        values.push(aktif);
      }
    }

    if (updates.length === 0) {
      throw new AppError('Güncellenecek alan bulunamadı', 400);
    }

    values.push(id);
    
    const result = await pool.query(
      `UPDATE kullanicilar SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, ad_soyad, email, rol, ekip_id, brans_id, aktif`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Kullanıcı sil (Sadece admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM kullanicilar WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    res.json({
      success: true,
      message: 'Kullanıcı silindi'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
