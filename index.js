'use strict';
/* The Lume Hotel: web server. Zero dependencies (Node 22+). Run with: node server/index.js */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
// Load a .env file if present (real environment variables win).
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (!m || l.trim().startsWith('#')) return;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { }
process.env.TZ = process.env.TZ || 'Asia/Manila';   // the hotel's calendar day, whatever the host clock says
const core = require('./core');
const { API, ctxStore } = core;
const { ApiError, MSG } = require('./shared');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA_DIR, 'uploads');
const PUBLIC = path.join(ROOT, 'public');
const HTTPS = /^https:/i.test(process.env.BASE_URL || '');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
fs.mkdirSync(UPLOADS, { recursive: true });
core.init(Object.assign({}, process.env), path.join(DATA_DIR, 'lume.sqlite'));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
const STATUS = { VALIDATION: 422, NOT_FOUND: 404, UNAUTHORIZED: 401, BAD_LOGIN: 401, FORBIDDEN: 403, BAD_SETUP_CODE: 401, TOO_MANY: 429, LOCKED: 429, NOT_ALLOWED: 409, CONFLICT: 409, ROOM_UNAVAILABLE: 409, NO_ROOMS: 409, EARLY: 409, CAPACITY: 422, INVALID_DATES: 422, PAST_DATE: 422, MAX_NIGHTS: 422, BAD_REF: 422, BAD_EMAIL: 422, SERVER: 500, PAYMENT_FAILED: 402, PAYMENT_UNAVAILABLE: 409 };

function secHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://www.google.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (HTTPS) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
const clientIp = req => (TRUST_PROXY && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
function parseCookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new ApiError('VALIDATION', 'That file or request is too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}
function send(res, code, body, headers) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  const data = isJson ? JSON.stringify(body) : body;
  res.writeHead(code, Object.assign({ 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(data);
}
function sendError(res, e) {
  if (e instanceof ApiError) return send(res, STATUS[e.code] || 400, { error: { code: e.code, message: e.message, fields: e.fields || null } });
  console.error(e); return send(res, 500, { error: { code: 'SERVER', message: MSG.SERVER } });
}

/* ---------- route table ---------- */
const S = API.staff;
const num = v => (v === undefined || v === '' ? undefined : +v);
const routes = [];
const R = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:([a-z]+)/g, '(?<$1>[^/]+)') + '$'), fn });
// public
R('GET', '/api/config', () => API.config());
R('GET', '/api/availability', c => API.availability(c.q.ci, c.q.co));
R('GET', '/api/night-map', c => API.nightMap(c.q.from, num(c.q.days), c.q.type));
R('POST', '/api/reservations', c => API.createReservation(c.body));
R('POST', '/api/reservations/lookup', c => API.lookup(c.body.no, c.body.email));
R('POST', '/api/reservations/request', c => API.requestChange(c.body.no, c.body.email, c.body.req || {}));
R('POST', '/api/reservations/pay', c => API.payOnline(c.body.no, c.body.email));
R('POST', '/api/contact', c => API.sendContact(c.body, c.body.kind === 'dining' ? 'dining' : 'contact'));
R('POST', '/api/setup', c => API.setup(c.body));
// staff session
R('POST', '/api/staff/login', c => S.login(c.body.email, c.body.password));
R('POST', '/api/staff/logout', () => S.logout());
R('GET', '/api/staff/me', () => S.me());
R('GET', '/api/staff/pulse', () => S.pulse());
R('POST', '/api/staff/password', c => S.changePassword(c.body.old, c.body.password));
// staff data
R('GET', '/api/staff/dashboard', () => S.dashboard());
R('GET', '/api/staff/reservations', c => S.reservations(c.q));
R('GET', '/api/staff/reservations/:id', c => S.reservation(+c.p.id));
R('POST', '/api/staff/reservations', c => S.createReservation(c.body));
R('POST', '/api/staff/reservations/:id/action', c => S.action(+c.p.id, c.body.action, c.body.opts || {}));
R('POST', '/api/staff/reservations/:id/update', c => S.update(+c.p.id, c.body.changes || {}, c.body.opts || {}));
R('POST', '/api/staff/reservations/:id/pay', c => S.pay(+c.p.id, c.body));
R('POST', '/api/staff/reservations/:id/refund', c => S.refund(+c.p.id));
R('POST', '/api/staff/reservations/:id/email', c => S.email(+c.p.id, c.body.template));
R('POST', '/api/staff/reservations/:id/request/:rid', c => S.resolveRequest(+c.p.id, +c.p.rid, c.body.decision));
R('GET', '/api/staff/free-rooms', c => S.freeRooms(c.q.ci, c.q.co, c.q.exclude));
R('GET', '/api/staff/rooms', () => S.rooms());
R('POST', '/api/staff/rooms', c => S.saveRoom(c.body));
R('POST', '/api/staff/rooms/:id/delete', c => S.deleteRoom(+c.p.id));
R('POST', '/api/staff/rooms/:id/status', c => S.setRoomStatus(+c.p.id, c.body.status, c.body.why));
R('POST', '/api/staff/rooms/:id/housekeeping', c => S.housekeeping(+c.p.id, c.body.step));
R('POST', '/api/staff/types', c => S.saveType(c.body));
R('GET', '/api/staff/calendar', c => S.calendar(c.q.from, +c.q.days || 14));
R('GET', '/api/staff/analytics', c => S.analytics(c.q.from, c.q.to));
R('GET', '/api/staff/notifications', () => S.notifications());
R('POST', '/api/staff/notifications/read', c => S.markRead(c.body.ids === 'all' ? 'all' : (c.body.ids || []).map(Number)));
R('GET', '/api/staff/messages', () => S.messages());
R('POST', '/api/staff/messages/:id/status', c => S.messageStatus(+c.p.id, c.body.status));
R('GET', '/api/staff/outbox', () => S.outbox());
R('POST', '/api/staff/outbox/:id/resend', c => S.resendEmail(+c.p.id));
R('GET', '/api/staff/templates', () => S.templates());
R('POST', '/api/staff/email-preview', c => S.emailPreview(c.body));
R('POST', '/api/staff/email-test', c => S.sendTestEmail(c.body.to));
R('GET', '/api/staff/audit', () => S.auditLog());
R('GET', '/api/staff/users', () => S.users());
R('POST', '/api/staff/users', c => S.createUser(c.body));
R('POST', '/api/staff/users/:id', c => S.updateUser(+c.p.id, c.body));
R('POST', '/api/staff/users/:id/password', c => S.resetPassword(+c.p.id, c.body.password));
R('GET', '/api/staff/settings', () => S.settings());
R('POST', '/api/staff/settings', c => S.saveSettings(c.body));
R('GET', '/api/staff/addons', () => S.addons());
R('POST', '/api/staff/addons', c => S.saveAddon(c.body));
R('GET', '/api/staff/photo-slots', () => S.photoSlots());
R('POST', '/api/staff/photos/:slot/remove', async c => { const r = await S.removePhoto(c.p.slot); if (r.old) fs.unlink(path.join(UPLOADS, path.basename(r.old)), () => { }); return true; });

