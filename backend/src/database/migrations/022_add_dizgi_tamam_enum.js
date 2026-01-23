import pool from '../../config/database.js';

export const addDizgiTamamStatus = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔄 Constraint güncellemesi: dizgi_tamam ekleniyor...');

        // 1. Mevcut Constraint'i Bul
        const constraintCheck = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as def
            FROM pg_constraint 
            WHERE conrelid = 'sorular'::regclass AND contype = 'c' AND conname LIKE '%durum%'
        `);

        // 2. Constraint'leri Kaldır
        if (constraintCheck.rows.length > 0) {
            for (const row of constraintCheck.rows) {
                console.log(`Dropping constraint: ${row.conname}`);
                await client.query(`ALTER TABLE sorular DROP CONSTRAINT "${row.conname}"`);
            }
        }

        // 3. Yeni Constraint'i Ekle (dizgi_tamam dahil)
        await client.query(`
            ALTER TABLE sorular 
            ADD CONSTRAINT sorular_durum_check 
            CHECK (durum IN (
                'beklemede',
                'inceleme_bekliyor',
                'revize_istendi',
                'revize_gerekli',
                'dizgi_bekliyor',
                'dizgide',
                'dizgi_tamam', -- YENİ EKLENEN
                'inceleme_tamam',
                'tamamlandi',
                'arsiv'
            ))
        `);

        await client.query('COMMIT');
        console.log('✅ Status constraint güncellendi (dizgi_tamam eklendi)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Error (addDizgiTamamStatus):', error);
        throw error;
    } finally {
        client.release();
    }
};
