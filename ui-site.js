'use strict';
/* ==========================================================================
   Public website
   ========================================================================== */
Object.assign(ICONS, {
  minus: 'M5 12h14', msg: 'M4 5h16v11H9l-5 4z', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', ext: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5', door: 'M6 21V4h9l3 2v15M3 21h18M12 12h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', mailopen: 'M3 10l9-6 9 6v9H3zM3 10l9 6 9-6', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  martini: 'M4 4h16l-8 9v7M8 20h8M4 4l8 9', waves: 'M2 8c2 0 2 2 5 2s3-2 5-2 3 2 5 2 3-2 5-2M2 14c2 0 2 2 5 2s3-2 5-2 3 2 5 2 3-2 5-2M2 20c2 0 2 2 5 2s3-2 5-2 3 2 5 2 3-2 5-2', umbrella: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 1-4 0M12 3v2'
});
const NAV = [['/about', 'About'], ['/rooms', 'Rooms & Suites'], ['/experiences', 'Experiences'], ['/dining', 'Dining'], ['/amenities', 'Amenities'], ['/gallery', 'Gallery'], ['/location', 'Location'], ['/contact', 'Contact']];
const H = () => CONFIG.HOTEL;
const MAPQ = () => encodeURIComponent(`${H().name}, ${H().address}`);

