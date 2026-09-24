'use strict';
/* ==========================================================================
   Icons + illustrated scenes.
   Photography can't ship inside a self-contained page, so every image slot is
   filled by a generated illustration. To use real photos, set a URL for the
   slot in IMAGE_OVERRIDES (host the files on your own site/CDN).
   ========================================================================== */
// Populated at startup from the server's photo library (see /api/config → photos).
// Until the hotel uploads a real photograph for a slot, that slot falls back to an illustration.
const IMAGE_OVERRIDES = {};
function setPhotoLibrary(photos) { Object.keys(IMAGE_OVERRIDES).forEach(k => delete IMAGE_OVERRIDES[k]); Object.assign(IMAGE_OVERRIDES, photos || {}); }

const ICONS = {
  menu: 'M4 7h16M4 12h16M4 17h16', close: 'M6 6l12 12M18 6L6 18', calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 17.5V19M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1.2a3 3 0 0 0-2.2-2.9M16 5.2a3 3 0 0 1 0 5.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1', bed: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12.5a1.5 1.5 0 1 0 0-.01',
  ruler: 'M3 16L16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2', wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10.5 10.5 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19.5v.01',
  pool: 'M2 17c2 0 2-1.5 5-1.5S9 17 12 17s2-1.5 5-1.5S20 17 22 17M2 21c2 0 2-1.5 5-1.5S9 21 12 21s2-1.5 5-1.5S20 21 22 21M8 13V6a2 2 0 0 1 4 0M14 13V6a2 2 0 0 1 4 0M8 9h6',
  utensils: 'M6 3v8a2 2 0 0 0 2 2v8M10 3v6M6 3v6M18 21V3c-2.5 1.5-3 4.5-3 8h3', coffee: 'M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h2a2.5 2.5 0 0 1 0 5h-2M8 3v2M12 3v2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2', sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  car: 'M5 16H3v-4l2-5h14l2 5v4h-2M5 16a2 2 0 1 0 4 0M15 16a2 2 0 1 0 4 0M9 16h6M3 12h18', bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  tray: 'M3 17h18M5 17a7 7 0 0 1 14 0M12 7v3M10 7h4', leaf: 'M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19c3-5 6-8 10-10', dumbbell: 'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12',
  plane: 'M3 13l8-2 4-7 2 .5-2 7 6 1.5 1.5-2 1 .5-1 3.5-7-1.5-2 5-2-.5 1-5z', shirt: 'M8 3L3 6l2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0',
  phone: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2', mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5', check: 'M5 12.5l4.5 4.5L19 7.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11v5M12 8v.01', print: 'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  download: 'M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14', dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  key: 'M15 8a4 4 0 1 0-1 2.6L21 17v3h-3v-2h-2v-2h-2.5', broom: 'M14 3l7 7M4 20l4-1 8-8-3-3-8 8zM5 17l2 2', chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01', alert: 'M12 4l9 16H3zM12 10v4M12 17v.01', left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6',
  facebook: 'M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5', instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17.5 6.5h.01',
  tiktok: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.3 2.5 2 4 4.5 4.2', shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z', edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13', plus: 'M12 5v14M5 12h14', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01', home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7', tv: 'M4 6h16v11H4zM8 21h8M12 17v4', bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v3M4 7a2 2 0 0 1 2-2h11M4 7v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3M20 11h-4a2 2 0 0 0 0 4h4z', bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  hotel: 'M4 20V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v14M15 10h4a1 1 0 0 1 1 1v9M2 20h20M8 9h3M8 13h3M8 17h3', refresh: 'M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4', filter: 'M4 5h16l-6 8v6l-4-2v-4z'
};
const ic = (n, s = 20, extra = '') => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${ICONS[n] || ICONS.info}"/></svg>`;

