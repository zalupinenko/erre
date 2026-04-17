"""
Маршруты кошелька — баланс, пополнение, вывод
"""

from aiohttp import web

from services import storage


def get_username_from_request(request):
    """Получить username из токена в заголовке"""
    token = request.headers.get("X-User-Token", "") or \
            request.headers.get("Authorization", "").replace("Bearer ", "")

    if not token:
        return None
    return storage.get_username_by_token(token)


async def balance_handler(request):
    """GET /api/public/wallet/balance — Получить баланс"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    wallet = storage.get_wallet(username)
    return web.json_response({
        "ok": True,
        "balance": wallet.get("balance", 0),
        "address": wallet.get("address", "")
    })


async def set_wallet_handler(request):
    """POST /api/public/set_wallet — Установить адрес кошелька"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    address = body.get("address", "").strip()
    if not address:
        return web.json_response({"ok": False, "error": "Укажите адрес кошелька"})

    wallet = storage.get_wallet(username)
    wallet["address"] = address
    storage.set_wallet(username, wallet)

    return web.json_response({"ok": True, "message": "Адрес сохранён"})


async def withdraw_request_handler(request):
    """POST /api/public/withdraw_request — Запрос на вывод"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    amount = float(body.get("amountUsdt", 0))
    wallet = storage.get_wallet(username)

    if amount <= 0:
        return web.json_response({"ok": False, "error": "Укажите сумму"})

    if amount > wallet.get("balance", 0):
        return web.json_response({"ok": False, "error": "Недостаточно средств"})

    wallet["balance"] -= amount
    storage.set_wallet(username, wallet)

    return web.json_response({"ok": True, "message": "Заявка на вывод создана"})


async def withdraw_video_handler(request):
    """POST /api/public/withdraw_video — Видео-подтверждение"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    return web.json_response({"ok": True, "message": "Видео получено"})
