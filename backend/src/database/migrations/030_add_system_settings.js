import pool from '../../config/database.js';

export const addSystemSettings = async () => {
    try {
        // Create sistem_ayarlari table
        // key-value style
        await pool.query(`
      CREATE TABLE IF NOT EXISTS sistem_ayarlari (
        anahtar VARCHAR(100) PRIMARY KEY,
        deger TEXT,
        aciklamalar TEXT,
        guncellenme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Initial settings seeds
        const settings = [
            ['site_basligi', 'Soru Havuzu Sistemi', 'Sitenin tarayıcı sekmesinde ve başlıklarında görünecek isim'],
            ['bakim_modu', 'false', 'Siteyi bakıma alır, admin dışındaki girişleri engeller (true/false)'],
            ['kayit_acik', 'true', 'Dışarıdan kullanıcı kaydına izin verir (true/false)'],
            ['iletisim_email', 'admin@soruhavuzu.com', 'Sistem üzerinden gönderilecek otomatik e-postalar için kaynak adres'],
            ['duyuru_aktif', 'false', 'Giriş sayfasında global bir duyuru gösterir (true/false)'],
            ['duyuru_mesaji', '', 'Duyuru metni'],
            ['footer_metni', '© 2026 Soru Havuzu Yönetim Sistemi', 'Sayfa alt bilgisinde görünecek metin']
        ];

        for (const [key, val, desc] of settings) {
            await pool.query(
                'INSERT INTO sistem_ayarlari (anahtar, deger, aciklamalar) VALUES ($1, $2, $3) ON CONFLICT (anahtar) DO NOTHING',
                [key, val, desc]
            );
        }

        console.log('✅ sistem_ayarlari tablosu ve başlangıç verileri hazır.');
    } catch (error) {
        console.error('❌ sistem_ayarlari hatası:', error.message);
    }
};
