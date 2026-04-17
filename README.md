Функция	Сложность	Описание
Telegram Auth	Средняя	Отправка кодов, верификация, JWT-токены
P2P Сделки	Высокая	Бронирование, статусы, матчинг покупателя/продавца
Балансы	Средняя	Внутренняя валюта (USDT), история транзакций
Платёжные чеки	Средняя	Загрузка, проверка, верификация
Админка API	Средняя	Управление пользователями, сделками, рассылки
Реферальная система	Низкая	Коди, баланс, комиссии
Уведомления	Средняя	Telegram-бота для статусов сделок
Категория	Изменения
Название проекта	Все упоминания Crossflag → FranklinEx
API endpoints	api.crossflag.org → api.franklinex.org
Telegram бот	CrossflagEx_bot → FranklinEx_bot
Telegram каналы	@CrossflagEx → @FranklinEx_channel
localStorage keys	crossflag_* → franklinex_*
JS объекты	CrossflagAuth, CrossflagResume, CrossflagDeals → FranklinEx*
Домен	crossflag.org → franklinex.org
Email	crossflag@postchkr.com → franklinex@postchkr.com
API-домен api.franklinex.org — сейчас везде стоит заглушка. Тебе нужно:

Либо поднять свой бэкенд на этом домене
Либо временно вернуть api.crossflag.org для тестов
Либо настроить прокси
Telegram-бот — создай бота через @BotFather с именем FranklinEx_bot

Домен — если используешь свой домен, обнови DNS и SSL

Что дальше?

Настроить API-бэкенд?
Подключить своего Telegram-бота?
Изменить цветовую схему?
📊 Полный анализ проекта FranklinEx
1. Общая структура

Применить
/ (корень — franklinex.org)
├── index.html          → редирект на wallet/qr.html
├── CNAME               → franklinex.org
├── site.webmanifest    → PWA конфигурация
├── sitemap.xml         → SEO
├── robots.txt          → SEO
├── README.md           → документация
│
├── wallet/             → Основные страницы (13 файлов)
│   ├── qr.html         → Главный кошелёк (точка входа)
│   ├── trade.html      → P2P торговля
│   ├── account.html    → Аккаунт
│   ├── bonuses.html    → Реферальная программа
│   ├── history.html    → История
│   ├── wallet.html     → Альтернативный кошелёк
│   ├── withdraw.html   → Вывод средств
│   ├── withdraw-video.html
│   ├── topup.html      → Пополнение
│   ├── qr_pay.html     → Оплата через QR
│   ├── qr_desktop.html
│   ├── qr-create.html
│   ├── qr_executor_wait.html
│   └── deal-link.html  → Админ: ссылка на сделку
│
├── buy/                → Покупка USDT (10 файлов)
│   ├── buy.html        → Стакан BUY заявок
│   ├── buy-order.html  → Оформление заказа
│   ├── buy-paid.html   → Подтверждение оплаты
│   ├── buy-request.html
│   ├── buy-request-wait.html
│   ├── payment.html    → Страница оплаты
│   ├── check.html      → Проверка статуса
│   ├── crossflag-buy-order.html
│   ├── bybit-waiting.html
│   └── htx-waiting.html
│
├── sell/               → Продажа USDT (11 файлов)
│   ├── sell.html       → Стакан SELL заявок
│   ├── sell-deal.html  → Оформление сделки
│   ├── sell-order.html
│   ├── sell-check.html → Проверка статуса
│   ├── sell-crossflag.html
│   ├── sell-crypto-dest.html
│   ├── sell-extra-check.html
│   ├── sell-next.html
│   ├── sell-requisites.html
│   ├── sell-success.html
│   └── sell-deals-log.html
│
├── auth/               → Авторизация (3 файла)
│   ├── auth.html       → Вход через Telegram код
│   ├── register.html   → Регистрация
│   └── login.html
│
├── admin/              → Админка (9 файлов)
│   ├── admin.html      → Главная админки
│   ├── admin-deals.html
│   ├── admin-users.html
│   ├── admin-stats.html
│   ├── admin-withdrawals.html
│   ├── admin-buy-requests.html
│   ├── admin-broadcast.html
│   ├── admin-attempts.html
│   └── admin-pdf-checker.html
│
├── assets/             → Статика
│   ├── js/
│   │   ├── auth.js         → Модуль авторизации
│   │   ├── resume-helper.js → Восстановление сделок
│   │   └── active-deals.js  → Активные сделки
│   ├── css/             → (пусто, стили инлайн)
│   └── img/             → (пусто, нет картинок)
│
└── pages/              → SEO (только yandex verification)
2. Критические проблемы
🔴 Проблема 1: API сервер не существует
Три разных API адреса захардкожены в файлах:

API адрес	Файлы	Количество
https://api.crossflag.org	wallet/qr.html, wallet/trade.html, wallet/account.html, auth/auth.html, assets/js/auth.js, assets/js/resume-helper.js	6 файлов
https://api.franklinex.org	wallet/withdraw.html, wallet/topup.html, wallet/qr_pay.html, wallet/bonuses.html, wallet/history.html, buy/*.html, sell/*.html, admin/*.html, auth/register.html	~20 файлов
https://rapira-rates-proxy.kireeshka73.workers.dev	wallet/wallet.html, sell/sell-deal.html	2 файла
Ни один из этих серверов не работает локально. Без backend:

❌ Авторизация не работает
❌ Баланс не загружается
❌ Сделки не создаются
❌ Реферальная система не работает
❌ Админка не подключается
🔴 Проблема 2: Нет backend сервера
В проекте нет папки api/ в корне. Ранее был franklin-exchange/api/ с:

mock-api.js
 — mock сервер на Express
telegram-api.js
 — сервер с Telegram авторизацией (создал ранее)
Но сейчас этой папки нет в корне проекта.

🟡 Проблема 3: Нет единого WORKER_BASE
Каждый файл задаёт свой WORKER_BASE по-разному:


Применить
// Вариант 1 — захардкожено
const WORKER_BASE = "https://api.crossflag.org";

// Вариант 2 — из localStorage с fallback
const WORKER_BASE = localStorage.getItem("worker_base") || "https://api.franklinex.org";

// Вариант 3 — из URL параметра + localStorage
const WORKER_BASE = new URLSearchParams(location.search).get("wb") || localStorage.getItem("worker_base") || "https://api.franklinex.org";
🟡 Проблема 4: Остатки старого бренда Crossflag
Где	Что
wallet/qr.html	https://t.me/CrossflagEx
assets/js/auth.js	API_BASE = "https://api.crossflag.org"
assets/js/resume-helper.js	API_BASE = "https://api.crossflag.org"
localStorage ключи	CF_USER_TOKEN, cf_user_token, cf_active_deals
🟡 Проблема 5: Нет картинок/иконок
assets/img/ — пусто. Нет:

favicon.ico
logo.png
PWA иконок (android-chrome-192x192.png, android-chrome-512x512.png)
3. Что работает БЕЗ API
Функция	Работает?
UI/верстка всех страниц	✅ Да
Навигация между страницами	✅ Да (если открыть правильные URL)
Анимации, переходы	✅ Да
QR-сканер (камера)	✅ Да
Адаптивная вёрстка	✅ Да
PWA manifest	✅ Да (но нет иконок)
Функция	Работает?
Авторизация	❌ Нет
Баланс кошелька	❌ Нет
Создание сделок	❌ Нет
Реферальная система	❌ Нет
Вывод средств	❌ Нет
Админка	❌ Нет
Курс USDT/RUB	❌ Нет
4. API endpoints, которые нужны backend'у
Из анализа всех файлов, backend должен реализовать:

Публичные:

GET /api/public/rapira_rate — курс USDT/RUB
GET /api/public/quotes — котировки
GET /api/public/buy_offers — список BUY заявок
GET /api/public/sell_offers — список SELL заявок
GET /api/public/order_info — информация о сделке
GET /api/public/sell_status — статус SELL сделки
GET /api/public/buy_lock_status — блокировка заявок
GET /api/public/wallet/balance — баланс кошелька
POST /api/public/auth/request_code — отправка кода в Telegram
POST /api/public/auth/verify_code — проверка кода
GET /api/public/auth/me — текущий пользователь
POST /api/public/reserve_offer — бронирование ордера
POST /api/public/mark_paid — отметка об оплате
POST /api/public/cancel_reserve — отмена брони
POST /api/public/submit_proof — загрузка чека
POST /api/public/cancel_proof — отмена с чеком
POST /api/public/cancel_skip_proof — отмена без чека
POST /api/public/sell_submit — подача SELL заявки
POST /api/public/sell_submit_extra_check — доп. проверка
POST /api/public/set_wallet — установка кошелька
POST /api/public/withdraw_request — запрос на вывод
POST /api/public/withdraw_video — видео для вывода
POST /api/public/log_attempt — логирование попыток
POST /api/public/resume_notify — уведомление о возврате
POST /api/public/choose_route — выбор маршрута
POST /api/public/buy_amount_request_status — статус запроса суммы
POST /api/public/ref/apply — применение реферального кода
GET /api/public/ref/me — реферальные данные
POST /api/public/ref/withdraw — вывод реферальных бонусов
Админские:

GET /api/admin/users — список пользователей
GET /api/admin/deals — список сделок
POST /api/admin/broadcast — рассылка
5. Что нужно сделать для полного запуска
Приоритет 1 (критично):
Создать backend API сервер с всеми endpoints выше
Унифицировать WORKER_BASE во всех файлах на один адрес
Настроить Telegram бота для авторизации
Приоритет 2 (важно):
Добавить favicon и PWA иконки
Убрать остатки бренда Crossflag
Унифицировать localStorage ключи
Приоритет 3 (улучшения):
Вынести CSS в отдельные файлы (сейчас всё инлайн)
Добавить 
.env
 конфигурацию
Настроить CI/CD для деплоя
Хочешь, чтобы я начал с приоритета 1? Могу:

Создать полноценный backend сервер
Унифицировать WORKER_BASE во всех файлах
Настроить подключение к Telegram боту


🚀 Пошаговый план запуска FranklinEx
Этап 1: Окружение
Шаг 1.1 — Установить Node.js
Скачать с https://nodejs.org/ (LTS версию)
Установить, проверить в терминале:

Применить
node --version
npm --version
Шаг 1.2 — Установить VS Code расширения
Live Server (Ritwick Dey) — для hot-reload
Опционально: Prettier — для форматирования
Этап 2: Telegram бот
Шаг 2.1 — Создать бота
Открыть в Telegram @BotFather
Написать /newbot
Имя: FranklinEx Bot
Username: FranklinEx_bot (или любой, заканчивающийся на bot)
Скопировать токен (формат: 1234567890:ABCdef...)
Шаг 2.2 — Настроить бота
В @BotFather отправить:


Применить
/setcommands
Выбрать бота → 
start - Запустить бота
help - Помощь
Шаг 2.3 — Проверить бота
Найти бота по username
Нажать Start
Бот должен ответить приветствием
Этап 3: Backend API сервер
Шаг 3.1 — Создать структуру

Применить
api/
├── server.js          # Главный файл сервера
├── package.json       # Зависимости
├── .env               # Секреты (токен бота)
├── routes/
│   ├── auth.js        # Авторизация
│   ├── public.js      # Публичные API
│   ├── wallet.js      # Кошелёк
│   ├── deals.js       # Сделки
│   ├── referrals.js   # Реферальная система
│   └── admin.js       # Админка
├── services/
│   ├── telegram.js    # Отправка сообщений в Telegram
│   └── storage.js     # Хранилище данных
└── data/
    └── db.json        # JSON-база данных (для старта)
Шаг 3.2 — Установить зависимости

Применить
cd api
npm init -y
npm install express cors axios dotenv
Шаг 3.3 — Создать 
.env

Применить
TELEGRAM_BOT_TOKEN=ТВОЙ_ТОКЕН_ОТ_BOTFATHER
PORT=3000
ADMIN_TOKEN=admin_secret_key_123
Шаг 3.4 — Реализовать API endpoints (по приоритету)
Блок А — Авторизация (самое важное):

Endpoint	Метод	Описание
/api/public/auth/request_code	POST	Отправить код в Telegram
/api/public/auth/verify_code	POST	Проверить код, выдать токен
/api/public/auth/me	GET	Текущий пользователь
Блок Б — Кошелёк:

Endpoint	Метод	Описание
/api/public/wallet/balance	GET	Баланс USDT
/api/public/set_wallet	POST	Установить адрес кошелька
/api/public/withdraw_request	POST	Запрос на вывод
/api/public/withdraw_video	POST	Видео-подтверждение вывода
Блок В — Курс:

Endpoint	Метод	Описание
/api/public/rapira_rate	GET	Курс USDT/RUB
/api/public/quotes	GET	Котировки
Блок Г — Сделки BUY:

Endpoint	Метод	Описание
/api/public/buy_offers	GET	Список BUY заявок
/api/public/reserve_offer	POST	Забронировать ордер
/api/public/mark_paid	POST	Отметить оплаченным
/api/public/cancel_reserve	POST	Отменить бронь
/api/public/order_info	GET	Информация о сделке
/api/public/submit_proof	POST	Загрузить чек
/api/public/cancel_proof	POST	Отмена с чеком
/api/public/cancel_skip_proof	POST	Отмена без чека
/api/public/choose_route	POST	Выбор маршрута
/api/public/buy_lock_status	GET	Статус блокировки
/api/public/buy_amount_request_status	GET	Статус запроса суммы
Блок Д — Сделки SELL:

Endpoint	Метод	Описание
/api/public/sell_offers	GET	Список SELL заявок
/api/public/sell_submit	POST	Подать SELL заявку
/api/public/sell_submit_extra_check	POST	Доп. проверка
/api/public/sell_status	GET	Статус SELL сделки
Блок Е — Реферальная система:

Endpoint	Метод	Описание
/api/public/ref/me	GET	Реферальные данные
/api/public/ref/apply	POST	Применить код
/api/public/ref/withdraw	POST	Вывод бонусов
Блок Ё — Прочее:

