import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugQuestions() {
    try {
        console.log('--- TÜM SORULARIN DURUMU VE BRANŞI ---');
        const res = await pool.query(`
            SELECT s.id, s.durum, b.brans_adi, k.ad_soyad as yazar
            FROM sorular s 
            LEFT JOIN branslar b ON s.brans_id = b.id
            LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
            ORDER BY s.id DESC 
            LIMIT 20
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugQuestions();
