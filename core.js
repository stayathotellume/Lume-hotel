'use strict';
/* ==========================================================================
   THE LUME HOTEL: server core. Business rules, API and email, running on the server.
   Storage: SQLite via ./store.js. Secrets come from environment variables only.
   ========================================================================== */
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const shared = require('./shared');
const { CONFIG, pad, iso, parseISO, addDays, todayISO, diffDays, overlaps, r2, esc, money, fmtDate, fmtShort, fmtDT, sleep, byNo, randHex,
  RES_STATUS, PAY_STATUS, ROOM_STATUS, PAY_METHODS, MSG, ApiError, ACTIVE, EMAIL_RE, validateGuest, validateStay, quote, roomPolicies } = shared;
const catalog = require('./catalog');
const store = require('./store');
const mailer = require('./mail');
const payments = require('./pay');

Object.assign(MSG, {
  PAYMENT_UNAVAILABLE: 'That payment method isn’t available right now. Please choose another one, or pay at the hotel.',
  BAD_SETUP_CODE: 'That setup code isn’t right. Check the server log for the code.',
  WEAK_PASSWORD: 'Use at least 10 characters, with letters and numbers.',
  EMAIL_NOT_CONFIGURED: 'Email isn’t connected yet. Add your email settings on the server, then resend.'
});

let DB = null, MAIL = null, PAY = null, ENV = {};
const ctxStore = new AsyncLocalStorage();
const Session = { get: () => { const c = ctxStore.getStore(); return c && c.token; }, set: t => { const c = ctxStore.getStore(); if (c) c.setToken = t; } };
const ctxIp = () => { const c = ctxStore.getStore(); return (c && c.ip) || 'local'; };
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const baseUrl = () => (ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '') + '/';

/* ---------- in-memory rate limits ---------- */
const RL = new Map();
function rlCheck(key, max, ms) { const e = RL.get(key); return !!e && e.count >= max && Date.now() - e.first < ms; }
function rlFail(key, ms) { const n = Date.now(), e = RL.get(key); if (!e || n - e.first > ms) RL.set(key, { count: 1, first: n }); else e.count++; }
function rlClear(key) { RL.delete(key); }

/* ---------- ids, audit, notifications ---------- */
const nid = (s, t) => { s.meta.next[t] = s.meta.next[t] || 1; return s.meta.next[t]++; };
const nextResNumber = (s, when) => { const y = (when || new Date()).getFullYear(); const n = (s.meta.seq[y] || 0) + 1; s.meta.seq[y] = n; return `LUME-${y}-${pad(n, 5)}`; };
const audit = (s, user, action, entity, entityId, details) => s.audit_logs.push({ id: nid(s, 'audit_logs'), at: new Date().toISOString(), user_id: user ? user.id : null, user: user ? user.name : 'Guest / system', action, entity, entity_id: entityId || null, details: details || '' });
const notify = (s, n) => s.notifications.push(Object.assign({ id: nid(s, 'notifications'), at: new Date().toISOString(), read: false, roles: ['admin', 'front_desk'] }, n));
const logRoom = (s, room, user, why) => s.room_status.push({ id: nid(s, 'room_status'), room_id: room.id, status: room.status, housekeeping: room.hk, at: new Date().toISOString(), by: user ? user.name : 'System', why: why || '' });

/* ---------- queries ---------- */
const Q = {
  sellable: r => r.status !== 'Maintenance' && r.status !== 'Out of Order',
  conflicts: (s, roomId, ci, co, ignore) => s.reservations.filter(x => x.room_id === roomId && ACTIVE.has(x.status) && x.id !== ignore && overlaps(x.check_in, x.check_out, ci, co)),
  freeRooms(s, ci, co, typeId, ignore) { return s.rooms.filter(r => (!typeId || r.type_id === typeId) && Q.sellable(r) && !Q.conflicts(s, r.id, ci, co, ignore).length).sort(byNo); },
  hydrate(s, r) { if (!r) return null; return Object.assign({}, r, { guest: s.guests.find(g => g.id === r.guest_id), room: s.rooms.find(x => x.id === r.room_id), type: s.room_types.find(t => t.id === r.type_id), payments: s.payments.filter(p => p.reservation_id === r.id) }); },
  display(s, room, today) {
    if (room.status !== 'Available') return room.status;
    const arr = s.reservations.some(x => x.room_id === room.id && (x.status === 'Confirmed' || x.status === 'Pending') && x.check_in === (today || todayISO()));
    return arr ? 'Reserved' : 'Available';
  },
  freeOnNight(s, date, typeId) { return Q.freeRooms(s, date, addDays(date, 1), typeId).length; },
  nightMap(s, from, days, typeId) { const m = {}; for (let i = 0; i < days; i++) { const d = addDays(from, i); m[d] = Q.freeOnNight(s, d, typeId); } return m; },
  freeCountsByType(s, ci, co) { const o = {}; s.room_types.forEach(t => o[t.id] = Q.freeRooms(s, ci, co, t.id).length); return o; }
};


/* ---------- email: templates + queue ---------- */
const Emails = (() => {
  const C = { gold: '#C29A4B', dark: '#0F2B33', cream: '#FBF8F1', ink: '#1E2A2E', muted: '#5C6B6E', line: '#E7DECB' };
  const base = () => baseUrl();
  const H = CONFIG.HOTEL;
  const btn = (label, href, primary) => `<a href="${esc(href)}" style="display:inline-block;padding:13px 26px;margin:4px 6px 4px 0;border-radius:999px;font:600 14px Arial,sans-serif;text-decoration:none;${primary ? `background:${C.gold};color:#1b1408` : `border:1px solid ${C.gold};color:${C.dark}`}">${esc(label)}</a>`;
  const row = (k, v) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.muted};font:14px Arial,sans-serif;width:42%">${esc(k)}</td><td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.ink};font:600 14px Arial,sans-serif;text-align:right">${v}</td></tr>`;
  const details = r => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0">${[
    ['Reservation number', esc(r.number)], ['Guest name', esc(r.guest.first + ' ' + r.guest.last)], ['Room', esc(r.type.name)],
    ['Check-in', esc(fmtDate(r.check_in)) + ' from ' + CONFIG.CHECKIN], ['Check-out', esc(fmtDate(r.check_out)) + ' by ' + CONFIG.CHECKOUT],
    ['Number of nights', r.nights], ['Guests', `${r.adults} adult${r.adults > 1 ? 's' : ''}${r.children ? `, ${r.children} child${r.children > 1 ? 'ren' : ''}` : ''}`],
    ['Total amount', esc(money(r.total))], ['Payment status', esc(r.payment_status)], ['Reservation status', esc(r.status)]].map(x => row(x[0], x[1])).join('')}</table>`;
  const info = `<p style="margin:22px 0 4px;font:600 14px Arial,sans-serif;color:${C.dark}">Hotel information</p><p style="margin:0;font:14px/1.7 Arial,sans-serif;color:${C.muted}">${H.name}<br>${H.address}<br>${H.phone}<br>${H.email}</p>`;
  const policy = `<div style="margin-top:22px;padding:16px 18px;background:${C.cream};border-radius:12px;font:13px/1.65 Arial,sans-serif;color:${C.muted}"><b style="color:${C.dark}">Check-in and check-out.</b> Check-in is from ${CONFIG.CHECKIN}; check-out is by ${CONFIG.CHECKOUT}. Please bring a valid photo ID.<br><b style="color:${C.dark}">Cancellation policy.</b> Free cancellation until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in. After that, the first night is charged.</div>`;
  const ctas = r => btn('View reservation', `${base()}#/manage?ref=${encodeURIComponent(r.number)}`, true) + btn('Contact hotel', `mailto:${H.email}?subject=${encodeURIComponent('Reservation ' + r.number)}`, false);
  function shell(pre, heading, body) {
    return `<!doctype html><html><body style="margin:0;background:#EFE8D8;padding:24px 12px"><span style="display:none;opacity:0">${esc(pre)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:${C.dark};padding:30px 32px;text-align:center"><div style="font:500 26px Georgia,serif;color:#F4E7CB;letter-spacing:.5px">${H.name}</div><div style="margin-top:6px;font:italic 14px Georgia,serif;color:${C.gold}">${esc(H.tagline)}</div></td></tr>
<tr><td style="height:3px;background:${C.gold}"></td></tr>
<tr><td style="padding:34px 32px 30px"><h1 style="margin:0 0 14px;font:500 26px Georgia,serif;color:${C.dark}">${esc(heading)}</h1>${body}</td></tr>
<tr><td style="background:${C.cream};padding:20px 32px;text-align:center;font:12px/1.6 Arial,sans-serif;color:${C.muted}">${H.name} · ${H.address}<br>${H.phone} · ${H.email}<br>© ${new Date().getFullYear()} ${esc(H.name)}. All Rights Reserved.</td></tr></table></td></tr></table></body></html>`;
  }
  const hi = r => `<p style="margin:0 0 12px;font:15px/1.7 Arial,sans-serif;color:${C.ink}">Dear ${esc(r.guest.first + ' ' + r.guest.last)},</p>`;
  const p = t => `<p style="margin:0 0 12px;font:15px/1.7 Arial,sans-serif;color:${C.ink}">${t}</p>`;
  const T = {
    confirmation: { label: 'Reservation confirmation', subject: r => `Your Reservation at The Lume Hotel – Confirmation #${r.number}`,
      html: r => shell('Your reservation details', r.status === 'Pending' ? 'We’ve received your reservation' : 'Your reservation is confirmed',
        hi(r) + p('Thank you for choosing The Lume Hotel.') + p(r.status === 'Pending' ? 'We’ve received your reservation and are holding your room. We’ll confirm it as soon as your payment is verified.' : 'Your reservation has been confirmed.') + p('<b>Reservation details</b>') + details(r) + ctas(r) + info + policy) },
    cancellation: { label: 'Reservation cancellation', subject: r => `Your Reservation at The Lume Hotel – Cancellation #${r.number}`,
      html: r => shell('Your reservation was cancelled', 'Your reservation has been cancelled', hi(r) + p(`We’ve cancelled reservation <b>${esc(r.number)}</b> as requested.${r.payment_status === 'Refund Pending' ? ' Your refund is being processed and should reach you in 5 to 10 business days.' : ''}`) + details(r) + p('We’d be glad to welcome you another time.') + btn('Book a new stay', base() + '#/book', true) + btn('Contact hotel', `mailto:${H.email}`, false) + info) },
    modification: { label: 'Reservation modification', subject: r => `Your Reservation at The Lume Hotel – Updated #${r.number}`,
      html: r => shell('Your reservation was updated', 'Your reservation has been updated', hi(r) + p('Your reservation now looks like this:') + details(r) + ctas(r) + info + policy) },
    payment: { label: 'Payment confirmation', subject: r => `Payment received for Reservation #${r.number} – The Lume Hotel`,
      html: r => shell('We received your payment', 'Payment received', hi(r) + p(`Thank you. We’ve received your payment of <b>${esc(money(r.paid_amount || r.total))}</b> for reservation <b>${esc(r.number)}</b>.`) + details(r) + ctas(r) + info) },
    reminder: { label: 'Pre-arrival reminder', subject: r => `Your stay at The Lume Hotel begins ${fmtShort(r.check_in)} – Reservation #${r.number}`,
      html: r => shell('Your stay is almost here', 'We’re looking forward to seeing you', hi(r) + p(`Your stay begins on <b>${esc(fmtDate(r.check_in))}</b>. Check-in opens at ${CONFIG.CHECKIN}; if you’ll arrive later, just let us know and we’ll keep the lights on.`) + p('Please bring a valid photo ID. From Kalibo International Airport, the drive to Jawili takes roughly 40 minutes, and we can arrange a pickup.') + details(r) + ctas(r) + info) },
    thankyou: { label: 'Post-stay thank-you', subject: () => 'Thank you for staying at The Lume Hotel',
      html: r => shell('Thank you for staying with us', 'Thank you for staying with us', hi(r) + p('It was a pleasure to have you at The Lume Hotel. We hope your days here felt unhurried and warm.') + p('If anything could have been better, reply to this email and we’ll listen. If everything was right, we’d love to see you again.') + btn('Plan your next stay', base() + '#/rooms', true) + info) }
  };
  T.test = { label: 'Test email', subject: () => 'Test email from ' + H.name, html: () => shell('Email is working', 'Email is working', p('This is a test message from your hotel system. If you can read it, guests will receive their confirmations.') + info) };
  let busy = false, again = false;
  const api = {
    templates: T,
    render(id, r) { return { subject: T[id].subject(r), html: T[id].html(r) }; },
    // Queues an email; the worker delivers it. Never blocks the caller on the mail server.
    send(id, resId, by, to) {
      const s0 = DB.read(); const r = resId ? Q.hydrate(s0, s0.reservations.find(x => x.id === resId)) : null;
      const rcpt = to || (r && r.guest.email); if (!rcpt) return { ok: false, status: 'failed' };
      const subject = id === 'test' ? T.test.subject() : T[id].subject(r);
      const status = MAIL.configured ? 'queued' : 'not_configured';
      DB.tx(t => { t.email_outbox.push({ id: nid(t, 'email_outbox'), at: new Date().toISOString(), reservation_id: resId || null, template: id, to: rcpt, from: MAIL.from, subject, status, mode: MAIL.describe(), by: by || 'System', attempts: 0, next_try: 0, error: '' }); });
      if (MAIL.configured) setImmediate(() => api.process().catch(() => { }));
      return { ok: true, status };
    },
    render_row(row) {
      const s = DB.read();
      if (row.template === 'test') return api.render('test', null);
      const res = s.reservations.find(x => x.id === row.reservation_id); if (!res) throw new Error('Reservation not found');
      return api.render(row.template, Q.hydrate(s, res));
    },
    async process() {
      if (!MAIL.configured) return; if (busy) { again = true; return; } busy = true;
      try {
       do { again = false; const now = Date.now();
        const rows = DB.read().email_outbox.filter(e => e.status === 'queued' && (!e.next_try || e.next_try <= now)).slice(0, 10);
        for (const row of rows) {
          let msg; try { msg = api.render_row(row); } catch (e) { DB.tx(t => { const x = t.email_outbox.find(y => y.id === row.id); x.status = 'failed'; x.error = 'Could not render: ' + e.message; }); continue; }
          try {
            await MAIL.send({ to: row.to, subject: msg.subject, html: msg.html });
            DB.tx(t => { const x = t.email_outbox.find(y => y.id === row.id); x.status = 'sent'; x.sent_at = new Date().toISOString(); x.attempts = (x.attempts || 0) + 1; x.error = ''; });
          } catch (e) {
            DB.tx(t => {
              const x = t.email_outbox.find(y => y.id === row.id); x.attempts = (x.attempts || 0) + 1; x.error = String(e.message || e).slice(0, 240);
              if (x.attempts >= 5) { x.status = 'failed'; notify(t, { type: 'message', title: 'Email could not be delivered', body: `${x.to} · ${x.subject}`, res_id: x.reservation_id, roles: ['admin', 'front_desk'] }); audit(t, null, 'Email failed', 'email', x.id, `${x.to}: ${x.error}`); }
              else x.next_try = Date.now() + [60e3, 5 * 60e3, 20 * 60e3, 60 * 60e3][x.attempts - 1];
            });
          }
        }
       } while (again);
      } finally { busy = false; }
    },
    requeue(id) { DB.tx(t => { const x = t.email_outbox.find(y => y.id === id); if (!x) throw new ApiError('NOT_FOUND'); x.status = MAIL.configured ? 'queued' : 'not_configured'; x.attempts = 0; x.next_try = 0; x.error = ''; x.mode = MAIL.describe(); }); if (MAIL.configured) setImmediate(() => api.process().catch(() => { })); },
    releaseUnconfigured() { if (!MAIL.configured) return; DB.tx(t => { t.email_outbox.forEach(x => { if (x.status === 'not_configured') { x.status = 'queued'; x.mode = MAIL.describe(); } }); }); }
  };
  return api;
})();

