import pool from '../../config/database.js';

// En geniş ve nihai durum listesi (workflow v2 + dizgi_tamam)
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

export const ultimateDurumFix = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🚀 ULTIMATE DURUM FIX: Cleaning all previous constraints on column "durum"...');

    // Column-specific constraint lookup
    const query = `
      SELECT conname FROM pg_constraint 
      JOIN pg_attribute ON pg_attribute.attrelid = pg_constraint.conrelid 
        AND pg_attribute.attnum = ANY(pg_constraint.conkey) 
      WHERE pg_constraint.contype = 'c' 
        AND pg_constraint.conrelid = 'sorular'::regclass 
        AND pg_attribute.attname = 'durum'
    `;

    const constraints = await client.query(query);

    for (const row of constraints.rows) {
      console.log('Dropping constraint: ' + row.conname);
      await client.query('ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "' + row.conname + '"');
    }

    // Add the definitive constraint
    const quoted = DURUM_LISTESI.map(s => `'${s}'`).join(',');
    await client.query(`
      ALTER TABLE sorular 
      ADD CONSTRAINT sorular_durum_check 
      CHECK (TRIM(LOWER(durum)) IN (${quoted}))
    `);

    await client.query('COMMIT');
    console.log('✅ ULTIMATE DURUM FIX applied successfully with ' + constraints.rows.length + ' constraints dropped.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ULTIMATE DURUM FIX failed:', error);
    throw error;
  } finally {
    client.release();
  }
};
