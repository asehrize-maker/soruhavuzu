import pool from '../../config/database.js';

export const createBransKazanimlar = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS brans_kazanimlar (
        id SERIAL PRIMARY KEY,
        brans_id INTEGER REFERENCES branslar(id) ON DELETE CASCADE,
        kod VARCHAR(100),
        aciklama TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brans_id, kod)
      )
    `);

    await client.query('COMMIT');
    console.log('Migration 013_brans_kazanimlar applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 013_brans_kazanimlar failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

