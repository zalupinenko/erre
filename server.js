const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const codes = new Map(); // username → {code, expires}
const tokens = new Map(); // token → username

// Генерация 6-значного кода
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Генерация токена
function generateToken() {
  return 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// CORS заголовки
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Token',
    'Content-Type': 'application/json'
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders());
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const json = body ? JSON.parse(body) : {};
    const response = (data, status = 200) => {
      res.writeHead(status, corsHeaders());
      res.end(JSON.stringify(data));
    };

    try {
      // ───── AUTH: запрос кода ─────
      if (url.pathname === '/api/public/auth/request_code' && req.method === 'POST') {
        const { username } = json;
        if (!username) return response({ ok: false, error: 'Нет username' }, 400);

        const code = generateCode();
        const expires = Date.now() + 10 * 60 * 1000; // 10 минут
        codes.set(username, { code, expires });

        console.log(`\n📩 Код для ${username}: ${code}\n`);
        return response({ ok: true, message: 'Код отправлен (см. консоль сервера)' });
      }

      // ───── AUTH: проверка кода ─────
      if (url.pathname === '/api/public/auth/verify_code' && req.method === 'POST') {
        const { username, code } = json;
        if (!username || !code) return response({ ok: false, error: 'Нет username или кода' }, 400);

        const record = codes.get(username);
        if (!record) return response({ ok: false, error: 'Код не запрошен' }, 400);
        if (Date.now() > record.expires) {
          codes.delete(username);
          return response({ ok: false, error: 'Код истёк' }, 400);
        }
        if (record.code !== code) return response({ ok: false, error: 'Неверный код' }, 400);

        codes.delete(username);
        const token = generateToken();
        tokens.set(token, username);

        return response({
          ok: true,
          userToken: token,
          user: { username, id: Date.now() }
        });
      }

      // ───── AUTH: получить себя ─────
      if (url.pathname === '/api/public/auth/me' && req.method === 'GET') {
        const token = req.headers['x-user-token'] || req.headers['authorization']?.replace('Bearer ', '');
        const username = tokens.get(token);
        if (!username) return response({ ok: false, error: 'Не авторизован' }, 401);

        return response({ ok: true, user: { username, id: Date.now() } });
      }

      // ───── RESERVE OFFER ─────
      if (url.pathname === '/api/public/reserve_offer' && req.method === 'POST') {
        const { id } = json;
        const reserveId = 'res_' + Date.now();
        return response({
          ok: true,
          reserveId,
          expiresAt: Date.now() + 15 * 60 * 1000
        });
      }

      // ───── CANCEL RESERVE ─────
      if (url.pathname === '/api/public/cancel_reserve' && req.method === 'POST') {
        return response({ ok: true });
      }

      // ───── SET WALLET ─────
      if (url.pathname === '/api/public/set_wallet' && req.method === 'POST') {
        const { id, reserveId, walletType, walletValue } = json;
        return response({ ok: true, message: 'Кошелёк установлен' });
      }

      // ───── НЕИЗВЕСТНЫЙ ENDPOINT ─────
      response({ ok: false, error: 'Endpoint не найден' }, 404);

    } catch (e) {
      response({ ok: false, error: e.message }, 500);
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
   🚀 FranklinEx Mock Server запущен
   📍 http://localhost:${PORT}
   
   📩 Коды авторизации будут в этой консоли
╚════════════════════════════════════════╝
  `);
});
