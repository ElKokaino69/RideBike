// RideBike – Fahrtaufzeichnung & Statistik für Meilensteine
// © 2026 Florian Enders

import { Preferences } from '@capacitor/preferences';
import { map, currentExaggeration } from './mapcore.js';
import { settings } from './settings.js';
import { loc, onLocation } from './nav.js';
import { allTrails } from './trails.js';
import { sunPosition } from './details.js';
import { mapNetAllowed } from './offline.js';
import { dist, cumulative } from './geo.js';
import { evaluate, diffTiers } from './milestones.js';

const KEY_STATS = 'ridebike.stats.v1';
const KEY_RIDES = 'ridebike.rides.v1';
const E_TYPES = ['ebike', 'emtb', 'speed', 'cargo'];

export function defaultStats() {
  return {
    totalKm: 0, totalHm: 0, totalTimeH: 0, rides: 0,
    longestKm: 0, longestTimeH: 0, maxRideHm: 0, maxRideDescent: 0, maxAlt: 0,
    topSpeed: 0, bestAvg: 0, fastRides: 0, speedKm: 0, longestFastKm: 0,
    centuries: 0, fifties: 0, climbDays: 0, steepest: 0,
    dayKm: {}, weekKm: {}, monthKm: {}, weekHm: {}, monthRides: {},
    rideDays: [], weeks: [], months: [],
    early: 0, night: 0, golden: 0, weekend: 0, commute: 0, winter: 0,
    trails: [], mtbKm: 0, maxMtb: -1, cyclewayKm: 0, gravelKm: 0, networkKm: 0, peaks: [],
    cells10: [], cells1: [], home: null, farHome: 0,
    arrivals: 0, offlineRides: 0, flyovers: 0,
    bikeTypes: [], ebikeKm: 0, muscleKm: 0, cargoKm: 0,
    announced: {} // milestoneId -> höchste bereits gefeierte Stufe
  };
}

export const stats = defaultStats();
export let rides = [];

export async function loadStats() {
  try {
    const s = await Preferences.get({ key: KEY_STATS });
    if (s.value) Object.assign(stats, defaultStats(), JSON.parse(s.value));
    const r = await Preferences.get({ key: KEY_RIDES });
    if (r.value) rides = JSON.parse(r.value);
  } catch (e) { console.warn('Statistik', e); }
}

let saveT;
export function saveStats() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    Preferences.set({ key: KEY_STATS, value: JSON.stringify(stats) }).catch(() => {});
    Preferences.set({ key: KEY_RIDES, value: JSON.stringify(rides.slice(0, 200)) }).catch(() => {});
  }, 200);
}

// ---------------------------------------------------------------------
// Datumsschlüssel
// ---------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
/** fortlaufender Wochenindex (Montag-basiert) */
function weekIndex(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dow);
  return Math.round(t.getTime() / (7 * 864e5));
}
const addUnique = (arr, v) => { if (!arr.includes(v)) arr.push(v); };

