import pool from '../../config/database.js';

export const addIncelemeFlags = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Kolonları güvenli şekilde ekle
    await client.query(`
      ALTER TABLE kullanicilar
      ADD COLUMN IF NOT EXISTS inceleme_alanci BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS inceleme_dilci BOOLEAN DEFAULT false
    `);

    // Eski rol isimlerinden dönüşüm (varsa)
    await client.query(`
      UPDATE kullanicilar
      SET rol = 'incelemeci', inceleme_alanci = true
      WHERE rol = 'alan_incelemeci'
    `);

    await client.query(`
      UPDATE kullanicilar
      SET rol = 'incelemeci', inceleme_dilci = true
      WHERE rol = 'dil_incelemeci'
    `);

    // İncelemeci olmayanlarda alt flag'leri sıfırla
    await client.query(`
      UPDATE kullanicilar
      SET inceleme_alanci = false, inceleme_dilci = false
      WHERE rol <> 'incelemeci'
    `);

    await client.query('COMMIT');
    console.log('Migration 016_add_inceleme_flags applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 016_add_inceleme_flags failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

