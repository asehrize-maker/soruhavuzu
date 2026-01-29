import express from 'express';
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Admin veya Koordinatör: yeni kullanıcı oluştur
router.post('/admin-create', authenticate, authorize(['admin', 'koordinator']), async (req, res, next) => {
  try {
    const isKoordinator = req.user.rol === 'koordinator';
    const { ad_soyad, email, sifre, rol, ekip_id, brans_id, inceleme_alanci, inceleme_dilci, brans_ids } = req.body;

    if (!ad_soyad || !email || !sifre || !rol) {
      throw new AppError('ad_soyad, email, sifre ve rol zorunludur', 400);
    }

    // Koordinatör admin oluşturamaz
    if (isKoordinator && rol === 'admin') {
      throw new AppError('Yetkiniz personeli admin yapmaya yetmiyor', 403);
    }

    const emailCheck = await pool.query('SELECT id FROM kullanicilar WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      throw new AppError('Bu email zaten kayıtlı', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(sifre, salt);

    const isIncelemeci = rol === 'incelemeci';
    const flagAlan = isIncelemeci ? !!inceleme_alanci : false;
    const flagDil = isIncelemeci ? !!inceleme_dilci : false;

    // Koordinatör sadece kendi ekibine ekleyebilir
    const finalEkipId = isKoordinator ? req.user.ekip_id : (ekip_id ? parseInt(ekip_id) : null);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insert = await client.query(
        `INSERT INTO kullanicilar (ad_soyad, email, sifre, rol, ekip_id, brans_id, inceleme_alanci, inceleme_dilci)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [ad_soyad, email, hashed, rol, finalEkipId, brans_id || null, flagAlan, flagDil]
      );

      const userId = insert.rows[0].id;

      // Çoklu branş ataması
      if (brans_ids && Array.isArray(brans_ids)) {
        for (const bId of brans_ids) {
          if (bId) {
            await client.query(
              'INSERT INTO kullanici_branslari (kullanici_id, brans_id) VALUES ($1, $2)',
              [userId, bId]
            );
          }
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Kullanıcı oluşturuldu',
        data: { id: userId, ad_soyad, email, rol }
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

// Tüm kullanıcıları getir (Admin veya Koordinatör)
router.get('/', authenticate, authorize(['admin', 'koordinator']), async (req, res, next) => {
  try {
    const isKoordinator = req.user.rol === 'koordinator';
    let query = `
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
    `;

    const params = [];
    if (isKoordinator) {
      query += ' WHERE k.ekip_id = $1';
      params.push(req.user.ekip_id);
    }

    query += ' ORDER BY k.olusturulma_tarihi DESC';
    const result = await pool.query(query, params);

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
    const isKoordinator = req.user.rol === 'koordinator';

    // Admin değilse sadece kendi bilgisini veya ekibindeki personeli görebilir
    if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
      if (!isKoordinator) {
        throw new AppError('Bu bilgilere erişim yetkiniz yok', 403);
      }
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

    const targetUser = result.rows[0];
    if (isKoordinator && targetUser.ekip_id !== req.user.ekip_id && req.user.id !== parseInt(id)) {
      throw new AppError('Başka ekipten personeli görüntüleyemezsiniz', 403);
    }

    res.json({
      success: true,
      data: targetUser
    });
  } catch (error) {
    next(error);
  }
});

// Kullanıcı güncelle (Admin, Koordinatör veya kendi bilgisi)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const isKoordinator = req.user.rol === 'koordinator';

    if (req.user.rol !== 'admin' && req.user.id !== parseInt(id) && !isKoordinator) {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }

    const { ad_soyad, email, ekip_id, brans_id, brans_ids, aktif } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentUserRes = await client.query('SELECT rol, email, ekip_id FROM kullanicilar WHERE id = $1', [id]);
      if (currentUserRes.rows.length === 0) {
        throw new AppError('Kullanıcı bulunamadı', 404);
      }

      const targetUser = currentUserRes.rows[0];
      const currentRole = targetUser.rol;
      const currentEmail = targetUser.email;

      if (isKoordinator && targetUser.ekip_id !== req.user.ekip_id && req.user.id !== parseInt(id)) {
        throw new AppError('Sadece kendi ekibinizdeki personeli güncelleyebilirsiniz', 403);
      }

      if (currentEmail === 'servetgenc@windowslive.com') {
        if (req.body.rol && req.body.rol !== 'admin') {
          throw new AppError('Bu kullanıcının yetkisi değiştirilemez (Süper Admin)', 403);
        }
        if (aktif === false) {
          throw new AppError('Bu kullanıcı pasife alınamaz (Süper Admin)', 403);
        }
      }

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

      if (req.user.rol === 'admin' || isKoordinator) {
        if (req.user.rol === 'admin' && ekip_id !== undefined) {
          updates.push(`ekip_id = $${paramCount++}`);
          values.push((ekip_id === '' || ekip_id === null) ? null : parseInt(ekip_id));
        }

        if (req.body.rol) {
          if (isKoordinator && req.body.rol === 'admin') {
            throw new AppError('Koordinatör personeli admin yapamaz', 403);
          }
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

        if (brans_ids !== undefined && Array.isArray(brans_ids)) {
          await client.query('DELETE FROM kullanici_branslari WHERE kullanici_id = $1', [id]);
          for (const bId of brans_ids) {
            if (bId) {
              await client.query(
                'INSERT INTO kullanici_branslari (kullanici_id, brans_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [id, bId]
              );
            }
          }
          if (brans_ids.length > 0 && brans_ids[0]) {
            updates.push(`brans_id = $${paramCount++}`);
            values.push(brans_ids[0]);
          } else {
            updates.push(`brans_id = $${paramCount++}`);
            values.push(null);
          }
        } else if (brans_id !== undefined) {
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
      } else {
        result = await client.query(
          'SELECT id, ad_soyad, email, rol, inceleme_alanci, inceleme_dilci, ekip_id, brans_id, aktif FROM kullanicilar WHERE id = $1',
          [id]
        );
      }

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

// Kullanıcı sil (Admin veya Koordinatör-Ekip)
router.delete('/:id', authenticate, authorize(['admin', 'koordinator']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const isKoordinator = req.user.rol === 'koordinator';

    const checkUser = await pool.query('SELECT email, ekip_id FROM kullanicilar WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    const targetUser = checkUser.rows[0];

    if (targetUser.email === 'servetgenc@windowslive.com') {
      throw new AppError('Bu kullanıcı silinemez (Süper Admin)', 403);
    }

    if (isKoordinator && targetUser.ekip_id !== req.user.ekip_id) {
      throw new AppError('Sadece kendi ekibinizdeki personeli silebilirsiniz', 403);
    }

    await pool.query('DELETE FROM kullanicilar WHERE id = $1', [id]);
    res.json({ success: true, message: 'Kullanıcı silindi' });
  } catch (error) {
    next(error);
  }
});

// Bilgi loglarını getir (Sadece admin)
router.get('/logs/login', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT g.*, k.ad_soyad, k.email, k.rol
      FROM giris_loglari g
      LEFT JOIN kullanicilar k ON g.kullanici_id = k.id
      ORDER BY g.tarih DESC
      LIMIT 200
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Aktivite loglarını getir (Admin veya Koordinatör-Ekip)
router.get('/logs/activity', authenticate, authorize(['admin', 'koordinator']), async (req, res, next) => {
  try {
    const isKoordinator = req.user.rol === 'koordinator';
    let query = `
      SELECT a.*, k.ad_soyad, k.email, k.rol
      FROM aktivite_loglari a
      LEFT JOIN kullanicilar k ON a.kullanici_id = k.id
    `;
    const params = [];
    if (isKoordinator) {
      query += ' WHERE k.ekip_id = $1';
      params.push(req.user.ekip_id);
    }
    query += ' ORDER BY a.tarih DESC LIMIT 200';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Ajanda/Aktivite istatistiklerini getir
router.get('/stats/agenda', authenticate, authorize(['admin', 'koordinator']), async (req, res, next) => {
  try {
    const isKoordinator = req.user.rol === 'koordinator';
    let query = `
      SELECT 
        DATE(a.tarih) as tarih,
        COUNT(*) FILTER (WHERE a.islem_turu = 'soru_ekleme') as soru_ekleme,
        COUNT(*) FILTER (WHERE a.islem_turu = 'durum_degisikligi') as durum_degisikligi,
        COUNT(*) FILTER (WHERE a.islem_turu = 'dizgi_yukleme' OR a.islem_turu = 'dizgi_bitirme') as dizgi_isleri,
        COUNT(*) FILTER (WHERE a.islem_turu = 'soru_silme') as soru_silme,
        COUNT(*) as toplam_aktivite
      FROM aktivite_loglari a
      LEFT JOIN kullanicilar k ON a.kullanici_id = k.id
      WHERE a.tarih >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const params = [];
    if (isKoordinator) {
      query += ' AND k.ekip_id = $1';
      params.push(req.user.ekip_id);
    }
    query += ' GROUP BY DATE(a.tarih) ORDER BY DATE(a.tarih) DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Sistem ayarlarını getir (Sadece admin)
router.get('/settings/all', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM sistem_ayarlari ORDER BY anahtar');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Sistem ayarlarını güncelle (Sadece admin)
router.put('/settings/update', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { ayarlar } = req.body;
    if (!Array.isArray(ayarlar)) {
      throw new AppError('Ayarlar listesi gerekli', 400);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const ayar of ayarlar) {
        await client.query(
          'UPDATE sistem_ayarlari SET deger = $1, guncellenme_tarihi = CURRENT_TIMESTAMP WHERE anahtar = $2',
          [ayar.deger, ayar.anahtar]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'Ayarlar güncellendi' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
