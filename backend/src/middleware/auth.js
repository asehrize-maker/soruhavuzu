import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import pool from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AppError('Token bulunamadı. Lütfen giriş yapın.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT id, ad_soyad, email, rol, ekip_id, brans_id FROM kullanicilar WHERE id = $1 AND aktif = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı veya aktif değil', 401);
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Geçersiz token', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token süresi dolmuş. Lütfen tekrar giriş yapın.', 401));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      throw new AppError('Bu işlem için yetkiniz yok', 403);
    }
    next();
  };
};
