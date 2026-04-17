// API роуты для авторизации
const express = require('express');
const router = express.Router();
const db = require('../services/database');
const telegramService = require('../services/telegram');
const { generateToken } = require('../middleware/auth');

// Генерация 6-значного кода
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/public/auth/request_code
 * Запрос кода авторизации через Telegram
 */
router.post('/request_code', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName } = req.body;

    if (!telegramId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Telegram ID is required' 
      });
    }

    // Генерируем код
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Сохраняем код в базе
    const authCode = db.insert('authCodes', {
      telegramId,
      code,
      expiresAt: expiresAt.toISOString(),
      used: false,
      username,
      firstName,
      lastName
    });

    // Отправляем код через Telegram
    const result = await telegramService.sendAuthCode(telegramId, code);

    if (result.success) {
      res.json({
        success: true,
        message: 'Код отправлен в Telegram',
        simulated: result.simulated,
        ...(result.simulated && { code }) // В режиме симуляции показываем код
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Не удалось отправить код'
      });
    }
  } catch (error) {
    console.error('Error requesting auth code:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/public/auth/verify_code
 * Проверка кода и выдача токена
 */
router.post('/verify_code', async (req, res) => {
  try {
    const { telegramId, code } = req.body;

    if (!telegramId || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Telegram ID and code are required' 
      });
    }

    // Ищем код в базе
    const authCode = db.find('authCodes', ac => 
      ac.telegramId === telegramId && 
      ac.code === code && 
      !ac.used
    );

    if (!authCode) {
      return res.status(400).json({
        success: false,
        error: 'Неверный или использованный код'
      });
    }

    // Проверяем срок действия
    if (new Date(authCode.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Срок действия кода истёк'
      });
    }

    // Помечаем код как использованный
    db.update('authCodes', authCode.id, { used: true });

    // Ищем или создаём пользователя
    let user = db.find('users', u => u.telegramId === telegramId);

    if (!user) {
      // Создаём нового пользователя
      user = db.insert('users', {
        telegramId,
        username: authCode.username || `user_${telegramId}`,
        firstName: authCode.firstName || '',
        lastName: authCode.lastName || '',
        balance: 0,
        role: 'user',
        isActive: true,
        createdAt: new Date().toISOString()
      });

      // Создаём запись кошелька
      db.insert('wallets', {
        userId: user.id,
        usdtBalance: 0,
        rubBalance: 0,
        walletAddress: null
      });
    }

    // Генерируем JWT токен
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Error verifying auth code:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/public/auth/me
 * Получить текущего пользователя
 */
router.get('/me', (req, res) => {
  // Этот роут требует авторизации, проверяется в server.js
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized'
    });
  }

  const wallet = db.find('wallets', w => w.userId === user.id);

  res.json({
    success: true,
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      balance: user.balance,
      wallet: wallet ? {
        usdtBalance: wallet.usdtBalance,
        rubBalance: wallet.rubBalance,
        walletAddress: wallet.walletAddress
      } : null
    }
  });
});

module.exports = router;
