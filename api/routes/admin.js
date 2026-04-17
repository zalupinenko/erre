// API роуты для админ-панели
const express = require('express');
const router = express.Router();
const db = require('../services/database');
const telegramService = require('../services/telegram');

/**
 * GET /api/admin/users
 * Получить всех пользователей
 */
router.get('/users', (req, res) => {
  const { limit = 100, offset = 0, search } = req.query;
  
  let users = db.getCollection('users');
  
  // Поиск по username
  if (search) {
    users = users.filter(u => 
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.telegramId?.includes(search)
    );
  }
  
  // Пагинация
  const total = users.length;
  users = users.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    users,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

/**
 * GET /api/admin/deals
 * Получить все сделки
 */
router.get('/deals', (req, res) => {
  const { limit = 100, offset = 0, status, type } = req.query;
  
  let deals = db.getCollection('deals');
  
  // Фильтры
  if (status) {
    deals = deals.filter(d => d.status === status);
  }
  if (type) {
    deals = deals.filter(d => d.type === type);
  }
  
  // Сортировка по дате (новые первые)
  deals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Пагинация
  const total = deals.length;
  deals = deals.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    deals,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

/**
 * GET /api/admin/withdraw_requests
 * Заявки на вывод
 */
router.get('/withdraw_requests', (req, res) => {
  const { status = 'pending' } = req.query;
  
  let requests = db.findAll('withdrawRequests', r => r.status === status);
  
  // Сортировка по дате (старые первые)
  requests.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  res.json({
    success: true,
    requests
  });
});

/**
 * POST /api/admin/approve_withdraw
 * Одобрить заявку на вывод
 */
router.post('/approve_withdraw', async (req, res) => {
  const { requestId } = req.body;
  
  const request = db.find('withdrawRequests', r => r.id === requestId);
  
  if (!request) {
    return res.status(404).json({
      success: false,
      error: 'Заявка не найдена'
    });
  }
  
  if (request.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Заявка уже обработана'
    });
  }
  
  // Обновляем статус
  const updatedRequest = db.update('withdrawRequests', requestId, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: req.user.id
  });
  
  // Уведомляем пользователя
  const user = db.find('users', u => u.id === request.userId);
  if (user) {
    await telegramService.notifyAdmin(
      `✅ **Вывод одобрен**\n\n` +
      `Пользователь: @${user.username}\n` +
      `Сумма: ${request.amount} USDT\n` +
      `Адрес: \`${request.address}\``
    );
  }
  
  res.json({
    success: true,
    message: 'Заявка одобрена',
    request: updatedRequest
  });
});

/**
 * POST /api/admin/reject_withdraw
 * Отклонить заявку на вывод
 */
router.post('/reject_withdraw', async (req, res) => {
  const { requestId, reason } = req.body;
  
  const request = db.find('withdrawRequests', r => r.id === requestId);
  
  if (!request) {
    return res.status(404).json({
      success: false,
      error: 'Заявка не найдена'
    });
  }
  
  if (request.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Заявка уже обработана'
    });
  }
  
  // Возвращаем средства на баланс
  const wallet = db.find('wallets', w => w.userId === request.userId);
  if (wallet) {
    db.update('wallets', wallet.id, {
      usdtBalance: wallet.usdtBalance + request.amount
    });
  }
  
  // Обновляем статус
  const updatedRequest = db.update('withdrawRequests', requestId, {
    status: 'rejected',
    rejectReason: reason,
    rejectedAt: new Date().toISOString(),
    rejectedBy: req.user.id
  });
  
  res.json({
    success: true,
    message: 'Заявка отклонена',
    request: updatedRequest
  });
});

/**
 * GET /api/admin/stats
 * Статистика для админки
 */
router.get('/stats', (req, res) => {
  const deals = db.getCollection('deals');
  const users = db.getCollection('users');
  const withdraws = db.getCollection('withdrawRequests');
  
  const completedDeals = deals.filter(d => d.status === 'completed');
  const pendingDeals = deals.filter(d => ['reserved', 'paid'].includes(d.status));
  const totalVolume = completedDeals.reduce((sum, d) => sum + d.amount, 0);
  const pendingWithdraws = withdraws.filter(w => w.status === 'pending');
  const pendingWithdrawAmount = pendingWithdraws.reduce((sum, w) => sum + w.amount, 0);
  
  res.json({
    success: true,
    stats: {
      totalUsers: users.length,
      totalDeals: deals.length,
      completedDeals: completedDeals.length,
      pendingDeals: pendingDeals.length,
      totalVolumeUSDT: totalVolume,
      pendingWithdraws: pendingWithdraws.length,
      pendingWithdrawAmount,
      todayDeals: deals.filter(d => {
        const today = new Date().toDateString();
        return new Date(d.createdAt).toDateString() === today;
      }).length
    }
  });
});

/**
 * POST /api/admin/update_settings
 * Обновить настройки платформы
 */
router.post('/update_settings', (req, res) => {
  const { settings } = req.body;
  
  const dbData = db.loadDB();
  dbData.settings = { ...dbData.settings, ...settings };
  db.saveDB(dbData);
  
  res.json({
    success: true,
    message: 'Настройки обновлены',
    settings: dbData.settings
  });
});

/**
 * GET /api/admin/system_info
 * Системная информация
 */
router.get('/system_info', (req, res) => {
  const telegramStatus = telegramService.getStatus();
  
  res.json({
    success: true,
    info: {
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      telegram: telegramStatus,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

module.exports = router;
