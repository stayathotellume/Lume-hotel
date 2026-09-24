'use strict';
/* ==========================================================================
   Staff console (part B)
   ========================================================================== */

/* ---------- calendar (room timeline) ---------- */
const stCls = s => 'st-' + s.toLowerCase().replace(/\s+/g, '-');
SP.calendar = async () => {
  const T = todayISO(); if (!SF.cal.from) SF.cal.from = addDays(T, -2);
  const { from, days } = SF.cal; const to = addDays(from, days); const data = await API.staff.calendar(from, days);
  if (!data.rooms.length) { $('#s-body').innerHTML = `<div class="empty"><p>No rooms yet. Add rooms to see the timeline.</p><a class="btn gold" href="#/staff/rooms">Go to Rooms</a></div>`; return; }
  const dayCells = Array.from({ length: days }, (_, i) => addDays(from, i));
  const head = `<div class="g-row g-head" style="--days:${days}"><div class="g-corner" style="grid-column:1;grid-row:1">Room</div>${dayCells.map((d, i) => { const dt = parseISO(d); return `<div class="g-day ${d === T ? 'today' : ''} ${[0, 6].includes(dt.getDay()) ? 'we' : ''}" style="grid-column:${i + 2};grid-row:1"><small>${dt.toLocaleDateString('en-PH', { weekday: 'short' })}</small><b>${dt.getDate()}</b>${dt.getDate() === 1 || i === 0 ? `<small class="mo">${dt.toLocaleDateString('en-PH', { month: 'short' })}</small>` : ''}</div>`; }).join('')}</div>`;
  let rows = ''; let lastType = null;
  data.rooms.forEach(rm => {
    if (rm.type.id !== lastType) { lastType = rm.type.id; rows += `<div class="g-type">${esc(rm.type.name)}</div>`; }
    const cells = dayCells.map((d, i) => `<span class="g-cell ${d === T ? 'today' : ''} ${[0, 6].includes(parseISO(d).getDay()) ? 'we' : ''}" style="grid-column:${i + 2};grid-row:1"></span>`).join('');
    const maint = ['Maintenance', 'Out of Order'].includes(rm.status) ? `<div class="g-bar st-maint" style="grid-column:2 / ${days + 2};grid-row:1" title="Room ${esc(rm.number)}: ${rm.status}">${rm.status}${rm.notes ? ': ' + esc(rm.notes) : ''}</div>` : '';
    const bars = data.res.filter(r => r.room_id === rm.id).map(r => {
      const s = r.check_in < from ? from : r.check_in, e = r.check_out > to ? to : r.check_out; const c1 = diffDays(from, s) + 2, c2 = diffDays(from, e) + 2; if (c2 <= c1) return '';
      return `<button class="g-bar ${stCls(r.status)}" style="grid-column:${c1} / ${c2};grid-row:1" data-open="${r.id}" title="${esc(fullName(r.guest))} · ${esc(r.number)} · ${esc(r.status)} · ${fmtShort(r.check_in)} to ${fmtShort(r.check_out)}">${esc(r.guest.last)}<small>${r.nights}n</small></button>`;
    }).join('');
    rows += `<div class="g-row" style="--days:${days}"><div class="g-label" style="grid-column:1;grid-row:1"><b>${esc(rm.number)}</b></div>${cells}${maint}${bars}</div>`;
  });
  const legend = [['st-pending', 'Pending'], ['st-confirmed', 'Confirmed'], ['st-checked-in', 'Checked in'], ['st-checked-out', 'Checked out'], ['st-maint', 'Maintenance / out of order']].map(([c, l]) => `<span class="lgi"><i class="${c}"></i>${l}</span>`).join('');
  $('#s-body').innerHTML = `<div class="cal-tools"><div class="btn-group"><button class="btn sm line" data-cal="-7" aria-label="Previous week">${ic('left', 16)}</button><button class="btn sm line" data-cal="today">Today</button><button class="btn sm line" data-cal="7" aria-label="Next week">${ic('right', 16)}</button></div><p class="range"><b>${fmtShort(from)} to ${fmtShort(addDays(to, -1))}</b></p><div class="field inline"><label for="cal-days" class="sr">Days shown</label><select id="cal-days">${[14, 21, 30].map(n => `<option ${n === days ? 'selected' : ''} value="${n}">${n} days</option>`).join('')}</select></div></div><div class="legend">${legend}</div>
<div class="gantt-wrap" tabindex="0" aria-label="Room timeline. Scroll sideways to see more days."><div class="gantt" style="--days:${days}">${head}${rows}</div></div><p class="muted small">Select a booking to see its details. Each bar covers the nights of the stay.</p>`;
  const b = $('#s-body'); b.onclick = e => {
    const c = e.target.closest('[data-cal]'); if (!c) return; const v = c.dataset.cal; SF.cal.from = v === 'today' ? addDays(todayISO(), -2) : addDays(SF.cal.from, +v); loadStaffPage(true);
  };
  $('#cal-days').onchange = e => { SF.cal.days = +e.target.value; loadStaffPage(true); };
};

