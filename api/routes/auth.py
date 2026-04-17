"""
Маршруты авторизации

Как работает вход:
1. Пользователь вводит username на сайте
2. Сайт просит сервер отправить код → POST /api/public/auth/request_code
3. Сервер генерирует 6-значный код и отправляет его в Telegram через бота
4. Пользователь видит код в Telegram и вводит на сайте
5. Сайт отправляет код на сервер → POST /api/public/auth/verify_code
6. Сервер проверяет код и выдаёт токен
7. Токен сохраняется в браузере для всех запросов
"""

import random
import time
import string
from aiohttp import web
from aiogram import Bot

from services import storage

# Bot будет установлен из server.py
bot: Bot = None


def set_bot(b: Bot):
    """Установить экземпляр бота (вызывается из server.py)"""
    global bot
    bot = b


def generate_code():
    """Генерация 6-значного кода"""
    return str(random.randint(100000, 999999))


async def request_code_handler(request):
    """
    POST /api/public/auth/request_code
    Отправить код авторизации в Telegram

    Запрос: {"username": "@durov"}
    Ответ: {"ok": true, "message": "Код отправлен"}
    """
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    username = body.get("username", "").replace("@", "").strip()
    ref_code = body.get("refCode", "").strip()

    if not username or len(username) < 3:
        return web.json_response({"ok": False, "error": "Некорректный username"})

    # Проверяем, что пользователь нажал /start у бота
    if bot is None:
        return web.json_response({"ok": False, "error": "Бот не настроен. Проверь BOT_TOKEN в .env"})

    # Проверяем, что пользователь существует в базе (нажал /start)
    user_data = storage.get_user(username)
    if not user_data or not user_data.get("id"):
        return web.json_response({
            "ok": False,
            "error": "Пользователь не нажал /start в боте. Откройте бота и нажмите /start"
        })

    # Получаем chat_id из данных пользователя
    chat_id = user_data["id"]

    # Генерируем код
    code = generate_code()
    expires_at = int(time.time() * 1000) + 10 * 60 * 1000  # 10 минут

    # Сохраняем код
    storage.save_code(username, code, expires_at)

    # Отправляем код в Telegram
    message = (
        f"🔐 <b>Код для входа в FranklinEx</b>\n\n"
        f"Ваш код: <code>{code}</code>\n\n"
        f"Действует 10 минут.\n"
        f"Если вы не запрашивали код — проигнорируйте это сообщение."
    )

    try:
        await bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode="HTML"
        )
    except Exception as e:
        print(f"Ошибка отправки в Telegram: {e}")
        return web.json_response({
            "ok": False,
            "error": f"Не удалось отправить код: {str(e)}"
        })

    # Сохраняем реферальный код если передан
    if ref_code:
        ref = storage.get_referral(username)
        if ref and not ref.get("pendingRefCode"):
            ref["pendingRefCode"] = ref_code
            storage.set_referral(username, ref)

    return web.json_response({"ok": True, "message": "Код отправлен в Telegram"})