const wrap = async fn => { try { return await fn(); } catch (e) { if (e instanceof ApiError) throw e; console.error(e); throw new ApiError('SERVER'); } };
const b64 = u8 => Buffer.from(u8).toString('base64');
const unb64 = t => new Uint8Array(Buffer.from(t, 'base64'));
async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 210000, hash: 'SHA-256' }, key, 256);
  return b64(new Uint8Array(bits));
}
const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
const pwProblem = pw => (typeof pw === 'string' && pw.length >= 10 && pw.length <= 200 && /[A-Za-z]/.test(pw) && /\d/.test(pw)) ? '' : MSG.WEAK_PASSWORD;

function syncPay(r) {
  if (r.status === 'Cancelled' || r.payment_status === 'Refunded' || r.payment_status === 'Refund Pending') return;
  if (r.paid_amount >= r.total - 0.5) r.payment_status = 'Paid';
  else if (r.paid_amount > 0 || r.payment_method === 'bank') r.payment_status = 'Pending';
  else r.payment_status = 'Unpaid';
}
function guestFor(s, g) {
  const em = g.email.trim().toLowerCase();
  let x = s.guests.find(y => y.email.toLowerCase() === em && y.first.toLowerCase() === g.first.trim().toLowerCase() && y.last.toLowerCase() === g.last.trim().toLowerCase());
  if (!x) { x = { id: nid(s, 'guests'), first: g.first.trim(), last: g.last.trim(), email: g.email.trim(), phone: g.phone.trim() }; s.guests.push(x); }
  else x.phone = g.phone.trim();
  return x;
}
function applyChanges(s, r, ch, user) {
  const g = s.guests.find(x => x.id === r.guest_id);
  const ci = ch.ci || r.check_in, co = ch.co || r.check_out;
  const adults = ch.adults != null ? +ch.adults : r.adults, children = ch.children != null ? +ch.children : r.children;
  let room = ch.roomId ? s.rooms.find(x => x.id === +ch.roomId) : s.rooms.find(x => x.id === r.room_id);
  if (!room) throw new ApiError('SERVER');
  const type0 = validateStayLoose(s, { ci, co, typeId: room.type_id, adults, children });
  const datesChanged = ci !== r.check_in || co !== r.check_out;
  if (datesChanged || room.id !== r.room_id) {
    if (!Q.sellable(room) && room.id !== r.room_id) throw new ApiError('ROOM_UNAVAILABLE', `Room ${room.number} is out of service.`);
    if (Q.conflicts(s, room.id, ci, co, r.id).length) {
      if (ch.roomId) throw new ApiError('ROOM_UNAVAILABLE', `Room ${room.number} is already booked for those dates.`);
      const alt = Q.freeRooms(s, ci, co, room.type_id, r.id)[0];
      if (!alt) throw new ApiError('ROOM_UNAVAILABLE', 'No room of this type is free for the new dates.');
      room = alt;
    }
  }
  const addons = {}; (r.addons || []).forEach(l => { if (l.id !== 'extra') addons[l.id] = true; });
  const qt = quote(s, { typeId: room.type_id, ci, co, adults, children, addons });
  Object.assign(r, { room_id: room.id, type_id: room.type_id, check_in: ci, check_out: co, nights: qt.nights, adults, children, guests: adults + children, price_per_night: qt.rate, addons: qt.lines, pricing: qt, total: qt.total, updated_at: new Date().toISOString() });
  if (ch.requests != null) r.special_requests = ch.requests;
  if (ch.arrival) r.arrival_time = ch.arrival;
  ['first', 'last', 'email', 'phone'].forEach(k => { if (ch[k] != null && ch[k].trim()) g[k] = ch[k].trim(); });
  syncPay(r);
  return type0;
}
function validateStayLoose(s, p) { // staff edits may touch dates in the past for in-house guests
  if (p.co <= p.ci) throw new ApiError('INVALID_DATES');
  if (diffDays(p.ci, p.co) > CONFIG.MAX_NIGHTS) throw new ApiError('MAX_NIGHTS');
  const type = s.room_types.find(x => x.id === p.typeId);
  if (!(p.adults >= 1) || p.children < 0 || p.adults + p.children > type.capacity) throw new ApiError('CAPACITY', `The ${type.name} sleeps up to ${type.capacity} guests.`);
  return type;
}

/* ---------- roles ---------- */

/* ---------- roles ---------- */
const ROLE_PERMS = {
  admin: ['*'],
  front_desk: ['res.view', 'res.edit', 'res.action', 'res.pay', 'res.email', 'res.create', 'calendar', 'frontdesk', 'rooms.view', 'housekeeping', 'messages', 'emails', 'notifications'],
  housekeeping: ['housekeeping', 'rooms.view']
};
const can = (role, perm) => { const p = ROLE_PERMS[role] || []; return p.includes('*') || p.includes(perm); };
function auth(s, perm) {
  const tk = Session.get(); if (!tk) throw new ApiError('UNAUTHORIZED');
  const h = sha(tk); const ses = s.sessions.find(x => x.token_hash === h && x.expires > Date.now()); if (!ses) throw new ApiError('UNAUTHORIZED');
  const user = s.users.find(u => u.id === ses.user_id && u.active); if (!user) throw new ApiError('UNAUTHORIZED');
  if (perm && !can(user.role, perm)) throw new ApiError('FORBIDDEN');
  return user;
}
const pubUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

