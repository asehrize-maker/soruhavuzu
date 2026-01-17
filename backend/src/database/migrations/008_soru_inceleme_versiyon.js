import pool from '../../config/database.js';

export const addSoruIncelemeVeVersiyon = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Sorular tablosuna versiyon sütunu ekle
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS versiyon INTEGER DEFAULT 1
    `);

        // 2. Soru Versiyonları tablosu (Değişiklik geçmişi için)
        await client.query(`
      CREATE TABLE IF NOT EXISTS soru_versiyonlari (
        id SERIAL PRIMARY KEY,
        soru_id INTEGER REFERENCES sorular(id) ON DELETE CASCADE,
        versiyon_no INTEGER NOT NULL,
        data JSONB NOT NULL, -- Sorunun o anki tüm verisi (backup)
        degistiren_kullanici_id INTEGER REFERENCES kullanicilar(id),
        degisim_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        degisim_aciklamasi TEXT
      )
    `);

        // 3. Soru Yorumları tablosu (İnceleme notları için)
        await client.query(`
      CREATE TABLE IF NOT EXISTS soru_yorumlari (
        id SERIAL PRIMARY KEY,
        soru_id INTEGER REFERENCES sorular(id) ON DELETE CASCADE,
        kullanici_id INTEGER REFERENCES kullanicilar(id),
        yorum_metni TEXT NOT NULL,
        tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        okundu BOOLEAN DEFAULT FALSE
      )
    `);

        await client.query('COMMIT');
        console.log('✅ Soru inceleme ve versiyon sistemi tabloları oluşturuldu');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Soru inceleme migration hatası:', error);
        throw error;
    } finally {
        client.release();
    }
};
