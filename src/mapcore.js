// RideBike – Kartenkern: Stile, 3D-Gelände, Himmel, Gebäude, Radwege
// © 2026 Florian Enders

import maplibregl from 'maplibre-gl';
import { MAP_STYLES, OFM_GLYPHS, OFM_VECTOR, DEM, DEM_HD, WAYMARKED, C } from './config.js';
import { settings } from './settings.js';
import { quality, qualityId, pixelRatio, animationsActive, applyLod } from './graphics.js';
import { setupProtocol, prepareStyle, viaCache, mapNetAllowed } from './offline.js';

export let map = null;
const styleHooks = [];
let daylightFn = null;

/** Tageslicht-Modul meldet sich hier an (übernimmt Himmel & Licht) */
export function registerDaylight(fn) { daylightFn = fn; }

/** Module registrieren hier, was nach jedem Stilwechsel neu hinzugefügt werden muss. */
export function onStyleReady(fn) {
  styleHooks.push(fn);
  if (map && map.isStyleLoaded()) fn(map);
}

/** Aktuell angezeigter Stil (kann nachts automatisch vom gewählten abweichen) */
export let activeStyleId = null;

export function currentStyleDef() {
  const id = activeStyleId || settings.style;
  return MAP_STYLES.find((s) => s.id === id) || MAP_STYLES[0];
}

export function isDarkStyle() {
  return !!currentStyleDef().dark;
}

function rasterStyle(def) {
  const style = {
    version: 8,
    glyphs: OFM_GLYPHS,
    sources: {
      base: { type: 'raster', tiles: def.raster, tileSize: 256, maxzoom: def.maxzoom || 19, attribution: def.attribution },
      openmaptiles: { type: 'vector', url: OFM_VECTOR }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': def.dark ? '#0b1210' : '#f2efe9' } },
      { id: 'base', type: 'raster', source: 'base', paint: def.photo
        ? { 'raster-fade-duration': 200, 'raster-saturation': 0.24, 'raster-contrast': 0.2, 'raster-brightness-min': 0.02, 'raster-brightness-max': 0.98, 'raster-resampling': 'linear' }
        : { 'raster-fade-duration': 200 } }
    ]
  };
  if (def.id === 'satellite') {
    style.layers.push(
      {
        id: 'rb-sat-roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]],
        paint: { 'line-color': 'rgba(255,255,255,0.35)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 4] }
      },
      {
        id: 'rb-sat-roadnames', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 13,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 14],
          'text-max-angle': 30
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 }
      },
      {
        id: 'rb-sat-places', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        layout: {
          'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 14, 16]
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.6 }
      }
    );
  }
  return style;
}

/** Luftbilder gibt es nur online – offline auf die gespeicherte Vektorkarte ausweichen */
export function effectiveStyleId(id) {
  const def = MAP_STYLES.find((s) => s.id === id);
  return def?.raster && !mapNetAllowed() ? 'liberty' : id;
}

export function styleFor(id) {
  const def = MAP_STYLES.find((s) => s.id === id) || MAP_STYLES[0];
  return def.raster ? rasterStyle(def) : def.url;
}

