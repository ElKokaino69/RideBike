// RideBike – Offline-Karten
// Kachel-Cache in IndexedDB, eigenes Kartenprotokoll "rbc://", Download für Routenkorridor
// und Kartenausschnitt, Verwaltung gespeicherter Bereiche und Touren.
// © 2026 Florian Enders

import maplibregl from 'maplibre-gl';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { DEM, OFM_VECTOR, OVERPASS } from './config.js';
import { dist } from './geo.js';
import { settings } from './settings.js';

// ---------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------
const DB_NAME = 'ridebike-offline';
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('tiles');                    // key -> ArrayBuffer
        d.createObjectStore('meta');                     // key -> JSON / ArrayBuffer
        d.createObjectStore('regions', { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}
function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function store(name, mode = 'readonly') { return (await db()).transaction(name, mode).objectStore(name); }
export async function idbGet(s, k) { try { return await req((await store(s)).get(k)); } catch { return undefined; } }
export async function idbPut(s, k, v) { try { await req((await store(s, 'readwrite')).put(v, k)); } catch (e) { console.warn('IDB put', e); } }
async function idbPutRegion(r) { await req((await store('regions', 'readwrite')).put(r)); }
async function idbDel(s, k) { await req((await store(s, 'readwrite')).delete(k)); }
async function idbKeys(s) { return req((await store(s)).getAllKeys()); }
export async function listRegions() {
  try { return (await req((await store('regions')).getAll())).sort((a, b) => b.created - a.created); } catch { return []; }
}

// ---------------------------------------------------------------------
// Netzstatus
// ---------------------------------------------------------------------
export const net = { online: navigator.onLine, type: 'unknown' };
const netListeners = new Set();
export function onNetChange(fn) { netListeners.add(fn); }
export async function initNetwork() {
  try {
    const s = await Network.getStatus();
    net.online = s.connected; net.type = s.connectionType;
    Network.addListener('networkStatusChange', (st) => {
      net.online = st.connected; net.type = st.connectionType;
      netListeners.forEach((fn) => fn(net));
    });
  } catch {
    window.addEventListener('online', () => { net.online = true; netListeners.forEach((fn) => fn(net)); });
    window.addEventListener('offline', () => { net.online = false; netListeners.forEach((fn) => fn(net)); });
  }
}
export const isOnline = () => net.online;

/**
 * Darf die Karte gerade Daten aus dem Netz laden?
 * online  – immer, wenn Netz da ist
 * wifi    – nur im WLAN (bzw. unbekanntem Netz); mobil nur gespeicherte Karten
 * offline – nie, ausschließlich gespeicherte Karten
 */
export function mapNetAllowed() {
  if (!net.online) return false;
  const mode = settings.mapAccess || 'online';
  if (mode === 'offline') return false;
  if (mode === 'wifi') return net.type !== 'cellular';
  return true;
}
export const MAP_ACCESS = {
  online: { name: 'Online', hint: 'Karten werden live geladen, gespeicherte Bereiche zuerst genutzt.' },
  wifi: { name: 'Nur WLAN', hint: 'Im WLAN live, über mobile Daten nur gespeicherte Karten – spart Datenvolumen.' },
  offline: { name: 'Nur offline', hint: 'Ausschließlich gespeicherte Karten, keine Kartendaten aus dem Netz.' }
};

// ---------------------------------------------------------------------
// Schlüssel: versionsunabhängig für OpenFreeMap-Kacheln und Höhenmodell
// ---------------------------------------------------------------------
export function tileKey(url) {
  let u = url;
  try { u = decodeURIComponent(url); } catch { /* bleibt */ }
  let m;
  if ((m = u.match(/openfreemap\.org\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf/))) return `v/${m[1]}/${m[2]}/${m[3]}`;
  if ((m = u.match(/terrarium\/(\d+)\/(\d+)\/(\d+)\.png/))) return `d/${m[1]}/${m[2]}/${m[3]}`;
  return u;
}
const isTileKey = (k) => /^[vd]\//.test(k);

function decode(buf, type) {
  if (type === 'json') return JSON.parse(new TextDecoder().decode(buf));
  if (type === 'string') return new TextDecoder().decode(buf);
  return buf;
}

async function fetchBuf(url, signal, timeout = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
    return await r.arrayBuffer();
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------
// Protokoll rbc:// – erst Cache, dann Netz (Glyphen & Sprites werden nebenbei gemerkt)
// ---------------------------------------------------------------------
let protocolReady = false;
export function setupProtocol() {
  if (protocolReady) return;
  protocolReady = true;
  maplibregl.addProtocol('rbc', async (params, ac) => {
    const url = params.url.replace(/^rbc:\/\//, '');
    const key = tileKey(url);
    const tile = isTileKey(key);
    const hit = await idbGet(tile ? 'tiles' : 'meta', key);
    if (hit) return { data: decode(hit, params.type) };
    if (!mapNetAllowed()) {
      if (key.startsWith('v/')) return { data: new ArrayBuffer(0) };
      throw new Error('Kartendaten nicht gespeichert');
    }
    try {
      const buf = await fetchBuf(url, ac.signal);
      if (!tile) idbPut('meta', key, buf); // Glyphen, Sprites: klein, immer merken
      return { data: decode(buf, params.type) };
    } catch (e) {
      // Leere Vektorkachel statt Fehler (z. B. Meer, oder offline ohne gespeicherten Bereich)
      if (key.startsWith('v/') && (e.status === 404 || e.status === 204 || !mapNetAllowed())) return { data: new ArrayBuffer(0) };
      throw e;
    }
  });
}
export const viaCache = (url) => (/^https?:/.test(url) ? 'rbc://' + url : url);

// ---------------------------------------------------------------------
// Stil laden: online frisch, offline aus dem Speicher; Quellen auf rbc:// umbiegen
// ---------------------------------------------------------------------
async function jsonNetFirst(url, metaKey, force = false) {
  if (force ? net.online : mapNetAllowed()) {
    try {
      const buf = await fetchBuf(url, null, 7000);
      const obj = JSON.parse(new TextDecoder().decode(buf));
      idbPut('meta', metaKey, obj);
      return obj;
    } catch { /* weiter mit Cache */ }
  }
  return idbGet('meta', metaKey);
}

export async function tileJSON(url, force = false) {
  return jsonNetFirst(url, 'tj:' + url, force);
}

export async function prepareStyle(styleOrUrl) {
  let style = styleOrUrl;
  if (typeof styleOrUrl === 'string') {
    style = await jsonNetFirst(styleOrUrl, 'style:' + styleOrUrl);
    if (!style) throw new Error('Kartenstil offline nicht verfügbar');
  }
  style = structuredClone(style);
  for (const src of Object.values(style.sources || {})) {
    if (src.url && /^https?:/.test(src.url) && ['vector', 'raster', 'raster-dem'].includes(src.type)) {
      const tj = await tileJSON(src.url);
      if (tj?.tiles) {
        delete src.url;
        src.tiles = tj.tiles.map(viaCache);
        if (tj.minzoom != null) src.minzoom = tj.minzoom;
        if (tj.maxzoom != null) src.maxzoom = tj.maxzoom;
        if (tj.bounds) src.bounds = tj.bounds;
        if (!src.attribution && tj.attribution) src.attribution = tj.attribution;
      }
    } else if (Array.isArray(src.tiles)) {
      src.tiles = src.tiles.map(viaCache);
    }
  }
  if (style.glyphs) style.glyphs = viaCache(style.glyphs);
  if (typeof style.sprite === 'string') style.sprite = viaCache(style.sprite);
  else if (Array.isArray(style.sprite)) style.sprite = style.sprite.map((s) => ({ ...s, url: viaCache(s.url) }));
  return style;
}

// ---------------------------------------------------------------------
// Kachelberechnung
// ---------------------------------------------------------------------
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const tileMeters = (z, lat) => (40075016 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

function corridorTiles(coords, z, buffer) {
  const set = new Set();
  const lat0 = coords[0][1];
  const tm = tileMeters(z, lat0);
  const r = Math.max(0, Math.ceil(buffer / tm));
  const step = Math.max(50, Math.min(tm / 3, 400));
  let acc = Infinity;
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) acc += dist(coords[i - 1], coords[i]);
    if (acc < step && i !== coords.length - 1) continue;
    acc = 0;
    const x = lon2x(coords[i][0], z), y = lat2y(coords[i][1], z);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) set.add(`${z}/${x + dx}/${y + dy}`);
  }
  return set;
}

function areaTiles(bbox, z) {
  const [[w, s], [e, n]] = bbox;
  const set = new Set();
  const x0 = lon2x(w, z), x1 = lon2x(e, z), y0 = lat2y(n, z), y1 = lat2y(s, z);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(`${z}/${x}/${y}`);
  return set;
}

const AVG = { v: 38000, d: 62000 };   // grobe Durchschnittsgrößen in Byte
const ZOOMS = { v: [6, 14], d: [7, 14] };
export const AREA_MAX_TILES = 9000;

/** Kachelliste für Route (Korridor) oder Ausschnitt (bbox) */
export function planTiles({ coords, bbox, buffer = 1200 }) {
  const out = [];
  for (const kind of ['v', 'd']) {
    const [z0, z1] = ZOOMS[kind];
    for (let z = z0; z <= z1; z++) {
      const set = coords ? corridorTiles(coords, z, z <= 11 ? 0 : buffer) : areaTiles(bbox, z);
      for (const t of set) out.push(`${kind}/${t}`);
    }
  }
  const bytes = out.reduce((s, k) => s + AVG[k[0]], 0);
  return { keys: out, count: out.length, bytes };
}

function keyToUrl(key, vTemplate) {
  const [kind, z, x, y] = key.split('/');
  const tpl = kind === 'v' ? vTemplate : DEM.tiles[0];
  return tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

// ---------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------
let currentJob = null;
export function cancelDownload() { currentJob?.abort(); }
export function isDownloading() { return !!currentJob; }

async function downloadStyleAssets(styleUrls, signal) {
  const fontstacks = new Set(['Noto Sans Regular', 'Noto Sans Bold']);
  let glyphTpl = null;
  for (const url of styleUrls) {
    const st = await jsonNetFirst(url, 'style:' + url, true);
    if (!st) continue;
    if (st.glyphs) glyphTpl = st.glyphs;
    for (const src of Object.values(st.sources || {})) if (src.url) await tileJSON(src.url, true);
    for (const l of st.layers || []) {
      const f = l.layout?.['text-font'];
      if (Array.isArray(f) && f.every((x) => typeof x === 'string')) fontstacks.add(f.join(','));
    }
    const sprites = typeof st.sprite === 'string' ? [st.sprite] : Array.isArray(st.sprite) ? st.sprite.map((s) => s.url) : [];
    for (const sp of sprites) {
      for (const suf of ['.json', '.png', '@2x.json', '@2x.png']) {
        const u = sp + suf;
        if (await idbGet('meta', tileKey(u))) continue;
        try { idbPut('meta', tileKey(u), await fetchBuf(u, signal)); } catch { /* optional */ }
      }
    }
  }
  if (glyphTpl) {
    for (const fs of fontstacks) for (const range of ['0-255', '256-511', '8192-8447']) {
      const u = glyphTpl.replace('{fontstack}', fs).replace('{range}', range);
      if (await idbGet('meta', tileKey(u))) continue;
      try { idbPut('meta', tileKey(u), await fetchBuf(u, signal)); } catch { /* optional */ }
    }
  }
}

async function downloadTrails(bbox, signal) {
  const [[w, s], [e, n]] = bbox;
  const bb = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
  const q = `[out:json][timeout:40];relation["type"="route"]["route"~"^(bicycle|mtb)$"](${bb});out body geom(${bb});`;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal });
      if (r.ok) return await r.json();
    } catch { /* nächster Server */ }
  }
  return null;
}