const Art = (() => {
  const rng = seed => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };
  const wrap = (inner, defs = '', cls = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" class="${cls}"><defs>${defs}</defs>${inner}</svg>`;
  const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
  const rg = (id, stops, cx = .5, cy = .5, r = .5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
  const glow = (id, x, y, r, c = '#FFD9A0', a = .9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})" opacity="${a}"/>`;
  const glowDef = (id, c = '#FFD9A0') => rg(id, [[0, c, .95], [.35, c, .35], [1, c, 0]]);
  const palm = (x, y, h, c = '#0a2229', flip = 1) => {
    const tx = x + flip * h * .16, ty = y - h; let f = '';
    [-165, -135, -105, -75, -45, -15, 15].forEach((a, i) => { const rad = a * Math.PI / 180; const L = h * (.52 + (i % 2) * .08); const ex = tx + Math.cos(rad) * L, ey = ty + Math.sin(rad) * L * .55 + L * .3; const cx = tx + Math.cos(rad) * L * .55, cy = ty + Math.sin(rad) * L * .55 - h * .08; f += `<path d="M${tx} ${ty} Q${cx} ${cy - 8} ${ex} ${ey} Q${cx} ${cy + 10} ${tx} ${ty}Z"/>`; });
    return `<g fill="${c}"><path d="M${x - 5} ${y} Q${x + flip * h * .1} ${y - h * .5} ${tx - 3} ${ty}L${tx + 3} ${ty} Q${x + flip * h * .12 + 6} ${y - h * .5} ${x + 6} ${y}Z"/>${f}</g>`;
  };
  const stars = (n, seed, y1 = 200, op = .9) => { const r = rng(seed); let o = ''; for (let i = 0; i < n; i++) o += `<circle class="tw" style="animation-delay:${(r() * 4).toFixed(1)}s" cx="${(r() * 800).toFixed(0)}" cy="${(r() * y1).toFixed(0)}" r="${(r() * 1.3 + .4).toFixed(1)}" fill="#fff" opacity="${(op * (.4 + r() * .6)).toFixed(2)}"/>`; return o; };
  const arch = (x, y, w, h, fill, stroke = '') => `<path d="M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}Z" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="3"` : ''}/>`;

  const sky = { dusk: [[0, '#16274a'], [.4, '#6a5786'], [.72, '#ee9f68'], [1, '#ffd8a0']], day: [[0, '#4d9fce'], [.6, '#a8d8ec'], [1, '#f6efd9']], night: [[0, '#050f1a'], [.6, '#123049'], [1, '#2c4b60']], dawn: [[0, '#3a4b78'], [.45, '#c58bb0'], [.8, '#ffb98a'], [1, '#ffe2b0']] };

  function exterior(v = 0, animate = false) {
    const k = ['dusk', 'day', 'night'][v]; const R = rng(11 + v); const lit = v === 1 ? .0 : .68;
    const wall = v === 1 ? '#f4efe4' : '#e8dcc6', wallS = v === 1 ? '#ddd3bf' : '#a58d6a', deep = v === 1 ? '#2a4750' : '#132831';
    let win = '';
    [[196, 340, 9, 44], [176, 288, 10, 44], [216, 236, 8, 36]].forEach(([x0, y0, n, w], row) => { for (let i = 0; i < n; i++) { const on = R() < lit; const wx = x0 + i * ((v === 1 ? 46 : 46)) + (row === 2 ? 20 : 0); if (wx + 30 > 620 || wx < 176) continue; win += `<rect x="${wx}" y="${y0}" width="30" height="34" rx="3" fill="${on ? '#ffd48a' : deep}" ${on && animate ? `class="lit" style="animation-delay:${(R() * 6).toFixed(1)}s"` : ''} ${on ? '' : 'opacity=".9"'}/>`; } });
    const inner = `<rect width="800" height="600" fill="url(#sk)"/>${v === 2 ? stars(70, 5) : v === 0 ? stars(26, 3, 170, .7) : ''}
${v === 1 ? '<circle cx="640" cy="120" r="42" fill="#fff7dc"/>' : v === 0 ? glow('gs', 610, 330, 210, '#ffbf78', .95) + '<circle cx="610" cy="332" r="46" fill="#ffe2a8"/>' : '<circle cx="640" cy="110" r="30" fill="#f5f0dd" opacity=".95"/>'}
<rect y="328" width="800" height="140" fill="url(#sea)"/>
<g stroke="${v === 1 ? '#fff' : '#ffd9a0'}" stroke-opacity=".35" stroke-width="2">${[352, 366, 382, 400, 420, 442].map((y, i) => `<line x1="${560 - i * 12}" x2="${680 + i * 14}" y1="${y}" y2="${y}"/>`).join('')}</g>
<path d="M0 448Q200 434 420 450T800 440V520H0Z" fill="${v === 1 ? '#efe2c2' : '#b89a6c'}"/>
<g><rect x="150" y="380" width="500" height="92" fill="${wall}"/><rect x="170" y="316" width="440" height="66" fill="${wall}"/><rect x="200" y="256" width="360" height="62" fill="${wall}"/>
<rect x="138" y="372" width="524" height="12" rx="3" fill="${wallS}"/><rect x="160" y="308" width="460" height="10" rx="3" fill="${wallS}"/><rect x="190" y="248" width="380" height="10" rx="3" fill="${wallS}"/>
${win}
${arch(348, 392, 104, 80, '#ffd7a0')}${glow('gw', 400, 440, 120, '#ffcc85', .55)}<path d="M400 396v76M366 420h68" stroke="${deep}" stroke-width="2.5" opacity=".55"/>
<rect x="146" y="470" width="508" height="8" fill="${wallS}"/></g>
<rect y="478" width="800" height="122" fill="url(#pool)"/><rect y="478" width="800" height="7" fill="${v === 1 ? '#efe3c9' : '#d9c39a'}"/>
<g opacity=".55" stroke="#ffe3b0" stroke-width="2">${[500, 512, 526, 542, 560].map((y, i) => `<path d="M${200 + i * 20} ${y}q40 -6 80 0t80 0t80 0t80 0"/>`).join('')}</g>
${palm(92, 500, 250)}${palm(730, 505, 280, undefined, -1)}${palm(40, 520, 170, '#08181e')}`;
    const defs = lg('sk', sky[k]) + lg('sea', v === 1 ? [[0, '#a6d7e5'], [1, '#3f9dbb']] : v === 0 ? [[0, '#f0a97a'], [.4, '#8a6a92'], [1, '#233b58']] : [[0, '#2c4b60'], [1, '#08202f']]) + lg('pool', v === 1 ? [[0, '#7fd3d8'], [1, '#2b9bb0']] : v === 0 ? [[0, '#e9a07c'], [.4, '#4a7c96'], [1, '#12395a']] : [[0, '#1f6b7f'], [1, '#08242f']]) + glowDef('gs', '#ffbf78') + glowDef('gw');
    return wrap(inner, defs);
  }

  function pool(v = 0) {
    const day = v === 1;
    const inner = `<rect width="800" height="600" fill="url(#sk)"/>${day ? '' : stars(20, 9, 120, .6)}${day ? '<circle cx="180" cy="120" r="38" fill="#fff7dc"/>' : glow('g1', 200, 250, 230, '#ffb26b', .9) + '<circle cx="200" cy="252" r="40" fill="#ffe3ac"/>'}
<rect y="250" width="800" height="120" fill="url(#sea)"/>
<rect y="366" width="800" height="234" fill="#d8c7a4"/>
<path d="M60 372H740L800 600H0Z" fill="url(#pw)"/><path d="M60 372H740" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>
<g stroke="#fff" stroke-opacity=".28" stroke-width="2" fill="none">${[400, 430, 466, 508, 556].map((y, i) => `<path d="M${90 - i * 16} ${y}q60 -8 120 0t120 0t120 0t120 0t120 0t120 0"/>`).join('')}</g>
<g opacity=".7" fill="url(#ref)"><rect x="160" y="378" width="90" height="180"/></g>
${[[120, 350], [560, 340], [660, 350]].map(([x, y], i) => `<g><rect x="${x - 4}" y="${y - 6}" width="8" height="70" fill="#5b4a35"/><path d="M${x - 62} ${y - 6}Q${x} ${y - 52} ${x + 62} ${y - 6}Z" fill="${['#f2e6cf', '#e9d3a3', '#f2e6cf'][i]}"/></g>`).join('')}
${[[300, 560], [520, 575]].map(([x, y]) => `<g fill="#f4ead6"><path d="M${x} ${y}h90l16 -34h-30z" opacity=".95"/><path d="M${x + 4} ${y}v12M${x + 86} ${y}v12" stroke="#8a7350" stroke-width="3"/></g>`).join('')}
${palm(40, 400, 290)}${palm(770, 420, 250, undefined, -1)}`;
    const defs = lg('sk', day ? sky.day : sky.dusk) + lg('sea', day ? [[0, '#9dd5e6'], [1, '#3a97b8']] : [[0, '#f2a97b'], [.5, '#7a6390'], [1, '#243d5a']]) + lg('pw', day ? [[0, '#8fe0dc'], [1, '#24a3b3']] : [[0, '#f0a583'], [.35, '#5f9bb1'], [1, '#0f6f86']]) + lg('ref', [[0, '#fff', .5], [1, '#fff', 0]]) + glowDef('g1', '#ffb26b');
    return wrap(inner, defs);
  }

  function lobby(v = 0) {
    const warm = v === 0 ? '#e9dcc3' : '#d8c8a8';
    let pend = ''; [130, 250, 400, 550, 670].forEach((x, i) => { const h = 90 + (i % 2) * 40; pend += `<line x1="${x}" x2="${x}" y1="0" y2="${h}" stroke="#a8874a" stroke-width="2"/><circle cx="${x}" cy="${h + 16}" r="16" fill="#ffe3b0"/>${glow('gl', x, h + 16, 70, '#ffcf8a', .8)}`; });
    const inner = `<rect width="800" height="600" fill="${warm}"/><rect width="800" height="120" fill="url(#ceil)"/>
${[70, 300, 530].map(x => arch(x, 120, 200, 260, 'url(#win)')).join('')}
${[70, 300, 530].map(x => `<path d="M${x + 100} 220v160M${x} 300h200" stroke="#8a7350" stroke-width="3" opacity=".5"/>`).join('')}
<rect y="380" width="800" height="220" fill="url(#floor)"/>
<g><rect x="230" y="368" width="340" height="80" rx="6" fill="#3e2e1f"/><rect x="230" y="360" width="340" height="14" rx="4" fill="#d5b27a"/><rect x="330" y="300" width="140" height="60" rx="4" fill="#12303a"/><path d="M390 312l10 -10 10 10z" fill="#c29a4b"/><text x="400" y="345" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#f2e2bf">LUME</text></g>
<ellipse cx="400" cy="540" rx="230" ry="34" fill="#12303a" opacity=".22"/>
${pend}
${[[90, 420], [710, 430]].map(([x, y]) => `<g><rect x="${x - 26}" y="${y + 30}" width="52" height="46" rx="6" fill="#b28a4e"/><g fill="#2c6a52"><path d="M${x} ${y + 30}q-40 -40 -50 -8q20 -6 50 8z"/><path d="M${x} ${y + 30}q40 -50 50 -14q-24 -4 -50 14z"/><path d="M${x} ${y + 30}q-10 -60 14 -70q6 34 -14 70z"/></g></g>`).join('')}
<g fill="#f4ecdc" opacity=".9"><rect x="120" y="470" width="120" height="50" rx="16"/><rect x="560" y="480" width="120" height="50" rx="16"/></g>`;
    const defs = lg('ceil', [[0, '#a48a5c', .55], [1, '#a48a5c', 0]]) + lg('win', [[0, '#7fa1c7'], [.55, '#f1b481'], [1, '#ffe0a8']]) + lg('floor', [[0, '#e6d8bd'], [1, '#bda680']]);
    return wrap(inner, defs);
  }

  function restaurant(v = 0) {
    const R = rng(70 + v);
    let tables = ''; [[150, 470, 1.15], [400, 500, 1.3], [650, 470, 1.15], [270, 410, .8], [540, 410, .8]].forEach(([x, y, s]) => {
      tables += `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="26" rx="62" ry="12" fill="#000" opacity=".25"/><rect x="-5" y="0" width="10" height="26" fill="#3c2c1e"/><ellipse cx="0" cy="0" rx="60" ry="14" fill="#f3ead8"/><ellipse cx="0" cy="-2" rx="60" ry="14" fill="none" stroke="#c29a4b" stroke-opacity=".5"/><rect x="-3" y="-20" width="6" height="18" fill="#f8efdc"/>${glow('gc' + v, 0, -26, 40, '#ffc678', .95)}<ellipse cx="0" cy="-24" rx="3" ry="6" fill="#ffe08a"/><circle cx="-34" cy="-6" r="7" fill="#fff"/><circle cx="34" cy="-6" r="7" fill="#fff"/></g>
      <g fill="#2b1f15"><rect x="${x - 88 * s}" y="${y - 24 * s}" width="${22 * s}" height="${54 * s}" rx="8"/><rect x="${x + 66 * s}" y="${y - 24 * s}" width="${22 * s}" height="${54 * s}" rx="8"/></g>`;
    });
    let pend = ''; for (let i = 0; i < 9; i++) { const x = 60 + i * 84; const h = 70 + R() * 34; pend += `<line x1="${x}" x2="${x}" y1="0" y2="${h}" stroke="#7a5f37"/><path d="M${x - 15} ${h + 22}a15 15 0 0 1 30 0z" fill="#c29a4b"/>${glow('gp' + v, x, h + 24, 52, '#ffc678', .85)}`; }
    const inner = `<rect width="800" height="600" fill="#211812"/>
${[60, 350, 590].map(x => arch(x, 110, 150, 230, 'url(#nwin)')).join('')}${stars(30, 21, 300, .8).replace(/cy="(\d+)"/g, (m, y) => `cy="${140 + (+y % 150)}"`)}
<path d="M0 340h800v260H0z" fill="url(#rfl)"/>${pend}
<rect y="330" width="800" height="16" fill="#3a2a1b"/>${tables}`;
    const defs = lg('nwin', [[0, '#0b1e33'], [1, '#365b73']]) + lg('rfl', [[0, '#4a3524'], [1, '#1c130c']]) + glowDef('gc' + v, '#ffc678') + glowDef('gp' + v, '#ffc678');
    return wrap(inner, defs);
  }

  const PAL = { deluxe: { wall: '#e9e1cf', accent: '#9fb59c', linen: '#fbf7ee', floor: '#b79a70', wood: '#7a5b3a' }, premier: { wall: '#e4e8ea', accent: '#7d9bb0', linen: '#fbfaf6', floor: '#a88f6a', wood: '#5f4a35' }, executive: { wall: '#3b3630', accent: '#c29a4b', linen: '#f1e8d6', floor: '#6a5540', wood: '#2a211a' }, lume: { wall: '#12303a', accent: '#d9b46a', linen: '#f6eede', floor: '#8c7350', wood: '#1d3b45' } };
  function room(kind, slug) {
    const P = PAL[slug] || PAL.deluxe; const dark = slug === 'executive' || slug === 'lume';
    const sea = `<path d="M0 0h800v600H0z" fill="url(#rs)"/>`;
    let inner;
    if (kind === 'bed') {
      inner = `<rect width="800" height="600" fill="${P.wall}"/><g>${arch(520, 70, 220, 260, 'url(#rs)')}<path d="M630 190v200M520 290h220" stroke="${P.wood}" stroke-width="4" opacity=".55"/></g>
<rect y="420" width="800" height="180" fill="${P.floor}"/><rect y="416" width="800" height="8" fill="${P.wood}" opacity=".6"/>
<ellipse cx="300" cy="560" rx="300" ry="32" fill="${P.accent}" opacity=".45"/>
<rect x="110" y="200" width="380" height="210" rx="14" fill="${P.wood}"/><rect x="132" y="222" width="336" height="160" rx="10" fill="${P.accent}" opacity=".85"/>
<rect x="100" y="352" width="400" height="120" rx="18" fill="${P.linen}"/><rect x="100" y="420" width="400" height="76" rx="12" fill="${P.accent}"/><rect x="92" y="428" width="416" height="12" fill="#000" opacity=".08"/>
<rect x="128" y="322" width="150" height="58" rx="16" fill="#fff"/><rect x="312" y="322" width="150" height="58" rx="16" fill="#fff"/><rect x="168" y="336" width="90" height="34" rx="10" fill="${P.accent}" opacity=".7"/>
${[[38, 380], [520, 380]].map(([x, y]) => `<g><rect x="${x}" y="${y}" width="58" height="80" rx="6" fill="${P.wood}"/>${glow('lg', x + 29, y - 26, 80, '#ffd08a', .8)}<path d="M${x + 12} ${y - 6}l6 -34h22l6 34z" fill="#ffe5b4"/></g>`).join('')}
<circle cx="300" cy="120" r="46" fill="none" stroke="${dark ? P.accent : P.wood}" stroke-width="3" opacity=".6"/><circle cx="300" cy="120" r="30" fill="${P.accent}" opacity=".35"/>`;
    } else if (kind === 'bath') {
      inner = `<rect width="800" height="600" fill="${dark ? '#26343a' : '#efe9dc'}"/>${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 100}" x2="${i * 100}" y1="0" y2="430" stroke="#000" stroke-opacity=".07"/>`).join('')}
<rect y="430" width="800" height="170" fill="${P.floor}"/>
${arch(290, 70, 220, 250, '#fbf4e2')}${arch(302, 84, 196, 230, 'url(#rs)')}${glow('lg', 400, 200, 260, '#ffe0a8', .35)}
${[[150, 190], [650, 190]].map(([x, y]) => `<g><rect x="${x - 4}" y="${y}" width="8" height="46" fill="${P.accent}"/>${glow('lg', x, y - 14, 60, '#ffd08a', .95)}<circle cx="${x}" cy="${y - 14}" r="12" fill="#ffe5b4"/></g>`).join('')}
<g><ellipse cx="400" cy="500" rx="240" ry="44" fill="#000" opacity=".2"/><path d="M170 400h460q-6 96 -110 108H280Q176 496 170 400Z" fill="#fbfaf5"/><ellipse cx="400" cy="400" rx="230" ry="26" fill="#e8f2f0"/><ellipse cx="400" cy="402" rx="200" ry="17" fill="#bfe1e3"/><path d="M620 300q0 -60 -40 -70v170" stroke="${P.accent}" stroke-width="7" fill="none" stroke-linecap="round"/></g>
<g><rect x="70" y="330" width="80" height="100" rx="8" fill="${P.wood}"/><rect x="84" y="300" width="52" height="34" rx="6" fill="#f4ecd9"/><rect x="88" y="270" width="44" height="34" rx="6" fill="#fff"/></g>`;
    } else if (kind === 'balcony') {
      inner = `${sea}<rect y="400" width="800" height="200" fill="${P.floor}"/><rect y="384" width="800" height="16" fill="${P.wood}"/>${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 42 + 10}" y="300" width="6" height="90" fill="${P.wood}"/>`).join('')}<rect y="290" width="800" height="14" fill="${P.wood}"/>
${glow('lg', 400, 250, 320, '#ffb26b', .6)}
<g><ellipse cx="580" cy="540" rx="130" ry="18" fill="#000" opacity=".22"/><ellipse cx="580" cy="470" rx="54" ry="12" fill="${P.linen}"/><rect x="575" y="470" width="10" height="66" fill="${P.wood}"/><path d="M470 460q10 -80 60 -90v90zM690 460q-10 -80 -60 -90v90z" fill="${P.accent}"/><rect x="466" y="452" width="70" height="60" rx="12" fill="${P.accent}"/><rect x="624" y="452" width="70" height="60" rx="12" fill="${P.accent}"/></g>
<g><rect x="150" y="470" width="60" height="70" rx="6" fill="#b97f4a"/><g fill="#2c6a52"><path d="M180 470q-46 -50 -60 -8 24 -6 60 8z"/><path d="M180 470q46 -60 60 -14 -28 -6 -60 14z"/><path d="M180 470q-16 -80 12 -92 10 44 -12 92z"/></g></g>
<g>${glow('lg', 340, 442, 70, '#ffd08a', .9)}<rect x="326" y="440" width="28" height="44" rx="10" fill="#f0c98a"/><rect x="334" y="424" width="12" height="18" fill="#7a5b3a"/></g>`;
    } else {
      inner = `<rect width="800" height="600" fill="${P.wall}"/>${arch(60, 80, 220, 270, 'url(#rs)')}${arch(520, 80, 220, 270, 'url(#rs)')}
<rect y="430" width="800" height="170" fill="${P.floor}"/><ellipse cx="400" cy="520" rx="300" ry="50" fill="${P.accent}" opacity=".5"/>
<g><rect x="190" y="340" width="420" height="100" rx="24" fill="${dark ? '#8b6b3a' : P.accent}"/><rect x="170" y="370" width="60" height="100" rx="20" fill="${dark ? '#8b6b3a' : P.accent}"/><rect x="570" y="370" width="60" height="100" rx="20" fill="${dark ? '#8b6b3a' : P.accent}"/><rect x="220" y="320" width="360" height="66" rx="20" fill="${P.linen}" opacity=".95"/><rect x="200" y="380" width="400" height="60" rx="14" fill="${dark ? '#a0783f' : P.accent}"/></g>
<g><ellipse cx="400" cy="500" rx="120" ry="26" fill="${P.wood}"/><rect x="384" y="470" width="32" height="34" fill="${P.wood}"/><ellipse cx="400" cy="470" rx="120" ry="20" fill="${dark ? '#3a2a1a' : '#7a5b3a'}"/><circle cx="360" cy="452" r="14" fill="#f0e0bd"/><rect x="420" y="440" width="34" height="26" rx="4" fill="${P.accent}"/></g>
<g><line x1="90" x2="90" y1="300" y2="470" stroke="#a8874a" stroke-width="4"/>${glow('lg', 90, 290, 100, '#ffd08a', .95)}<path d="M62 300l10 -50h36l10 50z" fill="#ffe5b4"/></g>
<g><rect x="690" y="180" width="70" height="250" fill="${P.wood}"/>${Array.from({ length: 4 }, (_, i) => `<rect x="696" y="${190 + i * 60}" width="58" height="44" fill="${P.accent}" opacity=".55"/>`).join('')}</g>`;
    }
    const defs = lg('rs', [[0, '#26436a'], [.4, '#8b7096'], [.62, '#f0a878'], [.68, '#ffd9a0'], [.69, '#3f6f8f'], [1, '#173a58']]) + glowDef('lg', '#ffd08a');
    return wrap(inner, defs);
  }

  function surround(v = 0) {
    let inner, defs;
    if (v === 0) {
      inner = `<rect width="800" height="600" fill="url(#sk)"/>${glow('g', 400, 330, 260, '#ffc98a', .95)}<circle cx="400" cy="332" r="44" fill="#fff1c9"/>
<rect y="330" width="800" height="200" fill="url(#sea)"/><g stroke="#fff3d0" stroke-opacity=".5" stroke-width="2">${[352, 372, 396, 424].map((y, i) => `<line x1="${380 - i * 30}" x2="${420 + i * 30}" y1="${y}" y2="${y}"/>`).join('')}</g>
<g fill="#1a2a35"><path d="M250 420q150 26 300 0l-18 22q-130 22 -264 0z"/><path d="M300 420l6 -70 4 70zM384 420l-4 -84 34 84z" opacity=".9"/><path d="M220 442q30 -6 70 0" stroke="#1a2a35" stroke-width="6" fill="none"/><path d="M520 442q30 -6 70 0" stroke="#1a2a35" stroke-width="6" fill="none"/><path d="M256 446h284" stroke="#1a2a35" stroke-width="5"/></g>
<path d="M0 520q200 -30 420 -6T800 500V600H0Z" fill="#e3c89a"/>${palm(700, 560, 330, '#12282c', -1)}${palm(90, 570, 250, '#12282c')}`;
      defs = lg('sk', sky.dawn) + lg('sea', [[0, '#f5b98b'], [.4, '#8f7a9a'], [1, '#33506d']]) + glowDef('g', '#ffc98a');
    } else if (v === 1) {
      inner = `<rect width="800" height="600" fill="url(#sk)"/>
<path d="M0 300Q120 190 260 260T520 230T800 280V600H0Z" fill="#5c9a7a"/><path d="M0 360Q160 270 320 330T620 300T800 350V600H0Z" fill="#3f8064"/>
<path d="M300 150h200l24 260H276Z" fill="#6d7a72"/><path d="M330 150h140l14 260H316Z" fill="#8a978d"/>
<g stroke="#fff" stroke-linecap="round" opacity=".92">${[350, 372, 396, 420, 444, 466].map((x, i) => `<path d="M${x} ${156 + i * 3}V${396 - (i % 2) * 8}" stroke-width="${8 - (i % 3)}"/>`).join('')}</g>
<ellipse cx="400" cy="420" rx="210" ry="46" fill="#dff3f0" opacity=".7"/><ellipse cx="400" cy="440" rx="240" ry="70" fill="url(#pl)"/>
<path d="M0 470q200 -40 400 -6t400 -24V600H0Z" fill="#2d6a52"/>${palm(110, 520, 260, '#12382c')}${palm(690, 540, 300, '#12382c', -1)}
<g fill="#fff" opacity=".35"><ellipse cx="400" cy="400" rx="170" ry="26"/></g>`;
      defs = lg('sk', [[0, '#9ed4e6'], [1, '#e6f3e6']]) + lg('pl', [[0, '#69c7c1'], [1, '#1f7f88']]);
    } else {
      inner = `<rect width="800" height="600" fill="url(#sk)"/>${glow('g', 500, 260, 320, '#ffcf8f', .9)}<circle cx="500" cy="262" r="40" fill="#fff0c4"/>
<path d="M0 320h800v280H0z" fill="#2f5a3d"/><path d="M0 420Q400 370 800 420V600H0Z" fill="#c9a86e"/><path d="M280 600Q380 470 470 430L500 430Q540 480 700 600Z" fill="#d9bf8a"/>
${palm(140, 470, 380, '#0e2a24')}${palm(260, 450, 330, '#0e2a24', -1)}${palm(650, 470, 360, '#0e2a24')}${palm(740, 480, 300, '#0e2a24', -1)}${palm(40, 480, 260, '#0e2a24')}
<g stroke="#fff3c9" stroke-opacity=".22" stroke-width="18">${[0, 1, 2, 3, 4].map(i => `<line x1="500" y1="262" x2="${60 + i * 170}" y2="600"/>`).join('')}</g>`;
      defs = lg('sk', [[0, '#587fb0'], [.5, '#f3ac72'], [1, '#ffe0a6']]) + glowDef('g', '#ffcf8f');
    }
    return wrap(inner, defs);
  }

  function experience(v = 0) {
    let inner, defs;
    if (v === 0) {
      inner = `<rect width="800" height="600" fill="#e9dcc2"/><g opacity=".12">${Array.from({ length: 12 }, (_, i) => `<rect x="0" y="${i * 52}" width="800" height="26" fill="#7a5b3a"/>`).join('')}</g>
<circle cx="300" cy="300" r="170" fill="#fbf6ea"/><circle cx="300" cy="300" r="140" fill="none" stroke="#c29a4b" stroke-width="3"/><circle cx="300" cy="300" r="112" fill="#fff"/>
<g><path d="M250 320q40 -80 100 -20q-20 60 -100 20z" fill="#e5b163"/><circle cx="330" cy="270" r="26" fill="#f4e2b0"/><circle cx="330" cy="270" r="14" fill="#ffd970"/><circle cx="262" cy="272" r="18" fill="#e46d5a"/><path d="M226 330q30 20 60 6" stroke="#4a8b58" stroke-width="8" fill="none" stroke-linecap="round"/></g>
<g><circle cx="590" cy="190" r="70" fill="#fff"/><circle cx="590" cy="190" r="56" fill="#5a3a25"/><circle cx="590" cy="190" r="48" fill="#3a2416"/><path d="M660 176q40 4 34 34q-6 24 -36 18" stroke="#fff" stroke-width="12" fill="none"/><path d="M572 110q-14 -20 0 -36M600 110q-14 -20 0 -36" stroke="#b9a37a" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/></g>
<g><circle cx="600" cy="430" r="90" fill="#f8efdc"/><path d="M540 440q60 -100 120 0z" fill="#e7b366"/><path d="M552 440q48 -70 96 0z" fill="#f4cc84"/><circle cx="640" cy="404" r="12" fill="#c8523f"/></g>
<g><rect x="90" y="470" width="120" height="70" rx="10" fill="#f4e5cf"/><path d="M100 500h100M100 520h100" stroke="#b8935a" stroke-width="3"/></g><g transform="translate(700 500)"><path d="M0 40V0" stroke="#4a8b58" stroke-width="5"/><circle cx="0" cy="-8" r="16" fill="#fff"/><circle cx="0" cy="-8" r="7" fill="#f2b84b"/><circle cx="-16" cy="2" r="12" fill="#fbe9ef"/><circle cx="16" cy="2" r="12" fill="#fbe9ef"/></g>`;
      defs = '';
    } else if (v === 1) {
      inner = `<rect width="800" height="600" fill="url(#bg)"/>${glow('cg', 400, 360, 300, '#ffc98a', .7)}
<path d="M0 470q200 -30 400 0t400 -10V600H0Z" fill="#3f2d1f"/>
<g><ellipse cx="400" cy="440" rx="200" ry="30" fill="#000" opacity=".3"/><ellipse cx="400" cy="424" rx="190" ry="34" fill="#6c6a68"/><ellipse cx="400" cy="378" rx="150" ry="28" fill="#8a8a86"/><ellipse cx="400" cy="340" rx="104" ry="22" fill="#a4a29c"/><ellipse cx="400" cy="308" rx="62" ry="16" fill="#bdbab2"/></g>
<g><rect x="560" y="360" width="60" height="80" rx="8" fill="#f7ecd4"/><ellipse cx="590" cy="352" rx="8" ry="16" fill="#ffd970"/>${glow('cg', 590, 348, 80, '#ffd08a', .9)}</g>
<g transform="translate(180 440)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-20" rx="14" ry="28" fill="#fff" stroke="#f0d9dd" transform="rotate(${a})"/>`).join('')}<circle r="8" fill="#f4c04d"/></g>
<g transform="translate(250 470) scale(.7)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-20" rx="14" ry="28" fill="#fff" stroke="#f0d9dd" transform="rotate(${a})"/>`).join('')}<circle r="8" fill="#f4c04d"/></g>
<g stroke="#e8d3a3" stroke-opacity=".5" fill="none"><ellipse cx="400" cy="500" rx="120" ry="14"/><ellipse cx="400" cy="500" rx="180" ry="22"/></g>`;
      defs = lg('bg', [[0, '#1a1410'], [1, '#3a2a1c']]) + glowDef('cg', '#ffc98a');
    } else {
      let lan = ''; [[150, 130], [300, 96], [470, 120], [610, 90], [730, 140], [230, 210], [540, 220]].forEach(([x, y], i) => { lan += `<line x1="${x}" x2="${x}" y1="0" y2="${y - 20}" stroke="#7a5f37"/><rect x="${x - 16}" y="${y - 20}" width="32" height="44" rx="14" fill="#ffd9a0"/>${glow('lg', x, y, 90, '#ffc678', .85)}`; });
      inner = `<rect width="800" height="600" fill="url(#sk)"/>${stars(30, 33, 200, .7)}
