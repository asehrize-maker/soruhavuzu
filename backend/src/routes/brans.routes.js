import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import xlsx from 'xlsx';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const query = `
      SELECT b.*,
             COUNT(DISTINCT s.id) as soru_sayisi
      FROM branslar b
      LEFT JOIN sorular s ON b.id = s.brans_id
      GROUP BY b.id
      ORDER BY b.brans_adi ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT b.*
      FROM branslar b
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

router.post('/', [
  authenticate,
  authorize('admin'),
  body('brans_adi').trim().notEmpty().withMessage('Branş adı gerekli')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { brans_adi, aciklama } = req.body;

    const result = await pool.query(
      'INSERT INTO branslar (brans_adi, aciklama) VALUES ($1, $2) RETURNING *',
      [brans_adi, aciklama]
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

// Branş kazanımları listele
router.get('/:id/kazanimlar', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, kod, aciklama, created_at FROM brans_kazanimlar WHERE brans_id = $1 ORDER BY kod ASC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Excel ile kazanım import (Sadece admin)
router.post('/:id/kazanim-import', authenticate, authorize('admin'), upload.single('file'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) throw new AppError('Excel dosyası yüklenmedi', 400);

    const bransCheck = await pool.query('SELECT id FROM branslar WHERE id = $1', [id]);
    if (bransCheck.rows.length === 0) throw new AppError('Branş bulunamadı', 404);

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Get raw rows including headers to detect format
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`DEBUG: Kazanım Import - Raw Rows Count: ${rawRows.length}`);

    if (!rawRows.length) throw new AppError('Excel sayfası boş', 400);

    const client = await pool.connect();
    let inserted = 0;
    let skipped = 0;
    try {
      await client.query('BEGIN');

      for (const row of rawRows) {
        let kod = '';
        let aciklama = '';

        if (Array.isArray(row) && row.length > 0) {
          const col1 = String(row[0] || '').trim();
          const col2 = row.length > 1 ? String(row[1] || '').trim() : '';

          if (!col1 && !col2) {
            skipped++;
            continue;
          }

          const col1Lower = col1.toLowerCase();
          const col2Lower = col2.toLowerCase();
          if (col1Lower === 'kod' || col1Lower === 'kazanım kodu' || col2Lower === 'aciklama' || col2Lower === 'açıklama') {
            continue;
          }

          if (col1 && !col2) {
            // Tek kolon: kod + açıklama aynı hücrede olabilir
            const match = col1.match(/^([A-ZŞĞÜİÖÇ0-9.]+)\.?\s+(.+)$/i);
            if (match) {
              kod = match[1];
              aciklama = match[2];
            } else {
              kod = col1;
              aciklama = col1;
            }
          } else if (col1 && col2) {
            kod = col1;
            aciklama = col2 || col1;
          } else if (!col1 && col2) {
            kod = col2;
            aciklama = col2;
          }
        } else if (typeof row === 'object' && row !== null) {
          kod = String(row.kod || row.Kod || row.KOD || row.kazanim || row.Kazanim || row.KAZANIM || '').trim();
          aciklama = String(row.aciklama || row.Açıklama || row.ACIKLAMA || row.aciklama || '').trim();

          if (!kod && aciklama) kod = aciklama;
          if (kod && !aciklama) aciklama = kod;

          if (!kod && !aciklama) {
            const firstValue = Object.values(row)
              .map(v => (v === undefined || v === null ? '' : String(v).trim()))
              .find(Boolean) || '';
            if (firstValue) {
              kod = firstValue;
              aciklama = firstValue;
            }
          }
        }

        if (!kod) {
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO brans_kazanimlar (brans_id, kod, aciklama) 
                     VALUES ($1, $2, $3) 
                     ON CONFLICT (brans_id, kod) WHERE kod IS NOT NULL 
                     DO UPDATE SET aciklama = EXCLUDED.aciklama`,
          [id, kod || null, aciklama]
        );
        inserted++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('DEBUG: Kazanim Import Error:', err);
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      data: { inserted, skipped, total: rawRows.length },
      message: `Kazanım import tamamlandı. Eklenen/Güncellenen: ${inserted}, atlanan: ${skipped}`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
