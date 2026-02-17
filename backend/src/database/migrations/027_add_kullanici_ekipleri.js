import pool from '../../config/database.js';

export const addKullaniciEkipleri = async (client) => {
    // If client is not provided, use pool
    const db = client || pool;

    try {
        console.log('🔄 Kullanıcı ekipleri tablosu kontrol ediliyor...');

        // 1. Tabloyu oluştur: kullanici_ekipleri
        await db.query(`
            CREATE TABLE IF NOT EXISTS kullanici_ekipleri (
                id SERIAL PRIMARY KEY,
                kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
                ekip_id INTEGER NOT NULL REFERENCES ekipler(id) ON DELETE CASCADE,
                olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Unique index ekle (aynı kullanıcı aynı ekibe iki kez eklenemesin)
        // Raw SQL'de IF NOT EXISTS index için özel syntax gerekebilir veya catch bloklarında yönetilebilir.
        // PostgreSQL 9.5+ supports CREATE INDEX IF NOT EXISTS
        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS unique_kullanici_ekip 
            ON kullanici_ekipleri(kullanici_id, ekip_id)
        `);

        // 3. Mevcut 'ekip_id' kolonundaki verileri bu tabloya taşı
        const migrationResult = await db.query(`
            INSERT INTO kullanici_ekipleri (kullanici_id, ekip_id)
            SELECT id, ekip_id FROM kullanicilar WHERE ekip_id IS NOT NULL
            ON CONFLICT (kullanici_id, ekip_id) DO NOTHING
        `);

        console.log(`✅ kullanici_ekipleri tablosu hazır. ${migrationResult.rowCount} mevcut kayıt aktarıldı/doğrulandı.`);

    } catch (error) {
        console.error('❌ kullanici_ekipleri tablosu oluşturulurken hata:', error.message);
        // Kritik hata ise fırlat, yoksa logla devam et (duruma göre)
        throw error;
    }
};