const AMENITIES = [
  ['pool', 'Infinity pool', 'A sunset-facing infinity pool overlooking the Sibuyan Sea, with a swim-up feel and a poolside bar service.'],
  ['martini', 'Sunset Bar', 'Craft cocktails, aged rum and fine wine served on an open-air deck as the sun goes down.'],
  ['leaf', 'Lume Spa', 'A full-service spa with private treatment suites, a relaxation lounge and a signature ritual menu.'],
  ['umbrella', 'Private Jawili beach', 'A reserved stretch of Jawili beach for villa guests, with cabanas and beachfront dining.'],
  ['route', 'Grand Aklan tour', 'A private, full-day guided tour of Aklan’s heritage towns, waterfalls and coastline.'],
  ['utensils', 'Lumina restaurant', 'Fine dining built on Aklan’s coast: fresh seafood, coconut and calamansi, from breakfast through dinner.'],
  ['coffee', 'Café Dawn', 'Espresso, fresh pastries and light meals from 6 AM in a quiet garden courtyard.'],
  ['dumbbell', 'Fitness studio', 'A fully equipped 24-hour gym with a view of the gardens.'],
  ['wifi', 'Free high-speed Wi-Fi', 'Fibre-backed Wi-Fi throughout every room, suite and public space.'],
  ['clock', '24-hour front desk', 'A dedicated team on hand around the clock, whatever time your flight lands.'],
  ['sparkles', 'Daily housekeeping', 'Fresh linens daily, with evening turndown service for every room.'],
  ['car', 'Valet parking', 'Complimentary valet parking for every guest.'],
  ['bell', 'Concierge', 'Private tours, transport and reservations arranged by our concierge team.'],
  ['tray', 'In-room dining', 'Lumina’s menu delivered to your room or suite, around the clock.'],
  ['plane', 'Airport transfers', 'Chauffeured transfers from Kalibo International Airport in a private SUV.']
];
const FAQ = () => { const H0 = H(); return [
  ['What are the check-in and check-out times?', `Check-in starts at ${CONFIG.CHECKIN} and check-out is by ${CONFIG.CHECKOUT}. The front desk is open 24 hours, so late arrivals are always welcome. Please bring a valid photo ID.`],
  ['What is your cancellation policy?', `You can cancel free of charge until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in. After that, the first night is charged. You can request a cancellation any time from Manage reservation.`],
  ['How can I pay?', CONFIG.PAYMENTS.online ? 'Pay by credit or debit card, GCash or Maya to confirm instantly. You can also choose bank transfer, or pay at the hotel on arrival.' : 'You can reserve now and pay by bank transfer or at the hotel on arrival. Online card, GCash and Maya payments will be available soon.'],
  ['Is there a charge for extra guests?', `Rates include 2 adults. Each additional adult is ${money(CONFIG.EXTRA_ADULT)} per night, up to the room’s maximum capacity. Children stay free using existing beds.`],
  ['Can I bring children?', 'Yes, children are very welcome. Children stay free when using existing beds, and cots are available free of charge on request.'],
  ['Are pets allowed?', 'We’re sorry, pets aren’t allowed in the rooms or restaurant. Assistance animals are welcome. Please tell us before you arrive.'],
  ['What is included with the Jawili Beach Villa?', 'Villa guests receive exclusive use of our reserved stretch of Jawili beach, a dedicated butler, daily spa credit and a chauffeured airport transfer, in addition to every amenity across the resort.'],
  ['How do I book the Grand Aklan tour or a spa treatment?', 'Add them as extras during booking, or ask our concierge once you’ve arrived — availability is confirmed directly with our team.'],
  ['Can I check in early or check out late?', `Early check-in from 12:00 noon and late check-out until 4:00 PM are offered subject to availability; late check-out can be added while booking for ${money(8000)}.`],
  ['Is Wi-Fi free?', 'Yes. Complimentary high-speed Wi-Fi is available throughout every room and public space.']
]; };
const MENU = {
  Breakfast: [['Aklanon breakfast plate', 'Longganisa, garlic rice, two eggs, fresh tomato', 1450], ['Tropical fruit and yogurt bowl', 'Mango, pineapple, papaya, toasted coconut', 980], ['Pancakes with muscovado syrup', 'Served with whipped butter and banana', 1100], ['Continental basket', 'Pastries, preserves, butter, juice', 1200]],
  Mains: [['Chicken inubaran', 'Slow-cooked in coconut milk with banana blossom and lemongrass', 2100], ['Grilled pork belly', 'Atchara, mustard greens, native vinegar dip', 2300], ['Beef kaldereta', 'Braised short rib, potatoes, liver spread', 2600], ['Wild mushroom risotto', 'Parmesan, garlic chips, herb oil', 1950]],
  Seafood: [['Kinilaw na tanigue', 'Cured in coconut vinegar with ginger, chili and calamansi', 1850], ['Seared tuna belly', 'Calamansi butter, garden greens', 2900], ['Grilled prawns', 'Garlic, lemongrass, chili salt', 3200], ['Seafood sinigang', 'Tamarind broth, prawns, fish, water spinach', 2700]],
  Desserts: [['Ube and mango halo-halo', 'Shaved ice, ube halaya, ripe mango, leche flan', 980], ['Calamansi tart', 'Crisp shell, torched meringue', 900], ['Coconut panna cotta', 'Toasted coconut, palm sugar caramel', 950], ['Sticky rice suman', 'With ripe mango and chocolate sauce', 850]],
  Bar: [['Lume old fashioned', 'Aged rum, muscovado, bitters', 950], ['Sunset spritz', 'Sparkling wine, calamansi, mint', 850], ['Fresh calamansi juice', 'Lightly sweetened, over ice', 380], ['Young coconut', 'Served in the shell', 420], ['Reserve wine list', 'Curated by our sommelier', 1800]]
};
const DISHES = [[0, 'Chicken inubaran', 'Aklan’s comfort dish: chicken slow-cooked in coconut milk with banana blossom.', 2100], [1, 'Kinilaw na tanigue', 'Fresh mackerel tuna, cured in coconut vinegar, ginger and calamansi.', 1850], [2, 'Seared tuna belly', 'Seared over coals, finished with calamansi butter.', 2900], [3, 'Ube and mango halo-halo', 'Our sunset dessert, layered and served over shaved ice.', 980]];
const EXPERIENCES = [
  { key: 'beach', title: 'The Private Beach at Jawili', img: () => Art.beach(0), text: 'A reserved stretch of Jawili beach, held exclusively for our Beach Villa guests. Private cabanas, uncrowded sand and a dedicated beach butler for the length of your stay.', cta: ['See the Jawili Beach Villa', '/room/villa'] },
  { key: 'spa', title: 'Lume Spa', img: () => Art.spa(1), text: 'Private treatment suites and a relaxation lounge built around local ingredients — calamansi, coconut and native herbs — for a slower kind of morning or afternoon.', cta: ['View spa treatments', '/amenities#spa'] },
  { key: 'bar', title: 'Sunset Bar', img: () => Art.bar(0), text: 'An open-air bar on the water’s edge, built for the last hour of gold light. Aged rum, a reserve wine list and small plates from Lumina’s kitchen.', cta: ['View the bar menu', '/dining#bar'] },
  { key: 'tour', title: 'The Grand Aklan Tour', img: () => Art.heritage(0), text: 'A private, full-day guided journey through Aklan: heritage churches and ancestral towns, the falls at Jawili and Nabaoy, and a lunch stop chosen by our concierge.', cta: ['Ask about the Grand Aklan tour', '/contact'] }
];
const GALLERY = [
  ['Rooms', 'Deluxe Room bedroom', () => Art.room('deluxe', 0)], ['Rooms', 'Premier Room bathroom', () => Art.room('premier', 1)], ['Rooms', 'Executive Suite balcony', () => Art.room('executive', 2)], ['Rooms', 'Lume Suite living room', () => Art.room('lume', 3)], ['Rooms', 'Jawili Beach Villa bedroom', () => Art.room('villa', 0)],
  ['Lobby', 'The lobby at dusk', () => Art.lobby(0)], ['Restaurant', 'Lumina under lantern light', () => Art.restaurant(0)], ['Restaurant', 'Chicken inubaran', () => Art.dish(0)], ['Bar', 'Sunset Bar at golden hour', () => Art.bar(0)],
  ['Spa', 'A Lume Spa treatment suite', () => Art.spa(0)], ['Spa', 'The spa relaxation lounge', () => Art.spa(1)],
  ['Pool', 'The infinity pool at sunset', () => Art.pool(0)], ['Pool', 'The infinity pool by day', () => Art.pool(1)],
  ['Private beach', 'The private beach at Jawili', () => Art.beach(0)], ['Private beach', 'A private beachfront dinner', () => Art.beach(1)],
  ['Exterior', 'The hotel at dusk', () => Art.exterior(0)], ['Exterior', 'The hotel by day', () => Art.exterior(1)], ['Exterior', 'The hotel at night', () => Art.exterior(2)],
  ['Surroundings', 'Jawili shoreline at sunset', () => Art.surround(0)], ['Surroundings', 'Waterfall in the hills', () => Art.surround(1)], ['Surroundings', 'Palms along the coast', () => Art.surround(2)],
  ['Grand Aklan tour', 'A heritage town on the tour', () => Art.heritage(0)], ['Grand Aklan tour', 'The falls at Nabaoy', () => Art.heritage(1)],
  ['Guest experience', 'Breakfast on the terrace', () => Art.experience(0)], ['Guest experience', 'Evening by candlelight', () => Art.experience(1)], ['Guest experience', 'Lantern-lit walk to the beach', () => Art.experience(2)]
];

