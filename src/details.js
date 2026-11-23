// RideBike – Kartendetails & Animationen
// Höhenlinien, Gipfel, Rad-POIs, 3D-Wald, Belag-Hinweise,
// Tageslicht nach Sonnenstand, wachsendes Gelände, Panorama-Drift, fließende Trails.
// © 2026 Florian Enders

import maplibregl from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { DEMO } from './demo.js';
import { WORKERS_OK } from './workers.js';
import { DEM } from './config.js';
import { settings } from './settings.js';
import { effExaggeration, map, onStyleReady, labelAnchor, isDarkStyle, registerDaylight, currentStyleDef, activeStyleId, switchStyle } from './mapcore.js';
import { quality, animationsActive, touchActivity } from './graphics.js';
import { mapNetAllowed } from './offline.js';

// ---------------------------------------------------------------------
// Höhenlinien (on-the-fly aus dem Höhenmodell, im Web-Worker berechnet)
// ---------------------------------------------------------------------
const demSource = new mlcontour.DemSource({
  url: DEM.tiles[0],
  encoding: 'terrarium',
  maxzoom: 13,
  worker: !DEMO && WORKERS_OK,   // Demo: im Hauptthread laden, damit die eingebetteten Daten greifen
  cacheSize: 120,
  timeoutMs: 12000
});
demSource.setupMaplibre(maplibregl);

const CONTOUR_URL = demSource.contourProtocolUrl({
  thresholds: { 10: [200, 1000], 11: [100, 500], 12: [100, 500], 13: [50, 250], 14: [20, 100], 15: [10, 50] },
  contourLayer: 'contours',
  elevationKey: 'ele',
  levelKey: 'level',
  extent: 4096,
  buffer: 1
});

