"""
Публичные маршруты — курсы, заявки, информация
"""

import time
from aiohttp import web

from services import storage


async def rapira_rate_handler(request):
    """GET /api/public/rapira_rate — Курс USDT/RUB"""
    return web.json_response({
        "ok": True,
        "rate": 95.50,
        "timestamp": int(time.time() * 1000)
    })


async def quotes_handler(request):
    """GET /api/public/quotes — Котировки"""
    return web.json_response({
        "ok": True,
        "buy": 95.50,
        "sell": 94.00,
        "timestamp": int(time.time() * 1000)
    })


async def buy_offers_handler(request):
    """GET /api/public/buy_offers — Список BUY заявок"""
    offers = [o for o in storage.get_buy_offers() if o.get("status") == "NEW" and not o.get("frozen")]
    return web.json_response({"ok": True, "offers": offers})


async def sell_offers_handler(request):
    """GET /api/public/sell_offers — Список SELL заявок"""
    offers = [o for o in storage.get_sell_offers() if o.get("status") == "NEW" and not o.get("frozen")]
    return web.json_response({"ok": True, "offers": offers})


async def order_info_handler(request):
    """GET /api/public/order_info — Информация о сделке"""
    order_id = request.query.get("id", "")
    reserve_id = request.query.get("reserveId", "")

    # Ищем в сделках
    deal = storage.get_deal_by_id(order_id)
    if deal and deal.get("reserveId") == reserve_id:
        return web.json_response({"ok": True, **deal})

    # Ищем в BUY офферах
    for offer in storage.get_buy_offers():
        if offer.get("id") == order_id and offer.get("reserveId") == reserve_id:
            return web.json_response({"ok": True, **offer})

    return web.json_response({"ok": False, "error": "Not found"})


async def sell_status_handler(request):
    """GET /api/public/sell_status — Статус SELL сделки"""
    deal_id = request.query.get("dealId", "")
    secret = request.query.get("secret", "")

    deal = storage.get_deal_by_id(deal_id)
    if not deal or deal.get("secret") != secret:
        return web.json_response({"ok": False, "error": "Not found"})

    return web.json_response({"ok": True, "status": deal["status"], "dealId": deal["id"]})


async def buy_lock_status_handler(request):
    """GET /api/public/buy_lock_status — Статус блокировки BUY заявок"""
    ids = [i for i in request.query.get("ids", "").split(",") if i]
    result = {}
    for i in ids:
        deal = storage.get_deal_by_id(i)
        result[i] = deal["status"] if deal else "NEW"
    return web.json_response({"ok": True, "statuses": result})


async def buy_amount_request_status_handler(request):
    """GET /api/public/buy_amount_request_status"""
    req_id = request.query.get("id", "")
    deal = storage.get_deal_by_id(req_id)
    if not deal:
        return web.json_response({"ok": False, "error": "Not found"})
    return web.json_response({"ok": True, "status": deal.get("status", "NEW")})


async def log_attempt_handler(request):
    """POST /api/public/log_attempt — Логирование попыток"""
    return web.json_response({"ok": True})


async def resume_notify_handler(request):
    """POST /api/public/resume_notify — Уведомление о восстановлении"""
    return web.json_response({"ok": True, "message": "Received"})
