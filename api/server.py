"""
============================================
FranklinEx API Server (Python + aiogram)
============================================

Как запустить:
  1. Установи Python: https://python.org (скачай, установи)
  2. Открой терминал в папке api
  3. Установи библиотеки:  pip install -r requirements.txt
  4. Отредактируй .env — вставь токен бота от @BotFather
  5. Запусти:  python server.py

Сервер запустится на http://localhost:3000
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

# Добавляем папку api в путь для импортов
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Загружаем .env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

# Отладка: проверяем что загрузилось
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
if not BOT_TOKEN:
    # Пробуем прочитать вручную если load_dotenv не сработал
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("BOT_TOKEN=") and not line.startswith("#"):
                    BOT_TOKEN = line.split("=", 1)[1].strip()
                    os.environ["BOT_TOKEN"] = BOT_TOKEN
                    break
    except Exception:
        pass

API_PORT = int(os.environ.get("API_PORT", "3000"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "admin_secret_key")

# Логирование
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("franklinex")


# ===== ИМПОРТИРУЕМ МОДУЛИ =====

from aiohttp import web

# Инициализируем хранилище
from services import storage
storage.load()

# Импортируем маршруты
from routes import auth as auth_routes
from routes import public as public_routes
from routes import wallet as wallet_routes
from routes import deals as deals_routes
from routes import referrals as ref_routes
from routes import admin as admin_routes


# ===== TELEGRAM БОТ (aiogram) =====

bot_instance = None
dp = None

if BOT_TOKEN and BOT_TOKEN != "YOUR_BOT_TOKEN_HERE":
    try:
        from aiogram import Bot, Dispatcher
        from aiogram.filters import Command
        from aiogram.types import Message

        bot_instance = Bot(token=BOT_TOKEN)
        dp = Dispatcher()

        # Передаём бота в модуль авторизации
        auth_routes.set_bot(bot_instance)

        @dp.message(Command("start"))
        async def cmd_start(message: Message):
            """Обработчик команды /start"""
            username = message.from_user.username or ""
            first_name = message.from_user.first_name or "друг"

            # Сохраняем пользователя
            if username:
                storage.set_user(username, {
                    "id": str(message.from_user.id),
                    "username": username,
                    "first_name": message.from_user.first_name or "",
                    "last_name": message.from_user.last_name or ""
                })

            await message.answer(
                f"👋 Привет, {first_name}!\n\n"
                f"Я — бот обменника FranklinEx.\n\n"
                f"🔐 Чтобы войти на сайт:\n"
                f"1. Введи свой username на сайте\n"
                f"2. Я пришлю тебе код\n"
                f"3. Введи код на сайте — и готово!\n\n"
                f"Сайт: https://franklinex.org"
            )

        @dp.message(Command("help"))
        async def cmd_help(message: Message):
            await message.answer(
                "📋 Помощь\n\n"
                "🔐 Вход на сайт:\n"
                "1. Открой franklinex.org\n"
                "2. Введи свой username\n"
                "3. Получи код здесь\n"
                "4. Введи код на сайте\n\n"
                "💬 Поддержка: @FranklinEx"
            )

        log.info("Telegram bot configured OK")
    except Exception as e:
        log.error(f"Bot setup error: {e}")
        bot_instance = None
else:
    log.warning("BOT_TOKEN not set in .env - Telegram auth will not work")


# ===== СОЗДАЁМ ВЕБ-СЕРВЕР =====

app = web.Application(client_max_size=50 * 1024 * 1024)  # 50MB для чеков

# Логируем запросы
@web.middleware
async def log_middleware(request, handler):
    log.info(f"{request.method} {request.path}")
    try:
        return await handler(request)
    except Exception as e:
        log.error(f"Ошибка: {e}")
        return web.json_response({"ok": False, "error": str(e)})

app.middlewares.append(log_middleware)

# ===== ПОДКЛЮЧАЕМ МАРШРУТЫ =====

# Авторизация
app.router.add_post("/api/public/auth/request_code", auth_routes.request_code_handler)
app.router.add_post("/api/public/auth/verify_code", auth_routes.verify_code_handler)
app.router.add_post("/api/public/auth/register", auth_routes.register_handler)
app.router.add_get("/api/public/auth/me", auth_routes.me_handler)
app.router.add_post("/api/public/auth/logout", auth_routes.logout_handler)

# Публичные
app.router.add_get("/api/public/rapira_rate", public_routes.rapira_rate_handler)
app.router.add_get("/api/public/quotes", public_routes.quotes_handler)
app.router.add_get("/api/public/buy_offers", public_routes.buy_offers_handler)
app.router.add_get("/api/public/sell_offers", public_routes.sell_offers_handler)
app.router.add_get("/api/public/order_info", public_routes.order_info_handler)
app.router.add_get("/api/public/sell_status", public_routes.sell_status_handler)
app.router.add_get("/api/public/buy_lock_status", public_routes.buy_lock_status_handler)
app.router.add_get("/api/public/buy_amount_request_status", public_routes.buy_amount_request_status_handler)
app.router.add_post("/api/public/log_attempt", public_routes.log_attempt_handler)
app.router.add_post("/api/public/resume_notify", public_routes.resume_notify_handler)

# Кошелёк
app.router.add_get("/api/public/wallet/balance", wallet_routes.balance_handler)
app.router.add_get("/api/public/balance", wallet_routes.balance_handler)
app.router.add_post("/api/public/set_wallet", wallet_routes.set_wallet_handler)
app.router.add_post("/api/public/withdraw_request", wallet_routes.withdraw_request_handler)
app.router.add_post("/api/public/withdraw_video", wallet_routes.withdraw_video_handler)

# Сделки
app.router.add_post("/api/public/reserve_offer", deals_routes.reserve_offer_handler)
app.router.add_post("/api/public/mark_paid", deals_routes.mark_paid_handler)
app.router.add_post("/api/public/cancel_reserve", deals_routes.cancel_reserve_handler)
app.router.add_post("/api/public/submit_proof", deals_routes.submit_proof_handler)
app.router.add_post("/api/public/cancel_proof", deals_routes.cancel_proof_handler)
app.router.add_post("/api/public/cancel_skip_proof", deals_routes.cancel_skip_proof_handler)
app.router.add_post("/api/public/choose_route", deals_routes.choose_route_handler)
app.router.add_post("/api/public/sell_submit", deals_routes.sell_submit_handler)
app.router.add_post("/api/public/sell_submit_extra_check", deals_routes.sell_submit_extra_check_handler)

# Реферальная система
app.router.add_get("/api/public/ref/me", ref_routes.ref_me_handler)
app.router.add_post("/api/public/ref/apply", ref_routes.ref_apply_handler)
app.router.add_post("/api/public/ref/set", ref_routes.ref_set_handler)
app.router.add_post("/api/public/ref/withdraw", ref_routes.ref_withdraw_handler)

# Админка
app.router.add_get("/api/admin/users", admin_routes.admin_users_handler)
app.router.add_get("/api/admin/deals", admin_routes.admin_deals_handler)
app.router.add_post("/api/admin/broadcast", admin_routes.admin_broadcast_handler)
app.router.add_get("/api/admin/stats", admin_routes.admin_stats_handler)
app.router.add_get("/api/admin/config", admin_routes.admin_config_handler)

# Корневой маршрут
async def index_handler(request):
    return web.json_response({
        "ok": True,
        "name": "FranklinEx API",
        "version": "1.0.0",
        "python": True,
        "endpoints": {
            "auth": "/api/public/auth/request_code, /api/public/auth/verify_code, /api/public/auth/me",
            "public": "/api/public/rapira_rate, /api/public/buy_offers, /api/public/sell_offers",
            "wallet": "/api/public/wallet/balance, /api/public/set_wallet",
            "deals": "/api/public/reserve_offer, /api/public/mark_paid, /api/public/sell_submit",
            "referrals": "/api/public/ref/me, /api/public/ref/apply",
            "admin": "/api/admin/users, /api/admin/deals, /api/admin/stats"
        }
    })

app.router.add_get("/", index_handler)


# ===== ЗАПУСК =====

async def main():
    """Запускаем и бота, и API сервер одновременно"""

    # Проверяем, занят ли порт
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("0.0.0.0", API_PORT))
        sock.close()
    except OSError:
        log.error(f"Порт {API_PORT} уже занят! Завершите процесс или измените API_PORT в .env")
        log.info(f"Чтобы найти процесс: netstat -ano | findstr :{API_PORT}")
        log.info(f"Чтобы убить процесс: taskkill /PID <PID> /F")
        return

    print("")
    print("=" * 50)
    print("  FranklinEx API Server (Python + aiogram)")
    print(f"  http://localhost:{API_PORT}")
    print("=" * 50)
    print("")
    bot_status = "✅ OK" if bot_instance else "❌ NOT configured (edit api/.env)"
    print(f"Telegram bot: {bot_status}")
    print(f"BOT_TOKEN: {'✅ загружен' if BOT_TOKEN else '❌ пустой'}")
    print("")
    print("Test: open in browser:")
    print(f"  http://localhost:{API_PORT}/api/public/rapira_rate")
    print("")
    print("Stop: Ctrl+C")
    print("")

    # Запускаем и бота, и сервер
    runners = []

    # API сервер
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", API_PORT)
    await site.start()
    runners.append(runner)

    # Telegram бот (если настроен)
    if bot_instance and dp:
        log.info("Starting Telegram bot polling...")
        # Запускаем polling в фоне
        asyncio.create_task(dp.start_polling(bot_instance))

    # Ждём вечно
    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        log.info("Server stopping...")
        for runner in runners:
            await runner.cleanup()
        if bot_instance:
            await bot_instance.session.close()


if __name__ == "__main__":
    asyncio.run(main())
