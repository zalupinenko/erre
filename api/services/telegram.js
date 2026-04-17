// Telegram сервис для отправки кодов авторизации и уведомлений
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

class TelegramService {
  constructor() {
    this.bot = null;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.initialized = false;
    
    if (this.token && this.token !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      this.init();
    }
  }

  init() {
    try {
      this.bot = new TelegramBot(this.token, { polling: true });
      this.initialized = true;
      console.log('✅ Telegram bot initialized');
      
      // Обработчик команды /start
      this.bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        this.bot.sendMessage(chatId, 
          '👋 Добро пожаловать в FranklinEx!\n\n' +
          'Используйте этот бот для:\n' +
          '• Получения кодов авторизации\n' +
          '• Уведомлений о сделках\n' +
          '• Поддержки\n\n' +
          'Для авторизации на платформе используйте код из личного сообщения.'
        );
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error.message);
      this.initialized = false;
      return false;
    }
  }

  // Отправка кода авторизации
  async sendAuthCode(telegramId, code) {
    if (!this.initialized || !this.bot) {
      console.log('⚠️ Telegram not initialized, simulating code send');
      console.log(`📱 Auth code for ${telegramId}: ${code}`);
      return { success: true, simulated: true, code };
    }

    try {
      await this.bot.sendMessage(telegramId,
        `🔐 **Код авторизации FranklinEx**\n\n` +
        `Ваш код: \`${code}\`\n\n` +
        `Действует 5 минут.\n` +
        `Никому не сообщайте этот код!`,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Auth code sent to ${telegramId}`);
      return { success: true, simulated: false };
    } catch (error) {
      console.error('❌ Error sending auth code:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Уведомление о новой сделке
  async notifyNewDeal(userId, dealInfo) {
    if (!this.initialized || !this.bot) return { success: false, simulated: true };

    try {
      await this.bot.sendMessage(userId,
        `💼 **Новая сделка**\n\n` +
        `Тип: ${dealInfo.type}\n` +
        `Сумма: ${dealInfo.amount} USDT\n` +
        `Статус: ${dealInfo.status}`,
        { parse_mode: 'Markdown' }
      );
      return { success: true };
    } catch (error) {
      console.error('Error sending deal notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Уведомление об оплате
  async notifyPayment(dealId, userId) {
    if (!this.initialized || !this.bot) return { success: false, simulated: true };

    try {
      await this.bot.sendMessage(userId,
        `✅ **Оплата подтверждена**\n\n` +
        `Сделка #${dealId.substring(0, 8)}\n` +
        `Продавец получил оплату и должен подтвердить перевод USDT.`,
        { parse_mode: 'Markdown' }
      );
      return { success: true };
    } catch (error) {
      console.error('Error sending payment notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Уведомление о завершении сделки
  async notifyDealComplete(dealId, userId, amount) {
    if (!this.initialized || !this.bot) return { success: false, simulated: true };

    try {
      await this.bot.sendMessage(userId,
        `🎉 **Сделка завершена**\n\n` +
        `Сделка #${dealId.substring(0, 8)}\n` +
        `Сумма: ${amount} USDT\n` +
        `Средства зачислены на ваш баланс!`,
        { parse_mode: 'Markdown' }
      );
      return { success: true };
    } catch (error) {
      console.error('Error sending completion notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Уведомление о выводе средств
  async notifyWithdrawRequest(userId, amount, address) {
    if (!this.initialized || !this.bot) return { success: false, simulated: true };

    try {
      await this.bot.sendMessage(userId,
        `💸 **Запрос на вывод**\n\n` +
        `Сумма: ${amount} USDT\n` +
        `Адрес: \`${address}\`\n\n` +
        `Заявка обрабатывается администратором.`,
        { parse_mode: 'Markdown' }
      );
      return { success: true };
    } catch (error) {
      console.error('Error sending withdraw notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Рассылка админу
  async notifyAdmin(message) {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (!this.initialized || !this.bot || !adminChatId) {
      console.log('⚠️ Admin notification:', message);
      return { success: false, simulated: true };
    }

    try {
      await this.bot.sendMessage(adminChatId, message, { parse_mode: 'Markdown' });
      return { success: true };
    } catch (error) {
      console.error('Error sending admin notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      hasToken: !!this.token && this.token !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE',
      token: this.token ? this.token.substring(0, 10) + '...' : null
    };
  }
}

module.exports = new TelegramService();
