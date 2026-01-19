import pool from '../../config/database.js';

export const fixSorularDurumConstraint = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check`);

    await client.query(`
      ALTER TABLE sorular
      ADD CONSTRAINT sorular_durum_check
      CHECK (
        durum IN (
          'beklemede',
          'inceleme_bekliyor',
          'revize_istendi',
          'revize_gerekli',
          'dizgi_bekliyor',
          'dizgide',
          'inceleme_tamam',
          'tamamlandi',
          'arsiv'
        )
      )
    `);

    await client.query('COMMIT');
    console.log('Migration 014_fix_sorular_durum_constraint applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 014_fix_sorular_durum_constraint failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

