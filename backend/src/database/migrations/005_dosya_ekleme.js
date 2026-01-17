import pool from '../../config/database.js';

export const addDosyaFields = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Sorular tablosuna dosya alanları ekle
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS dosya_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS dosya_public_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS dosya_adi VARCHAR(255),
      ADD COLUMN IF NOT EXISTS dosya_boyutu INTEGER
    `);

        await client.query('COMMIT');
        console.log('✅ Dosya alanları sorular tablosuna eklendi');

    } catch (error) {
        await client.query('ROLLBACK');
        // Eğer sütunlar zaten varsa hata verme
        if (error.code === '42701') {
            console.log('ℹ️ Dosya alanları zaten mevcut');
        } else {
            console.error('❌ Dosya alanları ekleme hatası:', error);
            throw error;
        }
    } finally {
        client.release();
    }
};
