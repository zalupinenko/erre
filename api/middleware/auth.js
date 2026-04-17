// Middleware для проверки JWT токена
const jwt = require('jsonwebtoken');
const db = require('../services/database');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'franklinex_secret_key';

// Проверка токена
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authorization header required' 
    });
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Найти пользователя в базе
    const user = db.find('users', u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
}

// Проверка на админа
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }
  next();
}

// Опциональная авторизация (не обязательная)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.find('users', u => u.id === decoded.userId);
    req.user = user || null;
  } catch (error) {
    req.user = null;
  }
  
  next();
}

// Генерация токена
function generateToken(userId) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  optionalAuth,
  generateToken
};
