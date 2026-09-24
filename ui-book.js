'use strict';
/* ==========================================================================
   Booking flow, confirmation, manage reservation
   ========================================================================== */
const STEPS = ['Dates', 'Room', 'Guest details', 'Summary', 'Payment', 'Confirmation'];
const ARRIVALS = ['Before 2:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM or later'];
let B = null;
function newBooking() { const S = getSearch(); return { step: 1, ci: S.ci, co: S.co, adults: S.adults, children: S.children, typeId: null, guest: { first: '', last: '', email: '', phone: '', requests: '', arrival: '2:00 PM' }, addons: {}, method: CONFIG.PAYMENTS.online ? 'card' : (CONFIG.PAYMENTS.bank ? 'bank' : 'hotel'), counts: null }; }
const bookKey = 'lume.booking';
const saveB = () => store.set(bookKey, B);
const typeOf = id => STATE.roomTypes.find(t => t.id === id);

async function bookRoute(q) {
  B = store.get(bookKey, null) || newBooking();
  if (q.get('type')) { const t = STATE.roomTypes.find(x => x.slug === q.get('type')); if (t) B.typeId = t.id; }
  if (q.get('ci') && q.get('co')) { B.ci = q.get('ci'); B.co = q.get('co'); }
  if (q.get('a')) B.adults = Math.max(1, +q.get('a') || 1);
  if (q.get('c') != null && q.get('c') !== '') B.children = Math.max(0, +q.get('c') || 0);
  let want = +q.get('step') || (q.get('type') && !dateProblem(B.ci, B.co) ? 3 : B.step || 1);
  if (q.get('step') === '2' || q.get('type')) { const S = { ci: B.ci, co: B.co, adults: B.adults, children: B.children }; if (!dateProblem(S.ci, S.co)) setSearch(S); }
  $('#app').innerHTML = siteShell(`<section class="section page-pad book"><div class="wrap"><h1 class="h-page">Book your stay</h1><ol class="steps" id="b-steps" aria-label="Booking progress"></ol><div class="b-grid"><div class="b-main" id="b-main"></div><aside class="b-side" id="b-side" aria-label="Your stay"></aside></div></div></section>`, { solid: true });
  await gotoStep(want, true);
}

async function gotoStep(n, initial) {
  let s = Math.min(Math.max(1, n), 5);
  if (s >= 2 && dateProblem(B.ci, B.co)) { if (!initial) toast(dateProblem(B.ci, B.co), 'error'); s = 1; }
  if (s >= 3 && !B.typeId) s = 2;
  if (s >= 2) {
    const av = await run(() => API.availability(B.ci, B.co)); if (!av) { s = 1; } else {
      B.counts = av;
      if (s >= 3 && !(B.counts[B.typeId] > 0)) { toast(MSG.ROOM_UNAVAILABLE, 'error'); B.typeId = null; s = 2; }
      if (s >= 3) { const t = typeOf(B.typeId); if (t && B.adults + B.children > t.capacity) { toast(`The ${t.name} sleeps up to ${t.capacity} guests. Please pick a larger room.`, 'error'); B.typeId = null; s = 2; } }
    }
  }
  if (s >= 4 && !validateGuestOk()) s = 3;
  B.step = s; saveB();
  if (location.hash.startsWith('#/book')) history.replaceState(null, '', '#/book');
  drawBook(); window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
}
const validateGuestOk = () => !Object.keys(validateGuest(B.guest)).length;
const bookQuote = () => API.quote({ typeId: B.typeId, ci: B.ci, co: B.co, adults: B.adults, children: B.children, addons: B.addons });

