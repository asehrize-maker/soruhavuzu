import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debug() {
    try {
        const res = await pool.query('SELECT id, durum, dizgici_id, brans_id FROM sorular WHERE durum IN (\'dizgi_bekliyor\', \'revize_istendi\', \'dizgide\') ORDER BY guncellenme_tarihi DESC LIMIT 20');
        console.log('--- SON DİZGİ HAREKETLERİ ---');
        console.table(res.rows);

        const users = await pool.query('SELECT id, ad_soyad, rol FROM kullanicilar WHERE rol = \'dizgici\'');
        console.log('--- DİZGİCİLER ---');
        console.table(users.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
debug();