Endpoint	Метод	Описание
/api/public/log_attempt	POST	Логирование попыток
/api/public/resume_notify	POST	Уведомление о возврате
Блок Ж — Админка:

Endpoint	Метод	Описание
/api/admin/users	GET	Список пользователей
/api/admin/deals	GET	Список сделок
/api/admin/broadcast	POST	Рассылка
Шаг 3.5 — Запустить сервер

Применить
cd api
node server.js
Проверить: открыть http://localhost:3000/api/public/rapira_rate — должен вернуть JSON

Этап 4: Унификация WORKER_BASE
Шаг 4.1 — Заменить все API адреса на один
Сейчас в проекте 3 разных адреса. Нужно заменить все на http://localhost:3000:


Применить
# В корне проекта
Get-ChildItem -Recurse -Include *.html,*.js -File | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  $content = $content -replace 'https://api\.crossflag\.org', 'http://localhost:3000'
  $content = $content -replace 'https://api\.franklinex\.org', 'http://localhost:3000'
  $content = $content -replace 'https://rapira-rates-proxy\.kireeshka73\.workers\.dev', 'http://localhost:3000'
  Set-Content $_.FullName $content -NoNewline
}
Шаг 4.2 — Проверить замену

Применить
Get-ChildItem -Recurse -Include *.html,*.js -File | Select-String "api\.crossflag|api\.franklinex|kireeshka73"
Должно вернуть 0 результатов.

Этап 5: Очистка бренда
Шаг 5.1 — Заменить ссылки на Telegram
Было	Стало
CrossflagEx	FranklinEx
CrossflagEx_bot	FranklinEx_bot
@CrossflagEx	@FranklinEx_channel
Шаг 5.2 — Заменить localStorage ключи
Было	Стало
CF_USER_TOKEN	FE_USER_TOKEN
cf_user_token	fe_user_token
cf_active_deals	fe_active_deals
crossflag_user_token	franklinex_user_token
Шаг 5.3 — Заменить названия в UI
Crossflag → FranklinEx (во всех заголовках)
Этап 6: Ассеты
Шаг 6.1 — Создать иконки
Положить в assets/img/:

favicon.ico (32x32)
logo.png (512x512)
android-chrome-192x192.png
android-chrome-512x512.png
Шаг 6.2 — Обновить ссылки в HTML
Добавить в <head> каждого файла:


Применить
<link rel="icon" href="/assets/img/favicon.ico">
<link rel="apple-touch-icon" href="/assets/img/logo.png">
Этап 7: Тестирование
Шаг 7.1 — Запустить всё

Применить
# Терминал 1: API сервер
cd api
node server.js

# Терминал 2: Frontend (если без Live Server)
python -m http.server 8080
Или через Live Server в VS Code.

Шаг 7.2 — Чек-лист проверки
Авторизация:

[ ] Открыть 
auth.html
[ ] Ввести username → нажать «Отправить код»
[ ] Получить код в Telegram
[ ] Ввести код → войти
[ ] Токен сохраняется в localStorage
Кошелёк:

[ ] 
qr.html
 — баланс загружается
[ ] Курс USDT/RUB отображается
[ ] Навигация между разделами работает
Сделки:

[ ] buy/buy.html — список заявок загружается
[ ] sell/sell.html — список заявок загружается
[ ] Бронирование ордера работает
[ ] Отметка об оплате работает
Рефералы:

[ ] wallet/bonuses.html — реферальный код показан
[ ] Применение чужого кода работает
Админка:

[ ] admin/admin.html — подключается к API
[ ] Список пользователей загружается
[ ] Создание заявок работает
Этап 8: Продакшен (после тестов)
Шаг 8.1 — Домен и хостинг
Компонент	Где
Frontend	GitHub Pages / Vercel / Netlify
Backend API	VPS / Cloudflare Workers / Railway
Домен	franklinex.org
Шаг 8.2 — Заменить WORKER_BASE на продакшен

Применить
# Заменить localhost на реальный домен
Get-ChildItem -Recurse -Include *.html,*.js -File | ForEach-Object {
  (Get-Content $_.FullName) -replace 'http://localhost:3000', 'https://api.franklinex.org' | Set-Content $_.FullName
}
Шаг 8.3 — Безопасность
Заменить JSON-базу на PostgreSQL или MongoDB
Добавить rate limiting
Добавить HTTPS обязательно
Скрыть 
.env
 файл (добавить в .gitignore)
📊 Итоговая таблица
Этап	Что	Сложность	Время
1	Окружение	⭐	15 мин
2	Telegram бот	⭐	10 мин
3	Backend API	⭐⭐⭐⭐	3-5 дней
4	Унификация WORKER_BASE	⭐	10 мин
5	Очистка бренда	⭐⭐	30 мин
6	Ассеты	⭐	30 мин
7	Тестирование	⭐⭐⭐	1-2 дня
8	Продакшен	