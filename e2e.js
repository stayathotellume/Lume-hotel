'use strict';
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 4100, SMTP = 2626;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-e2e-'));
const SHOT = '/home/claude/lume2/shots'; fs.mkdirSync(SHOT, { recursive: true });
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; } else { fail++; fails.push(m); console.log('  FAIL:', m); } };

/* inline SMTP sink */
const mails = [];
const sink = net.createServer(sock => {
  let buf = '', data = false, cur = { rcpt: [] }; sock.write('220 sink\r\n');
  sock.on('data', d => {
    buf += d.toString('utf8');
    for (;;) {
      if (data) { const i = buf.indexOf('\r\n.\r\n'); if (i < 0) return; cur.raw = buf.slice(0, i); buf = buf.slice(i + 5); data = false; mails.push(cur); cur = { rcpt: [] }; sock.write('250 queued\r\n'); continue; }
      const i = buf.indexOf('\r\n'); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^EHLO/i.test(line)) sock.write('250-sink\r\n250 AUTH PLAIN\r\n'); else if (/^MAIL FROM/i.test(line)) sock.write('250 ok\r\n'); else if (/^RCPT TO/i.test(line)) { cur.rcpt.push(line); sock.write('250 ok\r\n'); }
      else if (/^AUTH/i.test(line)) sock.write('235 ok\r\n'); else if (/^DATA/i.test(line)) { data = true; sock.write('354 go\r\n'); } else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); } else sock.write('250 ok\r\n');
    }
  });
});

