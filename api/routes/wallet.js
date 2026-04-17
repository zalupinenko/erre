// API роуты для кошелька
const express = require('express');
const router = express.Router();
const db = require('../services/database');
const telegramService = require('../services/telegram');

/**
 * GET /api/public/wallet/balance
 * Получить баланс пользователя
 */
router.get('/balance', (req, res) => {
  const user = req.user;
  
  const wallet = db.find('wallets', w => w.userId === user.id);
  
  if (!wallet) {
    return res.status(404).json({
      success: false,
      error: 'Wallet not found'
    });
  }

  res.json({
    success: true,
    balance: {
      usdt: wallet.usdtBalance || 0,
      rub: wallet.rubBalance || 0,
      walletAddress: wallet.walletAddress
    }
  });
});

/**
 * POST /api/public/set_wallet
 * Установить адрес кошелька
 */
router.post('/set_wallet', (req, res) => {
  const user = req.user;
  const { address } = req.body;

  if (!address || address.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Invalid wallet address'
    });
  }

  let wallet = db.find('wallets', w => w.userId === user.id);
  
  if (!wallet) {
    wallet = db.insert('wallets', {
      userId: user.id,
      usdtBalance: 0,
      rubBalance: 0,
      walletAddress: address.trim()
    });
  } else {
    wallet = db.update('wallets', wallet.id, {
      walletAddress: address.trim()
    });
  }

  res.json({
    success: true,
    message: 'Адрес кошелька сохранён',
    wallet: {
      usdtBalance: wallet.usdtBalance,
      rubBalance: wallet.rubBalance,
      walletAddress: wallet.walletAddress
    }
  });
});

/**
 * POST /api/public/withdraw_request
 * Запрос на вывод средств
 */
router.post('/withdraw_request', async (req, res) => {
  const user = req.user;
  const { amount, address } = req.body;

  if (!amount || !address) {
    return res.status(400).json({
      success: false,
      error: 'Amount and address are required'
    });
  }

  const settings = db.loadDB().settings || {};
  const minWithdraw = settings.minWithdraw || 10;
  const maxWithdraw = settings.maxWithdraw || 10000;

  if (amount < minWithdraw || amount > maxWithdraw) {
    return res.status(400).json({
      success: false,
      error: `Сумма должна быть от ${minWithdraw} до ${maxWithdraw} USDT`
    });
  }

  const wallet = db.find('wallets', w => w.userId === user.id);
  
  if (!wallet || wallet.usdtBalance < amount) {
    return res.status(400).json({
      success: false,
      error: 'Недостаточно средств'
    });
  }

  // Создаём заявку на вывод
  const withdrawRequest = db.insert('withdrawRequests', {
    userId: user.id,
    username: user.username,
    amount: parseFloat(amount),
    address: address.trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  // Списываем средства с баланса (замораживаем)
  db.update('wallets', wallet.id, {
    usdtBalance: wallet.usdtBalance - amount
  });

  // Уведомляем пользователя
  await telegramService.notifyWithdrawRequest(user.telegramId, amount, address);

  // Уведомляем админа
  await telegramService.notifyAdmin(
    `💸 **Новая заявка на вывод**\n\n` +
    `Пользователь: @${user.username}\n` +
    `Сумма: ${amount} USDT\n` +
    `Адрес: \`${address}\`\n\n` +
    `ID заявки: ${withdrawRequest.id}`
  );

  res.json({
    success: true,
    message: 'Заявка на вывод создана',
    request: withdrawRequest
  });
});

/**
 * POST /api/public/topup_request
 * Запрос на пополнение (генерация адреса/QR)
 */
router.post('/topup_request', (req, res) => {
  const user = req.user;
  const { amount } = req.body;

  // В реальной реализации здесь была бы генерация уникального адреса
  // Для демо используем заглушку
  const depositAddress = 'TxxxxxxxxxxxxxxxxxxxxxxxxxxxxB'; // Заглушка TRC20
  
  const topupRequest = db.insert('topupRequests', {
    userId: user.id,
    username: user.username,
    amount: amount ? parseFloat(amount) : null,
    address: depositAddress,
    status: 'waiting_payment',
    createdAt: new Date().toISOString()
  });

  res.json({
    success: true,
    depositAddress,
    qrData: `tron:${depositAddress}`,
    request: topupRequest
  });
});

/**
 * GET /api/public/wallet/history
 * История транзакций
 */
router.get('/history', (req, res) => {
  const user = req.user;
  const { limit = 50, offset = 0 } = req.query;

  // Собираем все транзакции пользователя
  const deals = db.findAll('deals', d => 
    d.buyerId === user.id || d.sellerId === user.id
  );
  
  const withdraws = db.findAll('withdrawRequests', w => w.userId === user.id);
  
  const topups = db.findAll('topupRequests', t => t.userId === user.id);

  // Формируем единую историю
  let history = [
    ...deals.map(d => ({
      id: d.id,
      type: 'deal',
      direction: d.buyerId === user.id ? 'buy' : 'sell',
      amount: d.amount,
      status: d.status,
      createdAt: d.createdAt
    })),
    ...withdraws.map(w => ({
      id: w.id,
      type: 'withdraw',
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt
    })),
    ...topups.map(t => ({
      id: t.id,
      type: 'topup',
      amount: t.amount,
      status: t.status,
      createdAt: t.createdAt
    }))
  ];

  // Сортируем по дате (новые первые)
  history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Пагинация
  const total = history.length;
  history = history.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    success: true,
    history,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

module.exports = router;
