// Hooma Art — zero-dependency Node server (Node 18+).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 3100;
const HOST = process.env.HOST || '127.0.0.1';
const PUB = path.join(__dirname, 'public');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP = path.join(DATA, 'uploads');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
fs.mkdirSync(UP, { recursive: true });

const WORKS = path.join(DATA, 'works.json');
const SUBS = path.join(DATA, 'submissions.jsonl');
if (!fs.existsSync(WORKS)) fs.copyFileSync(path.join(__dirname, 'data-seed', 'works.json'), WORKS);
const SECRET_FILE = path.join(DATA, 'secret');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

const readWorks = () => JSON.parse(fs.readFileSync(WORKS, 'utf8'));
const writeWorks = (w) => { fs.writeFileSync(WORKS + '.tmp', JSON.stringify(w, null, 2)); fs.renameSync(WORKS + '.tmp', WORKS); };
const readSubs = () => fs.existsSync(SUBS) ? fs.readFileSync(SUBS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const writeSubs = (a) => fs.writeFileSync(SUBS, a.map((x) => JSON.stringify(x)).join('\n') + (a.length ? '\n' : ''));

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  const buf = isObj ? Buffer.from(JSON.stringify(body)) : Buffer.from(body);
  res.writeHead(code, { 'Content-Type': isObj ? MIME['.json'] : 'text/plain; charset=utf-8', 'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...headers });
  res.end(buf);
}
function serveFile(res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(self)' });
    fs.createReadStream(file).pipe(res);
  });
}
function body(req, limit) {
  return new Promise((ok, bad) => {
    let n = 0; const parts = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { bad(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { bad(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', bad);
  });
}
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); const a = (hits.get(key) || []).filter((t) => now - t < windowMs);
  a.push(now); hits.set(key, a); return a.length > max;
}
setInterval(() => hits.clear(), 3600e3).unref();

// ---- auth
const sign = (exp) => exp + '.' + crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
function authed(req) {
  const m = /(?:^|;\s*)hooma_admin=([^;]+)/.exec(req.headers.cookie || ''); if (!m) return false;
  const [exp, sig] = m[1].split('.'); if (!exp || !sig || +exp < Date.now()) return false;
  const good = sign(exp).split('.')[1];
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const safeEq = (a, b) => { const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x, y); };

// ---- helpers
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
function saveImage(dataUrl, maxBytes) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || ''); if (!m) return null;
  const buf = Buffer.from(m[2], 'base64'); if (!buf.length || buf.length > maxBytes) return null;
  const name = crypto.randomBytes(9).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UP, name), buf); return '/uploads/' + name;
}
const slug = (s) => str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ROLES = ['artist', 'space', 'sponsor', 'collector', 'viewing', 'other'];