// ---------------------------------------------------------------------
// Icons für Rad-POIs (zur Laufzeit gezeichnet, keine Sprites nötig)
// ---------------------------------------------------------------------
const POI = {
  bicycle:          { color: '#2563eb', path: 'M5.5 17.5a3 3 0 1 0 0-.01M18.5 17.5a3 3 0 1 0 0-.01M5.5 17.5 9 10h6l3.5 7.5M9 10l3 7.5M15 10l-1.5-3H11', label: 'Fahrradladen' },
  bicycle_rental:   { color: '#0891b2', path: 'M5.5 17.5a3 3 0 1 0 0-.01M18.5 17.5a3 3 0 1 0 0-.01M5.5 17.5 9 10h6l3.5 7.5M12 4v4M10 6h4', label: 'Radverleih' },
  bicycle_parking:  { color: '#475569', path: 'M8 20V4h5a4 4 0 0 1 0 8H8', label: 'Radparkplatz' },
  charging_station: { color: '#16a34a', path: 'M13 3 5 14h6l-1 7 8-11h-6Z', label: 'Ladestation' },
  drinking_water:   { color: '#0284c7', path: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z', label: 'Trinkwasser' },
  shelter:          { color: '#92400e', path: 'M3 12 12 4l9 8M6 10v9M18 10v9', label: 'Unterstand' },
  toilets:          { color: '#6b7280', path: 'M7 4a1.5 1.5 0 1 0 0 .01M17 4a1.5 1.5 0 1 0 0 .01M5 9h4l-1 11M19 9h-4l1 5h-2l1 6', label: 'WC' },
  cafe:             { color: '#b45309', path: 'M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5ZM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3', label: 'Café' },
  biergarten:       { color: '#ca8a04', path: 'M6 8h10v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2ZM16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 8a3 3 0 0 1 5-2 3 3 0 0 1 5 2', label: 'Biergarten' },
  viewpoint:        { color: '#7c3aed', path: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', label: 'Aussicht' },
  camp_site:        { color: '#15803d', path: 'M3 20 12 5l9 15ZM12 5v15M9 20l3-5 3 5', label: 'Camping' },
  alpine_hut:       { color: '#9a3412', path: 'M3 12 12 4l9 8v8H3ZM10 20v-5h4v5', label: 'Hütte' }
};
export const POI_CLASSES = Object.keys(POI);

function drawBadge(color, path, size = 64, ring = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = size * 0.08;
  g.shadowOffsetY = size * 0.03;
  g.beginPath(); g.arc(r, r, r * 0.82, 0, Math.PI * 2); g.fillStyle = ring; g.fill();
  g.shadowColor = 'transparent';
  g.beginPath(); g.arc(r, r, r * 0.7, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  g.save();
  const s = (size * 0.78) / 24 * 0.62;
  g.translate(r - 12 * s, r - 12 * s);
  g.scale(s, s);
  g.strokeStyle = '#fff'; g.lineWidth = 2.3; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(new Path2D(path));
  g.restore();
  return g.getImageData(0, 0, size, size);
}

function drawPeak(dark) {
  const size = 48;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.beginPath(); g.moveTo(size / 2, 8); g.lineTo(size - 8, size - 10); g.lineTo(8, size - 10); g.closePath();
  g.fillStyle = dark ? '#e5e7eb' : '#5b4636'; g.fill();
  g.lineWidth = 3; g.strokeStyle = dark ? '#111827' : '#ffffff'; g.stroke();
  g.beginPath(); g.moveTo(size / 2, 8); g.lineTo(size / 2 + 6, 18); g.lineTo(size / 2 - 6, 18); g.closePath();
  g.fillStyle = '#ffffff'; g.fill();
  return g.getImageData(0, 0, size, size);
}

function drawTreePattern(dark) {
  // Feine, dichte Baumkronen-Struktur (nahtlos) – wirkt auch in Schrägansicht wie Wald statt Punktmuster
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  let sd = 5;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const crown = (x, y, r, a) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fillStyle = dark ? `rgba(70,130,95,${0.32 * a})` : `rgba(38,92,44,${0.2 * a})`; g.fill();
      g.beginPath(); g.arc(x + dx - r * 0.35, y + dy - r * 0.35, r * 0.5, 0, Math.PI * 2);
      g.fillStyle = dark ? `rgba(150,210,170,${0.14 * a})` : `rgba(255,255,235,${0.16 * a})`; g.fill();
    }
  };
  for (let i = 0; i < 260; i++) crown(rnd() * size, rnd() * size, 2 + rnd() * 3.2, 0.6 + rnd() * 0.6);
  return g.getImageData(0, 0, size, size);
}

function drawRipple(dark) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  g.strokeStyle = dark ? 'rgba(150,200,255,.38)' : 'rgba(255,255,255,.85)';
  g.lineWidth = 2.6;
  const wave = (x, y, w) => { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 4, y - 3, x + w / 2, y); g.quadraticCurveTo(x + (3 * w) / 4, y + 3, x + w, y); g.stroke(); };
  wave(4, 12, 18); wave(36, 26, 14); wave(14, 44, 20); wave(44, 56, 12); wave(26, 6, 10);
  return g.getImageData(0, 0, size, size);
}

function addImages(m) {
  const pr = 2;
  for (const [k, v] of Object.entries(POI)) {
    const id = `rb-poi-${k}`;
    if (m.hasImage(id)) m.removeImage(id);
    m.addImage(id, drawBadge(v.color, v.path), { pixelRatio: pr });
  }
  if (m.hasImage('rb-ripple')) m.removeImage('rb-ripple');
  m.addImage('rb-ripple', drawRipple(isDarkStyle()), { pixelRatio: pr });
  if (m.hasImage('rb-trees')) m.removeImage('rb-trees');
  m.addImage('rb-trees', drawTreePattern(isDarkStyle()), { pixelRatio: pr });
  if (m.hasImage('rb-peak')) m.removeImage('rb-peak');
  m.addImage('rb-peak', drawPeak(isDarkStyle()), { pixelRatio: pr });
}

// ---------------------------------------------------------------------
// Ebenen
// ---------------------------------------------------------------------
const STYLE_POI_LAYERS = [];
const STYLE_PEAK_LAYERS = [];

