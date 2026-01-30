import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public ayarları getir (Giriş sayfası için)
router.get('/config', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT anahtar, deger 
      FROM sistem_ayarlari 
      WHERE anahtar IN (
        'site_basligi', 'duyuru_aktif', 'duyuru_mesaji', 'kayit_acik', 'footer_metni',
        'panel_duyuru_aktif', 'panel_duyuru_baslik', 'panel_duyuru_mesaj', 'panel_duyuru_tip'
      )
    `);

    const config = {};
    result.rows.forEach(row => {
      config[row.anahtar] = row.deger;
    });

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// Kayıt olma
router.post('/register', [
  body('ad_soyad').trim().notEmpty().withMessage('Ad soyad gerekli'),
  body('email').isEmail().withMessage('Geçerli bir email girin'),
  body('sifre').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  body('rol').isIn(['admin', 'soru_yazici', 'dizgici', 'incelemeci']).withMessage('Geçersiz rol'),
  body('inceleme_turu').optional().isIn(['alanci', 'dilci']).withMessage('İnceleme türü alanci veya dilci olmalı')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { ad_soyad, email, sifre, rol, ekip_id, brans_id, admin_secret, inceleme_turu } = req.body;

    // Email kontrolü
    const userExists = await pool.query('SELECT id FROM kullanicilar WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      throw new AppError('Bu email zaten kullanılıyor', 400);
    }

    let finalRole = rol;

    // Sistemdeki ilk kullanıcı mı kontrol et
    const userCountResult = await pool.query('SELECT COUNT(*) FROM kullanicilar');
    const userCount = parseInt(userCountResult.rows[0].count);

    if (userCount === 0) {
      // İlk kullanıcı her zaman admin olsun
      finalRole = 'admin';
    } else if (rol === 'admin') {
      // Admin rolü ile kayıt olunamaz, soru_yazici olarak değiştir
      finalRole = 'soru_yazici';
    }

    // Şifre hash
    // Admin kaydi sadece ADMIN_REGISTER_SECRET ile acik
    if (rol === 'admin') {
      const expectedSecret = process.env.ADMIN_REGISTER_SECRET;
      if (!expectedSecret) {
        throw new AppError('Admin kaydi kapali (ADMIN_REGISTER_SECRET ayarlanmamis)', 403);
      }
      if (!admin_secret || admin_secret !== expectedSecret) {
        throw new AppError('Admin secret hatali', 403);
      }
      finalRole = 'admin';
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(sifre, salt);

    // Kullanıcı oluştur
    // Determine inceleme flags
    let inceleme_alanci = false;
    let inceleme_dilci = false;
    if (finalRole === 'incelemeci') {
      if (inceleme_turu === 'alanci') inceleme_alanci = true;
      if (inceleme_turu === 'dilci') inceleme_dilci = true;
    }

    const result = await pool.query(
      `INSERT INTO kullanicilar (ad_soyad, email, sifre, rol, ekip_id, brans_id, inceleme_alanci, inceleme_dilci) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, ad_soyad, email, rol, inceleme_alanci, inceleme_dilci`,
      [ad_soyad, email, hashedPassword, finalRole, ekip_id || null, brans_id || null, inceleme_alanci, inceleme_dilci]
    );

    const user = result.rows[0];

    // Token oluştur
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    next(error);
  }
});

// Giriş yapma
router.post('/login', [
  body('email').isEmail().withMessage('Geçerli bir email girin'),
  body('sifre').notEmpty().withMessage('Şifre gerekli')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, sifre } = req.body;

    // Kullanıcı kontrolü (ekip ve branş bilgileriyle birlikte)
    const result = await pool.query(`
      SELECT k.*, e.ekip_adi, b.brans_adi
      FROM kullanicilar k
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN branslar b ON k.brans_id = b.id
      WHERE k.email = $1 AND k.aktif = true
    `, [email]);

    if (result.rows.length === 0) {
      throw new AppError('Email veya şifre hatalı', 401);
    }

    const user = result.rows[0];

    // Şifre kontrolü
    const isPasswordValid = await bcrypt.compare(sifre, user.sifre);
    if (!isPasswordValid) {
      throw new AppError('Email veya şifre hatalı', 401);
    }

    // Token oluştur
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    // Giriş logu oluştur
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      await pool.query(
        'INSERT INTO giris_loglari (kullanici_id, ip_adresi, user_agent) VALUES ($1, $2, $3)',
        [user.id, ip, userAgent]
      );
    } catch (logError) {
      console.error('Giriş logu kaydedilemedi:', logError);
    }

    // Şifreyi response'dan çıkar
    delete user.sifre;

    res.json({
      success: true,
      token,
      user
    });
  } catch (error) {
    next(error);
  }
});

// Mevcut kullanıcı bilgisi
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT k.id, k.ad_soyad, k.email, k.rol, k.inceleme_alanci, k.inceleme_dilci, k.ekip_id, k.brans_id,
             e.ekip_adi, b.brans_adi
      FROM kullanicilar k
      LEFT JOIN ekipler e ON k.ekip_id = e.id
      LEFT JOIN branslar b ON k.brans_id = b.id
      WHERE k.id = $1
    `, [req.user.id]);

    const user = result.rows[0];

    // Otomatik giriş logu (1 saatte bir en fazla 1 kayıt)
    // Şifre girmeden (token ile) girenleri de loglarda görmek için
    try {
      const lastLog = await pool.query(
        'SELECT tarih FROM giris_loglari WHERE kullanici_id = $1 ORDER BY tarih DESC LIMIT 1',
        [req.user.id]
      );

      const now = new Date();
      const oneHourInMs = 1 * 60 * 60 * 1000;
      const needsNewLog = lastLog.rows.length === 0 ||
        (now - new Date(lastLog.rows[0].tarih)) > oneHourInMs;

      if (needsNewLog) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.get('User-Agent');
        await pool.query(
          'INSERT INTO giris_loglari (kullanici_id, ip_adresi, user_agent) VALUES ($1, $2, $3)',
          [req.user.id, ip, userAgent]
        );
      }
    } catch (logError) {
      console.warn('Otomatik giriş logu kaydedilemedi:', logError.message);
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    next(error);
  }
});

export default router;
