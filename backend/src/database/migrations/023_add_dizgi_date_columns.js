import pool from '../../config/database.js';

export const addDizgiDateColumns = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔄 Sütun kontrolü: dizgi_tamamlanma_tarihi ekleniyor...');

        // 1. dizgi_tamamlanma_tarihi (Esas kullanılan)
        await client.query(`
            ALTER TABLE sorular 
            ADD COLUMN IF NOT EXISTS dizgi_tamamlanma_tarihi TIMESTAMP
        `);

        // 2. dizgi_bitis_tarihi (Kodun bazı yerlerinde geçiyor olabilir, garanti olsun)
        await client.query(`
            ALTER TABLE sorular 
            ADD COLUMN IF NOT EXISTS dizgi_bitis_tarihi TIMESTAMP
        `);

        // 3. dizgi_baslama_tarihi (Yedekleme ve raporlamada geçiyor)
        await client.query(`
            ALTER TABLE sorular 
            ADD COLUMN IF NOT EXISTS dizgi_baslama_tarihi TIMESTAMP
        `);

        await client.query('COMMIT');
        console.log('✅ Soru tablosuna dizgi tarih kolonları eklendi');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Error (addDizgiDateColumns):', error);
        throw error;
    } finally {
        client.release();
    }
};
