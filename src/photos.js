// RideBike – Foto-Spots & Sammelpass
// © 2026 Florian Enders
//
// An besonderen Orten (Gipfel, Aussichtspunkte, Burgen, Wasserfälle, Türme …) bietet die
// App ein Foto an. Jedes Foto ist ein „Stempel“ im Sammelpass und zählt für die
// Meilensteine der Kategorie „Fotojäger“. Fotos liegen nur auf dem Gerät.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { overpass } from './trails.js';
import { dist } from './geo.js';

const KEY = 'ridebike.photos.v1';

export const SPOT_KINDS = {
  peak:      { name: 'Gipfel',        color: '#a16207', emoji: '⛰️' },
  viewpoint: { name: 'Aussicht',      color: '#a855f7', emoji: '🔭' },
  castle:    { name: 'Burg & Ruine',  color: '#b45309', emoji: '🏰' },
  waterfall: { name: 'Wasserfall',    color: '#0284c7', emoji: '💧' },
  tower:     { name: 'Aussichtsturm', color: '#64748b', emoji: '🗼' },
  chapel:    { name: 'Kapelle & Kreuz', color: '#7c3aed', emoji: '⛪' },
  lake:      { name: 'See',           color: '#0ea5e9', emoji: '🏞️' },
  sight:     { name: 'Sehenswürdigkeit', color: '#db2777', emoji: '📍' }
};

export const photos = { list: [], spots: new Map(), cells: new Set() };

export async function loadPhotos() {
  try { const v = (await Preferences.get({ key: KEY })).value; if (v) photos.list = JSON.parse(v); } catch { /* leer */ }
}
function saveIndex() { Preferences.set({ key: KEY, value: JSON.stringify(photos.list) }).catch(() => {}); }

function kindOf(t) {
  if (t.natural === 'peak' || t.natural === 'volcano') return 'peak';
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (/^(castle|ruins|fort)$/.test(t.historic || '')) return 'castle';
  if (t.waterway === 'waterfall' || t.natural === 'waterfall') return 'waterfall';
  if (t.man_made === 'tower' && /observation/.test(t['tower:type'] || '')) return 'tower';
  if (/^(wayside_cross|wayside_shrine)$/.test(t.historic || '') || (t.amenity === 'place_of_worship' && /chapel/.test(t.building || ''))) return 'chapel';
  if (t.natural === 'water' && t.name) return 'lake';
  if (t.tourism === 'attraction' || t.historic === 'monument') return 'sight';
  return null;
}

/** Foto-Spots in einer ~2×2 km Zelle laden (einmal je Zelle) */
export async function loadSpotsAround([lng, lat]) {
  const cx = Math.floor(lng / 0.03), cy = Math.floor(lat / 0.02);
  const todo = [];
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    const k = `${cx + dx}:${cy + dy}`;
    if (!photos.cells.has(k)) { photos.cells.add(k); todo.push([cx + dx, cy + dy]); }
  }
  if (!todo.length) return;
  const xs = todo.map((t) => t[0]), ys = todo.map((t) => t[1]);
  const s = Math.min(...ys) * 0.02, n = (Math.max(...ys) + 1) * 0.02, w = Math.min(...xs) * 0.03, e = (Math.max(...xs) + 1) * 0.03;
  const bb = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  try {
    const data = await overpass(`[out:json][timeout:25];(
      node["natural"~"^(peak|volcano)$"]["name"]${bb};
      node["tourism"="viewpoint"]${bb};
      node["historic"~"^(castle|ruins|fort)$"]${bb}; way["historic"~"^(castle|ruins|fort)$"]${bb};
      node["waterway"="waterfall"]${bb}; node["natural"="waterfall"]${bb};
      node["man_made"="tower"]["tower:type"~"observation"]${bb};
      node["historic"~"^(wayside_cross|wayside_shrine)$"]["name"]${bb};
      node["tourism"="attraction"]["name"]${bb};
      way["natural"="water"]["name"]${bb};
    );out center tags 300;`);
    for (const el of data.elements || []) {
      const t = el.tags || {};
      const kind = kindOf(t);
      const lo = el.lon ?? el.center?.lon, la = el.lat ?? el.center?.lat;
      if (!kind || lo == null) continue;
      const id = `${el.type}/${el.id}`;
      photos.spots.set(id, { id, kind, name: t.name || SPOT_KINDS[kind].name, lngLat: [lo, la], ele: t.ele || '' });
    }
  } catch { todo.forEach(([x, y]) => photos.cells.delete(`${x}:${y}`)); }
}

