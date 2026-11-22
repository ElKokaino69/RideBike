// RideBike – Routenberechnung (BRouter), Darstellung, Höhenprofil, 3D-Flyover
// © 2026 Florian Enders

import maplibregl from 'maplibre-gl';
import { BROUTER, PHOTON, C } from './config.js';
import { map, onStyleReady, isDarkStyle, currentStyleDef } from './mapcore.js';
import { settings } from './settings.js';
import { cumulative, along, bearing, angleDiff, lerpAngle, bboxOf, dist } from './geo.js';
import { fetchJson } from './ui.js';
import { brouterRequest, estimateSeconds } from './bike.js';
import { quality, animationsActive } from './graphics.js';
import { isOnline } from './offline.js';
import { analyzeSurface, findClimbs } from './analysis.js';

export const route = {
  data: null // { coords, cum, total, ascent, descent, time, maneuvers, hasEle, profile }
};

const EMPTY = { type: 'FeatureCollection', features: [] };
let flowStep = 0;
let flowRaf = null;

// ---------- Geocoding ----------
export async function searchPlaces(q, near) {
  if (!isOnline()) throw new Error('offline');
  const p = new URLSearchParams({ q, lang: 'de', limit: '7' });
  if (near) { p.set('lon', near[0].toFixed(5)); p.set('lat', near[1].toFixed(5)); }
  const data = await fetchJson(`${PHOTON}/api/?${p}`, {}, 10000);
  return (data.features || []).map((f) => {
    const pr = f.properties || {};
    const sub = [pr.street && (pr.street + (pr.housenumber ? ' ' + pr.housenumber : '')), pr.postcode, pr.city || pr.town || pr.village, pr.state, pr.country]
      .filter((v, i, a) => v && a.indexOf(v) === i && v !== pr.name).slice(0, 3).join(', ');
    return { name: pr.name || pr.street || 'Unbenannter Ort', sub, kind: pr.osm_value || pr.type || '', lngLat: f.geometry.coordinates };
  });
}

export async function reverseGeocode(lngLat) {
  try {
    const data = await fetchJson(`${PHOTON}/reverse?lon=${lngLat[0]}&lat=${lngLat[1]}&lang=de`, {}, 8000);
    const pr = data.features?.[0]?.properties;
    if (!pr) return null;
    const street = pr.street ? pr.street + (pr.housenumber ? ' ' + pr.housenumber : '') : null;
    return pr.name || street || pr.city || pr.town || pr.village || null;
  } catch {
    return null;
  }
}

// ---------- Routing ----------
export async function calcRoute(points) {
  if (!isOnline()) throw new Error('offline');
  const req = brouterRequest();
  try {
    return await calcRouteWith(points, req.profile, req.params);
  } catch (e) {
    if (/abort/i.test(String(e?.name || e?.message))) throw e;
    // Server lehnt Radparameter ab oder hat einen Fehler → ohne Parameter, dann Trekking als Rückfall
    if (Object.keys(req.params).length) {
      try { return await calcRouteWith(points, req.profile, {}); } catch { /* weiter */ }
    }
    if (req.profile !== 'trekking') return await calcRouteWith(points, 'trekking', {});
    throw e;
  }
}

