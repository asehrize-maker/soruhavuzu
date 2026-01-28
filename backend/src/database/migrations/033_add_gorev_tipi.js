import pool from '../../config/database.js';

export const addGorevTipiToDenemeler = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if column exists first
        const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='deneme_takvimi' AND column_name='gorev_tipi'
    `);

        if (checkColumn.rowCount === 0) {
            await client.query(`
        ALTER TABLE deneme_takvimi 
        ADD COLUMN gorev_tipi VARCHAR(50) DEFAULT 'deneme'
      `);
            console.log('Migration 033: gorev_tipi column added to deneme_takvimi');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 033 failed:', err);
        throw err;
    } finally {
        client.release();
    }
};