function drawBook() {
  $('#b-steps').innerHTML = STEPS.map((l, i) => `<li class="${i + 1 === B.step ? 'now' : i + 1 < B.step ? 'done' : ''}" ${i + 1 === B.step ? 'aria-current="step"' : ''}>${i + 1 < B.step && i < 4 ? `<button data-goto="${i + 1}" aria-label="Back to ${l}">${i + 1 < B.step ? ic('check', 14) : ''}<span>${l}</span></button>` : `<span class="st"><i>${i + 1}</i><span>${l}</span></span>`}</li>`).join('');
  const main = $('#b-main'); main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
  ({ 1: stepDates, 2: stepRooms, 3: stepGuest, 4: stepSummary, 5: stepPayment })[B.step]();
  drawSide();
}
function drawSide() {
  const side = $('#b-side'); if (B.step === 1 || dateProblem(B.ci, B.co)) { side.innerHTML = `<div class="side-card"><h3>Your stay</h3><p class="muted">Pick your dates and we’ll show what’s available.</p><ul class="assure"><li>${ic('check', 16)}Free cancellation until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in</li><li>${ic('check', 16)}No booking fees</li><li>${ic('check', 16)}Best rate on our own site</li></ul></div>`; return; }
  const t = B.typeId ? typeOf(B.typeId) : null; let q = null; if (t) q = bookQuote();
  side.innerHTML = `<div class="side-card"><h3>Your stay</h3>${t ? `<div class="side-room">${img(Art.room(t.slug, 0), t.name)}<div><b>${t.name}</b><small>${t.beds}</small></div></div>` : ''}<dl class="side-dl"><div><dt>Check-in</dt><dd>${fmtDate(B.ci)}<small>from ${CONFIG.CHECKIN}</small></dd></div><div><dt>Check-out</dt><dd>${fmtDate(B.co)}<small>by ${CONFIG.CHECKOUT}</small></dd></div><div><dt>Nights</dt><dd>${diffDays(B.ci, B.co)}</dd></div><div><dt>Guests</dt><dd>${guestsText(B.adults, B.children)}</dd></div></dl>
${q ? `<div class="calc"><div class="calc-row"><span>${money(q.rate)} × ${plural(q.nights, 'night')}</span><b>${money(q.roomTotal)}</b></div>${q.lines.map(l => `<div class="calc-row"><span>${esc(l.label)}</span><b>${money(l.amount)}</b></div>`).join('')}<div class="calc-row"><span>Service charge</span><b>${money(q.service)}</b></div><div class="calc-row"><span>VAT</span><b>${money(q.vat)}</b></div><div class="calc-row total"><span>Total</span><b>${money(q.total)}</b></div></div>` : ''}</div>`;
}

/* ----- step 1: dates ----- */
function stepDates() {
  $('#b-main').innerHTML = `<h2 class="h-step">When are you staying?</h2><p class="muted">Select your check-in date, then your check-out date.</p><div id="b-cal" class="cal-host">${skel(1, 320)}</div>
<div class="b-guests"><div class="row"><div><b>Adults</b><small>Age 13 and over</small></div>${stepper('adults', B.adults, 1, 6, 'adults')}</div><div class="row"><div><b>Children</b><small>Age 12 and under</small></div>${stepper('children', B.children, 0, 5, 'children')}</div></div>
<div class="b-foot"><span class="muted" id="b-nights"></span><button class="btn gold" id="b-next">Show available rooms</button></div>`;
  const nights = () => { $('#b-nights').textContent = !dateProblem(B.ci, B.co) ? `${plural(diffDays(B.ci, B.co), 'night')} · ${guestsText(B.adults, B.children)}` : ''; };
  Cal.mount($('#b-cal'), { ci: B.ci, co: B.co, onChange: (ci, co) => { B.ci = ci; B.co = co; saveB(); nights(); drawSide(); } }); nights();
  $('#b-main').addEventListener('change', e => { if (e.target.name === 'adults') B.adults = +e.target.value; if (e.target.name === 'children') B.children = +e.target.value; saveB(); nights(); });
  $('#b-next').onclick = async () => {
    const p = dateProblem(B.ci, B.co); if (p) return toast(p, 'error');
    if (B.adults + B.children > 6) return toast('For groups larger than 6, please contact us directly.', 'error');
    setSearch({ ci: B.ci, co: B.co, adults: B.adults, children: B.children });
    const ok = await run(() => API.availability(B.ci, B.co), { btn: $('#b-next') }); if (!ok) return; B.counts = ok; B.typeId = null; await gotoStep(2);
  };
}

