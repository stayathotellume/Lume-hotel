'use strict';
/* ==========================================================================
   Staff console (part A): sign-in, shell, dashboard, reservations
   ========================================================================== */
const SF = { user: null, page: 'dashboard', res: { f: {}, rooms: [] }, cal: { from: null, days: 14 }, ana: { range: 'month', from: '', to: '' }, msgTab: 'All', openId: null, drawer: null, pulseVersion: 0 };
const SP = {};
const STAFF_NAV = [
  ['dashboard', 'Dashboard', 'dashboard', 'res.view'], ['reservations', 'Reservations', 'list', 'res.view'], ['calendar', 'Calendar', 'calendar', 'calendar'], ['frontdesk', 'Front desk', 'key', 'frontdesk'],
  ['rooms', 'Rooms', 'bed', 'rooms.view'], ['housekeeping', 'Housekeeping', 'broom', 'housekeeping'], ['analytics', 'Analytics', 'chart', 'analytics'], ['messages', 'Messages', 'mail', 'messages'], ['emails', 'Emails', 'file', 'emails'],
  ['settings', 'Settings', 'sliders', 'settings'], ['users', 'Staff accounts', 'users2', 'users'], ['photos', 'Photos', 'image', 'photos'], ['addons', 'Extras', 'tag', 'addons'], ['audit', 'Audit log', 'shield', 'audit']
];
const ROLE_LABEL = { admin: 'Administrator', front_desk: 'Front desk', housekeeping: 'Housekeeping' };
const okPage = (p, role) => { const n = STAFF_NAV.find(x => x[0] === p); return !!n && can(role, n[3]); };
const homePage = role => role === 'housekeeping' ? 'housekeeping' : 'dashboard';
const can = (role, perm) => role === 'admin' || ({ front_desk: ['res.view', 'res.edit', 'res.action', 'res.pay', 'res.email', 'res.create', 'calendar', 'frontdesk', 'rooms.view', 'housekeeping', 'messages', 'emails', 'notifications'], housekeeping: ['housekeeping', 'rooms.view'] }[role] || []).includes(perm);

