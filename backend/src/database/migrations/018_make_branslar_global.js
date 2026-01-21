import pool from '../config/database.js';

export const makeBranslarGlobal = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Branslar tablosundaki ekip_id kısıtlamasını kaldır
        await client.query(`
      ALTER TABLE branslar ALTER COLUMN ekip_id DROP NOT NULL;
    `);

        // 2. Mevcut kısıtlamaları temizle (brans_adi, ekip_id unique kısıtlaması gibi)
        // Önce kısıtlama ismini bulmaya çalışalım veya bilinen isimleri deneyelim
        await client.query(`
      ALTER TABLE branslar DROP CONSTRAINT IF EXISTS branslar_brans_adi_ekip_id_key;
    `);

        // 3. Branşları global yap (ekip_id = NULL)
        // Not: Eğer aynı isimde farklı ekiplerde branşlar varsa, 
        // bunları birleştirmek gerekebilir. Şimdilik sadece NULL yapıyoruz.
        await client.query(`
      UPDATE branslar SET ekip_id = NULL;
    `);

        // 4. Soru listeleme için kullanıcıların hangi ekipte olduğunu garantilemek adına 
        // kullanicilar tablosundaki ekip_id'nin NOT NULL olduğundan emin olalım (Opsiyonel ama iyi olur)
        // Ancak mevcut verilerde NULL olabilir, o yüzden şimdilik dokunmuyoruz.

        await client.query('COMMIT');
        console.log('✅ Migration 018: Branşlar globalleştirildi.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration 018 Hatası:', error);
        // Hata kritik değilse fırlatmayabiliriz ama burada şema değişikliği var.
        throw error;
    } finally {
        client.release();
    }
};