/* ---------- chrome ---------- */
function navHTML(solid) {
  const links = NAV.map(([h, l]) => `<a href="#${h}">${l}</a>`).join('') + '<a href="#/manage">Manage reservation</a>';
  return `<header class="nav ${solid ? 'solid' : ''}" id="nav"><div class="star-strip">★ ★ ★ ★ ★ &nbsp; Five-star resort, Jawili, Tangalan, Aklan</div>
<div class="nav-in wrap"><a class="brand" href="#/" aria-label="${esc(H().name)}, home"><img class="mark" src="/brand/logo-mark.png" alt=""><span>${esc(H().name)}</span></a><nav class="nav-links" aria-label="Main">${links}</nav><a class="btn gold sm nav-cta" href="#/book">Book now</a><button class="icon-btn nav-burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mnav">${ic('menu', 24)}</button></div>
<div class="mnav" id="mnav" hidden><nav aria-label="Mobile">${links}<a class="btn gold" href="#/book">Book your stay</a></nav></div></header>`;
}
function footerHTML() {
  const so = CONFIG.SOCIAL || {}; const soc = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']].filter(([k]) => so[k]).map(([k, l]) => `<a class="soc" href="${esc(so[k])}" target="_blank" rel="noopener" aria-label="${esc(H().name)} on ${l}">${ic(k, 20)}</a>`).join('');
  const q = [['/', 'Home'], ['/about', 'About'], ['/rooms', 'Rooms & Suites'], ['/experiences', 'Experiences'], ['/dining', 'Dining'], ['/amenities', 'Amenities'], ['/gallery', 'Gallery'], ['/location', 'Location'], ['/contact', 'Contact'], ['/manage', 'Manage Reservation']];
  return `<footer class="footer"><div class="wrap foot-grid"><div><p class="foot-brand"><img class="mark" src="/brand/logo-mark.png" alt="">${esc(H().name.toUpperCase())}</p><p class="foot-tag">${esc(H().tagline)}</p><p class="foot-addr">${esc(H().address)}</p><p><a href="tel:${esc(H().phone)}">${esc(H().phone)}</a><br><a href="mailto:${esc(H().email)}">${esc(H().email)}</a></p>${soc ? `<div class="socs">${soc}</div>` : ''}</div>
<nav aria-label="Quick links"><h4>Quick links</h4><ul>${q.map(([h, l]) => `<li><a href="#${h}">${l}</a></li>`).join('')}</ul></nav>
<div><h4>Staff</h4><p class="foot-note">Reservations, front desk and housekeeping are managed from our staff console.</p><p><a class="staff-link" href="#/staff">${ic('lock', 15)} Staff sign-in</a></p></div></div>
<div class="wrap foot-copy">© ${new Date().getFullYear()} ${esc(H().name)}. All Rights Reserved.</div></footer>`;
}
function siteShell(inner, { solid = false, footer = true } = {}) { return `<div class="site">${navHTML(solid)}<main id="main" class="enter">${inner}</main>${footer ? footerHTML() : ''}</div>`; }

/* ---------- home sections ---------- */
function heroHTML() {
  const S = getSearch(), t = todayISO();
  const opts = (n, from = 1) => Array.from({ length: n }, (_, i) => `<option value="${i + from}">${i + from}</option>`).join('');
  return `<section class="hero" id="top" aria-label="Welcome"><div class="hero-art" aria-hidden="true">${Art.heroSvg().replace('xMidYMid slice', 'xMidYMax slice')}</div><div class="hero-shade"></div>
<div class="wrap hero-in"><div class="hero-copy"><p class="stars-line">★ ★ ★ ★ ★</p><h1>${esc(H().name)}</h1><p class="tagline">${esc(H().tagline)}</p><p class="hero-intro">A five-star resort above the shore at Jawili, Tangalan — with a private beach, spa, sunset bar and views across the Sibuyan Sea.</p><div class="hero-cta"><a class="btn gold" href="#/book">Book Your Stay</a><a class="btn glass" href="#/rooms">Explore Rooms</a></div></div>
<form class="bookbar" id="bookbar" novalidate aria-label="Check availability"><div class="bb-field"><label for="bb-ci">Check-in</label><input id="bb-ci" type="date" name="ci" min="${t}" value="${S.ci}"></div><div class="bb-field"><label for="bb-co">Check-out</label><input id="bb-co" type="date" name="co" min="${addDays(t, 1)}" value="${S.co}"></div>
<div class="bb-field sm"><label for="bb-a">Adults</label><select id="bb-a" name="adults">${opts(6).replace(`value="${S.adults}"`, `value="${S.adults}" selected`)}</select></div><div class="bb-field sm"><label for="bb-c">Children</label><select id="bb-c" name="children">${opts(5, 0).replace(`value="${S.children}"`, `value="${S.children}" selected`)}</select></div><button class="btn gold" type="submit">Check availability</button></form></div></section>`;
}
function aboutHTML() {
  const vals = [['Light', 'Bright, clear spaces and warm lamplight, always. We also tell you plainly what is included and what it costs.'], ['Warmth', 'Hospitality that reads the guest: a chat if you want one, quiet if you don’t.'], ['Elegance', 'Well-made details, quietly done, rather than show.'], ['Comfort', 'Deep beds, cool rooms and strong showers. The essentials, done with five-star precision.'], ['Welcome', 'Everyone who walks in is treated as someone we were expecting.']];
  return `<section class="section about" id="about"><div class="wrap"><div class="about-grid"><div class="reveal"><h2>A name that means light</h2><p class="lead">In Italian, <i>lume</i> is a lamp, the kind you leave on for someone. We chose it because the best parts of a stay are lit ones: the lamp beside a freshly made bed, the glow of the lobby when you arrive after dark, the last gold hour over the water.</p><p>${esc(H().name)} stands at Jawili, in Tangalan, where the north coast of Aklan meets the Sibuyan Sea — a five-star resort built around a private beach, an award-worthy spa and unhurried, personal service.</p></div>
<div class="about-img reveal">${img(Art.lobby(0), H().name + ' lobby at dusk')}</div></div>
<div class="mv"><div class="reveal"><h3>Our mission</h3><p>To make every stay feel warm, unhurried and personal, through attentive five-star service, genuine comfort and food that tastes of Aklan.</p></div><div class="reveal"><h3>Our vision</h3><p>To be the resort travelers to northern Aklan remember first and return to, for the light, the welcome and the private stretch of beach that is entirely their own.</p></div></div>
<div class="values"><h3>What we hold to</h3><ul>${vals.map(([t, d]) => `<li class="reveal"><span class="lamp sm" aria-hidden="true"></span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}</ul></div>
<blockquote class="philosophy reveal">Hospitality is a way of paying attention. We notice, and then we act quietly.</blockquote>
<dl class="counters"><div><dt>rooms and suites</dt><dd data-count="${STATE.stats.rooms || 60}">0</dd></div><div><dt>hours a day at the front desk</dt><dd data-count="24">0</dd></div><div><dt>room categories</dt><dd data-count="${STATE.roomTypes.length || 5}">0</dd></div><div><dt>private beach, exclusively yours</dt><dd data-count="1">0</dd></div></dl></div></section>`;
}
function roomsSectionHTML() {
  const S = getSearch(), t = todayISO();
  return `<section class="section rooms" id="rooms"><div class="wrap"><div class="sec-head"><h2>Rooms and suites</h2><p class="lead">Five ways to stay, from the Deluxe Room to our own private beach villa, each with warm light and a view of the garden or the sea.</p></div>
