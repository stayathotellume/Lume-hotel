'use strict';
/* ==========================================================================
   UI helpers — shared by the public site, booking flow and staff console.
   ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STATE = { roomTypes: [], addons: [], photos: {}, needsSetup: null };
const UI = { view: 'site', searchKey: 'lume.search' };
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let uidN = 0; const uid = p => (p || 'u') + (++uidN);
const store = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { } }
};
const img = (src, alt, cls = '', lazy = true) => `<img class="${cls}" src="${src}" alt="${esc(alt || '')}" ${lazy ? 'loading="lazy" decoding="async"' : ''}>`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : (b || a + 's')}`;
const guestsText = (a, c) => plural(+a, 'adult') + (+c ? ', ' + plural(+c, 'child', 'children') : '');
const fullName = g => g ? `${g.first} ${g.last}` : '';
const initials = n => String(n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

/* ---------- remembered bookings (convenience only; the server still requires number + email) ---------- */
const Recall = {
  key: 'lume.mine',
  all() { return store.get(this.key, {}); },
  add(no, email) { const m = this.all(); m[no] = email; store.set(this.key, m); },
  get(no) { return this.all()[no] || ''; }
};

/* ---------- toasts ---------- */
function toast(msg, kind = 'ok', ms = 4800) {
  const root = $('#toasts'); if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `${ic(kind === 'error' ? 'alert' : kind === 'info' ? 'info' : 'check', 18)}<span>${esc(msg)}</span>`;
  root.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); };
  setTimeout(kill, ms); el.addEventListener('click', kill);
}

/* ---------- modal / drawer ---------- */
const ModalStack = [];
function openModal({ title = '', body = '', size = '', kind = 'modal', onMount, onClose }) {
  const root = $('#modal-root'); const el = document.createElement('div');
  el.className = `overlay ${kind}`;
  el.innerHTML = `<div class="dialog ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><header class="dlg-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${ic('close')}</button></header><div class="dlg-body">${body}</div></div>`;
  const prev = document.activeElement; root.appendChild(el); document.body.classList.add('noscroll');
  const api = {
    el, body: $('.dlg-body', el), dialog: $('.dialog', el),
    close() { if (!el.isConnected) return; el.classList.add('out'); const i = ModalStack.indexOf(api); if (i >= 0) ModalStack.splice(i, 1); if (!ModalStack.length) document.body.classList.remove('noscroll'); setTimeout(() => el.remove(), 180); if (onClose) onClose(); try { prev && prev.focus && prev.focus(); } catch (e) { } },
    set(html) { api.body.innerHTML = html; },
    title(t) { $('h3', el).textContent = t; }
  };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) api.close(); });
  ModalStack.push(api);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { const f = $('[autofocus],input:not([type=hidden]),select,textarea', api.body) || $('.dialog', el); f && f.focus && f.focus({ preventScroll: true }); }, 60);
  if (onMount) onMount(api);
  return api;
}
function closeTopModal() { const m = ModalStack[ModalStack.length - 1]; if (m) { m.close(); return true; } return false; }
function confirmBox({ title, message, confirmText = 'Confirm', cancelText = 'Keep as is', danger = false, extra = '' }) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const m = openModal({ title, size: 'sm', body: `<p class="dlg-text">${message}</p>${extra}<div class="dlg-actions"><button class="btn line" data-no>${esc(cancelText)}</button><button class="btn ${danger ? 'danger' : 'gold'}" data-yes>${esc(confirmText)}</button></div>`, onClose: () => fin(false) });
    $('[data-no]', m.el).onclick = () => { fin(false); m.close(); };
    $('[data-yes]', m.el).onclick = () => { fin(true); m.close(); };
  });
}

/* ---------- popover menu ---------- */
function closeMenu() { $$('.pop').forEach(p => p.remove()); }
function openMenu(anchor, items) {
  closeMenu(); const m = document.createElement('div'); m.className = 'pop'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>${it.icon ? ic(it.icon, 16) : ''}<span>${esc(it.label)}</span></button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  let left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8), top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; e.stopPropagation(); closeMenu(); items[+b.dataset.i].run(); });
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}

/* ---------- async actions with friendly errors ---------- */
async function run(fn, o = {}) {
  const { btn, ok, form, onError } = o;
  if (btn) { btn.classList.add('busy'); btn.disabled = true; }
  try { const out = await fn(); if (ok) toast(typeof ok === 'function' ? ok(out) : ok); return out; }
  catch (e) {
    if (onError && onError(e) === true) return undefined;
    if (e && e.friendly) {
      if (e.code === 'UNAUTHORIZED' && UI.view === 'staff') { if (typeof staffSignedOut === 'function') staffSignedOut(); return undefined; }
      if (e.fields && form) showFieldErrors(form, e.fields);
      toast(e.message, 'error');
    } else { console.error(e); toast(MSG.SERVER, 'error'); }
    return undefined;
  } finally { if (btn) { btn.classList.remove('busy'); btn.disabled = false; } }
}

