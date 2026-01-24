import pool from '../../config/database.js';

export const updateZorlukSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔄 Zorluk seviyesi şeması güncelleniyor (Migration 021)...');

        // 1. Veri Temizliği ve Dönüşüm Hazırlığı
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '1' WHERE zorluk_seviyesi = 'kolay'`);
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '3' WHERE zorluk_seviyesi = 'orta'`);
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '5' WHERE zorluk_seviyesi = 'zor'`);

        // Sayı olmayan diğer değerleri varsayılan '3' yap (Veri bütünlüğü için)
        // Regex: Sadece rakamlardan oluşmuyorsa
        await client.query(`UPDATE sorular SET zorluk_seviyesi = '3' WHERE zorluk_seviyesi IS NOT NULL AND zorluk_seviyesi !~ '^[0-9]+$'`);

        // 2. Constraint'leri Bul ve Kaldır (Information Schema kullanımı daha güvenli)
        const findConstraintsVars = await client.query(`
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name 
            WHERE tc.table_name = 'sorular' 
              AND ccu.column_name = 'zorluk_seviyesi' 
              AND tc.constraint_type = 'CHECK'
        `);

        if (findConstraintsVars.rows.length > 0) {
            for (const row of findConstraintsVars.rows) {
                console.log(`Checking constraint dropping: ${row.constraint_name}`);
                await client.query(`ALTER TABLE sorular DROP CONSTRAINT "${row.constraint_name}"`);
            }
        }

        // Ekstra Güvenlik: pg_constraint tablosundan da kontrol et (Bazı durumlarda info schema yetmeyebilir)
        const pgConstraints = await client.query(`
             SELECT conname FROM pg_constraint 
             WHERE conrelid = 'sorular'::regclass AND contype = 'c' AND conname LIKE '%zorluk%'
        `);

        for (const row of pgConstraints.rows) {
            // Zaten silinmiş olabilir, hata verirse yoksay
            try {
                await client.query(`ALTER TABLE sorular DROP CONSTRAINT "${row.conname}"`);
                console.log(`Dropped pg_constraint: ${row.conname}`);
            } catch (e) { /* Zaten silinmiş */ }
        }


        // 3. Kolon tipini INTEGER'a çevir
        // Önce kolon var mı kontrol et
        const columnCheck = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'sorular' AND column_name = 'zorluk_seviyesi'
        `);

        if (columnCheck.rows.length > 0) {
            const currentType = columnCheck.rows[0].data_type;
            if (currentType !== 'integer') {
                console.log('Changing column type to integer...');
                await client.query(`
                    ALTER TABLE sorular 
                    ALTER COLUMN zorluk_seviyesi TYPE INTEGER USING zorluk_seviyesi::integer
                `);
            }
        } else {
            // Kolon yoksa oluştur (Backup case)
            await client.query(`ALTER TABLE sorular ADD COLUMN zorluk_seviyesi INTEGER DEFAULT 3`);
        }

        await client.query('COMMIT');
        console.log('✅ Zorluk seviyesi şeması başarıyla güncellendi (1-5 integer)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Zorluk schema update hatası:', error);
        // Hata kritik, fırlatmalıyız ki migration dursun
        throw error;
    } finally {
        client.release();
    }
};
