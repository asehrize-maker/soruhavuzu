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
const frontendUrl = process.env.FRONTEND_URL;
console.log('🔒 CORS Setup - Env FRONTEND_URL:', frontendUrl);

app.use(cors({
  origin: '*',
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

// --- START SERVER LOGIC ---
const startServer = async () => {
  try {
    console.log('--- SUNUCU BAŞLATILIYOR (V2 - DB ÖNCELİKLİ) ---');

    // 1. Veritabanı Tablolarını ve Temel Yapıyı Kur
    await createTables();
    console.log('✅ Veritabanı tabloları hazır');

    // 2. DURUM KISITI GÜNCELLEME (Self-Healing)
    const allowedWorkflowStatuses = [
      'beklemede', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam',
      'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi',
      'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede', 'inceleme_tamam',
      'tamamlandi', 'arsiv'
    ];

    // --- KRİTİK VERİTABANI ÖN-HAZIRLIK ---
    try {
      console.log('🔄 Veritabanı kuralları (Durum/Zorluk) zorla güncelleniyor...');

      // 1. Tip Güvencesi: Eğer ENUM tipi takılıyorsa VARCHAR'a zorla
      await pool.query(`ALTER TABLE sorular ALTER COLUMN durum TYPE VARCHAR(50)`);

      // 2. Tüm eski kısıtları isimden bağımsız süpür
      const oldConstraints = await pool.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'sorular'::regclass AND contype = 'c'
      `);
      for (const row of oldConstraints.rows) {
        await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }

      // 3. Kapsamlı Durum Listesini Uygula
      const allStatuses = [
        'beklemede', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam',
        'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi',
        'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede', 'inceleme_tamam',
        'tamamlandi', 'arsiv'
      ].map(s => `'${s}'`).join(',');

      await pool.query(`ALTER TABLE sorular ADD CONSTRAINT sorular_durum_check_final CHECK (durum IN (${allStatuses}))`);

      // 4. Zorluk Seviyesini Sayısala Zorla
      await pool.query(`
        UPDATE sorular SET zorluk_seviyesi = 3 
        WHERE zorluk_seviyesi::text !~ '^[1-5]$';
        ALTER TABLE sorular ALTER COLUMN zorluk_seviyesi TYPE SMALLINT USING zorluk_seviyesi::int;
      `);

      console.log('✅ Veritabanı KURALLARI %100 güncellendi.');
    } catch (e) {
      console.error('❌ KRİTİK VERİTABANI HATASI (Deployment Durduruldu):', e.message);
      process.exit(1); // FAİLE DÜŞÜR!
    }

    // 3. ZORLUK SEVİYESİ NORMALİZASYONU
    try {
      await pool.query(`
        UPDATE sorular SET zorluk_seviyesi =
          CASE
            WHEN zorluk_seviyesi::text ~ '^[0-9]+$' THEN LEAST(GREATEST(zorluk_seviyesi::int,1),5)
            ELSE 3
          END
        WHERE zorluk_seviyesi IS NULL OR zorluk_seviyesi::text !~ '^[1-5]$';
      `);
      // Kısıtları temizle ve smallint'e çek
      await pool.query(`ALTER TABLE sorular ALTER COLUMN zorluk_seviyesi TYPE SMALLINT USING zorluk_seviyesi::int`);
      console.log('✅ Zorluk seviyesi kısıtı hazır');
    } catch (e) {
      console.warn('⚠️ Zorluk seviyesi güncellenemedi:', e.message);
    }

    // 4. ESKİ VERİ DÜZELTMELERİ
    await pool.query("UPDATE sorular SET durum = 'dizgi_tamam' WHERE durum = 'tamamlandi' AND final_png_url IS NULL");
    await pool.query("UPDATE sorular SET onay_alanci = false, onay_dilci = false WHERE durum = 'inceleme_bekliyor' AND (onay_alanci = true OR onay_dilci = true)");

    // 5. SUNUCUYU BAŞLAT (Portu sadece her şey TAMAMSA aç)
    app.listen(PORT, () => {
      console.log(`🚀 Sunucu ${PORT} portunda BAŞARIYLA BAŞLATILDI`);
      console.log(`🌍 API: https://soruhavuzu-rjbt.onrender.com/api`);
    });

  } catch (error) {
    console.error('❌ KRİTİK HATA: Sunucu başlatılamadı ve deployment DURDURULDU!');
    console.error('Hata Detayı:', error.message);
    process.exit(1); // Faile düşür
  }
};

startServer();
