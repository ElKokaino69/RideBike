// RideBike – ziehende Wolkenschatten auf dem 3D-Gelände
// © 2026 Florian Enders
//
// Ein kleines Canvas mit weichen Schattenflecken wird als Bildquelle über die Landschaft
// gelegt (MapLibre „canvas“-Quelle, folgt dem Relief). Die Flecken wandern langsam mit dem
// Wind – das macht das Luftbild lebendig und deutlich fotorealistischer.

import { map, onStyleReady, currentStyleDef } from './mapcore.js';
import { settings } from './settings.js';
import { animationsActive, qualityId } from './graphics.js';
import { getSun } from './details.js';

const SIZE = 256;
let canvas, g, blobs = [], raf = 0, lastDraw = 0, drift = { x: 0, y: 0 };
let windDir = 250; // woher (°) – grob Westwind, wird von außen aktualisiert

export function setCloudWind(dir) { if (Number.isFinite(dir)) windDir = dir; }

function seedBlobs() {
  let s = 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  blobs = Array.from({ length: 16 }, () => ({ x: rnd(), y: rnd(), r: 0.05 + rnd() * 0.09, a: 0.5 + rnd() * 0.5, sx: 0.7 + rnd() * 0.8 }));
}

function draw() {
  g.clearRect(0, 0, SIZE, SIZE);
  for (const b of blobs) {
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const x = ((b.x + drift.x) % 1 + 1) % 1 + dx, y = ((b.y + drift.y) % 1 + 1) % 1 + dy;
      const cx = x * SIZE, cy = y * SIZE, r = b.r * SIZE;
      if (cx < -r * 2 || cx > SIZE + r * 2 || cy < -r * 2 || cy > SIZE + r * 2) continue;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
      grd.addColorStop(0, `rgba(10,18,30,${0.9 * b.a})`);
      grd.addColorStop(0.55, `rgba(10,18,30,${0.45 * b.a})`);
      grd.addColorStop(1, 'rgba(10,18,30,0)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(cx, cy, r * 1.6 * b.sx, r * 1.6, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

/** Quadrat um die Kartenmitte (Kantenlänge passend zur Zoomstufe) */
function box() {
  const c = map.getCenter();
  const km = Math.max(6, Math.min(120, 40 * Math.pow(2, 12 - map.getZoom())));
  const dLat = km / 2 / 111, dLng = km / 2 / (111 * Math.cos((c.lat * Math.PI) / 180));
  return [[c.lng - dLng, c.lat + dLat], [c.lng + dLng, c.lat + dLat], [c.lng + dLng, c.lat - dLat], [c.lng - dLng, c.lat - dLat]];
}

function enabled() {
  const sun = getSun?.() || { altitude: 30 };
  return settings.cloudShadows !== false && settings.terrain && sun.altitude > 3 && qualityId() !== 'saver';
}

function addLayer(m) {
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE; g = canvas.getContext('2d'); seedBlobs(); draw(); }
  if (m.getSource('rb-clouds')) return;
  m.addSource('rb-clouds', { type: 'canvas', canvas, coordinates: box(), animate: true });
  const photo = !!currentStyleDef().photo;
  // über Luftbild & Schummerung, unter Wegen und Beschriftungen
  const before = m.getStyle().layers.find((l) => l.type === 'line' || l.type === 'symbol' || l.type === 'fill-extrusion')?.id;
  m.addLayer({
    id: 'rb-clouds', type: 'raster', source: 'rb-clouds',
    layout: { visibility: enabled() ? 'visible' : 'none' },
    paint: { 'raster-opacity': photo ? 0.32 : 0.18, 'raster-fade-duration': 0, 'raster-resampling': 'linear' }
  }, before);
}

export function initClouds() {
  onStyleReady(addLayer);
  map.on('moveend', () => {
    const src = map.getSource('rb-clouds');
    if (src) src.setCoordinates(box());
  });
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    const src = map.getSource?.('rb-clouds');
    if (!src) return;
    const on = enabled();
    if (map.getLayer('rb-clouds')) map.setLayoutProperty('rb-clouds', 'visibility', on ? 'visible' : 'none');
    if (!on) { src.pause?.(); return; }
    if (!settings.animations || !animationsActive() || document.hidden) { src.pause?.(); return; }
    src.play?.();
    if (t - lastDraw < 66) return; // ~15 fps reichen für Wolken
    const dt = (t - lastDraw) / 1000; lastDraw = t;
    const to = ((windDir + 180) * Math.PI) / 180;          // Wind weht nach „to“
    const v = 0.0035 * Math.min(1, dt);                     // Anteil der Kachel pro Sekunde
    drift.x += Math.sin(to) * v; drift.y -= Math.cos(to) * v;
    draw();
  };
  raf = requestAnimationFrame(loop);
}