/* ----- step 2: rooms ----- */
async function stepRooms() {
  const main = $('#b-main'); const n = diffDays(B.ci, B.co); const g = B.adults + B.children;
  const list = STATE.roomTypes.filter(t => (B.counts[t.id] || 0) > 0 && t.capacity >= g);
  const tooSmall = STATE.roomTypes.filter(t => (B.counts[t.id] || 0) > 0 && t.capacity < g).length;
  main.innerHTML = `<h2 class="h-step">Choose your room</h2><p class="muted">${fmtDate(B.ci)} to ${fmtDate(B.co)} · ${plural(n, 'night')} · ${guestsText(B.adults, B.children)} <button class="link" data-goto="1">Change</button></p>
${list.length ? `<div class="b-rooms">${list.map(t => { const q = API.quote({ typeId: t.id, ci: B.ci, co: B.co, adults: B.adults, children: B.children, addons: {} }), c = B.counts[t.id]; return `<article class="b-room">${img(Art.room(t.slug, 0), t.name)}<div class="b-room-body"><div class="room-head"><h3>${t.name}</h3><p class="price"><b>${money(t.price)}</b><span>per night</span></p></div><p class="avail-line ${c <= 2 ? 'warn' : 'ok'}">${c <= 2 ? `Only ${c} left` : `${c} rooms available`}</p><ul class="facts"><li>${ic('users', 16)}Up to ${t.capacity} guests</li><li>${ic('bed', 16)}${t.beds}</li><li>${ic('ruler', 16)}${t.size} m²</li></ul><ul class="chips">${t.amenities.slice(0, 4).map(a => `<li>${a}</li>`).join('')}</ul><div class="b-room-foot"><p class="tot"><b>${money(q.total)}</b><small>total for ${plural(n, 'night')}, taxes and fees included</small></p><button class="btn gold" data-pick="${t.id}">Select room</button></div></div></article>`; }).join('')}</div>${tooSmall ? `<p class="muted small">${plural(tooSmall, 'room type')} hidden because ${tooSmall === 1 ? 'it doesn’t' : 'they don’t'} fit ${plural(g, 'guest')}.</p>` : ''}`
      : `<div class="empty"><p>${(Object.values(B.counts).some(v => v > 0)) ? 'None of the available rooms fit your group. Try fewer guests, or contact us for a larger arrangement.' : MSG.NO_ROOMS}</p><button class="btn gold" data-goto="1">Change dates</button></div>`}`;
  main.onclick = async e => { const b = e.target.closest('[data-pick]'); if (!b) return; B.typeId = +b.dataset.pick; await gotoStep(3); };
}

/* ----- step 3: guest ----- */
function stepGuest() {
  const t = typeOf(B.typeId), g = B.guest;
  $('#b-main').innerHTML = `<h2 class="h-step">Who’s staying?</h2><form id="b-guest" novalidate><div class="form-grid">${field({ name: 'first', label: 'First name', value: g.first, attrs: 'autocomplete="given-name" required' })}${field({ name: 'last', label: 'Last name', value: g.last, attrs: 'autocomplete="family-name" required' })}${field({ name: 'email', label: 'Email', type: 'email', value: g.email, attrs: 'autocomplete="email" inputmode="email" required', hint: 'We’ll send your confirmation here.' })}${field({ name: 'phone', label: 'Phone number', type: 'tel', value: g.phone, attrs: 'autocomplete="tel" inputmode="tel" required', hint: 'For example 0917 123 4567' })}</div>
<div class="b-guests"><div class="row"><div><b>Adults</b><small>${t.name} sleeps up to ${t.capacity}${B.adults > 2 ? ` · ${money(CONFIG.EXTRA_ADULT)} per extra adult per night` : ''}</small></div>${stepper('adults', B.adults, 1, t.capacity, 'adults')}</div><div class="row"><div><b>Children</b><small>Stay free using existing beds</small></div>${stepper('children', B.children, 0, Math.max(0, t.capacity - 1), 'children')}</div></div>
<div class="form-grid">${field({ name: 'arrival', label: 'Estimated arrival', tag: 'select', options: ARRIVALS, value: g.arrival || '2:00 PM' })}${field({ name: 'requests', label: 'Special requests', tag: 'textarea', value: g.requests, attrs: 'maxlength="500"', hint: 'Optional. We’ll do our best but can’t guarantee every request.', cls: 'full' })}</div>
<fieldset class="extras"><legend>Make it even better</legend>${STATE.addons.map(a => `<label class="extra"><input type="checkbox" name="addon_${a.id}" ${B.addons[a.id] ? 'checked' : ''}><span><b>${a.label}</b><small>${a.desc}</small></span></label>`).join('')}</fieldset>
<div class="b-foot"><button type="button" class="btn line" data-goto="2">Back</button><button class="btn gold" type="submit">Review your booking</button></div></form>`;
  const f = $('#b-guest');
  const sync = () => { const d = fdata(f); Object.assign(B.guest, { first: d.first || '', last: d.last || '', email: d.email || '', phone: d.phone || '', requests: d.requests || '', arrival: d.arrival }); B.adults = +d.adults; B.children = +d.children; B.addons = {}; STATE.addons.forEach(a => { if (f.elements['addon_' + a.id].checked) B.addons[a.id] = true; }); saveB(); drawSide(); };
  f.addEventListener('change', sync); f.addEventListener('input', () => { const d = fdata(f); Object.assign(B.guest, { first: d.first, last: d.last, email: d.email, phone: d.phone, requests: d.requests }); saveB(); });
  f.addEventListener('submit', async e => { e.preventDefault(); sync(); clearFieldErrors(f); const er = validateGuest(B.guest); if (Object.keys(er).length) { showFieldErrors(f, er); return toast(MSG.VALIDATION, 'error'); } await gotoStep(4); });
}

