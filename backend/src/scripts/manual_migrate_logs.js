import pool from '../config/database.js';

const runMigration = async () => {
    const client = await pool.connect();
    try {
        console.log('Migration başlıyor: add_aktivite_loglari');
        await client.query('BEGIN');

        // Tabloyu oluştur
        await client.query(`
      CREATE TABLE IF NOT EXISTS aktivite_loglari (
        id SERIAL PRIMARY KEY,
        kullanici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
        soru_id INTEGER REFERENCES sorular(id) ON DELETE SET NULL,
        islem_turu VARCHAR(50) NOT NULL,
        aciklama TEXT NOT NULL,
        detay JSONB,
        tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Indexler
        await client.query(`CREATE INDEX IF NOT EXISTS idx_aktivite_tarih ON aktivite_loglari(tarih);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_aktivite_kullanici ON aktivite_loglari(kullanici_id);`);

        await client.query('COMMIT');
        console.log('Migration tamamlandı.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration hatası:', err);
    } finally {
        client.release();
        process.exit();
    }
};

runMigration();
