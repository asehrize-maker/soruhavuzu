import pool from './src/config/database.js';

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. soru_revize_notlari tablosundaki inceleme_turu kısıtlamasını güncelle
        await client.query(`
      ALTER TABLE soru_revize_notlari DROP CONSTRAINT IF EXISTS soru_revize_notlari_inceleme_turu_check
    `);

        await client.query(`
      ALTER TABLE soru_revize_notlari 
      ADD CONSTRAINT soru_revize_notlari_inceleme_turu_check 
      CHECK (inceleme_turu IN ('alanci', 'dilci', 'admin'))
    `);

        await client.query('COMMIT');
        console.log('✅ Database constraints updated successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating database constraints:', e);
    } finally {
        client.release();
        process.exit();
    }
}

run();