function addDetailLayers(m) {
  addImages(m);
  const dark = isDarkStyle();
  const raster = !!m.getSource('base');
  const before = labelAnchor(m);
  const D = settings.details;
  const vis = (on) => (on ? 'visible' : 'none');

  // Eigene POI-/Gipfel-Ebenen des Kartenstils merken (werden bei Rad-POIs ausgeblendet)
  STYLE_POI_LAYERS.length = 0;
  STYLE_PEAK_LAYERS.length = 0;
  for (const l of m.getStyle().layers || []) {
    if (l.id.startsWith('rb-')) continue;
    if (l['source-layer'] === 'poi' && l.type === 'symbol') STYLE_POI_LAYERS.push(l.id);
    if (l['source-layer'] === 'mountain_peak') STYLE_PEAK_LAYERS.push(l.id);
  }

  // Wasser-Schimmer (animiert)
  if (!raster) {
    m.addLayer({
      id: 'rb-water-shimmer', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', minzoom: 10,
      layout: { visibility: vis(D.water && quality().water) },
      paint: { 'fill-pattern': 'rb-ripple', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, dark ? 0.7 : 0.8], 'fill-translate': [0, 0] }
    }, before);
  }

  // Waldtextur (feine Baumkronen) – nicht über echtem Luftbild, dort sind die Bäume schon fotografiert
  if (!raster) m.addLayer({
    id: 'rb-forest-texture', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', minzoom: 11,
    filter: ['==', ['get', 'class'], 'wood'],
    layout: { visibility: vis(D.forest) },
    paint: { 'fill-pattern': 'rb-trees', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12.5, 0.9, 15.5, 0.7, 17, 0.35] }
  }, before);

  // 3D-Wald (optional)
  m.addLayer({
    id: 'rb-forest-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'landcover', minzoom: 13,
    filter: ['==', ['get', 'class'], 'wood'],
    layout: { visibility: vis(D.forest3d) },
    paint: {
      'fill-extrusion-color': dark ? '#16352a' : raster ? '#2f5a33' : '#7fb77e',
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 9],
      'fill-extrusion-opacity': raster ? 0.35 : dark ? 0.55 : 0.5,
      'fill-extrusion-vertical-gradient': true
    }
  }, before);

  // Belag-Hinweis: unbefestigte Straßen & Wege
  m.addLayer({
    id: 'rb-unpaved', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 13,
    filter: ['all', ['==', ['get', 'surface'], 'unpaved'], ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary', 'secondary']]]],
    layout: { visibility: vis(D.unpaved), 'line-cap': 'round' },
    paint: { 'line-color': dark ? '#d6b98c' : '#a16207', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 3], 'line-dasharray': [0.2, 2], 'line-opacity': 0.9 }
  }, before);

  // Höhenlinien
  if (!m.getSource('rb-contours')) m.addSource('rb-contours', { type: 'vector', tiles: [CONTOUR_URL], maxzoom: 15 });
  const cColor = dark ? 'rgba(180,200,220,0.35)' : raster ? 'rgba(255,255,255,0.45)' : 'rgba(120,85,50,0.42)';
  m.addLayer({
    id: 'rb-contour-lines', type: 'line', source: 'rb-contours', 'source-layer': 'contours', minzoom: 10,
    layout: { visibility: vis(D.contours), 'line-join': 'round' },
    paint: {
      'line-color': cColor,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'level'], 1, 0.6, 0.2], 16, ['match', ['get', 'level'], 1, 1.5, 0.6]],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 13, 0.65, 15, 0.9]
    }
  }, before);
  m.addLayer({
    id: 'rb-contour-labels', type: 'symbol', source: 'rb-contours', 'source-layer': 'contours', minzoom: 12,
    filter: ['>', ['get', 'level'], 0],
    layout: {
      visibility: vis(D.contours),
      'symbol-placement': 'line',
      'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'symbol-spacing': 320,
      'text-max-angle': 25
    },
    paint: { 'text-color': dark ? '#a9bccf' : raster ? '#ffffff' : '#7a5a3a', 'text-halo-color': dark ? '#0b1220' : raster ? 'rgba(0,0,0,.6)' : '#f4f1ea', 'text-halo-width': 1.4 }
  });

  // Gipfel mit Höhe
  m.addLayer({
    id: 'rb-peaks', type: 'symbol', source: 'openmaptiles', 'source-layer': 'mountain_peak', minzoom: 9,
    filter: ['in', ['get', 'class'], ['literal', ['peak', 'volcano']]],
    layout: {
      visibility: vis(D.peaks),
      'icon-image': 'rb-peak',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.55, 15, 0.9],
      'text-field': ['format',
        ['coalesce', ['get', 'name:de'], ['get', 'name'], ''], { 'font-scale': 1 },
        '\n', {},
        ['case', ['has', 'ele'], ['concat', ['to-string', ['get', 'ele']], ' m'], ''], { 'font-scale': 0.85 }],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 13],
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      'text-optional': true
    },
    paint: {
      'text-color': dark ? '#e5e7eb' : raster ? '#ffffff' : '#4a3426',
      'text-halo-color': dark ? '#0b1220' : raster ? 'rgba(0,0,0,.7)' : '#ffffff',
      'text-halo-width': 1.6,
      'icon-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 9.6, 1],
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 9.6, 1]
    }
  });

  // Rad-POIs
  m.addLayer({
    id: 'rb-pois', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 13,
    filter: ['in', ['get', 'subclass'], ['literal', POI_CLASSES]],
    layout: {
      visibility: vis(D.pois),
      'icon-image': ['concat', 'rb-poi-', ['get', 'subclass']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 16, 0.85, 18, 1],
      'icon-allow-overlap': false,
      'icon-padding': 3,
      'text-field': ['step', ['zoom'], '', 16, ['coalesce', ['get', 'name:de'], ['get', 'name'], '']],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1.2],
      'text-optional': true,
      'symbol-sort-key': ['match', ['get', 'subclass'], ['bicycle', 'drinking_water', 'bicycle_repair_station'], 0, ['shelter', 'viewpoint'], 1, 2]
    },
    paint: {
      'text-color': dark ? '#e5e7eb' : '#1f2937',
      'text-halo-color': dark ? '#0b1220' : '#ffffff',
      'text-halo-width': 1.4,
      'icon-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.5, 1]
    }
  });

  applyDetailVisibility();
}

