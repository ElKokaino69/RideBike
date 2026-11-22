// RideBike – Standort & Turn-by-Turn-Navigation
// © 2026 Florian Enders

import maplibregl from 'maplibre-gl';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { map, onStyleReady } from './mapcore.js';
import { settings } from './settings.js';
import { route, setProgress, calcRoute, showRoute } from './routing.js';
import { flatSpeed } from './bike.js';
import { camPitch } from './graphics.js';

/** Navigation: etwas flacher als die Panorama-Kamera, damit die nächste Abbiegung gut sichtbar bleibt */
const navPitch = () => Math.min(camPitch(), 66);
import { isOnline } from './offline.js';
import { nearestOnLine, along, bearing, dist, fmtDist, fmtClock, lerpAngle } from './geo.js';

export const loc = {
  pos: null,        // [lng, lat]
  accuracy: null,
  speed: 0,         // m/s
  heading: null,
  watchId: null,
  marker: null
};

const listeners = new Set();
export function onLocation(fn) { listeners.add(fn); }

// Genauigkeitskreis um den Standort
function accuracyCircle() {
  if (!loc.pos || !loc.accuracy) return { type: 'FeatureCollection', features: [] };
  const [lng, lat] = loc.pos;
  const r = Math.min(loc.accuracy, 500);
  const ring = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ring.push([lng + (r * Math.sin(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.cos(a)) / 110540]);
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] };
}
onStyleReady((m) => {
  m.addSource('rb-acc', { type: 'geojson', data: accuracyCircle() });
  m.addLayer({ id: 'rb-acc-fill', type: 'fill', source: 'rb-acc', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.12 } });
  m.addLayer({ id: 'rb-acc-line', type: 'line', source: 'rb-acc', paint: { 'line-color': '#22d3ee', 'line-width': 1.2, 'line-opacity': 0.5 } });
});

// ---------- Standort ----------
function ensureMarker() {
  if (loc.marker) return;
  const el = document.createElement('div');
  el.className = 'user-loc';
  el.innerHTML = '<div class="ul-pulse"></div><div class="ul-cone"></div><div class="ul-dot"></div>';
  loc.marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map', opacityWhenCovered: '1' })
    .setLngLat(loc.pos)
    .addTo(map);
}

let smoothHeading = null;
function handlePosition(p) {
  if (!p?.coords) return;
  const prev = loc.pos;
  loc.pos = [p.coords.longitude, p.coords.latitude];
  loc.accuracy = p.coords.accuracy;
  loc.speed = p.coords.speed != null && !isNaN(p.coords.speed) ? p.coords.speed : loc.speed;
  let h = p.coords.heading;
  if ((h == null || isNaN(h) || loc.speed < 1.2) && prev && dist(prev, loc.pos) > 4) h = bearing(prev, loc.pos);
  if (h != null && !isNaN(h)) {
    smoothHeading = smoothHeading == null ? h : lerpAngle(smoothHeading, h, 0.5);
    loc.heading = smoothHeading;
  }
  ensureMarker();
  loc.marker.setLngLat(loc.pos);
  map.getSource('rb-acc')?.setData(accuracyCircle());
  if (loc.heading != null) loc.marker.setRotation(loc.heading);
  loc.marker.getElement().classList.toggle('has-heading', loc.heading != null);
  listeners.forEach((fn) => fn(loc));
  if (nav.active) navUpdate();
}

export async function startLocation() {
  if (loc.watchId != null) return true;
  try {
    if (Capacitor.isNativePlatform()) {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return false;
    }
    loc.watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
      (pos, err) => { if (!err) handlePosition(pos); }
    );
    return true;
  } catch (e) {
    console.warn('GPS nicht verfügbar', e);
    return false;
  }
}

export async function getOnce() {
  if (loc.pos) return loc.pos;
  try {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
    handlePosition(p);
    return loc.pos;
  } catch {
    return null;
  }
}

// ---------- Sprache ----------
export async function speak(text) {
  if (!settings.voice || !text) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({ text, lang: 'de-DE', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
    } else if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      speechSynthesis.speak(u);
    }
  } catch (e) {
    console.warn('TTS', e);
  }
}

// ---------- Navigation ----------
export const nav = {
  active: false,
  follow: true,
  dest: null,          // [lng, lat]
  vias: [],
  lastIdx: 0,
  along: 0,
  offCount: 0,
  lastReroute: 0,
  announced: new Map(), // maneuverIndex -> Set(thresholds)
  ui: null,            // callbacks { update(state), arrived(), rerouting(bool) }
  rerouting: false,
  flat: false
};

export async function startNavigation(dest, vias, ui) {
  nav.active = true;
  nav.follow = true;
  nav.dest = dest;
  nav.vias = vias || [];
  nav.lastIdx = 0;
  nav.along = 0;
  nav.offCount = 0;
  nav.announced = new Map();
  nav.ui = ui;
  if (settings.keepAwake) KeepAwake.keepAwake().catch(() => {});
  await startLocation();
  const first = route.data?.maneuvers?.[0];
  speak(first && first.type !== 'arrive'
    ? `Los geht's. ${fmtSpeech(first.d)} ${first.text}.`
    : 'Navigation gestartet.');
  if (loc.pos) navUpdate();
  else map.easeTo({ center: route.data.coords[0], zoom: 17, pitch: navPitch(), duration: 1200 });
}