/* ----- step 4: summary ----- */
function stepSummary() {
  const t = typeOf(B.typeId), g = B.guest, q = bookQuote();
  $('#b-main').innerHTML = `<h2 class="h-step">Check your booking</h2>
<dl class="sum"><div><dt>Guest</dt><dd>${esc(g.first + ' ' + g.last)}<small>${esc(g.email)} · ${esc(g.phone)}</small></dd><button class="link" data-goto="3">Edit</button></div>
<div><dt>Room</dt><dd>${t.name}<small>${t.beds}</small></dd><button class="link" data-goto="2">Change</button></div>
<div><dt>Check-in</dt><dd>${fmtDate(B.ci)}<small>from ${CONFIG.CHECKIN}</small></dd><button class="link" data-goto="1">Change</button></div><div><dt>Check-out</dt><dd>${fmtDate(B.co)}<small>by ${CONFIG.CHECKOUT}</small></dd><span></span></div>
<div><dt>Guests</dt><dd>${guestsText(B.adults, B.children)}</dd><button class="link" data-goto="3">Edit</button></div>${g.requests ? `<div><dt>Special requests</dt><dd>${esc(g.requests)}</dd><span></span></div>` : ''}</dl>
<h3 class="h-sub">Price</h3><div class="calc big"><div class="calc-row"><span>${money(q.rate)} per night × ${plural(q.nights, 'night')}</span><b>${money(q.roomTotal)}</b></div>${q.lines.map(l => `<div class="calc-row"><span>${esc(l.label)}</span><b>${money(l.amount)}</b></div>`).join('')}<div class="calc-row"><span>Service charge</span><b>${money(q.service)}</b></div><div class="calc-row"><span>VAT</span><b>${money(q.vat)}</b></div><div class="calc-row total"><span>Total amount</span><b>${money(q.total)}</b></div></div>
<p class="policy">${ic('info', 16)}Free cancellation until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in. After that, the first night is charged. Check-in from ${CONFIG.CHECKIN}, check-out by ${CONFIG.CHECKOUT}.</p>
<div class="b-foot"><button class="btn line" data-goto="3">Back</button><button class="btn gold" data-goto="5">Continue to payment</button></div>`;
}