export function applyDetailVisibility() {
  if (!map) return;
  const D = settings.details;
  const set = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  set('rb-forest-3d', D.forest3d);
  set('rb-forest-texture', D.forest);
  set('rb-water-shimmer', D.water && quality().water);
  set('rb-unpaved', D.unpaved);
  // Höhenlinien brauchen Internet (werden live aus dem Höhenmodell berechnet)
  set('rb-contour-lines', D.contours && mapNetAllowed());
  set('rb-contour-labels', D.contours && mapNetAllowed());
  set('rb-peaks', D.peaks);
  set('rb-pois', D.pois);
  // Standard-POIs/Gipfel des Stils ausblenden, wenn die eigenen aktiv sind
  STYLE_POI_LAYERS.forEach((id) => set(id, !D.pois));
  STYLE_PEAK_LAYERS.forEach((id) => set(id, !D.peaks));
}

export function poiLabel(subclass) {
  return POI[subclass]?.label || subclass;
}

// ---------------------------------------------------------------------
// Sonnenstand & Tageslicht
// ---------------------------------------------------------------------
const RAD = Math.PI / 180;
export function sunPosition(date, lat, lng) {
  const d = date.valueOf() / 864e5 - 0.5 + 2440588 - 2451545;
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const e = RAD * 23.4397;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const th = RAD * (280.16 + 360.9856235 * d) - RAD * -lng;
  const H = th - ra;
  const phi = RAD * lat;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { altitude: alt / RAD, azimuth: (az / RAD + 180 + 360) % 360 };
}

