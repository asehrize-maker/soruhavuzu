import pool from './backend/src/config/database.js';
async function debug() {
    try {
        const res = await pool.query('SELECT id, durum, brans_id, olusturan_kullanici_id FROM sorular');
        console.log('--- DB DUMP START ---');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('--- DB DUMP END ---');
        const genel = await pool.query('SELECT COUNT(*) FROM sorular');
        console.log('Genel Count:', genel.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
debug();
