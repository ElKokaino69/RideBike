// RideBike – Radrouten & MTB-Trails aus OpenStreetMap (Overpass API)
// © 2026 Florian Enders

import { OVERPASS, C } from './config.js';
import { map, onStyleReady, labelAnchor, isDarkStyle } from './mapcore.js';
import { settings } from './settings.js';
import { lineLength, bboxOf } from './geo.js';
import { debounce } from './ui.js';
import { mapNetAllowed } from './offline.js';

const CELL = 0.25;             // Gitterzellen in Grad
const MIN_ZOOM = 10;
const loadedCells = new Set();
const relations = new Map();   // id -> { tags, ways: Map(wayId -> coords) }
let loading = false;
let selectedId = null;
let statusCb = () => {};

export function onTrailStatus(fn) { statusCb = fn; }

const NETWORK_LABEL = {
  icn: 'International', ncn: 'National', rcn: 'Regional', lcn: 'Lokal',
  imtb: 'MTB international', nmtb: 'MTB national', rmtb: 'MTB regional', lmtb: 'MTB lokal'
};

export function networkLabel(tags) {
  if (tags.network && NETWORK_LABEL[tags.network]) return NETWORK_LABEL[tags.network];
  return tags.route === 'mtb' ? 'MTB-Trail' : 'Radroute';
}

function fallbackColor(tags) {
  if (tags.route === 'mtb') return C.network.mtb;
  return C.network[tags.network] || C.network.lcn;
}

function toFeature(id, rel) {
  const lines = [...rel.ways.values()].filter((l) => l.length > 1);
  if (!lines.length) return null;
  const t = rel.tags;
  let len = 0;
  for (const l of lines) len += lineLength(l);
  return {
    type: 'Feature',
    id,
    properties: {
      id,
      name: t.name || t.ref || (t.route === 'mtb' ? 'MTB-Trail' : 'Radroute'),
      ref: t.ref || '',
      label: t.ref ? `${t.ref}${t.name ? ' · ' + t.name : ''}` : t.name || '',
      route: t.route,
      network: t.network || '',
      colour: t.colour || '',
      fallback: fallbackColor(t),
      loadedLen: len
    },
    geometry: { type: 'MultiLineString', coordinates: lines }
  };
}

function rebuild() {
  const src = map?.getSource('rb-trails');
  if (!src) return;
  const features = [];
  for (const [id, rel] of relations) {
    const f = toFeature(id, rel);
    if (f) features.push(f);
  }
  src.setData({ type: 'FeatureCollection', features });
}

export function getTrail(id) {
  const rel = relations.get(Number(id));
  if (!rel) return null;
  const lines = [...rel.ways.values()].filter((l) => l.length > 1);
  let len = 0;
  for (const l of lines) len += lineLength(l);
  return { id: Number(id), tags: rel.tags, lines, loadedLen: len, bbox: lines.length ? bboxOf(lines.flat()) : null };
}

/** Alle geladenen Trails (für die Fahrt-Auswertung) */
export function allTrails() {
  const out = [];
  for (const [id, rel] of relations) {
    const lines = [...rel.ways.values()].filter((l) => l.length > 1);
    if (lines.length) out.push({ id, tags: rel.tags, lines });
  }
  return out;
}

export function selectTrail(id) {
  selectedId = id == null ? null : Number(id);
  if (map?.getLayer('rb-trails-sel')) map.setFilter('rb-trails-sel', ['==', ['get', 'id'], selectedId ?? -1]);
}