/* ----- step 5: payment ----- */
function availableMethods() {
  const m = [];
  if (CONFIG.PAYMENTS.online) { m.push(['card', { icon: 'card', note: 'Pay now to confirm instantly.' }]); m.push(['gcash', { icon: 'wallet', note: 'Approve in the GCash app. Confirms instantly.' }]); m.push(['maya', { icon: 'wallet', note: 'Approve in the Maya app. Confirms instantly.' }]); }
  if (CONFIG.PAYMENTS.bank) m.push(['bank', { icon: 'bank', note: 'Transfer within 24 hours. Your room is held meanwhile.' }]);
  if (CONFIG.PAYMENTS.hotel) m.push(['hotel', { icon: 'hotel', note: 'Pay when you arrive. Confirmed by our team.' }]);
  return m;
}
function payPanel(m, q) {
  if (m === 'card') return `<p class="hint-box">${ic('lock', 15)}<span>You’ll be taken to our payment provider’s secure checkout to enter your card details. Card numbers are never seen by this site.</span></p>`;
  if (m === 'gcash' || m === 'maya') return `<p class="hint-box">${ic('info', 15)}<span>You’ll be taken to ${m === 'gcash' ? 'GCash' : 'Maya'} to approve ${money(q.total)} securely.</span></p>`;
  if (m === 'bank') { const b = CONFIG.PAYMENTS.bank || {}; return `<div class="bank"><p>Transfer <b>${money(q.total)}</b> to the account below within 24 hours and use your reservation number as the reference. We’ll confirm once it clears.</p><dl>${b.bank_name ? `<div><dt>Bank</dt><dd>${esc(b.bank_name)}</dd></div>` : ''}${b.account_name ? `<div><dt>Account name</dt><dd>${esc(b.account_name)}</dd></div>` : ''}${b.account_number ? `<div><dt>Account number</dt><dd>${esc(b.account_number)}</dd></div>` : ''}</dl>${b.instructions ? `<p class="muted small">${esc(b.instructions)}</p>` : ''}</div>`; }
  return `<p>Reserve now and pay ${money(q.total)} at the front desk when you arrive. Your reservation will show as <b>Pending</b> until our team confirms it.</p>`;
}
function stepPayment() {
  const q = bookQuote(); const methods = availableMethods(); if (!methods.some(([k]) => k === B.method)) B.method = methods[0][0]; const m = B.method; const info = methods.find(([k]) => k === m)[1];
  $('#b-main').innerHTML = `<h2 class="h-step">Payment</h2>
<form id="b-pay" novalidate><div class="methods" role="radiogroup" aria-label="Payment method">${methods.map(([k, v]) => `<label class="method ${k === m ? 'on' : ''}"><input type="radio" name="method" value="${k}" ${k === m ? 'checked' : ''}><span class="m-ic">${ic(v.icon, 22)}</span><span><b>${PAY_METHODS[k]}</b><small>${v.note}</small></span></label>`).join('')}</div><div class="pay-panel" id="pay-panel">${payPanel(m, q)}</div><div class="alert bad" id="pay-err" hidden role="alert"></div>
<label class="check"><input type="checkbox" name="terms" required><span>I agree to the cancellation policy and hotel rules.</span></label><div class="b-foot"><button type="button" class="btn line" data-goto="4">Back</button><button class="btn gold" type="submit" id="pay-btn">${['card', 'gcash', 'maya'].includes(m) ? `Continue to pay ${money(q.total)}` : 'Confirm reservation'}</button></div></form>`;
  const f = $('#b-pay');
  f.addEventListener('change', e => { if (e.target.name === 'method') { B.method = e.target.value; saveB(); stepPayment(); } });
  f.addEventListener('submit', e => { e.preventDefault(); submitBooking(f, q); });
}
async function submitBooking(f, q) {
  const btn = $('#pay-btn'), errBox = $('#pay-err'); errBox.hidden = true; clearFieldErrors(f);
  const d = fdata(f); if (!d.terms) { errBox.textContent = 'Please accept the cancellation policy to continue.'; errBox.hidden = false; return; }
  const out = await run(() => API.createReservation({ ci: B.ci, co: B.co, typeId: B.typeId, adults: B.adults, children: B.children, addons: B.addons, guest: B.guest, payment: { method: B.method } }), {
    btn, form: f,
    onError: e => {
      if (!(e && e.friendly)) return false;
      if (e.fields) { showFieldErrors(f, e.fields); toast(e.message, 'error'); return true; }
      errBox.textContent = e.message; errBox.hidden = false; errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (e.code === 'ROOM_UNAVAILABLE' || e.code === 'NO_ROOMS') setTimeout(() => gotoStep(2), 1600);
      return true;
    }
  });
  if (!out) return;
  Recall.add(out.reservation.number, B.guest.email);
  store.del(bookKey); const no = out.reservation.number; B = null;
  if (out.redirect_url) { toast('Redirecting you to complete payment…', 'info', 2500); location.href = out.redirect_url; return; }
  go('/confirmation/' + no);
}