export async function createMap(container, view) {
  activeStyleId = effectiveStyleId(settings.style);
  setupProtocol();
  let style;
  try { style = await prepareStyle(styleFor(activeStyleId)); }
  catch { style = await prepareStyle(styleFor('liberty')).catch(() => ({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe6df' } }] })); }
  map = new maplibregl.Map({
    container,
    style,
    pixelRatio: pixelRatio(),
    maxTileCacheZoomLevels: quality().cacheZoomLevels,
    center: view?.center || [10.45, 51.16],
    zoom: view?.zoom ?? 5.2,
    pitch: view?.pitch ?? 0,
    bearing: view?.bearing ?? 0,
    maxPitch: quality().maxPitch,
    anisotropicFilterPitch: 8,   // Luftbild schon bei leichter Neigung scharf filtern
    attributionControl: { compact: true },
    fadeDuration: quality().fade,
    canvasContextAttributes: { antialias: true },
    dragRotate: true,
    pitchWithRotate: true,
    touchPitch: true
  });
  map.touchZoomRotate.enableRotation();
  watchZoomExaggeration(map);
  applyFov(map);
  map.on('resize', () => applyFov(map));
  guardTerrainCollision(map);

  map.on('style.load', () => {
    try {
      addBaseExtras(map);
    } catch (e) {
      console.error(e);
    }
    styleHooks.forEach((fn) => {
      try { fn(map); } catch (e) { console.error(e); }
    });
    applyLod(map);
  });

  // Fehlende Sprites/Icons still behandeln
  map.on('styleimagemissing', (e) => {
    if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  return map;
}

export async function switchStyle(id) {
  id = effectiveStyleId(id);
  activeStyleId = id;
  try {
    map.setStyle(await prepareStyle(styleFor(id)), { diff: false });
  } catch (e) {
    console.warn('Stil nicht verfügbar', e);
  }
}

/** Erste Layer-ID eines Typs (für Einfügepositionen) */
function firstLayerId(m, test) {
  const layers = m.getStyle().layers || [];
  const l = layers.find(test);
  return l ? l.id : undefined;
}

export function labelAnchor(m = map) {
  return firstLayerId(m, (l) => l.type === 'symbol' && !l.id.startsWith('rb-'));
}

let demHd = false;
export const isHdTerrain = () => demHd;

function useHdTerrain() {
  return settings.hdTerrain !== false && mapNetAllowed() && qualityId() !== 'saver';
}

/** Fällt das HD-Modell aus (Netz weg, Server nicht erreichbar), still auf das Standardmodell wechseln */
function watchHdTerrain(m) {
  let errors = 0;
  const onErr = (e) => {
    if (!demHd || !e.sourceId?.startsWith('rb-dem')) return;
    if (++errors < 4) return;
    m.off('error', onErr);
    swapDem(m, false);
  };
  m.on('error', onErr);
}

/** Höhenquellen zur Laufzeit tauschen (HD ↔ Standard), Ebenen bleiben erhalten */
export function swapDem(m = map, hd = useHdTerrain()) {
  if (!m || !m.getSource('rb-dem') || hd === demHd) return;
  demHd = hd;
  const dem = hd
    ? { type: 'raster-dem', url: DEM_HD.url, encoding: 'terrarium', tileSize: 512, attribution: DEM_HD.attribution }
    : { type: 'raster-dem', ...DEM, tiles: DEM.tiles.map(viaCache) };
  m.setTerrain(null);
  const hsLayer = m.getStyle().layers.find((l) => l.id === 'rb-hillshade');
  const before = hsLayer ? m.getStyle().layers[m.getStyle().layers.indexOf(hsLayer) + 1]?.id : undefined;
  if (hsLayer) m.removeLayer('rb-hillshade');
  m.removeSource('rb-dem');
  m.removeSource('rb-dem-hs');
  m.addSource('rb-dem', dem);
  m.addSource('rb-dem-hs', { ...dem });
  if (hsLayer) m.addLayer({ ...hsLayer, source: 'rb-dem-hs' }, before);
  applyTerrain();
}

function addBaseExtras(m) {
  const def = currentStyleDef();

  // Höhenmodell (getrennte Quellen für Gelände & Schummerung).
  // Online: hochaufgelöstes Mapterhorn-Modell (512er-Kacheln, scharfe Grate & Täler),
  // offline bzw. Sparmodus: gespeichertes Standardmodell.
  const hd = useHdTerrain();
  demHd = hd;
  const dem = hd
    ? { type: 'raster-dem', url: DEM_HD.url, encoding: 'terrarium', tileSize: 512, attribution: DEM_HD.attribution }
    : { type: 'raster-dem', ...DEM, tiles: DEM.tiles.map(viaCache) };
  if (!m.getSource('rb-dem')) m.addSource('rb-dem', dem);
  if (!m.getSource('rb-dem-hs')) m.addSource('rb-dem-hs', { ...dem });
  if (hd) watchHdTerrain(m);

  const beforeLines = firstLayerId(m, (l) => (l['source-layer'] === 'transportation' || l['source-layer'] === 'building') && !l.id.startsWith('rb-')) || labelAnchor(m);
  m.addLayer({
    id: 'rb-hillshade', type: 'hillshade', source: 'rb-dem-hs',
    layout: { visibility: settings.hillshade ? 'visible' : 'none' },
    paint: def.photo ? {
      // Luftbild: Licht & Schatten nach Sonnenstand über das Foto legen → Grate und Täler treten plastisch hervor
      'hillshade-method': 'combined',
      'hillshade-exaggeration': hd ? 0.62 : 0.5,
      'hillshade-shadow-color': 'rgba(6, 16, 34, 0.52)',
      'hillshade-highlight-color': 'rgba(255, 242, 214, 0.28)',
      'hillshade-accent-color': 'rgba(0, 8, 20, 0.25)',
      'hillshade-illumination-altitude': 35,
      'hillshade-illumination-anchor': 'map'
    } : {
      // Alle Kartenstile: Relief mit Sonnenlicht (Licht- & Schattenseiten), damit die Karte räumlich wirkt
      'hillshade-method': 'combined',
      'hillshade-exaggeration': def.dark ? 0.55 : def.raster ? 0.45 : 0.6,
      'hillshade-shadow-color': def.dark ? 'rgba(0, 0, 0, 0.62)' : 'rgba(34, 46, 66, 0.5)',
      'hillshade-highlight-color': def.dark ? 'rgba(130, 160, 200, 0.2)' : 'rgba(255, 250, 232, 0.55)',
      'hillshade-accent-color': def.dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(50, 64, 52, 0.28)',
      'hillshade-illumination-altitude': 35,
      'hillshade-illumination-anchor': 'map'
    }
  }, beforeLines);

  // 3D-Gebäude ergänzen, falls der Stil keine hat
  const hasExtrusion = (m.getStyle().layers || []).some((l) => l.type === 'fill-extrusion');
  if (!hasExtrusion) {
    m.addLayer({
      id: 'rb-buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': def.dark ? '#273142' : def.id === 'satellite' ? '#d9d4c7' : '#e6e1d8',
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, ['coalesce', ['get', 'render_height'], 6]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': def.id === 'satellite' ? 0.7 : 0.85
      }
    }, labelAnchor(m));
  }

  // Waymarked-Trails-Overlays (Radrouten- und MTB-Netz)
  m.addSource('rb-wmt-cycling', { type: 'raster', tiles: [WAYMARKED.cycling], tileSize: 256, maxzoom: 17, attribution: WAYMARKED.attribution });
  m.addSource('rb-wmt-mtb', { type: 'raster', tiles: [WAYMARKED.mtb], tileSize: 256, maxzoom: 17, attribution: WAYMARKED.attribution });
  m.addLayer({ id: 'rb-wmt-cycling', type: 'raster', source: 'rb-wmt-cycling', layout: { visibility: settings.layers.wmtCycling ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.85 } }, labelAnchor(m));
  m.addLayer({ id: 'rb-wmt-mtb', type: 'raster', source: 'rb-wmt-mtb', layout: { visibility: settings.layers.wmtMtb ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.85 } }, labelAnchor(m));

  addBikeLayers(m);
  applyTerrain();
  applySky();
  applyBuildings();
}

// ---------- Radwege aus OpenMapTiles-Transportation ----------
const sub = ['coalesce', ['get', 'subclass'], ''];
const cls = ['coalesce', ['get', 'class'], ''];
const bic = ['coalesce', ['get', 'bicycle'], ''];
const lit = (a) => ['literal', a];

const F_CYCLEWAY = ['any',
  ['==', sub, 'cycleway'],
  ['all', ['in', cls, lit(['path', 'track', 'minor', 'service'])], ['==', bic, 'designated']]
];
const F_MTB = ['all', ['has', 'mtb_scale'], ['!=', bic, 'no'], ['!', F_CYCLEWAY]];
const F_TRACK = ['all', ['==', cls, 'track'], ['!', F_CYCLEWAY], ['!', ['has', 'mtb_scale']], ['!', ['in', bic, lit(['no', 'dismount'])]]];
const F_PATH = ['all',
  ['==', cls, 'path'],
  ['!', F_CYCLEWAY],
  ['!', ['has', 'mtb_scale']],
  ['!', ['in', bic, lit(['no', 'dismount'])]],
  ['any', ['in', sub, lit(['path', 'bridleway'])], ['==', bic, 'yes']]
];

const mtbColor = ['match', ['slice', ['to-string', ['get', 'mtb_scale']], 0, 1],
  '0', C.mtb[0], '1', C.mtb[1], '2', C.mtb[2], '3', C.mtb[3], '4', C.mtb[4], '5', C.mtb[5], '6', C.mtb[6], C.mtb[2]];

export const BIKE_LAYER_IDS = ['rb-cycleway', 'rb-mtb', 'rb-track', 'rb-path'];

function addBikeLayers(m) {
  const before = labelAnchor(m);
  const src = { source: 'openmaptiles', 'source-layer': 'transportation' };
  const dark = isDarkStyle();
  const vis = (on) => (on ? 'visible' : 'none');
  const L = settings.layers;
  // Fotomodus: Wegenetz auf dem Luftbild dezenter, damit das Foto wirkt
  const soft = !!currentStyleDef().photo && settings.subtleNetwork !== false;

  m.addLayer({
    id: 'rb-cycleway-glow', type: 'line', ...src, minzoom: 11, filter: F_CYCLEWAY,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis(L.cycleways) },
    paint: {
      'line-color': C.cycleway,
      'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 3, 14, 8, 18, 22],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 11, 2, 18, 10],
      'line-opacity': soft ? 0.16 : dark ? 0.45 : 0.3
    }
  }, before);

  m.addLayer({
    id: 'rb-path', type: 'line', ...src, minzoom: 13, filter: F_PATH,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis(L.paths) },
    paint: {
      'line-color': C.path,
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 18, 3],
      'line-dasharray': [0.6, 1.6],
      'line-opacity': soft ? ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.55] : 0.9
    }
  }, before);

  m.addLayer({
    id: 'rb-track', type: 'line', ...src, minzoom: 12, filter: F_TRACK,
    layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: vis(L.tracks) },
    paint: {
      'line-color': C.track,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 2.4, 19, 5],
      'line-dasharray': [2.2, 1.2],
      'line-opacity': soft ? ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, 0.6] : 0.95
    }
  }, before);

  m.addLayer({
    id: 'rb-mtb-casing', type: 'line', ...src, minzoom: 12, filter: F_MTB,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis(L.mtb) },
    paint: {
      'line-color': dark ? '#000000' : '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2.4, 16, 5.5, 19, 9],
      'line-opacity': soft ? 0.3 : 0.75
    }
  }, before);
  m.addLayer({
    id: 'rb-mtb', type: 'line', ...src, minzoom: 12, filter: F_MTB,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis(L.mtb) },
    paint: {
      'line-color': mtbColor,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 3, 19, 6],
      'line-dasharray': [3, 1],
      'line-opacity': soft ? 0.8 : 1
    }
  }, before);

  m.addLayer({
    id: 'rb-cycleway-casing', type: 'line', ...src, minzoom: 11, filter: F_CYCLEWAY,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis(L.cycleways) },
    paint: {
      'line-color': dark ? '#04261a' : '#ffffff',
      'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 11, 1.8, 14, 3.6, 18, 10],
      'line-opacity': soft ? 0.35 : 0.9
    }
  }, before);
  m.addLayer({
    id: 'rb-cycleway', type: 'line', ...src, minzoom: 11, filter: F_CYCLEWAY,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis(L.cycleways) },
    paint: {
      'line-color': C.cycleway,
      'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 11, soft ? 0.7 : 1, 14, soft ? 1.6 : 2.2, 18, 6.5],
      'line-opacity': soft ? 0.85 : 1
    }
  }, before);
}