async function calcRouteWith(points, profile, params) {
  const lonlats = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join('|');
  const extra = Object.entries(params).map(([k, v]) => `&profile:${k}=${encodeURIComponent(typeof v === 'boolean' ? (v ? 'true' : 'false') : v)}`).join('');
  const url = `${BROUTER}?lonlats=${lonlats}&profile=${encodeURIComponent(profile)}&alternativeidx=0&format=geojson&timode=2${extra}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  let r;
  try {
    r = await fetch(url, { signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
  const text = await r.text();
  if (!r.ok || !text.trim().startsWith('{')) {
    throw new Error(text.slice(0, 160) || `HTTP ${r.status}`);
  }
  const fc = JSON.parse(text);
  const f = fc.features?.[0];
  if (!f) throw new Error('Keine Route gefunden');
  const coords = f.geometry.coordinates;
  const cum = cumulative(coords);
  const total = cum[cum.length - 1];
  const hasEle = coords.every((c) => c[2] != null && !isNaN(c[2]));

  // Anstieg / Abstieg (geglättet)
  let ascent = 0, descent = 0;
  if (hasEle) {
    let last = coords[0][2];
    for (let i = 1; i < coords.length; i++) {
      const d = coords[i][2] - last;
      if (Math.abs(d) >= 3) { if (d > 0) ascent += d; else descent -= d; last = coords[i][2]; }
    }
  }
  const pr = f.properties || {};
  const fa = Number(pr['filtered ascend']);
  if (!isNaN(fa) && fa > 0) ascent = fa;

  const maneuvers = buildManeuvers(coords, cum, pr.voicehints);
  const brTime = Number(pr['total-time']);
  const hasPhysics = Object.keys(params).includes('bikerPower');
  const time = hasPhysics && brTime > 0 ? brTime : estimateSeconds(total, ascent);
  const out = { coords, cum, total, ascent, descent, hasEle, maneuvers, profile, time, brTime: hasPhysics ? brTime : 0 };
  out.surface = analyzeSurface(pr.messages);
  out.climbs = findClimbs(out);
  return out;
}

/** Route aus fremder Quelle (GPX) zu einem RideBike-Routenobjekt machen */
export function routeFromCoords(coords) {
  const cum = cumulative(coords);
  const total = cum[cum.length - 1];
  const hasEle = coords.every((c) => c[2] != null && !isNaN(c[2]));
  let ascent = 0, descent = 0;
  if (hasEle) {
    let last = coords[0][2];
    for (let i = 1; i < coords.length; i++) {
      const d = coords[i][2] - last;
      if (Math.abs(d) >= 3) { if (d > 0) ascent += d; else descent -= d; last = coords[i][2]; }
    }
  }
  const out = { coords, cum, total, ascent, descent, hasEle, maneuvers: buildManeuvers(coords, cum, null), profile: 'gpx', time: estimateSeconds(total, ascent), brTime: 0, imported: true };
  out.climbs = findClimbs(out);
  return out;
}

export function estimateTime(meters, ascent) {
  return estimateSeconds(meters, ascent);
}

// ---------- Manöver ----------
const CMD = {
  1: null,
  2: { type: 'turn', angle: -90, text: 'links abbiegen' },
  3: { type: 'turn', angle: -40, text: 'leicht links abbiegen' },
  4: { type: 'turn', angle: -135, text: 'scharf links abbiegen' },
  5: { type: 'turn', angle: 90, text: 'rechts abbiegen' },
  6: { type: 'turn', angle: 40, text: 'leicht rechts abbiegen' },
  7: { type: 'turn', angle: 135, text: 'scharf rechts abbiegen' },
  8: { type: 'keep', angle: -25, text: 'links halten' },
  9: { type: 'keep', angle: 25, text: 'rechts halten' },
  10: { type: 'uturn', angle: 180, text: 'wenden' },
  11: { type: 'uturn', angle: 180, text: 'wenden' },
  12: null,
  13: { type: 'roundabout', angle: 0, text: 'im Kreisverkehr' },
  14: { type: 'roundabout', angle: 0, text: 'im Kreisverkehr' },
  15: { type: 'uturn', angle: 180, text: 'wenden' },
  16: null,
  17: { type: 'keep', angle: -30, text: 'links ausfahren' },
  18: { type: 'keep', angle: 30, text: 'rechts ausfahren' }
};

function buildManeuvers(coords, cum, hints) {
  const out = [];
  if (Array.isArray(hints) && hints.length) {
    for (const h of hints) {
      const [idx, cmd, exit] = h;
      const def = CMD[cmd];
      if (!def || idx == null || idx >= coords.length) continue;
      const m = { idx, d: cum[idx], ...def, exit: exit || 0 };
      if (def.type === 'roundabout') m.text = exit ? `im Kreisverkehr die ${exit}. Ausfahrt nehmen` : 'in den Kreisverkehr fahren';
      out.push(m);
    }
  } else {
    // Fallback: Abbiegungen aus der Geometrie ableiten
    let lastD = -Infinity;
    for (let i = 1; i < coords.length - 1; i++) {
      const d = cum[i];
      if (d - lastD < 30) continue;
      const a = along(coords, cum, d - 20), b = coords[i], c = along(coords, cum, d + 20);
      const delta = angleDiff(bearing(a, b), bearing(b, c));
      const ad = Math.abs(delta);
      if (ad < 35) continue;
      const side = delta < 0 ? 'links' : 'rechts';
      let m;
      if (ad > 160) m = { type: 'uturn', angle: 180, text: 'wenden' };
      else if (ad > 115) m = { type: 'turn', angle: Math.sign(delta) * 135, text: `scharf ${side} abbiegen` };
      else if (ad > 60) m = { type: 'turn', angle: Math.sign(delta) * 90, text: `${side} abbiegen` };
      else m = { type: 'turn', angle: Math.sign(delta) * 40, text: `leicht ${side} abbiegen` };
      out.push({ idx: i, d, ...m });
      lastD = d;
    }
  }
  out.push({ idx: coords.length - 1, d: cum[cum.length - 1], type: 'arrive', angle: 0, text: 'Ziel erreicht' });
  return out;
}

// ---------- Darstellung ----------
function slopeColor(s) {
  if (s < -4) return '#38bdf8';
  if (s < 2) return C.accent;
  if (s < 5) return '#facc15';
  if (s < 8) return '#fb923c';
  if (s < 12) return '#ef4444';
  return '#c026d3';
}

function gradientExpr(r) {
  const solid = ['interpolate', ['linear'], ['line-progress'], 0, C.accent, 1, C.accent2];
  if (!r || !settings.slopeColors || !r.hasEle || r.total < 200) return solid;
  const n = Math.min(160, Math.max(12, Math.round(r.total / 120)));
  const expr = ['interpolate', ['linear'], ['line-progress']];
  let lastP = -1;
  for (let k = 0; k <= n; k++) {
    const p = k / n;
    const d = p * r.total;
    const a = along(r.coords, r.cum, d - 60), b = along(r.coords, r.cum, d + 60);
    const run = Math.max(1, Math.min(120, d + 60) - Math.max(0, d - 60));
    const s = a[2] != null && b[2] != null ? ((b[2] - a[2]) / run) * 100 : 0;
    if (p <= lastP) continue;
    expr.push(p, slopeColor(s));
    lastP = p;
  }
  return expr;
}

function routeFC(coords) {
  return { type: 'FeatureCollection', features: coords && coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [] };
}

function arrowImage() {
  const size = 40;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  const chevron = () => { g.beginPath(); g.moveTo(13, 11); g.lineTo(25, 20); g.lineTo(13, 29); };
  g.strokeStyle = 'rgba(2,20,11,.55)'; g.lineWidth = 9; chevron(); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 5; chevron(); g.stroke();
  return g.getImageData(0, 0, size, size);
}

function addRouteLayers(m) {
  const dark = isDarkStyle();
  const photo = !!currentStyleDef().photo;
  if (m.hasImage('rb-arrow')) m.removeImage('rb-arrow');
  m.addImage('rb-arrow', arrowImage(), { pixelRatio: 2 });
  m.addSource('rb-route', { type: 'geojson', data: routeFC(route.data?.coords), lineMetrics: true });
  m.addSource('rb-route-done', { type: 'geojson', data: EMPTY });
  m.addLayer({
    id: 'rb-route-glow', type: 'line', source: 'rb-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: photo
      ? { 'line-color': C.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 16, 18, 52], 'line-blur': 18, 'line-opacity': 0.7 }
      : { 'line-color': C.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 13, 18, 44], 'line-blur': 15, 'line-opacity': dark ? 0.65 : 0.45 }
  });
  m.addLayer({
    id: 'rb-route-halo', type: 'line', source: 'rb-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d9ff9e', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 18, 22], 'line-blur': 5, 'line-opacity': photo || dark ? 0.55 : 0.4 }
  });
  m.addLayer({
    id: 'rb-route-casing', type: 'line', source: 'rb-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#1f5a0c', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6.5, 18, 19] }
  });
  m.addLayer({
    id: 'rb-route-line', type: 'line', source: 'rb-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-gradient': gradientExpr(route.data), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 18, 12] }
  });
  m.addLayer({
    id: 'rb-route-flow', type: 'line', source: 'rb-route',
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 18, 4], 'line-opacity': 0.75, 'line-dasharray': [0, 4, 3] }
  });
  m.addLayer({
    id: 'rb-route-arrows', type: 'symbol', source: 'rb-route', minzoom: 12,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 70, 18, 120],
      'icon-image': 'rb-arrow',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.55, 18, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map'
    },
    paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 12.6, 0.95] }
  });
  m.addLayer({
    id: 'rb-route-done', type: 'line', source: 'rb-route-done',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': dark ? '#4b5563' : '#a3aab3', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 18, 12], 'line-opacity': 0.75 }
  });
}

const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]
];

function flowLoop() {
  let last = 0;
  const tick = (t) => {
    flowRaf = requestAnimationFrame(tick);
    if (!route.data || !animationsActive() || t - last < 55 * quality().interval) return;
    last = t;
    flowStep = (flowStep + 1) % DASH_SEQ.length;
    if (map.getLayer('rb-route-flow')) map.setPaintProperty('rb-route-flow', 'line-dasharray', DASH_SEQ[flowStep]);
  };
  if (!flowRaf) flowRaf = requestAnimationFrame(tick);
}

export function initRouting() {
  onStyleReady(addRouteLayers);
  flowLoop();
}

export function refreshRouteStyle() {
  if (map.getLayer('rb-route-line')) map.setPaintProperty('rb-route-line', 'line-gradient', gradientExpr(route.data));
}

/** Route setzen und eingeblendet animieren */
export function showRoute(r, { animate = true, fit = true, padding } = {}) {
  route.data = r;
  const src = map.getSource('rb-route');
  map.getSource('rb-route-done')?.setData(EMPTY);
  if (!src) return;
  if (!r) { src.setData(EMPTY); return; }

  if (fit) {
    map.fitBounds(bboxOf(r.coords), {
      padding: padding || { top: 130, bottom: 340, left: 50, right: 50 },
      pitch: map.getPitch() > 5 ? 45 : 0,
      bearing: map.getBearing(),
      duration: 1300,
      maxZoom: 16.5
    });
  }

  if (!animate || !settings.animations) {
    src.setData(routeFC(r.coords));
    refreshRouteStyle();
    return;
  }
  map.setPaintProperty('rb-route-line', 'line-gradient', ['interpolate', ['linear'], ['line-progress'], 0, C.accent, 1, C.accent2]);
  const t0 = performance.now();
  const dur = 1400;
  const step = (t) => {
    if (route.data !== r) return;
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    const d = e * r.total;
    let i = 0;
    while (i < r.cum.length && r.cum[i] <= d) i++;
    const part = r.coords.slice(0, i);
    part.push(along(r.coords, r.cum, d));
    src.setData(routeFC(part));
    if (k < 1) requestAnimationFrame(step);
    else { src.setData(routeFC(r.coords)); refreshRouteStyle(); }
  };
  requestAnimationFrame(step);
}

export function setProgress(alongM) {
  const r = route.data;
  const src = map.getSource('rb-route-done');
  if (!r || !src) return;
  let i = 0;
  while (i < r.cum.length && r.cum[i] <= alongM) i++;
  const part = r.coords.slice(0, i);
  part.push(along(r.coords, r.cum, alongM));
  src.setData(routeFC(part));
}

export function clearRoute() {
  route.data = null;
  map.getSource('rb-route')?.setData(EMPTY);
  map.getSource('rb-route-done')?.setData(EMPTY);
}

// ---------- Höhenprofil ----------
export function drawElevation(canvas, r, onHover) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!r?.hasEle) {
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('Kein Höhenprofil verfügbar', 12, H / 2);
    return;
  }
  const N = Math.min(320, Math.max(40, Math.round(W)));
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const d = (k / N) * r.total;
    pts.push([d, along(r.coords, r.cum, d)[2]]);
  }
  let min = Math.min(...pts.map((p) => p[1])), max = Math.max(...pts.map((p) => p[1]));
  if (max - min < 30) { const m = (max + min) / 2; min = m - 15; max = m + 15; }
  const padT = 12, padB = 18, padL = 50, padR = 6;
  const X = (d) => padL + (d / r.total) * (W - padL - padR);
  const Y = (e) => padT + (1 - (e - min) / (max - min)) * (H - padT - padB);

  // Gitter
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '600 10px system-ui, sans-serif';
  for (const e of [min, (min + max) / 2, max]) {
    ctx.beginPath(); ctx.moveTo(padL, Y(e)); ctx.lineTo(W - padR, Y(e)); ctx.stroke();
    ctx.fillText(`${Math.round(e).toLocaleString('de-DE')} m`, 2, Y(e) + 3);
  }
  // km-Achse mit runden Teilstrichen
  const km = r.total / 1000;
  const stepKm = km <= 3 ? 0.5 : km <= 8 ? 1 : km <= 20 ? 5 : km <= 60 ? 10 : 25;
  ctx.textAlign = 'center';
  for (let k = 0; k <= km + 1e-6; k += stepKm) {
    const x = X(k * 1000);
    if (x > W - padR - 24 && k > 0) continue;
    ctx.fillText(`${String(+k.toFixed(1)).replace('.', ',')} km`, Math.max(padL + 10, x), H - 3);
  }
  ctx.textAlign = 'right';
  ctx.fillText(`${String(+km.toFixed(1)).replace('.', ',')} km`, W - padR, H - 3);
  ctx.textAlign = 'left';

  // Fläche
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(139,225,58,.75)');
  grad.addColorStop(1, 'rgba(95,203,43,.05)');
  ctx.beginPath();
  ctx.moveTo(X(0), H - padB);
  pts.forEach((p) => ctx.lineTo(X(p[0]), Y(p[1])));
  ctx.lineTo(X(r.total), H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Linie (nach Steigung gefärbt)
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  for (let k = 1; k < pts.length; k++) {
    const s = ((pts[k][1] - pts[k - 1][1]) / Math.max(1, pts[k][0] - pts[k - 1][0])) * 100;
    ctx.strokeStyle = settings.slopeColors ? slopeColor(s) : '#b4f35a';
    ctx.beginPath();
    ctx.moveTo(X(pts[k - 1][0]), Y(pts[k - 1][1]));
    ctx.lineTo(X(pts[k][0]), Y(pts[k][1]));
    ctx.stroke();
  }

  // Interaktion
  // Einblenden von links nach rechts
  if (settings.animations && canvas.animate && canvas.dataset.lastRoute !== String(r.total)) {
    canvas.dataset.lastRoute = String(r.total);
    canvas.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  canvas.onpointerdown = canvas.onpointermove = (ev) => {
    if (ev.type === 'pointermove' && ev.pointerType === 'mouse' && ev.buttons === 0) { /* hover */ }
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(padL, Math.min(W - padR, ev.clientX - rect.left));
    const d = ((x - padL) / (W - padL - padR)) * r.total;
    const p = along(r.coords, r.cum, d);
    const a = along(r.coords, r.cum, d - 50), b = along(r.coords, r.cum, d + 50);
    const slope = ((b[2] - a[2]) / Math.max(1, dist(a, b))) * 100;
    onHover?.({ d, point: p, ele: p[2], slope, x });
  };
  canvas.onpointerleave = canvas.onpointerup = () => onHover?.(null);
}

// ---------- 3D-Flyover ----------
let flyRaf = null;
let flyMarker = null;

export function isFlying() { return !!flyRaf; }

/** Aktuelle Flyover-Position (für die Video-Aufnahme) */
export const flyState = { p: null, k: 0, d: 0 };

export function startFlyover(onEnd, opts = {}) {
  const r = route.data;
  if (!r) return;
  stopFlyover();
  const el = document.createElement('div');
  el.className = 'fly-rider';
  flyMarker = new maplibregl.Marker({ element: el }).setLngLat(r.coords[0]).addTo(map);
  const duration = opts.duration || Math.max(14000, Math.min(48000, (r.total / 1000) * 2600));
  const t0 = performance.now();
  let brg = bearing(r.coords[0], along(r.coords, r.cum, 300));
  map.jumpTo({ center: r.coords[0], zoom: 15.4, pitch: 64, bearing: brg });
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const d = e * r.total;
    const p = along(r.coords, r.cum, d);
    const ahead = along(r.coords, r.cum, Math.min(r.total, d + 420));
    if (dist(p, ahead) > 5) brg = lerpAngle(brg, bearing(p, ahead), 0.045);
    flyMarker.setLngLat(p);
    flyState.p = p; flyState.k = k; flyState.d = d;
    map.jumpTo({ center: p, bearing: brg, pitch: 64, zoom: 15.4 });
    if (k < 1) flyRaf = requestAnimationFrame(tick);
    else { stopFlyover(); onEnd?.(); }
  };
  flyRaf = requestAnimationFrame(tick);
}

export function stopFlyover() {
  if (flyRaf) cancelAnimationFrame(flyRaf);
  flyRaf = null;
  flyMarker?.remove();
  flyMarker = null;
}
