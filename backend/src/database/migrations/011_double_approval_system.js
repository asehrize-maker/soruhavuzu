import pool from '../../config/database.js';

export const doubleApprovalSystem = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. sorular tablosuna onay kolonlarını ekle
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS onay_alanci BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS onay_dilci BOOLEAN DEFAULT FALSE;
    `);

        // 2. soru_revize_notlari tablosunu oluştur
        await client.query(`
      CREATE TABLE IF NOT EXISTS soru_revize_notlari (
        id SERIAL PRIMARY KEY,
        soru_id INTEGER REFERENCES sorular(id) ON DELETE CASCADE,
        kullanici_id INTEGER REFERENCES kullanicilar(id),
        secilen_metin TEXT NOT NULL,
        not_metni TEXT NOT NULL,
        inceleme_turu VARCHAR(20) NOT NULL CHECK (inceleme_turu IN ('alanci', 'dilci')),
        cozuldu BOOLEAN DEFAULT FALSE,
        tarih TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await client.query('COMMIT');
        console.log('Migration 011_double_approval_system applied successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration 011_double_approval_system failed:', err);
        throw err;
    } finally {
        client.release();
    }
};
