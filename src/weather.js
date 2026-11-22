// RideBike – Wind & Wetter entlang der Route
// © 2026 Florian Enders
//
// Holt stündliche Vorhersagen (Open-Meteo) für mehrere Punkte der Route und wertet sie
// zur jeweiligen Ankunftszeit aus: Regen, Temperatur und – das Besondere – wie viel der
// Strecke mit Rücken- bzw. Gegenwind gefahren wird. Daraus folgt die beste Startzeit.

import { WEATHER_API } from './config.js';
import { bearing } from './geo.js';

const cache = new Map();

/** Vorhersage für bis zu ~10 Punkte in einem Aufruf */
export async function forecast(points) {
  const key = points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 20 * 60e3) return hit.data;
  const u = new URL(WEATHER_API);
  u.searchParams.set('latitude', points.map((p) => p[1].toFixed(4)).join(','));
  u.searchParams.set('longitude', points.map((p) => p[0].toFixed(4)).join(','));
  u.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code');
  u.searchParams.set('wind_speed_unit', 'kmh');
  u.searchParams.set('timezone', 'auto');
  u.searchParams.set('forecast_days', '3');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  const r = await fetch(u, { signal: ctl.signal });
  clearTimeout(t);
  if (!r.ok) throw new Error('Wetter nicht erreichbar');
  let data = await r.json();
  if (!Array.isArray(data)) data = [data];
  cache.set(key, { t: Date.now(), data });
  return data;
}

function hourAt(series, when) {
  const ts = series.hourly.time.map((x) => new Date(x).getTime());
  let i = ts.findIndex((t) => t > when) - 1;
  if (i < 0) i = 0;
  const h = series.hourly;
  return {
    temp: h.temperature_2m[i], pop: h.precipitation_probability?.[i] ?? 0, rain: h.precipitation[i],
    wind: h.wind_speed_10m[i], gust: h.wind_gusts_10m[i], dir: h.wind_direction_10m[i], code: h.weather_code[i]
  };
}

/**
 * Route zu einer Startzeit auswerten.
 * @returns { samples, tailShare, headShare, maxPop, rainMm, tMin, tMax, avgWind, headKm, tailKm }
 */
export async function routeWeather(r, startMs = Date.now()) {
  const n = Math.min(8, Math.max(3, Math.round(r.total / 4000) + 2));
  const idx = Array.from({ length: n }, (_, k) => {
    const d = (k / (n - 1)) * r.total;
    let i = r.cum.findIndex((c) => c >= d); if (i < 0) i = r.coords.length - 1;
    return i;
  });
  const pts = idx.map((i) => r.coords[i]);
  const data = await forecast(pts);
  const total = r.time || r.total / 5;
  const samples = idx.map((i, k) => ({ at: r.cum[i], when: startMs + (r.cum[i] / r.total) * total * 1000, ...hourAt(data[k] || data[0], startMs + (r.cum[i] / r.total) * total * 1000) }));
  // Rücken-/Gegenwind je ~200 m Abschnitt mit dem Wind des nächstgelegenen Messpunkts
  let head = 0, tail = 0, side = 0, last = 0;
  for (let i = 1; i < r.coords.length; i++) {
    const seg = r.cum[i] - r.cum[last];
    if (seg < 200 && i < r.coords.length - 1) continue;
    const brg = bearing(r.coords[last], r.coords[i]);
    const s = samples.reduce((a, b) => (Math.abs(b.at - r.cum[i]) < Math.abs(a.at - r.cum[i]) ? b : a));
    const to = (s.dir + 180) % 360;                       // Wind weht nach „to“
    const comp = Math.cos(((brg - to) * Math.PI) / 180) * s.wind; // + Rückenwind, − Gegenwind
    if (s.wind < 6 || Math.abs(comp) < 4) side += seg;
    else if (comp > 0) tail += seg; else head += seg;
    last = i;
  }
  const sum = head + tail + side || 1;
  return {
    samples,
    headShare: head / sum, tailShare: tail / sum, headKm: head / 1000, tailKm: tail / 1000,
    maxPop: Math.max(...samples.map((s) => s.pop || 0)),
    rainMm: samples.reduce((a, s) => a + (s.rain || 0), 0),
    tMin: Math.min(...samples.map((s) => s.temp)), tMax: Math.max(...samples.map((s) => s.temp)),
    avgWind: samples.reduce((a, s) => a + s.wind, 0) / samples.length,
    maxGust: Math.max(...samples.map((s) => s.gust || 0)),
    code: samples[Math.floor(samples.length / 2)].code
  };
}

/** Startzeiten vergleichen (jetzt … +5 h) und die beste wählen (trocken, wenig Gegenwind) */
export async function bestStart(r, hours = [0, 1, 2, 3, 4, 5]) {
  const base = Math.ceil(Date.now() / 36e5) * 36e5;
  const res = [];
  for (const h of hours) {
    const at = h === 0 ? Date.now() : base + (h - 1) * 36e5;
    const w = await routeWeather(r, at);
    res.push({ h, at, w, score: w.maxPop * 1.2 + w.rainMm * 20 + w.headShare * 40 - w.tailShare * 15 + h * 2 });
  }
  return res;
}

/** Windrichtung (woher) am Startpunkt – für windbewusste Rundtouren */
export async function windAt(p) {
  const [d] = await forecast([p]);
  const s = hourAt(d, Date.now());
  return { dir: s.dir, speed: s.wind };
}

const WMO = [[0, '☀️', 'klar'], [1, '🌤️', 'heiter'], [3, '☁️', 'bewölkt'], [45, '🌫️', 'Nebel'], [51, '🌦️', 'Niesel'],
  [61, '🌧️', 'Regen'], [71, '🌨️', 'Schnee'], [80, '🌦️', 'Schauer'], [95, '⛈️', 'Gewitter']];
export function wmo(code) {
  let r = WMO[0];
  for (const w of WMO) if (code >= w[0]) r = w;
  return { icon: r[1], text: r[2] };
}

export const compass = (deg) => ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