export const DAYLIGHT_MODES = {
  live: null,
  morning: { altitude: 7, azimuth: 105 },
  noon: { altitude: 48, azimuth: 180 },
  evening: { altitude: 2, azimuth: 255 },
  night: { altitude: -18, azimuth: 0 }
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

// Farbstufen nach Sonnenhöhe
const BANDS = [
  { alt: -12, sky: '#040914', horizon: '#0f1d33', fog: '#0a1220', light: '#7f95c8', li: 0.18 },
  { alt: -4,  sky: '#16224a', horizon: '#6b4a7a', fog: '#3a3350', light: '#a99ad8', li: 0.25 },
  { alt: 1,   sky: '#2d4f8f', horizon: '#ff8a4c', fog: '#f2a77a', light: '#ffb070', li: 0.35 },
  { alt: 8,   sky: '#4b8fe0', horizon: '#ffd4a0', fog: '#fbe3c8', light: '#ffe0b8', li: 0.42 },
  { alt: 20,  sky: '#5fb3ff', horizon: '#e6f4ff', fog: '#f4f8fb', light: '#ffffff', li: 0.48 }
];

function palette(alt) {
  if (alt <= BANDS[0].alt) return BANDS[0];
  for (let i = 1; i < BANDS.length; i++) {
    if (alt <= BANDS[i].alt) {
      const a = BANDS[i - 1], b = BANDS[i];
      const t = (alt - a.alt) / (b.alt - a.alt);
      return { sky: mix(a.sky, b.sky, t), horizon: mix(a.horizon, b.horizon, t), fog: mix(a.fog, b.fog, t), light: mix(a.light, b.light, t), li: a.li + (b.li - a.li) * t };
    }
  }
  return BANDS[BANDS.length - 1];
}

let currentSun = null;
export function getSun() { return currentSun; }

let nightCb = null;
/** main.js registriert hier die Überblendung für den automatischen Stilwechsel */
export function onAutoNight(fn) { nightCb = fn; }
let switching = false;
function autoNightSwitch(id) {
  if (switching) return;
  switching = true;
  (nightCb || ((x, done) => { switchStyle(x); done(); }))(id, () => { switching = false; });
}

export function applyDaylight() {
  if (!map) return false;
  const c = map.getCenter();
  const fixed = window.__rbSun || DAYLIGHT_MODES[settings.daylightMode];
  const sun = fixed || sunPosition(new Date(), c.lat, c.lng);
  currentSun = sun;
  // Automatische Nachtkarte: helle Stile nachts gegen "Night" tauschen
  if (settings.autoNight) {
    const userDef = settings.style;
    const userIsLight = !['dark', 'fiord', 'satellite'].includes(userDef);
    const wantNight = userIsLight && sun.altitude < -5;
    if (wantNight && activeStyleId !== 'dark') { autoNightSwitch('dark'); return true; }
    if (!wantNight && activeStyleId !== userDef) { autoNightSwitch(userDef); return true; }
  } else if (activeStyleId !== settings.style) {
    autoNightSwitch(settings.style); return true;
  }
  let p = palette(sun.altitude);
  if (isDarkStyle() && !currentStyleDef().photo) {
    // Dunkle Kartenstile: Dunst abdunkeln, damit die Karte lesbar bleibt
    p = { ...p, fog: mix(p.fog, '#0b1220', 0.7), horizon: mix(p.horizon, '#0b1220', 0.35) };
  }
  const photo = !!currentStyleDef().photo;
  if (settings.sky) {
    // Luftbild: kräftigere Luftperspektive – ferne Grate verblauen im Dunst wie im Hochgebirge
    map.setSky(photo ? {
      'sky-color': p.sky,
      'horizon-color': mix(p.horizon, '#c4d8ec', 0.4),
      'fog-color': mix(p.fog, '#93afcc', 0.6),
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.12,
      'fog-ground-blend': 0.78,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.9, 14, 0.35]
    } : isDarkStyle() ? {
      'sky-color': p.sky,
      'horizon-color': p.horizon,
      'fog-color': p.fog,
      'sky-horizon-blend': 0.55,
      'horizon-fog-blend': 0.2,
      'fog-ground-blend': 0.72,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.8, 14, 0.25]
    } : {
      // Kartenstile: gleiche Luftperspektive wie beim Luftbild, nur heller
      'sky-color': p.sky,
      'horizon-color': mix(p.horizon, '#d6e4f1', 0.4),
      'fog-color': mix(p.fog, '#b9cde0', 0.5),
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.15,
      'fog-ground-blend': 0.76,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.85, 14, 0.3]
    });
  }
  map.setLight({
    anchor: 'map',
    position: [1.3, sun.azimuth, Math.max(15, Math.min(80, 90 - Math.max(sun.altitude, 5)))],
    color: p.light,
    intensity: p.li
  });
  if (map.getLayer('rb-hillshade')) {
    map.setPaintProperty('rb-hillshade', 'hillshade-illumination-direction', sun.altitude > -2 ? sun.azimuth : 315);
    // tief stehende Sonne → lange, weiche Schatten; mittags kürzer
    map.setPaintProperty('rb-hillshade', 'hillshade-illumination-altitude', Math.max(12, Math.min(55, sun.altitude > 0 ? sun.altitude : 30)));
  }
  document.documentElement.style.setProperty('--sun-glow', sun.altitude > -4 && sun.altitude < 10 ? '1' : '0');
  // Nachtabdunklung für helle Kartenstile (Dämmerung → Nacht)
  const night = isDarkStyle() && !currentStyleDef().photo ? 0 : Math.max(0, Math.min(1, (2 - sun.altitude) / 12));
  document.documentElement.style.setProperty('--night', night.toFixed(2));
  document.body.classList.toggle('photo-style', !!photo);
  // Luftbild nachts/in der Dämmerung abdunkeln und kühler färben
  if (photo && map.getLayer('base')) {
    // Mondlicht: Gelände bleibt nachts erkennbar, nur kühler und gedämpft
    map.setPaintProperty('base', 'raster-brightness-max', +(0.97 - night * 0.45).toFixed(2));
    map.setPaintProperty('base', 'raster-brightness-min', +(0.02 + night * 0.03).toFixed(3));
    map.setPaintProperty('base', 'raster-saturation', +(0.26 - night * 0.55).toFixed(2));
    map.setPaintProperty('base', 'raster-contrast', +(0.2 + night * 0.1).toFixed(2));
  }
  return true;
}