// ---------- Anwenden von Einstellungen ----------
/**
 * Wirksame Überhöhung: in der Übersicht kräftiger (Berge wirken sonst flach),
 * nah am Boden die eingestellte. So bleibt das Relief auf jeder Zoomstufe plastisch.
 */
export function effExaggeration(zoom = map?.getZoom() ?? 12) {
  const boost = zoom <= 10 ? 1.25 : zoom <= 12 ? 1.25 - (zoom - 10) * 0.05 : zoom <= 14 ? 1.15 - (zoom - 12) * 0.05 : zoom <= 16 ? 1.05 - (zoom - 14) * 0.025 : 1;
  return +(settings.exaggeration * boost).toFixed(2);
}
/** Aktuell gezeichnete Überhöhung (für Höhenabfragen am Gelände) */
export function currentExaggeration() {
  return map?.getTerrain?.()?.exaggeration || 1;
}

/**
 * Weitwinkel statt Tele: MapLibre nutzt standardmäßig ~37° vertikal – im Hochformat
 * ergibt das nur ~18° in der Breite, die Landschaft wirkt flach und gestaucht.
 * Mit ~60° wirkt die Szene wie ein echtes 3D-Panorama: Nahes groß, Fernes klein.
 */
export function applyFov(m = map) {
  if (!m?.setVerticalFieldOfView) return;
  const el = m.getContainer();
  const portrait = el.clientHeight > el.clientWidth * 1.15;
  m.setVerticalFieldOfView(portrait ? 60 : 45);
}

