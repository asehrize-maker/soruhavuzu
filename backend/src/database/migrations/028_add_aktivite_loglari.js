import pool from '../../config/database.js';

export const addAktiviteLoglari = async () => {
    try {
        // Create aktivite_loglari table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS aktivite_loglari (
        id SERIAL PRIMARY KEY,
        kullanici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
        soru_id INTEGER REFERENCES sorular(id) ON DELETE SET NULL,
        islem_turu VARCHAR(50) NOT NULL,
        aciklama TEXT NOT NULL,
        detay JSONB,
        tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_aktivite_tarih ON aktivite_loglari(tarih)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_aktivite_kullanici ON aktivite_loglari(kullanici_id)`);

        console.log('✅ aktivite_loglari tablosu hazır.');
    } catch (error) {
        console.error('❌ aktivite_loglari tablosu oluşturulurken hata:', error.message);
    }
};