function publicView(s, r) {
  const h = Q.hydrate(s, r);
  const cancelBy = new Date(parseISO(r.check_in).getTime() + 15 * 36e5 - CONFIG.FREE_CANCEL_HOURS * 36e5);
  return { number: h.number, status: h.status, payment_status: h.payment_status, payment_method: h.payment_method, guest: { first: h.guest.first, last: h.guest.last, email: h.guest.email, phone: h.guest.phone },
    type: { id: h.type.id, name: h.type.name, slug: h.type.slug }, check_in: h.check_in, check_out: h.check_out, nights: h.nights, adults: h.adults, children: h.children, price_per_night: h.price_per_night,
    lines: h.pricing.lines, pricing: h.pricing, total: h.total, paid_amount: h.paid_amount || 0, special_requests: h.special_requests, arrival_time: h.arrival_time, created_at: h.created_at,
    requests: (h.requests || []).map(q => ({ id: q.id, type: q.type, status: q.status, created_at: q.created_at })), free_cancel_until: cancelBy.toISOString(), can_change: h.status === 'Pending' || h.status === 'Confirmed', hold_expires: h.hold_expires || null,
    can_pay_online: h.status === 'Pending' && h.payment_status === 'Unpaid' && ['card', 'gcash', 'maya'].includes(h.payment_method) && PAY.configured && (!h.hold_expires || new Date(h.hold_expires) > new Date()) };
}

/* ==========================================================================
   API

/* ---------- reminders, holds, background jobs ---------- */
function refreshReminders() {
  DB.tx(s => {
    const T = todayISO(), tm = addDays(T, 1);
    s.reservations.filter(r => (r.status === 'Confirmed' || r.status === 'Pending') && (r.check_in === T || r.check_in === tm)).forEach(r => {
      const key = 'reminder:' + r.id + ':' + r.check_in;
      if (s.notifications.some(n => n.key === key)) return;
      const g = s.guests.find(x => x.id === r.guest_id);
      notify(s, { type: 'checkin_soon', key, title: r.check_in === T ? 'Arriving today' : 'Arriving tomorrow', body: `${r.number} · ${g.first} ${g.last} · Room ${s.rooms.find(x => x.id === r.room_id).number}`, res_id: r.id });
    });
  });
}
function markPaidTx(t, r, { amount, method, ref }, user) {
  const g = t.guests.find(x => x.id === r.guest_id); const now = new Date().toISOString();
  const pend = t.payments.find(p => p.reservation_id === r.id && p.status === 'Pending');
  if (pend && Math.abs(pend.amount - amount) < 1) { pend.status = 'Paid'; pend.method = method; pend.ref = ref || pend.ref; pend.at = now; }
  else t.payments.push({ id: nid(t, 'payments'), reservation_id: r.id, method, amount, status: 'Paid', ref: ref || 'pay_' + randHex(4), at: now });
  r.paid_amount = r2((r.paid_amount || 0) + amount); r.payment_method = method; syncPay(r); r.updated_at = now;
  notify(t, { type: 'payment_received', title: 'Payment received', body: `${r.number} · ${money(amount)} via ${PAY_METHODS[method]}`, res_id: r.id });
  audit(t, user || null, 'Payment recorded', 'reservation', r.id, `${r.number} · ${money(amount)} via ${PAY_METHODS[method]}`);
}
const PAYMONGO_METHOD = { card: 'card', gcash: 'gcash', paymaya: 'maya', maya: 'maya' };
// Verifies a hosted checkout with the provider and confirms the reservation. Safe to call repeatedly.
async function finalizePayment(number) {
  const s0 = DB.read(); const r0 = s0.reservations.find(x => x.number === number); if (!r0 || !r0.pay_ref || !PAY.configured) return null;
  if (r0.payment_status === 'Paid') return r0.status;
  const co = await PAY.getCheckout(r0.pay_ref); if (!co.paid) return r0.status;
  let confirmed = false, refundNeeded = false;
  DB.tx(t => {
    const r = t.reservations.find(x => x.id === r0.id); if (r.payment_status === 'Paid') return;
    const method = PAYMONGO_METHOD[co.method] || r.payment_method;
    if (r.status === 'Cancelled') {
      if (Q.conflicts(t, r.room_id, r.check_in, r.check_out, r.id).length) { r.paid_amount = r.total; r.payment_status = 'Refund Pending'; refundNeeded = true; notify(t, { type: 'payment_received', title: 'Payment after expiry: refund needed', body: `${r.number} was paid after the hold expired and the room is gone`, res_id: r.id }); audit(t, null, 'Late payment, refund needed', 'reservation', r.id, r.number); return; }
      r.status = 'Pending'; r.cancelled_at = null; r.cancel_reason = '';
    }
    markPaidTx(t, r, { amount: r.total, method, ref: co.ref }, null);
    if (r.status === 'Pending') r.status = 'Confirmed'; r.hold_expires = null; confirmed = true;
  });
  if (confirmed) { Emails.send('confirmation', r0.id, 'System'); Emails.send('payment', r0.id, 'System'); }
  return DB.read().reservations.find(x => x.id === r0.id).status;
}
async function tickJobs() {
  try {
    const s = DB.read(), now = new Date();
    // expire unpaid online holds
    for (const r of s.reservations.filter(x => x.status === 'Pending' && x.hold_expires && x.payment_status === 'Unpaid' && new Date(x.hold_expires) < now)) {
      try { if (r.pay_ref && PAY.configured) { const st = await finalizePayment(r.number); if (st && st !== 'Pending') continue; } } catch (e) { continue; }
      DB.tx(t => { const x = t.reservations.find(y => y.id === r.id); if (x.status !== 'Pending' || x.payment_status !== 'Unpaid') return; x.status = 'Cancelled'; x.cancelled_at = now.toISOString(); x.cancel_reason = 'Payment not completed in time'; x.hold_expires = null; audit(t, null, 'Hold expired', 'reservation', x.id, `${x.number} released (payment not completed)`); });
    }
    // pre-arrival reminders (once, 2 days before)
    const T = todayISO(), lim = addDays(T, 2);
    for (const r of s.reservations.filter(x => x.status === 'Confirmed' && !x.reminder_sent && x.check_in >= T && x.check_in <= lim)) {
      DB.tx(t => { const x = t.reservations.find(y => y.id === r.id); x.reminder_sent = true; });
      Emails.send('reminder', r.id, 'System');
    }
    refreshReminders();
    if (MAIL.configured) await Emails.process();
    DB.tx(t => { const n = Date.now(); const before = t.sessions.length; t.sessions = t.sessions.filter(x => x.expires > n); if (t.sessions.length === before) return; });
  } catch (e) { console.error('job error', e); }
}

/* ---------- catalogue + settings ---------- */
function applyCatalog(t) {
  catalog.ROOM_TYPES.forEach((c, i) => {
    const type = { id: nid(t, 'room_types'), slug: c.slug, name: c.name, price: c.price, capacity: c.capacity, beds: c.beds, size: c.size, view: c.view, short: c.short, description: c.description, amenities: c.amenities.slice(), active: true, sort: i };
    t.room_types.push(type);
    for (let n = 0; n < c.rooms.count; n++) {
      const number = c.rooms.prefix ? c.rooms.prefix + (n + 1) : String(c.rooms.floors[Math.floor(n / c.rooms.per)] * 100 + 1 + (n % c.rooms.per));
      const room = { id: nid(t, 'rooms'), number, type_id: type.id, status: 'Available', hk: 'Clean', notes: '' }; t.rooms.push(room); logRoom(t, room, null, 'Room added');
    }
  });
  catalog.ADDONS.forEach((a, i) => t.addons.push(Object.assign({ active: true, sort: i }, a)));
}
function applySettings(st) {
  const d = catalog.DEFAULT_SETTINGS, x = Object.assign({}, d, st || {});
  Object.assign(CONFIG.HOTEL, d.hotel, x.hotel);
  Object.assign(CONFIG, { CHECKIN: x.checkin, CHECKOUT: x.checkout, FREE_CANCEL_HOURS: x.free_cancel_hours, EXTRA_ADULT: x.extra_adult, SERVICE_RATE: x.service_rate, VAT_RATE: x.vat_rate, MAX_NIGHTS: x.max_nights, HOLD_MINUTES: x.hold_minutes, GOOGLE_MAPS_API_KEY: ENV.GOOGLE_MAPS_API_KEY || '' });
  Object.assign(CONFIG.SOCIAL, d.social, x.social);
  const bank = Object.assign({}, d.bank, x.bank);
  CONFIG.PAYMENTS = { online: !!(PAY && PAY.configured), bank: bank.account_number && bank.account_name ? bank : null, hotel: true };
}
function sampleRes() {
  const T = todayISO();
  return { id: 0, number: `LUME-${new Date().getFullYear()}-00000`, status: 'Confirmed', payment_status: 'Paid', check_in: addDays(T, 14), check_out: addDays(T, 17), nights: 3, adults: 2, children: 0, total: 328000, paid_amount: 328000, guest: { first: 'Sample', last: 'Guest', email: 'guest@example.com', phone: '' }, type: { name: 'Premier Room' }, room: { number: '000' } };
}
function bookTx(t, p, o) {
  const type = validateStay(t, p);
  const room = Q.freeRooms(t, p.ci, p.co, p.typeId)[0]; if (!room) throw new ApiError('ROOM_UNAVAILABLE');
  const q2 = quote(t, p), g = guestFor(t, p.guest), now = new Date().toISOString(), method = o.method, paid = !!o.paid;
  const r = { id: nid(t, 'reservations'), number: nextResNumber(t), guest_id: g.id, room_id: room.id, type_id: type.id, check_in: p.ci, check_out: p.co, nights: q2.nights, adults: +p.adults, children: +p.children || 0, guests: +p.adults + (+p.children || 0),
    price_per_night: q2.rate, addons: q2.lines, pricing: q2, total: q2.total, payment_method: method, paid_amount: paid ? q2.total : 0, payment_status: paid ? 'Paid' : method === 'bank' ? 'Pending' : 'Unpaid',
    status: paid ? 'Confirmed' : 'Pending', special_requests: (p.guest.requests || '').trim(), arrival_time: p.guest.arrival || '', requests: [], source: o.source, idem_key: p.idem || null,
    hold_expires: o.online ? new Date(Date.now() + CONFIG.HOLD_MINUTES * 60000).toISOString() : null, reminder_sent: false, created_at: now, updated_at: now };
  t.reservations.push(r);
  if (paid) t.payments.push({ id: nid(t, 'payments'), reservation_id: r.id, method, amount: q2.total, status: 'Paid', ref: o.ref || 'MANUAL-' + randHex(3), at: now });
  else if (method === 'bank') t.payments.push({ id: nid(t, 'payments'), reservation_id: r.id, method, amount: q2.total, status: 'Pending', ref: 'BANK-' + r.number.slice(-5), at: now });
  notify(t, { type: 'new_reservation', title: 'New reservation', body: `${r.number} · ${g.first} ${g.last} · ${type.name} · ${fmtShort(r.check_in)}`, res_id: r.id });
  if (paid) notify(t, { type: 'payment_received', title: 'Payment received', body: `${r.number} · ${money(r.total)} via ${PAY_METHODS[method]}`, res_id: r.id });
  audit(t, o.user || null, 'Reservation created', 'reservation', r.id, `${r.number} ${o.source === 'staff' ? 'created by staff' : 'booked online'} (${PAY_METHODS[method]})`);
  return r.id;
}
async function afterBook(id, o) {
  let redirect = null;
  if (o.online) {
    const s = DB.read(), r = s.reservations.find(x => x.id === id), g = s.guests.find(x => x.id === r.guest_id), type = s.room_types.find(x => x.id === r.type_id);
    try {
      const co = await PAY.createCheckout({ number: r.number, description: `${type.name}, ${r.nights} night${r.nights > 1 ? 's' : ''}, ${r.check_in} to ${r.check_out}`, amount: r.total, successUrl: baseUrl() + 'pay/return?ref=' + r.number, cancelUrl: baseUrl() + 'pay/cancelled?ref=' + r.number, email: g.email, name: g.first + ' ' + g.last, methods: [o.method === 'maya' ? 'paymaya' : o.method] });
      DB.tx(t => { const x = t.reservations.find(y => y.id === id); x.pay_ref = co.id; x.pay_url = co.url; }); redirect = co.url;
    } catch (e) {
      console.error('Payment provider error:', e.message);
      DB.tx(t => { const x = t.reservations.find(y => y.id === id); x.status = 'Cancelled'; x.cancelled_at = new Date().toISOString(); x.cancel_reason = 'Payment could not be started'; x.hold_expires = null; });
      throw new ApiError('PAYMENT_FAILED');
    }
  } else if (o.email !== false) { Emails.send('confirmation', id, 'System'); if (o.paid) Emails.send('payment', id, 'System'); }
  const s = DB.read(), r = s.reservations.find(x => x.id === id);
  return { reservation: publicView(s, r), email: o.online ? 'after_payment' : (MAIL.configured ? 'queued' : 'not_configured'), redirect_url: redirect };
}
const pubType = t => t;
function guestCheck(g) { const f = validateGuest(g || {}); if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f); }

