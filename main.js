'use strict';
/* ==========================================================================
   Router + startup
   ========================================================================== */
const SECTIONS = new Set(['about', 'rooms', 'experiences-home', 'dining', 'amenities', 'gallery', 'location', 'contact', 'faq']);
let lastView = '';
function go(path) { const h = '#' + path; if (location.hash === h) route(); else location.hash = h; }
function parseHash() { const raw = location.hash.slice(1) || '/'; const [p, qs] = raw.split('?'); const parts = p.split('/').filter(Boolean).map(decodeURIComponent); return { parts, q: new URLSearchParams(qs || '') }; }
function onScroll() { const n = $('#nav'); if (n) n.classList.toggle('scrolled', window.scrollY > 40); }
function scrollToSection(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }

function applyConfig(cfg) {
  Object.assign(CONFIG.HOTEL, cfg.config.HOTEL);
  Object.assign(CONFIG.SOCIAL, cfg.config.SOCIAL);
  CONFIG.SERVICE_RATE = cfg.config.SERVICE_RATE; CONFIG.VAT_RATE = cfg.config.VAT_RATE; CONFIG.EXTRA_ADULT = cfg.config.EXTRA_ADULT;
  CONFIG.CHECKIN = cfg.config.CHECKIN; CONFIG.CHECKOUT = cfg.config.CHECKOUT; CONFIG.FREE_CANCEL_HOURS = cfg.config.FREE_CANCEL_HOURS;
  CONFIG.MAX_NIGHTS = cfg.config.MAX_NIGHTS; CONFIG.HOLD_MINUTES = cfg.config.HOLD_MINUTES; CONFIG.GOOGLE_MAPS_API_KEY = cfg.config.GOOGLE_MAPS_API_KEY;
  CONFIG.PAYMENTS = cfg.config.PAYMENTS;
  STATE.roomTypes = cfg.roomTypes; STATE.addons = cfg.addons; STATE.photos = cfg.photos; STATE.needsSetup = cfg.needsSetup; STATE.stats = cfg.stats;
  setPhotoLibrary(cfg.photos);
  document.title = CONFIG.HOTEL.name + ' · ' + CONFIG.HOTEL.tagline;
}
async function refreshConfig() { try { applyConfig(await API.config()); } catch (e) { } }

