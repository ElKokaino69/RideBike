// RideBike – Grafikqualität: Stufen, Geräteerkennung, Bildraten-Wächter
// © 2026 Florian Enders

import { settings } from './settings.js';

// interval = Faktor für Animationsintervalle (größer = seltener neu zeichnen)
export const QUALITY = {
  high:     { name: 'Hoch',        maxRatio: 3,   cacheZoomLevels: 5, maxPitch: 80, lod: [3, 6], interval: 1,   pulse: true,  water: true,  fade: 250 },
  balanced: { name: 'Ausgewogen',  maxRatio: 2,   cacheZoomLevels: 4, maxPitch: 76, lod: [3.5, 4.5], interval: 1.6, pulse: true,  water: true,  fade: 200 },
  saver:    { name: 'Sparsam',     maxRatio: 1.5, cacheZoomLevels: 3, maxPitch: 68, lod: [4, 3], interval: 3,   pulse: false, water: false, fade: 120 }
};
const ORDER = ['high', 'balanced', 'saver'];

let detected = null;
let sessionDowngrade = 0; // Stufen, um die "Auto" in dieser Sitzung reduziert wurde

/** Grobe Geräteeinschätzung beim Start */
export function detectQuality() {
  if (detected) return detected;
  let score = 0;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2) score += 2; else if (mem <= 4) score += 1;
  if (cores <= 4) score += 1;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const max = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 2048;
    if (max < 8192) score += 2;
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|mali-4|adreno \(tm\) [3-5]\d\d/i.test(renderer)) score += 2;
  } catch {
    score += 1;
  }
  detected = score >= 3 ? 'saver' : score >= 1 ? 'balanced' : 'high';
  return detected;
}

/** Effektive Stufe (Auto → erkannt, ggf. in dieser Sitzung herabgestuft) */
export function qualityId() {
  if (settings.quality && settings.quality !== 'auto') return settings.quality;
  const i = Math.min(ORDER.length - 1, ORDER.indexOf(detectQuality()) + sessionDowngrade);
  return ORDER[i];
}

export function quality() {
  return QUALITY[qualityId()];
}

export function pixelRatio() {
  return Math.max(1, Math.min(window.devicePixelRatio || 1, quality().maxRatio));
}

export function applyQuality(map) {
  if (!map) return;
  map.setPixelRatio(pixelRatio());
  // Steile Kamera sieht bis zum Horizont = viele Kacheln: Grenze je Leistungsstufe
  map.setMaxPitch(quality().maxPitch);
  applyLod(map);
}

/**
 * Schärfe in der Tiefe: weniger Zoomstufen gleichzeitig auf dem Bildschirm → ferne Kacheln
 * bleiben länger hochaufgelöst (kostet auf starken Geräten etwas mehr Kacheln).
 */
export function applyLod(map) {
  const [levels, ratio] = quality().lod;
  try { map.setSourceTileLodParams?.(levels, ratio); } catch { /* ältere MapLibre */ }
}

/** Kameraneigung für 3D-Ansichten, begrenzt durch die Leistungsstufe */
export function camPitch() {
  return Math.min(settings.pitch, quality().maxPitch);
}

/**
 * Bildraten-Wächter: misst während Kamerabewegungen.
 * Bei "Auto" und dauerhaft < 22 fps wird eine Stufe heruntergeschaltet.
 */
export function watchFrameRate(map, onDowngrade) {
  let frames = 0, start = 0, moving = false, lowWindows = 0;
  map.on('movestart', () => { moving = true; frames = 0; start = performance.now(); });
  map.on('render', () => { if (moving) frames++; });
  map.on('moveend', () => {
    moving = false;
    const dt = performance.now() - start;
    if (dt < 1500 || settings.quality !== 'auto') return;
    const fps = (frames * 1000) / dt;
    lowWindows = fps < 22 ? lowWindows + 1 : Math.max(0, lowWindows - 1);
    if (lowWindows >= 3 && ORDER.indexOf(qualityId()) < ORDER.length - 1) {
      lowWindows = 0;
      sessionDowngrade++;
      applyQuality(map);
      onDowngrade?.(quality());
    }
  });
}

// ---------------------------------------------------------------------
// Animations-Ruhe: nach 90 s ohne Berührung pausieren Effekte (Akku),
// außer während Navigation, Flyover oder Panorama-Drift.
// ---------------------------------------------------------------------
let lastTouch = performance.now();
let keepAwakeFn = () => false;
export function touchActivity() { lastTouch = performance.now(); }
export function setAnimationKeepAlive(fn) { keepAwakeFn = fn; }
export function animationsActive() {
  if (!settings.animations) return false;
  return keepAwakeFn() || performance.now() - lastTouch < 90000;
}
