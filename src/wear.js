// RideBike – Verschleiß- & Wartungs-Tracker
// © 2026 Florian Enders
//
// Jede aufgezeichnete Fahrt zählt auf die Bauteile. Gelände und Nässe beschleunigen den
// Verschleiß (MTB-Trails, Schotter). Bei 90 % gibt es einen Hinweis, bei 100 % einen Alarm.

import { Preferences } from '@capacitor/preferences';
import { PARTS_SHOP } from './config.js';

const KEY = 'ridebike.wear.v1';

/** Bauteile mit typischen Wechselintervallen (km) und Faktoren für Gelände */
export const PARTS = [
  { id: 'chain',   name: 'Kette',               km: 3000,  off: 1.6, ebike: 0.75, q: 'Fahrradkette' },
  { id: 'cass',    name: 'Kassette & Ritzel',    km: 9000,  off: 1.5, ebike: 0.75, q: 'Kassette' },
  { id: 'padsF',   name: 'Bremsbeläge vorne',    km: 1800,  off: 1.8, ebike: 0.7,  q: 'Bremsbeläge Scheibenbremse' },
  { id: 'padsR',   name: 'Bremsbeläge hinten',   km: 1500,  off: 1.8, ebike: 0.7,  q: 'Bremsbeläge Scheibenbremse' },
  { id: 'tyreF',   name: 'Reifen vorne',         km: 5000,  off: 1.4, ebike: 0.85, q: 'Fahrradreifen' },
  { id: 'tyreR',   name: 'Reifen hinten',        km: 3500,  off: 1.4, ebike: 0.8,  q: 'Fahrradreifen' },
  { id: 'service', name: 'Inspektion',           km: 2500,  off: 1.2, ebike: 1,    q: '', months: 12 }
];

export const wear = { parts: {}, totalKm: 0 };

function blank() {
  const now = Date.now();
  return Object.fromEntries(PARTS.map((p) => [p.id, { km: 0, since: now, interval: p.km }]));
}

export async function loadWear() {
  wear.parts = blank();
  try {
    const v = (await Preferences.get({ key: KEY })).value;
    if (v) { const d = JSON.parse(v); Object.assign(wear.parts, d.parts || {}); wear.totalKm = d.totalKm || 0; }
  } catch { /* erster Start */ }
}

function save() {
  Preferences.set({ key: KEY, value: JSON.stringify(wear) }).catch(() => {});
}

/** Verschleiß-Kilometer einer Fahrt aufbuchen; gibt neu fällige Teile zurück */
export function addRide(ride, isEbike) {
  const km = ride.km || 0;
  if (km <= 0) return [];
  const s = ride.surf || {};
  const tot = Object.values(s).reduce((a, b) => a + b, 0) || 1;
  const offShare = ((s.mtb || 0) + (s.track || 0) * 0.6 + (s.path || 0) * 0.8) / tot;
  const before = status().filter((x) => x.pct >= 90).map((x) => x.id);
  for (const p of PARTS) {
    const f = (1 + offShare * (p.off - 1)) / (isEbike ? p.ebike : 1);
    wear.parts[p.id].km += km * f;
  }
  wear.totalKm += km;
  save();
  return status().filter((x) => x.pct >= 90 && !before.includes(x.id));
}

export function addManualKm(km) { addRide({ km }, false); }

export function resetPart(id) {
  wear.parts[id] = { ...wear.parts[id], km: 0, since: Date.now() };
  save();
}

export function setInterval_(id, km) {
  wear.parts[id].interval = km;
  save();
}

/** Zustand aller Teile (0–100+ %), Inspektion zusätzlich nach Zeit */
export function status() {
  return PARTS.map((p) => {
    const w = wear.parts[p.id] || { km: 0, since: Date.now(), interval: p.km };
    let pct = (w.km / (w.interval || p.km)) * 100;
    if (p.months) pct = Math.max(pct, ((Date.now() - w.since) / (p.months * 30.4 * 864e5)) * 100);
    return { ...p, ...w, pct, left: Math.max(0, (w.interval || p.km) - w.km) };
  });
}

export const dueCount = () => status().filter((x) => x.pct >= 90).length;

/** Link zum Ersatzteil (Partner-/Affiliate-Link aus config.js) */
export function shopUrl(part) {
  return PARTS_SHOP.replace('{q}', encodeURIComponent(part.q || part.name));
}