export function stopNavigation() {
  nav.active = false;
  nav.ui = null;
  KeepAwake.allowSleep().catch(() => {});
  if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => {});
  map.getSource('rb-route-done')?.setData({ type: 'FeatureCollection', features: [] });
  map.easeTo({ pitch: Math.min(map.getPitch(), 50), zoom: Math.min(map.getZoom(), 15.5), padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 900 });
}

function fmtSpeech(m) {
  if (m < 30) return 'Jetzt';
  if (m < 1000) return `In ${Math.round(m / 10) * 10} Metern`;
  return `In ${(m / 1000).toFixed(1).replace('.', ',')} Kilometern`;
}

function announce(mi, m, distTo) {
  const fast = loc.speed > 6;
  const steps = fast ? [600, 200, 40] : [400, 120, 30];
  let set = nav.announced.get(mi);
  if (!set) { set = new Set(); nav.announced.set(mi, set); }
  for (const th of steps) {
    if (distTo <= th && !set.has(th)) {
      steps.filter((s) => s >= th).forEach((s) => set.add(s));
      if (m.type === 'arrive') speak(distTo < 40 ? 'Sie haben Ihr Ziel erreicht.' : `${fmtSpeech(distTo)} erreichen Sie Ihr Ziel.`);
      else speak(`${fmtSpeech(distTo)} ${m.text}.`);
      if (th === steps[2]) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      break;
    }
  }
}

async function reroute() {
  if (nav.rerouting || !loc.pos) return;
  if (!isOnline()) {
    if (Date.now() - nav.lastReroute > 60000) { nav.lastReroute = Date.now(); speak('Offline. Bitte zur Route zurückkehren.'); }
    nav.ui?.offline?.();
    return;
  }
  nav.rerouting = true;
  nav.lastReroute = Date.now();
  nav.ui?.rerouting(true);
  speak('Route wird neu berechnet.');
  try {
    const r = await calcRoute([loc.pos, ...nav.vias, nav.dest]);
    if (!nav.active) return;
    showRoute(r, { animate: false, fit: false });
    nav.lastIdx = 0;
    nav.offCount = 0;
    nav.announced = new Map();
  } catch (e) {
    console.warn('Neuberechnung fehlgeschlagen', e);
  } finally {
    nav.rerouting = false;
    nav.ui?.rerouting(false);
  }
}

export function navUpdate() {
  const r = route.data;
  if (!nav.active || !r || !loc.pos) return;

  // Auf Route einrasten (zuerst lokal suchen, dann global)
  let snap = nearestOnLine(r.coords, r.cum, loc.pos, nav.lastIdx - 5, nav.lastIdx + 400);
  if (snap.dist > 40) snap = nearestOnLine(r.coords, r.cum, loc.pos);
  const onRoute = snap.dist < 45;

  if (onRoute) {
    nav.offCount = 0;
    nav.lastIdx = snap.idx;
    nav.along = Math.max(nav.along - 30, snap.along);
  } else {
    nav.offCount++;
    if (nav.offCount >= 3 && Date.now() - nav.lastReroute > 12000) reroute();
  }

  const remaining = Math.max(0, r.total - nav.along);
  setProgress(nav.along);

  // Nächstes Manöver
  let mi = r.maneuvers.findIndex((m) => m.d > nav.along + 6);
  if (mi < 0) mi = r.maneuvers.length - 1;
  const m = r.maneuvers[mi];
  const distTo = Math.max(0, m.d - nav.along);
  const next = r.maneuvers[mi + 1];
  if (onRoute) announce(mi, m, distTo);

  // Ankunft
  if (remaining < 25 || (m.type === 'arrive' && distTo < 25)) {
    nav.ui?.update({ m, distTo: 0, next: null, remaining: 0, speed: loc.speed, eta: new Date(), onRoute: true });
    nav.ui?.arrived();
    return;
  }

  // Ankunftszeit (Restzeit anteilig zur Planung, angepasst an aktuelle Geschwindigkeit)
  // Restzeit anteilig aus der geplanten Fahrzeit, leicht an aktuelles Tempo angepasst
  const plannedLeft = r.time * (remaining / Math.max(1, r.total));
  const plannedV = Math.max(1.5, flatSpeed());
  const factor = loc.speed > 2 ? 0.65 + 0.35 * (plannedV / loc.speed) : 1;
  const eta = new Date(Date.now() + plannedLeft * Math.min(1.6, Math.max(0.6, factor)) * 1000);

  nav.ui?.update({ m, distTo, next: next && next.d - m.d < 150 ? next : null, remaining, speed: loc.speed, eta, onRoute });

  // Kamera folgen
  if (nav.follow) {
    const center = onRoute ? snap.point : loc.pos;
    const routeBrg = bearing(along(r.coords, r.cum, nav.along), along(r.coords, r.cum, nav.along + 35));
    const brg = loc.speed > 1.5 && loc.heading != null ? lerpAngle(routeBrg, loc.heading, onRoute ? 0.35 : 1) : routeBrg;
    const zoom = loc.speed > 8 ? 16.4 : loc.speed > 4 ? 17 : 17.5;
    map.easeTo({
      center, bearing: brg, pitch: nav.flat ? 0 : navPitch(), zoom,
      padding: { top: Math.round(window.innerHeight * 0.38), bottom: 0, left: 0, right: 0 },
      duration: 950, easing: (t) => t
    });
  }
}

export function recenterNav() {
  nav.follow = true;
  navUpdate();
}

export { fmtDist, fmtClock };