<form class="filters" id="room-filters" aria-label="Filter rooms"><div class="field"><label for="rf-type">Room type</label><select id="rf-type" name="type"><option value="all">All rooms</option>${STATE.roomTypes.map(r => `<option value="${r.slug}">${r.name}</option>`).join('')}</select></div>
<div class="field"><label for="rf-guests">Guests</label><select id="rf-guests" name="guests"><option value="0">Any</option>${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n} or more</option>`).join('')}</select></div>
<div class="field"><label for="rf-price">Price per night</label><select id="rf-price" name="price"><option value="any">Any price</option><option value="low">Under ${money(95000)}</option><option value="mid">${money(95000)} to ${money(120000)}</option><option value="high">Over ${money(120000)}</option></select></div>
<div class="field"><label for="rf-avail">Availability</label><select id="rf-avail" name="avail"><option value="any">Show all</option><option value="dates">Available for my dates</option><option value="tonight">Available tonight</option></select></div>
<div class="field"><label for="rf-ci">Check-in</label><input id="rf-ci" type="date" name="ci" min="${t}" value="${S.ci}"></div><div class="field"><label for="rf-co">Check-out</label><input id="rf-co" type="date" name="co" min="${addDays(t, 1)}" value="${S.co}"></div></form>
<p class="results" id="rooms-count" aria-live="polite"></p><div class="room-grid" id="rooms-grid">${skel(4, 440)}</div></div></section>`;
}
function experiencesHTML() {
  return `<section class="section night experiences" id="experiences-home"><div class="wrap"><div class="sec-head"><h2>Signature experiences</h2><p class="lead">What sets a five-star stay apart: a beach that is only yours, a spa built around local ritual, a bar made for sunset, and Aklan itself.</p></div>
<div class="exp-grid">${EXPERIENCES.map(e => `<article class="exp-card reveal">${img(e.img(), e.title)}<div class="exp-body"><h3>${e.title}</h3><p>${e.text}</p><a class="link" href="#${e.cta[1]}">${e.cta[0]} ${ic('right', 15)}</a></div></article>`).join('')}</div></div></section>`;
}
function diningHTML() {
  const cats = Object.keys(MENU);
  return `<section class="section night dining" id="dining"><div class="wrap"><div class="sec-head"><h2>Lumina, Café Dawn and the Sunset Bar</h2><p class="lead">Lumina serves the Aklan coast on a plate: fresh fish, coconut, calamansi and garden greens. Café Dawn opens at six for coffee and pastries, and the Sunset Bar takes over as the light turns gold.</p></div>
<div class="dishes">${DISHES.map(([i, n, d, p]) => `<article class="dish reveal">${img(Art.dish(i), n)}<h3>${n}</h3><p>${d}</p><b>${money(p)}</b></article>`).join('')}</div>
<div class="menu-wrap" id="bar"><div class="tabs" role="tablist" aria-label="Menu categories">${cats.map((c, i) => `<button role="tab" class="tab ${i ? '' : 'on'}" aria-selected="${i ? 'false' : 'true'}" data-menu="${c}">${c}</button>`).join('')}</div><ul class="menu" id="menu-list"></ul>
<div class="hours"><h3>Opening hours</h3><dl><div><dt>Café Dawn</dt><dd>6:00 AM to 6:00 PM</dd></div><div><dt>Breakfast</dt><dd>6:30 to 10:30 AM</dd></div><div><dt>Lunch</dt><dd>11:30 AM to 2:30 PM</dd></div><div><dt>Dinner</dt><dd>5:30 to 10:00 PM</dd></div><div><dt>Sunset Bar</dt><dd>4:00 PM to midnight</dd></div><div><dt>In-room dining</dt><dd>24 hours</dd></div></dl><button class="btn gold" id="dine-book">Reserve a Table</button></div></div></div></section>`;
}
const menuHTML = cat => MENU[cat].map(([n, d, p]) => `<li><span class="dn"><b>${n}</b><small>${d}</small></span><span class="dots" aria-hidden="true"></span><span class="dp">${money(p)}</span></li>`).join('');
function amenitiesHTML() {
  return `<section class="section amen" id="amenities"><div class="wrap"><div class="sec-head"><h2>Everything within reach</h2><p class="lead">The signature experiences and everyday services that make a five-star stay.</p></div><ul class="amen-grid">${AMENITIES.map(([i, t, d]) => `<li class="reveal" id="${t === 'Lume Spa' ? 'spa' : ''}"><span class="amen-ic">${ic(i, 26)}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}</ul></div></section>`;
}
function galleryHTML() {
  const cats = ['All', ...new Set(GALLERY.map(g => g[0]))];
  return `<section class="section gallery" id="gallery"><div class="wrap"><div class="sec-head"><h2>Gallery</h2><p class="lead">Views of the rooms, the private beach, the spa, Lumina and the coast around us.</p></div><div class="chips-row" role="group" aria-label="Gallery categories">${cats.map((c, i) => `<button class="chip ${i ? '' : 'on'}" data-gcat="${c}" aria-pressed="${i ? 'false' : 'true'}">${c}</button>`).join('')}</div><div class="g-grid" id="g-grid"></div></div></section>`;
}
function gridHTML(cat) { return GALLERY.map((g, i) => [g, i]).filter(([g]) => cat === 'All' || g[0] === cat).map(([g, i], k) => `<button class="g-item s${k % 5}" data-gi="${i}" aria-label="Open photo: ${esc(g[1])}">${img(g[2](), g[1])}<span>${g[1]}</span></button>`).join(''); }
function locationHTML() {
  const key = CONFIG.GOOGLE_MAPS_API_KEY;
  const map = key ? `<iframe title="Map of ${esc(H().name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${MAPQ()}"></iframe>` : `${img(Art.map(), 'Illustrated map showing ' + H().name + ' at Jawili, Tangalan')}`;
  return `<section class="section location" id="location"><div class="wrap loc-grid"><div class="loc-info"><h2>Find us at Jawili</h2><p class="lead">${esc(H().name)}<br>${esc(H().address)}</p><ul class="dist"><li>${ic('plane', 20)}<span>Kalibo International Airport<br><small>about 40 minutes by car; chauffeured transfers available</small></span></li><li>${ic('sun', 20)}<span>Jawili Falls<br><small>a few minutes’ drive</small></span></li><li>${ic('route', 20)}<span>Caticlan jetty port, for Boracay<br><small>about 1 hour by car</small></span></li></ul><p class="muted small">Driving times are approximate and depend on traffic. We can arrange a chauffeured transfer.</p><div class="loc-cta"><a class="btn gold" href="https://www.google.com/maps/search/?api=1&query=${MAPQ()}" target="_blank" rel="noopener">Open in Google Maps</a><a class="btn line" href="https://www.google.com/maps/dir/?api=1&destination=${MAPQ()}" target="_blank" rel="noopener">Get directions</a></div></div>