// ---------------------------------------------------------------------
// Fahrt in die Statistik übernehmen
// ---------------------------------------------------------------------
export function applyRide(st, r) {
  const d0 = new Date(r.start), d1 = new Date(r.end);
  const hours = r.movingS / 3600;
  st.totalKm += r.km;
  st.totalHm += r.ascent;
  st.totalTimeH += hours;
  st.rides += 1;
  st.longestKm = Math.max(st.longestKm, r.km);
  st.longestTimeH = Math.max(st.longestTimeH, hours);
  st.maxRideHm = Math.max(st.maxRideHm, r.ascent);
  st.maxRideDescent = Math.max(st.maxRideDescent, r.descent);
  st.maxAlt = Math.max(st.maxAlt, r.maxAlt || 0);
  st.topSpeed = Math.max(st.topSpeed, r.maxKmh);
  if (r.km >= 10) st.bestAvg = Math.max(st.bestAvg, r.avgKmh);
  if (r.km >= 20 && r.avgKmh >= 20) st.fastRides++;
  st.speedKm += r.kmFast || 0;
  if (r.avgKmh >= 25) st.longestFastKm = Math.max(st.longestFastKm, r.km);
  if (r.km >= 100) st.centuries++;
  if (r.km >= 50) st.fifties++;
  if (r.ascent >= 500) st.climbDays++;
  st.steepest = Math.max(st.steepest, r.steepest || 0);

  const dk = dayKey(d0), mk = monthKey(d0), wk = weekIndex(d0);
  st.dayKm[dk] = (st.dayKm[dk] || 0) + r.km;
  st.weekKm[wk] = (st.weekKm[wk] || 0) + r.km;
  st.monthKm[mk] = (st.monthKm[mk] || 0) + r.km;
  st.weekHm[wk] = (st.weekHm[wk] || 0) + r.ascent;
  st.monthRides[mk] = (st.monthRides[mk] || 0) + 1;
  addUnique(st.rideDays, dk);
  addUnique(st.weeks, wk);
  addUnique(st.months, d0.getMonth() + 1);

  const h0 = d0.getHours(), h1 = d1.getHours(), dow = d0.getDay();
  if (h0 < 7) st.early++;
  if (h1 >= 21 || h0 >= 21) st.night++;
  if (r.golden) st.golden++;
  if (dow === 0 || dow === 6) st.weekend++;
  else if ((h0 >= 6 && h0 < 9) || (h0 >= 16 && h0 < 19)) st.commute++;
  if ([11, 0, 1].includes(d0.getMonth())) st.winter++;

  (r.trails || []).forEach((t) => addUnique(st.trails, t));
  st.mtbKm += r.surf?.mtb || 0;
  st.maxMtb = Math.max(st.maxMtb, r.maxMtb ?? -1);
  st.cyclewayKm += r.surf?.cycleway || 0;
  st.gravelKm += r.surf?.track || 0;
  st.networkKm += r.networkKm || 0;
  (r.peaks || []).forEach((p) => addUnique(st.peaks, p));
  (r.cells10 || []).forEach((c) => addUnique(st.cells10, c));
  (r.cells1 || []).forEach((c) => addUnique(st.cells1, c));
  if (!st.home && r.startPos) st.home = r.startPos;
  if (st.home) st.farHome = Math.max(st.farHome, (r.track || []).reduce((m, p) => Math.max(m, dist(st.home, p) / 1000), 0));

  if (r.arrived) st.arrivals++;
  if (r.offline) st.offlineRides++;
  addUnique(st.bikeTypes, r.bikeType);
  if (E_TYPES.includes(r.bikeType)) st.ebikeKm += r.km; else st.muscleKm += r.km;
  if (r.bikeType === 'cargo' || (r.luggageKg || 0) >= 10) st.cargoKm += r.km;
  return st;
}

// ---------------------------------------------------------------------
// Aufzeichnung
// ---------------------------------------------------------------------
export const rec = { active: false, ride: null };
const recListeners = new Set();
export function onRecord(fn) { recListeners.add(fn); }
const emit = (type, data) => recListeners.forEach((fn) => fn(type, data));

function terrainElevation(p) {
  try {
    if (!map?.getTerrain?.()) return null;
    const e = map.queryTerrainElevation({ lng: p[0], lat: p[1] });
    if (e == null || !isFinite(e)) return null;
    return e / (settings.terrain ? currentExaggeration() : 1);
  } catch { return null; }
}

/** Untergrund an der aktuellen Position (gerenderte Rad-Ebenen) */
function surfaceAt(p) {
  try {
    const pt = map.project(p);
    const box = [[pt.x - 8, pt.y - 8], [pt.x + 8, pt.y + 8]];
    const layers = ['rb-mtb', 'rb-cycleway', 'rb-track', 'rb-path'].filter((l) => map.getLayer(l));
    const f = map.queryRenderedFeatures(box, { layers })[0];
    if (!f) return { kind: 'road' };
    const kind = { 'rb-mtb': 'mtb', 'rb-cycleway': 'cycleway', 'rb-track': 'track', 'rb-path': 'path' }[f.layer.id];
    const sc = parseInt(String(f.properties?.mtb_scale ?? ''), 10);
    return { kind, scale: isNaN(sc) ? null : sc };
  } catch { return { kind: 'road' }; }
}

export function startRide(mode = 'free') {
  if (rec.active) return;
  rec.active = true;
  rec.ride = {
    mode, start: Date.now(), lastT: null, pts: [], km: 0, movingS: 0, maxKmh: 0, kmFast: 0,
    ascent: 0, descent: 0, eleRef: null, maxAlt: 0, steepest: 0,
    surf: { mtb: 0, cycleway: 0, track: 0, path: 0, road: 0 }, maxMtb: -1, sinceSurf: 0, lastSurf: null,
    arrived: false, offline: !mapNetAllowed(), bikeType: settings.bike.type, luggageKg: settings.bike.luggageKg,
    speeds: []
  };
  if (loc.pos) onFix(loc);
  emit('start', rec.ride);
}

