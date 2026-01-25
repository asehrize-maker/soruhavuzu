import pool from '../../config/database.js';

const DURUM_LISTESI = [
  'beklemede',
  'dizgi_bekliyor',
  'dizgide',
  'dizgi_tamam',
  'alan_incelemede',
  'alan_onaylandi',
  'dil_incelemede',
  'dil_onaylandi',
  'revize_istendi',
  'revize_gerekli',
  'inceleme_bekliyor',
  'incelemede',
  'inceleme_tamam',
  'tamamlandi',
  'arsiv'
];

export const addDizgiTamamStatus = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('⚙️ Constraint güncellemesi: dizgi_tamam ve genişletilmiş liste uygulanıyor...');

    // Mevcut constraint'leri kaldır
    const constraintCheck = await client.query(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'sorular'::regclass AND contype = 'c' AND conname LIKE '%durum%'
    `);

    if (constraintCheck.rows.length > 0) {
      for (const row of constraintCheck.rows) {
        console.log(`Dropping constraint: ${row.conname}`);
        await client.query(`ALTER TABLE sorular DROP CONSTRAINT "${row.conname}"`);
      }
    }

    // Yeni constraint
    const quoted = DURUM_LISTESI.map(s => `'${s}'`).join(',');
    await client.query(`
      ALTER TABLE sorular 
      ADD CONSTRAINT sorular_durum_check 
      CHECK (TRIM(LOWER(durum)) IN (${quoted}))
    `);

    await client.query('COMMIT');
    console.log('✅ Status constraint güncellendi (dizgi_tamam + alan/dil aşamaları dahil)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration Error (addDizgiTamamStatus):', error);
    throw error;
  } finally {
    client.release();
  }
};
