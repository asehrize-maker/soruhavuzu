import pool from './src/config/database.js';

async function checkTables() {
  try {
    console.log('🔍 Veritabanı tablolarını kontrol ediyorum...\n');

    // Tüm tabloları listele
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📋 Mevcut tablolar:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // kullanici_mesajlari tablosu var mı kontrol et
    const mesajlarTable = result.rows.find(r => r.table_name === 'kullanici_mesajlari');
    
    if (mesajlarTable) {
      console.log('\n✅ kullanici_mesajlari tablosu mevcut');
      
      // Tablo yapısını kontrol et
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'kullanici_mesajlari'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📊 Tablo yapısı:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('\n❌ kullanici_mesajlari tablosu bulunamadı!');
      console.log('Migration çalıştırılmalı.');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

checkTables();
