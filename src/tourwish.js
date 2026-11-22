// RideBike – Tourwunsch in Alltagssprache → passende Rundtour
// © 2026 Florian Enders
//
// „2 h Gravel-Runde, max 500 hm, mit Café“ → Rundtour-Generator:
// mehrere Schleifen-Kandidaten (windbewusst: erst gegen den Wind, heim mit Rückenwind),
// Berechnung per BRouter, Auswahl nach Zieldistanz und Höhenmetern, optional mit Einkehr.

import { overpass } from './trails.js';
import { dist } from './geo.js';

const num = (s) => Number(String(s).replace(',', '.'));

/** Tourwunsch aus einem Satz lesen – null, wenn es kein Tourwunsch ist */
export function parseWish(text) {
  const t = ` ${text.toLowerCase()} `;
  const w = { km: null, minutes: null, maxAsc: null, kind: null, poi: null, hilly: false };
  let m;
  if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*(km|kilometer)\b/))) w.km = num(m[1]);
  if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*(h|std\.?|stunden?)\b/))) w.minutes = num(m[1]) * 60;
  if ((m = t.match(/(\d+)\s*(min|minuten)\b/))) w.minutes = (w.minutes || 0) + num(m[1]);
  if (/halbe stunde/.test(t)) w.minutes = 30;
  if (/(eine|1) stunde/.test(t) && !w.minutes) w.minutes = 60;
  if ((m = t.match(/(?:max(?:imal)?\.?|höchstens|unter|bis)\s*(\d+)\s*(hm|höhenmeter|m)\b/))) w.maxAsc = num(m[1]);
  else if ((m = t.match(/(\d+)\s*(hm|höhenmeter)\b/))) w.maxAsc = num(m[1]);
  if (/\bflach|ohne berge|gemütlich|entspannt/.test(t)) w.maxAsc = w.maxAsc ?? 150;
  if (/bergig|hügelig|knackig|anstiege|klettern/.test(t)) w.hilly = true;
  if (/gravel|schotter/.test(t)) w.kind = 'gravel';
  else if (/\bmtb\b|trail|mountainbike|singletrail/.test(t)) w.kind = 'mtb';
  else if (/rennrad|road|asphalt/.test(t)) w.kind = 'road';
  if (/café|cafe|kaffee|kuchen/.test(t)) w.poi = 'cafe';
  else if (/biergarten|bier|einkehr/.test(t)) w.poi = 'biergarten';
  else if (/\bsee\b|baden|badesee|wasser/.test(t)) w.poi = 'lake';
  else if (/aussicht|ausblick|panorama/.test(t)) w.poi = 'viewpoint';
  const isWish = w.km || w.minutes || /\brund(e|tour|fahrt)?\b|ausfahrt|tour\b/.test(t);
  if (!isWish || (!w.km && !w.minutes && !/rund|ausfahrt/.test(t))) return null;
  if (!w.km && !w.minutes) w.km = 25;
  return w;
}

export function wishLabel(w, kmh) {
  const km = targetKm(w, kmh);
  const parts = [`~${Math.round(km)} km`];
  if (w.minutes) parts.push(w.minutes >= 60 ? `${(w.minutes / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} h` : `${w.minutes} min`);
  if (w.maxAsc != null) parts.push(`max ${w.maxAsc} hm`);
  if (w.hilly) parts.push('bergig');
  if (w.kind) parts.push({ gravel: 'Gravel', mtb: 'MTB', road: 'Rennrad' }[w.kind]);
  if (w.poi) parts.push({ cafe: 'mit Café', biergarten: 'mit Biergarten', lake: 'am See', viewpoint: 'mit Aussicht' }[w.poi]);
  return parts.join(' · ');
}

export function targetKm(w, kmh) {
  if (w.km) return w.km;
  return (w.minutes / 60) * kmh * 0.88; // Pausen/Steigungen grob berücksichtigt
}

const R = 6371000;
function offset([lng, lat], brgDeg, m) {
  const b = (brgDeg * Math.PI) / 180, d = m / R, la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI];
}

/** Drei Wegpunkte einer Schleife: erst Richtung „heading“, dann im Bogen zurück */
export function loopPoints(start, km, heading, squash = 1) {
  const radius = (km * 1000) / (2 * Math.PI * 1.3); // Wege sind ~30 % länger als der Kreis
  const center = offset(start, heading, radius);
  const back = (heading + 180) % 360;
  return [-80, 0, 80].map((a) => offset(center, (back + 180 + a + 360) % 360, radius * (a === 0 ? 1 : squash)));
}

/** Einkehr/Ziel nahe einem Punkt suchen */
export async function poiNear([lng, lat], kind, radius = 2500) {
  const sel = {
    cafe: 'node["amenity"="cafe"]', biergarten: 'node["amenity"="biergarten"]',
    lake: 'way["natural"="water"]["water"~"lake|pond|reservoir"]', viewpoint: 'node["tourism"="viewpoint"]'
  }[kind];
  if (!sel) return null;
  const data = await overpass(`[out:json][timeout:20];${sel}(around:${radius},${lat},${lng});out center 15;`);
  const list = (data.elements || []).map((e) => ({ name: e.tags?.name || '', lngLat: [e.lon ?? e.center?.lon, e.lat ?? e.center?.lat] }))
    .filter((p) => p.lngLat[0] != null);
  list.sort((a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0) || dist(a.lngLat, [lng, lat]) - dist(b.lngLat, [lng, lat]));
  return list[0] || null;
}

/**
 * Rundtour erzeugen.
 * @param calc  (points) => Promise<route>
 */
export async function generateLoop(start, w, { calc, kmh, wind, seed = 0, onStep }) {
  const km = targetKm(w, kmh);
  // windbewusst: erst gegen den Wind (Wind „aus“ dir → dorthin starten)
  const base = wind && wind.speed >= 8 ? wind.dir : (seed * 97 + 35) % 360;
  const heads = [0, 45, -45].map((d) => (base + d + seed * 60 + 360) % 360);
  onStep?.('Rundtouren werden berechnet…');
  const cands = await Promise.allSettled(heads.map(async (h, i) => {
    const wps = loopPoints(start, km, h, i === 0 ? 1 : 0.8);
    const r = await calc([start, ...wps, start]);
    return { wps, r, h };
  }));
  const ok = cands.filter((c) => c.status === 'fulfilled').map((c) => c.value);
  if (!ok.length) throw new Error('Keine Rundtour gefunden');
  const score = (c) => {
    const dk = Math.abs(c.r.total / 1000 - km) / km;
    const asc = c.r.ascent || 0;
    const pen = w.maxAsc != null ? Math.max(0, asc - w.maxAsc) / Math.max(100, w.maxAsc) : 0;
    const hilly = w.hilly ? -Math.min(0.5, asc / (km * 25)) : 0;
    return dk * 2 + pen * 1.5 + hilly;
  };
  ok.sort((a, b) => score(a) - score(b));
  let best = ok[0];
  if (w.poi) {
    onStep?.('Suche Einkehr unterwegs…');
    try {
      const p = await poiNear(best.wps[1], w.poi, Math.max(1500, km * 120));
      if (p) {
        const wps = [best.wps[0], p.lngLat, best.wps[2]];
        const r = await calc([start, ...wps, start]);
        if (Math.abs(r.total / 1000 - km) / km < 0.45) best = { wps, r, h: best.h, poi: p };
      }
    } catch { /* ohne Einkehr weiter */ }
  }
  best.km = km;
  best.windAware = !!(wind && wind.speed >= 8);
  return best;
}
