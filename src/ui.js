// RideBike – UI-Helfer & Icons
// © 2026 Florian Enders

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const svg = (inner, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICON = {
  sparkle: svg('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  film: svg('<rect x="3" y="5" width="14" height="14" rx="3"/><path d="M17 10l4-2.5v9L17 14"/>'),
  dots: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".5"/>'),
  locate: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>'),
  follow: svg('<path d="M12 2 19 21 12 17 5 21Z" fill="currentColor" stroke="none"/>'),
  compass: svg('<path d="M12 2.5 15.5 12h-7Z" fill="#ff4d5e" stroke="none"/><path d="M12 21.5 8.5 12h7Z" fill="currentColor" stroke="none" opacity=".75"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  swap: svg('<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>'),
  start: svg('<circle cx="12" cy="12" r="5" fill="currentColor"/>'),
  pin: svg('<path d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>'),
  nav: svg('<path d="M3 11 21 3l-8 18-2-8-8-2Z" fill="currentColor" stroke="none"/>'),
  fly: svg('<path d="M2 16c4-1 6-6 10-6s6 5 10 6"/><circle cx="12" cy="7" r="2.5" fill="currentColor"/><path d="M12 13v8" opacity=".5"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>'),
  bike: svg('<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9 12 16.5h-1M15 9l-1.5-3H11"/>'),
  mountain: svg('<path d="m3 20 6.5-11 4 6.5L16 12l5 8Z"/><path d="m8.2 11.2 1.3 1.3 1.4-1.3"/>'),
  trail: svg('<path d="M4 20c3-2 3-5 6-6s5-1 6-4 2-5 4-6"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/>'),
  up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  down: svg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  ruler: svg('<path d="M3 17 17 3l4 4L7 21Z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  sound: svg('<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  mute: svg('<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="m22 9-6 6M16 9l6 6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  zoom: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  tour: svg('<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9 12 16.5"/>'),
  fast: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>'),
  short: svg('<path d="M4 18 20 6"/><circle cx="4" cy="18" r="2" fill="currentColor"/><circle cx="20" cy="6" r="2" fill="currentColor"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  contour: svg('<path d="M3 17c3-1 4-4 9-4s6 3 9 4"/><path d="M5 12c2-1 3-4 7-4s5 3 7 4" opacity=".75"/><path d="M8 7c1-1 2-3 4-3s3 2 4 3" opacity=".5"/>'),
  tree: svg('<path d="M12 3 6 12h3l-3 5h12l-3-5h3Z"/><path d="M12 17v4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  wave: svg('<path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>'),
  cloud: svg('<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18Z"/><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  offline: svg('<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M3 3l18 18"/>'),
  palette: svg('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.3" fill="currentColor"/><circle cx="10" cy="7" r="1.3" fill="currentColor"/><circle cx="14.5" cy="7" r="1.3" fill="currentColor"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  chevR: svg('<path d="m9 6 6 6-6 6"/>'),
  chevL: svg('<path d="m15 6-6 6 6 6"/>'),
  chevD: svg('<path d="m6 9 6 6 6-6"/>'),
  back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5" fill="currentColor"/>'),
  finish: svg('<path d="M5 21V4"/><path d="M5 4h14v9H5Z"/><path d="M5 4h3.5v3H5ZM12 4h3.5v3H12ZM8.5 7H12v3H8.5ZM15.5 7H19v3h-3.5ZM5 10h3.5v3H5ZM12 10h3.5v3H12Z" fill="currentColor" stroke="none"/>'),
  gauge: svg('<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/>'),
  routeIc: svg('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>'),
  peaks: svg('<path d="m2 20 7-11 4 6 3-4 6 9Z"/>'),
  navArrow: svg('<path d="M12 3 20 21 12 16.5 4 21Z" fill="currentColor" stroke="none"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  sunrise: svg('<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M5 9.5l1.5 1.5M19 9.5 17.5 11M2 22h20"/>'),
  snow: svg('<path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
  fire: svg('<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-3.5 3.5C11 7 11 5 10 3 7 6 5 10 5 15a7 7 0 0 0 7 7Z"/>'),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7Z" fill="currentColor" stroke="none"/>'),
  home: svg('<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  medal: svg('<circle cx="12" cy="15" r="6"/><path d="M8 3l2.5 6M16 3l-2.5 6M12 12.5l.8 1.7 1.8.2-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2Z"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>')
};

/** Manöverpfeil für einen Abbiegewinkel (Grad, + = rechts) */
export function maneuverSvg(type, angle = 0, exit = 0) {
  if (type === 'arrive') {
    return svg('<path d="M6 21V4"/><path d="M6 4h11l-2.5 3.5L17 11H6" fill="currentColor"/>');
  }
  if (type === 'uturn') {
    return svg('<path d="M8 21V10a5 5 0 0 1 10 0v4"/><path d="m14 11 4 4 4-4" transform="translate(-4 0)"/>');
  }
  if (type === 'roundabout') {
    return `<div class="rb-roundabout">${svg('<circle cx="12" cy="10" r="4.5"/><path d="M12 22v-7.5M16.2 8.2 20 5"/><path d="m16.5 4.5 3.7.3-.2 3.8"/>')}<b>${exit || ''}</b></div>`;
  }
  const a = (Math.max(-150, Math.min(150, angle)) * Math.PI) / 180;
  const sx = 12, sy = 13;
  const len = 7.5;
  const ex = sx + Math.sin(a) * len;
  const ey = sy - Math.cos(a) * len;
  const hx1 = ex - Math.sin(a - 0.6) * 4.2, hy1 = ey + Math.cos(a - 0.6) * 4.2;
  const hx2 = ex - Math.sin(a + 0.6) * 4.2, hy2 = ey + Math.cos(a + 0.6) * 4.2;
  const cx = sx, cy = sy - 2.5;
  const ghost = type === 'keep' ? `<path d="M12 13 L${(sx - Math.sin(a) * 5).toFixed(2)} ${(sy - 6).toFixed(2)}" opacity=".3"/>` : '';
  return svg(`${ghost}<path d="M12 22.5V${sy} Q${cx} ${cy} ${ex.toFixed(2)} ${ey.toFixed(2)}" stroke-width="2.6"/><path d="M${hx1.toFixed(2)} ${hy1.toFixed(2)} L${ex.toFixed(2)} ${ey.toFixed(2)} L${hx2.toFixed(2)} ${hy2.toFixed(2)}" stroke-width="2.6"/>`);
}

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Bottom-Sheets ----------
const openSheets = new Set();

export function openSheet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.classList.remove('collapsed');
  openSheets.add(id);
  document.body.classList.toggle('sheet-open', openSheets.size > 0);
}

export function closeSheet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  openSheets.delete(id);
  document.body.classList.toggle('sheet-open', openSheets.size > 0);
  el.dispatchEvent(new CustomEvent('sheetclose'));
}

export function isSheetOpen(id) {
  return openSheets.has(id);
}

/** Sheets per Griff nach unten ziehen zum Einklappen/Schließen */
export function enableSheetDrag(el, { closable = true } = {}) {
  const handle = el.querySelector('.sheet-handle');
  if (!handle) return;
  let y0 = null, dy = 0;
  const down = (e) => { y0 = e.clientY; dy = 0; el.style.transition = 'none'; handle.setPointerCapture(e.pointerId); };
  const move = (e) => {
    if (y0 == null) return;
    dy = Math.max(-40, e.clientY - y0);
    el.style.transform = `translateY(${dy}px)`;
  };
  const up = () => {
    if (y0 == null) return;
    el.style.transition = '';
    el.style.transform = '';
    if (dy > 110 && closable && el.classList.contains('collapsed')) closeSheet(el.id);
    else if (dy > 70) el.classList.add('collapsed');
    else if (dy < -15 || Math.abs(dy) < 6) el.classList.toggle('collapsed', Math.abs(dy) < 6 ? !el.classList.contains('collapsed') : false);
    y0 = null;
  };
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export async function fetchJson(url, opts = {}, timeout = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------- Dialog ----------
/**
 * Modaler Dialog. buttons: [{ label, value, primary, danger }]
 * Gibt { value, checked } zurück. Mit api.setProgress(0..1)/api.setText() steuerbar.
 */
export function dialog({ icon = '', title, text, buttons, checkbox }) {
  const wrap = $('#dialog');
  $('#dlg-ic').innerHTML = icon;
  $('#dlg-title').textContent = title;
  $('#dlg-text').textContent = text;
  $('#dlg-bar').hidden = true;
  $('#dlg-check-wrap').hidden = !checkbox;
  if (checkbox) { $('#dlg-check-label').textContent = checkbox; $('#dlg-check').checked = false; }
  const act = $('#dlg-actions');
  act.innerHTML = buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : b.danger ? 'danger' : 'ghost'}" data-i="${i}">${esc(b.label)}</button>`).join('');
  wrap.hidden = false;
  requestAnimationFrame(() => wrap.classList.add('show'));
  let resolve;
  const p = new Promise((r) => (resolve = r));
  act.onclick = (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    resolve({ value: buttons[Number(b.dataset.i)].value, checked: $('#dlg-check').checked });
  };
  p.close = () => { wrap.classList.remove('show'); setTimeout(() => { wrap.hidden = true; }, 250); };
  p.setProgress = (f) => { $('#dlg-bar').hidden = false; $('#dlg-fill').style.width = `${Math.round(f * 100)}%`; };
  p.setText = (t) => { $('#dlg-text').textContent = t; };
  p.setButtons = (bs) => { buttons = bs; act.innerHTML = bs.map((b, i) => `<button class="btn ${b.primary ? 'primary' : 'ghost'}" data-i="${i}">${esc(b.label)}</button>`).join(''); };
  return p;
}

export function fmtBytes(b) {
  if (!b) return '0 MB';
  if (b < 1e6) return `${Math.max(1, Math.round(b / 1e3))} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0).replace('.', ',')} MB`;
  return `${(b / 1e9).toFixed(1).replace('.', ',')} GB`;
}

// ---------- Fahrrad-Illustration je Radtyp ----------
let bikeSeq = 0;
/**
 * Fahrrad in Seitenansicht – realistischer Look wie in der Vorlage: dunkler, matt glänzender Rahmen,
 * Stollenreifen, Scheibenbremsen, Federgabel. Vorderrad rechts.
 */
export function bikeSvg(type) {
  const road = type === 'road' || type === 'speed';
  const mtb = type === 'mtb' || type === 'emtb';
  const gravel = type === 'gravel';
  const cargo = type === 'cargo';
  const city = type === 'city';
  const ebike = ['ebike', 'emtb', 'speed', 'cargo'].includes(type);
  const id = `bk${++bikeSeq}`;
  const tw = road ? 3.6 : mtb ? 8 : gravel ? 5.6 : cargo ? 6.5 : 5.5;
  const R = 36, rear = [58, 104], front = cargo ? [214, 110] : [192, 104];
  const fR = cargo ? 28 : R;
  const bb = [112, 106];
  const seatTop = [100, 50];
  const headTop = cargo ? [168, 50] : [164, 50];
  const headBot = cargo ? [172, 66] : [168, 66];
  const F = `url(#${id}f)`;
  const spokes = (c, r) => Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 + (i % 2) * 8) * Math.PI / 180, ri = r - tw - 3;
    return `<line x1="${c[0]}" y1="${c[1]}" x2="${(c[0] + Math.cos(a) * ri).toFixed(1)}" y2="${(c[1] + Math.sin(a) * ri).toFixed(1)}" stroke="#7d868e" stroke-width=".55" opacity=".8"/>`;
  }).join('');
  const wheel = (c, r) => `<g class="wheel">
      <circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="#07090b" stroke-width="${tw + 3}"/>
      ${road ? '' : `<circle cx="${c[0]}" cy="${c[1]}" r="${r + tw / 2 + 0.6}" fill="none" stroke="#1a1f24" stroke-width="${mtb ? 2.6 : 1.6}" stroke-dasharray="${mtb ? '2.2 1.8' : '1.4 1.6'}"/>`}
      <circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="#1d2328" stroke-width="${tw - 1}"/>
      <circle cx="${c[0]}" cy="${c[1]}" r="${r - tw / 2 - 1.8}" fill="none" stroke="url(#${id}rim)" stroke-width="2.6"/>
      ${spokes(c, r)}
      <circle cx="${c[0]}" cy="${c[1]}" r="9.5" fill="none" stroke="#a9b1b8" stroke-width="1.6"/>
      <circle cx="${c[0]}" cy="${c[1]}" r="3.6" fill="#2a3036" stroke="#c4cbd1" stroke-width="1"/></g>`;
  const P = [];
  const tube = (x1, y1, x2, y2, w) => {
    P.push(`<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${F}" stroke-width="${w}" stroke-linecap="round"/>`);
    P.push(`<path d="M${x1} ${y1 - w * 0.22} L${x2} ${y2 - w * 0.22}" stroke="rgba(255,255,255,.16)" stroke-width="${Math.max(0.8, w * 0.18)}" stroke-linecap="round"/>`);
  };
  // Hinterbau
  tube(rear[0], rear[1], bb[0], bb[1], 4.6);
  tube(rear[0], rear[1], seatTop[0] + 2, seatTop[1] + 12, 4.2);
  // Hauptrahmen
  tube(bb[0], bb[1], seatTop[0], seatTop[1], 6.5);
  tube(bb[0], bb[1], headBot[0], headBot[1], mtb || ebike ? 9 : 7);
  tube(seatTop[0] + 1, seatTop[1] + 8, headTop[0], headTop[1] + (city ? 14 : 4), mtb ? 6.5 : 5.6);
  // Steuerrohr
  P.push(`<path d="M${headTop[0]} ${headTop[1] - 2} L${headBot[0]} ${headBot[1]}" stroke="${F}" stroke-width="8.5" stroke-linecap="round"/>`);
  // Gabel: Federgabel mit silbernen Standrohren (MTB), sonst schlanke Starrgabel
  if (mtb) {
    P.push(`<path d="M${headBot[0]} ${headBot[1]} L${headBot[0] + 6} ${headBot[1] + 16}" stroke="#d7dde2" stroke-width="5.2" stroke-linecap="round"/>`);
    P.push(`<path d="M${headBot[0] + 6} ${headBot[1] + 16} L${front[0]} ${front[1]}" stroke="#16191d" stroke-width="7" stroke-linecap="round"/>`);
    // Hinterbau-Dämpfer
    P.push(`<path d="M${rear[0] + 22} ${rear[1] - 22} L${seatTop[0] + 6} ${seatTop[1] + 24}" stroke="#16191d" stroke-width="6" stroke-linecap="round"/>`);
    P.push(`<path d="M${rear[0] + 26} ${rear[1] - 25} L${seatTop[0] + 1} ${seatTop[1] + 29}" stroke="#c9d0d6" stroke-width="2.2" stroke-linecap="round"/>`);
  } else {
    P.push(`<path d="M${headBot[0]} ${headBot[1]} L${front[0]} ${front[1]}" stroke="${F}" stroke-width="${road ? 4.2 : 5}" stroke-linecap="round"/>`);
  }
  // Akku (E-Bikes), integriert im Unterrohr + Motor
  if (ebike) {
    const mx = (bb[0] + headBot[0]) / 2, my = (bb[1] + headBot[1]) / 2;
    const ang = Math.atan2(headBot[1] - bb[1], headBot[0] - bb[0]) * 180 / Math.PI;
    P.push(`<rect x="${mx - 20}" y="${my - 6}" width="40" height="12" rx="5" fill="#15191d" stroke="#3a434b" stroke-width="1" transform="rotate(${ang} ${mx} ${my})"/>`);
    P.push(`<circle cx="${mx + 12}" cy="${my - 6}" r="1.4" fill="#8be13a" transform="rotate(${ang} ${mx} ${my})"/>`);
    P.push(`<circle cx="${bb[0] + 2}" cy="${bb[1] - 1}" r="10" fill="#1b2025" stroke="#4a535b" stroke-width="1.5"/>`);
  }
  // Sattelstütze (MTB: Teleskopstütze) + Sattel
  P.push(`<path d="M${seatTop[0]} ${seatTop[1]} L${seatTop[0] - 3} ${seatTop[1] - 12}" stroke="${mtb ? '#0f1215' : '#9aa3ab'}" stroke-width="3.6" stroke-linecap="round"/>`);
  P.push(`<path d="M${seatTop[0] - 18} ${seatTop[1] - 14} Q${seatTop[0] - 3} ${seatTop[1] - 20} ${seatTop[0] + 11} ${seatTop[1] - 13}" stroke="#0b0d10" stroke-width="6.5" stroke-linecap="round" fill="none"/>`);
  P.push(`<path d="M${seatTop[0] - 14} ${seatTop[1] - 16.5} Q${seatTop[0] - 3} ${seatTop[1] - 21} ${seatTop[0] + 7} ${seatTop[1] - 16}" stroke="rgba(255,255,255,.18)" stroke-width="1.2" fill="none"/>`);
  // Vorbau & Lenker
  const H = '#0e1114';
  if (road) P.push(`<path d="M${headTop[0]} ${headTop[1] - 2} h10 q8 0 8 9 q0 8 -8 8" stroke="${H}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
  else if (city) P.push(`<path d="M${headTop[0]} ${headTop[1]} L${headTop[0] - 4} ${headTop[1] - 12} q-12 -2 -16 4" stroke="#9aa3ab" stroke-width="4" fill="none" stroke-linecap="round"/>`);
  else {
    P.push(`<path d="M${headTop[0] - 1} ${headTop[1] - 1} L${headTop[0] + 4} ${headTop[1] - 9}" stroke="${H}" stroke-width="4.5" stroke-linecap="round"/>`);
    P.push(`<path d="M${headTop[0] - 10} ${headTop[1] - 11} L${headTop[0] + 14} ${headTop[1] - 9}" stroke="${H}" stroke-width="4" stroke-linecap="round"/>`);
    P.push(`<path d="M${headTop[0] - 10} ${headTop[1] - 11} l5 0.3" stroke="#2c3238" stroke-width="5" stroke-linecap="round"/>`);
  }
  if (city) {
    P.push(`<path d="M${rear[0] - R - 2} ${rear[1]} A${R + 5} ${R + 5} 0 0 1 ${rear[0] + 20} ${rear[1] - R - 1}" stroke="#2a3036" stroke-width="3" fill="none"/>`);
    P.push(`<path d="M${front[0] - 22} ${front[1] - R - 1} A${R + 5} ${R + 5} 0 0 1 ${front[0] + R + 2} ${front[1]}" stroke="#2a3036" stroke-width="3" fill="none"/>`);
    P.push(`<path d="M${seatTop[0] - 4} ${seatTop[1] + 8} L${rear[0] - 6} ${rear[1] - 34} L${rear[0] + 4} ${rear[1] - 2}" stroke="#4a535b" stroke-width="3" fill="none"/>`);
  }
  if (cargo) P.push(`<path d="M${headBot[0] + 6} ${headBot[1] + 4} h${front[0] - headBot[0] - 2} l-5 28 h${-(front[0] - headBot[0] - 12)} Z" fill="#1b2025" stroke="#3a434b" stroke-width="2" stroke-linejoin="round"/>`);
  // Kettenblatt, Kurbel, Kette, Kassette
  P.push(`<circle cx="${bb[0]}" cy="${bb[1]}" r="10" fill="none" stroke="#5c656d" stroke-width="2.4" stroke-dasharray="1.6 1"/>`);
  P.push(`<circle cx="${rear[0]}" cy="${rear[1]}" r="7" fill="none" stroke="#7b848c" stroke-width="2"/>`);
  P.push(`<path d="M${rear[0]} ${rear[1] - 7} L${bb[0]} ${bb[1] - 10} M${rear[0]} ${rear[1] + 7} L${bb[0]} ${bb[1] + 10}" stroke="#6b737b" stroke-width="1.4"/>`);
  P.push(`<path d="M${bb[0]} ${bb[1]} l-9 11" stroke="#0e1114" stroke-width="4" stroke-linecap="round"/><rect x="${bb[0] - 15}" y="${bb[1] + 10}" width="11" height="3.5" rx="1.5" fill="#1a1f24"/>`);
  // kleiner Akzent-Schriftzug auf dem Unterrohr
  const mx2 = bb[0] + (headBot[0] - bb[0]) * 0.62, my2 = bb[1] + (headBot[1] - bb[1]) * 0.62;
  const ang2 = Math.atan2(headBot[1] - bb[1], headBot[0] - bb[0]) * 180 / Math.PI;
  if (!ebike) P.push(`<rect x="${mx2 - 9}" y="${my2 - 1}" width="18" height="2" rx="1" fill="#8be13a" opacity=".85" transform="rotate(${ang2} ${mx2} ${my2})"/>`);
  const defs = `<defs>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a535c"/><stop offset=".45" stop-color="#262c32"/><stop offset="1" stop-color="#0d1013"/></linearGradient>
    <linearGradient id="${id}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a636b"/><stop offset="1" stop-color="#1f2429"/></linearGradient>
    <radialGradient id="${id}sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
  const shadow = `<ellipse cx="${(rear[0] + front[0]) / 2}" cy="${rear[1] + R + 6}" rx="${(front[0] - rear[0]) / 2 + R}" ry="7" fill="url(#${id}sh)"/>`;
  return `<svg viewBox="0 0 252 152" aria-hidden="true">${defs}${shadow}${wheel(rear, R)}${wheel(front, fR)}${P.join('')}</svg>`;
}

// ---------- Medaille ----------
const MEDAL_GRAD = {
  bronze: ['#ffd2a6', '#d98c4a', '#8a4b1f', '#5a2f12'],
  silver: ['#ffffff', '#cfd8e0', '#8e9aa6', '#56616c'],
  gold: ['#fff4c2', '#ffd34d', '#d99a12', '#8a5a00'],
  none: ['#5b6670', '#3a444e', '#242c34', '#161c22']
};
const TIER_KEY = ['none', 'bronze', 'silver', 'gold'];
let medalSeq = 0;

/** Medaille als SVG. tier 0 = gesperrt, 1 Bronze, 2 Silber, 3 Gold */
export function medalSvg(tier, iconName, ribbon = '#8be13a', size = 72) {
  const k = TIER_KEY[tier] || 'none';
  const g = MEDAL_GRAD[k];
  const id = `m${k}${++medalSeq}`;
  const icon = (ICON[iconName] || ICON.medal).replace('<svg ', `<svg x="22" y="38" width="28" height="28" color="${tier ? 'rgba(40,24,6,.82)' : '#8b96a1'}" `);
  const rib = tier ? ribbon : '#38424c';
  return `<svg class="medal-svg ${k}" viewBox="0 0 72 84" width="${size}" height="${size * 84 / 72}" aria-hidden="true">
    <defs>
      <radialGradient id="${id}-f" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${g[0]}"/><stop offset=".45" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></radialGradient>
      <linearGradient id="${id}-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[3]}"/></linearGradient>
    </defs>
    <path d="M20 2h11l6 24-9 4Z" fill="${rib}" opacity=".95"/><path d="M52 2H41l-6 24 9 4Z" fill="${rib}" opacity=".75"/>
    <path d="M20 2h11l1.5 6H22Z M52 2H41l-1.5 6H50Z" fill="#000" opacity=".18"/>
    <circle cx="36" cy="52" r="29" fill="url(#${id}-r)"/>
    <circle cx="36" cy="52" r="25" fill="url(#${id}-f)"/>
    <circle cx="36" cy="52" r="21" fill="none" stroke="${tier ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.08)'}" stroke-width="1.4" stroke-dasharray="${tier === 3 ? '2 2.6' : 'none'}"/>
    ${icon}
    ${tier ? '<path class="medal-shine" d="M14 40 Q24 26 44 25" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55"/>' : ''}
    ${tier === 3 ? '<path d="M60 26l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4Z" fill="#fff6c8"/>' : ''}
    ${tier ? '' : `<g transform="translate(48 66)"><circle r="8.5" fill="#1c232a" stroke="#4b5560"/>${ICON.lock.replace('<svg ', '<svg x="-5" y="-5.5" width="10" height="10" color="#9aa5af" ')}</g>`}
  </svg>`;
}
