import pool from '../../config/database.js';

export const addLastSeenField = async () => {
    try {
        // Add son_gorulme column to kullanicilar table
        await pool.query(`
      ALTER TABLE kullanicilar 
      ADD COLUMN IF NOT EXISTS son_gorulme TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
        console.log('✅ son_gorulme sütunu kullanicilar tablosuna eklendi.');
    } catch (error) {
        console.error('❌ son_gorulme sütunu eklenirken hata:', error.message);
    }
};
