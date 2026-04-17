"""
Маршруты админки
"""

import os
from aiohttp import web

from services import storage


def require_admin(request):
    """Проверка админского токена"""
    token = request.headers.get("X-Admin-Token", "") or \
            request.headers.get("Authorization", "").replace("Bearer ", "")

    admin_token = os.environ.get("ADMIN_TOKEN", "admin_secret_key")
    data = storage.get_data()
    admin_token = data.get("adminToken", admin_token)

    if not token or token != admin_token:
        return None
    return True


async def admin_users_handler(request):
    """GET /api/admin/users — Список пользователей"""
    if not require_admin(request):
        return web.json_response({"ok": False, "error": "Unauthorized"})

    users = storage.get_data()["users"]
    user_list = [{"username": k, **v} for k, v in users.items()]

    return web.json_response({"ok": True, "users": user_list})


async def admin_deals_handler(request):
    """GET /api/admin/deals — Список сделок"""
    if not require_admin(request):
        return web.json_response({"ok": False, "error": "Unauthorized"})

    deals = storage.get_deals()
    return web.json_response({"ok": True, "deals": deals})


async def admin_broadcast_handler(request):
    """POST /api/admin/broadcast — Рассылка (заглушка)"""
    if not require_admin(request):
        return web.json_response({"ok": False, "error": "Unauthorized"})

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Неверный запрос"})

    message = body.get("message", "")
    if not message:
        return web.json_response({"ok": False, "error": "Укажите сообщение"})

    return web.json_response({
        "ok": True,
        "message": "Тестовое сообщение отправлено" if body.get("testOnly") else "Рассылка запущена"
    })


async def admin_stats_handler(request):
    """GET /api/admin/stats — Статистика"""
    if not require_admin(request):
        return web.json_response({"ok": False, "error": "Unauthorized"})

    users_count = len(storage.get_data()["users"])
    deals_count = len(storage.get_deals())

    return web.json_response({
        "ok": True,
        "stats": {
            "totalUsers": users_count,
            "totalDeals": deals_count,
            "activeDeals": deals_count
        }
    })


async def admin_config_handler(request):
    """GET /api/admin/config — Конфигурация"""
    if not require_admin(request):
        return web.json_response({"ok": False, "error": "Unauthorized"})

    return web.json_response({
        "ok": True,
        "config": {
            "buyPercent": 1,
            "sellPercent": 2,
            "buyAmountEnabled": True
        }
    })