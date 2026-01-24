
import pool from './src/config/database.js';

async function checkSchema() {
    try {
        const client = await pool.connect();

        console.log("--- DB Şema Kontrolü ---");

        // 1. Zorluk seviyesi kolon tipi
        const columnCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sorular' AND column_name = 'zorluk_seviyesi'
        `);
        console.log("Kolon Bilgisi:", columnCheck.rows[0]);

        // 2. Constraints
        const constraints = await client.query(`
             SELECT conname, contype, pg_get_constraintdef(oid)
             FROM pg_constraint 
             WHERE conrelid = 'sorular'::regclass AND contype = 'c'
        `);
        console.log("Check Constraints:", constraints.rows);

        client.release();
    } catch (e) {
        console.error("Hata:", e);
    } finally {
        pool.end();
    }
}

checkSchema();
