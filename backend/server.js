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

    try {
      console.log('🔄 Durum kısıtı kontrol ediliyor ve temizleniyor...');

      // 1. Durumu NULL veya geçersiz olanları temizle
      await pool.query(`
        UPDATE sorular 
        SET durum = 'beklemede' 
        WHERE durum IS NULL OR durum NOT IN (${allowedWorkflowStatuses.map((_, i) => `$${i + 1}`).join(',')})
      `, allowedWorkflowStatuses);

      // 2. TÜM check kısıtlarını bul ve kaldır (Daha agresif bir metod)
      const existingConstraints = await pool.query(`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'sorular'::regclass AND contype = 'c'
      `);

      for (const row of existingConstraints.rows) {
        console.log(`🗑️ Kısıt kaldırılıyor: ${row.conname}`);
        await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }

      // 3. Yeni kısıtı ekle
      const statusListSql = allowedWorkflowStatuses.map(s => `'${s}'`).join(',');
      await pool.query(`
        ALTER TABLE sorular 
        ADD CONSTRAINT sorular_durum_check_v2
        CHECK (durum IN (${statusListSql}))
      `);

      console.log('✅ Durum CHECK kısıtı (v2) başarıyla güncellendi');
    } catch (e) {
      console.error('❌ DURUM KISITI HATASI:', e.message);
      throw e;
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
