import pool from '../config/database.js';
import { createAdvancedFeatures } from './migrations/002_gelismis_ozellikler.js';
import { createUserMessages } from './migrations/003_kullanici_mesajlari.js';
import { createMultipleBranslar } from './migrations/004_coklu_brans.js';
import { addDosyaFields } from './migrations/005_dosya_ekleme.js';
import { updateDurumConstraint } from './migrations/006_durum_constraint.js';
import { addSoruDetaylari } from './migrations/007_soru_detaylari.js';
import { addSoruIncelemeVeVersiyon } from './migrations/008_soru_inceleme_versiyon.js';
import { seedSivasEkibi } from './migrations/009_sivas_ekibi_seed.js';
import { updateWorkflowStatus } from './migrations/010_update_workflow_status.js';
import { doubleApprovalSystem } from './migrations/011_double_approval_system.js';
import { incelemeciRolVeAltRoller } from './migrations/012_incelemeci_rol_altroller.js';
import { createBransKazanimlar } from './migrations/013_brans_kazanimlar.js';
import { fixSorularDurumConstraint } from './migrations/014_fix_sorular_durum_constraint.js';
import { normalizeSorularDurum } from './migrations/015_normalize_sorular_durum.js';
import { addIncelemeFlags } from './migrations/016_add_inceleme_flags.js';
import { addFinalPngFields } from './migrations/017_add_final_png_fields.js';
import { makeBranslarGlobal } from './migrations/018_make_branslar_global.js';
import { mergeDuplicateBranslar } from './migrations/019_merge_duplicate_branslar.js';
import { updateZorlukSchema } from './migrations/021_update_zorluk_schema.js';
import { addDizgiTamamStatus } from './migrations/022_add_dizgi_tamam_enum.js';
import { addDizgiDateColumns } from './migrations/023_add_dizgi_date_columns.js';
import { ultimateDurumFix } from './migrations/025_ultimate_durum_fix.js';

const createTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ekipler tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS ekipler (
        id SERIAL PRIMARY KEY,
        ekip_adi VARCHAR(100) NOT NULL UNIQUE,
        aciklama TEXT,
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Branşlar tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS branslar (
        id SERIAL PRIMARY KEY,
        brans_adi VARCHAR(100) NOT NULL,
        ekip_id INTEGER REFERENCES ekipler(id) ON DELETE CASCADE,
        aciklama TEXT,
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brans_adi, ekip_id)
      )
    `);

    // Kullanıcılar tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS kullanicilar (
        id SERIAL PRIMARY KEY,
        ad_soyad VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        sifre VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'soru_yazici', 'dizgici', 'incelemeci', 'koordinator')),
        inceleme_alanci BOOLEAN DEFAULT false,
        inceleme_dilci BOOLEAN DEFAULT false,
        ekip_id INTEGER REFERENCES ekipler(id) ON DELETE SET NULL,
        brans_id INTEGER REFERENCES branslar(id) ON DELETE SET NULL,
        aktif BOOLEAN DEFAULT true,
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sorular tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS sorular (
        id SERIAL PRIMARY KEY,
        soru_metni TEXT NOT NULL,
        fotograf_url VARCHAR(500),
        fotograf_public_id VARCHAR(255),
        zorluk_seviyesi VARCHAR(20) CHECK (zorluk_seviyesi IN ('kolay', 'orta', 'zor')),
        brans_id INTEGER REFERENCES branslar(id) ON DELETE CASCADE,
        olusturan_kullanici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
        durum VARCHAR(50) DEFAULT 'beklemede' CHECK (durum IN (
          'beklemede',
          'inceleme_bekliyor',
          'incelemede',
          'revize_istendi',
          'revize_gerekli',
          'dizgi_bekliyor',
          'dizgide',
          'dizgi_tamam',
          'inceleme_tamam',
          'tamamlandi',
          'arsiv'
        )),
        dizgici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
        olusturulma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        guncellenme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Dizgi geçmişi tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS dizgi_gecmisi (
        id SERIAL PRIMARY KEY,
        soru_id INTEGER REFERENCES sorular(id) ON DELETE CASCADE,
        dizgici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
        durum VARCHAR(50),
        notlar TEXT,
        tamamlanma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // İndeksler
    await client.query('CREATE INDEX IF NOT EXISTS idx_sorular_durum ON sorular(durum)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sorular_brans ON sorular(brans_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_kullanicilar_ekip ON kullanicilar(ekip_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_kullanicilar_brans ON kullanicilar(brans_id)');

    await client.query('COMMIT');
    console.log('✅ Tüm tablolar başarıyla oluşturuldu');

    // Gelişmiş özellikler migration'ını çalıştır
    await createAdvancedFeatures();

    // Kullanıcı mesajları migration'ını çalıştır
    await createUserMessages();

    // Çoklu branş migration'ını çalıştır
    await createMultipleBranslar();

    // Dosya ekleme migration'ını çalıştır
    await addDosyaFields();

    // Durum constraint'i güncelle
    await updateDurumConstraint();

    // Soru detayları (seçenekler ve görsel konumu) migration'ını çalıştır
    await addSoruDetaylari();

    // Soru inceleme ve versiyon sistemi
    await addSoruIncelemeVeVersiyon();

    // Sivas Ekibi ve Temel Branşları Seed Et
    try {
      await seedSivasEkibi();
    } catch (e) {
      console.warn('⚠️ Seed Sivas Ekibi skipped (likely already exists or minor DB issue):', e.message);
    }

    // İş akışı durumlarını güncelle (V2)
    // İş akışı durumlarını güncelle (V2)
    await updateWorkflowStatus();

    // Çift onay sistemi ve revize notları
    await doubleApprovalSystem();

    // İncelemeci rol/alt-roller (alan/dil) desteği
    await incelemeciRolVeAltRoller();

    // Branş kazanım tabloları
    await createBransKazanimlar();

    await fixSorularDurumConstraint();
    await normalizeSorularDurum();
    await addIncelemeFlags();
    await addFinalPngFields();
    await makeBranslarGlobal();
    await mergeDuplicateBranslar();

    // Zorluk seviyesi şemasını güncelle (1-5 integer)
    await updateZorlukSchema();

    // Dizgi tamam statüsünü enum/constraint'e ekle
    await addDizgiTamamStatus();

    // Dizgi tarih kolonlarını ekle
    await addDizgiDateColumns();

    // Koordinator rolü ekle
    await addKoordinatorRole();

    // En son ve kesin durum kısıtlamasını uygula
    await ultimateDurumFix();

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Tablo oluşturma hatası:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Script olarak çalıştırılırsa
if (import.meta.url === `file://${process.argv[1]}`) {
  createTables()
    .then(() => {
      console.log('Migration tamamlandı');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration hatası:', err);
      process.exit(1);
    });
}

export default createTables;