/* ---------- front desk ---------- */
SP.frontdesk = async () => {
  const [d, rr] = await Promise.all([API.staff.dashboard(), API.staff.rooms()]); const T = todayISO();
  const card = (r, kind) => {
    const bal = r2(r.total - (r.paid_amount || 0)); const na = nextActions(r)[0];
    return `<article class="fd-card"><div class="fd-top"><b>${esc(fullName(r.guest))}</b>${resPill(r.status)}</div><dl><div><dt>Reservation</dt><dd>${esc(r.number)}</dd></div><div><dt>Room</dt><dd>${esc(r.room.number)} <small class="muted">${esc(r.type.name)}</small></dd></div>${kind === 'arr' ? `<div><dt>Arrival</dt><dd>${esc(r.arrival_time || 'Not given')}</dd></div>` : `<div><dt>Leaves</dt><dd>${r.check_out < T ? pill('Overdue', 'bad') : fmtShort(r.check_out)}</dd></div>`}<div><dt>Payment</dt><dd>${payPill(r.payment_status)}${bal > 0 ? `<small class="muted"> ${money(bal)} due</small>` : ''}</dd></div>${r.special_requests ? `<div class="full"><dt>Requests</dt><dd>${esc(r.special_requests)}</dd></div>` : ''}</dl><div class="fd-btns">${na ? `<button class="btn gold" data-do="${na[0]}" data-id="${r.id}">${na[1]}</button>` : ''}<button class="btn line" data-open="${r.id}">Open</button></div></article>`;
  };
  if (!rr.rooms.length) { $('#s-body').innerHTML = `<div class="empty"><p>No rooms yet. Add rooms to use the front desk view.</p><a class="btn gold" href="#/staff/rooms">Go to Rooms</a></div>`; return; }
  const stats = {}; rr.rooms.forEach(r => stats[r.display] = (stats[r.display] || 0) + 1);
  $('#s-body').innerHTML = `<section class="fd-sec"><h2>Arrivals today <small>${d.arrivals.length}</small></h2>${d.arrivals.length ? `<div class="fd-grid">${d.arrivals.map(r => card(r, 'arr')).join('')}</div>` : '<p class="muted">No arrivals today.</p>'}</section>
<section class="fd-sec"><h2>Departures today <small>${d.departures.length}</small></h2>${d.departures.length ? `<div class="fd-grid">${d.departures.map(r => card(r, 'dep')).join('')}</div>` : '<p class="muted">No departures today.</p>'}</section>
<section class="fd-sec"><h2>Current guests <small>${d.inhouse.length}</small></h2>${d.inhouse.length ? `<ul class="rlist wide">${d.inhouse.map(r => resRow(r, `<span class="muted small">Leaves ${fmtShort(r.check_out)}</span>`)).join('')}</ul>` : '<p class="muted">No guests in house.</p>'}</section>
<section class="fd-sec"><h2>Room status</h2><div class="legend">${ROOM_STATUS.map(s => `<span class="lgi">${roomPill(s)} ${stats[s] || 0}</span>`).join('')}</div><div class="rboard">${rr.rooms.map(r => `<div class="rchip rs-${r.display.toLowerCase().replace(/\s+/g, '-')}" title="Room ${esc(r.number)}: ${r.display}${r.current ? ' · ' + esc(r.current.guest) : ''}"><b>${esc(r.number)}</b><small>${r.display}</small></div>`).join('')}</div></section>`;
  $('#s-body').onclick = e => { const b = e.target.closest('[data-do]'); if (b) staffAct(+b.dataset.id, b.dataset.do); };
};