/* ---------- reservation view (shared by confirmation and manage) ---------- */
function timeline(r) {
  if (r.status === 'Cancelled' || r.status === 'No Show') return `<div class="alert bad">${ic('alert', 18)}<span>This reservation is <b>${r.status === 'No Show' ? 'marked as a no-show' : 'cancelled'}</b>.${r.payment_status === 'Refund Pending' ? ' Your refund is being processed.' : ''}</span></div>`;
  const order = ['Pending', 'Confirmed', 'Checked In', 'Checked Out']; const at = order.indexOf(r.status);
  return `<ol class="tl" aria-label="Reservation progress">${order.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i < at ? ic('check', 14) : ''}</i><span>${s}</span></li>`).join('')}</ol>`;
}
function resDetails(r) {
  return `<dl class="sum"><div><dt>Guest</dt><dd>${esc(fullName(r.guest))}<small>${esc(r.guest.email)} · ${esc(r.guest.phone)}</small></dd></div><div><dt>Room</dt><dd>${esc(r.type.name)}</dd></div><div><dt>Check-in</dt><dd>${fmtDate(r.check_in)}<small>from ${CONFIG.CHECKIN}</small></dd></div><div><dt>Check-out</dt><dd>${fmtDate(r.check_out)}<small>by ${CONFIG.CHECKOUT}</small></dd></div><div><dt>Nights</dt><dd>${r.nights}</dd></div><div><dt>Guests</dt><dd>${guestsText(r.adults, r.children)}</dd></div>${r.arrival_time ? `<div><dt>Estimated arrival</dt><dd>${esc(r.arrival_time)}</dd></div>` : ''}<div><dt>Special requests</dt><dd>${r.special_requests ? esc(r.special_requests) : '<span class="muted">None</span>'}</dd></div><div><dt>Total amount</dt><dd><b>${money(r.total)}</b>${r.paid_amount ? `<small>${money(r.paid_amount)} paid</small>` : ''}</dd></div><div><dt>Payment</dt><dd>${payPill(r.payment_status)}<small>${esc(PAY_METHODS[r.payment_method] || '')}</small></dd></div><div><dt>Status</dt><dd>${resPill(r.status)}</dd></div></dl>`;
}
function bindResActions(root, r, email, refresh) {
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-ra]'); if (!b) return;
    if (b.dataset.ra === 'download') downloadConfirmation(r);
    if (b.dataset.ra === 'print') printConfirmation(r);
    if (b.dataset.ra === 'modify') openModifyRequest(r, email, refresh);
    if (b.dataset.ra === 'cancel') openCancelRequest(r, email, refresh);
    if (b.dataset.ra === 'paynow') { const out = await run(() => API.payOnline(r.number, email), { btn: b }); if (out && out.redirect_url) { toast('Redirecting to payment…', 'info', 2000); location.href = out.redirect_url; } }
  });
}
function openModifyRequest(r, email, refresh) {
  const m = openModal({ title: 'Request a change', body: `<form id="mod-form" novalidate><p class="muted">Tell us the new dates or guest numbers. We’ll check availability and reply by email. Your booking stays as it is until we confirm.</p><div class="form-grid">${field({ name: 'ci', label: 'New check-in', type: 'date', value: r.check_in, attrs: `min="${todayISO()}"` })}${field({ name: 'co', label: 'New check-out', type: 'date', value: r.check_out, attrs: `min="${addDays(todayISO(), 1)}"` })}<div class="field"><label>Adults</label>${stepper('adults', r.adults, 1, 6, 'adults')}</div><div class="field"><label>Children</label>${stepper('children', r.children, 0, 5, 'children')}</div>${field({ name: 'note', label: 'Anything else?', tag: 'textarea', attrs: 'maxlength="500"', cls: 'full' })}</div><div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">Send request</button></div></form>` });
  $('#mod-form', m.el).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, d = fdata(f); const p = dateProblem(d.ci, d.co); if (p) return toast(p, 'error');
    const out = await run(() => API.requestChange(r.number, email, { type: 'modify', ci: d.ci, co: d.co, adults: +d.adults, children: +d.children, note: d.note }), { btn: $('[type=submit]', f) });
    if (out) { m.close(); toast('Request sent. We’ll reply by email.'); refresh(out); }
  });
}
function openCancelRequest(r, email, refresh) {
  const free = new Date(r.free_cancel_until) > new Date();
  const m = openModal({ title: 'Request a cancellation', body: `<form id="can-form" novalidate><div class="alert ${free ? 'ok' : 'warn'}">${ic(free ? 'check' : 'alert', 18)}<span>${free ? `Free cancellation applies until ${fmtDT(r.free_cancel_until)}. ${r.paid_amount > 0 ? 'Any payment will be refunded in 5 to 10 business days.' : ''}` : `The free cancellation period ended on ${fmtDT(r.free_cancel_until)}. The first night may be charged.`}</span></div>${field({ name: 'reason', label: 'Reason', tag: 'select', options: ['Change of plans', 'Found a different option', 'Travel restrictions', 'Illness', 'Other'] })}${field({ name: 'note', label: 'Anything to add?', tag: 'textarea', attrs: 'maxlength="500"' })}<div class="dlg-actions"><button type="button" class="btn line" data-close>Keep my stay</button><button class="btn danger" type="submit">Request cancellation</button></div></form>` });
  $('#can-form', m.el).addEventListener('submit', async e => {
    e.preventDefault(); const d = fdata(e.target);
    const out = await run(() => API.requestChange(r.number, email, { type: 'cancel', reason: d.reason, note: d.note }), { btn: $('[type=submit]', e.target) });
    if (out) { m.close(); toast('Cancellation requested. We’ll confirm by email.'); refresh(out); }
  });
}
function reqList(r) {
  if (!r.requests.length) return '';
  return `<h3 class="h-sub">Your requests</h3><ul class="reqs">${r.requests.map(q => `<li>${ic(q.type === 'cancel' ? 'close' : 'edit', 16)}<span>${q.type === 'cancel' ? 'Cancellation' : 'Change'} requested on ${fmtDT(q.created_at)}</span>${pill(q.status, q.status === 'Approved' ? 'ok' : q.status === 'Declined' ? 'bad' : 'warn')}</li>`).join('')}</ul>`;
}