<div class="map-card">${map}${key ? '' : ''}</div></div></section>`;
}
function contactHTML() {
  return `<section class="section night contact" id="contact"><div class="wrap contact-grid"><div><h2>Say hello</h2><p class="lead">Questions about a stay, the Grand Aklan tour, a spa booking or a special occasion? Write to us and we’ll reply within a day.</p><ul class="clist"><li>${ic('mail', 20)}<a href="mailto:${esc(H().email)}">${esc(H().email)}</a></li><li>${ic('phone', 20)}<a href="tel:${esc(H().phone)}">${esc(H().phone)}</a></li><li>${ic('pin', 20)}<span>${esc(H().address)}</span></li></ul></div>
<form class="cform" id="contact-form" novalidate>${field({ name: 'name', label: 'Name', attrs: 'autocomplete="name" required' })}${field({ name: 'email', label: 'Email', type: 'email', attrs: 'autocomplete="email" required inputmode="email"' })}${field({ name: 'phone', label: 'Phone', type: 'tel', attrs: 'autocomplete="tel" inputmode="tel"', hint: 'Optional' })}${field({ name: 'subject', label: 'Subject', attrs: 'required' })}${field({ name: 'message', label: 'Message', tag: 'textarea', attrs: 'required', cls: 'full' })}<button class="btn gold" type="submit">Send message</button></form></div></section>`;
}
function faqHTML() {
  return `<section class="section faq" id="faq"><div class="wrap faq-grid"><div class="sec-head"><h2>Good to know</h2><p class="lead">Answers to what guests ask us most. Anything else, just write.</p></div><div class="faq-list">${FAQ().map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div></section>`;
}
function homeHTML() { return heroHTML() + aboutHTML() + roomsSectionHTML() + experiencesHTML() + diningHTML() + amenitiesHTML() + galleryHTML() + locationHTML() + faqHTML() + contactHTML(); }

/* ---------- experiences standalone page (deep link target) ---------- */
function experiencesPageHTML() {
  return `<section class="section page-pad" id="experiences"><div class="wrap"><h1 class="h-page">Signature experiences</h1><p class="lead">What sets ${esc(H().name)} apart from an ordinary stay.</p><div class="exp-grid page">${EXPERIENCES.map(e => `<article class="exp-card reveal">${img(e.img(), e.title)}<div class="exp-body"><h3>${e.title}</h3><p>${e.text}</p><a class="btn line" href="#${e.cta[1]}">${e.cta[0]}</a></div></article>`).join('')}</div></div></section>`;
}

/* ---------- rooms list ---------- */
const RoomsUI = { avail: {}, tonight: {}, f: { type: 'all', guests: '0', price: 'any', avail: 'any' }, datesOk: false };
const priceOk = (p, f) => f === 'any' || (f === 'low' ? p < 95000 : f === 'mid' ? p >= 95000 && p <= 120000 : p > 120000);
function bookLink(slug, extra = '') { const S = getSearch(); return `#/book?type=${slug}&ci=${S.ci}&co=${S.co}&a=${S.adults}&c=${S.children}${extra}`; }
function roomCard(t) {
  const n = RoomsUI.avail[t.id], dOk = RoomsUI.datesOk;
  const tag = !dOk ? '' : n > 0 ? `<span class="avail ${n <= 2 ? 'warn' : 'ok'}">${n <= 2 ? `Only ${n} left` : `${n} available`} for your dates</span>` : '<span class="avail bad">Sold out for your dates</span>';
  const sold = dOk && !(n > 0);
  return `<article class="room-card" data-slug="${t.slug}"><a class="room-img" href="#/room/${t.slug}" aria-label="View ${esc(t.name)}">${img(Art.room(t.slug, 0), t.name + ' bedroom')}${tag}</a>
<div class="room-body"><div class="room-head"><h3><a href="#/room/${t.slug}">${t.name}</a></h3><p class="price"><b>${money(t.price)}</b><span>per night</span></p></div><p class="muted">${t.short}</p>
<ul class="facts"><li>${ic('users', 17)}Up to ${t.capacity} guests</li><li>${ic('bed', 17)}${t.beds}</li><li>${ic('ruler', 17)}${t.size} m²</li></ul><ul class="chips">${t.amenities.slice(0, 3).map(a => `<li>${a}</li>`).join('')}</ul>
<div class="room-cta"><a class="btn line" href="#/room/${t.slug}">View details</a><a class="btn gold ${sold ? 'disabled' : ''}" href="${sold ? '#/rooms' : bookLink(t.slug)}" ${sold ? 'aria-disabled="true" data-sold="1"' : ''}>Book Now</a></div></div></article>`;
}
async function loadRooms() {
  const grid = $('#rooms-grid'); if (!grid) return; const S = getSearch();
  try {
    RoomsUI.datesOk = !dateProblem(S.ci, S.co);
    RoomsUI.avail = RoomsUI.datesOk ? await API.availability(S.ci, S.co) : {}; RoomsUI.tonight = await API.availability(todayISO(), addDays(todayISO(), 1));
  } catch (e) { grid.innerHTML = `<div class="empty"><p>${esc(e.friendly ? e.message : MSG.NETWORK)}</p><button class="btn line" id="rooms-retry">Try again</button></div>`; return; }
  renderRooms();
}
function renderRooms() {
  const grid = $('#rooms-grid'); if (!grid) return; const { avail, tonight, f } = RoomsUI; const types = STATE.roomTypes;
  const list = types.filter(t => (f.type === 'all' || t.slug === f.type) && (+f.guests === 0 || t.capacity >= +f.guests) && priceOk(t.price, f.price) && (f.avail === 'any' || (f.avail === 'dates' ? (avail[t.id] || 0) > 0 : (tonight[t.id] || 0) > 0)));
  $('#rooms-count').textContent = list.length ? `${plural(list.length, 'room type')} shown` : '';
  grid.innerHTML = list.length ? list.map(roomCard).join('') : `<div class="empty"><p>No rooms match those filters. ${f.avail !== 'any' ? 'Try different dates or show all rooms.' : 'Try widening your guest count or price range.'}</p><button class="btn line" id="rooms-clear">Clear filters</button></div>`;
}

/* ---------- room details ---------- */
async function roomPageHTML(slug) {
  const t = STATE.roomTypes.find(x => x.slug === slug);
  if (!t) return { html: `<section class="section page-pad"><div class="wrap narrow"><h1 class="h-page">We couldn’t find that room</h1><p class="lead">It may have been renamed. Browse our rooms and suites instead.</p><a class="btn gold" href="#/rooms">See all rooms</a></div></section>`, t: null };
  const S = getSearch(); const q = API.quote({ typeId: t.id, ci: S.ci, co: S.co, adults: Math.min(S.adults, t.capacity), children: 0, addons: {} });
  const thumbs = [0, 1, 2, 3].map(i => `<button class="thumb ${i ? '' : 'on'}" data-view="${i}" aria-label="Show photo ${i + 1}">${img(Art.room(t.slug, i), '')}</button>`).join('');
  const others = STATE.roomTypes.filter(x => x.id !== t.id);
  const html = `<section class="section page-pad rd"><div class="wrap"><a class="back" href="#/rooms">${ic('left', 16)} All rooms</a><div class="rd-grid"><div class="rd-main"><div class="gal"><div class="gal-main"><img id="gal-img" src="${Art.room(t.slug, 0)}" alt="${esc(t.name)} photo 1"></div><div class="thumbs">${thumbs}</div></div>
<h1 class="h-page">${t.name}</h1><p class="lead">${t.description}</p><ul class="facts big"><li>${ic('users', 20)}<span>Up to ${t.capacity} guests</span></li><li>${ic('bed', 20)}<span>${t.beds}</span></li><li>${ic('ruler', 20)}<span>${t.size} m²</span></li><li>${ic('sun', 20)}<span>${t.view}</span></li></ul>
<h2 class="h-sub">Amenities</h2><ul class="am-list">${t.amenities.map(a => `<li>${ic('check', 16)}${a}</li>`).join('')}</ul>
<h2 class="h-sub">Availability</h2><p class="muted">Choose your dates on the calendar. Crossed-out nights are sold out.</p><div id="rd-cal" class="cal-host">${skel(1, 320)}</div>
<h2 class="h-sub">Policies</h2><ul class="policies">${roomPolicies().map(p => `<li>${ic('info', 16)}${p}</li>`).join('')}</ul></div>
<aside class="reserve" id="reserve"><p class="price"><b>${money(t.price)}</b><span>per night</span></p><form id="rd-form" novalidate><div class="two"><div class="field" data-field="ci"><label for="rd-ci">Check-in</label><input id="rd-ci" type="date" name="ci" min="${todayISO()}" value="${S.ci}"></div><div class="field" data-field="co"><label for="rd-co">Check-out</label><input id="rd-co" type="date" name="co" min="${addDays(todayISO(), 1)}" value="${S.co}"></div></div>
<div class="row"><span>Adults</span>${stepper('adults', Math.min(S.adults, t.capacity), 1, t.capacity, 'adults')}</div><div class="row"><span>Children</span>${stepper('children', Math.min(S.children, t.capacity - 1), 0, Math.max(0, t.capacity - 1), 'children')}</div>
<div class="calc" id="rd-calc" aria-live="polite"></div><button class="btn gold block" type="submit">Reserve Now</button><p class="muted small center">You won’t be charged yet. Free cancellation until ${CONFIG.FREE_CANCEL_HOURS} hours before check-in.</p></form></aside></div>
<h2 class="h-sub other">Other rooms</h2><div class="other-grid">${others.map(o => `<a class="other" href="#/room/${o.slug}">${img(Art.room(o.slug, 0), o.name)}<span><b>${o.name}</b><small>from ${money(o.price)} per night</small></span></a>`).join('')}</div></div></section>`;
  return { html, t };
}
function rdCalc(t) {
  const f = $('#rd-form'); if (!f) return; const d = fdata(f); const box = $('#rd-calc'); const p = dateProblem(d.ci, d.co);
  if (p) { box.innerHTML = `<p class="warn-text">${esc(p)}</p>`; return; }
  const q = API.quote({ typeId: t.id, ci: d.ci, co: d.co, adults: +d.adults, children: +d.children, addons: {} });
  box.innerHTML = `<div class="calc-row"><span>${money(t.price)} × ${plural(q.nights, 'night')}</span><b>${money(q.roomTotal)}</b></div>${q.extras ? `<div class="calc-row"><span>Extra adults</span><b>${money(q.extras)}</b></div>` : ''}<div class="calc-row"><span>Service charge</span><b>${money(q.service)}</b></div><div class="calc-row"><span>VAT</span><b>${money(q.vat)}</b></div><div class="calc-row total"><span>Total for ${plural(q.nights, 'night')}</span><b>${money(q.total)}</b></div>`;
}

/* ---------- date-range calendar ---------- */
const Cal = {
  async mount(host, { typeId = null, ci = '', co = '', onChange } = {}) {
    const st = { ci, co, typeId, view: (ci || todayISO()).slice(0, 7) + '-01', map: {}, host, onChange };
    host._cal = st; host.classList.add('cal'); await Cal.load(st); Cal.draw(st);
    host.onclick = e => {
      const nav = e.target.closest('[data-cnav]'); if (nav) { const d = parseISO(st.view); d.setMonth(d.getMonth() + +nav.dataset.cnav); if (iso(d) < todayISO().slice(0, 7) + '-01') return; st.view = iso(d); Cal.load(st).then(() => Cal.draw(st)); return; }
      const c = e.target.closest('[data-d]'); if (!c || c.disabled) return; Cal.pick(st, c.dataset.d);
    };
    return st;
  },
  async load(st) { try { st.map = await API.nightMap(st.view, 70, st.typeId); } catch (e) { st.map = {}; } },
  set(host, ci, co) { const st = host._cal; if (!st) return; st.ci = ci; st.co = co; st.view = (ci || todayISO()).slice(0, 7) + '-01'; Cal.load(st).then(() => Cal.draw(st)); },
  pick(st, d) {
    if (!st.ci || (st.ci && st.co) || d <= st.ci) { st.ci = d; st.co = ''; }
    else {
      for (let x = st.ci; x < d; x = addDays(x, 1)) if (st.map[x] === 0) { toast('Some nights in that range are fully booked. Pick a shorter stay or different dates.', 'error'); st.ci = d; st.co = ''; Cal.draw(st); return; }
      if (diffDays(st.ci, d) > CONFIG.MAX_NIGHTS) { toast(MSG.MAX_NIGHTS, 'error'); return; }
      st.co = d;
    }
    Cal.draw(st); if (st.onChange) st.onChange(st.ci, st.co);
  },
  draw(st) {
    const two = window.matchMedia && matchMedia('(min-width: 760px)').matches; const months = [st.view]; if (two) { const d = parseISO(st.view); d.setMonth(d.getMonth() + 1); months.push(iso(d)); }
    const t = todayISO(); const canPrev = st.view > t.slice(0, 7) + '-01';
    const one = m => {
      const first = parseISO(m), name = first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), pad0 = first.getDay(), days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); let cells = '';
      for (let i = 0; i < pad0; i++) cells += '<span class="c-blank"></span>';
      for (let i = 1; i <= days; i++) {
        const d = `${m.slice(0, 8)}${pad(i)}`; const past = d < t, sold = st.map[d] === 0, inR = st.ci && st.co && d > st.ci && d < st.co, isIn = d === st.ci, isOut = d === st.co;
        const dis = past || (sold && !(st.ci && !st.co && d > st.ci));
        const cls = ['c-day', past ? 'past' : '', sold && !past ? 'sold' : '', inR ? 'range' : '', isIn ? 'start' : '', isOut ? 'end' : '', d === t ? 'today' : ''].join(' ');
        cells += `<button type="button" class="${cls}" data-d="${d}" ${dis ? 'disabled' : ''} aria-label="${esc(fmtDate(d))}${sold ? ', sold out' : ''}" aria-pressed="${isIn || isOut || inR}">${i}</button>`;
      }
      return `<div class="c-month"><p class="c-title">${name}</p><div class="c-week" aria-hidden="true">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}</div><div class="c-days">${cells}</div></div>`;
    };
    st.host.innerHTML = `<div class="c-bar"><button type="button" class="icon-btn" data-cnav="-1" ${canPrev ? '' : 'disabled'} aria-label="Previous month">${ic('left')}</button><p class="c-sum" aria-live="polite">${st.ci ? `${fmtShort(st.ci)}${st.co ? ` to ${fmtShort(st.co)} · ${plural(diffDays(st.ci, st.co), 'night')}` : ': choose check-out'}` : 'Choose check-in'}</p><button type="button" class="icon-btn" data-cnav="1" aria-label="Next month">${ic('right')}</button></div><div class="c-months">${months.map(one).join('')}</div><p class="c-key"><span class="k sold"></span> Sold out <span class="k sel"></span> Your stay</p>`;
  }
};

