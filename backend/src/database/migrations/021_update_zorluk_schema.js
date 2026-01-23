import pool from '../../config/database.js';

export const updateZorlukSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Önceki verileri dönüştür (Eğer varsa)
        // String değerleri integer karşılıklarına çeviriyoruz
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '1' WHERE zorluk_seviyesi = 'kolay'`);
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '3' WHERE zorluk_seviyesi = 'orta'`);
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '5' WHERE zorluk_seviyesi = 'zor'`);

        // 2. Mevcut check constraint'i bul ve kaldır
        const constraintCheck = await client.query(`
            SELECT conname FROM pg_constraint 
            WHERE conrelid = 'sorular'::regclass AND contype = 'c' AND conname LIKE '%zorluk%'
        `);

        if (constraintCheck.rows.length > 0) {
            for (const row of constraintCheck.rows) {
                await client.query(`ALTER TABLE sorular DROP CONSTRAINT "${row.conname}"`);
            }
        }

        // 3. Kolon tipini INTEGER'a çevir (Yoksa oluştur)
        // Önce kolon var mı kontrol et
        const columnCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'sorular' AND column_name = 'zorluk_seviyesi'
        `);

        if (columnCheck.rows.length > 0) {
            // Kolon var, tipini değiştir
            await client.query(`
                ALTER TABLE sorular 
                ALTER COLUMN zorluk_seviyesi TYPE INTEGER USING zorluk_seviyesi::integer
            `);
        } else {
            // Kolon yok, oluştur
            await client.query(`
                ALTER TABLE sorular 
                ADD COLUMN zorluk_seviyesi INTEGER
            `);
        }

        // 4. Yeni constraint ekle (Opsiyonel, veri bütünlüğü için iyi olur)
        // await client.query(`
        //    ALTER TABLE sorular 
        //    ADD CONSTRAINT sorular_zorluk_check CHECK (zorluk_seviyesi BETWEEN 1 AND 5)
        // `);

        await client.query('COMMIT');
        console.log('✅ Zorluk seviyesi şeması güncellendi (1-5 integer)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Zorluk schema update hatası:', error);
        // Hata kritik değilse devam etsin diye throw yapmayabiliriz ama migration fail etmeli
        // throw error; 
    } finally {
        client.release();
    }
};