async def verify_code_handler(request):
    """
    POST /api/public/auth/verify_code
    Проверить код и войти

    Запрос: {"username": "@durov", "code": "123456"}
    Ответ: {"ok": true, "userToken": "abc...", "user": {...}}
    """
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    username = body.get("username", "").replace("@", "").strip()
    code = str(body.get("code", "")).strip()

    if not username or not code:
        return web.json_response({"ok": False, "error": "Укажите username и код"})

    stored = storage.get_code(username)

    # Проверяем, что код был запрошен
    if not stored:
        return web.json_response({"ok": False, "error": "Код не был запрошен или истёк"})

    # Проверяем срок действия
    if int(time.time() * 1000) > stored["expiresAt"]:
        storage.remove_code(username)
        return web.json_response({"ok": False, "error": "Код истёк. Запросите новый"})

    # Проверяем код
    if stored["code"] != code:
        return web.json_response({"ok": False, "error": "Неверный код"})

    # Код верный — удаляем (одноразовый)
    storage.remove_code(username)

    # Получаем/создаём пользователя
    user_data = storage.get_user(username)
    if not user_data:
        # Пробуем получить данные из Telegram
        if bot:
            try:
                chat = await bot.get_chat(chat_id="@" + username)
                user_data = {
                    "id": str(chat.id),
                    "username": username,
                    "first_name": chat.first_name or "",
                    "last_name": chat.last_name or ""
                }
            except Exception:
                user_data = {"id": str(int(time.time())), "username": username, "first_name": ""}
        else:
            user_data = {"id": str(int(time.time())), "username": username, "first_name": ""}

        storage.set_user(username, user_data)

    # Генерируем токен
    token = storage.generate_token()
    storage.save_token(token, username)

    # Создаём реферальный код если нет
    ref = storage.get_referral(username)
    if not ref:
        ref_code = "FE-" + username.upper()[:4] + "-" + ''.join(
            random.choices(string.ascii_uppercase + string.digits, k=6)
        )
        ref = {
            "code": ref_code,
            "balance": 0,
            "referrer": None,
            "pendingRefCode": None,
            "createdAt": int(time.time() * 1000)
        }
        storage.set_referral(username, ref)

    # Применяем pending реферальный код
    if ref.get("pendingRefCode") and not ref.get("referrer"):
        ref["referrer"] = ref["pendingRefCode"]
        ref.pop("pendingRefCode", None)
        storage.set_referral(username, ref)

    # Создаём кошелёк если нет
    wallet = storage.get_wallet(username)
    if not wallet.get("address") and wallet.get("balance", 0) == 0:
        storage.set_wallet(username, {"address": "", "balance": 0})

    return web.json_response({
        "ok": True,
        "userToken": token,
        "user": {**user_data, "username": username}
    })


async def me_handler(request):
    """
    GET /api/public/auth/me
    Получить информацию о текущем пользователе

    Заголовок: X-User-Token: <токен>
    """
    token = request.headers.get("X-User-Token", "") or \
            request.headers.get("X-Auth-Token", "") or \
            request.headers.get("Authorization", "").replace("Bearer ", "")

    if not token:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    username = storage.get_username_by_token(token)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    user = storage.get_user(username)
    if not user:
        return web.json_response({"ok": False, "error": "User not found"})

    return web.json_response({
        "ok": True,
        "user": {**user, "username": username}
    })


async def logout_handler(request):
    """POST /api/public/auth/logout"""
    token = request.headers.get("X-User-Token", "") or request.headers.get("X-Auth-Token", "")
    if token:
        storage.remove_token(token)
    return web.json_response({"ok": True})


async def register_handler(request):
    """POST /api/public/auth/register"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    username = body.get("username", "").replace("@", "").strip()
    if not username:
        return web.json_response({"ok": False, "error": "Укажите username"})

    # Проверяем бота
    if bot:
        try:
            await bot.get_chat(chat_id="@" + username)
        except Exception:
            return web.json_response({"ok": False, "error": "Пользователь не нажал /start в боте"})

    # Создаём/получаем пользователя
    user_data = storage.get_user(username)
    if not user_data:
        user_data = {"id": str(int(time.time())), "username": username, "first_name": ""}
        storage.set_user(username, user_data)

    token = storage.generate_token()
    storage.save_token(token, username)

    # Реферальный код
    if not storage.get_referral(username):
        ref_code = "FE-" + username.upper()[:4] + "-" + ''.join(
            random.choices(string.ascii_uppercase + string.digits, k=6)
        )
        storage.set_referral(username, {
            "code": ref_code, "balance": 0, "referrer": None,
            "createdAt": int(time.time() * 1000)
        })

    # Кошелёк
    wallet = storage.get_wallet(username)
    if not wallet.get("address") and wallet.get("balance", 0) == 0:
        storage.set_wallet(username, {"address": "", "balance": 0})

    return web.json_response({
        "ok": True,
        "userToken": token,
        "user": {**user_data, "username": username}
    })