async function route() {
  closeMenu(); ModalStack.slice().forEach(m => m.close());
  const { parts, q } = parseHash(); const [a, b] = parts;
  try {
    if (STATE.needsSetup && a !== 'setup') return go('/setup');
    if (a === 'setup') { lastView = ''; return renderSetup(); }
    if (a === 'staff') { lastView = 'staff'; return await staffRoute(b); }
    UI.view = 'site'; SF.drawer = null; stopPulse();
    if (!a || SECTIONS.has(a)) {
      if (lastView !== 'home') { $('#app').innerHTML = siteShell(homeHTML()); mountHome(); }
      lastView = 'home'; onScroll();
      if (a && SECTIONS.has(a)) setTimeout(() => scrollToSection(a), 60); else window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    lastView = a;
    if (a === 'experiences' && !b) { $('#app').innerHTML = siteShell(experiencesPageHTML(), { solid: true }); document.title = 'Experiences · ' + H().name; window.scrollTo(0, 0); observe($('#main')); return; }
    if (a === 'room' && b) {
      $('#app').innerHTML = siteShell(`<section class="section page-pad"><div class="wrap">${skel(2, 320)}</div></section>`, { solid: true });
      const { html, t } = await roomPageHTML(b); $('#main').innerHTML = html; document.title = (t ? t.name : 'Room') + ' · ' + H().name; window.scrollTo(0, 0); if (t) await mountRoomPage(t); observe($('#main')); return;
    }
    if (a === 'book') { document.title = 'Book your stay · ' + H().name; return await bookRoute(q); }
    if (a === 'confirmation' && b) { document.title = 'Reservation confirmation · ' + H().name; window.scrollTo(0, 0); return await confirmationRoute(b); }
    if (a === 'manage') { document.title = 'Manage my reservation · ' + H().name; window.scrollTo(0, 0); return await manageRoute(q); }
    lastView = ''; $('#app').innerHTML = siteShell(`<section class="section page-pad"><div class="wrap narrow"><h1 class="h-page">We couldn’t find that page</h1><p class="lead">The link may be out of date.</p><a class="btn gold" href="#/">Back to home</a></div></section>`, { solid: true });
  } catch (e) {
    console.error(e); lastView = '';
    $('#app').innerHTML = siteShell(`<section class="section page-pad"><div class="wrap narrow"><h1 class="h-page">Something went wrong</h1><p class="lead">${esc(e && e.friendly ? e.message : MSG.SERVER)}</p><a class="btn gold" href="#/">Back to home</a></div></section>`, { solid: true });
  }
}

/* ---------- first-run setup wizard ---------- */
function renderSetup() {
  document.title = 'Set up your hotel';
  $('#app').innerHTML = `<div class="setup"><div class="setup-card"><a class="brand dark" href="#/"><img class="mark" src="/brand/logo-mark.png" alt=""><span>The Lume Hotel</span></a><h1>Set up your hotel</h1><p class="lead">This runs once. It creates your administrator account and, if you like, your starting room catalogue.</p>
<div class="setup-hint">${ic('info', 16)}<span>The person who started this server can see a one-time setup code in its console output.</span></div>
<form id="setup-form" novalidate>${field({ name: 'code', label: 'Setup code', attrs: 'required autocapitalize="characters" placeholder="From the server console"' })}${field({ name: 'name', label: 'Your name', attrs: 'required' })}${field({ name: 'email', label: 'Your email', type: 'email', attrs: 'required autocomplete="username"' })}${field({ name: 'password', label: 'Choose a password', type: 'password', attrs: 'required autocomplete="new-password"', hint: 'At least 10 characters, with letters and numbers.' })}
<div class="catalog-choice" role="radiogroup" aria-label="Starting catalogue"><label class="cc-opt"><input type="radio" name="catalog" value="yes" checked><span><b>Start with a five-star catalogue</b><small>60 rooms across 5 categories (₱80,000 to ₱150,000 per night) and a set of extras, ready to edit.</small></span></label><label class="cc-opt"><input type="radio" name="catalog" value="no"><span><b>Start empty</b><small>Add your own room types and rooms from scratch in the dashboard.</small></span></label></div>
<button class="btn gold block" type="submit">Create administrator account</button></form></div></div>`;
  const f = $('#setup-form');
  f.addEventListener('submit', async e => {
    e.preventDefault(); clearFieldErrors(f); const d = fdata(f);
    const out = await run(() => API.setup({ code: d.code.trim().toUpperCase(), name: d.name, email: d.email, password: d.password, catalog: d.catalog === 'yes' }), { btn: $('[type=submit]', f), form: f });
    if (out) { toast(`Welcome, ${out.name.split(' ')[0]}. Your hotel is ready.`); await refreshConfig(); go('/staff/' + homePage(out.role)); }
  });
}

/* ---------- global events ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (a) { const h = a.getAttribute('href'); if (h === location.hash) { e.preventDefault(); route(); } const mn = $('#mnav'); if (mn && !mn.hidden && a.closest('#mnav')) { mn.hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); } }
  const bg = e.target.closest('#burger'); if (bg) { const mn = $('#mnav'); mn.hidden = !mn.hidden; bg.setAttribute('aria-expanded', String(!mn.hidden)); bg.innerHTML = ic(mn.hidden ? 'menu' : 'close', 24); }
  const gt = e.target.closest('[data-goto]'); if (gt && B) { e.preventDefault(); gotoStep(+gt.dataset.goto); }
  const op = e.target.closest('.ri[data-open], .g-bar[data-open], .fd-btns [data-open]'); if (op) openReservation(+op.dataset.open);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('.pop')) closeTopModal(); closeMenu(); const mn = $('#mnav'); if (mn && !mn.hidden) { mn.hidden = true; } }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.ri[data-open]')) { e.preventDefault(); openReservation(+e.target.dataset.open); }
});
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('hashchange', route);
window.addEventListener('afterprint', () => { const p = $('#print-root'); if (p) p.innerHTML = ''; });
window.addEventListener('online', () => toast('You’re back online.', 'info'));
window.addEventListener('offline', () => toast(MSG.NETWORK, 'error'));

/* ---------- start ---------- */
(async function start() {
  $('#app').innerHTML = '<div class="splash" role="status" aria-label="Loading"><span class="lamp big" aria-hidden="true"></span></div>';
  try { applyConfig(await API.config()); } catch (e) { console.error(e); $('#app').innerHTML = `<div class="splash"><div class="empty"><p>We couldn’t reach the hotel server. Please check your connection and reload the page.</p><button class="btn gold" onclick="location.reload()">Reload</button></div></div>`; return; }
  route();
})();
