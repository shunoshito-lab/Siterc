/* ============================================================
   RADIO CARDUCCI — ACCOUNT (Cloudflare Worker + KV)
   Login semplice: ti registri con nome e cognome, ricevi un codice
   tipo "Simone4821" (nome + 4 cifre a caso). Il codice è utente e
   password insieme: con quello entri da qualsiasi telefono o computer.

   Cosa salva: nome + iniziale del cognome ("Simone P."), preferiti,
   ascolti e qualche preferenza. Il cognome intero non viene salvato.
   Il codice non viene salvato in chiaro: in KV c'è solo il suo hash.

   Rotte:
     POST /register  { nome, cognome }  → { code, display, token }
     POST /login     { code }           → { display, token }
     GET  /me        (Bearer token)     → { display, data, updatedAt }
     PUT  /me        (Bearer) { data }  → { ok, updatedAt }
     POST /logout    (Bearer)           → { ok }
     GET  /news                         → { items: [{ title, link, date }] }  notizie ANSA
                                          (il browser non può leggere il feed ANSA da solo)
   ============================================================ */

const TOKEN_TTL = 60 * 60 * 24 * 365;   // un anno
const MAX_DATA_BYTES = 64 * 1024;
const LIMITS = { login: 30, register: 8 }; // tentativi per IP all'ora

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const route = request.method + ' ' + url.pathname.replace(/\/+$/, '');
    try {
      switch (route) {
        case 'POST /register': return json(await register(request, env), 200, cors);
        case 'POST /login':    return json(await login(request, env), 200, cors);
        case 'GET /me':        return json(await getMe(request, env), 200, cors);
        case 'PUT /me':        return json(await putMe(request, env), 200, cors);
        case 'POST /logout':   return json(await logout(request, env), 200, cors);
        case 'GET /news':      return json(await news(env), 200, Object.assign({ 'Cache-Control': 'public, max-age=300' }, cors));
        default:               return json({ error: 'rotta inesistente' }, 404, cors);
      }
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      return json({ error: 'errore del server' }, 500, cors);
    }
  }
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers)
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || ''),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

async function body(request) {
  try { return await request.json(); } catch (e) { throw new HttpError(400, 'richiesta non valida'); }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomDigits(n) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return [...a].map(x => x % 10).join('');
}

function randomToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

