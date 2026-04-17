// FranklinEx Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authMiddleware, adminMiddleware } = require('./middleware/auth');
const db = require('./services/database');

// Импорт роутов
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const p2pRoutes = require('./routes/p2p');
const systemRoutes = require('./routes/system');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Инициализация базы данных
db.initializeDB();

// ==================== PUBLIC ROUTES ====================

// Авторизация
app.use('/api/public/auth', authRoutes);

// Кошелёк (требует авторизации)
app.use('/api/public/wallet', authMiddleware, walletRoutes);

// P2P сделки (GET endpoints без авторизации)
app.get('/api/public/buy_offers', (req, res) => {
  const db = require('./services/database');
  const { limit = 50, offset = 0 } = req.query;
  let offers = db.findAll('buyOffers', o => o.status === 'active');
  offers.sort((a, b) => b.price - a.price);
  offers = offers.map(offer => {
    const user = db.find('users', u => u.id === offer.userId);
    return {
      ...offer,
      trader: {
        username: user?.username || 'Unknown',
        completedDeals: user?.completedDeals || 0,
        completionRate: user?.completionRate || 100
      }
    };
  });
  const total = offers.length;
  offers = offers.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ success: true, offers, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
});

app.get('/api/public/sell_offers', (req, res) => {
  const db = require('./services/database');
  const { limit = 50, offset = 0 } = req.query;
  let offers = db.findAll('sellOffers', o => o.status === 'active');
  offers.sort((a, b) => a.price - b.price);
  offers = offers.map(offer => {
    const user = db.find('users', u => u.id === offer.userId);
    return {
      ...offer,
      trader: {
        username: user?.username || 'Unknown',
        completedDeals: user?.completedDeals || 0,
        completionRate: user?.completionRate || 100
      }
    };
  });
  const total = offers.length;
  offers = offers.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ success: true, offers, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
});

// P2P сделки (POST endpoints с авторизацией)
app.use('/api/public/create_buy_offer', authMiddleware, p2pRoutes);
app.use('/api/public/create_sell_offer', authMiddleware, p2pRoutes);
app.use('/api/public/reserve_offer', authMiddleware, p2pRoutes);
app.use('/api/public/mark_paid', authMiddleware, p2pRoutes);
app.use('/api/public/submit_proof', authMiddleware, p2pRoutes);
app.use('/api/public/complete_deal', authMiddleware, p2pRoutes);
app.use('/api/public/cancel_deal', authMiddleware, p2pRoutes);
app.use('/api/public/deal', authMiddleware, p2pRoutes);

// Системные эндпоинты
app.use('/api/public/rapira_rate', (req, res) => {
  const db = require('./services/database');
  const settings = db.loadDB().settings || {};
  const baseRate = settings.usdRubRate || 95.0;
  res.json({
    success: true,
    rate: { buy: baseRate + 0.5, sell: baseRate - 0.5, mid: baseRate },
    source: 'franklinex',
    updatedAt: new Date().toISOString()
  });
});

app.use('/api/public/settings', (req, res) => {
  const db = require('./services/database');
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

app.use('/api/public/stats', (req, res) => {
  const db = require('./services/database');
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

// ==================== ADMIN ROUTES ====================

app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log('===========================================');
  console.log('🚀 FranklinEx API Server Started');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || '*'}`);
  console.log('===========================================');
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/public/auth/request_code');
  console.log('  POST /api/public/auth/verify_code');
  console.log('  GET  /api/public/auth/me');
  console.log('  GET  /api/public/wallet/balance');
  console.log('  POST /api/public/set_wallet');
  console.log('  POST /api/public/withdraw_request');
  console.log('  GET  /api/public/buy_offers');
  console.log('  GET  /api/public/sell_offers');
  console.log('  POST /api/public/create_buy_offer');
  console.log('  POST /api/public/create_sell_offer');
  console.log('  POST /api/public/reserve_offer');
  console.log('  POST /api/public/mark_paid');
  console.log('  POST /api/public/submit_proof');
  console.log('  POST /api/public/complete_deal');
  console.log('  GET  /api/public/rapira_rate');
  console.log('  GET  /api/public/settings');
  console.log('  GET  /api/admin/users');
  console.log('  GET  /api/admin/deals');
  console.log('===========================================');
});

module.exports = app;