function onFix(l) {
  const r = rec.ride;
  if (!rec.active || !r || !l.pos) return;
  if (l.accuracy && l.accuracy > 40) return;
  const now = Date.now();
  const p = [l.pos[0], l.pos[1]];
  const ele = terrainElevation(p);
  const last = r.pts[r.pts.length - 1];
  if (!last) {
    r.pts.push([p[0], p[1], ele, now]);
    r.lastT = now;
    if (ele != null) { r.eleRef = ele; r.maxAlt = ele; }
    emit('update', r);
    return;
  }
  const d = dist(last, p);
  const dt = (now - last[3]) / 1000;
  if (d < Math.max(4, (l.accuracy || 5) * 0.4)) return;          // Zittern ignorieren
  if (dt <= 0 || d / dt > 33) return;                               // Sprünge > 120 km/h verwerfen
  let v = l.speed && l.speed > 0 ? l.speed : d / dt;               // m/s
  v = Math.min(v, d / Math.max(dt, 0.5) * 1.6);                     // GPS-Ausreißer dämpfen
  r.speeds.push(v);
  if (r.speeds.length > 3) r.speeds.shift();
  const vSmooth = r.speeds.reduce((a, b) => a + b, 0) / r.speeds.length;
  const kmh = vSmooth * 3.6;
  r.maxKmh = Math.max(r.maxKmh, kmh);
  r.km += d / 1000;
  if (vSmooth > 1) r.movingS += dt;
  if (kmh > 25) r.kmFast += d / 1000;

  if (ele != null) {
    if (r.eleRef == null) r.eleRef = ele;
    const de = ele - r.eleRef;
    if (Math.abs(de) >= 3) { if (de > 0) r.ascent += de; else r.descent -= de; r.eleRef = ele; }
    r.maxAlt = Math.max(r.maxAlt, ele);
  }
  r.pts.push([p[0], p[1], ele, now]);

  // Steigung über ~100 m
  let back = 0, j = r.pts.length - 1;
  while (j > 0 && back < 100) { back += dist(r.pts[j - 1], r.pts[j]); j--; }
  if (back >= 90 && vSmooth > 1.5 && ele != null && r.pts[j][2] != null) {
    const g = ((ele - r.pts[j][2]) / back) * 100;
    if (g > r.steepest && g < 40) r.steepest = g;
  }

  // Untergrund alle ~40 m
  r.sinceSurf += d;
  if (r.sinceSurf >= 40) {
    const s = surfaceAt(p);
    r.surf[s.kind] = (r.surf[s.kind] || 0) + r.sinceSurf / 1000;
    if (s.kind === 'mtb' && s.scale != null) r.maxMtb = Math.max(r.maxMtb, s.scale);
    r.sinceSurf = 0;
  }
  if (!mapNetAllowed()) r.offline = true;
  r.lastT = now;
  emit('update', { ...r, kmh });
}

export function markArrived() { if (rec.ride) rec.ride.arrived = true; }

function simplify(pts, max = 600) {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}

/** Trails/Radrouten, auf denen die Fahrt mindestens 500 m verlief */
function matchTrails(track) {
  const hits = new Set();
  let networkM = 0;
  const trails = allTrails();
  if (!trails.length || track.length < 2) return { ids: [], networkKm: 0 };
  for (const t of trails) {
    let along = 0;
    const pts = t.lines.flat();
    if (!pts.length) continue;
    // grobe Bounding-Box-Vorprüfung
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const q of pts) { w = Math.min(w, q[0]); e = Math.max(e, q[0]); s = Math.min(s, q[1]); n = Math.max(n, q[1]); }
    for (let i = 1; i < track.length; i++) {
      const p = track[i];
      if (p[0] < w - 0.002 || p[0] > e + 0.002 || p[1] < s - 0.002 || p[1] > n + 0.002) continue;
      let near = false;
      for (let k = 0; k < pts.length; k += 2) { if (dist(p, pts[k]) < 30) { near = true; break; } }
      if (near) along += dist(track[i - 1], p);
    }
    if (along >= 500) {
      hits.add(t.id);
      if (['icn', 'ncn', 'rcn'].includes(t.tags.network)) networkM += along;
    }
  }
  return { ids: [...hits], networkKm: networkM / 1000 };
}

