"""
Хранилище данных — JSON файл

Что делает:
- Хранит пользователей, коды авторизации, токены, сделки
- Всё сохраняется в файл data/db.json
- Для продакшена замени на PostgreSQL/MongoDB
"""

import json
import os
import secrets
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "db.json"

# Данные в памяти
_data = None


def load():
    """Загрузить данные из файла"""
    global _data

    if DB_PATH.exists():
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                _data = json.load(f)
        except Exception as e:
            print(f"Ошибка загрузки БД: {e}")

    # Значения по умолчанию
    if not _data:
        _data = {}

    _data.setdefault("users", {})
    _data.setdefault("codes", {})
    _data.setdefault("tokens", {})
    _data.setdefault("wallets", {})
    _data.setdefault("buyOffers", [])
    _data.setdefault("sellOffers", [
        {
            "id": "sell-demo-1",
            "method": "SBP",
            "rateMode": "ABS",
            "rate": "95.50",
            "minCheckRub": 1000,
            "avgTimeMin": 5,
            "status": "NEW",
            "frozen": False,
            "createdAt": "2024-01-01T00:00:00"
        },
        {
            "id": "sell-demo-2",
            "method": "CARD",
            "rateMode": "PERCENT",
            "ratePercent": 2,
            "minCheckRub": 5000,
            "avgTimeMin": 10,
            "status": "NEW",
            "frozen": False,
            "createdAt": "2024-01-01T00:00:00"
        }
    ])
    _data.setdefault("deals", [])
    _data.setdefault("referrals", {})

    return _data


def save():
    """Сохранить данные в файл"""
    if _data is None:
        return
    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Ошибка сохранения БД: {e}")


def get_data():
    """Получить все данные"""
    if _data is None:
        load()
    return _data


# ============= ПОЛЬЗОВАТЕЛИ =============

def get_user(username):
    return get_data()["users"].get(username)


def set_user(username, user_data):
    get_data()["users"][username] = user_data
    save()


# ============= КОДЫ АВТОРИЗАЦИИ =============

def save_code(username, code, expires_at):
    get_data()["codes"][username] = {"code": code, "expiresAt": expires_at}
    save()


def get_code(username):
    return get_data()["codes"].get(username)


def remove_code(username):
    get_data()["codes"].pop(username, None)
    save()


# ============= ТОКЕНЫ =============

def generate_token():
    return secrets.token_hex(32)


def save_token(token, username):
    get_data()["tokens"][token] = username
    save()


def get_username_by_token(token):
    return get_data()["tokens"].get(token)


def remove_token(token):
    get_data()["tokens"].pop(token, None)
    save()


# ============= КОШЕЛЬКИ =============

def get_wallet(username):
    return get_data()["wallets"].get(username, {"address": "", "balance": 0})


def set_wallet(username, wallet_data):
    get_data()["wallets"][username] = wallet_data
    save()


def add_balance(username, amount):
    wallet = get_wallet(username)
    wallet["balance"] = float(wallet.get("balance", 0)) + float(amount)
    set_wallet(username, wallet)
    return wallet["balance"]


# ============= РЕФЕРАЛЬНАЯ СИСТЕМА =============

def get_referral(username):
    return get_data()["referrals"].get(username)


def set_referral(username, ref_data):
    get_data()["referrals"][username] = ref_data
    save()


# ============= СДЕЛКИ =============

def add_deal(deal):
    get_data()["deals"].append(deal)
    save()


def get_deals():
    return get_data()["deals"]


def get_deal_by_id(deal_id):
    for d in get_data()["deals"]:
        if d["id"] == deal_id:
            return d
    return None


def update_deal(deal_id, updates):
    deal = get_deal_by_id(deal_id)
    if deal:
        deal.update(updates)
        save()
    return deal


# ============= ОФФЕРЫ =============

def get_buy_offers():
    return get_data()["buyOffers"]


def get_sell_offers():
    return get_data()["sellOffers"]


def add_buy_offer(offer):
    get_data()["buyOffers"].append(offer)
    save()


def add_sell_offer(offer):
    get_data()["sellOffers"].append(offer)
    save()
