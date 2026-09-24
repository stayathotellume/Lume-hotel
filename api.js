'use strict';
/* ==========================================================================
   API client. Talks to the real server over fetch(); every response is JSON.
   Errors are thrown as the same shape the UI's run() helper expects:
   { friendly: true, code, message, fields }.
   ========================================================================== */
function apiError(code, message, fields) { const e = new Error(message); e.friendly = true; e.code = code; e.fields = fields || null; return e; }

async function req(method, path, body, opts) {
  const o = opts || {};
  const init = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined && method !== 'GET') { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, init); }
  catch (e) { throw apiError('NETWORK', MSG.NETWORK); }
  let json = null;
  try { json = await res.json(); } catch (e) { /* empty body, e.g. 204 */ }
  if (!res.ok) {
    const err = (json && json.error) || {};
    throw apiError(err.code || 'SERVER', err.message || MSG.SERVER, err.fields);
  }
  return json;
}
const qs = obj => { const p = new URLSearchParams(); Object.entries(obj || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? '?' + s : ''; };

const API = {
  config: () => req('GET', '/api/config'),
  availability: (ci, co) => req('GET', '/api/availability' + qs({ ci, co })),
  nightMap: (from, days, typeId) => req('GET', '/api/night-map' + qs({ from, days, type: typeId })),
  createReservation: p => req('POST', '/api/reservations', p),
  lookup: (no, email) => req('POST', '/api/reservations/lookup', { no, email }),
  requestChange: (no, email, r) => req('POST', '/api/reservations/request', { no, email, req: r }),
  payOnline: (no, email) => req('POST', '/api/reservations/pay', { no, email }),
  sendContact: (b, kind) => req('POST', '/api/contact', Object.assign({}, b, { kind })),
  setup: b => req('POST', '/api/setup', b),
  quote(p) { const s = { room_types: STATE.roomTypes, addons: STATE.addons }; return quote(s, p); },

  staff: {
    login: (email, password) => req('POST', '/api/staff/login', { email, password }),
    logout: () => req('POST', '/api/staff/logout', {}),
    me: () => req('GET', '/api/staff/me').catch(e => null),
    pulse: () => req('GET', '/api/staff/pulse'),
    changePassword: (old, password) => req('POST', '/api/staff/password', { old, password }),
    dashboard: () => req('GET', '/api/staff/dashboard'),
    reservations: f => req('GET', '/api/staff/reservations' + qs(f)),
    reservation: id => req('GET', '/api/staff/reservations/' + id),
    createReservation: p => req('POST', '/api/staff/reservations', p),
    action: (id, action, opts) => req('POST', `/api/staff/reservations/${id}/action`, { action, opts }),
    update: (id, changes, opts) => req('POST', `/api/staff/reservations/${id}/update`, { changes, opts }),
    pay: (id, b) => req('POST', `/api/staff/reservations/${id}/pay`, b),
    refund: id => req('POST', `/api/staff/reservations/${id}/refund`, {}),
    email: (id, template) => req('POST', `/api/staff/reservations/${id}/email`, { template }),
    resolveRequest: (id, reqId, decision) => req('POST', `/api/staff/reservations/${id}/request/${reqId}`, { decision }),
    freeRooms: (ci, co, exclude) => req('GET', '/api/staff/free-rooms' + qs({ ci, co, exclude })),
    rooms: () => req('GET', '/api/staff/rooms'),
    saveRoom: b => req('POST', '/api/staff/rooms', b),
    deleteRoom: id => req('POST', `/api/staff/rooms/${id}/delete`, {}),
    setRoomStatus: (id, status, why) => req('POST', `/api/staff/rooms/${id}/status`, { status, why }),
    housekeeping: (id, step) => req('POST', `/api/staff/rooms/${id}/housekeeping`, { step }),
    saveType: t => req('POST', '/api/staff/types', t),
    calendar: (from, days) => req('GET', '/api/staff/calendar' + qs({ from, days })),
    analytics: (from, to) => req('GET', '/api/staff/analytics' + qs({ from, to })),
    notifications: () => req('GET', '/api/staff/notifications'),
    markRead: ids => req('POST', '/api/staff/notifications/read', { ids }),
    messages: () => req('GET', '/api/staff/messages'),
    messageStatus: (id, status) => req('POST', `/api/staff/messages/${id}/status`, { status }),
    outbox: () => req('GET', '/api/staff/outbox'),
    resendEmail: id => req('POST', `/api/staff/outbox/${id}/resend`, {}),
    templates: () => req('GET', '/api/staff/templates'),
    emailPreview: b => req('POST', '/api/staff/email-preview', b),
    sendTestEmail: to => req('POST', '/api/staff/email-test', { to }),
    auditLog: () => req('GET', '/api/staff/audit'),
    users: () => req('GET', '/api/staff/users'),
    createUser: b => req('POST', '/api/staff/users', b),
    updateUser: (id, b) => req('POST', `/api/staff/users/${id}`, b),
    resetPassword: (id, password) => req('POST', `/api/staff/users/${id}/password`, { password }),
    settings: () => req('GET', '/api/staff/settings'),
    saveSettings: b => req('POST', '/api/staff/settings', b),
    addons: () => req('GET', '/api/staff/addons'),
    saveAddon: b => req('POST', '/api/staff/addons', b),
    photoSlots: () => req('GET', '/api/staff/photo-slots'),
    async uploadPhoto(slot, file) {
      const res = await fetch('/api/staff/photos/' + encodeURIComponent(slot), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      let json = null; try { json = await res.json(); } catch (e) { }
      if (!res.ok) { const err = (json && json.error) || {}; throw apiError(err.code || 'SERVER', err.message || MSG.SERVER, err.fields); }
      return json;
    },
    removePhoto: slot => req('POST', `/api/staff/photos/${encodeURIComponent(slot)}/remove`, {})
  }
};