function addLayers(m) {
  if (!m.getSource('rb-trails')) {
    m.addSource('rb-trails', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Routen: © OpenStreetMap / Overpass API' });
  }
  const before = labelAnchor(m);
  const vis = settings.layers.trails ? 'visible' : 'none';
  const color = ['to-color', ['get', 'colour'], ['get', 'fallback']];
  const dark = isDarkStyle();

  m.addLayer({
    id: 'rb-trails-casing', type: 'line', source: 'rb-trails', minzoom: 8,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
    paint: {
      'line-color': dark ? '#000' : '#fff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 7, 18, 12],
      'line-opacity': 0.55
    }
  }, before);
  m.addLayer({
    id: 'rb-trails-sel', type: 'line', source: 'rb-trails', filter: ['==', ['get', 'id'], selectedId ?? -1],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 18, 18, 28],
      'line-blur': 8,
      'line-opacity': 0.55
    }
  }, before);
  m.addLayer({
    id: 'rb-trails', type: 'line', source: 'rb-trails', minzoom: 8,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 14, 4, 18, 7],
      'line-opacity': 0.92
    }
  }, before);
  m.addLayer({
    id: 'rb-trails-flow', type: 'line', source: 'rb-trails', minzoom: 11.5,
    layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: vis },
    paint: {
      'line-color': '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11.5, 1, 18, 3],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0, 12.5, 0.7],
      'line-dasharray': [0, 4, 3]
    }
  }, before);
  m.addLayer({
    id: 'rb-trails-label', type: 'symbol', source: 'rb-trails', minzoom: 11,
    layout: {
      visibility: vis,
      'symbol-placement': 'line',
      'symbol-spacing': 380,
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10.5, 16, 13],
      'text-max-angle': 30,
      'text-keep-upright': true
    },
    paint: {
      'text-color': color,
      'text-halo-color': dark ? '#05080c' : '#ffffff',
      'text-halo-width': 2.2
    }
  });
  rebuild();
}

/** Overpass-Antwort übernehmen (auch aus dem Offline-Speicher) */
export function ingestTrails(data, bbox) {
  for (const el of data?.elements || []) {
    if (el.type !== 'relation') continue;
    let rel = relations.get(el.id);
    if (!rel) { rel = { tags: el.tags || {}, ways: new Map() }; relations.set(el.id, rel); }
    for (const m of el.members || []) {
      if (m.type !== 'way' || !m.geometry) continue;
      const coords = m.geometry.filter(Boolean).map((p) => [p.lon, p.lat]);
      const prev = rel.ways.get(m.ref);
      if (!prev || prev.length < coords.length) rel.ways.set(m.ref, coords);
    }
  }
  if (bbox) {
    const [[w, s], [e, n]] = bbox;
    for (let x = Math.ceil(w / CELL); x < Math.floor(e / CELL); x++) for (let y = Math.ceil(s / CELL); y < Math.floor(n / CELL); y++) loadedCells.add(`${x}:${y}`);
  }
  rebuild();
}

export async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 35000);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctl.signal
      });
      clearTimeout(t);
      if (r.status === 429 || r.status >= 500) throw new Error('Overpass ' + r.status);
      if (!r.ok) throw new Error('Overpass ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function loadVisible() {
  if (!map || !settings.layers.trails || loading) return;
  if (!mapNetAllowed()) { statusCb({ state: 'offline' }); return; }
  if (map.getZoom() < MIN_ZOOM) {
    statusCb({ state: 'zoom' });
    return;
  }
  const b = map.getBounds();
  const x0 = Math.floor(b.getWest() / CELL), x1 = Math.floor(b.getEast() / CELL);
  const y0 = Math.floor(b.getSouth() / CELL), y1 = Math.floor(b.getNorth() / CELL);
  const missing = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const k = `${x}:${y}`;
    if (!loadedCells.has(k)) missing.push([x, y, k]);
  }
  if (!missing.length) { statusCb({ state: 'idle', count: relations.size }); return; }
  if (missing.length > 16) { statusCb({ state: 'zoom' }); return; }

  const xs = missing.map((m) => m[0]), ys = missing.map((m) => m[1]);
  const s = Math.min(...ys) * CELL, n = (Math.max(...ys) + 1) * CELL;
  const w = Math.min(...xs) * CELL, e = (Math.max(...xs) + 1) * CELL;
  const bb = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
  const q = `[out:json][timeout:30];relation["type"="route"]["route"~"^(bicycle|mtb)$"](${bb});out body geom(${bb});`;

  loading = true;
  statusCb({ state: 'loading' });
  try {
    const data = await overpass(q);
    ingestTrails(data);
    missing.forEach((m) => loadedCells.add(m[2]));
    statusCb({ state: 'idle', count: relations.size });
  } catch (e) {
    console.warn('Trails konnten nicht geladen werden', e);
    statusCb({ state: 'error' });
  } finally {
    loading = false;
  }
}

export const refreshTrails = debounce(loadVisible, 900);

export function initTrails() {
  onStyleReady(addLayers);
  map.on('moveend', refreshTrails);
  map.on('load', refreshTrails);
}
