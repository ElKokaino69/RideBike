// RideBike – E-Bike-Reichweite & Akku-Planer
// © 2026 Florian Enders
//
// Physikalisches Modell entlang der Route: pro Abschnitt Steigung, Rollwiderstand,
// Luftwiderstand und Gesamtgewicht → benötigte Leistung. Der Fahrer tritt mit seiner
// Dauerleistung, der Motor ergänzt je nach Unterstützungsstufe bis zur Abregelgrenze
// (25 km/h Pedelec, 45 km/h S-Pedelec). Energie aus dem Akku = Motorarbeit / Wirkungsgrad.

import { settings } from './settings.js';
import { physics, isEbike } from './bike.js';
import { overpass } from './trails.js';

/** Unterstützungsstufen: Faktor × Fahrerleistung, Motor-Spitzenleistung (W) */
export const ASSIST = [
  { id: 'eco',   name: 'Eco',   factor: 0.6, max: 250 },
  { id: 'tour',  name: 'Tour',  factor: 1.4, max: 400 },
  { id: 'sport', name: 'Sport', factor: 2.2, max: 550 },
  { id: 'turbo', name: 'Turbo', factor: 3.4, max: 650 }
];
export const BATTERIES = [400, 500, 545, 625, 750, 800, 1000];

const G = 9.81;
const EFF = 0.78;      // Akku → Hinterrad (Motor, Getriebe, Elektronik)
const RESERVE = 0.08;  // Rest, den kein Akku wirklich hergibt

/** Leistungsbedarf bei Tempo v (m/s) auf Steigung grade (dimensionslos) */
function powerAt(v, grade, m, cr, cx) {
  const a = Math.atan(grade);
  return cr * m * G * Math.cos(a) * v + m * G * Math.sin(a) * v + cx * v ** 3;
}

/**
 * Energie entlang der Route simulieren.
 * @returns {{ wh, pct, remainPct, emptyAtM, levels, ok }}
 */
export function simulate(r, assistId = settings.bike.assist, bike = settings.bike) {
  if (!r?.coords?.length || !isEbike(bike)) return null;
  const { mass, cr, cx } = physics();
  const rider = Math.max(40, bike.power);
  const cutoff = (bike.type === 'speed' ? 45 : 25) / 3.6;
  const vmax = Math.max(cutoff, (bike.maxSpeed || 25) / 3.6);
  const lvl = ASSIST.find((x) => x.id === assistId) || ASSIST[1];
  const usable = bike.batteryWh * (bike.charge / 100) * (1 - RESERVE);
  let wh = 0, emptyAtM = null, timeS = 0;
  const step = 60; // m – Abschnitte glätten Höhenrauschen
  let acc = 0, accUp = 0, last = 0;
  const flush = (d, dz, atM) => {
    if (d <= 0) return;
    const grade = Math.max(-0.25, Math.min(0.3, dz / d));
    // Tempo finden, bei dem Fahrer + Motor genau den Bedarf decken
    let lo = 0.8, hi = vmax;
    for (let i = 0; i < 28; i++) {
      const v = (lo + hi) / 2;
      const motor = v < cutoff ? Math.min(lvl.max, lvl.factor * rider) : 0;
      if (powerAt(v, grade, mass, cr, cx) > rider + motor) hi = v; else lo = v;
    }
    const v = lo;
    const need = powerAt(v, grade, mass, cr, cx);
    const motor = v < cutoff ? Math.max(0, Math.min(need - rider * 0.55, Math.min(lvl.max, lvl.factor * rider))) : 0;
    const t = d / v;
    timeS += t;
    wh += (motor * t) / 3600 / EFF;
    if (emptyAtM == null && wh > usable) emptyAtM = atM;
  };
  const z = (i) => r.coords[i][2] ?? 0;
  for (let i = 1; i < r.coords.length; i++) {
    const d = r.cum[i] - r.cum[i - 1];
    acc += d; accUp += z(i) - z(i - 1);
    if (acc >= step || i === r.coords.length - 1) { flush(acc, r.hasEle ? accUp : 0, r.cum[i]); acc = 0; accUp = 0; last = i; }
  }
  const pct = (wh / (bike.batteryWh * (1 - RESERVE))) * 100;
  return {
    wh, pct, timeS, emptyAtM, usable,
    remainPct: Math.max(0, bike.charge - pct),
    ok: emptyAtM == null
  };
}

/** Alle Stufen vergleichen (für die Auswahl im Routenplaner) */
export function compareLevels(r) {
  return ASSIST.map((a) => ({ ...a, res: simulate(r, a.id) }));
}

/** Ladestationen fürs E-Bike in der Nähe eines Punktes (Overpass) */
export async function chargersNear([lng, lat], radius = 4000) {
  const q = `[out:json][timeout:25];(
    node["amenity"="charging_station"]["bicycle"="yes"](around:${radius},${lat},${lng});
    node["amenity"="charging_station"]["socket:schuko"](around:${radius},${lat},${lng});
    node["amenity"="charging_station"]["motorcar"="no"](around:${radius},${lat},${lng});
  );out body 30;`;
  const data = await overpass(q);
  const seen = new Set();
  return (data.elements || []).filter((e) => !seen.has(e.id) && seen.add(e.id)).map((e) => ({
    id: e.id, lngLat: [e.lon, e.lat],
    name: e.tags?.name || e.tags?.operator || 'Ladestation',
    fee: e.tags?.fee
  }));
}
