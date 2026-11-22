// RideBike – Mehrtagestouren: Etappen automatisch planen, Übernachtung vorschlagen
// © 2026 Florian Enders

import { overpass } from './trails.js';
import { nearestOnLine, dist } from './geo.js';

const HM_KM = 1.5; // 100 Höhenmeter „kosten“ so viel wie 1,5 km in der Ebene

function effortAt(r) {
  const e = [0];
  for (let i = 1; i < r.coords.length; i++) {
    const d = r.cum[i] - r.cum[i - 1];
    const up = r.hasEle ? Math.max(0, (r.coords[i][2] ?? 0) - (r.coords[i - 1][2] ?? 0)) : 0;
    e.push(e[i - 1] + d / 1000 + (up / 100) * HM_KM);
  }
  return e;
}

function statsBetween(r, i0, i1) {
  let up = 0, down = 0;
  if (r.hasEle) for (let i = i0 + 1; i <= i1; i++) { const d = (r.coords[i][2] ?? 0) - (r.coords[i - 1][2] ?? 0); if (d > 0) up += d; else down -= d; }
  return { km: (r.cum[i1] - r.cum[i0]) / 1000, asc: up * 0.85, desc: down * 0.85 }; // Rauschen grob abziehen
}

/** Route in Tagesetappen teilen (Anstrengung = km + Höhenmeter) */
export function splitStages(r, perDay) {
  const e = effortAt(r);
  const total = e[e.length - 1];
  const days = Math.max(1, Math.round(total / perDay));
  const target = total / days;
  const cuts = [0];
  for (let d = 1; d < days; d++) {
    const goal = target * d;
    let i = e.findIndex((x) => x >= goal);
    if (i < 0) i = e.length - 1;
    cuts.push(i);
  }
  cuts.push(r.coords.length - 1);
  return cuts.slice(0, -1).map((i0, k) => ({ i0, i1: cuts[k + 1], ...statsBetween(r, i0, cuts[k + 1]) }));
}

/** Für jedes Etappenende eine Unterkunft in der Nähe der Route suchen und die Etappe dorthin legen */
export async function findStays(r, stages, radius = 3500) {
  const ends = stages.slice(0, -1).map((s) => r.coords[s.i1]);
  if (!ends.length) return stages;
  const q = ends.map(([lng, lat]) => `node["tourism"~"^(hotel|guest_house|hostel|camp_site|alpine_hut|apartment)$"](around:${radius},${lat},${lng});way["tourism"~"^(hotel|guest_house|camp_site)$"](around:${radius},${lat},${lng});`).join('');
  const data = await overpass(`[out:json][timeout:25];(${q});out center tags 300;`);
  const KIND = { hotel: 'Hotel', guest_house: 'Pension', hostel: 'Hostel', camp_site: 'Camping', alpine_hut: 'Hütte', apartment: 'Ferienwohnung' };
  const pois = (data.elements || []).map((el) => ({
    name: el.tags?.name || KIND[el.tags?.tourism] || 'Unterkunft', kind: KIND[el.tags?.tourism] || 'Unterkunft',
    lngLat: [el.lon ?? el.center?.lon, el.lat ?? el.center?.lat], phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
    web: el.tags?.website || el.tags?.['contact:website'] || '', stars: el.tags?.stars || ''
  })).filter((p, i) => p.lngLat[0] != null && KIND[(data.elements[i].tags || {}).tourism]);
  const out = stages.map((s) => ({ ...s }));
  for (let k = 0; k < out.length - 1; k++) {
    const end = r.coords[out[k].i1];
    const dayLen = r.cum[out[k].i1] - r.cum[out[k].i0];
    let best = null;
    for (const p of pois) {
      const off = dist(p.lngLat, end);
      if (off > radius) continue;
      const n = nearestOnLine(r.coords, r.cum, p.lngLat);
      const shift = Math.abs(n.along - r.cum[out[k].i1]);
      if (shift > dayLen * 0.2) continue;
      const score = n.dist * 1.5 + shift * 0.5 + (p.name === p.kind ? 800 : 0);
      if (!best || score < best.score) best = { ...p, score, idx: n.idx, off: n.dist };
    }
    if (best) {
      out[k].stay = best;
      out[k].i1 = best.idx; out[k + 1].i0 = best.idx;
    }
  }
  return out.map((s) => ({ ...s, ...statsBetween(r, s.i0, s.i1) }));
}