/**
 * Kamera nie im Berg: Steht sie in steilem Gelände tiefer als der Hang vor ihr,
 * schneidet die Kamera das Gelände an (schwarze Flächen unten). Dann sanft flacher stellen.
 */
function guardTerrainCollision(m) {
  // Kamera nie in oder direkt an Felswänden: Höhe unter der Kamera und im Blickfeld prüfen,
  // bei Bedarf sanft herauszoomen bzw. flacher neigen (auch nachdem das Gelände nachgeladen hat)
  let tries = 0, busy = false;
  m.on('movestart', (e) => { if (e.originalEvent) tries = 0; });
  const check = () => {
    if (busy || !m.getTerrain?.() || m.getPitch() < 40 || tries > 4 || m.isMoving()) return;
    let cam, alt;
    try { cam = m.transform.getCameraLngLat(); alt = m.transform.getCameraAltitude(); } catch { return; }
    if (!Number.isFinite(alt)) return;
    const { clientWidth: W, clientHeight: H } = m.getContainer();
    let maxE = m.queryTerrainElevation(cam) ?? -Infinity;
    for (const fy of [0.55, 0.7, 0.85, 0.99]) for (const fx of [0.1, 0.5, 0.9]) {
      const e = m.queryTerrainElevation(m.unproject([W * fx, H * fy]));
      if (e != null && e > maxE) maxE = e;
    }
    if (!Number.isFinite(maxE)) return;
    if (alt - maxE < 120) {
      tries++; busy = true;
      m.easeTo({ pitch: Math.max(48, m.getPitch() - 5), zoom: m.getZoom() - 0.35, duration: 500 });
      m.once('moveend', () => { busy = false; setTimeout(check, 60); });
    }
  };
  m.on('moveend', check);
  m.on('idle', check);
}

