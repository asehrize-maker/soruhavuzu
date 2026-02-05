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
import denemeRoutes from './src/routes/deneme.routes.js';

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
app.use('/api/denemeler', denemeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Soru Havuzu API çalışıyor' });
});

// Error handler
app.use(errorHandler);

// --- START SERVER LOGIC ---
const startServer = async () => {
  try {
    console.log('--- SUNUCU BAŞLATILIYOR (V4 - PROXY PDF MODE) ---');

    // 1. Sunucuyu Hemen Dinlemeye Al (Render Timeout'u Engellemek İçin)
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Sunucu ${PORT} portunda dinlemeye başladı. Sistem hazırlıkları arka planda devam ediyor...`);
    });

    // 2. Arka Planda Veritabanı ve Kritik Hazırlıkları Yap
    (async () => {
      try {
        process.stdout.write('🔄 Veritabanı tabloları kuruluyor... ');
        await createTables();
        console.log('✅ HAZIR');

        const allStatuses = [
          'beklemede', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam',
          'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi',
          'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede', 'inceleme_tamam',
          'tamamlandi', 'arsiv'
        ];
        const statusSqlList = allStatuses.map(s => `'${s}'`).join(',');

        // Bozuk kayıtları temizle
        process.stdout.write('🔄 Veri tutarlılığı kontrol ediliyor... ');
        const placeholders = allStatuses.map((_, i) => `$${i + 1}`).join(',');
        await pool.query(
          `UPDATE sorular SET durum = 'beklemede' WHERE durum IS NULL OR TRIM(LOWER(durum)) NOT IN (${placeholders})`,
          allStatuses
        );

        // Veritabanı kısıtlamalarını zorla
        await pool.query(`ALTER TABLE sorular ALTER COLUMN durum TYPE VARCHAR(50)`);
        const oldConstraints = await pool.query(`
                    SELECT conname FROM pg_constraint 
                    WHERE conrelid = 'sorular'::regclass AND contype = 'c'
                `);
        for (const row of oldConstraints.rows) {
          await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
        }
        await pool.query(`ALTER TABLE sorular ADD CONSTRAINT sorular_durum_check_final CHECK (durum IN (${statusSqlList}))`);

        // --- KULLANIM ALANLARI KONTROLÜ (KRİTİK) ---
        process.stdout.write('🔄 Kullanım takip kolonları kontrol ediliyor... ');
        await pool.query(`
          ALTER TABLE sorular 
          ADD COLUMN IF NOT EXISTS kullanildi BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS kullanim_alani VARCHAR(255)
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sorular_kullanildi ON sorular(kullanildi)`);
        console.log('✅ TAMAMLANDI');

        console.log('🌟 TÜM SİSTEMLER ÇALIŞIR DURUMDA');
      } catch (initErr) {
        console.error('❌ KRİTİK BAŞLATMA HATASI (Sistem kısıtlı çalışabilir):', initErr.message);
        // Sunucuyu kapatmıyoruz ki Render "Deploy Failed" demesin, loglardan incelenebilsin.
      }
    })();

  } catch (error) {
    console.error('❌ SUNUCU BAŞLATILAMADI!', error.message);
    process.exit(1);
  }
};

startServer();
