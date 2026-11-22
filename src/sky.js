// RideBike – Himmel über dem 3D-Gelände: ziehende Wolken, Sonne mit Lichthof, Sterne
// © 2026 Florian Enders
//
// MapLibre zeichnet Himmelsfarbe und Dunst. Darüber legt dieses Modul eine leichte
// DOM-Ebene, die exakt am berechneten Horizont endet und mit Kamera-Drehung,
// Neigung und Sonnenstand mitläuft.

import { map } from './mapcore.js';
import { settings } from './settings.js';
import { getSun } from './details.js';
import { animationsActive, qualityId } from './graphics.js';

let root, farEl, nearEl, sunEl, starsEl, hazeEl;
let raf = 0, lastT = 0, drift = 0;
let state = { hz: 0, visible: false };

/** Wolkentextur einmalig prozedural erzeugen (weiche Haufenwolken, nahtlos kachelbar) */
function cloudTexture(w, h, count, seed, puff) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const cx = rnd() * w;
    const cy = h * (0.35 + rnd() * 0.45);
    const len = puff * (0.6 + rnd() * 1.4);
    const n = 6 + Math.floor(rnd() * 8);
    for (let k = 0; k < n; k++) {
      const px = cx + (rnd() - 0.5) * len * 2.2;
      const py = cy - Math.abs(rnd() - 0.3) * len * 0.55;
      const r = len * (0.25 + rnd() * 0.45);
      for (const dx of [-w, 0, w]) { // nahtlos über die Kante
        const grd = g.createRadialGradient(px + dx, py, 0, px + dx, py, r);
        grd.addColorStop(0, 'rgba(255,255,255,0.55)');
        grd.addColorStop(0.55, 'rgba(255,255,255,0.22)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.ellipse(px + dx, py, r * 1.6, r * 0.7, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // flache, leicht schattige Unterseite
    const base = g.createLinearGradient(0, cy, 0, cy + len * 0.4);
    base.addColorStop(0, 'rgba(160,180,205,0.18)');
    base.addColorStop(1, 'rgba(160,180,205,0)');
    g.fillStyle = base;
    g.fillRect(cx - len * 1.8, cy, len * 3.6, len * 0.4);
  }
  return c.toDataURL('image/png');
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const r = rnd() < 0.08 ? 1.3 : 0.6 + rnd() * 0.5;
    g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
    g.beginPath(); g.arc(rnd() * 512, rnd() * 256, r, 0, Math.PI * 2); g.fill();
  }
  return c.toDataURL('image/png');
}

export function initSky() {
  if (root) return;
  root = document.createElement('div');
  root.id = 'sky-fx';
  root.innerHTML = '<div class="sky-stars"></div><div class="sky-sun"><i></i></div><div class="sky-clouds far"></div><div class="sky-clouds near"></div><div class="sky-haze"></div>';
  const mapEl = document.getElementById('map');
  mapEl.parentNode.insertBefore(root, mapEl.nextSibling);
  starsEl = root.querySelector('.sky-stars');
  sunEl = root.querySelector('.sky-sun');
  farEl = root.querySelector('.sky-clouds.far');
  nearEl = root.querySelector('.sky-clouds.near');
  hazeEl = root.querySelector('.sky-haze');
  const lite = qualityId() === 'saver';
  farEl.style.backgroundImage = `url(${cloudTexture(1400, 220, lite ? 7 : 12, 11, 46)})`;
  nearEl.style.backgroundImage = `url(${cloudTexture(1800, 320, lite ? 4 : 7, 29, 90)})`;
  starsEl.style.backgroundImage = `url(${starTexture()})`;

  ['move', 'resize', 'styledata'].forEach((ev) => map.on(ev, update));
  update();
  loop(performance.now());
}

/** Bildschirmhöhe des Horizonts (px von oben) aus Neigung, Sichtfeld und Polsterung */
export function horizonY() {
  const H = map.getContainer().clientHeight;
  const pitch = map.getPitch();
  if (pitch <= 0) return -Infinity;
  const fov = (map.getVerticalFieldOfView?.() || 36.87) * Math.PI / 180;
  const pad = map.getPadding?.() || { top: 0, bottom: 0 };
  const cy = H / 2 + ((pad.top || 0) - (pad.bottom || 0)) / 2;
  const a = (90 - pitch) * Math.PI / 180;
  return cy - (H / 2) * Math.tan(a) / Math.tan(fov / 2);
}

function enabled() {
  return settings.skyFx !== false && settings.sky && settings.terrain;
}

function update() {
  if (!root) return;
  const W = map.getContainer().clientWidth;
  const H = map.getContainer().clientHeight;
  const hz = horizonY();
  const show = enabled() && hz > 24;
  state = { hz, visible: show };
  root.classList.toggle('on', show);
  if (!show) return;
  root.style.setProperty('--hz', `${Math.min(hz, H).toFixed(1)}px`);

  const bearing = map.getBearing();
  // Wolken laufen bei Drehung mit (Parallaxe: nah schneller als fern)
  farEl.style.backgroundPositionX = `${(-bearing * 7 + drift * 0.6).toFixed(1)}px`;
  nearEl.style.backgroundPositionX = `${(-bearing * 12 + drift).toFixed(1)}px`;
  starsEl.style.backgroundPositionX = `${(-bearing * 3).toFixed(1)}px`;

  const sun = getSun() || { altitude: 35, azimuth: 200 };
  const night = Math.max(0, Math.min(1, (-2 - sun.altitude) / 8));
  const dusk = Math.max(0, 1 - Math.abs(sun.altitude - 3) / 9);
  root.style.setProperty('--sky-night', night.toFixed(2));
  root.style.setProperty('--sky-dusk', dusk.toFixed(2));

  // Sonne: Azimut relativ zur Blickrichtung → x, Höhe über Horizont → y
  const vfov = map.getVerticalFieldOfView?.() || 36.87;
  const hfov = 2 * Math.atan(Math.tan(vfov * Math.PI / 360) * W / H) * 180 / Math.PI;
  let rel = ((sun.azimuth - bearing + 540) % 360) - 180;
  const x = W / 2 + (rel / (hfov / 2)) * (W / 2);
  const pxPerDeg = (H / 2) / (Math.tan(vfov * Math.PI / 360) * 180 / Math.PI);
  const y = hz - sun.altitude * pxPerDeg;
  const sunVisible = sun.altitude > -3 && x > -W * 0.4 && x < W * 1.4;
  sunEl.style.opacity = sunVisible ? String(Math.min(1, (sun.altitude + 3) / 4)) : '0';
  sunEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
}

function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!state.visible || !settings.animations || !animationsActive() || document.hidden) { lastT = t; return; }
  if (t - lastT < 50) return; // ~20 fps genügen für Wolken
  drift -= (t - lastT) * 0.004;
  lastT = t;
  update();
}

export function applySkyFx() { update(); }
