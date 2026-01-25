import pool from '../../config/database.js';

export async function createAdvancedFeatures() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Sorular tablosuna yeni alanlar ekle
    await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS latex_kodu TEXT,
      ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'beklemede' CHECK (durum IN (
        'beklemede',
        'dizgi_bekliyor',
        'dizgide',
        'dizgi_tamam',
        'alan_incelemede',
        'alan_onaylandi',
        'dil_incelemede',
        'dil_onaylandi',
        'revize_istendi',
        'revize_gerekli',
        'inceleme_bekliyor',
        'incelemede',
        'inceleme_tamam',
        'tamamlandi',
        'arsiv'
      )),
      ADD COLUMN IF NOT EXISTS dizgici_id INTEGER REFERENCES kullanicilar(id),
      ADD COLUMN IF NOT EXISTS dizgi_baslama_tarihi TIMESTAMP,
      ADD COLUMN IF NOT EXISTS dizgi_bitis_tarihi TIMESTAMP,
      ADD COLUMN IF NOT EXISTS revize_notu TEXT
    `);

    // 2. Bildirimler tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS bildirimler (
        id SERIAL PRIMARY KEY,
        kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
        baslik VARCHAR(200) NOT NULL,
        mesaj TEXT NOT NULL,
        tip VARCHAR(50) NOT NULL, -- info, success, warning, error, revize
        okundu BOOLEAN DEFAULT false,
        link VARCHAR(500), -- İlgili sayfaya yönlendirme linki
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bildirimler_kullanici ON bildirimler(kullanici_id);
      CREATE INDEX IF NOT EXISTS idx_bildirimler_okundu ON bildirimler(okundu);
    `);

    // 3. Mesajlar tablosu (soru bazlı mesajlaşma)
    await client.query(`
      CREATE TABLE IF NOT EXISTS mesajlar (
        id SERIAL PRIMARY KEY,
        soru_id INTEGER NOT NULL REFERENCES sorular(id) ON DELETE CASCADE,
        gonderen_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
        mesaj TEXT NOT NULL,
        dosya_url VARCHAR(500),
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mesajlar_soru ON mesajlar(soru_id);
      CREATE INDEX IF NOT EXISTS idx_mesajlar_gonderen ON mesajlar(gonderen_id);
    `);

    // 4. Soru görüntülenme tablosu (kim hangi soruyu gördü)
    await client.query(`
      CREATE TABLE IF NOT EXISTS soru_goruntulenme (
        id SERIAL PRIMARY KEY,
        soru_id INTEGER NOT NULL REFERENCES sorular(id) ON DELETE CASCADE,
        kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
        goruntuleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(soru_id, kullanici_id)
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Gelişmiş özellikler migration başarılı');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration hatası:', error);
    throw error;
  } finally {
    client.release();
  }
}
