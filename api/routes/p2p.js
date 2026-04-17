// API роуты для P2P сделок (покупка/продажа)
const express = require('express');
const router = express.Router();
const db = require('../services/database');
const telegramService = require('../services/telegram');

/**
 * GET /api/public/buy_offers
 * Получить стакан BUY заявок (кто хочет купить USDT)
 */
router.get('/buy_offers', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  // Получаем активные BUY ордера
  let offers = db.findAll('buyOffers', o => o.status === 'active');
  
  // Сортируем: лучшие цены первыми (выше цена - приоритетнее)
  offers.sort((a, b) => b.price - a.price);
  
  // Добавляем информацию о создателе
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
  
  // Пагинация
  const total = offers.length;
  offers = offers.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    offers,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

/**
 * GET /api/public/sell_offers
 * Получить стакан SELL заявок (кто хочет продать USDT)
 */
router.get('/sell_offers', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  
  // Получаем активные SELL ордера
  let offers = db.findAll('sellOffers', o => o.status === 'active');
  
  // Сортируем: лучшие цены первыми (ниже цена - приоритетнее)
  offers.sort((a, b) => a.price - b.price);
  
  // Добавляем информацию о создателе
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
  
  // Пагинация
  const total = offers.length;
  offers = offers.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({
    success: true,
    offers,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

/**
 * POST /api/public/create_buy_offer
 * Создать заявку на покупку USDT
 */
router.post('/create_buy_offer', (req, res) => {
  const user = req.user;
  const { price, minAmount, maxAmount, paymentMethods } = req.body;
  
  if (!price || !minAmount || !maxAmount) {
    return res.status(400).json({
      success: false,
      error: 'Price, minAmount and maxAmount are required'
    });
  }
  
  const offer = db.insert('buyOffers', {
    userId: user.id,
    username: user.username,
    price: parseFloat(price),
    minAmount: parseFloat(minAmount),
    maxAmount: parseFloat(maxAmount),
    availableAmount: parseFloat(maxAmount),
    paymentMethods: paymentMethods || ['Сбербанк', 'Тинькофф'],
    status: 'active',
    createdAt: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Заявка на покупку создана',
    offer
  });
});

/**
 * POST /api/public/create_sell_offer
 * Создать заявку на продажу USDT
 */
router.post('/create_sell_offer', (req, res) => {
  const user = req.user;
  const { price, minAmount, maxAmount, paymentMethods } = req.body;
  
  if (!price || !minAmount || !maxAmount) {
    return res.status(400).json({
      success: false,
      error: 'Price, minAmount and maxAmount are required'
    });
  }
  
  const offer = db.insert('sellOffers', {
    userId: user.id,
    username: user.username,
    price: parseFloat(price),
    minAmount: parseFloat(minAmount),
    maxAmount: parseFloat(maxAmount),
    availableAmount: parseFloat(maxAmount),
    paymentMethods: paymentMethods || ['Сбербанк', 'Тинькофф'],
    status: 'active',
    createdAt: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Заявка на продажу создана',
    offer
  });
});

/**
 * POST /api/public/reserve_offer
 * Забронировать ордер (создать сделку)
 */
router.post('/reserve_offer', (req, res) => {
  const user = req.user;
  const { offerId, type, amount } = req.body; // type: 'buy' или 'sell'
  
  if (!offerId || !type || !amount) {
    return res.status(400).json({
      success: false,
      error: 'Offer ID, type and amount are required'
    });
  }
  
  // Находим ордер
  const collection = type === 'buy' ? 'buyOffers' : 'sellOffers';
  const offer = db.find(collection, o => o.id === offerId);
  
  if (!offer) {
    return res.status(404).json({
      success: false,
      error: 'Ордер не найден'
    });
  }
  
  if (offer.status !== 'active') {
    return res.status(400).json({
      success: false,
      error: 'Ордер больше не активен'
    });
  }
  
  if (amount < offer.minAmount || amount > offer.availableAmount) {
    return res.status(400).json({
      success: false,
      error: `Сумма должна быть от ${offer.minAmount} до ${offer.availableAmount}`
    });
  }
  
  // Нельзя создать сделку с самим собой
  if (offer.userId === user.id) {
    return res.status(400).json({
      success: false,
      error: 'Нельзя создать сделку с самим собой'
    });
  }
  
  // Определяем покупателя и продавца
  const buyer = type === 'buy' ? user : db.find('users', u => u.id === offer.userId);
  const seller = type === 'sell' ? user : db.find('users', u => u.id === offer.userId);
  
  // Создаём сделку
  const deal = db.insert('deals', {
    type,
    buyerId: buyer.id,
    buyerUsername: buyer.username,
    sellerId: seller.id,
    sellerUsername: seller.username,
    offerId,
    amount: parseFloat(amount),
    price: offer.price,
    total: parseFloat(amount) * offer.price,
    paymentMethod: offer.paymentMethods[0],
    status: 'reserved', // reserved -> paid -> completed / cancelled
    proofImage: null,
    createdAt: new Date().toISOString()
  });
  
  // Обновляем доступную сумму ордера
  const newAvailable = offer.availableAmount - amount;
  db.update(collection, offerId, {
    availableAmount: newAvailable,
    status: newAvailable <= 0 ? 'completed' : 'active'
  });
  
  // Уведомляем продавца о новой сделке
  telegramService.notifyNewDeal(seller.telegramId, {
    type: type === 'buy' ? 'Продажа' : 'Покупка',
    amount,
    status: 'Ожидается оплата'
  });
  
  res.json({
    success: true,
    message: 'Ордер забронирован',
    deal: {
      ...deal,
      buyer: { id: buyer.id, username: buyer.username },
      seller: { id: seller.id, username: seller.username }
    }
  });
});

/**
 * POST /api/public/mark_paid
 * Покупатель отмечает оплату
 */
router.post('/mark_paid', async (req, res) => {
  const user = req.user;
  const { dealId } = req.body;
  
  const deal = db.find('deals', d => d.id === dealId);
  
  if (!deal) {
    return res.status(404).json({
      success: false,
      error: 'Сделка не найдена'
    });
  }
  
  if (deal.buyerId !== user.id) {
    return res.status(403).json({
      success: false,
      error: 'Только покупатель может отметить оплату'
    });
  }
  
  if (deal.status !== 'reserved') {
    return res.status(400).json({
      success: false,
      error: 'Сделка не в статусе ожидания оплаты'
    });
  }
  
  // Обновляем статус
  const updatedDeal = db.update('deals', dealId, {
    status: 'paid',
    paidAt: new Date().toISOString()
  });
  
  // Уведомляем продавца
  await telegramService.notifyPayment(dealId, deal.sellerId);
  
  res.json({
    success: true,
    message: 'Оплата отмечена',
    deal: updatedDeal
  });
});

/**
 * POST /api/public/submit_proof
 * Загрузить чек оплаты
 */
router.post('/submit_proof', async (req, res) => {
  const user = req.user;
  const { dealId, proofImage } = req.body; // proofImage - base64 или URL
  
  const deal = db.find('deals', d => d.id === dealId);
  
  if (!deal) {
    return res.status(404).json({
      success: false,
      error: 'Сделка не найдена'
    });
  }
  
  if (deal.buyerId !== user.id) {
    return res.status(403).json({
      success: false,
      error: 'Только покупатель может загрузить чек'
    });
  }
  
  if (deal.status !== 'paid') {
    return res.status(400).json({
      success: false,
      error: 'Сначала отметьте оплату'
    });
  }
  
  // Сохраняем чек
  const updatedDeal = db.update('deals', dealId, {
    proofImage
  });
  
  res.json({
    success: true,
    message: 'Чек загружен',
    deal: updatedDeal
  });
});

/**
 * POST /api/public/complete_deal
 * Продавец подтверждает перевод USDT (завершение сделки)
 */
router.post('/complete_deal', async (req, res) => {
  const user = req.user;
  const { dealId } = req.body;
  
  const deal = db.find('deals', d => d.id === dealId);
  
  if (!deal) {
    return res.status(404).json({
      success: false,
      error: 'Сделка не найдена'
    });
  }
  
  if (deal.sellerId !== user.id) {
    return res.status(403).json({
      success: false,
      error: 'Только продавец может завершить сделку'
    });
  }
  
  if (deal.status !== 'paid') {
    return res.status(400).json({
      success: false,
      error: 'Сделка не оплачена'
    });
  }
  
  // Переводим USDT покупателю
  const buyerWallet = db.find('wallets', w => w.userId === deal.buyerId);
  const sellerWallet = db.find('wallets', w => w.userId === deal.sellerId);
  
  if (buyerWallet && sellerWallet) {
    db.update('wallets', sellerWallet.id, {
      usdtBalance: sellerWallet.usdtBalance - deal.amount
    });
    db.update('wallets', buyerWallet.id, {
      usdtBalance: (buyerWallet.usdtBalance || 0) + deal.amount
    });
  }
  
  // Завершаем сделку
  const updatedDeal = db.update('deals', dealId, {
    status: 'completed',
    completedAt: new Date().toISOString()
  });
  
  // Обновляем статистику пользователя
  const seller = db.find('users', u => u.id === deal.sellerId);
  if (seller) {
    const completedDeals = (seller.completedDeals || 0) + 1;
    db.update('users', seller.id, { completedDeals });
  }
  
  // Уведомляем покупателя
  await telegramService.notifyDealComplete(dealId, deal.buyerId, deal.amount);
  
  res.json({
    success: true,
    message: 'Сделка завершена',
    deal: updatedDeal
  });
});

/**
 * POST /api/public/cancel_deal
 * Отмена сделки
 */
router.post('/cancel_deal', (req, res) => {
  const user = req.user;
  const { dealId, reason } = req.body;
  
  const deal = db.find('deals', d => d.id === dealId);
  
  if (!deal) {
    return res.status(404).json({
      success: false,
      error: 'Сделка не найдена'
    });
  }
  
  // Отменить может только покупатель (если не оплатил) или оба по согласию
  if (deal.buyerId !== user.id && deal.sellerId !== user.id) {
    return res.status(403).json({
      success: false,
      error: 'Недостаточно прав'
    });
  }
  
  if (deal.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Завершённую сделку нельзя отменить'
    });
  }
  
  // Возвращаем доступную сумму ордеру
  const collection = deal.type === 'buy' ? 'buyOffers' : 'sellOffers';
  const offer = db.find(collection, o => o.id === deal.offerId);
  if (offer) {
    db.update(collection, offer.id, {
      availableAmount: offer.availableAmount + deal.amount,
      status: 'active'
    });
  }
  
  // Отменяем сделку
  const updatedDeal = db.update('deals', dealId, {
    status: 'cancelled',
    cancelReason: reason,
    cancelledAt: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Сделка отменена',
    deal: updatedDeal
  });
});

/**
 * GET /api/public/deal/:id
 * Получить информацию о сделке
 */
router.get('/deal/:id', (req, res) => {
  const { id } = req.params;
  const user = req.user;
  
  const deal = db.find('deals', d => d.id === id);
  
  if (!deal) {
    return res.status(404).json({
      success: false,
      error: 'Сделка не найдена'
    });
  }
  
  // Проверка доступа (только участники сделки)
  if (deal.buyerId !== user.id && deal.sellerId !== user.id && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Нет доступа к этой сделке'
    });
  }
  
  res.json({
    success: true,
    deal
  });
});

module.exports = router;
