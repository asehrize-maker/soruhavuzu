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

export const fixSorularDurumConstraint = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check`);

    const quoted = DURUM_LISTESI.map(s => `'${s}'`).join(',');
    await client.query(`
      ALTER TABLE sorular
      ADD CONSTRAINT sorular_durum_check
      CHECK (TRIM(LOWER(durum)) IN (${quoted}))
    `);

    await client.query('COMMIT');
    console.log('Migration 014_fix_sorular_durum_constraint applied (genişletilmiş liste)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 014_fix_sorular_durum_constraint failed:', err);
    throw err;
  } finally {
    client.release();
  }
};