/* ---------- lightbox ---------- */
function openLightbox(idx) {
  let i = idx; const list = GALLERY.map(g => ({ cat: g[0], cap: g[1], src: g[2]() }));
  const m = openModal({ title: 'Gallery', kind: 'lightbox', size: 'xl', body: `<figure class="lb"><button class="lb-nav prev" aria-label="Previous photo">${ic('left', 28)}</button><img alt=""><button class="lb-nav next" aria-label="Next photo">${ic('right', 28)}</button><figcaption></figcaption></figure>` });
  const show = n => { i = (n + list.length) % list.length; const im = $('.lb img', m.el); im.src = list[i].src; im.alt = list[i].cap; $('figcaption', m.el).textContent = `${list[i].cap} · ${list[i].cat}`; };
  m.el.addEventListener('click', e => { if (e.target.closest('.prev')) show(i - 1); if (e.target.closest('.next')) show(i + 1); });
  m.el.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); });
  show(i); setTimeout(() => $('.dialog', m.el).focus(), 80);
}

/* ---------- dining reservation ---------- */
function openDining() {
  const t = todayISO(); const times = ['12:00 PM', '12:30 PM', '1:00 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM'];
  const m = openModal({ title: 'Reserve a table at Lumina', body: `<form id="dine-form" novalidate><p class="muted">Tell us when you’d like to dine and we’ll confirm by email. Hotel guests and outside diners are both welcome.</p><div class="form-grid">${field({ name: 'name', label: 'Name', attrs: 'autocomplete="name" required' })}${field({ name: 'email', label: 'Email', type: 'email', attrs: 'autocomplete="email" required' })}${field({ name: 'phone', label: 'Phone', type: 'tel', attrs: 'autocomplete="tel"' })}${field({ name: 'date', label: 'Date', type: 'date', value: t, attrs: `min="${t}" required` })}${field({ name: 'time', label: 'Time', tag: 'select', options: times, value: '7:00 PM' })}<div class="field" data-field="party"><label>Guests</label>${stepper('party', 2, 1, 12, 'guests')}</div>${field({ name: 'notes', label: 'Notes', tag: 'textarea', hint: 'Allergies, celebrations, high chair', cls: 'full' })}</div><div class="dlg-actions"><button type="button" class="btn line" data-close>Cancel</button><button class="btn gold" type="submit">Send request</button></div></form>` });
  $('#dine-form', m.el).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, d = fdata(f); clearFieldErrors(f);
    if (!d.date || d.date < todayISO()) return showFieldErrors(f, { date: 'Choose today or a later date.' });
    const ok = await run(() => API.sendContact({ name: d.name, email: d.email, phone: d.phone, subject: `Table for ${d.party} on ${fmtShort(d.date)}, ${d.time}`, message: `Dining reservation request.\nDate: ${fmtDate(d.date)}\nTime: ${d.time}\nGuests: ${d.party}\nNotes: ${d.notes || 'None'}` }, 'dining'), { btn: $('[type=submit]', f), form: f });
    if (ok) { m.close(); toast('Request sent. We’ll confirm your table by email.'); }
  });
}

