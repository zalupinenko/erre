// API роуты для системных данных (курсы, настройки)
const express = require('express');
const router = express.Router();
const db = require('../services/database');

/**
 * GET /api/public/rapira_rate
 * Получить курс USDT/RUB (заглушка, в реальности - парсинг Rapira)
 */
router.get('/rapira_rate', (req, res) => {
  const settings = db.loadDB().settings || {};
  
  // В реальной реализации здесь был бы запрос к API Rapira
  // Для демо используем значение из настроек + небольшой разброс
  const baseRate = settings.usdRubRate || 95.0;
  
  res.json({
    success: true,
    rate: {
      buy: baseRate + 0.5,   // Покупка (клиент покупает USDT)
      sell: baseRate - 0.5,  // Продажа (клиент продаёт USDT)
      mid: baseRate
    },
    source: 'franklinex',
    updatedAt: new Date().toISOString()
  });
});

/**
 * GET /api/public/settings
 * Получить публичные настройки платформы
 */
router.get('/settings', (req, res) => {
  const settings = db.loadDB().settings || {};
  
  res.json({
    success: true,
    settings: {
      minWithdraw: settings.minWithdraw || 10,
      maxWithdraw: settings.maxWithdraw || 10000,
      withdrawalFee: settings.withdrawalFee || 1.5,
      usdRubRate: settings.usdRubRate || 95.0,
      minBuyAmount: 100,
      maxBuyAmount: 500000,
      minSellAmount: 100,
      maxSellAmount: 500000,
      supportedPaymentMethods: ['Сбербанк', 'Тинькофф', 'Альфа-Банк', 'ВТБ'],
      maintenance: false
    }
  });
});

/**
 * GET /api/public/stats
 * Публичная статистика платформы
 */
router.get('/stats', (req, res) => {
  const deals = db.getCollection('deals');
  const users = db.getCollection('users');
  
  const completedDeals = deals.filter(d => d.status === 'completed');
  const totalVolume = completedDeals.reduce((sum, d) => sum + d.amount, 0);
  
  res.json({
    success: true,
    stats: {
      totalUsers: users.length,
      totalDeals: deals.length,
      completedDeals: completedDeals.length,
      totalVolumeUSDT: totalVolume,
      activeOffers: {
        buy: db.findAll('buyOffers', o => o.status === 'active').length,
        sell: db.findAll('sellOffers', o => o.status === 'active').length
      }
    }
  });
});

module.exports = router;