/* ---------- forms ---------- */
function fdata(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' && k !== 'password' && k !== 'old' ? v.trim() : v; }); return o; }
function clearFieldErrors(form) { $$('.field.invalid', form).forEach(f => { f.classList.remove('invalid'); const e = $('.err', f); if (e) e.textContent = ''; }); }
function showFieldErrors(form, fields) {
  clearFieldErrors(form);
  Object.entries(fields || {}).forEach(([k, m]) => { const f = form.querySelector(`[data-field="${k}"]`); if (f) { f.classList.add('invalid'); const e = $('.err', f); if (e) e.textContent = m; } });
  const first = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea'); if (first) first.focus();
}
function field({ name, label, type = 'text', value = '', attrs = '', hint = '', tag = 'input', options = [], cls = '' }) {
  const id = uid('f'); let ctl;
  if (tag === 'select') ctl = `<select id="${id}" name="${name}" ${attrs}>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  else if (tag === 'textarea') ctl = `<textarea id="${id}" name="${name}" rows="4" ${attrs}>${esc(value)}</textarea>`;
  else ctl = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}>`;
  return `<div class="field ${cls}" data-field="${name}"><label for="${id}">${label}</label>${ctl}${hint ? `<span class="hint">${hint}</span>` : ''}<span class="err" aria-live="polite"></span></div>`;
}
function stepper(name, val, min, max, label) {
  return `<div class="stepper" data-stepper="${name}" role="group" aria-label="${esc(label)}"><button type="button" class="step-btn" data-step="-1" aria-label="Fewer ${esc(label)}">${ic('minus', 18)}</button><output aria-live="polite">${val}</output><button type="button" class="step-btn" data-step="1" aria-label="More ${esc(label)}">${ic('plus', 18)}</button><input type="hidden" name="${name}" value="${val}" data-min="${min}" data-max="${max}"></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.step-btn'); if (!b) return;
  const wrap = b.closest('.stepper'), inp = $('input', wrap), out = $('output', wrap);
  const v = Math.min(+inp.dataset.max, Math.max(+inp.dataset.min, +inp.value + +b.dataset.step));
  if (v !== +inp.value) { inp.value = v; out.textContent = v; inp.dispatchEvent(new Event('change', { bubbles: true })); }
});

/* ---------- pills ---------- */
const PILL = {
  res: { 'Pending': 'warn', 'Confirmed': 'info', 'Checked In': 'ok', 'Checked Out': 'mute', 'Cancelled': 'bad', 'No Show': 'bad' },
  pay: { 'Paid': 'ok', 'Pending': 'warn', 'Unpaid': 'warn', 'Refund Pending': 'info', 'Refunded': 'mute', 'Failed': 'bad' },
  room: { 'Available': 'ok', 'Reserved': 'info', 'Occupied': 'gold', 'Cleaning': 'warn', 'Maintenance': 'mute', 'Out of Order': 'bad' },
  hk: { 'Clean': 'ok', 'Dirty': 'warn', 'Cleaning': 'info', 'Maintenance': 'mute' }
};
const pill = (text, kind) => `<span class="pill ${kind || 'mute'}">${esc(text)}</span>`;
const resPill = s => pill(s, PILL.res[s]);
const payPill = s => pill(s === 'Unpaid' ? 'Unpaid' : s, PILL.pay[s]);
const roomPill = s => pill(s, PILL.room[s]);

/* ---------- skeletons ---------- */
const skel = (n = 3, h = 84) => Array.from({ length: n }, () => `<div class="skel" style="height:${h}px"></div>`).join('');

/* ---------- counters + reveal ---------- */
function countUp(el) {
  const target = +el.dataset.count, pre = el.dataset.pre || '', suf = el.dataset.suf || '', dec = +el.dataset.dec || 0;
  const fmt = v => pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-PH')) + suf;
  if (reduceMotion() || !isFinite(target)) { el.textContent = fmt(target); return; }
  const t0 = performance.now(), dur = 900;
  const tick = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(target * e); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
let io = null;
function observe(root = document) {
  if (!('IntersectionObserver' in window)) { $$('[data-count]', root).forEach(countUp); $$('.reveal', root).forEach(x => x.classList.add('in')); return; }
  io = io || new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; const el = en.target; io.unobserve(el); if (el.matches('[data-count]')) countUp(el); if (el.classList.contains('reveal')) el.classList.add('in'); }), { threshold: .2, rootMargin: '0px 0px -8% 0px' });
  $$('[data-count], .reveal', root).forEach(el => { if (!el.dataset.seen) { el.dataset.seen = 1; io.observe(el); } });
}

/* ---------- search state (dates + guests) ---------- */
function defaultSearch() { const t = todayISO(); return { ci: addDays(t, 1), co: addDays(t, 3), adults: 2, children: 0 }; }
function getSearch() {
  const s = Object.assign(defaultSearch(), store.get(UI.searchKey, {}));
  if (!s.ci || s.ci < todayISO() || !s.co || s.co <= s.ci) Object.assign(s, defaultSearch(), { adults: s.adults || 2, children: s.children || 0 });
  return s;
}
const setSearch = p => { const s = Object.assign(getSearch(), p); store.set(UI.searchKey, s); return s; };
function dateProblem(ci, co) {
  if (!ci || !co) return MSG.INVALID_DATES; if (ci < todayISO()) return MSG.PAST_DATE; if (co <= ci) return MSG.INVALID_DATES; if (diffDays(ci, co) > CONFIG.MAX_NIGHTS) return MSG.MAX_NIGHTS; return '';
}

/* ---------- downloads / print ---------- */
function confirmationDoc(r) {
  const H = CONFIG.HOTEL; const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmation ${esc(r.number)}</title><style>
body{font:15px/1.6 Arial,sans-serif;color:#1E2A2E;margin:0;background:#f4efe3}.sheet{max-width:720px;margin:28px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,43,51,.12)}
.top{background:#0F2B33;color:#F4E7CB;padding:28px 32px}.top h1{font:500 28px Georgia,serif;margin:0}.top p{margin:6px 0 0;color:#C29A4B;font:italic 15px Georgia,serif}.bar{height:3px;background:#C29A4B}
.body{padding:28px 32px}.no{font:600 26px Georgia,serif;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:10px 0;border-bottom:1px solid #E7DECB;text-align:left;vertical-align:top}th{color:#5C6B6E;font-weight:400;width:42%}td{font-weight:600}
.note{background:#FBF8F1;border-radius:12px;padding:14px 16px;color:#5C6B6E;font-size:13px}.foot{padding:18px 32px;background:#FBF8F1;color:#5C6B6E;font-size:12px;text-align:center}@media print{body{background:#fff}.sheet{box-shadow:none;margin:0}}
</style></head><body><div class="sheet"><div class="top"><h1>${esc(H.name)}</h1><p>${esc(H.tagline)}</p></div><div class="bar"></div><div class="body"><p style="margin:0;color:#5C6B6E">Reservation confirmation</p><p class="no">${esc(r.number)}</p>
<table>${row('Guest name', esc(fullName(r.guest)))}${row('Room', esc(r.type.name))}${row('Check-in', esc(fmtDate(r.check_in)) + ' from ' + CONFIG.CHECKIN)}${row('Check-out', esc(fmtDate(r.check_out)) + ' by ' + CONFIG.CHECKOUT)}${row('Nights', r.nights)}${row('Guests', esc(guestsText(r.adults, r.children)))}${row('Total amount', esc(money(r.total)))}${row('Payment status', esc(r.payment_status))}${row('Reservation status', esc(r.status))}${r.special_requests ? row('Special requests', esc(r.special_requests)) : ''}</table>
<div class="note"><b>Cancellation policy.</b> Free cancellation until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in. After that, the first night is charged. Please bring a valid photo ID.</div></div>
<div class="foot">${esc(H.name)} · ${esc(H.address)}<br>${esc(H.phone)} · ${esc(H.email)}<br>© ${new Date().getFullYear()} ${esc(H.name)}. All Rights Reserved.</div></div></body></html>`;
}
function downloadConfirmation(r) {
  const filename = `${r.number}-confirmation.html`, data = confirmationDoc(r);
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'text/html' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); toast('Confirmation downloaded.'); }
  catch (e) { toast('Downloads aren’t available here. Use Print instead.', 'error'); }
}
function printConfirmation(r) {
  let root = $('#print-root'); if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  const doc = confirmationDoc(r); const m = /<body[^>]*>([\s\S]*)<\/body>/.exec(doc); const st = /<style>([\s\S]*?)<\/style>/.exec(doc);
  root.innerHTML = `<style>${st ? st[1] : ''}</style>${m ? m[1] : ''}`;
  try { window.print(); } catch (e) { toast('Printing isn’t available here. Use Download instead.', 'error'); }
}
function previewEmail(html, title) {
  const m = openModal({ title: title || 'Email preview', size: 'lg', body: '<div class="email-host" id="email-host"></div>' });
  const host = $('#email-host', m.el); const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  const bodyHtml = (/<body[^>]*>([\s\S]*)<\/body>/.exec(html) || [0, html])[1]; root.innerHTML = `<div style="background:#EFE8D8;border-radius:12px;overflow:auto">${bodyHtml}</div>`;
}
