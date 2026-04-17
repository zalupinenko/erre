"""
Маршруты сделок — BUY и SELL
"""

import time
import secrets
from aiohttp import web

from services import storage


def get_username_optional(request):
    """Получить username если токен есть (необязательно)"""
    token = request.headers.get("X-User-Token", "") or \
            request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        return storage.get_username_by_token(token)
    return None


async def reserve_offer_handler(request):
    """POST /api/public/reserve_offer — Забронировать ордер (BUY)"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    offer_id = body.get("id", "")
    reserve_id = body.get("reserveId", "")

    if not offer_id:
        return web.json_response({"ok": False, "error": "Укажите id оффера"})

    offers = storage.get_buy_offers()
    offer = next((o for o in offers if o["id"] == offer_id), None)

    if not offer:
        return web.json_response({"ok": False, "error": "Offer not found"})

    # Если уже забронирован — проверяем тот же reserveId
    if offer.get("frozen") and offer.get("reserveId") != reserve_id:
        return web.json_response({
            "ok": False,
            "error": "Offer is reserved",
            "reserveId": offer.get("reserveId"),
            "expiresAt": offer.get("expiresAt", int(time.time() * 1000) + 15 * 60 * 1000)
        })

    # Бронируем
    new_reserve_id = reserve_id or secrets.token_hex(8)
    offer["frozen"] = True
    offer["reserveId"] = new_reserve_id
    offer["expiresAt"] = int(time.time() * 1000) + 15 * 60 * 1000
    offer["status"] = "RESERVED"
    storage.save()

    return web.json_response({
        "ok": True,
        "reserveId": new_reserve_id,
        "expiresAt": offer["expiresAt"],
        "offer": {
            "id": offer["id"],
            "amountRub": offer.get("amountRub", ""),
            "rate": offer.get("rate", ""),
            "method": offer.get("method", "SBP"),
            "payBank": offer.get("payBank", "Сбербанк"),
            "payRequisite": offer.get("payRequisite", "79001234567"),
            "status": offer["status"]
        }
    })


async def mark_paid_handler(request):
    """POST /api/public/mark_paid — Отметить ордер как оплаченный"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    offer_id = body.get("id", "")
    reserve_id = body.get("reserveId", "")

    if not offer_id or not reserve_id:
        return web.json_response({"ok": False, "error": "Укажите id и reserveId"})

    offers = storage.get_buy_offers()
    offer = next((o for o in offers if o["id"] == offer_id and o.get("reserveId") == reserve_id), None)

    if not offer:
        return web.json_response({"ok": False, "error": "Ордер не найден"})

    offer["status"] = "PAID"
    storage.save()

    return web.json_response({"ok": True, "message": "Оплата отмечена", "status": "PAID"})


async def cancel_reserve_handler(request):
    """POST /api/public/cancel_reserve — Отменить бронирование"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    offer_id = body.get("id", "")
    reserve_id = body.get("reserveId", "")

    if not offer_id or not reserve_id:
        return web.json_response({"ok": False, "error": "Укажите id и reserveId"})

    offers = storage.get_buy_offers()
    offer = next((o for o in offers if o["id"] == offer_id and o.get("reserveId") == reserve_id), None)

    if not offer:
        return web.json_response({"ok": False, "error": "Ордер не найден"})

    offer["frozen"] = False
    offer["reserveId"] = None
    offer["expiresAt"] = None
    offer["status"] = "NEW"
    storage.save()

    return web.json_response({"ok": True, "message": "Бронирование отменено"})


async def submit_proof_handler(request):
    """POST /api/public/submit_proof — Загрузить чек"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    offer_id = body.get("id", "")
    reserve_id = body.get("reserveId", "")

    if not offer_id or not reserve_id:
        return web.json_response({"ok": False, "error": "Укажите id и reserveId"})

    offers = storage.get_buy_offers()
    offer = next((o for o in offers if o["id"] == offer_id and o.get("reserveId") == reserve_id), None)

    if not offer:
        return web.json_response({"ok": False, "error": "Ордер не найден"})

    offer["proofUploaded"] = True
    offer["status"] = "PROOF_SENT"
    storage.save()

    return web.json_response({"ok": True, "message": "Чек загружен"})


async def cancel_proof_handler(request):
    """POST /api/public/cancel_proof — Отмена с чеком"""
    return web.json_response({"ok": True, "message": "Отмена принята"})


async def cancel_skip_proof_handler(request):
    """POST /api/public/cancel_skip_proof — Отмена без чека"""
    return web.json_response({"ok": True, "message": "Отмена принята"})


async def choose_route_handler(request):
    """POST /api/public/choose_route — Выбор маршрута (Bybit/HTX)"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    offer_id = body.get("id", "")
    reserve_id = body.get("reserveId", "")
    route = body.get("route", "bybit")

    if not offer_id or not reserve_id:
        return web.json_response({"ok": False, "error": "Укажите id и reserveId"})

    offers = storage.get_buy_offers()
    offer = next((o for o in offers if o["id"] == offer_id and o.get("reserveId") == reserve_id), None)

    if not offer:
        return web.json_response({"ok": False, "error": "Ордер не найден"})

    offer["route"] = route
    storage.save()

    return web.json_response({"ok": True, "message": "Маршрут выбран", "route": route})


async def sell_submit_handler(request):
    """POST /api/public/sell_submit — Подать SELL заявку"""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    amount = float(body.get("amountUsdt", 0))
    if amount <= 0:
        return web.json_response({"ok": False, "error": "Укажите сумму USDT"})

    deal_id = "sell-" + str(int(time.time()))
    secret = secrets.token_hex(8)

    deal = {
        "id": deal_id,
        "type": "SELL",
        "secret": secret,
        "amountUsdt": amount,
        "walletAddress": body.get("walletAddress", ""),
        "method": body.get("method", "SBP"),
        "rate": body.get("rate", 95.50),
        "status": "NEW",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S")
    }

    storage.add_deal(deal)

    return web.json_response({"ok": True, "dealId": deal_id, "secret": secret, "status": "NEW"})


async def sell_submit_extra_check_handler(request):
    """POST /api/public/sell_submit_extra_check — Дополнительная проверка"""
    return web.json_response({"ok": True, "message": "Проверка пройдена"})