// ---------------------------------------------------------------------
// Gelände "wachsen" lassen
// ---------------------------------------------------------------------
let growRaf = null;
export function growTerrain(duration = 1600) {
  if (!map || !settings.terrain || !map.getSource('rb-dem')) return;
  cancelAnimationFrame(growRaf);
  const target = effExaggeration();
  if (!settings.animations) { map.setTerrain({ source: 'rb-dem', exaggeration: target }); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    map.setTerrain({ source: 'rb-dem', exaggeration: Math.max(0.01, target * e) });
    if (k < 1) growRaf = requestAnimationFrame(step);
  };
  growRaf = requestAnimationFrame(step);
}

// ---------------------------------------------------------------------
// Animationsschleife: fließende Trails + Panorama-Drift
// ---------------------------------------------------------------------
const DASH = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]
];
let lastInteraction = performance.now();
let drifting = false;
let blockDrift = () => false;
export function setDriftBlocker(fn) { blockDrift = fn; }

function noteInteraction() {
  lastInteraction = performance.now();
  touchActivity();
  if (drifting) { drifting = false; document.body.classList.remove('drifting'); }
}

function loop() {
  let step = 0, lastDash = 0, lastWater = 0, lastFrame = performance.now();
  const tick = (t) => {
    requestAnimationFrame(tick);
    const dt = Math.min(100, t - lastFrame);
    lastFrame = t;
    if (!map || !settings.animations) return;
    const active = animationsActive();

    // Trails fließen lassen
    const q = quality();
    if (active && q.water && settings.details.water && map.getLayer('rb-water-shimmer') && t - lastWater > 60 * q.interval) {
      lastWater = t;
      const o = (t * 0.006) % 64;
      map.setPaintProperty('rb-water-shimmer', 'fill-translate', [o, Math.sin(t / 1400) * 3]);
    }
    if (active && t - lastDash > 70 * q.interval && map.getLayer('rb-trails-flow') && settings.layers.trails) {
      lastDash = t;
      step = (step + 1) % DASH.length;
      map.setPaintProperty('rb-trails-flow', 'line-dasharray', DASH[step]);
    }

    // Panorama-Drift im Leerlauf
    if (settings.drift && !blockDrift() && map.getPitch() > 25 && t - lastInteraction > 15000) {
      if (!drifting) { drifting = true; document.body.classList.add('drifting'); }
      map.setBearing(map.getBearing() + dt * 0.0035);
    }
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------
export function initDetails() {
  onStyleReady(addDetailLayers);
  registerDaylight(() => (settings.daylight ? applyDaylight() : false));
  const canvas = map.getCanvasContainer();
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) => canvas.addEventListener(ev, noteInteraction, { passive: true }));
  map.on('moveend', () => { if (settings.daylight && settings.daylightMode === 'live') applyDaylight(); });
  setInterval(() => { if (settings.daylight && settings.daylightMode === 'live') applyDaylight(); }, 60000);
  loop();
}

export { noteInteraction };
