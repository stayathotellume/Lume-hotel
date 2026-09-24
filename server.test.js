'use strict';
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PORT = 3400 + Math.floor(Math.random() * 400), SMTP = 2500 + Math.floor(Math.random() * 400);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-'));
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else { fail++; failures.push(m); console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

/* tiny SMTP sink */
const mails = [];
const sink = net.createServer(sock => {
  let buf = '', data = false, cur = { rcpt: [], raw: '' }; sock.write('220 sink ready\r\n');
  sock.on('data', d => {
    buf += d.toString('utf8');
    for (; ;) {
      if (data) { const i = buf.indexOf('\r\n.\r\n'); if (i < 0) return; cur.raw = buf.slice(0, i); buf = buf.slice(i + 5); data = false; mails.push(cur); cur = { rcpt: [], raw: '' }; sock.write('250 queued\r\n'); continue; }
      const i = buf.indexOf('\r\n'); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^EHLO/i.test(line)) sock.write('250-sink\r\n250 AUTH PLAIN\r\n'); else if (/^MAIL FROM/i.test(line)) { cur.from = line; sock.write('250 ok\r\n'); } else if (/^RCPT TO/i.test(line)) { cur.rcpt.push(line); sock.write('250 ok\r\n'); }
      else if (/^AUTH/i.test(line)) sock.write('235 ok\r\n'); else if (/^DATA/i.test(line)) { data = true; sock.write('354 go\r\n'); } else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); } else sock.write('250 ok\r\n');
    }
  });
});

let cookie = '';
async function call(method, p, body, ck) {
  const headers = { 'Content-Type': 'application/json' }; const c = ck === undefined ? cookie : ck; if (c) headers.Cookie = c;
  const res = await fetch(BASE + p, { method, headers, body: method === 'POST' ? JSON.stringify(body || {}) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc && ck === undefined) { const m = /lume_session=([^;]*)/.exec(sc); cookie = m && m[1] ? 'lume_session=' + m[1] : ''; }
  const text = await res.text(); let j; try { j = JSON.parse(text); } catch (e) { j = text; }
  return { status: res.status, body: j, cookie: sc };
}
const get = (p, ck) => call('GET', p, null, ck), post = (p, b, ck) => call('POST', p, b, ck);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// The hotel's "today" is always Asia/Manila, regardless of the machine running these tests (see index.js).
// Compute test dates the same way so a run started right at the UTC/Manila day boundary can't spuriously fail.
const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const day = n => { const [y, m, d] = manilaToday().split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); };
const guest = (n, extra) => Object.assign({ first: 'Test', last: 'Guest' + n, email: `guest${n}@example.com`, phone: '09171234567', arrival: '3:00 PM' }, extra || {});