let exTimer = 0;
function watchZoomExaggeration(m) {
  m.on('zoom', () => {
    if (exTimer) return;
    exTimer = setTimeout(() => {
      exTimer = 0;
      const t = m.getTerrain?.();
      if (!t || !settings.terrain) return;
      const want = effExaggeration();
      if (Math.abs((t.exaggeration || 0) - want) > 0.03 && t.exaggeration >= settings.exaggeration * 0.95) m.setTerrain({ source: 'rb-dem', exaggeration: want });
    }, 220);
  });
}

export function applyTerrain() {
  if (!map || !map.getSource('rb-dem')) return;
  map.setTerrain(settings.terrain ? { source: 'rb-dem', exaggeration: effExaggeration() } : null);
}

export function applySky() {
  if (!map) return;
  if (daylightFn && daylightFn()) return;
  map.setLight({ anchor: 'viewport', position: [1.15, 210, 30], color: '#ffffff', intensity: 0.5 });
  const dark = isDarkStyle();
  if (settings.sky) {
    map.setSky(dark ? {
      'sky-color': '#071426',
      'horizon-color': '#1f4a6e',
      'fog-color': '#0c1726',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.55,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 13, 0]
    } : {
      'sky-color': '#5fb3ff',
      'horizon-color': '#e6f4ff',
      'fog-color': '#f4f8fb',
      'sky-horizon-blend': 0.55,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.6,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 13, 0]
    });
  } else {
    const c = dark ? '#0b1220' : '#dbe7f3';
    map.setSky({ 'sky-color': c, 'horizon-color': c, 'fog-color': c, 'sky-horizon-blend': 0, 'horizon-fog-blend': 0, 'fog-ground-blend': 1, 'atmosphere-blend': 0 });
  }
}

export function applyBuildings() {
  if (!map) return;
  for (const l of map.getStyle().layers || []) {
    if (l.type === 'fill-extrusion') map.setLayoutProperty(l.id, 'visibility', settings.buildings ? 'visible' : 'none');
  }
}

export function applyHillshade() {
  if (map?.getLayer('rb-hillshade')) map.setLayoutProperty('rb-hillshade', 'visibility', settings.hillshade ? 'visible' : 'none');
}

const LAYER_GROUPS = {
  cycleways: ['rb-cycleway-glow', 'rb-cycleway-casing', 'rb-cycleway'],
  tracks: ['rb-track'],
  paths: ['rb-path'],
  mtb: ['rb-mtb-casing', 'rb-mtb'],
  wmtCycling: ['rb-wmt-cycling'],
  wmtMtb: ['rb-wmt-mtb'],
  trails: ['rb-trails-casing', 'rb-trails', 'rb-trails-flow', 'rb-trails-label', 'rb-trails-sel']
};

export function applyLayerVisibility() {
  if (!map) return;
  for (const [key, ids] of Object.entries(LAYER_GROUPS)) {
    for (const id of ids) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', settings.layers[key] ? 'visible' : 'none');
    }
  }
}

// Sanftes Pulsieren der Radwege (nur wenn Animationen aktiv)
let pulseT = 0;
export function startAmbientAnimation() {
  let last = 0;
  const tick = (t) => {
    requestAnimationFrame(tick);
    const q = quality();
    if (!animationsActive() || !q.pulse || !map || t - last < 120 * q.interval) return;
    last = t;
    pulseT += 0.12;
    if (map.getLayer('rb-cycleway-glow') && settings.layers.cycleways) {
      const base = isDarkStyle() ? 0.42 : 0.28;
      map.setPaintProperty('rb-cycleway-glow', 'line-opacity', base + Math.sin(pulseT) * 0.12);
    }
  };
  requestAnimationFrame(tick);
}
