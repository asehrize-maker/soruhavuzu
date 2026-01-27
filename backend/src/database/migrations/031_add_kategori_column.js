import pool from '../../config/database.js';

export const addKategoriColumn = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 MIGRATION: 031_add_kategori_column çalıştırılıyor...');

        // Kategori column ekle
        await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) DEFAULT 'deneme'
    `);

        // Index ekle
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sorular_kategori ON sorular(kategori)
    `);

        console.log('✅ MIGRATION: Kategori kolonu eklendi.');
    } catch (error) {
        console.error('❌ MIGRATION ERROR (031_add_kategori_column):', error);
        // Hata olsa da devam et (tablo zaten varsa vs)
    } finally {
        client.release();
    }
};
