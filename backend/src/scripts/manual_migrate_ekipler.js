import pool from '../config/database.js';

const runMigration = async () => {
    const client = await pool.connect();
    try {
        console.log('Migration başlıyor: add_kullanici_ekipleri');
        await client.query('BEGIN');

        // 1. Tabloyu oluştur
        await client.query(`
      CREATE TABLE IF NOT EXISTS kullanici_ekipleri (
        id SERIAL PRIMARY KEY,
        kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE ON UPDATE CASCADE,
        ekip_id INTEGER NOT NULL REFERENCES ekipler(id) ON DELETE CASCADE ON UPDATE CASCADE,
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_kullanici_ekip UNIQUE (kullanici_id, ekip_id)
      );
    `);

        // 2. Mevcut verileri taşı
        await client.query(`
      INSERT INTO kullanici_ekipleri (kullanici_id, ekip_id)
      SELECT id, ekip_id FROM kullanicilar WHERE ekip_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

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