/* ---------- rooms ---------- */
SP.rooms = async () => {
  const { rooms, types } = await API.staff.rooms(); const admin = can(SF.user.role, 'rooms.manage'); const canSet = can(SF.user.role, 'housekeeping');
  $('#s-body').innerHTML = `<div class="bar-head"><h2>Room inventory</h2>${admin ? `<button class="btn gold" id="add-room" ${types.length ? '' : 'disabled'}>${ic('plus', 18)}Add room</button>` : ''}</div>
${rooms.length ? `<div class="table-wrap"><table class="rtable"><thead><tr><th>Room</th><th>Type</th><th>Price per night</th><th>Capacity</th><th>Status</th><th>Housekeeping</th><th>Guest</th><th>Notes</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${rooms.map(r => `<tr><td data-label="Room"><b>${esc(r.number)}</b></td><td data-label="Type">${esc(r.type.name)}</td><td data-label="Price">${money(r.type.price)}</td><td data-label="Capacity">${r.type.capacity}</td><td data-label="Status">${roomPill(r.display)}</td><td data-label="Housekeeping">${pill(r.hk, PILL.hk[r.hk])}</td><td data-label="Guest">${r.current ? `${esc(r.current.guest)}<small class="muted"> until ${fmtShort(r.current.out)}</small>` : r.next ? `<small class="muted">Next: ${esc(r.next.guest)}, ${fmtShort(r.next.in)}</small>` : '<span class="muted">None</span>'}</td><td data-label="Notes">${esc(r.notes || '')}</td><td class="acts">${canSet ? `<button class="btn sm line" data-status="${r.id}">Set status</button>` : ''}${admin ? `<button class="icon-btn" data-edit="${r.id}" aria-label="Edit room ${esc(r.number)}">${ic('edit', 18)}</button><button class="icon-btn" data-del="${r.id}" aria-label="Delete room ${esc(r.number)}">${ic('trash', 18)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><p>No rooms yet.${types.length ? ' Add your first room.' : ' Add a room type below first.'}</p></div>`}
<div class="bar-head"><h2>Room types and rates</h2>${admin ? `<button class="btn line" id="add-type">${ic('plus', 18)}Add room type</button>` : ''}</div><div class="type-grid">${types.map(t => `<article class="type-card">${img(Art.room(t.slug, 0), t.name)}<div><h3>${t.name} ${t.active === false ? pill('Inactive', 'mute') : ''}</h3><p class="price"><b>${money(t.price)}</b><span>per night</span></p><p class="muted small">Up to ${t.capacity} guests · ${t.beds} · ${t.size} m²</p><p class="small">${t.amenities.slice(0, 6).join(', ')}${t.amenities.length > 6 ? '…' : ''}</p>${admin ? `<button class="btn sm line" data-type="${t.id}">Edit rate and details</button>` : ''}</div></article>`).join('')}</div>`;
  const byId = id => rooms.find(r => r.id === id);
  if (admin) { $('#add-room').onclick = () => roomForm(null, types); $('#add-type').onclick = () => typeForm(null); }
  $('#s-body').onclick = async e => {
    const st = e.target.closest('[data-status]'), ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]'), ty = e.target.closest('[data-type]');
    if (st) { const r = byId(+st.dataset.status); return openMenu(st, ['Available', 'Cleaning', 'Maintenance', 'Out of Order'].map(s => ({ label: s + (s === r.status ? ' (current)' : ''), disabled: s === r.status, run: async () => { const o = await run(() => API.staff.setRoomStatus(r.id, s, 'Set from Rooms')); if (o) { toast(`Room ${r.number} is now ${s}.`); loadStaffPage(true); } } }))); }
    if (ed) return roomForm(byId(+ed.dataset.edit), types);
    if (dl) { const r = byId(+dl.dataset.del); if (await confirmBox({ title: `Delete room ${r.number}?`, message: 'This removes the room from your inventory. Rooms with booking history can’t be deleted.', confirmText: 'Delete room', danger: true })) { const o = await run(() => API.staff.deleteRoom(r.id), { ok: `Room ${r.number} deleted.` }); if (o) loadStaffPage(true); } return; }
    if (ty) return typeForm(types.find(t => t.id === +ty.dataset.type));
  };
};
function roomForm(r, types) {
  const m = openModal({ title: r ? `Edit room ${r.number}` : 'Add room', size: 'sm', body: `<form id="room-form" novalidate>${field({ name: 'number', label: 'Room number', value: r ? r.number : '', attrs: 'required maxlength="8"' })}${field({ name: 'type_id', label: 'Room type', tag: 'select', options: types.map(t => [t.id, `${t.name} · ${money(t.price)}`]), value: r ? r.type_id : (types[0] || {}).id })}${field({ name: 'notes', label: 'Notes', value: r ? r.notes : '', attrs: 'maxlength="200"' })}<div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">${r ? 'Save room' : 'Add room'}</button></div></form>` });
  $('#room-form', m.el).addEventListener('submit', async e => { e.preventDefault(); const f = e.target; clearFieldErrors(f); const d = fdata(f); const o = await run(() => API.staff.saveRoom({ id: r ? r.id : undefined, number: d.number, type_id: d.type_id, notes: d.notes }), { btn: $('[type=submit]', f), form: f, ok: r ? 'Room saved.' : 'Room added.' }); if (o) { m.close(); loadStaffPage(true); } });
}
function typeForm(t) {
  const isNew = !t;
  const m = openModal({ title: isNew ? 'Add room type' : `Edit ${t.name}`, size: 'lg', body: `<form id="type-form" novalidate><div class="form-grid">${field({ name: 'name', label: 'Room type name', value: t ? t.name : '', attrs: 'required' })}${field({ name: 'price', label: 'Price per night (₱)', type: 'number', value: t ? t.price : 100000, attrs: 'min="1000" max="2000000" step="500"' })}${field({ name: 'capacity', label: 'Maximum guests', type: 'number', value: t ? t.capacity : 2, attrs: 'min="1" max="12"' })}${field({ name: 'beds', label: 'Bed configuration', value: t ? t.beds : '1 King bed' })}${field({ name: 'size', label: 'Size (m²)', type: 'number', value: t ? t.size : 40, attrs: 'min="10"' })}${field({ name: 'view', label: 'View', value: t ? t.view : 'Garden view' })}${field({ name: 'short', label: 'Short description', value: t ? t.short : '', cls: 'full' })}${field({ name: 'description', label: 'Full description', tag: 'textarea', value: t ? t.description : '', cls: 'full' })}${field({ name: 'amenities', label: 'Amenities', tag: 'textarea', value: t ? t.amenities.join(', ') : '', hint: 'Separate with commas', cls: 'full' })}</div>${!isNew ? `<label class="check"><input type="checkbox" name="active" ${t.active !== false ? 'checked' : ''}><span>Show this room type on the website</span></label>` : ''}<p class="hint-box">${ic('info', 15)}<span>Rate changes apply to new bookings. Existing reservations keep the price they were booked at.</span></p><div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">${isNew ? 'Add room type' : 'Save changes'}</button></div></form>` });
  $('#type-form', m.el).addEventListener('submit', async e => { e.preventDefault(); const f = e.target; clearFieldErrors(f); const d = fdata(f); const o = await run(() => API.staff.saveType({ id: t ? t.id : undefined, name: d.name, price: d.price, capacity: d.capacity, beds: d.beds, size: d.size, view: d.view, short: d.short, description: d.description, amenities: d.amenities, active: !isNew ? !!f.elements.active.checked : true }), { btn: $('[type=submit]', f), form: f, ok: isNew ? 'Room type added.' : 'Room type saved.' }); if (o) { m.close(); STATE.roomTypes = []; loadStaffPage(true); } });
}

/* ---------- housekeeping ---------- */
SP.housekeeping = async () => {
  const { rooms } = await API.staff.rooms(); if (!rooms.length) { $('#s-body').innerHTML = `<div class="empty"><p>No rooms yet.</p></div>`; return; } const cols = [['Dirty', 'Needs cleaning'], ['Cleaning', 'Being cleaned'], ['Clean', 'Ready'], ['Maintenance', 'Maintenance']];
  const btns = r => {
    if (r.hk === 'Dirty') return `<button class="btn sm gold" data-hk="start" data-id="${r.id}">Start cleaning</button>`;
    if (r.hk === 'Cleaning') return `<button class="btn sm gold" data-hk="clean" data-id="${r.id}">Mark clean</button>`;
    if (r.hk === 'Maintenance') return `<button class="btn sm gold" data-hk="restore" data-id="${r.id}">Back in service</button>`;
    return r.status === 'Occupied' ? '<span class="muted small">Guest in room</span>' : `<button class="btn sm line" data-hk="dirty" data-id="${r.id}">Mark dirty</button><button class="btn sm line" data-hk="issue" data-id="${r.id}">Report issue</button>`;
  };
  $('#s-body').innerHTML = `<p class="muted">Checked-out rooms move from <b>Dirty</b> to <b>Cleaning</b> to <b>Clean</b>. Marking a room clean makes it available again.</p><div class="hk-cols">${cols.map(([k, sub]) => { const list = rooms.filter(r => r.hk === k); return `<section class="hk-col hk-${k.toLowerCase()}"><h2>${k} <small>${list.length}</small></h2><p class="muted small">${sub}</p>${list.length ? list.map(r => `<article class="hk-card"><div><b>${esc(r.number)}</b><small>${esc(r.type.name)}</small>${r.notes ? `<small class="note">${esc(r.notes)}</small>` : ''}</div><div class="hk-btns">${btns(r)}</div></article>`).join('') : '<p class="muted small">None</p>'}</section>`; }).join('')}</div>`;
  $('#s-body').onclick = async e => {
    const b = e.target.closest('[data-hk]'); if (!b) return; const id = +b.dataset.id, step = b.dataset.hk; const r = rooms.find(x => x.id === id);
    if (step === 'issue') { const m = openModal({ title: `Report an issue in room ${r.number}`, size: 'sm', body: `<form id="issue-form">${field({ name: 'why', label: 'What’s wrong?', tag: 'textarea', attrs: 'required' })}<p class="hint-box">${ic('info', 15)}<span>The room is taken out of service until maintenance marks it back in service.</span></p><div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">Report issue</button></div></form>` }); $('#issue-form', m.el).addEventListener('submit', async ev => { ev.preventDefault(); const d = fdata(ev.target); const o = await run(() => API.staff.setRoomStatus(id, 'Maintenance', d.why || 'Reported by housekeeping'), { btn: $('[type=submit]', ev.target) }); if (o) { m.close(); toast(`Room ${r.number} is out of service.`); loadStaffPage(true); } }); return; }
    const msg = { start: `Room ${r.number}: cleaning started.`, clean: `Room ${r.number} is clean and available.`, dirty: `Room ${r.number} marked dirty.`, restore: `Room ${r.number} is back in service and needs cleaning.` }[step];
    const o = await run(() => API.staff.housekeeping(id, step), { btn: b, ok: msg }); if (o) loadStaffPage(true);
  };
};

/* ---------- analytics ---------- */
function anaRange() {
  const T = todayISO(), r = SF.ana.range;
  if (r === 'today') return [T, T];
  if (r === 'week') { const dow = (parseISO(T).getDay() + 6) % 7, mon = addDays(T, -dow); return [mon, addDays(mon, 6)]; }
  if (r === 'month') { const d = parseISO(T); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
  return [SF.ana.from || addDays(T, -29), SF.ana.to || T];
}
const compact = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
const niceMax = v => { if (v <= 0) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; const c = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 12].find(x => x >= n) || 12; return c * p; };
function chartFrame(w, h, inner, ymax, fmt) { const L = 46, B = 24; let g = ''; for (let i = 0; i <= 4; i++) { const y = 10 + (h - B - 10) * (1 - i / 4); g += `<line x1="${L}" x2="${w - 6}" y1="${y}" y2="${y}" class="gl"/><text x="${L - 8}" y="${y + 4}" text-anchor="end" class="gt">${fmt(ymax * i / 4)}</text>`; } return g + inner; }
function barChart(series, fmt) {
  const w = Math.max(560, series.length * 26), h = 230, L = 46, B = 24, max = niceMax(Math.max(...series.map(s => s.v), 0)); const slot = (w - L - 6) / series.length, bw = Math.min(28, slot * .64); const every = Math.ceil(series.length / 12);
  const bars = series.map((s, i) => { const bh = (h - B - 10) * s.v / max, x = L + slot * i + (slot - bw) / 2; return `<rect x="${x}" y="${h - B - bh}" width="${bw}" height="${Math.max(bh, s.v ? 2 : 0)}" rx="3" class="bar"><title>${fmtShort(s.d)}: ${fmt(s.v)}</title></rect>${i % every === 0 ? `<text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" class="gt">${parseISO(s.d).getDate()}</text>` : ''}`; }).join('');
  return `<div class="chart-scroll"><svg viewBox="0 0 ${w} ${h}" style="min-width:${w}px" role="img" aria-label="Bar chart">${chartFrame(w, h, bars, max, fmt)}</svg></div>`;
}
function lineChart(series, fmt) {
  const w = Math.max(560, series.length * 26), h = 230, L = 46, B = 24, max = niceMax(Math.max(...series.map(s => s.v), 1)); const slot = (w - L - 6) / Math.max(series.length, 1); const every = Math.ceil(series.length / 12);
  const pts = series.map((s, i) => [L + slot * i + slot / 2, h - B - (h - B - 10) * s.v / max]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''); const area = pts.length ? line + `L${pts[pts.length - 1][0]} ${h - B}L${pts[0][0]} ${h - B}Z` : '';
  const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" class="dot"><title>${fmtShort(series[i].d)}: ${fmt(series[i].v)}</title></circle>${i % every === 0 ? `<text x="${p[0]}" y="${h - 6}" text-anchor="middle" class="gt">${parseISO(series[i].d).getDate()}</text>` : ''}`).join('');
  return `<div class="chart-scroll"><svg viewBox="0 0 ${w} ${h}" style="min-width:${w}px" role="img" aria-label="Line chart">${chartFrame(w, h, `<path d="${area}" class="area"/><path d="${line}" class="ln"/>${dots}`, max, fmt)}</svg></div>`;
}
function donut(items) {
  const total = items.reduce((n, i) => n + i.value, 0) || 1; const colors = ['#C9974F', '#4A2E19', '#2F6B5A', '#7A9BB0']; let acc = 0; const R = 54, C = 2 * Math.PI * R;
  const segs = items.map((it, i) => { const len = C * it.value / total; const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${colors[i % 4]}" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"><title>${esc(it.name)}: ${it.value}</title></circle>`; acc += len; return s; }).join('');
  return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Reservations by room type"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--line)" stroke-width="20"/>${segs}<text x="70" y="68" text-anchor="middle" class="dn-n">${items.reduce((n, i) => n + i.value, 0)}</text><text x="70" y="86" text-anchor="middle" class="gt">bookings</text></svg><ul>${items.map((it, i) => `<li><i style="background:${colors[i % 4]}"></i>${esc(it.name)}<b>${it.value}</b></li>`).join('')}</ul></div>`;
}
SP.analytics = async () => {
  const [from, to] = anaRange(); const [a, rr] = await Promise.all([API.staff.analytics(from, to), API.staff.rooms()]); const cap = Math.max(1, rr.rooms.length);
  const tab = (k, l) => `<button class="tabb ${SF.ana.range === k ? 'on' : ''}" data-range="${k}" aria-pressed="${SF.ana.range === k}">${l}</button>`;
  const tile = (label, txt, icon) => `<div class="kpi"><span class="k-ic">${ic(icon, 22)}</span><div><b class="txt">${esc(txt)}</b><small>${label}</small></div></div>`;
  const maxS = Math.max(...Object.values(a.statusCounts), 1);
  $('#s-body').innerHTML = `<div class="ana-tools"><div class="tabs-b" role="group" aria-label="Date range">${tab('today', 'Today')}${tab('week', 'This week')}${tab('month', 'This month')}${tab('custom', 'Custom')}</div>${SF.ana.range === 'custom' ? `<form class="ana-range" id="ana-range"><div class="field inline"><label for="af">From</label><input id="af" type="date" name="from" value="${from}"></div><div class="field inline"><label for="at">To</label><input id="at" type="date" name="to" value="${to}"></div><button class="btn sm gold" type="submit">Apply</button></form>` : ''}<p class="muted small">${fmtDate(from)} to ${fmtDate(to)}. Reservations counted by check-in date.</p></div>
${a.total === 0 ? `<div class="empty"><p>No reservations in this range yet.</p></div>` : `<div class="kpis three">${kpi('Total reservations', a.total, 'list')}${kpi('Arrivals today', a.arrivalsToday, 'door')}${kpi('Departures today', a.departuresToday, 'logout')}${kpi('Occupancy rate', a.occupancy * 100, 'bed', { suf: '%', dec: 1 })}${kpi('Revenue (paid)', a.revenue, 'card', { pre: '₱' })}${kpi('Pending payments', a.pendingPayments, 'clock', { pre: '₱', cls: a.pendingPayments ? 'warn' : '' })}${kpi('Cancelled reservations', a.cancelled, 'close')}${tile('Most booked room type', a.topType, 'star')}${kpi('Average length of stay', a.avgStay, 'moon', { dec: 1, suf: ' nights' })}</div>
<div class="s-cols"><section class="panel wide"><h2>Revenue by check-in day</h2>${barChart(a.series.map(s => ({ d: s.date, v: s.rev })), v => '₱' + compact(v))}</section><section class="panel wide"><h2>Occupancy by night</h2>${lineChart(a.series.map(s => ({ d: s.date, v: s.occ / cap * 100 })), v => Math.round(v) + '%')}</section>
<section class="panel"><h2>Bookings by room type</h2>${donut(a.byType.map(t => ({ name: t.name, value: t.count })))}</section><section class="panel"><h2>Reservation status</h2><ul class="hbars">${Object.entries(a.statusCounts).map(([k, v]) => `<li><span>${k}</span><div><i style="width:${v / maxS * 100}%"></i></div><b>${v}</b></li>`).join('')}</ul></section></div>`}`;
  $('#s-body').onclick = e => { const b = e.target.closest('[data-range]'); if (!b) return; SF.ana.range = b.dataset.range; loadStaffPage(true); };
  const rf = $('#ana-range'); if (rf) rf.onsubmit = e => { e.preventDefault(); const d = fdata(rf); if (!d.from || !d.to || d.to < d.from) return toast('Choose an end date on or after the start date.', 'error'); if (diffDays(d.from, d.to) > 92) return toast('Please choose a range of up to 3 months.', 'error'); SF.ana.from = d.from; SF.ana.to = d.to; loadStaffPage(true); };
};

/* ---------- messages ---------- */
SP.messages = async () => {
  const all = await API.staff.messages(); const tabs = ['All', 'New', 'Read', 'Replied', 'Archived']; const list = all.filter(m => SF.msgTab === 'All' || m.status === SF.msgTab);
  $('#s-body').innerHTML = `<div class="tabs-b" role="group" aria-label="Filter messages">${tabs.map(t => `<button class="tabb ${SF.msgTab === t ? 'on' : ''}" data-mtab="${t}" aria-pressed="${SF.msgTab === t}">${t}${t !== 'All' ? ` <small>${all.filter(m => m.status === t).length}</small>` : ''}</button>`).join('')}</div>
${list.length ? `<ul class="msgs">${list.map(m => `<li class="msg ${m.status === 'New' ? 'new' : ''}"><div class="msg-top"><b>${esc(m.subject)}</b>${pill(m.status, m.status === 'New' ? 'warn' : m.status === 'Replied' ? 'ok' : 'mute')}${m.kind === 'dining' ? pill('Dining', 'info') : ''}</div><p class="muted small">${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ' · ' + esc(m.phone) : ''} · ${timeShort(m.at)}</p><p class="pre">${esc(m.message)}</p><div class="msg-btns"><a class="btn sm gold" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + m.subject)}">${ic('mail', 16)}Reply by email</a>${['Read', 'Replied', 'Archived'].filter(s => s !== m.status).map(s => `<button class="btn sm line" data-mid="${m.id}" data-ms="${s}">Mark ${s.toLowerCase()}</button>`).join('')}</div></li>`).join('')}</ul>` : '<div class="empty"><p>No messages here yet. Contact form and dining requests will appear in this inbox.</p></div>'}`;
  $('#s-body').onclick = async e => {
    const t = e.target.closest('[data-mtab]'); if (t) { SF.msgTab = t.dataset.mtab; return loadStaffPage(true); }
    const b = e.target.closest('[data-mid]'); if (b) { const o = await run(() => API.staff.messageStatus(+b.dataset.mid, b.dataset.ms), { btn: b }); if (o) loadStaffPage(true); }
  };
};

/* ---------- emails ---------- */
SP.emails = async () => {
  const [out, tpls, settings] = await Promise.all([API.staff.outbox(), API.staff.templates(), API.staff.settings()]);
  $('#s-body').innerHTML = `${settings.email.configured ? `<div class="notice-banner">${ic('mail', 18)}<span>Sending through <b>${esc(settings.email.provider)}</b> as ${esc(settings.email.from)}.</span></div>` : `<div class="notice-banner">${ic('mail', 18)}<span><b>Email isn’t connected yet.</b> Set <code>EMAIL_PROVIDER</code> and either <code>RESEND_API_KEY</code> or <code>SMTP_HOST</code>/<code>SMTP_USER</code>/<code>SMTP_PASS</code> as environment variables on the server, then restart it. Keys never belong in this page.</span></div>`}
<div class="bar-head"><h2>Send a test email</h2></div><form class="mail-row" id="test-mail">${field({ name: 'to', label: 'Send to', type: 'email', attrs: 'required placeholder="you@example.com"' })}<button class="btn gold" type="submit">Send test</button></form>
<div class="bar-head"><h2>Email templates</h2></div><div class="tpl-grid">${tpls.map(t => `<article class="tpl"><h3>${t.label}</h3><button class="btn sm line" data-tpl="${t.id}">${ic('eye', 16)}Preview</button></article>`).join('')}</div>
<div class="bar-head"><h2>Outbox</h2><span class="muted small">${plural(out.length, 'message')}</span></div>${out.length ? `<div class="table-wrap"><table class="rtable"><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Template</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${out.map(m => `<tr><td data-label="When">${timeShort(m.at)}</td><td data-label="To" class="brk">${esc(m.to)}</td><td data-label="Subject">${esc(m.subject)}</td><td data-label="Template">${esc(m.template)}</td><td data-label="Status">${pill(m.status === 'sent' ? 'Sent' : m.status === 'failed' ? 'Failed' : m.status === 'not_configured' ? 'Not sent' : 'Queued', m.status === 'sent' ? 'ok' : m.status === 'failed' ? 'bad' : 'warn')}${m.error ? `<br><small class="muted">${esc(m.error)}</small>` : ''}</td><td class="acts"><button class="btn sm line" data-ob="${m.id}">Preview</button>${m.status === 'failed' || m.status === 'not_configured' ? `<button class="btn sm line" data-resend="${m.id}">Resend</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>No emails yet. Confirmations appear here as soon as a reservation is made.</p></div>'}`;
  $('#test-mail').onsubmit = async e => { e.preventDefault(); const f = e.target; const d = fdata(f); const o = await run(() => API.staff.sendTestEmail(d.to), { btn: $('[type=submit]', f), form: f, ok: 'Test email queued.' }); if (o) loadStaffPage(true); };
  $('#s-body').addEventListener('click', async e => {
    const t = e.target.closest('[data-tpl]'); if (t) { const h = await run(() => API.staff.emailPreview({ template: t.dataset.tpl })); if (h) previewEmail(h.html, h.subject); }
    const o = e.target.closest('[data-ob]'); if (o) { const h = await run(() => API.staff.emailPreview({ outbox_id: +o.dataset.ob })); if (h) previewEmail(h.html, h.subject); }
    const rs = e.target.closest('[data-resend]'); if (rs) { const ok = await run(() => API.staff.resendEmail(+rs.dataset.resend), { btn: rs, ok: 'Queued for another attempt.' }); if (ok) loadStaffPage(true); }
  }, { once: true });
};

/* ---------- audit log ---------- */
SP.audit = async () => {
  const rows = await API.staff.auditLog();
  $('#s-body').innerHTML = rows.length ? `<p class="muted">Important staff and system actions, newest first. Showing the latest ${rows.length}.</p><div class="table-wrap"><table class="rtable"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Type</th><th>Details</th></tr></thead><tbody>${rows.map(a => `<tr><td data-label="When">${timeShort(a.at)}</td><td data-label="Who">${esc(a.user)}</td><td data-label="Action"><b>${esc(a.action)}</b></td><td data-label="Type">${esc(a.entity)}</td><td data-label="Details" class="brk">${esc(a.details)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><p>No activity recorded yet.</p></div>`;
};

/* ---------- settings ---------- */
SP.settings = async () => {
  const s = await API.staff.settings(); const c = s.settings;
  $('#s-body').innerHTML = `<div class="settings-grid">
<form id="set-form"><div class="settings-sec"><h2>Hotel information</h2><p class="sub">Shown across the website, emails and confirmations.</p><div class="form-grid">${field({ name: 'hotel.name', label: 'Hotel name', value: c.hotel.name })}${field({ name: 'hotel.tagline', label: 'Tagline', value: c.hotel.tagline })}${field({ name: 'hotel.address', label: 'Address', value: c.hotel.address, cls: 'full' })}${field({ name: 'hotel.phone', label: 'Phone', value: c.hotel.phone })}${field({ name: 'hotel.email', label: 'Contact email', type: 'email', value: c.hotel.email })}</div></div>
<div class="settings-sec"><h2>Policies</h2><p class="sub">Check-in rules and cancellation terms shown to guests.</p><div class="form-grid">${field({ name: 'checkin', label: 'Check-in time', value: c.checkin })}${field({ name: 'checkout', label: 'Check-out time', value: c.checkout })}${field({ name: 'free_cancel_hours', label: 'Free cancellation (hours before)', type: 'number', value: c.free_cancel_hours })}${field({ name: 'extra_adult', label: 'Extra adult rate per night (₱)', type: 'number', value: c.extra_adult })}${field({ name: 'service_rate', label: 'Service charge (0 to 0.3)', type: 'number', value: c.service_rate, attrs: 'step="0.01"' })}${field({ name: 'vat_rate', label: 'VAT (0 to 0.3)', type: 'number', value: c.vat_rate, attrs: 'step="0.01"' })}${field({ name: 'max_nights', label: 'Maximum nights per stay', type: 'number', value: c.max_nights })}${field({ name: 'hold_minutes', label: 'Online payment hold (minutes)', type: 'number', value: c.hold_minutes })}</div></div>
<div class="settings-sec"><h2>Bank transfer details</h2><p class="sub">Shown to guests who choose to pay by bank transfer. Leave blank to hide this payment method.</p><div class="form-grid">${field({ name: 'bank.bank_name', label: 'Bank name', value: c.bank.bank_name })}${field({ name: 'bank.account_name', label: 'Account name', value: c.bank.account_name })}${field({ name: 'bank.account_number', label: 'Account number', value: c.bank.account_number })}${field({ name: 'bank.instructions', label: 'Extra instructions', value: c.bank.instructions, cls: 'full' })}</div></div>
<div class="settings-sec"><h2>Social links</h2><div class="form-grid">${field({ name: 'social.facebook', label: 'Facebook URL', value: c.social.facebook })}${field({ name: 'social.instagram', label: 'Instagram URL', value: c.social.instagram })}${field({ name: 'social.tiktok', label: 'TikTok URL', value: c.social.tiktok })}</div></div>
<div class="settings-foot"><button class="btn gold" type="submit">Save settings</button></div></form>
<div class="settings-sec"><h2>Online payments</h2><p class="sub">${s.payments.paymongo ? 'Connected. Card, GCash and Maya payments are live.' : 'Not connected. Set PAYMONGO_SECRET_KEY as an environment variable on the server to accept card, GCash and Maya payments.'} ${s.payments.paymongo ? (s.payments.webhook ? 'A webhook secret is set for instant confirmation.' : 'Tip: set PAYMONGO_WEBHOOK_SECRET so payments confirm instantly even if a guest closes the tab.') : ''}</p></div>
<div class="settings-sec"><h2>Google Maps</h2><p class="sub">${s.maps ? 'A live map is shown on the Location page.' : 'Set GOOGLE_MAPS_API_KEY as an environment variable to show a live map instead of the illustration.'}</p></div>
<div class="settings-sec"><h2>Your password</h2><form id="pw-form" class="form-grid">${field({ name: 'old', label: 'Current password', type: 'password', attrs: 'autocomplete="current-password" required' })}${field({ name: 'password', label: 'New password', type: 'password', attrs: 'autocomplete="new-password" required', hint: 'At least 10 characters, with letters and numbers.' })}<button class="btn line" type="submit" style="align-self:end">Change password</button></form></div>
</div>`;
  const f = $('#set-form');
  f.addEventListener('submit', async e => {
    e.preventDefault(); clearFieldErrors(f); const raw = fdata(f);
    const nest = {}; Object.entries(raw).forEach(([k, v]) => { const [a, b] = k.split('.'); if (b) { nest[a] = nest[a] || {}; nest[a][b] = v; } else nest[a] = v; });
    const out = await run(() => API.staff.saveSettings(nest), { btn: $('[type=submit]', f), form: f, ok: 'Settings saved.' });
    if (out) { const cfg = await API.config(); applyConfig(cfg); loadStatusBanner(); }
  });
  $('#pw-form').addEventListener('submit', async e => { e.preventDefault(); const pf = e.target; clearFieldErrors(pf); const d = fdata(pf); const out = await run(() => API.staff.changePassword(d.old, d.password), { btn: $('[type=submit]', pf), form: pf, ok: 'Password changed.' }); if (out) pf.reset(); });
};

/* ---------- staff accounts ---------- */
SP.users = async () => {
  const users = await API.staff.users();
  $('#s-body').innerHTML = `<div class="users-toolbar"><p class="muted">${plural(users.length, 'staff account')}</p><button class="btn gold" id="add-user">${ic('plus', 18)}Add staff account</button></div>
<div class="table-wrap"><table class="rtable"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${users.map(u => `<tr><td data-label="Name">${esc(u.name)}${u.id === SF.user.id ? ' <small class="muted">(you)</small>' : ''}</td><td data-label="Email" class="brk">${esc(u.email)}</td><td data-label="Role"><span class="role-badge ${u.role}">${ROLE_LABEL[u.role]}</span></td><td data-label="Status">${u.active ? pill('Active', 'ok') : pill('Deactivated', 'mute')}</td><td data-label="Last sign-in">${u.last_login ? timeShort(u.last_login) : '<span class="muted">Never</span>'}</td><td class="acts"><button class="btn sm line" data-edituser="${u.id}">Edit</button><button class="btn sm line" data-resetpw="${u.id}">Reset password</button></td></tr>`).join('')}</tbody></table></div>`;
  $('#add-user').onclick = () => userForm(null);
  $('#s-body').onclick = e => {
    const ed = e.target.closest('[data-edituser]'); if (ed) return userForm(users.find(u => u.id === +ed.dataset.edituser));
    const rp = e.target.closest('[data-resetpw]'); if (rp) return resetPwForm(+rp.dataset.resetpw, users.find(u => u.id === +rp.dataset.resetpw));
  };
};
function userForm(u) {
  const isNew = !u;
  const m = openModal({ title: isNew ? 'Add staff account' : `Edit ${u.name}`, size: 'sm', body: `<form id="user-form" novalidate>${field({ name: 'name', label: 'Full name', value: u ? u.name : '', attrs: 'required' })}${field({ name: 'email', label: 'Email', type: 'email', value: u ? u.email : '', attrs: isNew ? 'required' : 'disabled' })}${field({ name: 'role', label: 'Role', tag: 'select', options: [['admin', 'Administrator'], ['front_desk', 'Front desk'], ['housekeeping', 'Housekeeping']], value: u ? u.role : 'front_desk' })}${isNew ? field({ name: 'password', label: 'Temporary password', type: 'password', attrs: 'required', hint: 'At least 10 characters, with letters and numbers.' }) : `<label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}><span>Active</span></label>`}<div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">${isNew ? 'Add account' : 'Save changes'}</button></div></form>` });
  $('#user-form', m.el).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; clearFieldErrors(f); const d = fdata(f);
    const out = isNew ? await run(() => API.staff.createUser({ name: d.name, email: d.email, role: d.role, password: d.password }), { btn: $('[type=submit]', f), form: f, ok: 'Staff account created.' })
      : await run(() => API.staff.updateUser(u.id, { name: d.name, role: d.role, active: !!f.elements.active.checked }), { btn: $('[type=submit]', f), form: f, ok: 'Staff account updated.' });
    if (out) { m.close(); loadStaffPage(true); }
  });
}
function resetPwForm(id, u) {
  const m = openModal({ title: `Reset password for ${u.name}`, size: 'sm', body: `<form id="rp-form" novalidate>${field({ name: 'password', label: 'New password', type: 'password', attrs: 'required', hint: 'At least 10 characters, with letters and numbers.' })}<div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">Reset password</button></div></form>` });
  $('#rp-form', m.el).addEventListener('submit', async e => { e.preventDefault(); const f = e.target; clearFieldErrors(f); const d = fdata(f); const out = await run(() => API.staff.resetPassword(id, d.password), { btn: $('[type=submit]', f), form: f, ok: 'Password reset.' }); if (out) m.close(); });
}

/* ---------- photos ---------- */
SP.photos = async () => {
  const { slots, photos } = await API.staff.photoSlots(); const groups = [...new Set(slots.map(s => s.group))];
  const active = SF.photoGroup || 'Home';
  $('#s-body').innerHTML = `<p class="muted">Upload real photography for any slot below. JPG, PNG or WebP, up to 12 MB. Until a photo is added, that spot shows a designed illustration instead.</p>
<div class="photo-groups">${groups.map(g => `<button class="chip ${g === active ? 'on' : ''}" data-pgroup="${esc(g)}">${g}</button>`).join('')}</div>
<div class="photo-grid" id="photo-grid">${slots.filter(s => s.group === active).map(s => `<div class="photo-card" data-slot="${esc(s.key)}"><div class="photo-thumb">${photos[s.key] ? `<img src="${photos[s.key]}?v=${Date.now()}" alt="">` : `<span class="ph-empty">${ic('image', 26)}<br>No photo yet</span>`}</div><div class="photo-body"><span class="grp">${esc(s.group)}</span><b>${esc(s.label)}</b><div class="photo-btns"><label class="btn sm line">Upload<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${esc(s.key)}"></label>${photos[s.key] ? `<button class="btn sm line" data-removephoto="${esc(s.key)}">Remove</button>` : ''}</div></div></div>`).join('')}</div>`;
  $('#s-body').onclick = async e => {
    const g = e.target.closest('[data-pgroup]'); if (g) { SF.photoGroup = g.dataset.pgroup; return loadStaffPage(true); }
    const rm = e.target.closest('[data-removephoto]'); if (rm) { const slot = rm.dataset.removephoto; const o = await run(() => API.staff.removePhoto(slot), { btn: rm, ok: 'Photo removed.' }); if (o) { delete IMAGE_OVERRIDES[slot]; loadStaffPage(true); } return; }
  };
  $('#s-body').addEventListener('change', async e => {
    const inp = e.target.closest('[data-upload]'); if (!inp || !inp.files[0]) return;
    const slot = inp.dataset.upload; const card = inp.closest('.photo-card'); const thumb = $('.photo-thumb', card);
    try { const r = await API.staff.uploadPhoto(slot, inp.files[0]); IMAGE_OVERRIDES[slot] = r.url; toast('Photo uploaded.'); thumb.innerHTML = `<img src="${r.url}?v=${Date.now()}" alt="">`; loadStaffPage(true); }
    catch (err) { toast(err.friendly ? err.message : MSG.SERVER, 'error'); }
  });
};

/* ---------- addons ---------- */
SP.addons = async () => {
  const rows = await API.staff.addons();
  $('#s-body').innerHTML = `<div class="bar-head"><h2>Extras and experiences</h2><button class="btn gold" id="add-addon">${ic('plus', 18)}Add extra</button></div><div class="addon-grid">${rows.map(a => `<article class="addon-card"><b>${esc(a.label)} ${a.active === false ? pill('Hidden', 'mute') : ''}</b><p class="muted small">${esc(a.desc)}</p><p class="price">${money(a.price)}${a.model === 'person_night' ? ' per person, per night' : a.model === 'person' ? ' per person' : a.model === 'night' ? ' per night' : ' per stay'}</p><button class="btn sm line" data-editaddon="${esc(a.id)}">Edit</button></article>`).join('')}</div>`;
  $('#add-addon').onclick = () => addonForm(null);
  $('#s-body').onclick = e => { const b = e.target.closest('[data-editaddon]'); if (b) addonForm(rows.find(a => a.id === b.dataset.editaddon)); };
};
function addonForm(a) {
  const m = openModal({ title: a ? `Edit ${a.label}` : 'Add extra', size: 'sm', body: `<form id="addon-form" novalidate>${field({ name: 'label', label: 'Name', value: a ? a.label : '', attrs: 'required' })}${field({ name: 'desc', label: 'Short description', value: a ? a.desc : '' })}${field({ name: 'model', label: 'Priced', tag: 'select', options: [['person_night', 'Per person, per night'], ['person', 'Per person'], ['night', 'Per night'], ['stay', 'Per stay']], value: a ? a.model : 'stay' })}${field({ name: 'price', label: 'Price (₱)', type: 'number', value: a ? a.price : 5000, attrs: 'min="0" step="50"' })}${field({ name: 'child_price', label: 'Child price (₱, if priced per person)', type: 'number', value: a ? a.child_price : 0, attrs: 'min="0" step="50"' })}${a ? `<label class="check"><input type="checkbox" name="active" ${a.active !== false ? 'checked' : ''}><span>Show on the booking page</span></label>` : ''}<div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">${a ? 'Save' : 'Add extra'}</button></div></form>` });
  $('#addon-form', m.el).addEventListener('submit', async e => { e.preventDefault(); const f = e.target; clearFieldErrors(f); const d = fdata(f); const out = await run(() => API.staff.saveAddon({ id: a ? a.id : undefined, label: d.label, desc: d.desc, model: d.model, price: d.price, child_price: d.child_price, active: a ? !!f.elements.active.checked : true }), { btn: $('[type=submit]', f), form: f, ok: 'Saved.' }); if (out) { m.close(); STATE.addons = []; loadStaffPage(true); } });
}

/* ---------- notification bell ---------- */
const NOTE_ICON = { new_reservation: 'calendar', payment_received: 'card', cancelled: 'close', cancellation_request: 'close', modified: 'edit', modification_request: 'edit', checkin_soon: 'clock', message: 'mail' };
async function openBell(anchor) {
  closeMenu(); const list = await run(() => API.staff.notifications()); if (!list) return;
  const pop = document.createElement('div'); pop.className = 'pop notif'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Notifications');
  pop.innerHTML = `<div class="notif-head"><b>Notifications</b><button class="btn sm line" id="mark-all">Mark all as read</button></div>${list.length ? `<ul>${list.map(n => `<li><button class="note ${n.read ? '' : 'unread'}" data-n="${n.id}" data-res="${n.res_id || ''}"><span class="n-ic">${ic(NOTE_ICON[n.type] || 'info', 18)}</span><span><b>${esc(n.title)}</b><small>${esc(n.body)}</small><small class="when">${timeShort(n.at)}</small></span></button></li>`).join('')}</ul>` : '<p class="muted pad">You’re all caught up.</p>'}`;
  document.body.appendChild(pop); const r = anchor.getBoundingClientRect(); pop.style.top = (r.bottom + 8) + 'px'; pop.style.right = Math.max(8, innerWidth - r.right) + 'px';
  pop.addEventListener('click', async e => {
    e.stopPropagation(); if (e.target.closest('#mark-all')) { await API.staff.markRead('all'); updateBell(); pop.remove(); toast('All caught up.', 'info'); return; }
    const b = e.target.closest('[data-n]'); if (!b) return; await API.staff.markRead([+b.dataset.n]); updateBell(); pop.remove(); if (b.dataset.res) openReservation(+b.dataset.res);
  });
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}
