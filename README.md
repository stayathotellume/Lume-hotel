# The Lume Hotel

A complete five-star hotel website, online reservation system, and staff console for
**The Lume Hotel** — Jawili, Tangalan, Aklan, Philippines.

This is a real, self-hosted application, not a demo: a Node.js server with its own
SQLite database, real email delivery, and real online payments (PayMongo). There is
no sample data. The first time it starts, it has no rooms, no reservations, no staff
accounts and no guests — you create all of that yourself, either through the one-time
setup wizard or by hand in the staff console.

**Zero npm dependencies.** Everything runs on Node's built-in modules
(`http`, `node:sqlite`, `crypto`, `net`/`tls` for SMTP). Node **22.5 or later** is
required (for built-in SQLite support).

---

## 1. Quick start (local machine)

```bash
node --version        # confirm 22.5+
cp .env.example .env  # then edit .env — at minimum you can leave everything blank to try it locally
npm start              # or: node server/index.js
```

Open **http://localhost:3000**. Because this is a fresh install, you'll land on
**Set up your hotel**. The server prints a one-time setup code to its console the
first time it starts, for example:

```
  First-run setup: open the site at /#/staff and enter this setup code: 7K2M9QRX
```

Enter that code plus your name, email and a password to create the administrator
account. You'll be asked whether to start from the built-in five-star catalogue
(60 rooms across 5 categories, ₱80,000–₱150,000 per night) or with nothing at all.

With no `EMAIL_PROVIDER` and no `PAYMONGO_SECRET_KEY` set, the site still works fully:
guests can book with "pay at hotel", staff can run the whole operation, and emails
simply queue in the **Emails** admin page instead of being delivered. Connect the
real providers (below) whenever you're ready to go live.

---

## 2. Connecting real email

Set **one** of these in `.env` (see `.env.example` for the full list of variables):

- **Resend** — `EMAIL_PROVIDER=resend` + `RESEND_API_KEY=...`. Simplest option.
- **SMTP** — `EMAIL_PROVIDER=smtp` + `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`.
  Works with Gmail (use an App Password), Mailgun, SendGrid's SMTP endpoint, or any
  mail server.

Restart the server after changing `.env`. Any email that queued up before you
connected a provider is sent automatically once it's configured. You can send a
test email and preview every template from **Staff → Emails**.

## 3. Connecting real payments (PayMongo)

1. Create a PayMongo account and get your **secret key**.
2. Set `PAYMONGO_SECRET_KEY` in `.env`.
3. In the PayMongo dashboard, add a webhook pointing at
   `https://your-domain.com/api/payments/webhook`, subscribed to checkout session
   events, and copy its signing secret into `PAYMONGO_WEBHOOK_SECRET`. This makes
   payments confirm instantly and reliably, even if a guest closes their browser
   tab right after paying (the server also double-checks with PayMongo every 30
   seconds as a safety net, so payments are never lost even without the webhook —
   the webhook just makes confirmation immediate).
4. Restart the server. Card, GCash and Maya options appear automatically on the
   booking page once `PAYMONGO_SECRET_KEY` is set.

Bank transfer is a separate, no-code option: fill in your bank details under
**Staff → Settings → Bank transfer details**, and it appears as a payment method
automatically. Leave it blank to hide it.

## 4. Google Maps (optional)

Set `GOOGLE_MAPS_API_KEY` to show a live embedded map on the Location page.
Without it, a designed map illustration is shown instead — the "Open in Google
Maps" and "Get directions" buttons work regardless.

---

## 5. Deploying it for real

This is a plain Node process that listens on `$PORT` and needs a writable
`$DATA_DIR` for its SQLite database and uploaded photos. Any of these work:

### Option A — Railway / Render / Fly.io (easiest)
1. Push this folder to a Git repository.
2. Create a new service from that repo on Railway, Render, or Fly.io.
3. Set the start command to `node server/index.js` (or `npm start`).
4. Add a **persistent volume** mounted at, e.g., `/data`, and set `DATA_DIR=/data`.
5. Add the environment variables from `.env.example` in the platform's dashboard.
6. Set `BASE_URL` to the https URL the platform gives you.

