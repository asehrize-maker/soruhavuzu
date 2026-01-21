import pool from './src/config/database.js';

async function checkQuestions() {
    try {
        console.log('İnceleme Bekleyen Soruların Kontrolü...');

        // 1. İnceleme bekleyen ama onayları true olan veya garip durumda olan sorular
        const res = await pool.query(`
      SELECT 
        s.id, 
        s.durum, 
        s.onay_alanci, 
        s.onay_dilci, 
        b.brans_adi, 
        e.ekip_adi,
        k.ad_soyad as yazar
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      LEFT JOIN ekipler e ON b.ekip_id = e.id
      LEFT JOIN kullanicilar k ON s.olusturan_kullanici_id = k.id
      WHERE s.durum = 'inceleme_bekliyor'
    `);

        console.log('Bulunan Soru Sayısı:', res.rows.length);
        console.table(res.rows);

        // 2. İncelemeci Kullanıcıları ve Yetkileri
        const users = await pool.query(`
      SELECT id, role_name as rol, ad_soyad, inceleme_alanci, inceleme_dilci 
      FROM kullanicilar 
      WHERE rol = 'incelemeci'
    `);
        console.log('\nİncelemeci Kullanıcıları:');
        // Not: DB schema'sında rol kolonu 'rol' dür, 'role_name' değil. Düzeltiyorum.
    } catch (err) {
        console.error('Hata:', err);
    }
}

async function checkUsers() {
    const users = await pool.query(`
        SELECT id, rol, ad_soyad, inceleme_alanci, inceleme_dilci 
        FROM kullanicilar 
        WHERE rol = 'incelemeci'
      `);
    console.log('\nİncelemeci Kullanıcıları:');
    console.table(users.rows);
}

// Main
async function run() {
    await checkQuestions();
    await checkUsers();
    process.exit();
}

run();
