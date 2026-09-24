'use strict';
/* ==========================================================================
   Store: relational tables in SQLite (node:sqlite, no dependencies).
   The working set lives in memory for speed; every transaction is diffed and
   written to SQLite row by row inside one SQL transaction, so the file on
   disk is always a consistent relational database you can open with any
   SQLite tool. One process owns the database (single-instance deployment).
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const TABLES = {
  users: { pk: 'id', cols: ['id', 'name', 'email', 'role', 'salt', 'hash', 'active', 'created_at', 'last_login'], bool: ['active'] },
  room_types: { pk: 'id', cols: ['id', 'slug', 'name', 'price', 'capacity', 'beds', 'size', 'view', 'short', 'description', 'active', 'sort'], json: ['amenities'], bool: ['active'] },
  rooms: { pk: 'id', cols: ['id', 'number', 'type_id', 'status', 'hk', 'notes'] },
  addons: { pk: 'id', pkType: 'TEXT', cols: ['id', 'label', 'desc', 'model', 'price', 'child_price', 'active', 'sort'], bool: ['active'] },
  guests: { pk: 'id', cols: ['id', 'first', 'last', 'email', 'phone'] },
  reservations: { pk: 'id', cols: ['id', 'number', 'guest_id', 'room_id', 'type_id', 'check_in', 'check_out', 'nights', 'adults', 'children', 'guests', 'price_per_night', 'total', 'payment_method', 'paid_amount', 'payment_status', 'status', 'special_requests', 'arrival_time', 'source', 'idem_key', 'pay_ref', 'hold_expires', 'reminder_sent', 'created_at', 'updated_at', 'checked_in_at', 'checked_out_at', 'cancelled_at', 'cancel_reason'], json: ['addons', 'pricing', 'requests'], bool: ['reminder_sent'] },
  payments: { pk: 'id', cols: ['id', 'reservation_id', 'method', 'amount', 'status', 'ref', 'at'] },
  room_status: { pk: 'id', cols: ['id', 'room_id', 'status', 'housekeeping', 'by', 'why', 'at'] },
  notifications: { pk: 'id', cols: ['id', 'at', 'type', 'title', 'body', 'res_id', 'read', 'key'], json: ['roles'], bool: ['read'] },
  contact_messages: { pk: 'id', cols: ['id', 'name', 'email', 'phone', 'subject', 'message', 'kind', 'status', 'at'] },
  audit_logs: { pk: 'id', cols: ['id', 'at', 'user_id', 'user', 'action', 'entity', 'entity_id', 'details'] },
  email_outbox: { pk: 'id', cols: ['id', 'at', 'reservation_id', 'template', 'to', 'from', 'subject', 'status', 'mode', 'by', 'attempts', 'next_try', 'error', 'sent_at'] },
  sessions: { pk: 'token_hash', pkType: 'TEXT', cols: ['token_hash', 'user_id', 'expires', 'created_at', 'ip'] }
};
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS ix_res_number ON reservations(number)', 'CREATE INDEX IF NOT EXISTS ix_res_room ON reservations(room_id, check_in, check_out)',
  'CREATE INDEX IF NOT EXISTS ix_res_status ON reservations(status)', 'CREATE INDEX IF NOT EXISTS ix_guest_email ON guests(email)',
  'CREATE INDEX IF NOT EXISTS ix_pay_res ON payments(reservation_id)', 'CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_logs(entity, entity_id)'
];
const q = c => '"' + c + '"';
const KV = ['settings', 'meta'];

function blank() {
  const s = { settings: {}, meta: { next: {}, seq: {} } };
  Object.keys(TABLES).forEach(t => { s[t] = []; });
  return s;
}
const allCols = spec => spec.cols.concat(spec.json || []);
function toRow(t, obj) {
  const spec = TABLES[t], row = {}, extra = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k]; if (v === undefined) continue;
    if (spec.json && spec.json.includes(k)) row[k] = JSON.stringify(v);
    else if (spec.cols.includes(k)) row[k] = spec.bool && spec.bool.includes(k) ? (v ? 1 : 0) : v;
    else extra[k] = v;
  }
  row.extra = Object.keys(extra).length ? JSON.stringify(extra) : null;
  return row;
}
function fromRow(t, row) {
  const spec = TABLES[t], o = {};
  for (const c of allCols(spec)) {
    let v = row[c]; if (v === undefined) continue;
    if (spec.bool && spec.bool.includes(c)) v = !!v; else if (spec.json && spec.json.includes(c)) v = v == null ? undefined : JSON.parse(v);
    if (v !== undefined) o[c] = v;
  }
  if (row.extra) Object.assign(o, JSON.parse(row.extra));
  return o;
}

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
  for (const [t, spec] of Object.entries(TABLES)) {
    const cols = allCols(spec).map(c => c === spec.pk ? `${q(c)} ${spec.pkType || 'INTEGER'} PRIMARY KEY` : q(c)).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS ${q(t)} (${cols}, extra TEXT)`);
  }
  db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');
  INDEXES.forEach(x => db.exec(x));
  const state = blank(); const cache = {}; const kvCache = {};
  for (const t of Object.keys(TABLES)) {
    state[t] = db.prepare(`SELECT * FROM ${q(t)}`).all().map(r => fromRow(t, r));
    cache[t] = new Map(state[t].map(o => [o[TABLES[t].pk], JSON.stringify(o)]));
  }
  for (const k of KV) {
    const r = db.prepare('SELECT value FROM kv WHERE key=?').get(k);
    if (r) state[k] = JSON.parse(r.value);
    kvCache[k] = JSON.stringify(state[k]);
  }
  state.meta.next = state.meta.next || {}; state.meta.seq = state.meta.seq || {};
  let cur = state, version = 1; const subs = new Set();
  const stmts = {};
  const upsert = (t, obj) => {
    const row = toRow(t, obj); const cols = Object.keys(row); const key = t + ':' + cols.join(',');
    if (!stmts[key]) stmts[key] = db.prepare(`INSERT OR REPLACE INTO ${q(t)} (${cols.map(q).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
    stmts[key].run(...cols.map(c => row[c]));
  };
  const commit = next => {
    if (next.audit_logs.length > 6000) next.audit_logs = next.audit_logs.slice(-5000);
    if (next.notifications.length > 1200) next.notifications = next.notifications.slice(-1000);
    if (next.email_outbox.length > 6000) next.email_outbox = next.email_outbox.slice(-5000);
    const ups = [], dels = [], newCache = {}, newKv = {};
    for (const t of Object.keys(TABLES)) {
      const pk = TABLES[t].pk, seen = new Set(), nc = new Map();
      for (const o of next[t]) { const js = JSON.stringify(o), k = o[pk]; seen.add(k); nc.set(k, js); if (cache[t].get(k) !== js) ups.push([t, o]); }
      for (const k of cache[t].keys()) if (!seen.has(k)) dels.push([t, k]);
      newCache[t] = nc;
    }
    const kvUp = [];
    for (const k of KV) { const js = JSON.stringify(next[k]); newKv[k] = js; if (js !== kvCache[k]) kvUp.push([k, js]); }
    if (!ups.length && !dels.length && !kvUp.length) { cur = next; return; }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [t, o] of ups) upsert(t, o);
      for (const [t, k] of dels) db.prepare(`DELETE FROM ${q(t)} WHERE ${q(TABLES[t].pk)}=?`).run(k);
      for (const [k, js] of kvUp) db.prepare('INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)').run(k, js);
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch (x) { } throw e; }
    Object.assign(cache, newCache); Object.assign(kvCache, newKv); cur = next; version++;
    subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  };
  return {
    read: () => cur,
    tx(fn) { const next = structuredClone(cur); const out = fn(next); commit(next); return out; },
    get version() { return version; },
    on(f) { subs.add(f); return () => subs.delete(f); },
    backup(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); },
    close() { db.close(); },
    file
  };
}
module.exports = { open, blank, TABLES };
