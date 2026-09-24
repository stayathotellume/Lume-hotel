/* Shared between the Node server and the browser. Pure functions and constants only. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : globalThis, function () {
'use strict';
const CONFIG = {
  HOTEL: { name: 'The Lume Hotel', tagline: 'Where Comfort Shines ✨', address: 'Jawili, Tangalan, Aklan, Philippines', phone: '09163013007', email: 'stayathotellume@gmail.com' },
  CURRENCY: '₱', SERVICE_RATE: 0.10, VAT_RATE: 0.12, EXTRA_ADULT: 7500,
  CHECKIN: '3:00 PM', CHECKOUT: '12:00 noon', FREE_CANCEL_HOURS: 72, MAX_NIGHTS: 30, HOLD_MINUTES: 30,
  GOOGLE_MAPS_API_KEY: '',
  SOCIAL: { facebook: '', instagram: '', tiktok: '' },
  PAYMENTS: { online: false, bank: null, hotel: true }
};
const pad = (n, l = 2) => String(n).padStart(l, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const todayISO = () => iso(new Date());
const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const r2 = x => Math.round(x * 100) / 100;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => CONFIG.CURRENCY + Number(n).toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(+n) ? 0 : 2, maximumFractionDigits: 2 });
const fmtDate = (s, o) => parseISO(s).toLocaleDateString('en-PH', o || { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = s => parseISO(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const fmtDT = t => new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const byNo = (a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
const randHex = n => { const a = new Uint8Array(n); (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256); return [...a].map(x => pad(x.toString(16))).join(''); };
const RES_STATUS = ['Pending', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled', 'No Show'];
const ACTIVE = new Set(['Pending', 'Confirmed', 'Checked In']);
const PAY_STATUS = ['Paid', 'Pending', 'Unpaid', 'Refund Pending', 'Refunded', 'Failed'];
const ROOM_STATUS = ['Available', 'Reserved', 'Occupied', 'Cleaning', 'Maintenance', 'Out of Order'];
const PAY_METHODS = { card: 'Credit / debit card', gcash: 'GCash', maya: 'Maya', bank: 'Bank transfer', hotel: 'Pay at hotel', cash: 'Cash at front desk' };

const MSG = {
  INVALID_DATES: 'Check-out must be after check-in. Please adjust your dates.',
  PAST_DATE: 'Check-in can’t be in the past. Please choose today or a later date.',
  MAX_NIGHTS: 'Online bookings are limited to 30 nights. For longer stays, please contact us.',
  ROOM_UNAVAILABLE: 'Sorry, that room type just sold out for your dates. Please pick another room or change your dates.',
  NO_ROOMS: 'We’re fully booked for those dates. Try nearby dates or another room type.',
  CAPACITY: 'That room can’t fit your group. Please choose a larger room.',
  VALIDATION: 'Please check the highlighted fields.',
  BAD_REF: 'That doesn’t look like a reservation number. It should look like LUME-2026-00001.',
  BAD_EMAIL: 'Enter the email address used for the booking.',
  NOT_FOUND: 'We couldn’t find a reservation with that number and email. Check both and try again.',
  TOO_MANY: 'Too many attempts. Please wait a few minutes and try again.',
  PAYMENT_FAILED: 'We couldn’t process your payment. Please try again or choose another payment method.',
  CARD_DECLINED: 'Your card was declined. Try another card or a different payment method.',
  EMAIL_FAILED: 'We couldn’t send the email just now. Your reservation is safe, and the hotel can resend it.',
  NETWORK: 'You seem to be offline. Check your connection and try again.',
  UNAUTHORIZED: 'Your session has ended. Please sign in again.',
  FORBIDDEN: 'Your role doesn’t have access to that.',
  BAD_LOGIN: 'That email or password isn’t right. Please try again.',
  LOCKED: 'Too many sign-in attempts. Try again in a few minutes.',
  NOT_ALLOWED: 'That action isn’t available for this reservation right now.',
  CONFLICT: 'This record changed while you were working. Refresh and try again.',
  SERVER: 'Something went wrong on our side. Please try again in a moment.'
};
class ApiError extends Error {
  constructor(code, message, fields) { super(message || MSG[code] || MSG.SERVER); this.code = code; this.fields = fields || null; this.friendly = true; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validateGuest(g) {
  const f = {};
  const nm = v => v && v.trim().length >= 1 && v.trim().length <= 50 && !/[<>]/.test(v);
  if (!nm(g.first)) f.first = 'Enter your first name.';
  if (!nm(g.last)) f.last = 'Enter your last name.';
  if (!EMAIL_RE.test((g.email || '').trim())) f.email = 'Enter a valid email address.';
  if (!/^\+?\d{7,15}$/.test((g.phone || '').replace(/[\s()-]/g, ''))) f.phone = 'Enter a valid phone number, like 0917 123 4567.';
  if ((g.requests || '').length > 500) f.requests = 'Please keep special requests under 500 characters.';
  return f;
}
function validateStay(s, p) {
  const t = todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.ci || '') || !/^\d{4}-\d{2}-\d{2}$/.test(p.co || '')) throw new ApiError('INVALID_DATES');
  if (p.ci < t) throw new ApiError('PAST_DATE');
  if (p.co <= p.ci) throw new ApiError('INVALID_DATES');
  if (diffDays(p.ci, p.co) > CONFIG.MAX_NIGHTS) throw new ApiError('MAX_NIGHTS');
  const type = s.room_types.find(x => x.id === p.typeId); if (!type) throw new ApiError('ROOM_UNAVAILABLE');
  const a = +p.adults, c = +p.children || 0;
  if (!(a >= 1) || c < 0 || a + c > type.capacity) throw new ApiError('CAPACITY', `The ${type.name} sleeps up to ${type.capacity} guests. Please choose a larger room or reduce your group.`);
  return type;
}
function addonAmount(a, q) {
  const ad = q.adults, ch = q.children, n = q.nights;
  switch (a.model) {
    case 'person_night': return a.price * ad * n + (a.child_price || 0) * ch * n;
    case 'person': return a.price * ad + (a.child_price || 0) * ch;
    case 'night': return a.price * n;
    default: return a.price;
  }
}
function quote(s, q) {
  const t = s.room_types.find(x => x.id === q.typeId);
  const nights = diffDays(q.ci, q.co);
  const adults = +q.adults || 1, children = +q.children || 0;
  const lines = [];
  const roomTotal = t.price * nights;
  const extra = Math.max(0, adults - 2) * CONFIG.EXTRA_ADULT * nights;
  if (extra) lines.push({ id: 'extra', label: `Extra adult (${Math.max(0, adults - 2)} × ${nights} night${nights > 1 ? 's' : ''})`, amount: extra });
  (s.addons || []).forEach(a => { if (a.active !== false && q.addons && q.addons[a.id]) lines.push({ id: a.id, label: a.label, amount: addonAmount(a, { adults, children, nights }) }); });
  const extras = lines.reduce((n, l) => n + l.amount, 0);
  const subtotal = roomTotal + extras;
  const service = r2(subtotal * CONFIG.SERVICE_RATE);
  const vat = r2((subtotal + service) * CONFIG.VAT_RATE);
  return { nights, rate: t.price, roomTotal, lines, extras, subtotal, service, vat, total: r2(subtotal + service + vat) };
}
const roomPolicies = () => [
  `Check-in from ${CONFIG.CHECKIN}. Check-out by ${CONFIG.CHECKOUT}.`,
  `Rates cover 2 adults; each additional adult is ${money(CONFIG.EXTRA_ADULT)} per night. Children stay free using existing beds.`,
  `Free cancellation until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in. After that, the first night is charged.`,
  'Non-smoking room. Pets are not allowed in rooms. A valid photo ID is required at check-in.'
];
return { CONFIG, pad, iso, parseISO, addDays, todayISO, diffDays, overlaps, r2, esc, money, fmtDate, fmtShort, fmtDT, sleep, byNo, randHex,
  RES_STATUS, PAY_STATUS, ROOM_STATUS, PAY_METHODS, MSG, ApiError, ACTIVE, EMAIL_RE, validateGuest, validateStay, addonAmount, quote, roomPolicies };
});