<path d="M0 330h800v270H0z" fill="#14262c"/>${arch(300, 250, 200, 200, '#ffd9a0')}${glow('lg', 400, 380, 200, '#ffc678', .8)}
<path d="M330 600L380 400h40l50 200Z" fill="#c8a870" opacity=".8"/><path d="M0 600Q200 470 340 420L420 420Q600 480 800 600Z" fill="#2a3c38" opacity=".65"/>
${palm(80, 480, 260, '#08181e')}${palm(730, 500, 290, '#08181e', -1)}${lan}`;
      defs = lg('sk', sky.night) + glowDef('lg', '#ffc678');
    }
    return wrap(inner, defs);
  }

  function dish(v = 0) {
    let inner;
    const bg = ['#23343a', '#e6dccb', '#2b2a2a', '#f1e6d2'][v];
    if (v === 0) inner = `<rect width="800" height="600" fill="${bg}"/><circle cx="400" cy="310" r="230" fill="#efe6d3"/><circle cx="400" cy="310" r="190" fill="#fff"/><circle cx="400" cy="310" r="160" fill="#f3d9a3"/><circle cx="400" cy="310" r="140" fill="#f8eac6"/>${[[330, 280], [430, 250], [470, 340], [370, 360], [410, 300]].map(([x, y], i) => `<path d="M${x - 40} ${y}q40 -50 80 0q-10 40 -80 0z" fill="#d9a24f" transform="rotate(${i * 40} ${x} ${y})"/>`).join('')}<g fill="#5b9a52">${[[300, 330], [500, 300], [420, 390]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="18" ry="8"/>`).join('')}</g><circle cx="500" cy="360" r="7" fill="#d5473a"/>`;
    else if (v === 1) inner = `<rect width="800" height="600" fill="${bg}"/><ellipse cx="400" cy="320" rx="300" ry="230" fill="#fbf7ee"/><ellipse cx="400" cy="320" rx="250" ry="186" fill="#fff"/>${Array.from({ length: 16 }, (_, i) => { const a = i * 2.4, r = 30 + (i % 5) * 26; return `<rect x="${400 + Math.cos(a) * r - 20}" y="${320 + Math.sin(a) * r * .7 - 16}" width="40" height="32" rx="8" fill="#fdf9ef" stroke="#e5dcc7" transform="rotate(${i * 21} 400 320)"/>`; }).join('')}${Array.from({ length: 12 }, (_, i) => `<path d="M${330 + (i * 37) % 140} ${280 + (i * 53) % 90}q10 -12 22 0" stroke="#b03a63" stroke-width="7" fill="none" stroke-linecap="round"/>`).join('')}${[[300, 300], [500, 340], [400, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#d5473a"/>`).join('')}<g fill="#6aa552">${[[350, 370], [470, 290], [420, 340]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="14" ry="6"/>`).join('')}</g>`;
    else if (v === 2) inner = `<rect width="800" height="600" fill="${bg}"/><circle cx="400" cy="300" r="240" fill="#f4eee2"/><circle cx="400" cy="300" r="205" fill="#fff"/>${[0, 1, 2].map(i => `<g transform="rotate(${-30 + i * 34} 400 300) translate(400 ${150 + i * 6})"><path d="M-60 0q60 -60 120 0q-10 90 -60 130q-50 -40 -60 -130z" fill="#e9825a"/><path d="M-40 10q40 -30 80 0" stroke="#f5b48a" stroke-width="8" fill="none"/><path d="M-50 40h100M-46 70h92M-36 100h72" stroke="#c9613d" stroke-width="5"/></g>`).join('')}<g transform="translate(560 420)"><circle r="46" fill="#a8cf5b"/><circle r="36" fill="#d8ec9a"/><path d="M0 0L36 0M0 0L18 31M0 0L-18 31M0 0L-36 0M0 0L-18 -31M0 0L18 -31" stroke="#a8cf5b" stroke-width="3"/></g><circle cx="255" cy="430" r="26" fill="#f6e6a2"/>`;
    else inner = `<rect width="800" height="600" fill="${bg}"/><ellipse cx="400" cy="520" rx="200" ry="26" fill="#000" opacity=".18"/><path d="M270 120h260l-30 380q-100 30 -200 0z" fill="#fff" fill-opacity=".55" stroke="#e5d8bd" stroke-width="4"/><path d="M280 200h240l-10 90H290z" fill="#f6e9cf"/><path d="M290 290h220l-8 70H298z" fill="#7b4b9f"/><path d="M298 360h204l-8 60H306z" fill="#f5c04a"/><path d="M306 420h188l-8 70q-86 20 -172 0z" fill="#fbf3e2"/><path d="M270 120h260" stroke="#c9b58c" stroke-width="6"/><circle cx="400" cy="160" r="40" fill="#f0e2c0"/><circle cx="400" cy="140" r="20" fill="#7b4b9f"/><circle cx="440" cy="120" r="14" fill="#d5473a"/><path d="M560 100l30 80" stroke="#c29a4b" stroke-width="7"/>`;
    return wrap(inner, '');
  }


  function bar(v = 0) {
    const R = rng(500 + v);
    let bottles = ''; for (let i = 0; i < 14; i++) { const x = 470 + i * 16; const h = 30 + R() * 26; const c = ['#8a5a2b', '#c29a4b', '#5c8a6a', '#7a3b3b', '#3a5a6a'][i % 5]; bottles += `<rect x="${x}" y="${168 - h}" width="10" height="${h}" rx="3" fill="${c}"/><rect x="${x + 2}" y="${168 - h - 8}" width="6" height="9" fill="#e8dcc6"/>`; }
    let pend = ''; [140, 260, 380].forEach(x => { pend += `<line x1="${x}" x2="${x}" y1="0" y2="86" stroke="#8a6a3f"/><path d="M${x - 15} 108a15 15 0 0 1 30 0z" fill="#12303a"/>${glow('gbp', x, 110, 60, '#ffc678', .9)}`; });
    const inner = `<rect width="800" height="600" fill="url(#bsky)"/>${glow('bg', 620, 250, 260, '#ffb26b', .85)}<circle cx="620" cy="252" r="42" fill="#ffe3ac"/>
<rect y="250" width="800" height="130" fill="url(#bsea)"/><g stroke="#ffe3b0" stroke-opacity=".4" stroke-width="2">${[270, 292, 318, 348].map((y, i) => `<line x1="${560 - i * 20}" x2="${780 - i * 4}" y1="${y}" y2="${y}"/>`).join('')}</g>
<rect y="372" width="800" height="228" fill="#241a12"/>
<rect x="70" y="150" width="420" height="18" rx="6" fill="#7a5230"/><rect x="70" y="168" width="420" height="200" fill="#2c2016"/>${bottles}
<g>${[0, 1, 2, 3].map(i => `<g transform="translate(${560 + i * 58} 470)"><ellipse cy="70" rx="26" ry="8" fill="#000" opacity=".3"/><rect x="-4" y="0" width="8" height="70" fill="#4a3626"/><ellipse cy="-4" rx="24" ry="10" fill="#e8dcc6"/></g>`).join('')}</g>
<g><rect x="60" y="372" width="380" height="16" fill="#4a3626"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${90 + i * 58}" y="388" width="14" height="90" fill="#3a2a1a"/>`).join('')}</g>
${pend}${palm(30, 420, 240, '#0a1e24')}${palm(760, 440, 260, '#0a1e24', -1)}`;
    const defs = lg('bsky', sky.dusk) + lg('bsea', [[0, '#f5b98b'], [.4, '#8f7a9a'], [1, '#33506d']]) + glowDef('bg', '#ffb26b') + glowDef('gbp', '#ffc678');
    return wrap(inner, defs);
  }

  function spa(v = 0) {
    if (v === 1) {
      const inner = `<rect width="800" height="600" fill="url(#spsky)"/>${glow('spg', 240, 200, 220, '#ffcf9a', .7)}
