import pool from './src/config/database.js';

async function checkUploads() {
    try {
        const result = await pool.query('SELECT * FROM deneme_yuklemeleri ORDER BY id DESC LIMIT 5');
        console.log('--- SON 5 YÜKLEME ---');
        console.table(result.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUploads();