/**
 * Bereich herunterladen.
 * @param {object} o { name, kind: 'route'|'area', coords?, bbox, route?, plan?, styleUrls, onProgress }
 */
export async function downloadRegion(o) {
  if (currentJob) throw new Error('Es läuft bereits ein Download');
  const ac = new AbortController();
  currentJob = ac;
  try {
    try { await navigator.storage?.persist?.(); } catch { /* egal */ }
    const plan = planTiles({ coords: o.coords, bbox: o.bbox });
    const tj = await tileJSON(OFM_VECTOR, true);
    if (!tj?.tiles?.[0]) throw new Error('Kartenserver nicht erreichbar');
    const vTpl = tj.tiles[0];
    o.onProgress?.({ phase: 'assets', done: 0, total: plan.count });
    await downloadStyleAssets(o.styleUrls || [], ac.signal);

    const existing = new Set(await idbKeys('tiles'));
    const todo = plan.keys.filter((k) => !existing.has(k));
    let done = plan.count - todo.length, bytes = 0, failed = 0;
    o.onProgress?.({ phase: 'tiles', done, total: plan.count, bytes });

    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        if (ac.signal.aborted) return;
        const key = todo[i++];
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const buf = await fetchBuf(keyToUrl(key, vTpl), ac.signal, 20000);
            await idbPut('tiles', key, buf);
            bytes += buf.byteLength;
            ok = true;
          } catch (e) {
            if (ac.signal.aborted) return;
            if (e.status === 404 || e.status === 204) { await idbPut('tiles', key, new ArrayBuffer(0)); ok = true; }
          }
        }
        if (!ok) failed++;
        done++;
        if (done % 8 === 0 || done === plan.count) o.onProgress?.({ phase: 'tiles', done, total: plan.count, bytes });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (ac.signal.aborted) throw new Error('abgebrochen');

    o.onProgress?.({ phase: 'trails', done, total: plan.count, bytes });
    const trails = await downloadTrails(o.bbox, ac.signal);

    // Größe der schon vorhandenen Kacheln grob mitzählen
    const totalBytes = bytes + (plan.count - todo.length) * 30000;
    const region = {
      id: `${o.kind}-${Date.now()}`,
      kind: o.kind,
      name: o.name,
      created: Date.now(),
      bbox: o.bbox,
      keys: plan.keys,
      count: plan.count,
      bytes: totalBytes,
      failed,
      route: o.route || null,
      plan: o.plan || null,
      routeHash: o.routeHash || null
    };
    await idbPutRegion(region);
    if (trails) await idbPut('meta', 'trails:' + region.id, trails);
    o.onProgress?.({ phase: 'done', done: plan.count, total: plan.count, bytes: totalBytes, failed });
    return region;
  } finally {
    currentJob = null;
  }
}

export async function deleteRegion(id) {
  const regions = await listRegions();
  const keep = new Set();
  let target = null;
  for (const r of regions) {
    if (r.id === id) target = r;
    else r.keys.forEach((k) => keep.add(k));
  }
  if (!target) return;
  const s = await store('tiles', 'readwrite');
  for (const k of target.keys) if (!keep.has(k)) s.delete(k);
  await idbDel('meta', 'trails:' + id);
  await idbDel('regions', id);
}

export async function storedTrails() {
  const out = [];
  for (const r of await listRegions()) {
    const t = await idbGet('meta', 'trails:' + r.id);
    if (t) out.push({ region: r, data: t });
  }
  return out;
}

export async function storageInfo() {
  try {
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}

/** Einfache Kennung einer Route (zur Erkennung, ob sie schon gespeichert ist) */
export function routeHash(coords) {
  if (!coords?.length) return '';
  const a = coords[0], b = coords[coords.length - 1], m = coords[Math.floor(coords.length / 2)];
  return [a, m, b].map((c) => `${c[0].toFixed(4)},${c[1].toFixed(4)}`).join('|') + `|${coords.length}`;
}

export const isNative = Capacitor.isNativePlatform();