function cleanWork(b, prev) {
  const two = (o, max) => ({ fa: str(o && o.fa, max), en: str(o && o.en, max) });
  const w = { id: prev ? prev.id : '', title: two(b.title, 120), artist: two(b.artist, 120), medium: two(b.medium, 160), story: two(b.story, 2000),
    year: str(b.year, 12), w: Math.max(0, Math.min(1000, +b.w || 0)), h: Math.max(0, Math.min(1000, +b.h || 0)), price: two(b.price, 80),
    available: b.available !== false, img: prev ? prev.img : '', ratio: prev ? prev.ratio : 1.5 };
  if (b.image) { const p = saveImage(b.image, 6e6); if (p) w.img = p; }
  if (+b.ratio > 0.2 && +b.ratio < 5) w.ratio = +b.ratio;
  return w;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);

    if (p.startsWith('/api/')) {
      if (req.method === 'GET' && p === '/api/works') return send(res, 200, readWorks(), { 'Cache-Control': 'no-cache' });

      if (req.method === 'POST' && p === '/api/submit') {
        if (limited('s' + ip(req), 8, 3600e3)) return send(res, 429, { error: 'rate' });
        const b = await body(req, 6e6);
        if (b.website) return send(res, 200, { ok: true }); // honeypot
        const rec = { id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), role: ROLES.includes(b.role) ? b.role : 'other',
          name: str(b.name, 120), phone: str(b.phone, 40), email: str(b.email, 160), city: str(b.city, 80), link: str(b.link, 300),
          message: str(b.message, 3000), work: str(b.work, 80), lang: b.lang === 'en' ? 'en' : 'fa', status: 'new' };
        if (!rec.name || !(rec.phone || rec.email)) return send(res, 400, { error: 'missing' });
        if (b.image) rec.image = saveImage(b.image, 4e6) || undefined;
        fs.appendFileSync(SUBS, JSON.stringify(rec) + '\n');
        return send(res, 200, { ok: true });
      }

      if (req.method === 'POST' && p === '/api/admin/login') {
        if (limited('l' + ip(req), 8, 900e3)) return send(res, 429, { error: 'rate' });
        const b = await body(req, 2000);
        if (!ADMIN_PASSWORD || !safeEq(String(b.password || ''), ADMIN_PASSWORD)) return send(res, 401, { error: 'wrong' });
        return send(res, 200, { ok: true }, { 'Set-Cookie': `hooma_admin=${sign(Date.now() + 12 * 3600e3)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}` });
      }
      if (p.startsWith('/api/admin/')) {
        if (!authed(req)) return send(res, 401, { error: 'auth' });
        if (req.method === 'POST' && p === '/api/admin/logout') return send(res, 200, { ok: true }, { 'Set-Cookie': 'hooma_admin=; Path=/; Max-Age=0' });
        if (req.method === 'GET' && p === '/api/admin/submissions') return send(res, 200, readSubs().reverse(), { 'Cache-Control': 'no-store' });
        let m;
        if ((m = /^\/api\/admin\/submissions\/([a-f0-9]+)$/.exec(p))) {
          const all = readSubs(); const i = all.findIndex((x) => x.id === m[1]); if (i < 0) return send(res, 404, { error: 'nf' });
          if (req.method === 'DELETE') all.splice(i, 1);
          else if (req.method === 'PUT') { const b = await body(req, 2000); all[i].status = ['new', 'contacted', 'done'].includes(b.status) ? b.status : all[i].status; all[i].note = str(b.note, 1000); }
          else return send(res, 405, { error: 'method' });
          writeSubs(all); return send(res, 200, { ok: true });
        }
        if (req.method === 'POST' && p === '/api/admin/works') {
          const b = await body(req, 9e6); const works = readWorks(); const w = cleanWork(b);
          if (!w.img) return send(res, 400, { error: 'image' });
          let id = slug(b.title && b.title.en) || 'work'; let n = 2; const base = id; while (works.some((x) => x.id === id)) id = base + '-' + n++;
          w.id = id; works.push(w); writeWorks(works); return send(res, 200, w);
        }
        if ((m = /^\/api\/admin\/works\/([a-z0-9-]+)$/.exec(p))) {
          const works = readWorks(); const i = works.findIndex((x) => x.id === m[1]); if (i < 0) return send(res, 404, { error: 'nf' });
          if (req.method === 'DELETE') works.splice(i, 1);
          else if (req.method === 'PUT') works[i] = cleanWork(await body(req, 9e6), works[i]);
          else return send(res, 405, { error: 'method' });
          writeWorks(works); return send(res, 200, { ok: true });
        }
      }
      return send(res, 404, { error: 'nf' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    if (p.startsWith('/uploads/')) {
      const f = path.join(UP, path.basename(p)); return serveFile(res, f, 'public, max-age=31536000, immutable');
    }
    if (p === '/' || p.startsWith('/w/') || ['/wall', '/scan', '/join'].includes(p)) return serveFile(res, path.join(PUB, 'index.html'), 'no-cache');
    if (p === '/admin') return serveFile(res, path.join(PUB, 'admin.html'), 'no-store');
    const f = path.normalize(path.join(PUB, p));
    if (!f.startsWith(PUB + path.sep)) return send(res, 403, 'Forbidden');
    return serveFile(res, f, /\/(fonts|img|vendor)\//.test(p) ? 'public, max-age=2592000' : 'no-cache');
  } catch (e) {
    if (!res.headersSent) send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code ? e.message : 'server' });
    if (!e.code) console.error(e);
  }
});
server.listen(PORT, HOST, () => console.log(`Hooma Art on http://${HOST}:${PORT}${ADMIN_PASSWORD ? '' : '  (admin disabled: set ADMIN_PASSWORD)'}`));