### Option B — Your own VPS (Ubuntu, systemd)
```bash
# as a deploy user, with the project copied to /opt/lume-hotel
sudo tee /etc/systemd/system/lume-hotel.service << 'EOF'
[Unit]
Description=The Lume Hotel
After=network.target

[Service]
WorkingDirectory=/opt/lume-hotel
ExecStart=/usr/bin/node server/index.js
EnvironmentFile=/opt/lume-hotel/.env
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now lume-hotel
```
Put nginx or Caddy in front of it for HTTPS (Let's Encrypt), proxying to
`127.0.0.1:3000`, and set `TRUST_PROXY=1` plus `BASE_URL=https://your-domain.com`.

### Backups
The server writes a daily SQLite snapshot to `DATA_DIR/backups/`, keeping the last
14. For real production use, also copy `DATA_DIR` (database + uploaded photos) to
off-server storage on a schedule (e.g., a nightly `rsync` or cloud sync job) —
that part is on your infrastructure, not this app.

---

## 6. Running it as a Windows/Mac desktop test
Node 22+ from [nodejs.org](https://nodejs.org) is all you need — there's no build
step, database server, or `npm install` required. `node server/index.js` works the
same on Windows, macOS and Linux.

---

## 7. Project layout

```
server/
  index.js    HTTP server: routing, static files, uploads, payment webhook, cron jobs
  core.js     Business logic and the API (reservations, staff actions, email, auth)
  store.js    Tiny SQLite persistence layer (no ORM, no query builder)
  catalog.js  The default room types, rooms and extras used by "start with a catalogue"
  mail.js     Dependency-free SMTP client + Resend API client
  pay.js      PayMongo hosted-checkout client
  shared.js   Pure helper functions used by both the server and the browser
public/
  index.html, main.js, api.js, ui-*.js, styles.css   The website and staff console
  art.js      Generates the placeholder illustrations used until you upload real photos
  brand/      Your logo, cropped into the sizes the site uses (nav mark, favicon, etc.)
test/
  server.test.js    Spins up a real server + real SMTP sink and exercises the whole API
  payments.test.js  Same, against a mocked PayMongo, covering the online-payment flow
  e2e.js            Full browser walkthrough with Playwright (requires `playwright` installed)
```

Run the automated tests with `npm test` (no test framework needed — they're plain
Node scripts). `test/e2e.js` additionally needs `playwright` installed
(`npm install -D playwright && npx playwright install chromium`) since it drives a
real browser; it isn't part of `npm test` for that reason.

---

## 8. Editing hotel content

Almost everything is editable from the staff console with no code changes:
hotel name/address/policies, room types and rates, rooms, extras, staff accounts,
and every photo on the site (**Staff → Photos** — until you upload a real photo for
a spot, it shows a designed illustration, never a placeholder that looks broken).

Things that do live in code, for a developer to change:
- The wording of pages like About, Amenities, and the FAQ — `public/ui-site.js`.
- Email template designs — `server/core.js` (the `Emails` section).
- The starting catalogue offered during setup — `server/catalog.js`.

---

## 9. Security notes

- Passwords are hashed with PBKDF2 (210,000 iterations, SHA-256, unique salt per user).
- Sessions are random 256-bit tokens in an httpOnly, SameSite=Strict cookie; only a
  hash of the token is stored server-side.
- Every staff action that matters (confirmations, cancellations, payments, refunds,
  settings changes, sign-ins) is written to the audit log.
- Card numbers never touch this server — online payments happen on PayMongo's own
  hosted checkout page.
- Rate limiting is applied to login, setup, and booking endpoints.
- Set real values for `BASE_URL` (https) and put the app behind TLS before going
  live; the app sends `Strict-Transport-Security` automatically once `BASE_URL`
  starts with `https://`.
