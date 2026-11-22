// RideBike – Individuelles Fahrradprofil (Radtyp, Gewicht, Leistung, Reifen, Vorlieben)
// © 2026 Florian Enders

import { settings } from './settings.js';

// Radtypen mit Voreinstellungen. brouter = Routingprofil auf brouter.de
export const BIKE_TYPES = [
  { id: 'trekking', name: 'Trekking',   icon: 'tour',   brouter: 'trekking', bikeKg: 16, tyre: 'allround', aero: 'upright', support: 0,   maxSpeed: 40 },
  { id: 'city',     name: 'City',       icon: 'bike',   brouter: 'trekking', bikeKg: 18, tyre: 'balloon',  aero: 'upright', support: 0,   maxSpeed: 30, avoidTraffic: true },
  { id: 'road',     name: 'Rennrad',    icon: 'fast',   brouter: 'fastbike', bikeKg: 8,  tyre: 'road',     aero: 'aero',    support: 0,   maxSpeed: 60 },
  { id: 'gravel',   name: 'Gravel',     icon: 'trail',  brouter: 'gravel',   bikeKg: 10, tyre: 'gravel',   aero: 'sport',   support: 0,   maxSpeed: 50 },
  { id: 'mtb',      name: 'MTB',        icon: 'mountain', brouter: 'mtb',    bikeKg: 14, tyre: 'knobby',   aero: 'upright', support: 0,   maxSpeed: 45 },
  { id: 'ebike',    name: 'E-Bike',     icon: 'fast',   brouter: 'trekking', bikeKg: 25, tyre: 'allround', aero: 'upright', support: 150, maxSpeed: 25 },
  { id: 'emtb',     name: 'E-MTB',      icon: 'mountain', brouter: 'mtb',    bikeKg: 24, tyre: 'knobby',   aero: 'upright', support: 200, maxSpeed: 25 },
  { id: 'speed',    name: 'S-Pedelec',  icon: 'fast',   brouter: 'fastbike', bikeKg: 28, tyre: 'allround', aero: 'sport',   support: 250, maxSpeed: 45 },
  { id: 'cargo',    name: 'Lastenrad',  icon: 'shield', brouter: 'trekking', bikeKg: 40, tyre: 'balloon',  aero: 'cargo',   support: 200, maxSpeed: 25, avoidSteps: true, avoidSteep: true }
];

// Rollwiderstand (C_r) je Reifen
export const TYRES = [
  { id: 'road',     name: 'Rennrad 25–32 mm', cr: 0.004 },
  { id: 'gravel',   name: 'Gravel 35–45 mm',  cr: 0.006 },
  { id: 'allround', name: 'Touren 37–50 mm',  cr: 0.008 },
  { id: 'balloon',  name: 'Ballon 50–60 mm',  cr: 0.010 },
  { id: 'knobby',   name: 'MTB grobstollig',  cr: 0.013 }
];

// Luftwiderstand (C_x·A·ρ/2 wie im BRouter-Modell)
export const AERO = [
  { id: 'aero',    name: 'Aero',      cx: 0.19 },
  { id: 'sport',   name: 'Sportlich', cx: 0.24 },
  { id: 'upright', name: 'Aufrecht',  cx: 0.30 },
  { id: 'cargo',   name: 'Lastenrad', cx: 0.42 }
];

export { DEFAULT_BIKE } from './bike-defaults.js';

export function bikeType(id = settings.bike.type) {
  return BIKE_TYPES.find((t) => t.id === id) || BIKE_TYPES[0];
}

/** Voreinstellungen eines Radtyps übernehmen (Fahrerwerte bleiben erhalten). */
export function applyBikeType(id) {
  const t = bikeType(id);
  Object.assign(settings.bike, {
    type: t.id,
    bikeKg: t.bikeKg,
    tyre: t.tyre,
    aero: t.aero,
    support: t.support,
    maxSpeed: t.maxSpeed,
    avoidTraffic: !!t.avoidTraffic,
    avoidSteps: !!t.avoidSteps,
    avoidSteep: !!t.avoidSteep,
    preferUnpaved: t.id === 'gravel' || t.id === 'mtb' || t.id === 'emtb'
  });
}

export function physics() {
  const b = settings.bike;
  const mass = b.riderKg + b.bikeKg + b.luggageKg;
  const cr = (TYRES.find((t) => t.id === b.tyre) || TYRES[2]).cr;
  const cx = (AERO.find((a) => a.id === b.aero) || AERO[2]).cx;
  const power = b.power + b.support;
  return { mass, cr, cx, power, maxSpeed: b.maxSpeed };
}

/** Geschwindigkeit in der Ebene (m/s) aus P = C_r·m·g·v + C_x·v³ */
export function flatSpeed() {
  const { mass, cr, cx, power, maxSpeed } = physics();
  let lo = 0.5, hi = 25;
  for (let i = 0; i < 40; i++) {
    const v = (lo + hi) / 2;
    const p = cr * mass * 9.81 * v + cx * v ** 3;
    if (p > power) hi = v; else lo = v;
  }
  return Math.min(lo, maxSpeed / 3.6);
}

/** Fahrzeit in Sekunden (eigene Schätzung, falls BRouter keine liefert) */
export function estimateSeconds(meters, ascent = 0) {
  const { mass, power } = physics();
  return meters / flatSpeed() + (mass * 9.81 * ascent) / Math.max(60, power) * 0.85;
}

/** BRouter-Profil + Parameter (nur Parameter, die das jeweilige Profil kennt) */
export function brouterRequest() {
  const b = settings.bike;
  const t = bikeType();
  const { mass, cr, cx, power, maxSpeed } = physics();
  const profile = t.brouter;
  const p = {};
  if (profile === 'trekking' || profile === 'fastbike' || profile === 'gravel') {
    Object.assign(p, { totalMass: Math.round(mass), maxSpeed: Math.round(maxSpeed), C_r: cr, S_C_x: cx, bikerPower: Math.round(power) });
  }
  if (profile === 'trekking') {
    p.avoid_unsafe = b.avoidTraffic;
    p.stick_to_cycleroutes = b.preferCycleRoutes;
    p.consider_elevation = true;
    p.allow_steps = !b.avoidSteps;
    if (b.avoidSteep) p.uphillcost = 80;
  } else if (profile === 'fastbike') {
    p.consider_traffic = b.avoidTraffic ? 1 : 0.1;
    p.allow_steps = !b.avoidSteps;
    if (b.avoidSteep) p.uphillcost = 80;
  } else if (profile === 'gravel') {
    p.prefer_unpaved_paths = b.preferUnpaved;
    p.prefer_cycle_routes = b.preferCycleRoutes;
    p.avoid_steep_inclines = b.avoidSteep;
    p.consider_traffic_estimate = b.avoidTraffic;
    p.consider_elevation = true;
  }
  return { profile, params: p };
}

export function bikeSummary() {
  const v = flatSpeed() * 3.6;
  const { mass, power } = physics();
  return { kmh: v, mass, power };
}
