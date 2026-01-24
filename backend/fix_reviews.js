import dotenv from 'dotenv';
dotenv.config();
import pool from './src/config/database.js';

async function fixPendingReviews() {
    try {
        console.log('Veritabanı Düzeltmesi Başlatılıyor...');

        // Durumu 'inceleme_bekliyor' olan soruların onay bayraklarını sıfırla
        const res = await pool.query(`
      UPDATE sorular 
      SET onay_alanci = false, onay_dilci = false 
      WHERE durum = 'inceleme_bekliyor' 
      RETURNING id, durum, onay_alanci, onay_dilci
    `);

        console.log(`✅ ${res.rowCount} adet sorunun onayı sıfırlandı.`);
        console.table(res.rows);

    } catch (err) {
        console.error('❌ Hata:', err);
    } finally {
        process.exit();
    }
}

fixPendingReviews();
