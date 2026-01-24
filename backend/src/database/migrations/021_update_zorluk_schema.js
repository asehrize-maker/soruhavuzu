import pool from '../../config/database.js';

export const updateZorlukSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🔄 Zorluk seviyesi şeması güncelleniyor (Migration 021)...');

    // 0) Mevcut CHECK kısıtlarını en başta kaldır
    const existing = await client.query(`
          SELECT conname
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
          WHERE c.contype = 'c' AND c.conrelid = 'sorular'::regclass AND a.attname = 'zorluk_seviyesi'
        `);
    for (const row of existing.rows) {
      await client.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
    }

    // 1) Veri Temizliği (Case insensitive, trimmed, safe)
    await client.query(`
          UPDATE sorular 
          SET zorluk_seviyesi = CASE 
            WHEN LOWER(TRIM(zorluk_seviyesi::text)) IN ('kolay', 'çok kolay', '1', '2') THEN '2'
            WHEN LOWER(TRIM(zorluk_seviyesi::text)) IN ('orta', 'normal', '3') THEN '3'
            WHEN LOWER(TRIM(zorluk_seviyesi::text)) IN ('zor', 'çok zor', '4', '5') THEN '4'
            ELSE '3'
          END
          WHERE zorluk_seviyesi IS NULL OR zorluk_seviyesi::text !~ '^[1-5]$';
        `);

    // 2) Kolon tipini SMALLINT'e çevir
    // Önce kolon var mı kontrol et
    const columnCheck = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'sorular' AND column_name = 'zorluk_seviyesi'
        `);

    if (columnCheck.rows.length > 0) {
      const currentType = columnCheck.rows[0].data_type;
      if (currentType !== 'smallint' && currentType !== 'integer') {
        console.log('Changing column type to smallint...');
        await client.query(`
                    ALTER TABLE sorular 
                    ALTER COLUMN zorluk_seviyesi TYPE SMALLINT USING LEAST(GREATEST(zorluk_seviyesi::int,1),5)
                `);
      } else {
        // Eğer zaten integer ise sınırla
        await client.query(`UPDATE sorular SET zorluk_seviyesi = LEAST(GREATEST(zorluk_seviyesi,1),5)`);
        await client.query(`ALTER TABLE sorular ALTER COLUMN zorluk_seviyesi TYPE SMALLINT`);
      }
    } else {
      // Kolon yoksa oluştur (Backup case)
      await client.query(`ALTER TABLE sorular ADD COLUMN zorluk_seviyesi SMALLINT DEFAULT 3`);
    }

    // 3) Yeni CHECK kısıtı ekle
    await client.query(`
          ALTER TABLE sorular
          ADD CONSTRAINT sorular_zorluk_seviyesi_check CHECK (zorluk_seviyesi BETWEEN 1 AND 5)
        `);

    await client.query('COMMIT');
    console.log('✅ Zorluk seviyesi şeması başarıyla güncellendi (1-5 smallint)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.warn('⚠️ Zorluk schema migration uyarısı (Kritik değil):', error.message);
    // Sunucunun açılmasını engellememe kararı aldık (Self-healing server.js düzeltecek)
  } finally {
    client.release();
  }
};