/* ---------- home wiring ---------- */
function mountHome() {
  observe($('#main'));
  const hero = $('.hero'); if (hero) hero.classList.add('go');
  $('#bookbar').addEventListener('submit', e => {
    e.preventDefault(); const d = fdata(e.target); const p = dateProblem(d.ci, d.co); if (p) return toast(p, 'error');
    setSearch({ ci: d.ci, co: d.co, adults: +d.adults, children: +d.children }); go('/book?step=2');
  });
  $('#bb-ci').addEventListener('change', e => { const co = $('#bb-co'); co.min = addDays(e.target.value || todayISO(), 1); if (!co.value || co.value <= e.target.value) co.value = addDays(e.target.value, 1); });
  const rf = $('#room-filters');
  rf.addEventListener('change', async e => {
    const d = fdata(rf);
    if (e.target.name === 'ci' || e.target.name === 'co') {
      if (e.target.name === 'ci' && (!d.co || d.co <= d.ci)) { d.co = addDays(d.ci, 1); $('#rf-co').value = d.co; }
      const p = dateProblem(d.ci, d.co); if (p) { toast(p, 'error'); return; } setSearch({ ci: d.ci, co: d.co }); await loadRooms(); return;
    }
    Object.assign(RoomsUI.f, { type: d.type, guests: d.guests, price: d.price, avail: d.avail }); renderRooms();
  });
  $('#rooms-grid').addEventListener('click', e => {
    if (e.target.id === 'rooms-clear') { RoomsUI.f = { type: 'all', guests: '0', price: 'any', avail: 'any' }; rf.reset(); renderRooms(); }
    if (e.target.id === 'rooms-retry') loadRooms();
    const sold = e.target.closest('[data-sold]'); if (sold) { e.preventDefault(); toast(MSG.NO_ROOMS, 'error'); }
  });
  loadRooms();
  const ml = $('#menu-list'); ml.innerHTML = menuHTML('Breakfast');
  $('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; $$('.tab').forEach(t => { t.classList.toggle('on', t === b); t.setAttribute('aria-selected', t === b); }); ml.innerHTML = menuHTML(b.dataset.menu); });
  $('#dine-book').onclick = openDining;
  const gg = $('#g-grid'); gg.innerHTML = gridHTML('All');
  $('.chips-row').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; $$('.chip', e.currentTarget).forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); }); gg.innerHTML = gridHTML(b.dataset.gcat); });
  gg.addEventListener('click', e => { const b = e.target.closest('[data-gi]'); if (b) openLightbox(+b.dataset.gi); });
  const cf = $('#contact-form');
  cf.addEventListener('submit', async e => {
    e.preventDefault(); clearFieldErrors(cf);
    const ok = await run(() => API.sendContact(fdata(cf)), { btn: $('[type=submit]', cf), form: cf });
    if (ok) { cf.reset(); toast('Thank you. Your message is with our team and we’ll reply within a day.'); }
  });
}