(async () => {
  await new Promise(r => sink.listen(SMTP, '127.0.0.1', r));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: '/home/claude/lume2',
    env: Object.assign({}, process.env, { PORT, DATA_DIR: DATA, BASE_URL: BASE, SETUP_CODE: 'E2ECODE', EMAIL_PROVIDER: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: SMTP, SMTP_SECURE: 'none', SMTP_USER: 'u', SMTP_PASS: 'p', EMAIL_FROM: 'The Lume Hotel <stayathotellume@gmail.com>' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => { const s = d.toString(); if (!/ExperimentalWarning|trace-warnings/.test(s)) out += s; });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/healthz')).ok) break; } catch (e) { } await sleep(150); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); pg.on('requestfailed', r => errs.push('REQFAIL ' + r.url() + ' ' + (r.failure() && r.failure().errorText))); pg.on('response', r => { if (r.status() >= 400) console.log('  HTTP', r.status(), r.url()); });

  try {
    // ---------- setup wizard ----------
    await pg.goto(BASE + '/'); await pg.waitForSelector('#setup-form', { timeout: 8000 });
    ok(true, 'redirected to setup wizard on fresh install');
    await pg.fill('[name=code]', 'wrong'); await pg.fill('[name=name]', 'Owner Person'); await pg.fill('[name=email]', 'owner@lume.test'); await pg.fill('[name=password]', 'Sunrise-2026-x');
    await pg.click('#setup-form button[type=submit]'); await pg.waitForTimeout(500);
    ok((await pg.locator('#toasts').innerText()).toLowerCase().includes('setup code'), 'wrong setup code rejected with friendly message');
    await pg.fill('[name=code]', 'e2ecode');
    await pg.click('#setup-form button[type=submit]');
    await pg.waitForSelector('.kpis', { timeout: 8000 });
    ok(true, 'setup completes and lands on staff dashboard');
    await pg.screenshot({ path: SHOT + '/01-dashboard-empty-catalog.png' });

    // ---------- public site content ----------
    await pg.goto(BASE + '/#/'); await pg.waitForSelector('.hero'); await pg.waitForTimeout(1200);
    ok((await pg.locator('.star-strip').innerText()).includes('Five-star'), 'five-star ribbon shown');
    await pg.screenshot({ path: SHOT + '/02-home-hero.png' });
    await pg.evaluate(() => document.getElementById('rooms').scrollIntoView());
    await pg.waitForTimeout(900);
    const roomCount = await pg.locator('.room-card').count();
    ok(roomCount === 5, 'five room types shown: ' + roomCount);
    const prices = await pg.locator('.room-card .price b').allInnerTexts();
    console.log('  room prices:', prices);
    ok(prices.some(p => p.includes('80,000')) && prices.some(p => p.includes('150,000')), 'prices span ₱80,000 to ₱150,000');
    await pg.screenshot({ path: SHOT + '/03-rooms.png' });
    await pg.evaluate(() => document.getElementById('experiences-home').scrollIntoView());
    await pg.waitForTimeout(900);
    const expTitles = await pg.locator('.exp-card h3').allInnerTexts();
    ok(expTitles.some(t => /Beach/.test(t)) && expTitles.some(t => /Spa/.test(t)) && expTitles.some(t => /Bar/.test(t)) && expTitles.some(t => /Aklan/.test(t)), 'signature experiences include beach, spa, bar, Aklan tour: ' + expTitles.join(' | '));
    await pg.screenshot({ path: SHOT + '/04-experiences.png' });
    await pg.evaluate(() => document.getElementById('amenities').scrollIntoView()); await pg.waitForTimeout(700);
    await pg.screenshot({ path: SHOT + '/05-amenities.png' });
    await pg.evaluate(() => document.getElementById('gallery').scrollIntoView()); await pg.waitForTimeout(700);
    await pg.screenshot({ path: SHOT + '/06-gallery.png' });

    // room details page for the villa
    await pg.goto(BASE + '/#/room/villa'); await pg.waitForSelector('#rd-form'); await pg.waitForTimeout(900);
    ok((await pg.locator('.h-page').innerText()).includes('Jawili Beach Villa'), 'villa room page loads');
    await pg.screenshot({ path: SHOT + '/07-villa-room.png' });

    // ---------- booking flow (pay at hotel, since PayMongo isn't configured) ----------
    await pg.goto(BASE + '/#/book?type=deluxe&step=2'); await pg.waitForSelector('.b-room', { timeout: 8000 });
    await pg.click('[data-pick]');
    await pg.waitForSelector('#b-guest');
    await pg.fill('[name=first]', 'Maria'); await pg.fill('[name=last]', 'Santos'); await pg.fill('[name=email]', 'maria.santos@example.com'); await pg.fill('[name=phone]', '09171234567');
    const addonCount = await pg.locator('.extra input').count(); ok(addonCount >= 5, 'extras offered during booking: ' + addonCount);
    await pg.check('input[name=addon_spa]').catch(() => {});
    await pg.click('#b-guest button[type=submit]'); await pg.waitForSelector('.sum');
    await pg.screenshot({ path: SHOT + '/08-booking-summary.png' });
    await pg.click('[data-goto="5"]'); await pg.waitForSelector('#b-pay');
    const methods = await pg.locator('.method b').allInnerTexts();
    ok(!methods.includes('Credit / debit card'), 'card payment hidden when PayMongo is not configured: ' + methods.join(','));
    ok(methods.includes('Pay at hotel'), 'pay-at-hotel available: ' + methods.join(','));
    await pg.check('[name=terms]');
    await pg.screenshot({ path: SHOT + '/09-payment.png' });
    await pg.click('#pay-btn'); await pg.waitForURL(/#\/confirmation\//, { timeout: 8000 }); await pg.waitForSelector('.conf-no b');
    const resNo = await pg.locator('.conf-no b').innerText();
    ok(/^LUME-\d{4}-00001$/.test(resNo), 'first reservation number is 00001: ' + resNo);
    ok((await pg.locator('.conf-head h1').innerText()) === 'Reservation received', 'pending status shown for pay-at-hotel');
    await pg.screenshot({ path: SHOT + '/10-confirmation.png' });
    await pg.waitForTimeout(700);

    // ---------- manage reservation (wrong email must fail) ----------
    await pg.goto(BASE + '/#/manage'); await pg.waitForSelector('#lookup');
    await pg.fill('[name=no]', resNo); await pg.fill('[name=email]', 'wrong@example.com'); await pg.click('#lookup button[type=submit]'); await pg.waitForTimeout(600);
    ok((await pg.locator('#toasts').innerText()).length > 0, 'wrong email shows an error toast, not the booking');
    await pg.fill('[name=email]', 'maria.santos@example.com'); await pg.click('#lookup button[type=submit]'); await pg.waitForSelector('#manage-result .conf-card');
    ok(true, 'correct number + email reveals the booking');
    await pg.screenshot({ path: SHOT + '/11-manage.png' });

    // ---------- staff: reservation now visible, confirm + check email outbox ----------
    await pg.goto(BASE + '/#/staff/reservations'); await pg.waitForSelector('.rtable, .empty'); await pg.waitForTimeout(500);
    const rows = await pg.locator('.rtable tbody tr').count(); ok(rows === 1, 'exactly one reservation exists (no preloaded demo data): ' + rows);
    await pg.click('.rtable tbody tr td >> nth=0'); await pg.waitForSelector('.overlay.sheet .dr-name');
    await pg.screenshot({ path: SHOT + '/12-drawer.png' });
    await pg.click('.overlay.sheet [data-dr=confirm]'); await pg.waitForTimeout(700);
    ok((await pg.locator('.overlay.sheet .pills').innerText()).includes('Confirmed'), 'staff confirms the reservation');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);

    await pg.waitForTimeout(600);
    await pg.goto(BASE + '/#/staff/emails'); await pg.waitForSelector('.notice-banner, .empty'); await pg.waitForTimeout(600);
    const banner = await pg.locator('.notice-banner').first().innerText();
    ok(/Sending through/.test(banner), 'emails page reports the connected provider: ' + banner.slice(0, 60));
    ok(mails.length >= 1, 'at least one real SMTP DATA transaction hit the sink: ' + mails.length);
    if (mails.length) { const m = mails[0]; const decoded = Buffer.from((m.raw.match(/base64\r\n\r\n([^]*?)\r\n--/) || [0, ''])[1].replace(/\r\n/g, ''), 'base64').toString('utf8'); ok(decoded.includes(resNo), 'delivered email body contains the reservation number'); }
    await pg.screenshot({ path: SHOT + '/13-emails.png' });

    // ---------- dashboard now reflects the real booking ----------
    await pg.goto(BASE + '/#/staff/dashboard'); await pg.waitForSelector('.kpis'); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: SHOT + '/14-dashboard-live.png' });

    // ---------- rooms / room types management ----------
    await pg.goto(BASE + '/#/staff/rooms'); await pg.waitForSelector('.rtable'); await pg.waitForTimeout(500);
    const roomRows = await pg.locator('.rtable tbody tr').count(); ok(roomRows === 60, '60 rooms in inventory: ' + roomRows);
    await pg.screenshot({ path: SHOT + '/15-rooms.png' });

    // ---------- settings: change hotel name, verify it reflects on public site ----------
    await pg.goto(BASE + '/#/staff/settings'); await pg.waitForSelector('#set-form'); await pg.waitForTimeout(400);
    await pg.fill('[name="hotel.tagline"]', 'Where Comfort Shines, Always');
    await pg.click('#set-form button[type=submit]'); await pg.waitForTimeout(700);
    ok((await pg.locator('#toasts').innerText()).includes('saved'), 'settings save confirmed');
    await pg.screenshot({ path: SHOT + '/16-settings.png' });
    await pg.goto(BASE + '/#/'); await pg.waitForSelector('.tagline'); await pg.waitForTimeout(500);
    ok((await pg.locator('.tagline').innerText()) === 'Where Comfort Shines, Always', 'tagline change reflects live on the homepage');

    // ---------- photos: upload a real image, verify it replaces the illustration ----------
    await pg.goto(BASE + '/#/staff/photos'); await pg.waitForSelector('.photo-grid'); await pg.waitForTimeout(500);
    const pngPath = '/tmp/e2e-test.png';
    fs.writeFileSync(pngPath, Buffer.from('89504e470d0a1a0a0000000d4948445200000010000000100802000000909717de0000001974455874536f667477617265005061696e742e4e455420332e352e31303069b57e3e0000001b494441545847edc1010d000000c2a0f74f6d0e37a000000000000000be0d0210000019220dc90000000049454e44ae426082', 'hex'));
    const firstSlotCard = pg.locator('.photo-card').first();
    await firstSlotCard.locator('input[type=file]').setInputFiles(pngPath);
    await pg.waitForTimeout(1200);
    ok(await firstSlotCard.locator('.photo-thumb img').count() === 1, 'uploaded photo appears in the photo manager thumbnail');
    await pg.screenshot({ path: SHOT + '/17-photos.png' });
    const slotKey = await firstSlotCard.getAttribute('data-slot');
    console.log('  uploaded to slot:', slotKey);

    // ---------- staff accounts, addons pages render ----------
    await pg.goto(BASE + '/#/staff/users'); await pg.waitForSelector('.rtable'); await pg.waitForTimeout(400);
    ok((await pg.locator('.rtable tbody tr').count()) === 1, 'exactly one staff account (the admin)');
    await pg.screenshot({ path: SHOT + '/18-users.png' });
    await pg.goto(BASE + '/#/staff/addons'); await pg.waitForSelector('.addon-grid'); await pg.waitForTimeout(400);
    const addonCards = await pg.locator('.addon-card').count(); ok(addonCards >= 5, 'addons/extras management page lists extras: ' + addonCards);
    await pg.screenshot({ path: SHOT + '/19-addons.png' });

    // ---------- dark mode + mobile spot check ----------
    await ctx.close();
    const dctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' });
    const dpg = await dctx.newPage(); await dpg.goto(BASE + '/#/'); await dpg.waitForTimeout(1200);
    await dpg.screenshot({ path: SHOT + '/20-dark-home.png' }); await dctx.close();
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mpg = await mctx.newPage(); await mpg.goto(BASE + '/#/'); await mpg.waitForTimeout(1500);
    await mpg.screenshot({ path: SHOT + '/21-mobile-home.png' });
    await mpg.goto(BASE + '/#/staff/dashboard'); await mpg.waitForTimeout(1200);
    await mpg.screenshot({ path: SHOT + '/22-mobile-dashboard.png' }); await mctx.close();

    const unexpected = errs.filter(e => !/(status of 403|status of 401|status of 404|fonts\.googleapis\.com)/.test(e));
    console.log('\nCONSOLE/PAGE ERRORS (all, incl. expected negative-path ones):', errs.length ? errs.slice(0, 20) : 'none');
    ok(unexpected.length === 0, 'no UNEXPECTED console/page errors across the whole run: ' + JSON.stringify(unexpected));
  } catch (e) {
    fail++; fails.push('EXCEPTION ' + e.stack); console.log(e);
    try { await pg.screenshot({ path: SHOT + '/zz-error.png' }); } catch (x) { }
  }
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  if (fail) { console.log(fails.join('\n')); console.log('--- server output (tail) ---\n' + out.slice(-2500)); }
  await browser.close(); sink.close(); child.kill();
  process.exit(fail ? 1 : 0);
})();
