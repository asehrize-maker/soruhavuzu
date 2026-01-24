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
    console.log('--- SUNUCU BAŞLATILIYOR (V3 - PARANOID MODE) ---');

    // 1. Veritabanı Tablolarını ve Temel Yapıyı Kur
    await createTables();
    console.log('✅ Veritabanı tabloları hazır');

    // 2. KRİTİK VERİTABANI ÖN-HAZIRLIK (FAIL-FAST)
    const allStatuses = [
      'beklemede', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam',
      'alan_incelemede', 'alan_onaylandi', 'dil_incelemede', 'dil_onaylandi',
      'revize_istendi', 'revize_gerekli', 'inceleme_bekliyor', 'incelemede', 'inceleme_tamam',
      'tamamlandi', 'arsiv'
    ];
    const statusSqlList = allStatuses.map(s => `'${s}'`).join(',');

    // 2a) Constraint eklenmeden önce bozuk kayıtları temizle
    try {
      const placeholders = allStatuses.map((_, i) => `$${i + 1}`).join(',');
      const { rows: badRows } = await pool.query(
        `SELECT id, durum FROM sorular WHERE durum IS NULL OR TRIM(LOWER(durum)) NOT IN (${placeholders})`,
        allStatuses
      );
      if (badRows.length > 0) {
        console.warn('WARN: Izinli olmayan durum degerleri bulundu, \"beklemede\" olarak guncellenecek.', badRows);
        await pool.query(
          `UPDATE sorular SET durum = 'beklemede' WHERE durum IS NULL OR TRIM(LOWER(durum)) NOT IN (${placeholders})`,
          allStatuses
        );
      }
    } catch (cleanErr) {
      console.error('ERROR: Durum temizleme basarisiz:', cleanErr.message);
    }

    try {
      console.log('🔄 Veritabanı kuralları zorla güncelleniyor...');

      // Tip Güvencesi
      await pool.query(`ALTER TABLE sorular ALTER COLUMN durum TYPE VARCHAR(50)`);

      // Tüm eski kısıtları süpür
      const oldConstraints = await pool.query(`
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'sorular'::regclass AND contype = 'c'
      `);
      for (const row of oldConstraints.rows) {
        await pool.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }

      // Yeni Kapsamlı Durum Listesini Uygula
      await pool.query(`ALTER TABLE sorular ADD CONSTRAINT sorular_durum_check_final CHECK (durum IN (${statusSqlList}))`);

      // İSTEK ÜZERİNE KATI DENETİM (Integrity Check)
      const integrityCheck = await pool.query(`
        SELECT id, durum FROM sorular 
        WHERE durum NOT IN (${statusSqlList})
      `);

      if (integrityCheck.rows.length > 0) {
        console.error('❌ KRİTİK HATALI VERİ TESPİT EDİLDİ!');
        console.error('Şu IDli sorular hatalı durumda:', integrityCheck.rows.map(r => `${r.id}: ${r.durum}`));
        process.exit(1); // FAİLE DÜŞÜR!
      }

      console.log('✅ Veritabanı bütünlüğü doğrulandı.');
    } catch (e) {
      console.error('❌ KRİTİK VERİTABANI HATASI:', e.message);
      process.exit(1); // FAİLE DÜŞÜR!
    }

    // 3. SUNUCUYU BAŞLAT
    app.listen(PORT, () => {
      console.log(`🚀 Sunucu ${PORT} portunda BAŞARIYLA BAŞLATILDI`);
    });

  } catch (error) {
    console.error('❌ SUNUCU BAŞLATILAMADI!', error.message);
    process.exit(1);
  }
};

startServer();