/* ---------- room page wiring ---------- */
async function mountRoomPage(t) {
  const S = getSearch(); const f = $('#rd-form');
  await Cal.mount($('#rd-cal'), { typeId: t.id, ci: S.ci, co: S.co, onChange: (ci, co) => { if (ci && co) { $('#rd-ci').value = ci; $('#rd-co').value = co; setSearch({ ci, co }); rdCalc(t); } } });
  rdCalc(t);
  $('.thumbs').addEventListener('click', e => { const b = e.target.closest('.thumb'); if (!b) return; $$('.thumb').forEach(x => x.classList.toggle('on', x === b)); const im = $('#gal-img'); im.src = Art.room(t.slug, +b.dataset.view); im.alt = `${t.name} photo ${+b.dataset.view + 1}`; });
  f.addEventListener('change', e => {
    if (e.target.name === 'ci') { const co = $('#rd-co'); co.min = addDays(e.target.value || todayISO(), 1); if (!co.value || co.value <= e.target.value) co.value = addDays(e.target.value, 1); }
    const d = fdata(f); if (!dateProblem(d.ci, d.co)) { setSearch({ ci: d.ci, co: d.co, adults: +d.adults, children: +d.children }); Cal.set($('#rd-cal'), d.ci, d.co); }
    rdCalc(t);
  });
  f.addEventListener('submit', async e => {
    e.preventDefault(); const d = fdata(f); const p = dateProblem(d.ci, d.co); if (p) return toast(p, 'error');
    setSearch({ ci: d.ci, co: d.co, adults: +d.adults, children: +d.children });
    const av = await run(() => API.availability(d.ci, d.co), { btn: $('[type=submit]', f) }); if (!av) return;
    if (!(av[t.id] > 0)) return toast(MSG.ROOM_UNAVAILABLE, 'error');
    go(`/book?type=${t.slug}&ci=${d.ci}&co=${d.co}&a=${d.adults}&c=${d.children}&step=3`);
  });
}