// image upload: raw bytes, not JSON
function sniff(b) { if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'; if (b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'; if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp'; return ''; }
async function handleUpload(req, res, slot) {
  await S.photoSlots();                                   // authenticates and authorises before reading the body
  const body = await readBody(req, 12 * 1024 * 1024); const ext = sniff(body);
  if (!ext) throw new ApiError('VALIDATION', 'Please upload a JPG, PNG or WebP image.');
  const file = `${slot}-${crypto.randomBytes(5).toString('hex')}.${ext}`; fs.writeFileSync(path.join(UPLOADS, file), body);
  try { const r = await S.setPhoto(slot, file); if (r.old) fs.unlink(path.join(UPLOADS, path.basename(r.old)), () => { }); }
  catch (e) { fs.unlink(path.join(UPLOADS, file), () => { }); throw e; }
  return { url: '/media/' + file };
}

/* ---------- payment provider return + webhook ---------- */
async function payReturn(url, res, cancelled) {
  const ref = String(url.searchParams.get('ref') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cancelled && ref) { try { await core.finalizePayment(ref); } catch (e) { console.error('finalize', e.message); } }
  res.writeHead(302, { Location: '/#/' + (cancelled ? 'manage?ref=' + ref + '&paid=0' : 'confirmation/' + ref), 'Cache-Control': 'no-store' }); res.end();
}
async function webhook(req, res) {
  const raw = (await readBody(req, 1024 * 1024)).toString('utf8'); const pay = core.getPay();
  if (!pay.verifyWebhook(raw, req.headers['paymongo-signature'], process.env.PAYMONGO_WEBHOOK_SECRET)) return send(res, 401, { error: { code: 'FORBIDDEN', message: 'Bad signature' } });
  const id = (/"(cs_[A-Za-z0-9_]+)"/.exec(raw) || [])[1];
  if (id) { const r = core.getDB().read().reservations.find(x => x.pay_ref === id); if (r) await core.finalizePayment(r.number).catch(e => console.error(e.message)); }
  send(res, 200, { ok: true });
}

/* ---------- main handler ---------- */
async function handle(req, res) {
  secHeaders(res);
  const url = new URL(req.url, 'http://localhost'); const p = url.pathname; const t0 = Date.now();
  try {
    if (p === '/healthz') return send(res, 200, 'ok');
    if (p === '/pay/return' || p === '/pay/cancelled') return await payReturn(url, res, p === '/pay/cancelled');
    if (p === '/api/payments/webhook' && req.method === 'POST') return await webhook(req, res);
    if (p === '/shared.js') { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'public, max-age=300' }); return fs.createReadStream(path.join(__dirname, 'shared.js')).pipe(res); }
    if (p.startsWith('/media/')) {
      const f = path.basename(p); if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(f)) return send(res, 404, 'Not found');
      const fp = path.join(UPLOADS, f); if (!fs.existsSync(fp)) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)], 'Cache-Control': 'public, max-age=31536000, immutable' }); return fs.createReadStream(fp).pipe(res);
    }
    if (p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: { code: 'NOT_ALLOWED', message: 'Method not allowed' } });
      const origin = req.headers.origin; if (req.method === 'POST' && origin) { let ok = false; try { ok = new URL(origin).host === req.headers.host; } catch (e) { } if (!ok) return send(res, 403, { error: { code: 'FORBIDDEN', message: 'Cross-site request blocked' } }); }
      const ctx = { token: parseCookies(req).lume_session || '', ip: clientIp(req) };
      const out = await ctxStore.run(ctx, async () => {
        const um = /^\/api\/staff\/photos\/([a-z0-9-]+)$/.exec(p);
        if (um && req.method === 'POST') return { data: await handleUpload(req, res, um[1]), ctx };
        let body = {};
        if (req.method === 'POST') {
          if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw new ApiError('VALIDATION', 'Unsupported request.');
          const raw = await readBody(req, 512 * 1024); try { body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch (e) { throw new ApiError('VALIDATION', 'Malformed request.'); }
        }
        const q = Object.fromEntries(url.searchParams);
        for (const r of routes) { if (r.method !== req.method) continue; const m = r.re.exec(p); if (m) { return { data: await r.fn({ q, body, p: m.groups || {} }), ctx }; } }
        throw new ApiError('NOT_FOUND', 'Not found.');
      });
      const headers = {}; const c = out.ctx || ctx;
      if (c.setToken !== undefined) headers['Set-Cookie'] = `lume_session=${c.setToken ? encodeURIComponent(c.setToken) : ''}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${c.setToken ? 43200 : 0}${HTTPS ? '; Secure' : ''}`;
      return send(res, 200, out.data === undefined ? { ok: true } : out.data, headers);
    }
    // static files
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    let rel = p === '/' ? '/index.html' : p; const fp = path.normalize(path.join(PUBLIC, rel));
    if (!fp.startsWith(PUBLIC + path.sep) && fp !== PUBLIC) return send(res, 403, 'Forbidden');
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return send(res, 404, 'Not found');
    const ext = path.extname(fp); res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    if (req.method === 'HEAD') return res.end(); fs.createReadStream(fp).pipe(res);
  } catch (e) { if (!res.headersSent) sendError(res, e); else res.end(); }
  finally { if (p.startsWith('/api/') && Date.now() - t0 > 1500) console.log('slow', req.method, p, Date.now() - t0 + 'ms'); }
}

