import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Tüm kullanıcıları getir (Sadece admin)
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT k.id, k.ad_soyad, k.email, k.rol, k.inceleme_alanci, k.inceleme_dilci, k.aktif,
             k.ekip_id, e.ekip_adi,
             k.brans_id, b.brans_adi,
             k.olusturulma_tarihi,
             COALESCE(
               (SELECT json_agg(json_build_object('id', kb.brans_id, 'brans_adi', br.brans_adi))
                FROM kullanici_branslari kb
                JOIN branslar br ON kb.brans_id = br.id
                WHERE kb.kullanici_id = k.id),
               '[]'
             ) as branslar
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
      SELECT k.id, k.ad_soyad, k.email, k.rol, k.inceleme_alanci, k.inceleme_dilci, k.aktif,
             k.ekip_id, e.ekip_adi,
             k.brans_id, b.brans_adi,
             k.olusturulma_tarihi,
             COALESCE(
               (SELECT json_agg(json_build_object('id', kb.brans_id, 'brans_adi', br.brans_adi))
                FROM kullanici_branslari kb
                JOIN branslar br ON kb.brans_id = br.id
                WHERE kb.kullanici_id = k.id),
               '[]'
             ) as branslar
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

    const { ad_soyad, email, ekip_id, brans_id, brans_ids, aktif } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentUserRes = await client.query('SELECT rol FROM kullanicilar WHERE id = $1', [id]);
      if (currentUserRes.rows.length === 0) {
        throw new AppError('KullanŽñcŽñ bulunamadŽñ', 404);
      }
      const currentRole = currentUserRes.rows[0].rol;

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
          values.push(ekip_id || null);
        }

        if (req.body.rol) {
          updates.push(`rol = $${paramCount++}`);
          values.push(req.body.rol);
        }

        const willBeRole = req.body.rol || currentRole;
        const hasAlan = Object.prototype.hasOwnProperty.call(req.body, 'inceleme_alanci');
        const hasDil = Object.prototype.hasOwnProperty.call(req.body, 'inceleme_dilci');

        if (willBeRole === 'incelemeci') {
          if (hasAlan) {
            updates.push(`inceleme_alanci = $${paramCount++}`);
            values.push(!!req.body.inceleme_alanci);
          }
          if (hasDil) {
            updates.push(`inceleme_dilci = $${paramCount++}`);
            values.push(!!req.body.inceleme_dilci);
          }
        } else if (currentRole === 'incelemeci' || req.body.rol) {
          updates.push(`inceleme_alanci = false`);
          updates.push(`inceleme_dilci = false`);
        }
        if (aktif !== undefined) {
          updates.push(`aktif = $${paramCount++}`);
          values.push(aktif);
        }

        // Çoklu branş ataması (sadece admin yapabilir)
        if (brans_ids !== undefined && Array.isArray(brans_ids)) {
          // Önce mevcut branşları sil
          await client.query('DELETE FROM kullanici_branslari WHERE kullanici_id = $1', [id]);

          // Yeni branşları ekle
          for (const bransId of brans_ids) {
            if (bransId) {
              await client.query(
                'INSERT INTO kullanici_branslari (kullanici_id, brans_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [id, bransId]
              );
            }
          }

          // İlk branşı eski alana da kaydet (geriye uyumluluk)
          if (brans_ids.length > 0 && brans_ids[0]) {
            updates.push(`brans_id = $${paramCount++}`);
            values.push(brans_ids[0]);
          } else {
            // Branş listesi boşsa brans_id'yi null yap
            updates.push(`brans_id = $${paramCount++}`);
            values.push(null);
          }
        } else if (brans_id !== undefined) {
          // Eski tek branş alanını güncelle (brans_ids yoksa)
          updates.push(`brans_id = $${paramCount++}`);
          values.push(brans_id || null);
        }
      }

      let result;
      if (updates.length > 0) {
        values.push(id);
        result = await client.query(
          `UPDATE kullanicilar SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, ad_soyad, email, rol, inceleme_alanci, inceleme_dilci, ekip_id, brans_id, aktif`,
          values
        );

        if (result.rows.length === 0) {
          throw new AppError('Kullanıcı bulunamadı', 404);
        }
      } else {
        // Sadece branş güncellemesi yapıldıysa
        result = await client.query(
          'SELECT id, ad_soyad, email, rol, inceleme_alanci, inceleme_dilci, ekip_id, brans_id, aktif FROM kullanicilar WHERE id = $1',
          [id]
        );
      }

      // Güncellenmiş branşları getir
      const bransResult = await client.query(`
        SELECT kb.brans_id as id, b.brans_adi
        FROM kullanici_branslari kb
        JOIN branslar b ON kb.brans_id = b.id
        WHERE kb.kullanici_id = $1
      `, [id]);

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          branslar: bransResult.rows
        }
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