${arch(120, 90, 240, 220, 'url(#sprs)')}${arch(440, 90, 240, 220, 'url(#sprs)')}
<rect y="330" width="800" height="270" fill="#e7ddc8"/>
<g><ellipse cx="400" cy="470" rx="260" ry="40" fill="#000" opacity=".08"/><rect x="180" y="380" width="440" height="90" rx="30" fill="url(#spw)"/><rect x="180" y="374" width="440" height="14" rx="7" fill="#fff" opacity=".6"/></g>
${[[210, 330], [590, 330]].map(([x, y]) => `<g><ellipse cx="${x}" cy="${y + 40}" rx="34" ry="42" fill="#5c8a6a"/><ellipse cx="${x}" cy="${y}" rx="26" ry="30" fill="#6a9a76"/></g>`).join('')}
${[[130, 500], [670, 500]].map(([x, y]) => `<g><rect x="${x - 26}" y="${y - 40}" width="52" height="46" rx="6" fill="#efe4cf"/>${glow('spc', x, y - 46, 50, '#ffd9a0', .95)}<path d="M${x - 3} ${y - 60}q3 -10 3 -16q0 6 3 16" stroke="#c9a56a" stroke-width="2"/></g>`).join('')}
<g opacity=".8">${Array.from({ length: 10 }, (_, i) => `<circle cx="${260 + i * 30}" cy="${430 - (i % 3) * 4}" r="3" fill="#fff" opacity=".8"/>`).join('')}</g>`;
      const defs = lg('spsky', [[0, '#f6ead7'], [1, '#e9dcc2']]) + lg('sprs', [[0, '#cfe3df'], [1, '#8fbdb6']]) + lg('spw', [[0, '#eef2ee'], [1, '#c9d8d2']]) + glowDef('spg', '#ffcf9a') + glowDef('spc', '#ffd9a0');
      return wrap(inner, defs);
    }
    const inner = `<rect width="800" height="600" fill="#2a2420"/>${glow('sg1', 400, 200, 260, '#ffcf9a', .5)}
