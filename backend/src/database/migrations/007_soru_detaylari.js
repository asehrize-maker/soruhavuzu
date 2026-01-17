import pool from '../../config/database.js';

export const addSoruDetaylari = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add Image Position
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS fotograf_konumu VARCHAR(20) DEFAULT 'ust' CHECK (fotograf_konumu IN ('ust', 'alt', 'sol', 'sag'))
    `);

        // Add Options
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS secenek_a TEXT,
      ADD COLUMN IF NOT EXISTS secenek_b TEXT,
      ADD COLUMN IF NOT EXISTS secenek_c TEXT,
      ADD COLUMN IF NOT EXISTS secenek_d TEXT,
      ADD COLUMN IF NOT EXISTS secenek_e TEXT,
      ADD COLUMN IF NOT EXISTS dogru_cevap VARCHAR(1) CHECK (dogru_cevap IN ('A', 'B', 'C', 'D', 'E'))
    `);

        await client.query('COMMIT');
        console.log('✅ Soru detayları (seçenekler ve görsel konumu) sütunları eklendi');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Soru detayları migration hatası:', error);
        throw error;
    } finally {
        client.release();
    }
};