const server = http.createServer((req, res) => { handle(req, res).catch(e => { console.error(e); try { if (!res.headersSent) send(res, 500, { error: { code: 'SERVER', message: MSG.SERVER } }); } catch (x) { } }); });
server.keepAliveTimeout = 65000;

/* ---------- background jobs + nightly backup ---------- */
function backup() {
  try {
    const dir = path.join(DATA_DIR, 'backups'); const f = path.join(dir, `lume-${new Date().toISOString().slice(0, 10)}.sqlite`);
    if (!fs.existsSync(f)) core.getDB().backup(f);
    fs.readdirSync(dir).filter(n => /^lume-.*\.sqlite$/.test(n)).sort().slice(0, -14).forEach(n => fs.unlinkSync(path.join(dir, n)));
  } catch (e) { console.error('backup failed', e.message); }
}
function start() {
  return new Promise(resolve => server.listen(PORT, () => {
    console.log(`The Lume Hotel is running on port ${PORT} (${process.env.BASE_URL || 'http://localhost:' + PORT})`);
    console.log(`Email: ${core.getMail().describe()} | Online payments: ${core.getPay().configured ? 'PayMongo' : 'not configured'}`);
    const jobs = setInterval(() => core.tickJobs(), 30000); jobs.unref(); setTimeout(() => core.tickJobs(), 3000).unref();
    const bk = setInterval(backup, 6 * 3600e3); bk.unref(); setTimeout(backup, 10000).unref();
    resolve(server);
  }));
}
process.on('SIGTERM', () => { server.close(() => { try { core.getDB().close(); } catch (e) { } process.exit(0); }); setTimeout(() => process.exit(0), 5000).unref(); });
if (require.main === module) start();
module.exports = { server, start, core };
