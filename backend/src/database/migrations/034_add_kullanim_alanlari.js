import pool from '../../config/database.js';

export const addKullanimAlanlari = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 MIGRATION: 034_add_kullanim_alanlari çalıştırılıyor...');

        // Kullanıldı mı ve Kullanım Alanı sütunlarını ekle
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS kullanildi BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS kullanim_alani VARCHAR(255)
    `);

        // Index ekle
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sorular_kullanildi ON sorular(kullanildi)
    `);

        console.log('✅ MIGRATION: Kullanım alanları kolonları eklendi.');
    } catch (error) {
        console.error('❌ MIGRATION ERROR (034_add_kullanim_alanlari):', error);
    } finally {
        client.release();
    }
};