Object.assign(ICONS, { sliders: 'M4 6h10M4 12h6M4 18h14M18 4v4M14 10v4M8 16v4', users2: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M18 8a3 3 0 1 1-1-5.7M21 20a5.5 5.5 0 0 0-4.5-6.9', image: 'M4 5h16v14H4zM4 15l4-4 4 4 4-6 4 5M9 9a1 1 0 1 0-2 0 1 1 0 0 0 2 0' });

function staffSignedOut() { SF.user = null; toast(MSG.UNAUTHORIZED, 'error'); ModalStack.slice().forEach(m => m.close()); if (UI.view === 'staff') renderLogin(); }

/* ---------- sign-in ---------- */
function renderLogin() {
  UI.view = 'staff'; document.title = 'Staff sign-in · ' + H().name;
  $('#app').innerHTML = `<div class="login"><div class="login-card"><a class="brand dark" href="#/"><img class="mark" src="/brand/logo-mark.png" alt=""><span>${esc(H().name)}</span></a><h1>Staff sign-in</h1><p class="muted">Reservations, front desk and housekeeping.</p>
<form id="login-form" novalidate>${field({ name: 'email', label: 'Email', type: 'email', attrs: 'autocomplete="username" inputmode="email" required' })}${field({ name: 'password', label: 'Password', type: 'password', attrs: 'autocomplete="current-password" required' })}<div class="alert bad" id="login-err" hidden role="alert"></div><button class="btn gold block" type="submit">Sign in</button></form><a class="back-link" href="#/">${ic('left', 15)} Back to the website</a></div></div>`;
  const f = $('#login-form');
  f.addEventListener('submit', async e => {
    e.preventDefault(); const d = fdata(f); const er = $('#login-err'); er.hidden = true; clearFieldErrors(f);
    if (!d.email || !d.password) { const x = {}; if (!d.email) x.email = 'Enter your email.'; if (!d.password) x.password = 'Enter your password.'; return showFieldErrors(f, x); }
    const u = await run(() => API.staff.login(d.email, d.password), { btn: $('[type=submit]', f), onError: ex => { if (ex && ex.friendly) { er.textContent = ex.message; er.hidden = false; return true; } } });
    if (u) { SF.user = u; toast(`Welcome back, ${u.name.split(' ')[0]}.`); go('/staff/' + homePage(u.role)); }
  });
}

/* ---------- shell ---------- */
async function staffRoute(page) {
  UI.view = 'staff';
  if (STATE.needsSetup) return go('/setup');
  const me = await API.staff.me(); if (!me) return renderLogin(); SF.user = me;
  if (!page || !okPage(page, me.role)) { if (page && !okPage(page, me.role)) toast(MSG.FORBIDDEN, 'error'); return go('/staff/' + homePage(me.role)); }
  SF.page = page; renderStaffShell(); await loadStaffPage(false);
  startPulse();
}
function renderStaffShell() {
  const u = SF.user; if ($('#staff-shell') && $('#staff-shell').dataset.role === u.role) { syncStaffNav(); return; }
  const nav = STAFF_NAV.filter(n => can(u.role, n[3])).map(n => `<a href="#/staff/${n[0]}" data-nav="${n[0]}">${ic(n[2], 19)}<span>${n[1]}</span></a>`).join('');
  $('#app').innerHTML = `<div class="staff" id="staff-shell" data-role="${u.role}"><aside class="rail" id="rail"><a class="brand" href="#/staff"><img class="mark" src="/brand/logo-mark.png" alt=""><span>${esc(H().name)}</span></a><nav aria-label="Staff">${nav}</nav><div class="rail-foot"><a href="#/">${ic('home', 18)}<span>View website</span></a><button id="signout">${ic('logout', 18)}<span>Sign out</span></button></div></aside><div class="rail-back" id="rail-back"></div>
<div class="s-main"><header class="s-top"><button class="icon-btn s-burger" id="s-burger" aria-label="Open menu">${ic('menu', 24)}</button><h1 id="s-title"></h1><div class="s-tools"><button class="icon-btn bell" id="bell" aria-label="Notifications" aria-haspopup="true">${ic('bell', 22)}<span class="badge" id="bell-n" hidden>0</span></button><div class="user-chip"><span class="av">${initials(u.name)}</span><span class="who"><b>${esc(u.name)}</b><small>${ROLE_LABEL[u.role] || u.role}</small></span></div></div></header>
<div id="s-status"></div><div id="s-body" class="s-body"></div></div></div>`;
  $('#signout').onclick = async () => { await API.staff.logout(); SF.user = null; ModalStack.slice().forEach(m => m.close()); stopPulse(); toast('You’ve signed out.', 'info'); renderLogin(); };
  $('#s-burger').onclick = () => $('#staff-shell').classList.toggle('open'); $('#rail-back').onclick = () => $('#staff-shell').classList.remove('open');
  $('#rail').addEventListener('click', e => { if (e.target.closest('a[data-nav]')) $('#staff-shell').classList.remove('open'); });
  $('#bell').onclick = e => { e.stopPropagation(); openBell(e.currentTarget); };
  syncStaffNav(); updateBell(); loadStatusBanner();
}
function syncStaffNav() { $$('#rail a[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === SF.page)); const n = STAFF_NAV.find(x => x[0] === SF.page); $('#s-title').textContent = n ? n[1] : ''; document.title = (n ? n[1] : 'Staff') + ' · ' + H().name; }
function updateBell() { const b = $('#bell-n'); if (!b) return; API.staff.pulse().then(p => { if (!p) return; b.hidden = !p.unread; b.textContent = p.unread > 9 ? '9+' : p.unread; }).catch(() => { }); }
async function loadStatusBanner() {
  if (!can(SF.user.role, 'settings')) { $('#s-status').innerHTML = ''; return; }
  try {
    const s = await API.staff.settings();
    const bits = [];
    if (!s.email.configured) bits.push('Email isn’t connected yet, so no messages can be delivered.');
    if (!s.payments.paymongo) bits.push('Online card, GCash and Maya payments aren’t connected yet.');
    $('#s-status').innerHTML = bits.length ? `<div class="s-status">${ic('info', 16)}<span>${bits.join(' ')} <a href="#/staff/settings">Open settings</a></span></div>` : '';
  } catch (e) { $('#s-status').innerHTML = ''; }
}
async function loadStaffPage(quiet) {
  const body = $('#s-body'); if (!body) return; if (!quiet) { body.innerHTML = `<div class="skels">${skel(4, 96)}</div>`; window.scrollTo(0, 0); } body.classList.remove('enter'); if (!quiet) { void body.offsetWidth; body.classList.add('enter'); }
  const scroll = quiet ? window.scrollY : 0;
  try { await SP[SF.page](quiet); } catch (e) { if (e && e.code === 'UNAUTHORIZED') return staffSignedOut(); body.innerHTML = `<div class="empty"><p>${esc(e && e.friendly ? e.message : MSG.SERVER)}</p><button class="btn line" id="s-retry">Try again</button></div>`; const rt = $('#s-retry'); if (rt) rt.onclick = () => loadStaffPage(false); }
  if (quiet) window.scrollTo(0, scroll); observe(body); updateBell();
}

/* ---------- live sync: poll for changes, quietly refresh ---------- */
let pulseTimer = null;
function startPulse() {
  stopPulse();
  pulseTimer = setInterval(async () => {
    if (UI.view !== 'staff' || !SF.user) return;
    try {
      const p = await API.staff.pulse(); if (!p) return;
      const b = $('#bell-n'); if (b) { b.hidden = !p.unread; b.textContent = p.unread > 9 ? '9+' : p.unread; }
      if (p.version !== SF.pulseVersion) { SF.pulseVersion = p.version; if (SF.drawer && SF.drawer.el.isConnected) refreshDrawer(); if (!ModalStack.length) loadStaffPage(true); }
    } catch (e) { if (e && e.code === 'UNAUTHORIZED') staffSignedOut(); }
  }, 6000);
}
function stopPulse() { if (pulseTimer) clearInterval(pulseTimer); pulseTimer = null; }

/* ---------- shared bits ---------- */
const kpi = (label, n, icon, o = {}) => `<div class="kpi ${o.cls || ''}"><span class="k-ic">${ic(icon, 22)}</span><div><b data-count="${n}" ${o.pre ? `data-pre="${o.pre}"` : ''} ${o.suf ? `data-suf="${o.suf}"` : ''} ${o.dec ? `data-dec="${o.dec}"` : ''}>0</b><small>${label}</small></div></div>`;
const timeShort = t => t ? new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
function resRow(r, extra = '') { return `<li class="ri" data-open="${r.id}" tabindex="0" role="button" aria-label="Open ${esc(r.number)}"><span class="ri-main"><b>${esc(fullName(r.guest))}</b><small>${esc(r.number)} · Room ${esc(r.room.number)} · ${esc(r.type.name)}</small></span><span class="ri-side">${extra || resPill(r.status)}</span></li>`; }
function nextActions(r) {
  const a = [];
  if (r.status === 'Pending') a.push(['confirm', 'Confirm', 'gold']);
  if (r.status === 'Confirmed') a.push(['checkin', 'Check In', 'gold']);
  if (r.status === 'Checked In') a.push(['checkout', 'Check Out', 'gold']);
  return a;
}
function menuItems(r) {
  const it = []; const act = r.status;
  it.push({ label: 'View', icon: 'eye', run: () => openReservation(r.id) });
  if (['Pending', 'Confirmed', 'Checked In'].includes(act) && can(SF.user.role, 'res.edit')) it.push({ label: 'Edit', icon: 'edit', run: () => openEdit(r.id) });
  if (act === 'Pending') it.push({ label: 'Confirm', icon: 'check', run: () => staffAct(r.id, 'confirm') });
  if (act === 'Confirmed') it.push({ label: 'Check In', icon: 'key', run: () => staffAct(r.id, 'checkin') });
  if (act === 'Checked In') it.push({ label: 'Check Out', icon: 'logout', run: () => staffAct(r.id, 'checkout') });
  if (['Pending', 'Confirmed'].includes(act)) { it.push({ label: 'Mark No Show', icon: 'alert', run: () => staffAct(r.id, 'noshow') }); it.push({ label: 'Cancel', icon: 'close', danger: true, run: () => staffAct(r.id, 'cancel') }); }
  it.push('-', { label: 'Send Confirmation', icon: 'mail', run: () => staffEmail(r.id, 'confirmation') }, { label: 'Print', icon: 'print', run: () => printConfirmation(pubOf(r)) }, { label: 'Download', icon: 'download', run: () => downloadConfirmation(pubOf(r)) });
  return it;
}
const pubOf = r => Object.assign({}, r, { lines: r.pricing ? r.pricing.lines : [] });

/* ---------- actions ---------- */
async function afterChange(id) { updateBell(); if (SF.drawer && SF.drawer.el.isConnected && SF.openId) await refreshDrawer(); await loadStaffPage(true); }
async function staffEmail(id, tpl) {
  const out = await run(() => API.staff.email(id, tpl), { ok: r => r.status === 'not_configured' ? 'Email isn’t connected yet — see Settings.' : 'Email queued for delivery.' }); if (out) afterChange(id);
}
async function staffAct(id, act) {
  if (act === 'cancel') {
    const r = await API.staff.reservation(id).catch(e => null); if (!r) return toast(MSG.SERVER, 'error');
    const m = openModal({ title: `Cancel ${r.number}?`, size: 'sm', body: `<form id="cx-form"><p class="dlg-text">${esc(fullName(r.guest))} · ${esc(r.type.name)} · ${fmtShort(r.check_in)} to ${fmtShort(r.check_out)}. The room becomes available again straight away.</p>${field({ name: 'reason', label: 'Reason', tag: 'select', options: ['Guest request', 'Payment not received', 'Duplicate booking', 'Hotel unable to host', 'Other'] })}${r.paid_amount > 0 ? `<label class="check"><input type="checkbox" name="refund" checked><span>Refund ${money(r.paid_amount)} to the guest</span></label>` : ''}<div class="dlg-actions"><button type="button" class="btn line" data-close>Keep reservation</button><button class="btn danger" type="submit">Cancel reservation</button></div></form>` });
    $('#cx-form', m.el).addEventListener('submit', async e => { e.preventDefault(); const d = fdata(e.target); const out = await run(() => API.staff.action(id, 'cancel', { reason: d.reason, refund: !!d.refund }), { btn: $('[type=submit]', e.target) }); if (out) { m.close(); toast('Reservation cancelled. The room is available again.'); afterChange(id); } });
    return;
  }
  const msgs = { confirm: 'Reservation confirmed.', checkin: 'Guest checked in. The room is now occupied.', checkout: 'Guest checked out. The room is now waiting to be cleaned.', noshow: 'Marked as no-show. The room is available again.' };
  const out = await run(() => API.staff.action(id, act), {
    onError: e => { if (e && e.code === 'EARLY') { confirmBox({ title: 'Check in early?', message: esc(e.message) + ' Check them in today anyway?', confirmText: 'Check in now', cancelText: 'Not yet' }).then(async yes => { if (!yes) return; const o2 = await run(() => API.staff.action(id, 'checkin', { early: true })); if (o2) { toast(msgs.checkin); afterChange(id); } }); return true; } }
  });
  if (out) { toast(msgs[act]); afterChange(id); }
}

/* ---------- reservation drawer ---------- */
async function openReservation(id) {
  SF.openId = id; if (SF.drawer && SF.drawer.el.isConnected) SF.drawer.close();
  SF.drawer = openModal({ title: 'Reservation', kind: 'sheet', size: 'xl', body: `<div class="skels">${skel(4, 90)}</div>`, onClose: () => { SF.openId = null; } });
  await refreshDrawer();
}
async function refreshDrawer() {
  const d = SF.drawer; if (!d || !d.el.isConnected || !SF.openId) return; let r;
  try { r = await API.staff.reservation(SF.openId); } catch (e) { d.set(`<div class="empty"><p>${esc(e.friendly ? e.message : MSG.SERVER)}</p></div>`); return; }
  d.title(r.number); const role = SF.user.role, bal = r2(r.total - (r.paid_amount || 0)), na = nextActions(r), active = ['Pending', 'Confirmed', 'Checked In'].includes(r.status);
  const reqs = (r.requests || []).filter(q => q.status === 'Pending');
  const st = d.body.scrollTop;
  d.set(`<div class="dr-head"><div><p class="dr-name">${esc(fullName(r.guest))}</p><p class="muted small"><a href="mailto:${esc(r.guest.email)}">${esc(r.guest.email)}</a> · <a href="tel:${esc(r.guest.phone)}">${esc(r.guest.phone)}</a></p></div><div class="pills">${resPill(r.status)}${payPill(r.payment_status)}</div></div>
<div class="dr-actions">${na.map(([a, l, c]) => `<button class="btn ${c}" data-dr="${a}">${l}</button>`).join('')}${active && can(role, 'res.edit') ? `<button class="btn line" data-dr="edit">${ic('edit', 17)}Edit</button>` : ''}${['Pending', 'Confirmed'].includes(r.status) ? `<button class="btn line" data-dr="noshow">Mark No Show</button><button class="btn line danger-o" data-dr="cancel">Cancel</button>` : ''}</div>
${reqs.length ? `<div class="reqbox"><h4>Guest requests</h4>${reqs.map(q => `<div class="req"><p>${q.type === 'cancel' ? `<b>Cancellation requested.</b> ${esc(q.reason || '')} ${esc(q.note || '')}` : `<b>Change requested:</b> ${fmtShort(q.payload.ci)} to ${fmtShort(q.payload.co)}, ${guestsText(q.payload.adults, q.payload.children)}. ${esc(q.payload.note || '')} ${q.feasible ? pill('Room available', 'ok') : pill('No room free', 'bad')}`}</p><div class="req-btns"><button class="btn sm gold" data-req="${q.id}" data-decision="approve">Approve</button><button class="btn sm line" data-req="${q.id}" data-decision="decline">Decline</button></div></div>`).join('')}</div>` : ''}
<dl class="sum dense"><div><dt>Room</dt><dd>Room ${esc(r.room.number)}<small>${esc(r.type.name)}</small></dd></div><div><dt>Stay</dt><dd>${fmtDate(r.check_in)} to ${fmtDate(r.check_out)}<small>${plural(r.nights, 'night')}</small></dd></div><div><dt>Guests</dt><dd>${guestsText(r.adults, r.children)}</dd></div><div><dt>Arrival</dt><dd>${esc(r.arrival_time || 'Not given')}</dd></div><div><dt>Special requests</dt><dd>${r.special_requests ? esc(r.special_requests) : '<span class="muted">None</span>'}</dd></div><div><dt>Booked</dt><dd>${timeShort(r.created_at)}<small>${esc(r.source || 'website')}</small></dd></div></dl>
<h3 class="h-sub">Payment</h3><dl class="sum dense"><div><dt>Total</dt><dd><b>${money(r.total)}</b></dd></div><div><dt>Paid</dt><dd>${money(r.paid_amount || 0)}<small>${esc(PAY_METHODS[r.payment_method] || '')}</small></dd></div><div><dt>Balance</dt><dd>${bal > 0 ? `<b>${money(bal)}</b>` : money(0)}</dd></div></dl>
${bal > 0 && can(role, 'res.pay') && !['Cancelled', 'No Show'].includes(r.status) ? `<form class="pay-form" id="pay-form">${field({ name: 'method', label: 'Method', tag: 'select', options: Object.entries(PAY_METHODS).map(([k, v]) => [k, v]), value: r.payment_method === 'hotel' ? 'cash' : r.payment_method })}${field({ name: 'amount', label: 'Amount', type: 'number', value: bal, attrs: `min="1" max="${bal}" step="0.01"` })}<button class="btn gold" type="submit">Record payment</button></form>` : ''}
${r.payment_status === 'Refund Pending' && can(role, 'res.pay') ? `<button class="btn line" data-dr="refund">Mark refund as completed</button>` : ''}
<h3 class="h-sub">Price</h3><div class="calc"><div class="calc-row"><span>${money(r.price_per_night)} × ${plural(r.nights, 'night')}</span><b>${money(r.pricing.roomTotal)}</b></div>${r.pricing.lines.map(l => `<div class="calc-row"><span>${esc(l.label)}</span><b>${money(l.amount)}</b></div>`).join('')}<div class="calc-row"><span>Service charge</span><b>${money(r.pricing.service)}</b></div><div class="calc-row"><span>VAT</span><b>${money(r.pricing.vat)}</b></div><div class="calc-row total"><span>Total</span><b>${money(r.total)}</b></div></div>
${can(role, 'res.email') ? `<h3 class="h-sub">Emails to guest <small class="muted">${plural(r.email_count, 'email')} so far</small></h3><div class="mail-row">${field({ name: 'tpl', label: 'Template', tag: 'select', options: (SF.templates || []).map(t => [t.id, t.label]) })}<button class="btn line" data-dr="sendmail">${ic('mail', 17)}Send</button><button class="btn line" data-dr="previewmail">${ic('eye', 17)}Preview</button></div>` : ''}
<div class="dr-foot"><button class="btn line" data-dr="print">${ic('print', 17)}Print</button><button class="btn line" data-dr="download">${ic('download', 17)}Download</button></div>
<h3 class="h-sub">Activity</h3>${r.log.length ? `<ul class="log">${r.log.map(l => `<li><b>${esc(l.action)}</b><small>${timeShort(l.at)} · ${esc(l.user)}</small><span>${esc(l.details)}</span></li>`).join('')}</ul>` : '<p class="muted">No activity yet.</p>'}`);
  d.body.scrollTop = st;
  if (!SF.templates) API.staff.templates().then(t => { SF.templates = t; if (SF.drawer && SF.drawer.el.isConnected) refreshDrawer(); }).catch(() => { });
  d.body.onclick = async e => {
    const b = e.target.closest('[data-dr],[data-req]'); if (!b) return; const id = r.id;
    if (b.dataset.req) { const out = await run(() => API.staff.resolveRequest(id, +b.dataset.req, b.dataset.decision), { btn: b }); if (out) { toast(b.dataset.decision === 'approve' ? 'Request approved. The guest has been emailed.' : 'Request declined.'); afterChange(id); } return; }
    const a = b.dataset.dr;
    if (['confirm', 'checkin', 'checkout', 'noshow', 'cancel'].includes(a)) return staffAct(id, a);
    if (a === 'edit') return openEdit(id);
    if (a === 'refund') { const out = await run(() => API.staff.refund(id), { btn: b, ok: 'Refund marked as completed.' }); if (out) afterChange(id); return; }
    if (a === 'sendmail') return staffEmail(id, $('[name=tpl]', d.body).value);
    if (a === 'previewmail') { const tpl = $('[name=tpl]', d.body).value; const h = await run(() => API.staff.emailPreview({ template: tpl, res_id: id })); if (h) previewEmail(h.html, h.subject); return; }
    if (a === 'print') return printConfirmation(pubOf(r)); if (a === 'download') return downloadConfirmation(pubOf(r));
  };
  const pf = $('#pay-form', d.body); if (pf) pf.addEventListener('submit', async e => { e.preventDefault(); const f = fdata(pf); const out = await run(() => API.staff.pay(r.id, { method: f.method, amount: +f.amount }), { btn: $('[type=submit]', pf), ok: 'Payment recorded.', form: pf }); if (out) afterChange(r.id); });
}

/* ---------- edit reservation ---------- */
async function openEdit(id) {
  let r; try { r = await API.staff.reservation(id); } catch (e) { return toast(e.friendly ? e.message : MSG.SERVER, 'error'); }
  const roomOpts = async (ci, co) => { const free = await API.staff.freeRooms(ci, co, r.id); return [['', `Keep Room ${r.room.number} (auto-move if needed)`], ...free.map(x => [x.id, `Room ${x.number} · ${x.type_name}`])]; };
  const m = openModal({ title: `Edit ${r.number}`, size: 'lg', body: `<form id="edit-form" novalidate><div class="form-grid">${field({ name: 'first', label: 'First name', value: r.guest.first })}${field({ name: 'last', label: 'Last name', value: r.guest.last })}${field({ name: 'email', label: 'Email', type: 'email', value: r.guest.email })}${field({ name: 'phone', label: 'Phone', type: 'tel', value: r.guest.phone })}${field({ name: 'ci', label: 'Check-in', type: 'date', value: r.check_in })}${field({ name: 'co', label: 'Check-out', type: 'date', value: r.check_out })}<div class="field" data-field="roomId"><label for="ed-room">Room</label><select id="ed-room" name="roomId"></select><span class="err"></span></div><div class="field"><label>Adults</label>${stepper('adults', r.adults, 1, 6, 'adults')}</div><div class="field"><label>Children</label>${stepper('children', r.children, 0, 5, 'children')}</div>${field({ name: 'arrival', label: 'Estimated arrival', tag: 'select', options: ARRIVALS.includes(r.arrival_time) || !r.arrival_time ? ARRIVALS : [r.arrival_time, ...ARRIVALS], value: r.arrival_time || '2:00 PM' })}${field({ name: 'requests', label: 'Special requests', tag: 'textarea', value: r.special_requests, cls: 'full' })}</div><label class="check"><input type="checkbox" name="notify" checked><span>Email the guest the updated details</span></label><p class="hint-box">${ic('info', 15)}<span>Changing dates or room recalculates the total. Double-bookings are blocked automatically.</span></p><div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">Save changes</button></div></form>` });
  const f = $('#edit-form', m.el), sel = $('#ed-room', m.el);
  const fill = async () => { const d = fdata(f); const cur = sel.value; const opts = d.co > d.ci ? await roomOpts(d.ci, d.co) : [['', 'Keep current room']]; sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(''); if ([...sel.options].some(o => o.value === cur)) sel.value = cur; };
  fill(); f.addEventListener('change', e => { if (e.target.name === 'ci' || e.target.name === 'co') fill(); });
  f.addEventListener('submit', async e => {
    e.preventDefault(); clearFieldErrors(f); const d = fdata(f);
    const ch = { first: d.first, last: d.last, email: d.email, phone: d.phone, ci: d.ci, co: d.co, adults: +d.adults, children: +d.children, requests: d.requests, arrival: d.arrival }; if (d.roomId) ch.roomId = +d.roomId;
    const out = await run(() => API.staff.update(id, ch, { email: !!d.notify }), { btn: $('[type=submit]', f), form: f }); if (out) { m.close(); toast('Reservation updated.'); afterChange(id); }
  });
}

/* ---------- dashboard ---------- */
SP.dashboard = async () => {
  const d = await API.staff.dashboard(); const T = todayISO(); const guestsIn = d.inhouse.reduce((n, r) => n + r.adults + r.children, 0);
  const max = Math.max(d.totalRooms, 1);
  if (!d.totalRooms) { $('#s-body').innerHTML = `<div class="empty"><p>No rooms have been set up yet. Add your room types and rooms to start taking reservations.</p><a class="btn gold" href="#/staff/rooms">Go to Rooms</a></div>`; return; }
  $('#s-body').innerHTML = `<div class="kpis">${kpi('Arrivals today', d.arrivals.length, 'door')}${kpi('Departures today', d.departures.length, 'logout')}${kpi('Current guests', guestsIn, 'users')}${kpi('Available rooms', d.available, 'bed', { cls: 'ok' })}${kpi('Occupied rooms', d.occupied, 'key')}${kpi('Pending reservations', d.pending, 'clock', { cls: d.pending ? 'warn' : '' })}</div>
<div class="s-cols"><section class="panel"><h2>Needs attention</h2>${d.requests.length || d.pendingList.length ? `<ul class="rlist">${d.requests.map(r => resRow(r, pill(r.requests.find(q => q.status === 'Pending').type === 'cancel' ? 'Cancel request' : 'Change request', 'warn'))).join('')}${d.pendingList.filter(r => !d.requests.some(x => x.id === r.id)).map(r => resRow(r, `${payPill(r.payment_status)}`)).join('')}</ul>` : '<p class="muted">Nothing waiting on you.</p>'}</section>
<section class="panel"><h2>Arrivals today</h2>${d.arrivals.length ? `<ul class="rlist">${d.arrivals.map(r => resRow(r)).join('')}</ul>` : '<p class="muted">No arrivals today.</p>'}</section>
<section class="panel"><h2>Departures today</h2>${d.departures.length ? `<ul class="rlist">${d.departures.map(r => resRow(r, r.check_out < T ? pill('Overdue', 'bad') : resPill(r.status))).join('')}</ul>` : '<p class="muted">No departures today.</p>'}</section>
<section class="panel"><h2>Occupancy, next 7 nights</h2><div class="wk">${d.week.map(w => `<div class="wk-col" title="${fmtDate(w.date)}: ${w.occupied} of ${max} rooms"><div class="wk-bar"><i style="height:${Math.round(w.occupied / max * 100)}%"></i></div><b>${w.occupied}</b><small>${parseISO(w.date).toLocaleDateString('en-PH', { weekday: 'short' })}</small></div>`).join('')}</div><p class="muted small">Rooms occupied each night, out of ${d.totalRooms}.</p></section></div>`;
};

/* ---------- reservations ---------- */
SP.reservations = async quiet => {
  if (!quiet || !$('#res-filters')) {
    const rr = await API.staff.rooms(); SF.res.rooms = rr.rooms;
    $('#s-body').innerHTML = `<form class="rfilters" id="res-filters" role="search" aria-label="Search and filter reservations"><div class="field wide"><label for="q">Search</label><div class="search">${ic('search', 18)}<input id="q" name="q" type="search" placeholder="Reservation number, name, email, phone or room" value="${esc(SF.res.f.q || '')}"></div></div>
${field({ name: 'status', label: 'Reservation status', tag: 'select', options: [['', 'All statuses'], ...RES_STATUS.map(s => [s, s])], value: SF.res.f.status || '' })}${field({ name: 'pay', label: 'Payment status', tag: 'select', options: [['', 'All payments'], ...PAY_STATUS.map(s => [s, s])], value: SF.res.f.pay || '' })}${field({ name: 'room', label: 'Room', tag: 'select', options: [['', 'All rooms'], ...SF.res.rooms.map(r => [r.id, `Room ${r.number}`])], value: SF.res.f.room || '' })}${field({ name: 'date', label: 'Staying on', type: 'date', value: SF.res.f.date || '' })}${field({ name: 'name', label: 'Guest name', value: SF.res.f.name || '', attrs: 'autocomplete="off"' })}<button type="button" class="btn line" id="res-clear">Clear</button></form><p class="results" id="res-count" aria-live="polite"></p><div id="res-table"></div>`;
    const f = $('#res-filters'); let tm;
    const apply = () => { SF.res.f = fdata(f); loadResRows(); };
    f.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(apply, 220); }); f.addEventListener('change', apply); f.addEventListener('submit', e => e.preventDefault());
    $('#res-clear').onclick = () => { f.reset(); SF.res.f = {}; loadResRows(); };
    $('#res-table').addEventListener('click', e => {
      const row = e.target.closest('[data-rid]'); if (!row) return; const id = +row.dataset.rid; const r = SF.res.rows.find(x => x.id === id); if (!r) return;
      const more = e.target.closest('[data-more]'); if (more) { e.stopPropagation(); return openMenu(more, menuItems(r)); }
      const act = e.target.closest('[data-do]'); if (act) { e.stopPropagation(); return staffAct(id, act.dataset.do); }
      openReservation(id);
    });
    $('#res-table').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-rid]')) openReservation(+e.target.dataset.rid); });
  }
  await loadResRows();
};
async function loadResRows() {
  const box = $('#res-table'); if (!box) return; const out = await API.staff.reservations(SF.res.f); SF.res.rows = out.rows;
  $('#res-count').textContent = `${plural(out.total, 'reservation')}`;
  if (!out.rows.length) { box.innerHTML = `<div class="empty"><p>${out.total === 0 && !Object.values(SF.res.f).some(Boolean) ? 'No reservations yet. Bookings made on the website will appear here.' : 'No reservations match. Try clearing a filter or searching a different name.'}</p></div>`; return; }
  box.innerHTML = `<div class="table-wrap"><table class="rtable"><thead><tr><th>Reservation</th><th>Guest</th><th>Email</th><th>Phone</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Guests</th><th>Total</th><th>Payment</th><th>Status</th><th>Created</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${out.rows.map(r => { const na = nextActions(r)[0]; return `<tr data-rid="${r.id}" tabindex="0"><td data-label="Reservation"><b>${esc(r.number)}</b></td><td data-label="Guest">${esc(fullName(r.guest))}</td><td data-label="Email" class="brk">${esc(r.guest.email)}</td><td data-label="Phone">${esc(r.guest.phone)}</td><td data-label="Room">${esc(r.room.number)} <small class="muted">${esc(r.type.name)}</small></td><td data-label="Check-in">${fmtShort(r.check_in)}</td><td data-label="Check-out">${fmtShort(r.check_out)}</td><td data-label="Nights">${r.nights}</td><td data-label="Guests">${r.adults + r.children}</td><td data-label="Total">${money(r.total)}</td><td data-label="Payment">${payPill(r.payment_status)}</td><td data-label="Status">${resPill(r.status)}</td><td data-label="Created">${fmtShort(r.created_at.slice(0, 10))}</td><td class="acts">${na ? `<button class="btn sm gold" data-do="${na[0]}">${na[1]}</button>` : ''}<button class="icon-btn" data-more aria-label="More actions for ${esc(r.number)}">${ic('more', 20)}</button></td></tr>`; }).join('')}</tbody></table></div>`;
}