/* ---------- confirmation ---------- */
async function confirmationRoute(no) {
  no = (no || '').toUpperCase(); const email = Recall.get(no);
  $('#app').innerHTML = siteShell(`<section class="section page-pad conf"><div class="wrap narrow">${skel(3, 140)}</div></section>`, { solid: true });
  if (!email) { toast('For your privacy, enter your reservation number and email to view this booking.', 'info'); return go('/manage?ref=' + encodeURIComponent(no)); }
  let r; try { r = await API.lookup(no, email); } catch (e) { toast(e.friendly ? e.message : MSG.SERVER, 'error'); return go('/manage?ref=' + encodeURIComponent(no)); }
  const pend = r.status === 'Pending';
  $('#main').innerHTML = `<section class="section page-pad conf"><div class="wrap narrow"><div class="conf-head"><span class="tick" aria-hidden="true">${ic('check', 34)}</span><h1 class="h-page">${pend ? 'Reservation received' : 'Reservation confirmed'}</h1><p class="lead">${pend ? 'Your room is held. We’ll confirm it as soon as your payment is verified.' : 'Thank you, ' + esc(r.guest.first) + '. We’re looking forward to welcoming you.'}</p></div>
<div class="conf-card"><p class="conf-no"><small>Reservation number</small><b>${esc(r.number)}</b></p>${timeline(r)}${resDetails(r)}</div>
<p class="alert info">${ic('mail', 18)}<span>A confirmation email has been sent to <b>${esc(r.guest.email)}</b>.</span></p>
<div class="conf-actions">${r.can_pay_online ? `<button class="btn gold" data-ra="paynow">${ic('card', 18)}Complete payment</button>` : ''}<a class="btn ${r.can_pay_online ? 'line' : 'gold'}" href="#/manage?ref=${encodeURIComponent(r.number)}">View Reservation</a><button class="btn line" data-ra="download">${ic('download', 18)}Download Confirmation</button><button class="btn line" data-ra="print">${ic('print', 18)}Print Confirmation</button><a class="btn line" href="#/">Return to Home</a></div></div></section>`;
  bindResActions($('#main'), r, email, () => confirmationRoute(no));
  observe($('#main'));
}