/* ==========================================================================
   API
   ========================================================================== */
const API = {
  /* ----- public ----- */
  async roomTypes() { const s = DB.read(); return s.room_types.filter(t => t.active !== false).sort((a, b) => (a.sort || a.id) - (b.sort || b.id)).map(t => Object.assign({}, t, { total_rooms: s.rooms.filter(r => r.type_id === t.id).length })); },
  async availability(ci, co) {
    return wrap(async () => {
      if (!ci || !co || co <= ci) throw new ApiError('INVALID_DATES'); if (ci < todayISO()) throw new ApiError('PAST_DATE');
      const s = DB.read(); const counts = Q.freeCountsByType(s, ci, co); s.room_types.forEach(t => { if (t.active === false) delete counts[t.id]; }); return counts;
    });
  },
  async nightMap(from, days, typeId) { return wrap(async () => Q.nightMap(DB.read(), from, Math.min(Math.max(+days || 1, 1), 120), typeId ? +typeId : null)); },
  quote(p) { return quote(DB.read(), p); },
  async createReservation(p) {
    return wrap(async () => {
      const s = DB.read(); validateStay(s, p); guestCheck(p.guest);
      const method = p.payment && p.payment.method, online = ['card', 'gcash', 'maya'].includes(method);
      if (!['card', 'gcash', 'maya', 'bank', 'hotel'].includes(method)) throw new ApiError('PAYMENT_FAILED');
      if (online && !PAY.configured) throw new ApiError('PAYMENT_UNAVAILABLE');
      if (method === 'bank' && !CONFIG.PAYMENTS.bank) throw new ApiError('PAYMENT_UNAVAILABLE');
      const ipKey = 'book:' + ctxIp(); if (rlCheck(ipKey, 15, 10 * 6e4)) throw new ApiError('TOO_MANY'); rlFail(ipKey, 10 * 6e4);
      if (p.idem) { const dup = s.reservations.find(r => r.idem_key === p.idem); if (dup) return { reservation: publicView(s, dup), email: 'queued', redirect_url: dup.status === 'Pending' && dup.pay_url ? dup.pay_url : null }; }
      if (!Q.freeRooms(s, p.ci, p.co, p.typeId).length) throw new ApiError('ROOM_UNAVAILABLE');
      const id = DB.tx(t => bookTx(t, p, { source: 'website', method, online }));
      return afterBook(id, { online, method });
    });
  },
  async payOnline(no, email) {
    return wrap(async () => {
      no = String(no || '').trim().toUpperCase(); email = String(email || '').trim().toLowerCase();
      const s = DB.read(); const r = s.reservations.find(x => x.number === no && s.guests.find(g => g.id === x.guest_id).email.toLowerCase() === email);
      if (!r) throw new ApiError('NOT_FOUND');
      if (!PAY.configured || r.status !== 'Pending' || r.payment_status !== 'Unpaid' || !['card', 'gcash', 'maya'].includes(r.payment_method)) throw new ApiError('NOT_ALLOWED', 'This reservation can’t be paid online right now.');
      if (r.hold_expires && new Date(r.hold_expires) < new Date()) throw new ApiError('NOT_ALLOWED', 'The hold on this room has expired. Please make a new booking.');
      DB.tx(t => { const x = t.reservations.find(y => y.id === r.id); x.hold_expires = new Date(Date.now() + CONFIG.HOLD_MINUTES * 60000).toISOString(); });
      const g = s.guests.find(x => x.id === r.guest_id), type = s.room_types.find(x => x.id === r.type_id);
      const co = await PAY.createCheckout({ number: r.number, description: `${type.name}, ${r.nights} night(s)`, amount: r.total, successUrl: baseUrl() + 'pay/return?ref=' + r.number, cancelUrl: baseUrl() + 'pay/cancelled?ref=' + r.number, email: g.email, name: g.first + ' ' + g.last, methods: [r.payment_method === 'maya' ? 'paymaya' : r.payment_method] }).catch(e => { console.error(e.message); throw new ApiError('PAYMENT_FAILED'); });
      DB.tx(t => { const x = t.reservations.find(y => y.id === r.id); x.pay_ref = co.id; x.pay_url = co.url; });
      return { redirect_url: co.url };
    });
  },
  async lookup(no, email) {
    
    return wrap(async () => {
      no = (no || '').trim().toUpperCase(); email = (email || '').trim().toLowerCase();
      if (!/^LUME-\d{4}-\d{5}$/.test(no)) throw new ApiError('BAD_REF');
      if (!EMAIL_RE.test(email)) throw new ApiError('BAD_EMAIL');
      const key = 'lookup:' + ctxIp(); if (rlCheck(key, 8, 10 * 6e4)) throw new ApiError('TOO_MANY');
      const s = DB.read(); const r = s.reservations.find(x => x.number === no && s.guests.find(g => g.id === x.guest_id).email.toLowerCase() === email);
      if (!r) { rlFail(key, 10 * 6e4); throw new ApiError('NOT_FOUND'); }
      rlClear(key); return publicView(s, r);
    });
  },
  async requestChange(no, email, req) {
    
    return wrap(async () => {
      const s0 = DB.read(); const r0 = s0.reservations.find(x => x.number === (no || '').toUpperCase() && s0.guests.find(g => g.id === x.guest_id).email.toLowerCase() === (email || '').toLowerCase());
      if (!r0) throw new ApiError('NOT_FOUND');
      if (!(r0.status === 'Pending' || r0.status === 'Confirmed')) throw new ApiError('NOT_ALLOWED', 'This reservation can no longer be changed online. Please contact the hotel.');
      if ((r0.requests || []).some(q => q.type === req.type && q.status === 'Pending')) throw new ApiError('NOT_ALLOWED', 'You already have a request waiting for review. The hotel will reply by email.');
      let payload = null, feasible = true;
      if (req.type === 'modify') {
        const ci = req.ci, co = req.co, adults = +req.adults, children = +req.children || 0;
        validateStay(s0, { ci, co, typeId: r0.type_id, adults, children });
        feasible = Q.freeRooms(s0, ci, co, r0.type_id, r0.id).length > 0;
        payload = { ci, co, adults, children, note: (req.note || '').slice(0, 500) };
      }
      DB.tx(s => {
        const r = s.reservations.find(x => x.id === r0.id); const g = s.guests.find(x => x.id === r.guest_id);
        r.requests = r.requests || []; r.requests.push({ id: (r.requests.length ? Math.max(...r.requests.map(q => q.id)) : 0) + 1, type: req.type, status: 'Pending', reason: (req.reason || '').slice(0, 120), note: (req.note || '').slice(0, 500), payload, feasible, created_at: new Date().toISOString() });
        notify(s, { type: req.type === 'cancel' ? 'cancellation_request' : 'modification_request', title: req.type === 'cancel' ? 'Cancellation requested' : 'Modification requested', body: `${r.number} · ${g.first} ${g.last}`, res_id: r.id });
        audit(s, null, req.type === 'cancel' ? 'Cancellation requested' : 'Modification requested', 'reservation', r.id, `${r.number} requested by guest`);
      });
      const s2 = DB.read(); return publicView(s2, s2.reservations.find(x => x.id === r0.id));
    });
  },
  async sendContact(m, kind) {
    
    return wrap(async () => {
      const f = {};
      if (!m.name || m.name.trim().length < 2) f.name = 'Enter your name.';
      if (!EMAIL_RE.test((m.email || '').trim())) f.email = 'Enter a valid email address.';
      if (m.phone && !/^\+?\d{7,15}$/.test(m.phone.replace(/[\s()-]/g, ''))) f.phone = 'Enter a valid phone number.';
      if (!m.subject || m.subject.trim().length < 2) f.subject = 'Add a subject.';
      if (!m.message || m.message.trim().length < 5) f.message = 'Tell us a little more.';
      if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f);
      DB.tx(s => {
        const id = nid(s, 'contact_messages');
        s.contact_messages.push({ id, name: m.name.trim(), email: m.email.trim(), phone: (m.phone || '').trim(), subject: m.subject.trim().slice(0, 120), message: m.message.trim().slice(0, 2000), kind: kind || 'contact', status: 'New', at: new Date().toISOString() });
        notify(s, { type: 'message', title: kind === 'dining' ? 'Dining reservation request' : 'New message', body: `${m.name.trim()} · ${m.subject.trim()}`, res_id: null });
      });
      return true;
    });
  },

  async config() {
    const s = DB.read(); const photos = {}; Object.entries(s.settings.photos || {}).forEach(([k, f]) => { photos[k] = '/media/' + f; });
    return { config: { HOTEL: CONFIG.HOTEL, CURRENCY: CONFIG.CURRENCY, SERVICE_RATE: CONFIG.SERVICE_RATE, VAT_RATE: CONFIG.VAT_RATE, EXTRA_ADULT: CONFIG.EXTRA_ADULT, CHECKIN: CONFIG.CHECKIN, CHECKOUT: CONFIG.CHECKOUT, FREE_CANCEL_HOURS: CONFIG.FREE_CANCEL_HOURS, MAX_NIGHTS: CONFIG.MAX_NIGHTS, HOLD_MINUTES: CONFIG.HOLD_MINUTES, GOOGLE_MAPS_API_KEY: CONFIG.GOOGLE_MAPS_API_KEY, SOCIAL: CONFIG.SOCIAL, PAYMENTS: CONFIG.PAYMENTS },
      roomTypes: await API.roomTypes(), addons: s.addons.filter(a => a.active !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)), photos, needsSetup: s.users.length === 0, stats: { rooms: s.rooms.length } };
  },
  async setup(b) {
    return wrap(async () => {
      const s0 = DB.read(); if (s0.users.length) throw new ApiError('NOT_ALLOWED', 'Setup has already been completed.');
      const key = 'setup:' + ctxIp(); if (rlCheck(key, 6, 10 * 6e4)) throw new ApiError('TOO_MANY');
      const code = String(b.code || '').trim().toUpperCase(), real = String(s0.meta.setup_code || '');
      if (!real || code.length !== real.length || !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(real))) { rlFail(key, 10 * 6e4); throw new ApiError('BAD_SETUP_CODE'); }
      const f = {}; const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
      if (name.length < 2 || name.length > 60) f.name = 'Enter your name.'; if (!EMAIL_RE.test(email)) f.email = 'Enter a valid email address.'; if (pwProblem(b.password)) f.password = pwProblem(b.password);
      if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f);
      const salt = newSalt(), hash = await hashPw(b.password, salt); const token = crypto.randomBytes(32).toString('hex'); let user;
      DB.tx(t => {
        if (t.users.length) throw new ApiError('NOT_ALLOWED', 'Setup has already been completed.');
        user = { id: nid(t, 'users'), name, email, role: 'admin', salt, hash, active: true, created_at: new Date().toISOString(), last_login: new Date().toISOString() }; t.users.push(user);
        t.settings = JSON.parse(JSON.stringify(catalog.DEFAULT_SETTINGS)); if (b.catalog !== false) applyCatalog(t);
        delete t.meta.setup_code; audit(t, user, 'Hotel system set up', 'system', null, b.catalog !== false ? 'Standard room catalogue added' : 'Started with no rooms');
        t.sessions.push({ token_hash: sha(token), user_id: user.id, expires: Date.now() + 12 * 36e5, created_at: new Date().toISOString(), ip: ctxIp() });
      });
      applySettings(DB.read().settings); Session.set(token); return pubUser(user);
    });
  },

  /* ----- staff ----- */
  staff: {
    async login(email, pw) {
      return wrap(async () => {
        email = (email || '').trim().toLowerCase(); const key = 'login:' + email, ipk = 'loginip:' + ctxIp();
        if (rlCheck(key, 6, 10 * 6e4) || rlCheck(ipk, 30, 10 * 6e4)) throw new ApiError('LOCKED');
        const s = DB.read(); const u = s.users.find(x => x.email === email && x.active); let ok = false;
        if (u) { const h = await hashPw(String(pw || ''), u.salt); ok = h.length === u.hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash)); } else await hashPw(String(pw || ''), newSalt());
        if (!ok) { rlFail(key, 10 * 6e4); rlFail(ipk, 10 * 6e4); DB.tx(t => audit(t, null, 'Sign-in failed', 'auth', null, email)); throw new ApiError('BAD_LOGIN'); }
        rlClear(key); const token = crypto.randomBytes(32).toString('hex');
        DB.tx(t => { t.sessions = t.sessions.filter(x => x.expires > Date.now()); t.sessions.push({ token_hash: sha(token), user_id: u.id, expires: Date.now() + 12 * 36e5, created_at: new Date().toISOString(), ip: ctxIp() }); t.users.find(x => x.id === u.id).last_login = new Date().toISOString(); audit(t, u, 'Signed in', 'auth', u.id, u.role); });
        Session.set(token); refreshReminders(); return pubUser(u);
      });
    },
    async logout() { const tk = Session.get(); if (tk) { try { DB.tx(t => { const h = sha(tk); const ses = t.sessions.find(x => x.token_hash === h); if (ses) { const u = t.users.find(x => x.id === ses.user_id); audit(t, u, 'Signed out', 'auth', u && u.id); } t.sessions = t.sessions.filter(x => x.token_hash !== h); }); } catch (e) { } } Session.set('');  },
    me() { try { return pubUser(auth(DB.read())); } catch (e) { return null; } },

    async dashboard() {
      return wrap(async () => {
        const s = DB.read(); const u = auth(s, 'res.view'); const T = todayISO();
        const H = r => Q.hydrate(s, r);
        const arrivals = s.reservations.filter(r => r.check_in === T && (r.status === 'Pending' || r.status === 'Confirmed' || r.status === 'Checked In')).map(H);
        const departures = s.reservations.filter(r => (r.check_out === T || (r.check_out < T)) && r.status === 'Checked In').map(H);
        const inhouse = s.reservations.filter(r => r.status === 'Checked In').map(H);
        const statuses = s.rooms.map(r => Q.display(s, r, T));
        const week = []; for (let i = 0; i < 7; i++) { const d = addDays(T, i); const occ = s.rooms.length - s.rooms.filter(r => !Q.sellable(r)).length - Q.freeOnNight(s, d); week.push({ date: d, occupied: occ }); }
        return { user: pubUser(u), arrivals, departures, inhouse, available: Q.freeRooms(s, T, addDays(T, 1)).length, occupied: statuses.filter(x => x === 'Occupied').length, pending: s.reservations.filter(r => r.status === 'Pending').length,
          requests: s.reservations.filter(r => (r.requests || []).some(q => q.status === 'Pending')).map(H), pendingList: s.reservations.filter(r => r.status === 'Pending').map(H).slice(0, 6), totalRooms: s.rooms.length, week, failedEmails: s.email_outbox.filter(e => e.status === 'failed').length, unsentEmails: s.email_outbox.filter(e => e.status === 'not_configured').length, mailConfigured: MAIL.configured };
      });
    },
    async reservations(f = {}) {
      return wrap(async () => {
        const s = DB.read(); auth(s, 'res.view');
        let rows = s.reservations.map(r => Q.hydrate(s, r));
        const q = (f.q || '').trim().toLowerCase();
        if (q) rows = rows.filter(r => [r.number, r.guest.first + ' ' + r.guest.last, r.guest.email, r.guest.phone, r.room.number].some(v => String(v).toLowerCase().includes(q)));
        if (f.name) rows = rows.filter(r => (r.guest.first + ' ' + r.guest.last).toLowerCase().includes(f.name.toLowerCase()));
        if (f.status) rows = rows.filter(r => r.status === f.status);
        if (f.pay) rows = rows.filter(r => r.payment_status === f.pay);
        if (f.room) rows = rows.filter(r => String(r.room_id) === String(f.room));
        if (f.type) rows = rows.filter(r => String(r.type_id) === String(f.type));
        if (f.date) rows = rows.filter(r => r.check_in <= f.date && f.date < r.check_out);
        const dir = f.dir === 'asc' ? 1 : -1; const k = f.sort || 'created_at';
        rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir);
        return { total: rows.length, rows };
      });
    },
    async reservation(id) { return wrap(async () => { const s = DB.read(); auth(s, 'res.view'); const r = s.reservations.find(x => x.id === id); if (!r) throw new ApiError('NOT_FOUND', 'That reservation no longer exists.'); return Object.assign(Q.hydrate(s, r), { log: s.audit_logs.filter(a => a.entity === 'reservation' && a.entity_id === id).slice(-12).reverse(), email_count: s.email_outbox.filter(e => e.reservation_id === id).length }); }); },

    async action(id, action, opts = {}) {
      let emailJob = null;
      const out = await wrap(async () => DB.tx(s => {
        const u = auth(s, 'res.action'); const r = s.reservations.find(x => x.id === id); if (!r) throw new ApiError('NOT_FOUND', 'That reservation no longer exists.');
        const g = s.guests.find(x => x.id === r.guest_id); const room = s.rooms.find(x => x.id === r.room_id); const T = todayISO(); const now = new Date().toISOString();
        const bad = m => { throw new ApiError('NOT_ALLOWED', m); };
        if (action === 'confirm') {
          if (r.status !== 'Pending') bad('Only pending reservations can be confirmed.');
          r.status = 'Confirmed'; emailJob = 'confirmation';
        } else if (action === 'checkin') {
          if (r.status === 'Pending') bad('Confirm this reservation first, then check the guest in.');
          if (r.status !== 'Confirmed') bad('Only confirmed reservations can be checked in.');
          if (r.check_in > T && !opts.early) throw new ApiError('EARLY', `${g.first} isn’t due until ${fmtDate(r.check_in)}.`);
          if (r.check_out <= T) bad('The stay dates have already passed. Edit the reservation first.');
          if (room.status === 'Occupied') bad(`Room ${room.number} is still occupied.`);
          if (!Q.sellable(room)) bad(`Room ${room.number} is out of service. Reassign the guest to another room first.`);
          if (room.status === 'Cleaning') bad(`Room ${room.number} is still being cleaned. Mark it clean, or reassign the guest.`);
          if (r.check_in > T && Q.conflicts(s, room.id, T, r.check_in, r.id).length) bad(`Room ${room.number} is booked by another guest before this arrival.`);
          r.status = 'Checked In'; r.checked_in_at = now; room.status = 'Occupied'; logRoom(s, room, u, 'Check-in ' + r.number);
        } else if (action === 'checkout') {
          if (r.status !== 'Checked In') bad('Only checked-in guests can be checked out.');
          r.status = 'Checked Out'; r.checked_out_at = now; room.status = 'Cleaning'; room.hk = 'Dirty'; logRoom(s, room, u, 'Check-out ' + r.number); emailJob = 'thankyou';
        } else if (action === 'noshow') {
          if (!(r.status === 'Pending' || r.status === 'Confirmed')) bad('Only reservations that haven’t arrived can be marked as no-show.');
          if (r.check_in > T) bad(`The arrival date is ${fmtDate(r.check_in)}. A no-show can be recorded from then.`);
          r.status = 'No Show';
        } else if (action === 'cancel') {
          if (!(r.status === 'Pending' || r.status === 'Confirmed')) bad('Only reservations that haven’t arrived can be cancelled.');
          r.status = 'Cancelled'; r.cancelled_at = now; r.cancel_reason = opts.reason || '';
          if (opts.refund && r.paid_amount > 0) { r.payment_status = 'Refund Pending'; } else if (r.payment_status === 'Pending' || r.payment_status === 'Unpaid') { r.payment_status = 'Unpaid'; }
          (r.requests || []).forEach(q => { if (q.type === 'cancel' && q.status === 'Pending') q.status = 'Approved'; });
          notify(s, { type: 'cancelled', title: 'Reservation cancelled', body: `${r.number} · ${g.first} ${g.last}`, res_id: r.id }); emailJob = 'cancellation';
        } else throw new ApiError('SERVER');
        r.updated_at = now;
        audit(s, u, { confirm: 'Reservation confirmed', checkin: opts.early ? 'Guest checked in (early)' : 'Guest checked in', checkout: 'Guest checked out', noshow: 'Marked no-show', cancel: 'Reservation cancelled' }[action], 'reservation', r.id, `${r.number} · room ${room.number}${opts.reason ? ' · ' + opts.reason : ''}`);
        return { number: r.number, status: r.status };
      }));
      let email = null; if (emailJob) { try { email = await Emails.send(emailJob, id, 'System'); } catch (e) { email = { ok: false }; } }
      return Object.assign(out, { email });
    },
    async update(id, ch, opts = {}) {
      const before = {};
      const out = await wrap(async () => DB.tx(s => {
        const u = auth(s, 'res.edit'); const r = s.reservations.find(x => x.id === id); if (!r) throw new ApiError('NOT_FOUND');
        if (!ACTIVE.has(r.status)) throw new ApiError('NOT_ALLOWED', 'Only active reservations can be edited.');
        const gf = validateGuest({ first: ch.first || 'x', last: ch.last || 'x', email: ch.email || 'x@x.xx', phone: ch.phone || '0917000000', requests: ch.requests || '' }); if (Object.keys(gf).length) throw new ApiError('VALIDATION', null, gf);
        const old = `${r.check_in}→${r.check_out} room ${s.rooms.find(x => x.id === r.room_id).number} total ${r.total}`;
        applyChanges(s, r, ch, u);
        const g = s.guests.find(x => x.id === r.guest_id);
        notify(s, { type: 'modified', title: 'Reservation modified', body: `${r.number} · ${g.first} ${g.last} · edited by ${u.name}`, res_id: r.id });
        audit(s, u, 'Reservation edited', 'reservation', r.id, `${r.number}: was ${old}; now ${r.check_in}→${r.check_out} room ${s.rooms.find(x => x.id === r.room_id).number} total ${r.total}`);
        return { number: r.number };
      }));
      let email = null; if (opts.email) { try { email = await Emails.send('modification', id, 'System'); } catch (e) { email = { ok: false }; } }
      return Object.assign(out, { email });
    },
    async pay(id, { method, amount }) {
      let ok = false;
      const out = await wrap(async () => DB.tx(s => {
        const u = auth(s, 'res.pay'); const r = s.reservations.find(x => x.id === id); if (!r) throw new ApiError('NOT_FOUND');
        if (r.status === 'Cancelled' || r.status === 'No Show') throw new ApiError('NOT_ALLOWED', 'Payments can’t be recorded on this reservation.');
        const balance = r2(r.total - (r.paid_amount || 0)); const amt = amount ? +amount : balance;
        if (!(amt > 0) || amt > balance + 0.5) throw new ApiError('VALIDATION', `Enter an amount between ${money(1)} and the balance of ${money(balance)}.`);
        const pend = s.payments.find(p => p.reservation_id === r.id && p.status === 'Pending');
        if (pend && Math.abs(pend.amount - amt) < 1) { pend.status = 'Paid'; pend.method = method; pend.at = new Date().toISOString(); }
        else s.payments.push({ id: nid(s, 'payments'), reservation_id: r.id, method, amount: amt, status: 'Paid', ref: 'pay_' + randHex(4), at: new Date().toISOString() });
        r.paid_amount = r2((r.paid_amount || 0) + amt); r.payment_method = method; syncPay(r); r.updated_at = new Date().toISOString();
        const g = s.guests.find(x => x.id === r.guest_id);
        notify(s, { type: 'payment_received', title: 'Payment received', body: `${r.number} · ${money(amt)} via ${PAY_METHODS[method]}`, res_id: r.id });
        audit(s, u, 'Payment recorded', 'reservation', r.id, `${r.number} · ${money(amt)} via ${PAY_METHODS[method]}`); ok = true;
        return { number: r.number, status: r.payment_status };
      }));
      let email = null; if (ok) { try { email = await Emails.send('payment', id, 'System'); } catch (e) { email = { ok: false }; } }
      return Object.assign(out, { email });
    },
    async refund(id) {
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'res.pay'); const r = s.reservations.find(x => x.id === id); if (!r || r.payment_status !== 'Refund Pending') throw new ApiError('NOT_ALLOWED', 'There’s no refund waiting on this reservation.');
        r.payment_status = 'Refunded'; s.payments.filter(p => p.reservation_id === id && p.status === 'Paid').forEach(p => p.status = 'Refunded'); r.updated_at = new Date().toISOString();
        audit(s, u, 'Refund completed', 'reservation', id, r.number); return true;
      }));
    },
    async email(id, template) {
      const u = auth(DB.read(), 'res.email'); if (!Emails.templates[template] || template === 'test') throw new ApiError('SERVER');
      const res = Emails.send(template, id, u.name); DB.tx(s => audit(s, u, 'Email queued', 'reservation', id, `${Emails.templates[template].label} · ${res.status}`)); return res;
    },
    async resendEmail(outboxId) { const u = auth(DB.read(), 'emails'); Emails.requeue(+outboxId); DB.tx(s => audit(s, u, 'Email resend requested', 'email', +outboxId, '')); return true; },
    async sendTestEmail(to) {
      const u = auth(DB.read(), 'settings'); to = String(to || '').trim(); if (!EMAIL_RE.test(to)) throw new ApiError('VALIDATION', null, { to: 'Enter a valid email address.' });
      const res = Emails.send('test', null, u.name, to); DB.tx(s => audit(s, u, 'Test email queued', 'email', null, to)); return res;
    },
    async templates() { auth(DB.read(), 'emails'); return Object.entries(Emails.templates).filter(([k]) => k !== 'test').map(([k, v]) => ({ id: k, label: v.label })); },
    async emailPreview({ template, res_id, outbox_id }) {
      const s = DB.read(); auth(s, 'emails');
      if (outbox_id) { const row = s.email_outbox.find(x => x.id === +outbox_id); if (!row) throw new ApiError('NOT_FOUND'); return Emails.render_row(row); }
      if (!Emails.templates[template]) throw new ApiError('SERVER');
      const r = res_id ? Q.hydrate(s, s.reservations.find(x => x.id === +res_id)) : sampleRes(); return Emails.render(template, r);
    },
    async resolveRequest(id, reqId, decision) {
      let job = null;
      const out = await wrap(async () => DB.tx(s => {
        const u = auth(s, 'res.action'); const r = s.reservations.find(x => x.id === id); const q = r && r.requests.find(x => x.id === reqId);
        if (!q || q.status !== 'Pending') throw new ApiError('NOT_ALLOWED', 'That request was already handled.');
        if (decision === 'decline') { q.status = 'Declined'; audit(s, u, 'Request declined', 'reservation', id, `${r.number} · ${q.type}`); return { done: 'declined' }; }
        if (q.type === 'modify') {
          if (!ACTIVE.has(r.status)) throw new ApiError('NOT_ALLOWED');
          applyChanges(s, r, { ci: q.payload.ci, co: q.payload.co, adults: q.payload.adults, children: q.payload.children }, u); q.status = 'Approved'; job = 'modification';
          audit(s, u, 'Modification approved', 'reservation', id, r.number);
        } else {
          if (!(r.status === 'Pending' || r.status === 'Confirmed')) throw new ApiError('NOT_ALLOWED');
          r.status = 'Cancelled'; r.cancelled_at = new Date().toISOString(); r.cancel_reason = q.reason || 'Guest request'; q.status = 'Approved';
          const free = new Date(parseISO(r.check_in).getTime() + 15 * 36e5 - CONFIG.FREE_CANCEL_HOURS * 36e5) > new Date();
          if (free && r.paid_amount > 0) r.payment_status = 'Refund Pending'; job = 'cancellation';
          audit(s, u, 'Cancellation approved', 'reservation', id, r.number);
        }
        r.updated_at = new Date().toISOString(); return { done: 'approved' };
      }));
      if (job) { try { await Emails.send(job, id, 'System'); } catch (e) { } }
      return out;
    },

    async rooms() {
      return wrap(async () => {
        const s = DB.read(); auth(s, 'rooms.view'); const T = todayISO();
        const rooms = s.rooms.slice().sort(byNo).map(r => {
          const cur = s.reservations.find(x => x.room_id === r.id && x.status === 'Checked In');
          const next = s.reservations.filter(x => x.room_id === r.id && (x.status === 'Confirmed' || x.status === 'Pending') && x.check_out > T).sort((a, b) => a.check_in.localeCompare(b.check_in))[0];
          const gn = x => x ? s.guests.find(g => g.id === x.guest_id).first + ' ' + s.guests.find(g => g.id === x.guest_id).last : '';
          return Object.assign({}, r, { display: Q.display(s, r, T), type: s.room_types.find(t => t.id === r.type_id), current: cur ? { number: cur.number, guest: gn(cur), out: cur.check_out } : null, next: next ? { number: next.number, guest: gn(next), in: next.check_in } : null });
        });
        return { rooms, types: s.room_types };
      });
    },
    async saveRoom(r) {
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'rooms.manage'); const number = String(r.number || '').trim();
        if (!/^[A-Za-z0-9-]{1,8}$/.test(number)) throw new ApiError('VALIDATION', null, { number: 'Use up to 8 letters or numbers.' });
        if (s.rooms.some(x => x.number === number && x.id !== r.id)) throw new ApiError('VALIDATION', null, { number: 'That room number already exists.' });
        if (!s.room_types.some(t => t.id === +r.type_id)) throw new ApiError('VALIDATION', null, { type_id: 'Choose a room type.' });
        if (r.id) {
          const x = s.rooms.find(y => y.id === r.id);
          if (+r.type_id !== x.type_id && s.reservations.some(q => q.room_id === x.id && ACTIVE.has(q.status))) throw new ApiError('NOT_ALLOWED', 'This room has active reservations. Move them before changing its type.');
          x.number = number; x.type_id = +r.type_id; x.notes = (r.notes || '').slice(0, 200); audit(s, u, 'Room edited', 'room', x.id, `Room ${number}`);
        } else { const x = { id: nid(s, 'rooms'), number, type_id: +r.type_id, status: 'Available', hk: 'Clean', notes: (r.notes || '').slice(0, 200) }; s.rooms.push(x); logRoom(s, x, u, 'Room added'); audit(s, u, 'Room added', 'room', x.id, `Room ${number}`); }
        return true;
      }));
    },
    async deleteRoom(id) {
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'rooms.manage'); const x = s.rooms.find(y => y.id === id); if (!x) throw new ApiError('NOT_FOUND');
        if (s.reservations.some(q => q.room_id === id && ACTIVE.has(q.status))) throw new ApiError('NOT_ALLOWED', `Room ${x.number} has active reservations. Move or cancel them first.`);
        if (s.reservations.some(q => q.room_id === id)) throw new ApiError('NOT_ALLOWED', `Room ${x.number} has booking history, so it can’t be deleted. Set it to Out of Order instead.`);
        s.rooms = s.rooms.filter(y => y.id !== id); audit(s, u, 'Room deleted', 'room', id, `Room ${x.number}`); return true;
      }));
    },
    async saveType(t) {
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'rooms.manage'); const f = {}; const name = String(t.name || '').trim();
        if (!name || name.length > 60) f.name = 'Enter a room type name.';
        if (!(+t.price >= 1000 && +t.price <= 2000000)) f.price = 'Enter a nightly price between ₱1,000 and ₱2,000,000.';
        if (!(+t.capacity >= 1 && +t.capacity <= 12)) f.capacity = 'Enter a capacity from 1 to 12.';
        if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f);
        let x = t.id ? s.room_types.find(y => y.id === +t.id) : null; if (t.id && !x) throw new ApiError('NOT_FOUND');
        const isNew = !x;
        if (!x) { let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'room'; while (s.room_types.some(y => y.slug === slug)) slug += '-2'; x = { id: nid(s, 'room_types'), slug, active: true, sort: 100 + s.room_types.length, amenities: [] }; s.room_types.push(x); }
        const old = x.price; const has = k => t[k] != null;
        Object.assign(x, { name, price: +t.price, capacity: +t.capacity, beds: String(has('beds') ? t.beds : x.beds || '').slice(0, 80), size: +t.size || x.size || 30, view: String(has('view') ? t.view : x.view || '').slice(0, 80), short: String(has('short') ? t.short : x.short || '').slice(0, 200), description: String(has('description') ? t.description : x.description || '').slice(0, 1400) });
        if (has('active')) x.active = !!t.active;
        if (has('amenities')) x.amenities = String(t.amenities).split(',').map(a => a.trim()).filter(Boolean).slice(0, 24);
        audit(s, u, isNew ? 'Room type added' : 'Room type edited', 'room_type', x.id, isNew ? x.name : `${x.name}: price ${money(old)} → ${money(x.price)}`); return true;
      }));
    },
    async setRoomStatus(id, status, why) {
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'housekeeping'); const x = s.rooms.find(y => y.id === id); if (!x) throw new ApiError('NOT_FOUND');
        if (!['Available', 'Cleaning', 'Maintenance', 'Out of Order'].includes(status)) throw new ApiError('NOT_ALLOWED', 'Rooms become Occupied by checking a guest in.');
        if (x.status === 'Occupied') throw new ApiError('NOT_ALLOWED', `Room ${x.number} has a guest checked in. Check them out first.`);
        if ((status === 'Maintenance' || status === 'Out of Order')) {
          const up = s.reservations.filter(q => q.room_id === id && ACTIVE.has(q.status) && q.check_out > todayISO());
          if (up.length) throw new ApiError('NOT_ALLOWED', `Room ${x.number} has ${up.length} upcoming reservation${up.length > 1 ? 's' : ''} (${up.map(q => q.number).join(', ')}). Move them first so guests aren’t left without a room.`);
        }
        x.status = status; x.hk = status === 'Cleaning' ? 'Dirty' : status === 'Available' ? 'Clean' : 'Maintenance'; logRoom(s, x, u, why || 'Manual change'); audit(s, u, 'Room status changed', 'room', id, `Room ${x.number} → ${status}`); return true;
      }));
    },
    async housekeeping(id, step) { // dirty -> cleaning -> clean(available)
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'housekeeping'); const x = s.rooms.find(y => y.id === id); if (!x) throw new ApiError('NOT_FOUND');
        if (step === 'start') { if (x.status !== 'Cleaning') throw new ApiError('NOT_ALLOWED'); x.hk = 'Cleaning'; }
        else if (step === 'clean') { if (x.status !== 'Cleaning') throw new ApiError('NOT_ALLOWED'); x.hk = 'Clean'; x.status = 'Available'; }
        else if (step === 'dirty') { if (x.status !== 'Available') throw new ApiError('NOT_ALLOWED', 'Only vacant rooms can be marked dirty.'); x.status = 'Cleaning'; x.hk = 'Dirty'; }
        else if (step === 'restore') { if (!(x.status === 'Maintenance' || x.status === 'Out of Order')) throw new ApiError('NOT_ALLOWED'); x.status = 'Cleaning'; x.hk = 'Dirty'; }
        else throw new ApiError('SERVER');
        logRoom(s, x, u, 'Housekeeping ' + step); audit(s, u, 'Housekeeping update', 'room', id, `Room ${x.number} → ${x.status} / ${x.hk}`); return true;
      }));
    },
    async calendar(from, days) {
      return wrap(async () => {
        const s = DB.read(); auth(s, 'calendar'); const to = addDays(from, days);
        const rooms = s.rooms.slice().sort(byNo).map(r => Object.assign({}, r, { type: s.room_types.find(t => t.id === r.type_id) }));
        const res = s.reservations.filter(r => (ACTIVE.has(r.status) || r.status === 'Checked Out') && overlaps(r.check_in, r.check_out, from, to)).map(r => Q.hydrate(s, r));
        return { rooms, res };
      });
    },
    async analytics(from, to) {
      return wrap(async () => {
        const s = DB.read(); auth(s, 'analytics'); const T = todayISO(); const days = diffDays(from, to) + 1;
        const inR = s.reservations.filter(r => r.check_in >= from && r.check_in <= to);
        const live = inR.filter(r => r.status !== 'Cancelled' && r.status !== 'No Show');
        const good = ['Confirmed', 'Checked In', 'Checked Out'];
        const daysArr = []; const capacity = s.rooms.length;
        for (let i = 0; i < days; i++) {
          const d = addDays(from, i);
          const occ = s.reservations.filter(r => good.includes(r.status) && r.check_in <= d && d < r.check_out).length;
          const rev = s.reservations.filter(r => r.check_in === d && r.status !== 'Cancelled' && r.status !== 'No Show' && r.payment_status === 'Paid').reduce((n, r) => n + r.total, 0);
          daysArr.push({ date: d, occ, rev });
        }
        const byType = s.room_types.map(t => ({ name: t.name, count: live.filter(r => r.type_id === t.id).length, revenue: live.filter(r => r.type_id === t.id && r.payment_status === 'Paid').reduce((n, r) => n + r.total, 0) }));
        const top = byType.slice().sort((a, b) => b.count - a.count)[0];
        const statusCounts = {}; RES_STATUS.forEach(x => statusCounts[x] = inR.filter(r => r.status === x).length);
        const gl = live.filter(r => good.includes(r.status));
        return { days, total: inR.length, arrivalsToday: s.reservations.filter(r => r.check_in === T && ACTIVE.has(r.status)).length, departuresToday: s.reservations.filter(r => r.check_out === T && (r.status === 'Checked In' || r.status === 'Checked Out')).length,
          occupancy: capacity ? daysArr.reduce((n, d) => n + d.occ, 0) / (capacity * days) : 0, revenue: r2(live.filter(r => r.payment_status === 'Paid').reduce((n, r) => n + r.total, 0)),
          pendingPayments: live.filter(r => r.payment_status === 'Pending' || r.payment_status === 'Unpaid').reduce((n, r) => n + (r.total - (r.paid_amount || 0)), 0), cancelled: inR.filter(r => r.status === 'Cancelled').length,
          topType: top && top.count ? top.name : '–', avgStay: gl.length ? gl.reduce((n, r) => n + r.nights, 0) / gl.length : 0, series: daysArr, byType, statusCounts };
      });
    },
    async notifications() { return wrap(async () => { const s = DB.read(); const u = auth(s, 'notifications'); return s.notifications.filter(n => n.roles.includes(u.role) || u.role === 'admin').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40); }); },
    unreadCount() { try { const s = DB.read(); const u = auth(s); if (!can(u.role, 'notifications')) return 0; return s.notifications.filter(n => !n.read && (n.roles.includes(u.role) || u.role === 'admin')).length; } catch (e) { return 0; } },
    async markRead(ids) { return wrap(async () => DB.tx(s => { auth(s, 'notifications'); s.notifications.forEach(n => { if (ids === 'all' || ids.includes(n.id)) n.read = true; }); return true; })); },
    async messages() { return wrap(async () => { const s = DB.read(); auth(s, 'messages'); return s.contact_messages.slice().sort((a, b) => b.at.localeCompare(a.at)); }); },
    async messageStatus(id, status) { return wrap(async () => DB.tx(s => { const u = auth(s, 'messages'); const m = s.contact_messages.find(x => x.id === id); if (!m) throw new ApiError('NOT_FOUND'); if (!['New', 'Read', 'Replied', 'Archived'].includes(status)) throw new ApiError('SERVER'); m.status = status; audit(s, u, 'Message marked ' + status.toLowerCase(), 'message', id, m.subject); return true; })); },
    async outbox() { return wrap(async () => { const s = DB.read(); auth(s, 'emails'); return s.email_outbox.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100); }); },
    async auditLog() { return wrap(async () => { const s = DB.read(); auth(s, 'audit'); return s.audit_logs.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300); }); },
    async freeRooms(ci, co, exclude) {
      const s = DB.read(); auth(s, 'res.view'); if (!ci || !co || co <= ci) return [];
      return Q.freeRooms(s, ci, co, null, exclude ? +exclude : undefined).map(r => ({ id: r.id, number: r.number, type_id: r.type_id, type_name: s.room_types.find(t => t.id === r.type_id).name }));
    },
    async createReservation(p) {
      return wrap(async () => {
        const s = DB.read(); const u = auth(s, 'res.create'); validateStay(s, p); guestCheck(p.guest);
        const method = p.payment && p.payment.method; if (!PAY_METHODS[method]) throw new ApiError('PAYMENT_FAILED');
        const paid = !!(p.payment && p.payment.paid);
        if (!Q.freeRooms(s, p.ci, p.co, p.typeId).length) throw new ApiError('ROOM_UNAVAILABLE');
        const id = DB.tx(t => bookTx(t, p, { source: 'staff', method, online: false, paid, user: u, ref: p.payment && p.payment.ref }));
        return afterBook(id, { online: false, method, paid, email: p.sendEmail !== false });
      });
    },
    async users() { const s = DB.read(); auth(s, 'users'); return s.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, last_login: u.last_login || null, created_at: u.created_at })); },
    async createUser(b) {
      return wrap(async () => {
        const s0 = DB.read(); const admin = auth(s0, 'users'); const f = {}; const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
        if (name.length < 2 || name.length > 60) f.name = 'Enter a name.'; if (!EMAIL_RE.test(email)) f.email = 'Enter a valid email address.'; if (!ROLE_PERMS[b.role]) f.role = 'Choose a role.'; if (pwProblem(b.password)) f.password = pwProblem(b.password);
        if (s0.users.some(u => u.email === email)) f.email = 'A staff member with that email already exists.';
        if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f);
        const salt = newSalt(), hash = await hashPw(b.password, salt);
        DB.tx(t => { const u = { id: nid(t, 'users'), name, email, role: b.role, salt, hash, active: true, created_at: new Date().toISOString() }; t.users.push(u); audit(t, admin, 'Staff account created', 'user', u.id, `${name} (${b.role})`); }); return true;
      });
    },
    async updateUser(id, b) {
      return wrap(async () => DB.tx(s => {
        const admin = auth(s, 'users'); const u = s.users.find(x => x.id === +id); if (!u) throw new ApiError('NOT_FOUND');
        const role = b.role || u.role, active = b.active == null ? u.active : !!b.active; if (!ROLE_PERMS[role]) throw new ApiError('SERVER');
        const admins = s.users.filter(x => x.role === 'admin' && x.active && x.id !== u.id).length;
        if (u.role === 'admin' && (role !== 'admin' || !active) && !admins) throw new ApiError('NOT_ALLOWED', 'There must always be at least one active administrator.');
        if (u.id === admin.id && !active) throw new ApiError('NOT_ALLOWED', 'You can’t deactivate your own account.');
        if (b.name != null && String(b.name).trim().length >= 2) u.name = String(b.name).trim().slice(0, 60); u.role = role; u.active = active;
        if (!active) s.sessions = s.sessions.filter(x => x.user_id !== u.id);
        audit(s, admin, 'Staff account updated', 'user', u.id, `${u.name}: ${role}, ${active ? 'active' : 'deactivated'}`); return true;
      }));
    },
    async resetPassword(id, password) {
      return wrap(async () => {
        const admin = auth(DB.read(), 'users'); if (pwProblem(password)) throw new ApiError('VALIDATION', null, { password: pwProblem(password) });
        const salt = newSalt(), hash = await hashPw(password, salt);
        DB.tx(s => { const u = s.users.find(x => x.id === +id); if (!u) throw new ApiError('NOT_FOUND'); u.salt = salt; u.hash = hash; s.sessions = s.sessions.filter(x => x.user_id !== u.id); audit(s, admin, 'Password reset', 'user', u.id, u.email); }); return true;
      });
    },
    async changePassword(oldPw, newPw) {
      return wrap(async () => {
        const me = auth(DB.read()); const h = await hashPw(String(oldPw || ''), me.salt);
        if (h.length !== me.hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(me.hash))) throw new ApiError('VALIDATION', null, { old: 'That isn’t your current password.' });
        if (pwProblem(newPw)) throw new ApiError('VALIDATION', null, { password: pwProblem(newPw) });
        const salt = newSalt(), hash = await hashPw(newPw, salt), keep = sha(Session.get());
        DB.tx(s => { const u = s.users.find(x => x.id === me.id); u.salt = salt; u.hash = hash; s.sessions = s.sessions.filter(x => x.user_id !== u.id || x.token_hash === keep); audit(s, u, 'Password changed', 'user', u.id, ''); }); return true;
      });
    },
    async settings() {
      const s = DB.read(); auth(s, 'settings');
      return { settings: Object.assign({}, catalog.DEFAULT_SETTINGS, s.settings), email: { provider: MAIL.describe(), configured: MAIL.configured, from: MAIL.from }, payments: { paymongo: PAY.configured, webhook: !!ENV.PAYMONGO_WEBHOOK_SECRET }, maps: !!ENV.GOOGLE_MAPS_API_KEY, base_url: baseUrl() };
    },
    async saveSettings(x) {
      return wrap(async () => {
        const f = {}, h = x.hotel || {}, str = (v, n) => String(v == null ? '' : v).trim().slice(0, n), num = (v, a, b) => { v = +v; return v >= a && v <= b ? v : null; };
        if (!str(h.name, 80)) f['hotel.name'] = 'Enter the hotel name.'; if (!EMAIL_RE.test(str(h.email, 120))) f['hotel.email'] = 'Enter a valid email address.';
        const fc = num(x.free_cancel_hours, 0, 720), ea = num(x.extra_adult, 0, 500000), sr = num(x.service_rate, 0, 0.3), vr = num(x.vat_rate, 0, 0.3), mn = num(x.max_nights, 1, 90), hm = num(x.hold_minutes, 5, 240);
        if (fc == null) f.free_cancel_hours = '0 to 720 hours.'; if (ea == null) f.extra_adult = 'Enter an amount.'; if (sr == null) f.service_rate = '0 to 30%.'; if (vr == null) f.vat_rate = '0 to 30%.'; if (mn == null) f.max_nights = '1 to 90.'; if (hm == null) f.hold_minutes = '5 to 240.';
        const url = v => { v = str(v, 200); return !v || /^https?:\/\//i.test(v) ? v : null; }; const soc = x.social || {}; ['facebook', 'instagram', 'tiktok'].forEach(k => { if (url(soc[k]) === null) f['social.' + k] = 'Use a full link starting with https://'; });
        if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f);
        const b = x.bank || {};
        DB.tx(s => {
          const u = auth(s, 'settings'); const cur = Object.assign({}, catalog.DEFAULT_SETTINGS, s.settings);
          s.settings = Object.assign({}, cur, { hotel: { name: str(h.name, 80), tagline: str(h.tagline, 120), address: str(h.address, 200), phone: str(h.phone, 40), email: str(h.email, 120) }, checkin: str(x.checkin, 20) || cur.checkin, checkout: str(x.checkout, 20) || cur.checkout, free_cancel_hours: fc, extra_adult: ea, service_rate: sr, vat_rate: vr, max_nights: mn, hold_minutes: hm,
            bank: { bank_name: str(b.bank_name, 80), account_name: str(b.account_name, 80), account_number: str(b.account_number, 40), instructions: str(b.instructions, 300) }, social: { facebook: url(soc.facebook), instagram: url(soc.instagram), tiktok: url(soc.tiktok) } });
          audit(s, u, 'Settings updated', 'settings', null, 'Hotel settings saved');
        });
        applySettings(DB.read().settings); return true;
      });
    },
    async addons() { const s = DB.read(); auth(s, 'settings'); return s.addons.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)); },
    async saveAddon(a) {
      return wrap(async () => DB.tx(s => {
        const u = auth(s, 'settings'); const f = {}; const label = String(a.label || '').trim();
        if (!label) f.label = 'Enter a name.'; if (!(+a.price >= 0 && +a.price <= 5000000)) f.price = 'Enter a price.'; if (!['person_night', 'person', 'night', 'stay'].includes(a.model)) f.model = 'Choose how it is priced.';
        if (Object.keys(f).length) throw new ApiError('VALIDATION', null, f);
        let x = a.id ? s.addons.find(y => y.id === a.id) : null;
        if (!x) { let id = label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'extra'; while (s.addons.some(y => y.id === id)) id += '2'; x = { id, sort: s.addons.length }; s.addons.push(x); }
        Object.assign(x, { label: label.slice(0, 80), desc: String(a.desc || '').slice(0, 160), model: a.model, price: +a.price, child_price: +a.child_price || 0, active: a.active !== false });
        audit(s, u, 'Extra saved', 'addon', null, x.label); return true;
      }));
    },
    async photoSlots() { const s = DB.read(); auth(s, 'photos'); const photos = {}; Object.entries(s.settings.photos || {}).forEach(([k, f]) => { photos[k] = '/media/' + f; }); return { slots: catalog.photoSlots(s.room_types), photos }; },
    setPhoto(slot, file) { return wrap(async () => { let old = ''; DB.tx(s => { const u = auth(s, 'photos'); if (!catalog.validSlot(slot, s.room_types)) throw new ApiError('VALIDATION', 'Unknown photo slot.'); s.settings.photos = s.settings.photos || {}; old = s.settings.photos[slot] || ''; s.settings.photos[slot] = file; audit(s, u, 'Photo updated', 'photo', null, slot); }); return { old }; }); },
    removePhoto(slot) { return wrap(async () => { let old = ''; DB.tx(s => { const u = auth(s, 'photos'); old = (s.settings.photos || {})[slot] || ''; if (s.settings.photos) delete s.settings.photos[slot]; audit(s, u, 'Photo removed', 'photo', null, slot); }); return { old }; }); },
    pulse() { const s = DB.read(); const u = auth(s); return { version: DB.version, unread: API.staff.unreadCount(), role: u.role }; },
  }
};

/* ---------- startup ---------- */
function init(env, dbFile) {
  ENV = env; DB = store.open(dbFile); MAIL = mailer.fromEnv(env); PAY = payments.fromEnv(env);
  applySettings(DB.read().settings);
  if (!DB.read().users.length) {
    const want = (env.SETUP_CODE || '').trim().toUpperCase();
    let code = DB.read().meta.setup_code;
    if (want && want !== code) { code = want; DB.tx(s => { s.meta.setup_code = want; }); }
    if (!code) { code = Array.from(crypto.randomBytes(8)).map(b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join(''); DB.tx(s => { s.meta.setup_code = code; }); }
    console.log(`\n  First-run setup: open the site at /#/staff and enter this setup code: ${code}\n`);
  }
  Emails.releaseUnconfigured();
  return { DB, MAIL, PAY };
}
module.exports = { init, API, ctxStore, Session, tickJobs, finalizePayment, Emails, applySettings, CONFIG, can, ROLE_PERMS, publicView, getDB: () => DB, getPay: () => PAY, getMail: () => MAIL, sha, baseUrl, todayISO };