/** Nächster Spot in Reichweite (Seen großzügiger, da Mittelpunkt) */
export function spotInReach(pos, radius = 90) {
  let best = null, bd = Infinity;
  for (const s of photos.spots.values()) {
    const d = dist(pos, s.lngLat);
    const r = s.kind === 'lake' ? radius * 3 : s.kind === 'peak' ? radius * 1.6 : radius;
    if (d < r && d < bd) { best = s; bd = d; }
  }
  return best ? { ...best, d: bd } : null;
}

export const hasStamp = (spotId) => photos.list.some((p) => p.spotId === spotId);
export const stampsToday = () => { const d = new Date().toDateString(); return photos.list.filter((p) => new Date(p.ts).toDateString() === d).length; };

// ---------- Foto aufnehmen ----------
async function captureDataUrl() {
  if (Capacitor.isNativePlatform()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const p = await Camera.getPhoto({ quality: 82, resultType: CameraResultType.DataUrl, source: CameraSource.Camera, width: 1800, correctOrientation: true, saveToGallery: false });
    return p.dataUrl;
  }
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => {
      const f = inp.files?.[0]; inp.remove(); if (!f) return reject(new Error('abgebrochen'));
      const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(f);
    };
    inp.click();
  });
}

function resize(dataUrl, max, q = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.src = dataUrl;
  });
}

// Web: Fotos in IndexedDB; App: Dateien im App-Speicher
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ridebike-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function storeFull(id, dataUrl) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({ path: `photos/${id}.jpg`, data: dataUrl.split(',')[1], directory: Directory.Data, recursive: true });
    return;
  }
  const db = await idb();
  await new Promise((res, rej) => { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').put(dataUrl, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
export async function loadFull(id) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const r = await Filesystem.readFile({ path: `photos/${id}.jpg`, directory: Directory.Data });
    return `data:image/jpeg;base64,${r.data}`;
  }
  const db = await idb();
  return new Promise((res) => { const tx = db.transaction('p'); const q = tx.objectStore('p').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
}

/**
 * Foto an einem Spot machen und als Stempel speichern.
 * @returns Eintrag { id, spotId, name, kind, lngLat, ts, thumb, first }
 */
export async function takeSpotPhoto(spot, pos, rideId = null) {
  const raw = await captureDataUrl();
  const full = await resize(raw, 1800, 0.84);
  const thumb = await resize(raw, 320, 0.74);
  const id = `p${Date.now()}`;
  await storeFull(id, full);
  const first = !hasStamp(spot.id);
  const entry = { id, spotId: spot.id, name: spot.name, kind: spot.kind, lngLat: spot.lngLat || pos, ts: Date.now(), thumb, rideId, first, ele: spot.ele || '' };
  photos.list.unshift(entry);
  saveIndex();
  return entry;
}

export async function deletePhoto(id) {
  photos.list = photos.list.filter((p) => p.id !== id);
  saveIndex();
  try {
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.deleteFile({ path: `photos/${id}.jpg`, directory: Directory.Data });
    } else { const db = await idb(); db.transaction('p', 'readwrite').objectStore('p').delete(id); }
  } catch { /* schon weg */ }
}

/** Werte für die Fotojäger-Meilensteine */
export function photoStats() {
  const spots = new Map();
  for (const p of photos.list) if (!spots.has(p.spotId)) spots.set(p.spotId, p);
  const byKind = (k) => [...spots.values()].filter((p) => p.kind === k).length;
  const perDay = {};
  for (const p of spots.values()) { const d = new Date(p.ts).toDateString(); perDay[d] = (perDay[d] || 0) + 1; }
  return {
    spots: spots.size, peaks: byKind('peak'), castles: byKind('castle'), views: byKind('viewpoint') + byKind('tower'),
    water: byKind('waterfall') + byKind('lake'), kinds: new Set([...spots.values()].map((p) => p.kind)).size,
    bestDay: Math.max(0, ...Object.values(perDay))
  };
}