/* ---------- manage reservation ---------- */
async function manageRoute(q) {
  const ref = (q.get('ref') || '').toUpperCase();
  $('#app').innerHTML = siteShell(`<section class="section page-pad manage"><div class="wrap narrow"><h1 class="h-page">Manage my reservation</h1><p class="lead">Enter your reservation number and the email address you booked with.</p>
<form class="lookup" id="lookup" novalidate>${field({ name: 'no', label: 'Reservation number', value: ref, attrs: 'placeholder="LUME-2026-00001" autocapitalize="characters" autocomplete="off" required' })}${field({ name: 'email', label: 'Email address', type: 'email', value: Recall.get(ref), attrs: 'autocomplete="email" inputmode="email" required' })}<button class="btn gold" type="submit">Find my reservation</button></form><div id="manage-result"></div></div></section>`, { solid: true });
  const f = $('#lookup');
  const show = async (no, email) => {
    const r = await run(() => API.lookup(no, email), { btn: $('[type=submit]', f) });
    if (!r) { $('#manage-result').innerHTML = ''; return; }
    Recall.add(no, email);
    const draw = rr => {
      $('#manage-result').innerHTML = `<div class="conf-card enter"><p class="conf-no"><small>Reservation number</small><b>${esc(rr.number)}</b></p>${timeline(rr)}${resDetails(rr)}${reqList(rr)}${rr.lines.length ? `<h3 class="h-sub">Price</h3><div class="calc"><div class="calc-row"><span>${money(rr.price_per_night)} × ${plural(rr.nights, 'night')}</span><b>${money(rr.pricing.roomTotal)}</b></div>${rr.lines.map(l => `<div class="calc-row"><span>${esc(l.label)}</span><b>${money(l.amount)}</b></div>`).join('')}<div class="calc-row"><span>Service charge</span><b>${money(rr.pricing.service)}</b></div><div class="calc-row"><span>VAT</span><b>${money(rr.pricing.vat)}</b></div><div class="calc-row total"><span>Total</span><b>${money(rr.total)}</b></div></div>` : ''}
<div class="conf-actions">${rr.can_pay_online ? `<button class="btn gold" data-ra="paynow">${ic('card', 18)}Complete payment</button>` : ''}${rr.can_change ? `<button class="btn line" data-ra="modify">${ic('edit', 18)}Request modification</button><button class="btn line" data-ra="cancel">${ic('close', 18)}Request cancellation</button>` : ''}<button class="btn line" data-ra="download">${ic('download', 18)}Download Confirmation</button><button class="btn line" data-ra="print">${ic('print', 18)}Print</button><a class="btn line" href="mailto:${esc(H().email)}?subject=${encodeURIComponent('Reservation ' + rr.number)}">${ic('mail', 18)}Contact hotel</a></div><p class="muted small">Changes to dates, guests or payment are reviewed by our team, so nothing changes until we confirm it by email.</p></div>`;
      bindResActions($('#manage-result'), rr, email, draw);
    };
    draw(r); $('#manage-result').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  f.addEventListener('submit', e => { e.preventDefault(); clearFieldErrors(f); const d = fdata(f); const er = {}; if (!d.no) er.no = 'Enter your reservation number.'; if (!d.email) er.email = 'Enter your email address.'; if (Object.keys(er).length) return showFieldErrors(f, er); show(d.no.toUpperCase(), d.email); });
  if (ref && Recall.get(ref)) show(ref, Recall.get(ref));
}
