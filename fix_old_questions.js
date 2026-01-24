import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function findAndFix() {
    try {
        console.log('--- Eski Statü Kontrolü ---');
        const res = await pool.query("SELECT id, durum FROM sorular WHERE durum IN ('inceleme_bekliyor', 'incelemede')");

        if (res.rows.length === 0) {
            console.log('İncelemede bekleyen eski soru bulunamadı.');
        } else {
            console.log(`${res.rows.length} adet eski statüde soru bulundu:`);
            console.table(res.rows);

            // Kullanıcı "Dizgiye gelmesi lazım" dediği için bu soruları dizgi_bekliyor yapabiliriz
            // Ama önce sadece listeliyoruz.
        }
        process.exit(0);
    } catch (err) {
        console.error('Hata:', err.message);
        process.exit(1);
    }
}

findAndFix();
