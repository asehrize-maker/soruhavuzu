import pool from './src/config/database.js';

async function checkHighVersionQuestions() {
    try {
        console.log('--- Yüksek Versiyonlu Sorular Analizi ---');

        // En yüksek versiyonlu son 5 soruyu bul
        const res = await pool.query(`
      SELECT s.id, s.brans_id, b.brans_adi, s.durum, s.versiyon, s.olusturulma_tarihi
      FROM sorular s
      JOIN branslar b ON s.brans_id = b.id
      WHERE s.versiyon > 5
      ORDER BY s.versiyon DESC
      LIMIT 5
    `);

        if (res.rows.length === 0) {
            console.log('Yüksek versiyonlu soru bulunamadı.');
            process.exit(0);
        }

        for (const soru of res.rows) {
            console.log(`\nSoru ID: ${soru.id} | Branş: ${soru.brans_adi} | Mevcut Durum: ${soru.durum} | DB Versiyonu: ${soru.versiyon}`);

            // Bu sorunun 'dizgi_tamam' aktivitelerini sayalım (Gerçek versiyon budur)
            const logsRes = await pool.query(`
        SELECT COUNT(*) as real_version_count
        FROM aktivite_loglari
        WHERE soru_id = $1 AND (islem_turu = 'dizgi_tamam' OR islem_turu = 'durum_degisikligi' AND detay->>'yeni_durum' = 'dizgi_tamam')
      `, [soru.id]);

            const realCount = parseInt(logsRes.rows[0].real_version_count) + 1; // Başlangıç v1 olduğu için
            console.log(`Gerçek (Dizgi Çıktı) Sayısı: ${realCount}`);

            // Toplam kaç tane log kaydı var?
            const totalLogs = await pool.query('SELECT COUNT(*) FROM aktivite_loglari WHERE soru_id = $1', [soru.id]);
            console.log(`Toplam İşlem Sayısı (Hatalı Versiyon Kaynağı): ${totalLogs.rows[0].count}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

checkHighVersionQuestions();
