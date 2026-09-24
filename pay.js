'use strict';
/* Online payments through PayMongo hosted checkout (cards, GCash, Maya). Card numbers are typed on
   PayMongo's own page, so they never touch this server. Keys come from environment variables only. */
const crypto = require('crypto');
const API = process.env.PAYMONGO_API || 'https://api.paymongo.com/v1';

function fromEnv(env) {
  const key = env.PAYMONGO_SECRET_KEY || '';
  const auth = 'Basic ' + Buffer.from(key + ':').toString('base64');
  const call = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const msg = (j.errors && j.errors[0] && j.errors[0].detail) || ('PayMongo error ' + res.status); const e = new Error(msg); e.status = res.status; throw e; }
    return j;
  };
  return {
    configured: !!key,
    // amount in pesos (number). Returns { id, url }
    async createCheckout({ number, description, amount, successUrl, cancelUrl, email, name, methods }) {
      const types = (methods && methods.length ? methods : ['card', 'gcash', 'paymaya']);
      const j = await call('POST', '/checkout_sessions', { data: { attributes: {
        billing: { name, email }, send_email_receipt: false, show_description: true, show_line_items: true, description,
        line_items: [{ currency: 'PHP', amount: Math.round(amount * 100), name: 'Reservation ' + number, quantity: 1, description }],
        payment_method_types: types, reference_number: number, success_url: successUrl, cancel_url: cancelUrl } } });
      return { id: j.data.id, url: j.data.attributes.checkout_url };
    },
    // Returns { paid: bool, amount, ref, method }
    async getCheckout(id) {
      const j = await call('GET', '/checkout_sessions/' + encodeURIComponent(id));
      const a = j.data.attributes || {}; const pays = (a.payments || []).filter(p => p.attributes && p.attributes.status === 'paid');
      const p = pays[0];
      return { paid: !!p, amount: p ? p.attributes.amount / 100 : 0, ref: p ? p.id : '', method: p && p.attributes.source ? p.attributes.source.type : '' };
    },
    // Verifies the Paymongo-Signature header of a webhook. Returns true when there is no secret configured only if allowUnsigned.
    verifyWebhook(rawBody, header, secret) {
      if (!secret) return false; if (!header) return false;
      const parts = Object.fromEntries(header.split(',').map(x => x.split('=')));
      const sig = parts.li || parts.te; if (!parts.t || !sig) return false;
      const mac = crypto.createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex');
      try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig)); } catch (e) { return false; }
    }
  };
}
module.exports = { fromEnv };
