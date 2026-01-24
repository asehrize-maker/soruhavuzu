import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

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

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router;