<rect x="220" y="330" width="360" height="130" rx="20" fill="#3c3128"/><rect x="236" y="320" width="328" height="26" rx="13" fill="#efe4cf"/>
<g>${[[260, 300], [340, 290], [420, 300], [500, 290]].map(([x, y]) => `<g><rect x="${x - 6}" y="${y}" width="12" height="60" fill="#5a4a34"/>${glow('sc', x, y - 6, 44, '#ffcf7a', .9)}<ellipse cx="${x}" cy="${y - 4}" rx="4" ry="8" fill="#ffe3a0"/></g>`).join('')}
<g fill="#5c8a6a" opacity=".85">${[[180, 420], [620, 420], [180, 500], [620, 500]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="30" ry="14"/>`).join('')}</g>
<g opacity=".9"><ellipse cx="400" cy="470" rx="120" ry="14" fill="#fff" opacity=".18"/><circle cx="360" cy="460" r="5" fill="#f2c9d6"/><circle cx="440" cy="465" r="5" fill="#f2c9d6"/><circle cx="400" cy="450" r="5" fill="#f2c9d6"/></g>
<text x="400" y="560" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="20" fill="#d9b46a" opacity=".7">Lume Spa</text>`;
    return wrap(inner, glowDef('sg1', '#ffcf9a') + glowDef('sc', '#ffcf7a'));
  }

  function beach(v = 0) {
    if (v === 1) {
      const inner = `<rect width="800" height="600" fill="url(#bdsky)"/>${stars(40, 44, 260, .8)}${glow('bdg', 400, 300, 260, '#ffb26b', .6)}<circle cx="400" cy="302" r="34" fill="#ffe3ac"/>
<path d="M0 360h800v240H0z" fill="#d9c39a"/>
<g><ellipse cx="400" cy="470" rx="220" ry="26" fill="#000" opacity=".12"/><rect x="260" y="440" width="280" height="14" rx="6" fill="#efe4cf"/><rect x="270" y="426" width="30" height="16" fill="#efe4cf"/><rect x="500" y="426" width="30" height="16" fill="#efe4cf"/>
${Array.from({ length: 6 }, (_, i) => `<g><rect x="${272 + i * 44}" y="410" width="4" height="30" fill="#7a5a35"/>${glow('bdc', 274 + i * 44, 406, 30, '#ffd9a0', .95)}</g>`).join('')}
<ellipse cx="330" cy="436" rx="18" ry="6" fill="#fff"/><ellipse cx="470" cy="436" rx="18" ry="6" fill="#fff"/></g>
<g><rect x="140" y="500" width="180" height="8" fill="#7a5a35"/><rect x="150" y="440" width="8" height="60" fill="#7a5a35"/><rect x="302" y="440" width="8" height="60" fill="#7a5a35"/><path d="M140 500q80 -70 180 0" fill="none" stroke="#c9a25a" stroke-width="10"/></g>
${palm(60, 470, 260, '#0a1e24')}${palm(730, 480, 280, '#0a1e24', -1)}`;
      const defs = lg('bdsky', sky.night) + glowDef('bdg', '#ffb26b') + glowDef('bdc', '#ffd9a0');
      return wrap(inner, defs);
    }
    const inner = `<rect width="800" height="600" fill="url(#besky)"/>${glow('beg', 210, 190, 240, '#ffcf9a', .8)}<circle cx="210" cy="192" r="42" fill="#fff7dc"/>
<rect y="250" width="800" height="150" fill="url(#besea)"/><g stroke="#fff" stroke-opacity=".45" stroke-width="2">${[280, 302, 328, 358].map((y, i) => `<path d="M${40 + i * 10} ${y}q120 -10 240 0t240 0t240 0"/>`).join('')}</g>
<path d="M0 392Q400 358 800 392V600H0Z" fill="#eadfc2"/>
<g><rect x="560" y="330" width="150" height="90" rx="10" fill="#f4ecd9"/><path d="M552 330l78 -46 78 46z" fill="#a9865a"/><rect x="590" y="360" width="34" height="60" rx="4" fill="#cbb894"/></g>
${[[610, 470], [670, 490]].map(([x, y]) => `<g><rect x="${x - 30}" y="${y}" width="60" height="8" rx="4" fill="#8a6a3f"/><path d="M${x - 30} ${y}q30 -26 60 0" fill="none" stroke="#efe4cf" stroke-width="10"/></g>`).join('')}
<g><rect x="150" y="440" width="150" height="8" rx="4" fill="#8a6a3f"/><path d="M150 440q75 -30 150 0" fill="none" stroke="#efe4cf" stroke-width="10"/><rect x="330" y="450" width="150" height="8" rx="4" fill="#8a6a3f"/><path d="M330 450q75 -30 150 0" fill="none" stroke="#c9a25a" stroke-width="10"/></g>
${palm(60, 400, 300, '#12382c')}${palm(400, 610, 0)}${palm(760, 420, 320, '#12382c', -1)}`;
    const defs = lg('besky', sky.day) + lg('besea', [[0, '#8fe0dc'], [1, '#1f8ba3']]) + glowDef('beg', '#ffcf9a');
    return wrap(inner, defs);
  }

  function heritage(v = 0) {
    const inner = `<rect width="800" height="600" fill="url(#hsky)"/>${glow('hg', 640, 160, 220, '#ffcf9a', .75)}<circle cx="640" cy="162" r="36" fill="#fff2ce"/>
<rect y="420" width="800" height="180" fill="#cbb98f"/><rect y="416" width="800" height="10" fill="#a99668"/>
<g><rect x="300" y="170" width="200" height="250" fill="#e7dcc4"/><rect x="330" y="60" width="140" height="120" fill="#e7dcc4"/><path d="M330 60l70 -46 70 46z" fill="#8a6a44"/>
<rect x="386" y="90" width="28" height="40" rx="4" fill="#3a5666"/><rect x="376" y="200" width="48" height="90" rx="20" fill="#3a5666"/>
${[0, 1].map(i => `<rect x="${320 + i * 130}" y="230" width="34" height="60" rx="4" fill="#3a5666"/>`)}
<rect x="290" y="410" width="220" height="16" fill="#8a6a44"/></g>
<g fill="#8a6a44" opacity=".9"><rect x="60" y="380" width="16" height="40"/><rect x="724" y="380" width="16" height="40"/></g>
<g>${palm(120, 480, 220, '#12382c')}${palm(680, 490, 240, '#12382c', -1)}</g>
<g><rect x="140" y="470" width="90" height="50" rx="6" fill="#c8523f"/><rect x="150" y="480" width="70" height="14" rx="4" fill="#efe4cf"/><circle cx="170" cy="470" r="14" fill="#e7dcc4"/><circle cx="205" cy="470" r="14" fill="#e7dcc4"/></g>`;
    const defs = lg('hsky', sky.day) + glowDef('hg', '#ffcf9a');
    return wrap(inner, defs);
  }

  const memo = {};
  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  function src(key, make) { if (IMAGE_OVERRIDES[key]) return IMAGE_OVERRIDES[key]; return memo[key] || (memo[key] = uri(make())); }
  const SLUGS = ['deluxe', 'premier', 'executive', 'lume'];
  const roomKinds = ['bed', 'bath', 'balcony', 'living'];
  const api = {
    room: (slug, i) => src(`room-${slug}-${i}`, () => room(roomKinds[i % 4], slug)),
    exterior: v => src('ext-' + v, () => exterior(v)), pool: v => src('pool-' + v, () => pool(v)), lobby: v => src('lobby-' + v, () => lobby(v)),
    restaurant: v => src('rest-' + v, () => restaurant(v)), surround: v => src('sur-' + v, () => surround(v)), experience: v => src('exp-' + v, () => experience(v)), dish: v => src('dish-' + v, () => dish(v)),
    bar: v => src('bar-' + v, () => bar(v)), spa: v => src('spa-' + v, () => spa(v)), beach: v => src('beach-' + v, () => beach(v)), heritage: v => src('tour-' + v, () => v === 1 ? surround(1) : heritage(v)),
    heroSvg: () => exterior(0, true),
    map: () => src('map', () => {
      const inner = `<rect width="800" height="600" fill="#e9e4d4"/><path d="M0 0h800v210q-120 40 -240 10T300 260 0 230Z" fill="#a9d0da"/><path d="M0 230q300 30 560 -10t240 -10V150q-120 30 -240 0T300 190 0 170Z" fill="#c9e3e6" opacity=".7"/>
<path d="M0 300h800M0 430h800M180 210V600M470 250V600M660 230V600" stroke="#fbf8ee" stroke-width="16"/><path d="M-20 520Q300 330 830 360" stroke="#f3cf8b" stroke-width="12" fill="none"/><path d="M-20 520Q300 330 830 360" stroke="#fff" stroke-width="2" stroke-dasharray="14 12" fill="none"/>
${[[60, 330, 110, 80], [250, 300, 190, 100], [520, 290, 110, 130], [700, 300, 70, 110], [60, 460, 90, 110], [260, 470, 180, 100], [520, 460, 110, 110], [700, 470, 80, 110]].map(([x, y, w, h], i) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${i % 3 === 0 ? '#cfe0c0' : '#dcd3bd'}"/>`).join('')}
<g><circle cx="400" cy="310" r="70" fill="#C29A4B" opacity=".18"/><circle cx="400" cy="310" r="38" fill="#C29A4B" opacity=".25"/><path d="M400 356s34 -30 34 -58a34 34 0 1 0 -68 0c0 28 34 58 34 58z" fill="#0F2B33"/><circle cx="400" cy="298" r="13" fill="#FFD9A0"/></g>
<text x="400" y="392" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#0F2B33" font-weight="600">The Lume Hotel</text><text x="400" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#5C6B6E">Jawili, Tangalan, Aklan</text>
<text x="110" y="120" font-family="Georgia,serif" font-style="italic" font-size="22" fill="#4a7f8c">Sibuyan Sea</text>`;
      return wrap(inner);
    }),
  };
  return api;
})();
