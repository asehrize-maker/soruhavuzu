import pool from '../../config/database.js';

export const incelemeciRolVeAltRoller = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) İncelemeci alt-rolleri için kolonlar
    await client.query(`
      ALTER TABLE kullanicilar
      ADD COLUMN IF NOT EXISTS inceleme_alanci BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS inceleme_dilci BOOLEAN DEFAULT false
    `);

    // 2) Olası eski rollerden dönüşüm (varsa)
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

    // 3) Rol constraint güncelle
    await client.query(`
      ALTER TABLE kullanicilar
      DROP CONSTRAINT IF EXISTS kullanicilar_rol_check
    `);
    await client.query(`
      ALTER TABLE kullanicilar
      ADD CONSTRAINT kullanicilar_rol_check
      CHECK (rol IN ('admin', 'soru_yazici', 'dizgici', 'incelemeci'))
    `);

    // 4) İncelemeci olmayanlarda alt-rolleri sıfırla (tutarlılık)
    await client.query(`
      UPDATE kullanicilar
      SET inceleme_alanci = false, inceleme_dilci = false
      WHERE rol <> 'incelemeci'
    `);

    await client.query('COMMIT');
    console.log('Migration 012_incelemeci_rol_altroller applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 012_incelemeci_rol_altroller failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