(async () => {
  await new Promise(r => sink.listen(SMTP, '127.0.0.1', r));
  const child = spawn(process.execPath, ['server/index.js'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT, DATA_DIR: DATA, BASE_URL: BASE, SETUP_CODE: 'TESTCODE', EMAIL_PROVIDER: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: SMTP, SMTP_SECURE: 'none', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_FROM: 'The Lume Hotel <stayathotellume@gmail.com>', TZ: 'Asia/Manila' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => { if (!/ExperimentalWarning|trace-warnings/.test(d)) out += d; });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(BASE + '/healthz'); if (r.ok) break; } catch (e) { } await sleep(100); }
  try {
    /* ---------- fresh system is empty ---------- */
    let r = await get('/api/config'); eq(r.status, 200, 'config status'); ok(r.body.needsSetup === true, 'needs setup on fresh db'); eq(r.body.roomTypes.length, 0, 'no room types before setup'); eq(r.body.stats.rooms, 0, 'no rooms before setup');
    r = await get('/api/staff/dashboard'); eq(r.status, 401, 'dashboard needs login');
    r = await post('/api/setup', { code: 'WRONG', name: 'Owner', email: 'owner@lume.test', password: 'Sunrise-2026-x' }); eq(r.status, 401 === r.status ? 401 : r.status, 'bad setup code rejected'); ok(r.status >= 400, 'bad setup code is an error');
    r = await post('/api/setup', { code: 'TESTCODE', name: 'Owner', email: 'owner@lume.test', password: 'short' }); eq(r.status, 422, 'weak password rejected');
    r = await post('/api/setup', { code: 'testcode', name: 'Owner One', email: 'owner@lume.test', password: 'Sunrise-2026-x', catalog: true }); eq(r.status, 200, 'setup ok'); ok(/lume_session=/.test(cookie), 'setup signs in with cookie'); eq(r.body.role, 'admin', 'first user is admin');
    r = await post('/api/setup', { code: 'TESTCODE', name: 'X', email: 'x@x.com', password: 'Sunrise-2026-x' }); ok(r.status >= 400, 'setup cannot be repeated');
    const adminCookie = cookie;
    r = await get('/api/config'); eq(r.body.needsSetup, false, 'setup finished'); eq(r.body.roomTypes.length, 5, '5 room types'); eq(r.body.stats.rooms, 60, '60 rooms');
    const prices = r.body.roomTypes.map(t => t.price); ok(Math.min(...prices) === 80000 && Math.max(...prices) === 150000, 'prices span 80,000 to 150,000'); ok(r.body.addons.length >= 5, 'extras present');
    const types = r.body.roomTypes; const deluxe = types.find(t => t.slug === 'deluxe'), villa = types.find(t => t.slug === 'villa');
    r = await get('/api/staff/reservations'); eq(r.body.total, 0, 'no reservations preloaded'); r = await get('/api/staff/messages'); eq(r.body.length, 0, 'no messages preloaded'); r = await get('/api/staff/users'); eq(r.body.length, 1, 'only the owner exists');
    r = await get('/api/staff/dashboard'); eq(r.body.totalRooms, 60, 'dashboard total rooms'); eq(r.body.arrivals.length, 0, 'no arrivals preloaded');

    /* ---------- payments not configured ---------- */
    r = await post('/api/reservations', { ci: day(5), co: day(7), typeId: deluxe.id, adults: 2, children: 0, addons: {}, guest: guest(1), payment: { method: 'card' } }, ''); eq(r.status >= 400, true, 'card payment refused when no provider'); ok(/payment/i.test(r.body.error.message), 'friendly payment message');
    r = await post('/api/reservations', { ci: day(5), co: day(7), typeId: deluxe.id, adults: 2, children: 0, addons: {}, guest: guest(1), payment: { method: 'bank' } }, ''); ok(r.status >= 400, 'bank transfer refused until bank details are set');
    /* settings: bank details */
    r = await post('/api/staff/settings', Object.assign({}, (await get('/api/staff/settings')).body.settings, { bank: { bank_name: 'BPI', account_name: 'The Lume Hotel Inc', account_number: '1234 5678 90', instructions: 'Use the reservation number as reference.' } })); eq(r.status, 200, 'settings saved');
    r = await get('/api/config', ''); ok(r.body.config.PAYMENTS.bank && r.body.config.PAYMENTS.bank.account_number === '1234 5678 90', 'bank details published to booking page'); eq(r.body.config.PAYMENTS.online, false, 'online payments off');

    /* ---------- guest booking, pay at hotel ---------- */
    const mailsBefore = mails.length;
    r = await post('/api/reservations', { ci: day(5), co: day(7), typeId: deluxe.id, adults: 2, children: 0, addons: { breakfast: true, tour: true }, guest: guest(1), payment: { method: 'hotel' }, idem: 'abc123' }, ''); eq(r.status, 200, 'booking created'); const res1 = r.body.reservation;
    ok(/^LUME-\d{4}-00001$/.test(res1.number), 'first reservation number: ' + res1.number); eq(res1.status, 'Pending', 'pay at hotel is pending'); ok(res1.total > 80000 * 2, 'total includes charges: ' + res1.total);
    r = await post('/api/reservations', { ci: day(5), co: day(7), typeId: deluxe.id, adults: 2, children: 0, addons: { breakfast: true, tour: true }, guest: guest(1), payment: { method: 'hotel' }, idem: 'abc123' }, ''); eq(r.body.reservation.number, res1.number, 'idempotent retry returns same reservation');
    await sleep(600); ok(mails.length > mailsBefore, 'confirmation email delivered over SMTP'); const m1 = mails[mails.length - 1];
    ok(/guest1@example.com/.test(m1.rcpt.join()), 'email addressed to the guest'); const dec = Buffer.from((m1.raw.match(/text\/html[^]*?base64\r\n\r\n([^]*?)\r\n--/) || [])[1]?.replace(/\r\n/g, '') || '', 'base64').toString('utf8');
    ok(dec.includes(res1.number) && dec.includes('The Lume Hotel'), 'email body contains reservation number and hotel name'); ok(/=\?UTF-8\?B\?/.test(m1.raw) || /Subject: Your Reservation/.test(m1.raw), 'subject encoded');
    r = await get('/api/staff/outbox'); ok(r.body.some(e => e.status === 'sent' && e.to === 'guest1@example.com'), 'outbox records sent status');

    /* lookup security */
    r = await post('/api/reservations/lookup', { no: res1.number, email: 'guest1@example.com' }, ''); eq(r.status, 200, 'lookup with number + email'); eq(r.body.guest.last, 'Guest1', 'lookup returns booking');
    r = await post('/api/reservations/lookup', { no: res1.number, email: 'someone@else.com' }, ''); eq(r.status, 404, 'wrong email does not reveal booking');

    /* ---------- double booking: villas have 4 rooms; 8 parallel bookings ---------- */
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, i) => post('/api/reservations', { ci: day(20), co: day(22), typeId: villa.id, adults: 2, children: 0, addons: {}, guest: guest(100 + i), payment: { method: 'hotel' } }, '')));
    const okc = attempts.filter(a => a.status === 200).length, bad = attempts.filter(a => a.status === 409).length; eq(okc, 4, 'exactly 4 villas booked'); eq(bad, 4, 'the other 4 refused'); ok(attempts.filter(a => a.status === 409).every(a => a.body.error.code === 'ROOM_UNAVAILABLE'), 'refusals say room unavailable');
    const rooms = attempts.filter(a => a.status === 200).map(a => a.body.reservation.number); eq(new Set(rooms).size, 4, 'unique reservation numbers');
    r = await get('/api/availability?ci=' + day(20) + '&co=' + day(22), ''); eq(r.body[villa.id], 0, 'availability shows villas sold out'); r = await get('/api/availability?ci=' + day(22) + '&co=' + day(23), ''); eq(r.body[villa.id], 4, 'checkout day is free again');

    /* ---------- staff flow ---------- */
    r = await get('/api/staff/reservations?q=' + res1.number); eq(r.body.total, 1, 'staff search finds it'); const id1 = r.body.rows[0].id;
    r = await post(`/api/staff/reservations/${id1}/action`, { action: 'confirm' }); eq(r.body.status, 'Confirmed', 'staff confirms'); await sleep(500);
    r = await post(`/api/staff/reservations/${id1}/action`, { action: 'checkin' }); eq(r.status, 409, 'early check-in is stopped'); eq(r.body.error.code, 'EARLY', 'early code');
    r = await post(`/api/staff/reservations/${id1}/action`, { action: 'checkin', opts: { early: true } }); eq(r.status, 200, 'early check-in with override');
    r = await get('/api/staff/rooms'); const room = r.body.rooms.find(x => x.current && x.current.guest.includes('Guest1')); ok(!!room && room.status === 'Occupied', 'room is Occupied after check-in');
    r = await post(`/api/staff/reservations/${id1}/pay`, { method: 'cash', amount: 0 }); eq(r.status, 200, 'front desk records payment'); r = await get(`/api/staff/reservations/${id1}`); eq(r.body.payment_status, 'Paid', 'paid in full');
    r = await post(`/api/staff/reservations/${id1}/action`, { action: 'checkout' }); eq(r.status, 200, 'check-out'); r = await get('/api/staff/rooms'); eq(r.body.rooms.find(x => x.id === room.id).status, 'Cleaning', 'room Cleaning after check-out');
    r = await post(`/api/staff/rooms/${room.id}/housekeeping`, { step: 'start' }); eq(r.status, 200, 'housekeeping start'); r = await post(`/api/staff/rooms/${room.id}/housekeeping`, { step: 'clean' }); r = await get('/api/staff/rooms'); eq(r.body.rooms.find(x => x.id === room.id).status, 'Available', 'room Available after cleaning');
    await sleep(700); r = await get('/api/staff/outbox'); ok(r.body.some(e => e.template === 'thankyou' && e.status === 'sent'), 'thank-you email sent on check-out'); ok(r.body.some(e => e.template === 'payment'), 'payment email queued');
    /* cancellation request + approval */
    r = await post('/api/reservations', { ci: day(9), co: day(11), typeId: deluxe.id, adults: 2, children: 0, addons: {}, guest: guest(2), payment: { method: 'bank' } }, ''); const res2 = r.body.reservation; eq(res2.payment_status, 'Pending', 'bank transfer payment pending');
    r = await post('/api/reservations/request', { no: res2.number, email: 'guest2@example.com', req: { type: 'cancel', reason: 'Change of plans' } }, ''); eq(r.status, 200, 'guest requests cancellation'); r = await get('/api/staff/reservations?q=' + res2.number); const id2 = r.body.rows[0].id;
    r = await get(`/api/staff/reservations/${id2}`); const rq = r.body.requests.find(q => q.status === 'Pending'); ok(!!rq, 'request visible to staff'); r = await post(`/api/staff/reservations/${id2}/request/${rq.id}`, { decision: 'approve' }); eq(r.status, 200, 'staff approves cancellation'); r = await get(`/api/staff/reservations/${id2}`); eq(r.body.status, 'Cancelled', 'cancelled'); r = await get('/api/availability?ci=' + day(9) + '&co=' + day(11), ''); ok(r.body[deluxe.id] === 24, 'room released after cancellation');
    /* staff walk-in reservation, paid */
    r = await post('/api/staff/reservations', { ci: day(0), co: day(2), typeId: deluxe.id, adults: 2, children: 0, addons: {}, guest: guest(3), payment: { method: 'cash', paid: true } }); eq(r.status, 200, 'staff creates reservation'); eq(r.body.reservation.status, 'Confirmed', 'paid staff booking is confirmed'); eq(r.body.reservation.payment_status, 'Paid', 'marked paid');
    /* contact + dining */
    r = await post('/api/contact', { name: 'Ana', email: 'ana@example.com', subject: 'Wedding enquiry', message: 'Do you host weddings?' }, ''); eq(r.status, 200, 'contact form'); r = await post('/api/contact', { name: 'A', email: 'nope', subject: '', message: '' }, ''); eq(r.status, 422, 'contact validation'); r = await get('/api/staff/messages'); eq(r.body.length, 1, 'message in inbox');

    /* ---------- roles and permissions ---------- */
    r = await post('/api/staff/users', { name: 'Front Desk Fiona', email: 'fiona@lume.test', role: 'front_desk', password: 'Welcome-2026-fd' }); eq(r.status, 200, 'admin creates staff');
    r = await post('/api/staff/users', { name: 'Hana Housekeeping', email: 'hana@lume.test', role: 'housekeeping', password: 'Welcome-2026-hk' }); eq(r.status, 200, 'admin creates housekeeping');
    cookie = ''; r = await post('/api/staff/login', { email: 'fiona@lume.test', password: 'wrong-password-1' }); eq(r.status, 401, 'wrong password rejected'); r = await post('/api/staff/login', { email: 'fiona@lume.test', password: 'Welcome-2026-fd' }); eq(r.status, 200, 'front desk signs in'); const fdCookie = cookie;
    r = await get('/api/staff/users'); eq(r.status, 403, 'front desk cannot list staff'); r = await get('/api/staff/analytics?from=' + day(0) + '&to=' + day(30)); eq(r.status, 403, 'front desk cannot see analytics'); r = await get('/api/staff/settings'); eq(r.status, 403, 'front desk cannot open settings'); r = await get('/api/staff/reservations'); eq(r.status, 200, 'front desk can view reservations');
    cookie = ''; r = await post('/api/staff/login', { email: 'hana@lume.test', password: 'Welcome-2026-hk' }); const hkCookie = cookie; r = await get('/api/staff/reservations'); eq(r.status, 403, 'housekeeping cannot view reservations'); r = await get('/api/staff/rooms'); eq(r.status, 200, 'housekeeping sees rooms');
    r = await post('/api/staff/logout', {}); cookie = hkCookie; r = await get('/api/staff/me'); ok(r.body === null || r.status === 401 || !r.body.id, 'session ended after logout');
    cookie = adminCookie;
    r = await post('/api/staff/users/2', { active: false }); eq(r.status, 200, 'admin deactivates staff'); cookie = fdCookie; r = await get('/api/staff/reservations'); eq(r.status, 401, 'deactivated user is signed out'); cookie = adminCookie;
    r = await post('/api/staff/users/1', { active: false }); eq(r.status, 409, 'cannot deactivate the last admin');
    /* login lockout */
    cookie = ''; for (let i = 0; i < 7; i++) r = await post('/api/staff/login', { email: 'owner@lume.test', password: 'bad-password-9' }); eq(r.status, 429, 'repeated bad logins are throttled'); cookie = adminCookie;

    /* ---------- settings, room types, photos ---------- */
    r = await post('/api/staff/types', { id: deluxe.id, name: 'Deluxe Room', price: 85000, capacity: 3, beds: deluxe.beds, size: 48, amenities: 'Terrace, Spa bath' }); eq(r.status, 200, 'edit room type price'); r = await get('/api/config', ''); eq(r.body.roomTypes.find(t => t.id === deluxe.id).price, 85000, 'price change is live on the website');
    r = await post('/api/staff/types', { name: 'Presidential Penthouse', price: 400000, capacity: 8, beds: '4 King', size: 500 }); eq(r.status, 200, 'add a room type'); r = await get('/api/config', ''); eq(r.body.roomTypes.length, 6, 'new type appears');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
    let up = await fetch(BASE + '/api/staff/photos/ext-1', { method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'image/png' }, body: png }); eq(up.status, 200, 'photo upload'); const upj = await up.json(); ok(/^\/media\/ext-1-.*\.png$/.test(upj.url), 'upload url ' + upj.url);
    const media = await fetch(BASE + upj.url); eq(media.status, 200, 'media served'); eq(media.headers.get('content-type'), 'image/png', 'media type');
    up = await fetch(BASE + '/api/staff/photos/ext-1', { method: 'POST', headers: { Cookie: adminCookie, 'Content-Type': 'image/png' }, body: Buffer.from('<script>alert(1)</script>') }); eq(up.status, 422, 'non-image rejected');
    up = await fetch(BASE + '/api/staff/photos/ext-1', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png }); eq(up.status, 401, 'upload needs login');
    r = await get('/api/config', ''); ok(r.body.photos['ext-1'] === upj.url, 'hero photo published in config');
    r = await post('/api/staff/photos/ext-1/remove', {}); eq(r.status, 200, 'remove photo'); r = await get('/api/config', ''); ok(!r.body.photos['ext-1'], 'photo removed');
    /* test email + resend */
    r = await post('/api/staff/email-test', { to: 'owner@lume.test' }); eq(r.status, 200, 'test email queued'); await sleep(700); ok(mails.some(m => /owner@lume.test/.test(m.rcpt.join())), 'test email delivered');
    r = await post('/api/staff/email-preview', { template: 'cancellation' }); ok(r.body.html.includes('cancelled'), 'template preview renders');
    /* analytics + calendar + audit */
    r = await get('/api/staff/analytics?from=' + day(0) + '&to=' + day(30)); ok(r.body.total >= 5, 'analytics counts real reservations: ' + r.body.total); r = await get('/api/staff/calendar?from=' + day(0) + '&days=14'); ok(r.body.rooms.length >= 60, 'calendar lists rooms'); r = await get('/api/staff/audit'); ok(r.body.length > 10, 'audit log has entries');
    /* CSRF-ish */
    let bad2 = await fetch(BASE + '/api/staff/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: adminCookie }, body: '{}' }); eq(bad2.status, 403, 'cross-site POST blocked'); bad2 = await fetch(BASE + '/api/staff/logout', { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: adminCookie }, body: '{}' }); eq(bad2.status, 422, 'non-JSON POST rejected');
    const hdr = await fetch(BASE + '/'); ok(/frame-ancestors 'none'/.test(hdr.headers.get('content-security-policy') || ''), 'security headers set');
  } catch (e) { fail++; failures.push('EXCEPTION ' + e.stack); console.log(e); }
  console.log(`\nPASS ${pass}  FAIL ${fail}`); if (fail) console.log(failures.join('\n')); if (fail && out) console.log('--- server output ---\n' + out.slice(-1500));
  child.kill(); sink.close(); process.exit(fail ? 1 : 0);
})();