function peaksNear(track) {
  const out = new Set();
  try {
    const feats = map.querySourceFeatures('openmaptiles', { sourceLayer: 'mountain_peak' });
    for (const f of feats) {
      const c = f.geometry?.coordinates;
      if (!c) continue;
      for (let i = 0; i < track.length; i += 2) {
        if (dist(track[i], c) < 150) { out.add(f.properties?.name || `${c[0].toFixed(3)},${c[1].toFixed(3)}`); break; }
      }
    }
  } catch { /* Kacheln evtl. nicht geladen */ }
  return [...out];
}

/** Fahrt beenden → { ride, unlocked } oder null wenn zu kurz */
export function finishRide() {
  if (!rec.active) return null;
  rec.active = false;
  const r = rec.ride;
  rec.ride = null;
  emit('stop', r);
  if (!r || r.km < 0.2 || r.pts.length < 3) return null;
  const end = Date.now();
  const track = r.pts.map((p) => [p[0], p[1], p[2]]);
  const t0 = sunPosition(new Date(r.start), track[0][1], track[0][0]).altitude;
  const t1 = sunPosition(new Date(end), track[track.length - 1][1], track[track.length - 1][0]).altitude;
  const golden = (t0 > -4 && t0 < 8) || (t1 > -4 && t1 < 8);
  const trails = matchTrails(track);
  const cells1 = [...new Set(track.map((p) => `${Math.floor(p[0] * 70)}:${Math.floor(p[1] * 111)}`))];
  const cells10 = [...new Set(track.map((p) => `${Math.floor(p[0] * 7)}:${Math.floor(p[1] * 11.1)}`))];
  const ride = {
    id: `r${r.start}`, mode: r.mode, start: r.start, end,
    km: r.km, movingS: r.movingS, maxKmh: r.maxKmh, avgKmh: r.movingS > 0 ? (r.km / (r.movingS / 3600)) : 0,
    kmFast: r.kmFast, ascent: r.ascent, descent: r.descent, maxAlt: r.maxAlt, steepest: r.steepest,
    surf: r.surf, maxMtb: r.maxMtb, trails: trails.ids, networkKm: trails.networkKm, peaks: peaksNear(track),
    cells1, cells10, startPos: track[0], golden, arrived: r.arrived, offline: r.offline,
    bikeType: r.bikeType, luggageKg: r.luggageKg, track: simplify(track)
  };
  const before = evaluate(stats);
  applyRide(stats, ride);
  const after = evaluate(stats);
  const unlocked = diffTiers(before, after);
  unlocked.forEach((u) => { stats.announced[u.m.id] = Math.max(stats.announced[u.m.id] || 0, u.tier); });
  rides.unshift(ride);
  saveStats();
  return { ride, unlocked };
}

/** Vorläufige Freischaltungen während der Fahrt (Live-Banner) */
export function liveUnlocks() {
  const r = rec.ride;
  if (!rec.active || !r || r.km < 0.05) return [];
  const st = JSON.parse(JSON.stringify(stats));
  const before = evaluate(stats);
  applyRide(st, {
    ...r, end: Date.now(), avgKmh: r.movingS > 0 ? r.km / (r.movingS / 3600) : 0, trails: [], peaks: [], cells1: [], cells10: [],
    networkKm: 0, golden: false, track: [], startPos: r.pts[0]
  });
  const after = evaluate(st);
  const out = [];
  for (const u of diffTiers(before, after)) {
    const key = `${u.m.id}:${u.tier}`;
    if (liveShown.has(key)) continue;
    // nur „Rekord“-artige Werte live melden, Zähler erst am Ende
    if (!['top_speed', 'total_km', 'earth', 'longest', 'total_hm', 'ride_hm', 'max_alt', 'steepest', 'descent', 'speed_km', 'total_time', 'long_time', 'mtb_km', 'cycleway_km', 'gravel_km', 'ebike_km', 'muscle_km', 'day_km'].includes(u.m.id)) continue;
    liveShown.add(key);
    out.push(u);
  }
  return out;
}
const liveShown = new Set();

export function countFlyover() {
  const before = evaluate(stats);
  stats.flyovers++;
  saveStats();
  return diffTiers(before, evaluate(stats));
}

export function initRecorder() {
  onLocation((l) => onFix(l));
}

export function rideElevationRoute(ride) {
  const coords = ride.track.filter((p) => p[2] != null);
  if (coords.length < 2) return null;
  const cum = cumulative(coords);
  return { coords, cum, total: cum[cum.length - 1], hasEle: true };
}
