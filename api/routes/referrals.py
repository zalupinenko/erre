"""
Маршруты реферальной системы
"""

import time
import random
import string
from aiohttp import web

from services import storage


def get_username_from_request(request):
    """Получить username из токена"""
    token = request.headers.get("X-User-Token", "") or \
            request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return None
    return storage.get_username_by_token(token)


async def ref_me_handler(request):
    """GET /api/public/ref/me — Реферальные данные"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    ref = storage.get_referral(username)
    if not ref:
        ref_code = "FE-" + username.upper()[:4] + "-" + ''.join(
            random.choices(string.ascii_uppercase + string.digits, k=6)
        )
        ref = {
            "code": ref_code,
            "balance": 0,
            "referrer": None,
            "createdAt": int(time.time() * 1000)
        }
        storage.set_referral(username, ref)

    return web.json_response({"ok": True, "ref": ref})


async def ref_apply_handler(request):
    """POST /api/public/ref/apply — Применить реферальный код"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    code = body.get("code", "").strip()
    if not code:
        return web.json_response({"ok": False, "error": "Укажите реферальный код"})

    ref = storage.get_referral(username)
    if not ref:
        ref = {"code": "", "balance": 0, "referrer": None, "createdAt": int(time.time() * 1000)}

    if ref.get("referrer"):
        return web.json_response({"ok": False, "error": "Реферальный код уже привязан к аккаунту"})

    ref["referrer"] = code
    storage.set_referral(username, ref)

    return web.json_response({"ok": True, "message": "Код применён"})


async def ref_set_handler(request):
    """POST /api/public/ref/set — Установить реферальный код"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    code = body.get("code", "").strip()
    if not code:
        return web.json_response({"ok": False, "error": "Укажите код"})

    ref = storage.get_referral(username)
    if not ref:
        ref = {"code": "", "balance": 0, "referrer": None, "createdAt": int(time.time() * 1000)}

    if ref.get("referrer"):
        return web.json_response({"ok": False, "error": "Реферальный код уже привязан"})

    ref["referrer"] = code
    storage.set_referral(username, ref)

    return web.json_response({"ok": True, "message": "Код привязан"})


async def ref_withdraw_handler(request):
    """POST /api/public/ref/withdraw — Вывод реферальных бонусов"""
    username = get_username_from_request(request)
    if not username:
        return web.json_response({"ok": False, "error": "Unauthorized"})

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    amount = float(body.get("amountUsdt", 0))
    if amount <= 0:
        return web.json_response({"ok": False, "error": "Укажите сумму"})

    ref = storage.get_referral(username)
    if not ref or float(ref.get("balance", 0)) < amount:
        return web.json_response({"ok": False, "error": "Недостаточно бонусов"})

    # Переводим бонусы на основной баланс
    ref["balance"] = float(ref.get("balance", 0)) - amount
    storage.set_referral(username, ref)

    wallet = storage.get_wallet(username)
    wallet["balance"] = float(wallet.get("balance", 0)) + amount
    storage.set_wallet(username, wallet)

    return web.json_response({"ok": True, "message": "Бонусы зачислены на баланс кошелька"})
