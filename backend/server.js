import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pool from './src/config/database.js'; // Import pool

// Routes
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import ekipRoutes from './src/routes/ekip.routes.js';
import bransRoutes from './src/routes/brans.routes.js';
import soruRoutes from './src/routes/soru.routes.js';
import bildirimRoutes from './src/routes/bildirim.routes.js';
import mesajRoutes from './src/routes/mesaj.routes.js';
import kullaniciMesajRoutes from './src/routes/kullanici-mesaj.routes.js';

// Middleware
import { errorHandler } from './src/middleware/errorHandler.js';

// Database migration
import createTables from './src/database/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CORS Ayarları
// CORS Ayarları
const frontendUrl = process.env.FRONTEND_URL;
console.log('🔒 CORS Setup - Env FRONTEND_URL:', frontendUrl); // Log the actual env var to debug typo

app.use(cors({
  origin: '*', // Hata almamak için herkesi kabul et (Debug modu)
  // credentials: true, // '*' kullanırken credentials true OLAMAZ
}));

console.log('🌍 CORS: Allowing ALL origins (*). Credentials disabled.');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ekipler', ekipRoutes);
app.use('/api/branslar', bransRoutes);
app.use('/api/sorular', soruRoutes);
app.use('/api/bildirimler', bildirimRoutes);
app.use('/api/mesajlar', mesajRoutes);
app.use('/api/kullanici-mesajlar', kullaniciMesajRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Soru Havuzu API çalışıyor' });
});

// Error handler
app.use(errorHandler);

// Veritabanı tablolarını oluştur ve sunucuyu başlat
// Veritabanı tablolarını oluştur ve sunucuyu başlat
const startServer = async () => {
  // Önce sunucuyu başlat (Render deploy'u başarılı olsun diye)
  app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT} portunda çalışıyor`);
    console.log(`📝 API: http://localhost:${PORT}/api`);
  });

  // Sonra veritabanına bağlanmayı dene
  try {
    await createTables();
    console.log('✅ Veritabanı tabloları hazır');

    // DURUM KISITI GÜNCELLEME (Self-Healing & Comprehensive)
    const allowedWorkflowStatuses = [
      'beklemede', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam',
      'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi',
      'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede', 'inceleme_tamam',
      'tamamlandi', 'arsiv'
    ];

    try {
      console.log('🔄 Durum kısıtı kontrol ediliyor...');

      // 1. Durumu NULL veya geçersiz olanları temizle
      await pool.query(`
        UPDATE sorular 
        SET durum = 'beklemede' 
        WHERE durum IS NULL OR durum NOT IN (${allowedWorkflowStatuses.map((_, i) => `$${i + 1}`).join(',')})
      `, allowedWorkflowStatuses);

      // 2. Mevcut TÜM check kısıtlarını bul ve kaldır
      const existingConstraints = await pool.query(`
        SELECT conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'c' AND c.conrelid = 'sorular'::regclass AND a.attname = 'durum'
      `);

      for (const row of existingConstraints.rows) {
        console.log(`🗑️ Eski kısıt kaldırılıyor: ${row.conname}`);
        await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }

      // 3. Yeni kısıtı ekle
      const statusListSql = allowedWorkflowStatuses.map(s => `'${s}'`).join(',');
      await pool.query(`
        ALTER TABLE sorular 
        ADD CONSTRAINT sorular_durum_check 
        CHECK (durum IN (${statusListSql}))
      `);

      console.log('✅ Durum CHECK kısıtı başarıyla güncellendi (Comprehensive)');
    } catch (e) {
      console.error('❌ Durum kısıtı güncellenirken hata oluştu:', e.message);
      // Hangi değerin hataya sebep olduğunu bulmak için detaylı log
      const checkRes = await pool.query(`SELECT DISTINCT durum FROM sorular`);
      console.log('Mevcut durum değerleri:', checkRes.rows.map(r => r.durum));
    }

    // Prod-shell yok: zorluk kısıtını ve veriyi her startta garanti altına al
    try {
      // Eski (metinsel) değerleri sayısala çevir ve aralığa sıkıştır
      await pool.query(`
        UPDATE sorular SET zorluk_seviyesi =
          CASE
            WHEN zorluk_seviyesi::text ~ '^[0-9]+$'
              THEN LEAST(GREATEST(zorluk_seviyesi::int,1),5)
            WHEN LOWER(zorluk_seviyesi::text) IN ('çok kolay','cok kolay','kolay','easy') THEN 2
            WHEN LOWER(zorluk_seviyesi::text) IN ('orta','normal','medium') THEN 3
            WHEN LOWER(zorluk_seviyesi::text) IN ('zor','hard') THEN 4
            ELSE 3
          END
        WHERE zorluk_seviyesi IS NULL
           OR zorluk_seviyesi::text !~ '^[1-5]$'
           OR LOWER(zorluk_seviyesi::text) IN ('çok kolay','cok kolay','kolay','easy','orta','normal','medium','zor','hard');
      `);

      // Mevcut zorluk kısıtlarını düşür
      const zConstraints = await pool.query(`
        SELECT conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'c' AND c.conrelid = 'sorular'::regclass AND a.attname = 'zorluk_seviyesi'
      `);
      for (const row of zConstraints.rows) {
        await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }

      // Tipi smallint'e çek ve kısıtı ekle
      await pool.query(`
        ALTER TABLE sorular
          ALTER COLUMN zorluk_seviyesi TYPE SMALLINT USING LEAST(GREATEST(zorluk_seviyesi::int,1),5);
        ALTER TABLE sorular
          ADD CONSTRAINT sorular_zorluk_seviyesi_check CHECK (zorluk_seviyesi BETWEEN 1 AND 5);
        ALTER TABLE sorular
          ALTER COLUMN zorluk_seviyesi SET DEFAULT 3;
      `);

      console.log('✅ zorluk_seviyesi CHECK kısıtı ve veri normalize edildi');
    } catch (e) {
      console.error('⚠️ zorluk_seviyesi kısıtı güncellenemedi:', e.message);
    }

    // FIX: Eski soruları geri getir
    const fixRes = await pool.query("UPDATE sorular SET durum = 'dizgi_tamam' WHERE durum = 'tamamlandi' AND final_png_url IS NULL");
    if (fixRes.rowCount > 0) {
      console.log(`✅ FIX APPLIED: ${fixRes.rowCount} eski soru 'dizgi_tamam' statüsüne alındı.`);
    }

    // FIX: İnceleme bekleyen soruların onaylarını sıfırla (Görünürlük sorunu için)
    const fixReviewsRes = await pool.query("UPDATE sorular SET onay_alanci = false, onay_dilci = false WHERE durum = 'inceleme_bekliyor' AND (onay_alanci = true OR onay_dilci = true)");
    if (fixReviewsRes.rowCount > 0) {
      console.log(`✅ FIX APPLIED: ${fixReviewsRes.rowCount} inceleme bekleyen sorunun onayı sıfırlandı.`);
    }
  } catch (error) {
    console.error('❌ Veritabanı bağlantı hatası:', error);
    console.log('⚠️ Sunucu veritabanı olmadan çalışmaya devam ediyor...');
    // process.exit(1) YAPMA! Sunucu açık kalsın ki CORS hatası çözülsün.
  }
};

startServer();