// "simone " → "Simone"; tiene solo le lettere, accenti compresi
function cleanName(s, max) {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  if (!t || t.length > max || !/^[\p{L}' -]+$/u.test(t)) return null;
  return t.split(' ').map(w => w.charAt(0).toLocaleUpperCase('it') + w.slice(1).toLocaleLowerCase('it')).join(' ');
}

function codeKey(code) {
  // il codice si scrive come si vuole: "simone4821", "Simone 4821"…
  return String(code || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

async function rateLimit(env, request, kind) {
  const ip = request.headers.get('CF-Connecting-IP') || 'sconosciuto';
  const hour = Math.floor(Date.now() / 3600000);
  const key = `rl:${kind}:${ip}:${hour}`;
  const n = parseInt(await env.ACCOUNTS.get(key), 10) || 0;
  if (n >= LIMITS[kind]) throw new HttpError(429, 'troppi tentativi, riprova tra un\'ora');
  await env.ACCOUNTS.put(key, String(n + 1), { expirationTtl: 3700 });
}

async function issueToken(env, userKey) {
  const token = randomToken();
  await env.ACCOUNTS.put('t:' + await sha256(token), userKey, { expirationTtl: TOKEN_TTL });
  return token;
}

async function userFromToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!/^[0-9a-f]{64}$/.test(token)) throw new HttpError(401, 'non sei entrato');
  const userKey = await env.ACCOUNTS.get('t:' + await sha256(token));
  if (!userKey) throw new HttpError(401, 'sessione scaduta, rientra con il tuo codice');
  const user = await env.ACCOUNTS.get(userKey, 'json');
  if (!user) throw new HttpError(401, 'account inesistente');
  return { userKey, user, tokenHash: await sha256(token) };
}

async function register(request, env) {
  await rateLimit(env, request, 'register');
  const b = await body(request);
  const nome = cleanName(b.nome, 30);
  const cognome = cleanName(b.cognome, 40);
  if (!nome || !cognome) throw new HttpError(400, 'scrivi nome e cognome, solo lettere');

  const base = nome.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '') || 'Utente';
  let code = null, userKey = null;
  for (let i = 0; i < 20; i++) {
    const candidate = base + randomDigits(4);
    const key = 'u:' + await sha256(codeKey(candidate));
    if (!(await env.ACCOUNTS.get(key))) { code = candidate; userKey = key; break; }
  }
  if (!code) throw new HttpError(503, 'non riesco a creare un codice, riprova');

  const display = `${nome} ${cognome.charAt(0)}.`;
  const user = { display, createdAt: Date.now(), updatedAt: Date.now(), data: {} };
  await env.ACCOUNTS.put(userKey, JSON.stringify(user));
  return { code, display, token: await issueToken(env, userKey) };
}

async function login(request, env) {
  await rateLimit(env, request, 'login');
  const b = await body(request);
  const key = codeKey(b.code);
  if (!/^[a-z]+[0-9]{4}$/.test(key)) throw new HttpError(400, 'il codice è fatto così: nome e 4 cifre, tipo Simone4821');
  const userKey = 'u:' + await sha256(key);
  const user = await env.ACCOUNTS.get(userKey, 'json');
  if (!user) throw new HttpError(404, 'codice sbagliato');
  return { display: user.display, token: await issueToken(env, userKey) };
}

async function getMe(request, env) {
  const { user } = await userFromToken(request, env);
  return { display: user.display, data: user.data || {}, updatedAt: user.updatedAt };
}

async function putMe(request, env) {
  const { userKey, user } = await userFromToken(request, env);
  const b = await body(request);
  const data = b && typeof b.data === 'object' && b.data ? b.data : null;
  if (!data) throw new HttpError(400, 'dati mancanti');
  const clean = {
    likes: Array.isArray(data.likes) ? data.likes.slice(0, 500) : [],
    history: data.history && typeof data.history === 'object' ? data.history : {},
    prefs: data.prefs && typeof data.prefs === 'object' ? data.prefs : {}
  };
  const raw = JSON.stringify(clean);
  if (raw.length > MAX_DATA_BYTES) throw new HttpError(413, 'troppi dati');
  user.data = clean;
  user.updatedAt = Date.now();
  await env.ACCOUNTS.put(userKey, JSON.stringify(user));
  return { ok: true, updatedAt: user.updatedAt };
}

async function logout(request, env) {
  const { tokenHash } = await userFromToken(request, env);
  await env.ACCOUNTS.delete('t:' + tokenHash);
  return { ok: true };
}

// ── Notizie ANSA: si legge il feed lato server e si tiene in cache 5 minuti ──
const NEWS_FEED = 'https://www.ansa.it/sito/ansait_rss.xml';
let newsCache = { at: 0, items: [] };

function decodeXml(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function news(env) {
  if (Date.now() - newsCache.at < 300000 && newsCache.items.length) return { items: newsCache.items };
  const res = await fetch(env.NEWS_FEED || NEWS_FEED, { headers: { 'User-Agent': 'RadioCarducci/1.0' }, cf: { cacheTtl: 300 } });
  if (!res.ok) throw new HttpError(502, 'feed notizie non raggiungibile');
  const xml = await res.text();
  const items = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/g)) {
    const block = m[0];
    const get = tag => { const r = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return r ? decodeXml(r[1]) : ''; };
    const title = get('title');
    if (title) items.push({ title, link: get('link'), date: get('pubDate') });
    if (items.length >= 15) break;
  }
  newsCache = { at: Date.now(), items };
  return { items };
}
