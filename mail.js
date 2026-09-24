'use strict';
/* Email transport with no dependencies: SMTP (STARTTLS, implicit TLS or plain for local testing) and Resend.
   Credentials come from environment variables only and never reach the browser. */
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');
const addrOf = (s) => { const m = /<([^>]+)>/.exec(s); return (m ? m[1] : s).trim(); };
const encHeader = (s) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
function toText(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|h\d|table)>/gi, '\n')
    .replace(/<\/td>/gi, '  ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function buildMime({ from, to, subject, html, text, domain }) {
  const boundary = 'lume_' + crypto.randomBytes(12).toString('hex');
  const msgId = `<${crypto.randomBytes(12).toString('hex')}@${domain || 'lume.local'}>`;
  const head = [`From: ${from}`, `To: ${to}`, `Subject: ${encHeader(subject)}`, `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`, `Message-ID: ${msgId}`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`].join('\r\n');
  const part = (type, body) => `--${boundary}\r\nContent-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(body))}\r\n`;
  return { id: msgId, raw: `${head}\r\n\r\n${part('text/plain', text || toText(html))}${part('text/html', html)}--${boundary}--\r\n` };
}

function smtpSend(cfg, msg) {
  return new Promise((resolve, reject) => {
    let sock, buf = '', done = false; const waiters = [];
    const fail = (e) => { if (done) return; done = true; clearTimeout(timer); try { sock && sock.destroy(); } catch (x) { } reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('SMTP timed out')), 30000);
    const flush = () => { for (; ;) { const m = /^(?:\d{3}-[^\n]*\n)*\d{3}[ ][^\n]*\n/.exec(buf); if (!m) return; buf = buf.slice(m[0].length); const w = waiters.shift(); if (w) w(m[0]); } };
    const attach = (s) => { sock = s; s.setEncoding('utf8'); s.on('data', (d) => { buf += d; flush(); }); s.on('error', fail); s.on('close', () => { if (!done) fail(new Error('SMTP connection closed unexpectedly')); }); };
    const reply = () => new Promise((r) => { waiters.push(r); flush(); });
    const cmd = async (line, ok, label) => { sock.write(line + '\r\n'); const r = await reply(); if (!ok.includes(+r.slice(0, 3))) throw new Error(`SMTP ${label || line.split(' ')[0]} failed: ${r.trim().slice(0, 200)}`); return r; };
    (async () => {
      const ssl = cfg.secure === 'ssl';
      await new Promise((res, rej) => { const s = ssl ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, res) : net.connect({ host: cfg.host, port: cfg.port }, res); s.once('error', rej); attach(s); });
      let r = await reply(); if (+r.slice(0, 3) !== 220) throw new Error('SMTP greeting: ' + r.trim());
      const me = cfg.ehlo || 'lume.local';
      r = await cmd('EHLO ' + me, [250]);
      if (cfg.secure === 'starttls') {
        await cmd('STARTTLS', [220]);
        sock.removeAllListeners(); const plain = sock; buf = '';
        const t = tls.connect({ socket: plain, servername: cfg.host }); attach(t); await new Promise((res, rej) => { t.once('secureConnect', res); t.once('error', rej); });
        await cmd('EHLO ' + me, [250]);
      }
      if (cfg.user) await cmd('AUTH PLAIN ' + b64(`\0${cfg.user}\0${cfg.pass}`), [235], 'AUTH');
      await cmd(`MAIL FROM:<${addrOf(msg.from)}>`, [250], 'MAIL FROM');
      await cmd(`RCPT TO:<${addrOf(msg.to)}>`, [250, 251], 'RCPT TO');
      await cmd('DATA', [354]);
      const body = msg.raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      sock.write(body + (body.endsWith('\r\n') ? '' : '\r\n') + '.\r\n');
      r = await reply(); if (+r.slice(0, 3) !== 250) throw new Error('SMTP rejected message: ' + r.trim().slice(0, 200));
      try { sock.write('QUIT\r\n'); } catch (e) { }
      done = true; clearTimeout(timer); try { sock.end(); } catch (e) { }
      resolve({ id: msg.id });
    })().catch(fail);
  });
}

function fromEnv(env) {
  const provider = (env.EMAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : env.SMTP_HOST ? 'smtp' : '')).toLowerCase();
  const from = env.EMAIL_FROM || 'The Lume Hotel <stayathotellume@gmail.com>';
  return {
    provider, from,
    configured: provider === 'resend' ? !!env.RESEND_API_KEY : provider === 'smtp' ? !!env.SMTP_HOST : false,
    describe() { return provider === 'resend' ? 'Resend' : provider === 'smtp' ? `SMTP (${env.SMTP_HOST}:${env.SMTP_PORT || 587})` : 'Not configured'; },
    async send({ to, subject, html, text }) {
      if (provider === 'resend') {
        const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html, text: text || toText(html) }) });
        const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error('Resend: ' + (j.message || res.status)); return { id: j.id };
      }
      if (provider === 'smtp') {
        const port = +env.SMTP_PORT || 587; const secure = (env.SMTP_SECURE || (port === 465 ? 'ssl' : 'starttls')).toLowerCase();
        const mime = buildMime({ from, to, subject, html, text, domain: (addrOf(from).split('@')[1] || 'lume.local') });
        return smtpSend({ host: env.SMTP_HOST, port, secure, user: env.SMTP_USER, pass: env.SMTP_PASS, ehlo: 'lume-hotel' }, { from, to, raw: mime.raw, id: mime.id });
      }
      throw new Error('Email is not configured');
    }
  };
}
module.exports = { fromEnv, buildMime, smtpSend, toText };
