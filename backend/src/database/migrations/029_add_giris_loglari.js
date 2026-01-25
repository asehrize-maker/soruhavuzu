import pool from '../../config/database.js';

export const addGirisLoglari = async () => {
    try {
        // Create giris_loglari table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS giris_loglari (
        id SERIAL PRIMARY KEY,
        kullanici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
        ip_adresi VARCHAR(45),
        user_agent TEXT,
        tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Index for performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_giris_tarih ON giris_loglari(tarih)`);

        console.log('✅ giris_loglari tablosu hazır.');
    } catch (error) {
        console.error('❌ giris_loglari tablosu oluşturulurken hata:', error.message);
    }
};
