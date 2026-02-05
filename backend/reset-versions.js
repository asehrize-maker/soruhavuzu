import pool from './src/config/database.js';

async function resetVersions() {
    try {
        console.log('Versiyonlar sıfırlanıyor...');
        const result = await pool.query('UPDATE sorular SET versiyon = 1 WHERE versiyon > 1');
        console.log(`✅ Toplam ${result.rowCount} sorunun versiyonu 1 olarak sıfırlandı.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

resetVersions();
