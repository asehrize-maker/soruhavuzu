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

    // Prod-shell yok: durum kısıtını her startta garanti altına al
    try {
      // Tüm mevcut CHECK kısıtlarını temizle (isim değişmiş olabilir)
      const existing = await pool.query(`
        SELECT conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'c' AND c.conrelid = 'sorular'::regclass AND a.attname = 'durum'
      `);
      for (const row of existing.rows) {
        await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }
      await pool.query(`
        ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check;
        ALTER TABLE sorular
        ADD CONSTRAINT sorular_durum_check
        CHECK (
          durum IN (
            'beklemede','inceleme_bekliyor','incelemede','revize_istendi','revize_gerekli',
            'dizgi_bekliyor','dizgide','dizgi_tamam','inceleme_tamam','tamamlandi','arsiv'
          )
        );
      `);
      console.log('✅ durum CHECK kısıtı güncellendi');
    } catch (e) {
      console.error('⚠️ durum kısıtı güncellenemedi:', e.message);
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
