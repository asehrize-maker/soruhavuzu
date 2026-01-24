import pool from './backend/src/config/database.js';

async function checkQuestions() {
    try {
        const res = await pool.query('SELECT id, durum, brans_id, olusturan_kullanici_id, dizgici_id FROM sorular ORDER BY olusturulma_tarihi DESC LIMIT 10');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkQuestions();
