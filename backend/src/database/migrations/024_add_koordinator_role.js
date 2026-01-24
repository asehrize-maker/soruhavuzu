import pool from '../../config/database.js';

export const addKoordinatorRole = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Rol constraint güncelle
        await client.query(`
      ALTER TABLE kullanicilar
      DROP CONSTRAINT IF EXISTS kullanicilar_rol_check
    `);

        await client.query(`
      ALTER TABLE kullanicilar
      ADD CONSTRAINT kullanicilar_rol_check
      CHECK (rol IN ('admin', 'soru_yazici', 'dizgici', 'incelemeci', 'koordinator'))
    `);

        await client.query('COMMIT');
        console.log('Migration 024_add_koordinator_role applied successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 024_add_koordinator_role failed:', err);
        throw err;
    } finally {
        client.release();
    }
};
