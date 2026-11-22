// RideBike – Hauptmodul
// © 2026 Florian Enders. Alle Rechte vorbehalten.

import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import './premium.css';
import maplibregl from 'maplibre-gl';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

import { APP, MAP_STYLES, C } from './config.js';
import { BIKE_TYPES, TYRES, AERO, bikeType, applyBikeType, bikeSummary, brouterRequest } from './bike.js';
import { settings, loadSettings, setSetting, onSettingChange, saveSettings } from './settings.js';
import {
  createMap, map, switchStyle, swapDem, currentExaggeration, applyTerrain, applySky, applyBuildings, applyHillshade,
  applyLayerVisibility, startAmbientAnimation, BIKE_LAYER_IDS, activeStyleId, effectiveStyleId
} from './mapcore.js';
import { initDetails, applyDetailVisibility, growTerrain, setDriftBlocker, noteInteraction, poiLabel, onAutoNight } from './details.js';
import { QUALITY, qualityId, camPitch, detectQuality, applyQuality, watchFrameRate, setAnimationKeepAlive } from './graphics.js';
import {
  initNetwork, onNetChange, isOnline, net, planTiles, downloadRegion, cancelDownload, isDownloading, listRegions,
  deleteRegion, storedTrails, storageInfo, routeHash, AREA_MAX_TILES, mapNetAllowed, MAP_ACCESS
} from './offline.js';
import { ingestTrails } from './trails.js';
import { initSky, applySkyFx } from './sky.js';
import { simulate, compareLevels, chargersNear, ASSIST, BATTERIES } from './ebike.js';
import { isEbike } from './bike.js';
import { recordFlyover, shareVideo, videoSupported } from './video.js';
import { loadWear, addRide as wearAddRide, status as wearStatus, resetPart, dueCount, shopUrl, addManualKm } from './wear.js';
import { MILESTONES, CATS as MS_CATS, TIERS, evaluate, medalCounts, fmtValue, progress, tierOf } from './milestones.js';
import { stats, rides, loadStats, initRecorder, rec, onRecord, startRide, finishRide, markArrived, liveUnlocks, countFlyover, rideElevationRoute } from './rides.js';
import { initTrails, refreshTrails, onTrailStatus, getTrail, selectTrail, networkLabel } from './trails.js';
import {
  initRouting, route, searchPlaces, reverseGeocode, calcRoute, showRoute, clearRoute,
  drawElevation, startFlyover, stopFlyover, isFlying, refreshRouteStyle, estimateTime
} from './routing.js';
import { loc, startLocation, onLocation, nav, startNavigation, stopNavigation, recenterNav, speak } from './nav.js';
import { nearestOnLine, cumulative, fmtDist, fmtDur, fmtClock, bboxOf } from './geo.js';
import {
  $, $$, esc, ICON, maneuverSvg, toast, openSheet, closeSheet, isSheetOpen, enableSheetDrag, debounce, dialog, fmtBytes, bikeSvg, medalSvg
} from './ui.js';

const isNative = Capacitor.isNativePlatform();

// =====================================================================
// Start
// =====================================================================
async function boot() {
  if (isNative) document.documentElement.classList.add('native');
  // Die App-Oberfläche darf nie als Ganzes scrollen (z. B. durch Fokus/scrollIntoView)
  const pin = (el) => el.addEventListener('scroll', () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } });
  pin(document.body); pin(document.documentElement); window.addEventListener('scroll', () => window.scrollTo(0, 0));
  await loadSettings();
  await loadStats();
  await loadWear();
  await initNetwork();
  await createMap('map', settings.lastView);
  initTrails();
  initRouting();
  initDetails();
  watchFrameRate(map, (q) => { toast(`Grafik automatisch auf „${q.name}“ angepasst`); updateQualityNote(); applyDetailVisibility(); });
  onAutoNight((id, done) => {
    const fade = $('#style-fade');
    fade.classList.add('on');
    setTimeout(() => {
      switchStyle(id);
      const end = () => { fade.classList.remove('on'); done(); };
      map.once('idle', () => setTimeout(end, 150));
      setTimeout(end, 4500);
    }, 300);
  });
  setDriftBlocker(() => nav.active || isFlying() || document.body.classList.contains('sheet-open'));
  setAnimationKeepAlive(() => nav.active || isFlying() || settings.drift);
  startAmbientAnimation();

  injectIcons();
  buildLayersSheet();
  wireSearch();
  wireFabs();
  wireMapInteraction();
  wireRoutePlanner();
  wireNavigation();
  wireBackButton();
  onSettingChange(handleSettingChange);
  onTrailStatus(updateTrailStatus);

  buildBikeSheet();
  buildStyleSheet();
  buildLegend();
  wireHud();
  updateQualityNote();
  ['sheet-route', 'sheet-info', 'sheet-layers', 'sheet-bike', 'sheet-offline', 'sheet-style'].forEach((id) => enableSheetDrag(document.getElementById(id)));
  wireOffline();
  wireMilestones();
  ['sheet-ms', 'sheet-ride'].forEach((id) => enableSheetDrag(document.getElementById(id)));

  let splashDone = false;
  const hideSplash = () => {
    if (splashDone) return;
    splashDone = true;
    $('#splash').classList.add('hide');
    setTimeout(() => $('#splash')?.remove(), 900);
  };
  const t0 = Date.now();
  map.once('load', () => setTimeout(hideSplash, Math.max(0, 1700 - (Date.now() - t0))));
  setTimeout(hideSplash, 5000);
  if (isNative) SplashScreen.hide().catch(() => {});

  map.on('moveend', debounce(() => {
    if (nav.active || isFlying()) return;
    const c = map.getCenter();
    setSetting('lastView', { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
  }, 1200));

  if (/[?&]debug\b/.test(location.search)) window.__rb = { recordFlyover, simulate, wearStatus, map, settings, setSetting, growTerrain, nav, route, loc, stats, rides, celebrate, showRideSummary };
  // Quellenangabe kompakt starten (MapLibre klappt sie sonst anfangs auf)
  // Quellenangabe: kompakt, nur auf Antippen aufklappen (MapLibre klappt sie sonst selbst auf)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.maplibregl-ctrl-attrib-button');
    if (btn) btn.parentElement.classList.toggle('rb-open');
  }, true);
  initSky();
  map.on('rotate', updateCompass);
  map.on('pitch', update3dButton);
  map.once('load', () => {
    updateCompass(); update3dButton();
    if (map.getPitch() > 5) { introCamera(); growTerrain(2600); }
  });

  // Erster GPS-Fix → filmischer Anflug
  let firstFix = true;
  onLocation(() => {
    if (!firstFix) return;
    firstFix = false;
    if (!settings.lastView || followMode) {
      flyToUser(true);
    }
  });
  startLocation().then((ok) => { if (!ok) toast('Standortfreigabe fehlt – Karte trotzdem nutzbar'); });
}

/** Filmischer Einstieg: aus der Draufsicht in die steile 3D-Perspektive schwenken */
function introCamera() {
  if (!settings.animations || nav.active) return;
  const z = map.getZoom(), b = map.getBearing(), p = map.getPitch();
  map.jumpTo({ zoom: z - 0.9, pitch: Math.max(20, p - 40), bearing: b + 28 });
  map.easeTo({ zoom: z, pitch: p, bearing: b, duration: 3400, easing: (t) => 1 - Math.pow(1 - t, 3) });
}

function injectIcons() {
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  set('#s-ic', ICON.search);
  set('#btn-offline .mm-ic', ICON.cloud);
  set('#btn-mybike .mm-ic', ICON.bike);
  set('#btn-plan', ICON.navArrow);
  set('#btn-more', ICON.dots + ($('#btn-more').innerHTML || ''));
  set('#offline-close', ICON.close);
  set('#q-clear', ICON.close);
  set('#btn-layers .mm-ic', ICON.gear);
  set('#btn-style', ICON.layers);
  set('#btn-legend .mm-ic', ICON.trail);
  set('#zoom-in', ICON.plus);
  set('#zoom-out', ICON.minus);
  set('#btn-locate', ICON.locate);
  set('#btn-compass .needle', ICON.compass);
  set('#rp-back', ICON.back);
  set('#rp-close', ICON.close);
  set('#rp-swap', ICON.swap);
  set('#rp-flag', ICON.flag);
  set('#rp-plus', ICON.plus);
  set('#pr-ic', ICON.bike);
  $$('.plan-row .chev').forEach((c) => { c.innerHTML = ICON.chevR; });
  set('#layers-close', ICON.close);
  set('#style-close', ICON.close);
  set('#bike-close', ICON.chevL);
  set('#btn-fly', ICON.fly);
  set('#btn-video', ICON.film || ICON.fly);
  set('#btn-go', `${ICON.nav}<span>Navigation starten</span>`);
  set('#nav-stop', ICON.close);
  set('#nav-recenter', ICON.navArrow);
  set('#nt-speed-ic', ICON.gauge);
  set('#nt-dist-ic', ICON.finish);
  set('#nt-time-ic', ICON.clock);
  set('#hud-ele-ic', ICON.peaks);
  set('#hud-dist-ic', ICON.routeIc);
  set('#hud-time-ic', ICON.clock);
  updateVoiceBtn();
}

// =====================================================================
// Einstellungen anwenden
// =====================================================================
function handleSettingChange(path) {
  if (path === 'lastView') return;
  if (path === 'style') {
    const fade = $('#style-fade');
    fade.classList.add('on');
    setTimeout(() => {
      switchStyle(settings.style);
      map.once('idle', () => setTimeout(() => fade.classList.remove('on'), 120));
      setTimeout(() => fade.classList.remove('on'), 4000);
    }, 260);
    $$('.sg-card').forEach((c) => c.classList.toggle('on', c.dataset.id === settings.style));
    const sub = $('#style-row-sub'); if (sub) sub.textContent = (MAP_STYLES.find((x) => x.id === settings.style) || MAP_STYLES[0]).name;
  } else if (path === 'terrain') { if (settings.terrain) growTerrain(); else applyTerrain(); applySkyFx(); }
  else if (path === 'exaggeration') applyTerrain();
  else if (path.startsWith('details.')) applyDetailVisibility();
  else if (path === 'daylight' || path === 'daylightMode') { if (!settings.daylight) { document.documentElement.style.setProperty('--night', '0'); document.documentElement.style.setProperty('--sun-glow', '0'); } applySky(); updateDaylightChips(); }
  else if (path === 'hillshade') applyHillshade();
  else if (path === 'buildings') applyBuildings();
  else if (path === 'sky') { applySky(); applySkyFx(); }
  else if (path === 'skyFx') applySkyFx();
  else if (path === 'hdTerrain') { swapDem(); toast(settings.hdTerrain ? 'HD-Gelände aktiv' : 'Standard-Gelände aktiv'); }
  else if (path === 'drift') noteInteraction();
  else if (path === 'autoNight') applySky();
  else if (path === 'mapAccess') {
    updateNetChip();
    applyDetailVisibility();
    updateOfflineCard();
    switchStyle(settings.style);         // Kacheln neu anfordern (Cache bzw. Netz), ggf. Luftbild ↔ Vektor
    if (mapNetAllowed()) refreshTrails();
    $$('#access-seg button').forEach((b) => b.classList.toggle('on', b.dataset.acc === settings.mapAccess));
    const h = $('#access-hint'); if (h) h.textContent = MAP_ACCESS[settings.mapAccess].hint;
    const sub = $('#offline-row-sub'); if (sub) sub.textContent = `Kartenzugriff: ${MAP_ACCESS[settings.mapAccess].name}`;
    toast(`Kartenzugriff: ${MAP_ACCESS[settings.mapAccess].name}`);
  }
  else if (path === 'quality') { applyQuality(map); applyDetailVisibility(); updateQualityNote(); }
  else if (path === 'pitch') { if (map.getPitch() > 5 && !nav.active) map.easeTo({ pitch: camPitch(), duration: 500 }); }
  else if (path.startsWith('layers.')) {
    applyLayerVisibility();
    if (path === 'layers.trails' && settings.layers.trails) refreshTrails();
    if (path === 'layers.trails' && !settings.layers.trails) $('#trail-status').hidden = true;
  } else if (path === 'slopeColors') { refreshRouteStyle(); }
  else if (path.startsWith('bike.')) onBikeChanged();
  else if (path === 'voice') updateVoiceBtn();
}

// =====================================================================
// Kartenansicht-Sheet
// =====================================================================
function toggleRow(path, icon, title, sub, swatch = '') {
  const on = path.split('.').reduce((o, k) => o[k], settings);
  return `<label class="row">
    <span class="ic">${icon}</span>
    <span class="lbl"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    ${swatch}
    <span class="switch"><input type="checkbox" data-set="${path}" ${on ? 'checked' : ''}><span></span></span>
  </label>`;
}

function rangeRow(path, title, min, max, step, fmt) {
  const v = settings[path];
  return `<div class="range-row">
    <div class="top"><span>${title}</span><output data-out="${path}">${fmt(v)}</output></div>
    <input type="range" data-set="${path}" min="${min}" max="${max}" step="${step}" value="${v}" data-fmt="${path}">
  </div>`;
}

const FMT = {
  exaggeration: (v) => `${Number(v).toFixed(1).replace('.', ',')}×`,
  pitch: (v) => `${v}°`,
  speed: (v) => `${v} km/h`
};

function sw(color, dash = false) {
  return `<span class="swatch ${dash ? 'dash' : ''}" style="--c:${color};background:${color}"></span>`;
}

function buildLayersSheet() {
  const styles = MAP_STYLES.map((s) => `
    <button class="style-card ${s.id === settings.style ? 'on' : ''}" data-id="${s.id}">
      <div class="pv" style="background:linear-gradient(135deg, ${s.preview[0]} 0%, ${s.preview[1]} 55%, ${s.preview[2]} 100%)"></div>
      <b>${s.name}</b><small>${s.hint}</small>
    </button>`).join('');

  $('#layers-body').innerHTML = `
    <button class="row as-btn" id="open-offline">
      <span class="ic">${ICON.cloud}</span>
      <span class="lbl"><b>Offline-Karten</b><small id="offline-row-sub">Kartenzugriff: ${MAP_ACCESS[settings.mapAccess].name}</small></span>
      <span class="chev">›</span>
    </button>
    <button class="row as-btn" id="open-style">
      <span class="ic">${ICON.palette}</span>
      <span class="lbl"><b>Kartenstil</b><small id="style-row-sub">${(MAP_STYLES.find((x) => x.id === settings.style) || MAP_STYLES[0]).name}</small></span>
      <span class="chev">›</span>
    </button>

    <div class="sec">3D-Ansicht</div>
    ${toggleRow('terrain', ICON.mountain, '3D-Gelände', 'Berge & Täler plastisch')}
    ${rangeRow('exaggeration', 'Geländeüberhöhung', 1, 3, 0.1, FMT.exaggeration)}
    ${rangeRow('pitch', 'Kameraneigung', 20, 80, 1, FMT.pitch)}
    ${toggleRow('buildings', ICON.layers, '3D-Gebäude', 'Ab Zoomstufe 14')}
    ${toggleRow('hillshade', ICON.mountain, 'Reliefschattierung', 'Schattiertes Gelände')}
    ${toggleRow('sky', ICON.globe, 'Himmel & Dunst', 'Atmosphäre am Horizont')}
    ${toggleRow('skyFx', ICON.cloud, 'Wolken & Sonne', 'Ziehende Wolken, Sonne mit Lichthof, Sterne bei Nacht')}
    ${toggleRow('hdTerrain', ICON.peaks, 'HD-Gelände', 'Hochaufgelöstes Höhenmodell online (scharfe Grate & Täler)')}

    <div class="sec">Licht & Animation</div>
    ${toggleRow('daylight', ICON.sun, 'Tageslicht', 'Himmel, Schatten & Licht nach Sonnenstand')}
    <div class="seg daylight-seg ${settings.daylight ? '' : 'off'}" id="daylight-seg">
      ${[['live', 'Live'], ['morning', 'Morgen'], ['noon', 'Mittag'], ['evening', 'Abend'], ['night', 'Nacht']].map(([k, n]) => `<button data-dl="${k}" class="${settings.daylightMode === k ? 'on' : ''}">${n}</button>`).join('')}
    </div>
    ${toggleRow('animations', ICON.fly, 'Animationen', 'Leuchtende Radwege, fließende Trails & Route')}
    ${toggleRow('drift', ICON.globe, 'Panorama-Drift', 'Kamera kreist langsam im Leerlauf (3D)')}
    ${toggleRow('autoNight', ICON.moon, 'Nachtkarte automatisch', 'Nach Sonnenuntergang dunkle Karte')}

    <div class="sec">Grafik</div>
    <div class="seg quality-seg" id="quality-seg">
      ${[['auto', 'Auto'], ['high', 'Hoch'], ['balanced', 'Ausgewogen'], ['saver', 'Sparsam']].map(([k, n]) => `<button data-q="${k}" class="${settings.quality === k ? 'on' : ''}">${n}</button>`).join('')}
    </div>
    <p class="hint" id="quality-note"></p>

    <div class="sec">Kartendetails</div>
    ${toggleRow('details.contours', ICON.contour, 'Höhenlinien', 'Mit Höhenangaben, aus dem Geländemodell')}
    ${toggleRow('details.peaks', ICON.mountain, 'Gipfel', 'Name und Höhe')}
    ${toggleRow('details.pois', ICON.pin, 'Rad-POIs', 'Radläden, Trinkwasser, Unterstände, Aussicht, Laden …')}
    ${toggleRow('details.forest', ICON.tree, 'Waldtextur', 'Baumkronen-Muster in Wäldern')}
    ${toggleRow('details.water', ICON.wave, 'Wasser-Schimmer', 'Bewegte Wasseroberfläche')}
    ${toggleRow('details.forest3d', ICON.tree, '3D-Wald', 'Wälder leicht erhaben ab Zoom 13 (rechenintensiv)')}
    ${toggleRow('details.unpaved', ICON.trail, 'Unbefestigte Straßen', 'Gepunktet markiert', sw('#a16207', true))}

    <div class="sec">Radwege & Trails</div>
    ${toggleRow('layers.cycleways', ICON.bike, 'Radwege', 'Eigenständige & ausgewiesene', sw(C.cycleway))}
    ${toggleRow('layers.tracks', ICON.trail, 'Feld- & Waldwege', 'Wirtschaftswege', sw(C.track, true))}
    ${toggleRow('layers.paths', ICON.trail, 'Pfade', 'Rad i. d. R. erlaubt', sw('#84cc16', true))}
    ${toggleRow('layers.mtb', ICON.mountain, 'MTB-Trails', 'Farbe = Schwierigkeit S0–S6', `<span class="swatch" style="background:linear-gradient(90deg,${C.mtb.slice(0, 6).join(',')})"></span>`)}
    ${toggleRow('layers.trails', ICON.info, 'Radrouten & Trails mit Info', 'Antippen für Details (ab Zoom 10)', `<span class="swatch" style="background:linear-gradient(90deg,${C.network.icn},${C.network.ncn},${C.network.rcn},${C.network.lcn})"></span>`)}
    ${toggleRow('layers.wmtCycling', ICON.globe, 'Radnetz-Overlay', 'Waymarked Trails – Radrouten')}
    ${toggleRow('layers.wmtMtb', ICON.globe, 'MTB-Overlay', 'Waymarked Trails – MTB')}

    <div class="sec">Route & Navigation</div>
    <button class="row as-btn" id="open-bike">
      <span class="ic">${ICON.bike}</span>
      <span class="lbl"><b>Mein Rad</b><small id="bike-row-sub"></small></span>
      <span class="chev">›</span>
    </button>
    ${toggleRow('slopeColors', ICON.up, 'Steigung einfärben', 'Route nach Steigung färben')}
    ${toggleRow('voice', ICON.sound, 'Sprachansagen', 'Abbiegehinweise auf Deutsch')}
    ${toggleRow('keepAwake', ICON.clock, 'Bildschirm anlassen', 'Während der Navigation')}

    <div class="sec">Legende</div>
    <div class="legend">
      <div>${sw(C.network.icn)} EuroVelo / international</div>
      <div>${sw(C.network.ncn)} National</div>
      <div>${sw(C.network.rcn)} Regional</div>
      <div>${sw(C.network.lcn)} Lokal</div>
      <div>${sw(C.network.mtb)} MTB-Route</div>
      <div>${sw(C.cycleway)} Radweg</div>
    </div>

    <div class="about">
      <img src="./logo.svg" alt="">
      <h4>Ride<span>Bike</span></h4>
      <p>Version ${APP.version}</p>
      <p class="copy">© ${APP.year} ${APP.author}. Alle Rechte vorbehalten.</p>
      <p>Kartendaten © OpenStreetMap-Mitwirkende (ODbL) · Vektorkacheln OpenFreeMap / OpenMapTiles ·
      Höhen: Mapzen Terrain Tiles · Routing: BRouter · Suche: Photon (komoot) · Trails: Overpass API, Waymarked Trails ·
      Satellit: Esri · Radkarte: CyclOSM</p>
    </div>`;

  $('#layers-body').addEventListener('click', (e) => {
    if (e.target.closest('#open-bike')) { closeSheet('sheet-layers'); setTimeout(() => openSheet('sheet-bike'), 160); return; }
    if (e.target.closest('#open-offline')) { closeSheet('sheet-layers'); openOfflineSheet(); return; }
    if (e.target.closest('#open-style')) { closeSheet('sheet-layers'); openSheet('sheet-style'); return; }
    const qb = e.target.closest('[data-q]');
    if (qb) { setSetting('quality', qb.dataset.q); $$('#quality-seg button').forEach((b) => b.classList.toggle('on', b === qb)); return; }
    const dl = e.target.closest('[data-dl]');
    if (dl) { if (!settings.daylight) { setSetting('daylight', true); const cb = $('input[data-set="daylight"]'); if (cb) cb.checked = true; } setSetting('daylightMode', dl.dataset.dl); return; }
    const card = e.target.closest('.style-card');
    if (card && card.dataset.id !== settings.style) setSetting('style', card.dataset.id);
  });
  $('#layers-body').addEventListener('input', (e) => {
    const el = e.target;
    const path = el.dataset.set;
    if (!path) return;
    if (el.type === 'checkbox') setSetting(path, el.checked);
    else if (el.type === 'range') {
      const v = Number(el.value);
      const out = $(`output[data-out="${path}"]`);
      if (out) out.textContent = FMT[path](v);
      setSetting(path, v);
    }
  });
}

// =====================================================================
// Buttons rechts
// =====================================================================
let followMode = false;

function updateCompass() {
  const n = $('#btn-compass .needle');
  if (n) n.style.transform = `rotate(${-map.getBearing()}deg)`;
}

function update3dButton() {
  const b = $('#btn-3d');
  const is3d = map.getPitch() > 5;
  b.textContent = is3d ? '3D' : '2D';
  b.classList.toggle('on', is3d);
}

function glow3d() {
  const b = $('#btn-3d');
  b.classList.remove('growing'); void b.offsetWidth; b.classList.add('growing');
}

function flyToUser(cinematic = false) {
  if (!loc.pos) return;
  map.flyTo({
    center: loc.pos,
    zoom: Math.max(map.getZoom(), cinematic ? 15 : 15.5),
    pitch: cinematic ? camPitch() : map.getPitch(),
    bearing: cinematic ? -20 : map.getBearing(),
    duration: cinematic && settings.animations ? 4200 : 1400,
    curve: 1.5,
    essential: true
  });
}

function updateQualityNote() {
  const el = $('#quality-note');
  if (!el) return;
  const eff = QUALITY[qualityId()].name;
  el.textContent = settings.quality === 'auto'
    ? `Auto passt die Qualität an dein Handy an (erkannt: ${QUALITY[detectQuality()].name}, aktiv: ${eff}). Bei ruckelnder Karte wird automatisch heruntergeschaltet.`
    : `Aktiv: ${eff}. „Sparsam“ schont Akku und Grafikspeicher auf langen Touren.`;
}

function updateDaylightChips() {
  $$('#daylight-seg button').forEach((b) => b.classList.toggle('on', b.dataset.dl === settings.daylightMode));
  $('#daylight-seg')?.classList.toggle('off', !settings.daylight);
}

function wireFabs() {
  $('#btn-compass').onclick = () => map.easeTo({ bearing: 0, duration: 600 });
  $('#btn-3d').onclick = () => {
    const to3d = map.getPitch() <= 5;
    map.easeTo({ pitch: to3d ? camPitch() : 0, bearing: to3d && Math.abs(map.getBearing()) < 1 ? -18 : map.getBearing(), duration: 1300 });
    if (to3d) { growTerrain(); glow3d(); }
    if (to3d && settings.terrain === false) toast('Tipp: 3D-Gelände in der Kartenansicht aktivieren');
  };
  const only = (id) => ['sheet-layers', 'sheet-style', 'sheet-offline', 'sheet-bike'].filter((x) => x !== id).forEach(closeSheet);
  $('#btn-layers').onclick = () => {
    if (isSheetOpen('sheet-layers')) closeSheet('sheet-layers');
    else { only('sheet-layers'); openSheet('sheet-layers'); }
  };
  $('#btn-style').onclick = () => {
    if (isSheetOpen('sheet-style')) closeSheet('sheet-style');
    else { only('sheet-style'); openSheet('sheet-style'); }
  };
  $('#style-close').onclick = () => closeSheet('sheet-style');
  $('#btn-legend').onclick = () => {
    const p = $('#legend-panel');
    p.hidden = !p.hidden;
    $('#btn-legend').classList.toggle('active', !p.hidden);
    document.body.classList.toggle('legend-open', !p.hidden);
  };
  // „Mehr“-Menü (Speed-Dial) – schließt nach Auswahl oder Tipp auf die Karte
  const menu = $('#more-menu');
  const setMore = (open) => { menu.hidden = !open; $('#btn-more').classList.toggle('active', open); };
  $('#btn-more').onclick = (e) => { e.stopPropagation(); setMore(menu.hidden); };
  menu.addEventListener('click', () => setTimeout(() => setMore(false), 120));
  $('#btn-mybike').onclick = () => openSheet('sheet-bike');
  // PRO-Abzeichen erklären (Beta: alles frei – Abo folgt über Google Play)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pro-badge')) return;
    e.stopPropagation();
    dialog({
      icon: ICON.medal, title: 'RideBike Pro',
      text: 'E-Bike-Reichweite mit Akku-Planer, Wartungs-Tracker und 3D-Videos sind Pro-Funktionen. In der Beta sind sie für dich kostenlos freigeschaltet.',
      buttons: [{ label: 'Alles klar', primary: true }]
    });
  }, true);
  map.on('click', () => setMore(false));
  map.on('dragstart', () => setMore(false));
  // Pfeil: Route planen – mit Ziel öffnet der Planer, sonst geht es in die Suche
  $('#btn-plan').onclick = () => {
    if (plan.end) { only('sheet-route'); openSheet('sheet-route'); }
    else { $('#q').focus(); toast('Wohin geht\'s? Ziel suchen oder lange auf die Karte tippen'); }
  };
  $('#zoom-in').onclick = () => map.easeTo({ zoom: map.getZoom() + 1, duration: 380 });
  $('#zoom-out').onclick = () => map.easeTo({ zoom: map.getZoom() - 1, duration: 380 });
  $('#layers-close').onclick = () => closeSheet('sheet-layers');
  $('#btn-locate').onclick = async () => {
    if (!loc.pos) {
      const ok = await startLocation();
      toast(ok ? 'Suche GPS-Signal…' : 'Standort nicht verfügbar – bitte Freigabe prüfen');
      followMode = true;
      return;
    }
    followMode = !followMode || map.getCenter().distanceTo({ lng: loc.pos[0], lat: loc.pos[1] }) > 30;
    $('#btn-locate').classList.toggle('tracking', followMode);
    flyToUser();
  };
  onLocation(() => {
    if (followMode && !nav.active && !isFlying()) map.easeTo({ center: loc.pos, duration: 800 });
  });
  map.on('dragstart', () => {
    if (followMode) { followMode = false; $('#btn-locate').classList.remove('tracking'); }
  });
}

// =====================================================================
// Suche
// =====================================================================
function placeIcon(kind) {
  if (/bicycle|cycle/.test(kind)) return ICON.bike;
  if (/peak|mountain|hill|volcano/.test(kind)) return ICON.mountain;
  return ICON.pin;
}

function wireSearch() {
  const q = $('#q');
  const res = $('#results');
  let seq = 0;
  const run = debounce(async () => {
    const term = q.value.trim();
    if (term.length < 2) { res.hidden = true; return; }
    const my = ++seq;
    try {
      const near = loc.pos || [map.getCenter().lng, map.getCenter().lat];
      const items = await searchPlaces(term, near);
      if (my !== seq) return;
      res.innerHTML = items.length
        ? items.map((it, i) => `<button class="result" data-i="${i}"><span class="ri">${placeIcon(it.kind)}</span><span><b>${esc(it.name)}</b><small>${esc(it.sub)}</small></span></button>`).join('')
        : '<div class="empty">Keine Treffer</div>';
      res.hidden = false;
      res.onclick = (e) => {
        const b = e.target.closest('.result');
        if (!b) return;
        const it = items[Number(b.dataset.i)];
        res.hidden = true;
        q.blur();
        setDestination(it.lngLat, it.name);
      };
    } catch {
      if (my === seq) { res.innerHTML = `<div class="empty">${isOnline() ? 'Suche gerade nicht erreichbar' : 'Offline – Suche braucht Internet. Lang auf die Karte drücken, um ein Ziel zu setzen, oder eine gespeicherte Tour öffnen.'}</div>`; res.hidden = false; }
    }
  }, 320);
  q.addEventListener('input', () => { $('#q-clear').hidden = !q.value; run(); });
  q.addEventListener('focus', () => { if (q.value.trim().length >= 2) run(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = $('.result', res); first?.click(); } });
  $('#q-clear').onclick = () => { q.value = ''; $('#q-clear').hidden = true; res.hidden = true; q.focus(); };
  map.on('movestart', () => { res.hidden = true; });
}

// =====================================================================
// Karteninteraktion: Antippen (Info) & Lang drücken (Kontextmenü)
// =====================================================================
let ctxPopup = null;
let suppressClick = false;

function wireMapInteraction() {
  let lpTimer = null, lpPoint = null;
  const clearLp = () => { clearTimeout(lpTimer); lpTimer = null; };
  map.on('touchstart', (e) => {
    clearLp();
    if (e.originalEvent.touches.length !== 1) return;
    lpPoint = e.point;
    const lngLat = e.lngLat;
    lpTimer = setTimeout(() => { suppressClick = true; showContextMenu(lngLat); }, 550);
  });
  map.on('touchmove', (e) => { if (lpPoint && Math.hypot(e.point.x - lpPoint.x, e.point.y - lpPoint.y) > 10) clearLp(); });
  map.on('touchend', clearLp);
  map.on('touchcancel', clearLp);
  map.on('contextmenu', (e) => showContextMenu(e.lngLat));

  map.on('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (nav.active || isFlying()) return;
    $('#results').hidden = true;
    const box = [[e.point.x - 12, e.point.y - 12], [e.point.x + 12, e.point.y + 12]];
    const trailLayers = ['rb-trails', 'rb-trails-casing'].filter((id) => map.getLayer(id));
    const trailHit = trailLayers.length ? map.queryRenderedFeatures(box, { layers: trailLayers }) : [];
    if (trailHit.length) { showTrailInfo(trailHit[0].properties.id); return; }
    const poiLayers = ['rb-pois', 'rb-peaks'].filter((id) => map.getLayer(id));
    const poiHit = poiLayers.length ? map.queryRenderedFeatures(box, { layers: poiLayers }) : [];
    if (poiHit.length) { showPoiInfo(poiHit[0]); return; }
    const wayLayers = BIKE_LAYER_IDS.filter((id) => map.getLayer(id));
    const wayHit = wayLayers.length ? map.queryRenderedFeatures(box, { layers: wayLayers }) : [];
    if (wayHit.length) { showWayInfo(wayHit[0], e.lngLat); return; }
    if (isSheetOpen('sheet-info')) { closeSheet('sheet-info'); selectTrail(null); }
  });
  ['rb-trails', 'rb-pois', 'rb-peaks', ...BIKE_LAYER_IDS].forEach((id) => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  });
}

function showContextMenu(lngLat) {
  if (nav.active) return;
  ctxPopup?.remove();
  const ll = [lngLat.lng, lngLat.lat];
  const el = document.createElement('div');
  const hasRoute = !!plan.end;
  el.innerHTML = `
    <div class="ctx-title">${ll[1].toFixed(5)}, ${ll[0].toFixed(5)}</div>
    <button class="ctx-btn" data-a="dest">${ICON.pin}Hierher fahren</button>
    <button class="ctx-btn" data-a="start">${ICON.start}Als Startpunkt</button>
    ${hasRoute ? `<button class="ctx-btn" data-a="via">${ICON.plus}Zwischenziel</button>` : ''}`;
  ctxPopup = new maplibregl.Popup({ closeButton: false, className: 'rb-popup', offset: 14, maxWidth: '260px' })
    .setLngLat(lngLat).setDOMContent(el).addTo(map);
  let label = null;
  reverseGeocode(ll).then((n) => { if (n) { label = n; const t = $('.ctx-title', el); if (t) t.textContent = n; } });
  el.onclick = (e) => {
    const a = e.target.closest('.ctx-btn')?.dataset.a;
    if (!a) return;
    ctxPopup.remove();
    const name = label || 'Markierter Punkt';
    if (a === 'dest') setDestination(ll, name);
    else if (a === 'start') setStart(ll, name);
    else if (a === 'via') addVia(ll, name);
  };
  if (navigator.vibrate) navigator.vibrate(18);
}

// ---------- Info: Trail ----------
const SCALE_TXT = ['S0 · sehr leicht', 'S1 · leicht', 'S2 · mittel', 'S3 · schwer', 'S4 · sehr schwer', 'S5 · extrem', 'S6 · kaum fahrbar'];
const SCALE_DESC = [
  'Fester, griffiger Untergrund ohne besondere Hindernisse.',
  'Kleine Hindernisse wie flache Wurzeln und Steine, loser Untergrund möglich.',
  'Größere Wurzeln & Steine, Stufen, enge Kurven – Fahrtechnik nötig.',
  'Verblockt, hohe Stufen, Spitzkehren, rutschiger Untergrund.',
  'Sehr steil, Wurzelfelder, Felsen – nur für Könner.',
  'Extrem verblockt, Absätze, Geröll – Expertenterrain.',
  'Nur in Ausnahmen fahrbar.'
];

function scaleBar(level) {
  return `<div class="scale-bar">${C.mtb.map((c, i) => `<i class="${i === level ? 'on' : ''}" style="background:${c};color:${c}"></i>`).join('')}</div>`;
}

function showTrailInfo(id) {
  const t = getTrail(id);
  if (!t) return;
  selectTrail(id);
  const g = t.tags;
  const color = g.colour && CSS.supports('color', g.colour) ? g.colour : (g.route === 'mtb' ? C.network.mtb : C.network[g.network] || C.network.lcn);
  const distTag = parseFloat(String(g.distance || '').replace(',', '.'));
  const lenTxt = !isNaN(distTag) ? `${String(distTag).replace('.', ',')} km` : `≥ ${fmtDist(t.loadedLen)} (geladen)`;
  const mtbScale = g['mtb:scale'] != null ? parseInt(g['mtb:scale'], 10) : null;
  const rows = [
    ['Länge', lenTxt],
    g.ref && ['Nummer', g.ref],
    (g.from || g.to) && ['Verlauf', `${g.from || '…'} → ${g.to || '…'}`],
    g.ascent && ['Anstieg', `${g.ascent} m`],
    g.operator && ['Betreiber', g.operator],
    g.roundtrip === 'yes' && ['Typ', 'Rundtour'],
    g.surface && ['Belag', g.surface]
  ].filter(Boolean);
  const wmt = g.route === 'mtb' ? 'mtb' : 'cycling';
  $('#info-body').innerHTML = `
    <div class="info-head">
      <div class="info-badge" style="background:${esc(color)}">${g.route === 'mtb' ? ICON.mountain : ICON.bike}</div>
      <div><h3>${esc(g.name || g.ref || 'Radroute')}</h3><small>${esc(networkLabel(g))}${g.network === 'icn' && /eurovelo/i.test(g.name || g.network || '') ? ' · EuroVelo' : ''}</small></div>
    </div>
    <div class="tags">
      <span class="tag" style="background:${esc(color)}33;color:${esc(color)}">${g.route === 'mtb' ? 'Mountainbike' : 'Fahrrad'}</span>
      ${g.network ? `<span class="tag">${esc(g.network.toUpperCase())}</span>` : ''}
      ${g.state === 'proposed' ? '<span class="tag">geplant</span>' : ''}
    </div>
    ${mtbScale != null && !isNaN(mtbScale) ? `<div class="kv"><dt>Schwierigkeit</dt><dd>${SCALE_TXT[Math.min(6, mtbScale)]}</dd></div>${scaleBar(Math.min(6, mtbScale))}` : ''}
    <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${g.description || g.note ? `<p class="desc">${esc(g.description || g.note)}</p>` : ''}
    <div class="links">
      ${g.website ? `<a href="${esc(g.website)}" target="_blank" rel="noopener">${ICON.ext}Website</a>` : ''}
      <a href="https://${wmt}.waymarkedtrails.org/#route?id=${t.id}" target="_blank" rel="noopener">${ICON.ext}Waymarked Trails</a>
      <a href="https://www.openstreetmap.org/relation/${t.id}" target="_blank" rel="noopener">${ICON.ext}OSM</a>
    </div>
    <div class="actions">
      <button class="btn ghost" id="ti-show">${ICON.zoom}<span>Zeigen</span></button>
      <button class="btn primary" id="ti-go">${ICON.nav}<span>Hinfahren</span></button>
    </div>`;
  $('#ti-show').onclick = () => {
    if (t.bbox) map.fitBounds(t.bbox, { padding: { top: 120, bottom: 360, left: 40, right: 40 }, duration: 1200, pitch: map.getPitch() });
  };
  $('#ti-go').onclick = () => {
    const from = loc.pos || [map.getCenter().lng, map.getCenter().lat];
    let best = null;
    for (const line of t.lines) {
      const n = nearestOnLine(line, cumulative(line), from);
      if (!best || n.dist < best.dist) best = n;
    }
    if (best) { closeSheet('sheet-info'); setDestination(best.point, `Einstieg ${g.ref || g.name || 'Trail'}`); }
  };
  closeSheet('sheet-route');
  openSheet('sheet-info');
}

// ---------- Info: POI / Gipfel ----------
function showPoiInfo(f) {
  selectTrail(null);
  const p = f.properties || {};
  const ll = f.geometry.coordinates;
  const isPeak = f.layer.id === 'rb-peaks';
  const name = p['name:de'] || p.name || (isPeak ? 'Gipfel' : poiLabel(p.subclass));
  const kind = isPeak ? 'Gipfel' : poiLabel(p.subclass);
  const color = isPeak ? '#7a5a3a' : '#2563eb';
  $('#info-body').innerHTML = `
    <div class="info-head">
      <div class="info-badge" style="background:${color}">${isPeak ? ICON.mountain : ICON.pin}</div>
      <div><h3>${esc(name)}</h3><small>${esc(kind)}${isPeak && p.ele ? ` · ${esc(p.ele)} m` : ''}</small></div>
    </div>
    <div class="actions"><button class="btn primary" id="pi-go">${ICON.nav}<span>Hierher fahren</span></button></div>`;
  $('#pi-go').onclick = () => { closeSheet('sheet-info'); setDestination(ll, name); };
  closeSheet('sheet-route');
  openSheet('sheet-info');
}

// ---------- Info: Weg ----------
function showWayInfo(f, lngLat) {
  selectTrail(null);
  const p = f.properties || {};
  const layer = f.layer.id;
  const kind = {
    'rb-cycleway': ['Radweg', C.cycleway, ICON.bike],
    'rb-track': ['Feld- / Waldweg', C.track, ICON.trail],
    'rb-path': ['Pfad', '#84cc16', ICON.trail],
    'rb-mtb': ['MTB-Trail', C.mtb[3], ICON.mountain]
  }[layer] || ['Weg', C.accent, ICON.trail];
  const scaleRaw = p.mtb_scale != null ? parseInt(String(p.mtb_scale), 10) : null;
  const scale = scaleRaw != null && !isNaN(scaleRaw) ? Math.min(6, scaleRaw) : null;
  const color = scale != null ? C.mtb[scale] : kind[1];
  const BIKE = { designated: 'ausgewiesen', yes: 'erlaubt', permissive: 'geduldet', dismount: 'absteigen', no: 'verboten' };
  const SURF = { paved: 'befestigt', unpaved: 'unbefestigt' };
  const rows = [
    p.name && ['Name', p.name],
    p.bicycle && ['Fahrrad', BIKE[p.bicycle] || p.bicycle],
    p.surface && ['Belag', SURF[p.surface] || p.surface],
    p.subclass && ['OSM-Typ', p.subclass]
  ].filter(Boolean);
  $('#info-body').innerHTML = `
    <div class="info-head">
      <div class="info-badge" style="background:${color}">${kind[2]}</div>
      <div><h3>${esc(p.name || kind[0])}</h3><small>${esc(kind[0])}</small></div>
    </div>
    ${scale != null ? `<dl class="kv"><dt>Schwierigkeit</dt><dd>${SCALE_TXT[scale]}</dd></dl>${scaleBar(scale)}<p class="desc">${SCALE_DESC[scale]}</p>` : ''}
    <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="actions"><button class="btn primary" id="wi-go">${ICON.nav}<span>Hierher fahren</span></button></div>`;
  $('#wi-go').onclick = () => { closeSheet('sheet-info'); setDestination([lngLat.lng, lngLat.lat], p.name || kind[0]); };
  closeSheet('sheet-route');
  openSheet('sheet-info');
}

function updateTrailStatus(s) {
  const el = $('#trail-status');
  if (!settings.layers.trails || nav.active) { el.hidden = true; return; }
  clearTimeout(el._t);
  if (s.state === 'loading') { el.innerHTML = '<span class="spinner"></span>Trails werden geladen…'; el.hidden = false; }
  else if (s.state === 'error') { el.textContent = 'Trails gerade nicht erreichbar'; el.hidden = false; el._t = setTimeout(() => (el.hidden = true), 3000); }
  else if (s.state === 'zoom' || s.state === 'offline') { el.hidden = true; }
  else { el.hidden = true; }
}

// =====================================================================
// Routenplanung
// =====================================================================
const plan = { start: { gps: true, lngLat: null, label: 'Mein Standort' }, end: null, vias: [] };
const markers = { start: null, end: null, vias: [] };
let elevMarker = null;
let routeSeq = 0;

function wpMarker(cls, text, lngLat, onDrag) {
  let el;
  let opts = { anchor: 'bottom-left', offset: [-4, 4] };
  if (cls === 'end') {
    el = document.createElement('div');
    el.className = 'wp-flagpole drop';
    el.innerHTML = '<div class="wp-marker finish"><span></span></div>';
    opts = { anchor: 'bottom-left', offset: [-4, 2] };
  } else {
    el = document.createElement('div');
    el.className = `wp-marker ${cls} drop`;
    el.innerHTML = `<span>${text}</span>`;
  }
  const m = new maplibregl.Marker({ element: el, draggable: true, opacityWhenCovered: '1', ...opts }).setLngLat(lngLat).addTo(map);
  m.on('dragend', () => { const p = m.getLngLat(); onDrag([p.lng, p.lat]); });
  return m;
}

function syncMarkers() {
  markers.start?.remove(); markers.end?.remove(); markers.vias.forEach((m) => m.remove());
  markers.start = markers.end = null; markers.vias = [];
  if (!plan.end) return;
  if (!plan.start.gps && plan.start.lngLat) {
    markers.start = wpMarker('start', '', plan.start.lngLat, (ll) => { plan.start.lngLat = ll; plan.start.label = 'Startpunkt'; renderPlan(); recompute(); });
  }
  plan.vias.forEach((v, i) => {
    markers.vias.push(wpMarker('via', i + 1, v.lngLat, (ll) => { v.lngLat = ll; v.label = `Zwischenziel ${i + 1}`; renderPlan(); recompute(); }));
  });
  markers.end = wpMarker('end', '', plan.end.lngLat, (ll) => {
    plan.end.lngLat = ll; plan.end.label = 'Ziel';
    renderPlan(); recompute();
    reverseGeocode(ll).then((n) => { if (n && plan.end) { plan.end.label = n; renderPlan(); } });
  });
}

function renderPlan() {
  const s = $('#rp-start');
  s.textContent = `Start: ${plan.start.gps ? 'Mein Standort' : plan.start.label}`;
  s.classList.toggle('gps', plan.start.gps);
  $('#rp-end').textContent = plan.end ? `Ziel: ${plan.end.label}` : 'Ziel wählen';
  $('#rp-vias').innerHTML = plan.vias.map((v, i) => `
    <div class="rp-row"><span class="rp-dot via"></span><button class="rp-field">Via: ${esc(v.label)}</button><button class="rp-x" data-del="${i}">${ICON.close}</button></div>`).join('');
  const t = bikeType();
  $('#pr-chip').innerHTML = `<span class="tyico">${ICON[t.icon]}</span>${esc(t.name)}${ICON.chevD}`;
  $('#pr-menu').innerHTML = BIKE_TYPES.map((x) => `<button class="${x.id === t.id ? 'on' : ''}" data-p="${x.id}">${ICON[x.icon]}${esc(x.name)}</button>`).join('')
    + `<button class="pm-gear" data-gear="1">${ICON.gear}Rad einstellen …</button>`;
}

let countRaf = new Map();
/** Zahl hochzählen (Animation) */
function countUp(el, to, fmt, ms = 900) {
  if (!el) return;
  cancelAnimationFrame(countRaf.get(el));
  if (!settings.animations) { el.textContent = fmt(to); return; }
  const from = Number(el.dataset.v || 0);
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) countRaf.set(el, requestAnimationFrame(step));
    else el.dataset.v = String(to);
  };
  countRaf.set(el, requestAnimationFrame(step));
}

function renderStats() {
  const r = route.data;
  updateHudRoute();
  if (!r) { $('#route-stats').innerHTML = ''; return; }
  if (!$('#st-dist')) {
    $('#route-stats').innerHTML = `
      <div class="s3">${ICON.routeIc}<b id="st-dist"></b></div>
      <div class="s3">${ICON.clock}<b id="st-time"></b></div>
      <div class="s3 up">${ICON.up}<b id="st-asc"></b></div>`;
  }
  countUp($('#st-dist'), r.total, (v) => fmtDist(v));
  countUp($('#st-time'), r.time, (v) => fmtDur(v));
  if (r.hasEle) countUp($('#st-asc'), r.ascent, (v) => `+${Math.round(v)} m`);
  else $('#st-asc').textContent = '–';
  renderEbikeCard();
}

// ---------------------------------------------------------------------
// E-Bike-Reichweite (Pro)
// ---------------------------------------------------------------------
const haptic = () => { if (navigator.vibrate) navigator.vibrate(12); };
let chargerMarkers = [];
let emptyMarker = null;
function clearEbikeMarkers() {
  chargerMarkers.forEach((m) => m.remove()); chargerMarkers = [];
  emptyMarker?.remove(); emptyMarker = null;
}

function renderEbikeCard() {
  const card = $('#ebike-card');
  const r = route.data;
  clearEbikeMarkers();
  if (!r || !isEbike()) { card.hidden = true; return; }
  const b = settings.bike;
  const res = simulate(r);
  if (!res) { card.hidden = true; return; }
  const levels = compareLevels(r);
  const lvl = ASSIST.find((a) => a.id === b.assist) || ASSIST[1];
  const used = Math.min(100, res.pct);
  const left = Math.round(res.remainPct);
  const state = !res.ok ? 'bad' : left < 20 ? 'warn' : 'good';
  const best = levels.filter((l) => l.res?.ok).pop();
  card.className = `ebike-card ${state}`;
  card.hidden = false;
  card.innerHTML = `
    <div class="eb-head">
      <span class="eb-batt"><i style="--fill:${Math.max(0, Math.min(100, b.charge - used))}%"></i></span>
      <div class="eb-txt">
        <b>${res.ok ? `Akku reicht – ${left} % bleiben` : `Akku leer nach ${fmtDist(res.emptyAtM)}`}</b>
        <small>${Math.round(res.wh)} Wh von ${Math.round(b.batteryWh * b.charge / 100)} Wh · Stufe ${lvl.name} · Start ${b.charge} %</small>
      </div>
      <span class="pro-badge">PRO</span>
    </div>
    <div class="eb-levels">${levels.map((l) => `
      <button data-assist="${l.id}" class="${l.id === b.assist ? 'on' : ''} ${l.res?.ok ? '' : 'no'}">
        <b>${l.name}</b><small>${l.res ? Math.round(l.res.pct) + ' %' : '–'}</small></button>`).join('')}
    </div>
    ${!res.ok ? `<div class="eb-tip">${best ? `Mit <b>${best.name}</b> kommst du ans Ziel (${Math.round(best.res.pct)} % Verbrauch).` : 'Auch in Eco reicht der Akku nicht – unterwegs nachladen.'}
      <button class="btn tiny" id="eb-chargers">${ICON.bolt}Ladestationen</button></div>`
      : left < 20 ? `<div class="eb-tip">Knapp: weniger als 20 % Reserve. <button class="btn tiny" id="eb-chargers">${ICON.bolt}Ladestationen</button></div>` : ''}
    <div class="eb-charge"><span>Ladestand beim Start</span><input type="range" id="eb-charge" min="10" max="100" step="5" value="${b.charge}"><b id="eb-charge-v">${b.charge} %</b></div>`;
  $$('#ebike-card [data-assist]').forEach((x) => x.onclick = () => {
    settings.bike.assist = x.dataset.assist; saveSettings(); haptic(); renderEbikeCard();
  });
  const sl = $('#eb-charge');
  sl.oninput = () => { $('#eb-charge-v').textContent = `${sl.value} %`; };
  sl.onchange = () => { settings.bike.charge = +sl.value; saveSettings(); renderEbikeCard(); };
  $('#eb-chargers')?.addEventListener('click', showChargers);
  if (!res.ok) {
    const el = document.createElement('div');
    el.className = 'batt-empty-marker';
    el.innerHTML = ICON.bolt;
    emptyMarker = new maplibregl.Marker({ element: el }).setLngLat(pointAt(r, res.emptyAtM)).addTo(map);
  }
}

function pointAt(r, m) {
  let i = r.cum.findIndex((c) => c >= m);
  if (i < 0) i = r.cum.length - 1;
  return r.coords[i].slice(0, 2);
}

async function showChargers() {
  const r = route.data; if (!r) return;
  const res = simulate(r);
  const at = pointAt(r, res?.emptyAtM ? res.emptyAtM * 0.8 : r.total * 0.5);
  toast('Suche Ladestationen…');
  try {
    const list = await chargersNear(at, 5000);
    chargerMarkers.forEach((m) => m.remove()); chargerMarkers = [];
    if (!list.length) { toast('Keine Ladestationen in der Nähe gefunden – Cafés und Hütten fragen'); return; }
    for (const c of list) {
      const el = document.createElement('div');
      el.className = 'charger-marker';
      el.innerHTML = ICON.bolt;
      el.title = c.name;
      el.onclick = (e) => { e.stopPropagation(); toast(`${c.name}${c.fee === 'no' ? ' · kostenlos' : ''} – als Zwischenziel antippen & halten`); };
      chargerMarkers.push(new maplibregl.Marker({ element: el }).setLngLat(c.lngLat).addTo(map));
    }
    toast(`${list.length} Ladestationen gefunden`);
  } catch { toast('Ladestationen gerade nicht abrufbar'); }
}

function setDestination(lngLat, label) {
  plan.end = { lngLat, label };
  closeSheet('sheet-info');
  closeSheet('sheet-layers');
  selectTrail(null);
  $('#q').value = '';
  $('#q-clear').hidden = true;
  renderPlan();
  syncMarkers();
  openSheet('sheet-route');
  recompute();
}

function setStart(lngLat, label) {
  plan.start = { gps: false, lngLat, label };
  renderPlan();
  if (plan.end) { syncMarkers(); recompute(); }
  else toast('Startpunkt gesetzt – jetzt ein Ziel wählen');
}

function addVia(lngLat, label) {
  plan.vias.push({ lngLat, label });
  renderPlan(); syncMarkers(); recompute();
}

function clearPlan() {
  $('#offline-card').hidden = true;
  routeSeq++;
  plan.end = null; plan.vias = []; plan.start = { gps: true, lngLat: null, label: 'Mein Standort' };
  syncMarkers();
  clearRoute();
  elevMarker?.remove(); elevMarker = null;
  stopFlyover();
  $('#fly-bar').hidden = true;
}

async function recompute() {
  if (!plan.end) return;
  const my = ++routeSeq;
  let start = plan.start.gps ? loc.pos : plan.start.lngLat;
  if (!start) {
    start = [map.getCenter().lng, map.getCenter().lat];
    toast('Kein GPS – Kartenmitte als Start verwendet');
  }
  $('#route-loading').hidden = false;
  $('#route-error').hidden = true;
  $('#offline-card').hidden = true;
  $('#btn-go').disabled = true;
  $('#btn-fly').disabled = true; $('#btn-video').disabled = true;
  try {
    const r = await calcRoute([start, ...plan.vias.map((v) => v.lngLat), plan.end.lngLat]);
    if (my !== routeSeq) return;
    showRoute(r, { padding: { top: 120, bottom: Math.min(window.innerHeight * 0.62, 470), left: 50, right: 50 } });
    renderStats();
    requestAnimationFrame(() => drawElevation($('#elev'), r, onElevHover));
    $('#btn-go').disabled = false;
    $('#btn-fly').disabled = false; $('#btn-video').disabled = false;
    updateOfflineCard();
  } catch (e) {
    if (my !== routeSeq) return;
    console.warn(e);
    clearRoute();
    renderStats();
    drawElevation($('#elev'), null);
    const msg = String(e.message || e);
    $('#offline-card').hidden = true;
    $('#route-error').textContent = msg === 'offline'
      ? 'Offline – neue Routen brauchen Internet. Gespeicherte Touren findest du unter „Offline-Karten“.'
      : /abort/i.test(msg)
      ? 'Zeitüberschreitung – bitte erneut versuchen.'
      : /not mapped|position not/i.test(msg) ? 'Punkt liegt nicht an einem befahrbaren Weg.' : 'Route konnte nicht berechnet werden.';
    $('#route-error').hidden = false;
  } finally {
    if (my === routeSeq) $('#route-loading').hidden = true;
  }
}

function onElevHover(h) {
  const tip = $('#elev-tip');
  if (!h) { tip.hidden = true; elevMarker?.remove(); elevMarker = null; return; }
  tip.hidden = false;
  tip.style.left = `${h.x}px`;
  tip.textContent = `${fmtDist(h.d)} · ${Math.round(h.ele)} m · ${h.slope >= 0 ? '+' : ''}${h.slope.toFixed(1).replace('.', ',')} %`;
  if (!elevMarker) {
    const el = document.createElement('div');
    el.className = 'elev-dot';
    elevMarker = new maplibregl.Marker({ element: el }).setLngLat(h.point).addTo(map);
  } else elevMarker.setLngLat(h.point);
}

function wireRoutePlanner() {
  renderPlan();
  // ✕ verwirft die Route; Zurück oder Herunterwischen minimiert nur – die Route bleibt auf der Karte (wie Vorlage)
  let discardPlan = false;
  $('#rp-close').onclick = () => { discardPlan = true; closeSheet('sheet-route'); };
  $('#sheet-route').addEventListener('sheetclose', () => {
    if (!nav.active && !navStarting && discardPlan) clearPlan();
    else if (route.data && !nav.active) toast('Route bleibt auf der Karte – Pfeil-Knopf öffnet den Planer');
    discardPlan = false;
    updateHudRoute();
  });
  $('#rp-swap').onclick = () => {
    if (!plan.end) return;
    const startLL = plan.start.gps ? loc.pos : plan.start.lngLat;
    if (!startLL) { toast('Kein Startpunkt bekannt'); return; }
    const oldStart = plan.start;
    plan.start = { gps: false, lngLat: plan.end.lngLat, label: plan.end.label };
    plan.end = { lngLat: startLL, label: oldStart.gps ? 'Mein Standort' : oldStart.label };
    plan.vias.reverse();
    renderPlan(); syncMarkers(); recompute();
  };
  $('#rp-start').onclick = () => {
    if (!plan.start.gps) { plan.start = { gps: true, lngLat: null, label: 'Mein Standort' }; renderPlan(); syncMarkers(); recompute(); }
    else toast('Lang auf die Karte drücken, um einen anderen Start zu setzen');
  };
  $('#rp-end').onclick = () => { $('#q').focus(); };
  $('#rp-vias').onclick = (e) => {
    const d = e.target.closest('[data-del]');
    if (!d) return;
    plan.vias.splice(Number(d.dataset.del), 1);
    renderPlan(); syncMarkers(); recompute();
  };
  $('#rp-back').onclick = () => closeSheet('sheet-route');
  $('#rp-addvia').onclick = () => toast('Lang auf die Karte drücken und „Zwischenziel“ wählen');
  $('#pr-chip').onclick = (e) => { e.stopPropagation(); $('#pr-menu').hidden = !$('#pr-menu').hidden; };
  document.addEventListener('click', (e) => { if (!e.target.closest('#profile-row')) $('#pr-menu').hidden = true; });
  $('#pr-menu').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $('#pr-menu').hidden = true;
    if (b.dataset.gear) { openSheet('sheet-bike'); return; }
    if (b.dataset.p === settings.bike.type) return;
    selectBikeType(b.dataset.p);
  };
  $('#btn-fly').onclick = () => {
    if (!route.data) return;
    $('#sheet-route').classList.add('collapsed');
    $('#fly-bar').hidden = false;
    document.body.classList.add('flying');
    startFlyover(endFly);
    celebrate(countFlyover());
  };
  $('#fly-stop').onclick = () => { stopFlyover(); endFly(); };
  $('#vid-cancel').onclick = () => vidAbort?.abort();
  $('#btn-video').onclick = () => makeVideo({ title: plan.end?.label ? `Tour nach ${plan.end.label}` : 'Meine Tour in 3D' });
  $('#btn-go').onclick = beginNavigation;
  window.addEventListener('resize', debounce(() => { if (route.data) drawElevation($('#elev'), route.data, onElevHover); }, 200));
}

// ---------------------------------------------------------------------
// 3D-Flyover als Video (Reels/Stories/WhatsApp)
// ---------------------------------------------------------------------
let vidAbort = null;
async function makeVideo({ title, sub, restore } = {}) {
  if (!route.data) return;
  if (!videoSupported()) { toast('Video-Aufnahme wird auf diesem Gerät nicht unterstützt'); return; }
  const ov = $('#vid-overlay');
  ['sheet-route', 'sheet-ride', 'sheet-info'].forEach((id) => $(`#${id}`).classList.add('collapsed'));
  document.body.classList.add('flying', 'recording-video');
  ov.hidden = false;
  vidAbort = new AbortController();
  const arc = $('#vid-arc'), C = 2 * Math.PI * 19;
  arc.style.strokeDasharray = C;
  try {
    const res = await recordFlyover({
      title, sub: sub || `${fmtDist(route.data.total)} · ${route.data.hasEle ? '+' + Math.round(route.data.ascent || 0) + ' m' : ''}`,
      signal: vidAbort.signal,
      onProgress: (k) => { arc.style.strokeDashoffset = C * (1 - k); $('#vid-pct').textContent = `${Math.round(k * 100)} %`; }
    });
    ov.hidden = true;
    if (vidAbort.signal.aborted) { toast('Aufnahme abgebrochen'); return; }
    const how = await shareVideo(res);
    toast(how === 'downloaded' ? 'Video gespeichert' : 'Video bereit zum Teilen');
  } catch (e) {
    toast(e?.message || 'Video konnte nicht erstellt werden');
  } finally {
    ov.hidden = true;
    document.body.classList.remove('flying', 'recording-video');
    ['sheet-route', 'sheet-ride', 'sheet-info'].forEach((id) => $(`#${id}`).classList.remove('collapsed'));
    restore?.();
  }
}

function endFly() {
  $('#fly-bar').hidden = true;
  document.body.classList.remove('flying');
  $('#sheet-route').classList.remove('collapsed');
  if (route.data) map.fitBounds(bboxOf(route.data.coords), { padding: { top: 120, bottom: 420, left: 50, right: 50 }, pitch: 45, duration: 1500 });
}


// =====================================================================
// Mein Rad – individuelle Parameter
// =====================================================================
const BIKE_RANGES = [
  ['riderKg', 'Fahrergewicht', 35, 160, 1, (v) => `${v} kg`],
  ['bikeKg', 'Radgewicht', 5, 70, 1, (v) => `${v} kg`],
  ['luggageKg', 'Gepäck / Zuladung', 0, 80, 1, (v) => `${v} kg`],
  ['power', 'Deine Dauerleistung', 50, 350, 5, (v) => `${v} W`],
  ['support', 'Motorunterstützung', 0, 400, 10, (v) => (v ? `${v} W` : 'ohne')],
  ['maxSpeed', 'Höchstgeschwindigkeit', 15, 70, 1, (v) => `${v} km/h`]
];
const BIKE_TOGGLES = [
  ['avoidTraffic', ICON.shield, 'Verkehr meiden', 'Hauptstraßen umfahren'],
  ['preferCycleRoutes', ICON.bike, 'Radrouten bevorzugen', 'Beschilderten Routen folgen'],
  ['avoidSteep', ICON.up, 'Steile Anstiege meiden', 'Lieber Umweg als Rampe'],
  ['avoidSteps', ICON.trail, 'Treppen vermeiden', 'Wichtig mit Anhänger & Lastenrad'],
  ['preferUnpaved', ICON.mountain, 'Unbefestigte Wege bevorzugen', 'Gravel & MTB']
];

const TYPE_INFO = {
  trekking: 'Ausgewogen für Touren auf Radwegen und Nebenstraßen.',
  city: 'Komfortabel im Alltag, meidet Hauptverkehr.',
  road: 'Schnell auf Asphalt, glatte Beläge bevorzugt.',
  gravel: 'Schotter, Waldwege und Asphalt – vielseitig unterwegs.',
  mtb: 'Optimiert für MTB-Trails und anspruchsvolles Gelände.',
  ebike: 'Rückenwind per Motor – Steigungen werden kürzer.',
  emtb: 'Trails mit Motorunterstützung – auch steile Anstiege.',
  speed: 'Bis 45 km/h – bevorzugt Straßen, keine Radwege-Pflicht.',
  cargo: 'Breite, flache Wege ohne Treppen und Rampen.'
};
const TYRE_LABEL = { road: '28 mm', gravel: '40 mm', allround: '47 mm', balloon: '2.35"', knobby: '2.25"' };

function buildBikeSheet() {
  const b = settings.bike;
  $('#bike-body').innerHTML = `
    <div class="bike-stage" id="bike-stage">${bikeSvg(b.type)}</div>
    <div class="bike-label">Fahrradtyp</div>
    <div class="type-chips" id="type-chips">${BIKE_TYPES.map((t) => `<button class="${t.id === b.type ? 'on' : ''}" data-type="${t.id}">${t.name}</button>`).join('')}</div>
    <div class="kv-row"><span class="k">Reifenbreite</span>
      <select id="bike-tyre">${TYRES.map((t) => `<option value="${t.id}" ${t.id === b.tyre ? 'selected' : ''}>${TYRE_LABEL[t.id]} · ${t.name.split(' ')[0]}</option>`).join('')}</select></div>
    <div class="kv-row"><span class="k">Gewicht (kg)</span>
      <div class="stepper"><button data-step="-0.5" aria-label="weniger">${ICON.chevL}</button><b id="bike-kg"></b><button data-step="0.5" aria-label="mehr">${ICON.chevR}</button></div></div>
    <label class="kv-row"><span class="k">Aero-Setup</span>
      <span class="switch"><input type="checkbox" id="bike-aero" ${['aero', 'sport'].includes(b.aero) ? 'checked' : ''}><span></span></span></label>
    <div class="bike-info" id="bike-info"></div>

    <div class="bike-sec" id="bike-ebike">
      <div class="bike-label">Akku <span class="pro-badge">PRO</span></div>
      <div class="type-chips" id="batt-chips">${BATTERIES.map((w) => `<button data-batt="${w}" class="${w === b.batteryWh ? 'on' : ''}">${w} Wh</button>`).join('')}</div>
      <div class="bike-label sm">Standard-Unterstützung</div>
      <div class="seg" data-seg="assist">${ASSIST.map((a) => `<button class="${a.id === b.assist ? 'on' : ''}" data-v="${a.id}">${a.name}</button>`).join('')}</div>
    </div>

    <div class="bike-sec">
      <div class="bike-label">Wartung &amp; Verschleiß <span class="pro-badge">PRO</span></div>
      <div id="wear-list" class="wear-list"></div>
      <button class="adv-toggle" id="wear-add">${ICON.plus || '+'} Kilometer nachtragen</button>
    </div>

    <button class="adv-toggle" id="adv-toggle">Erweitert: Fahrer, Leistung & Wegewahl ${ICON.chevD}</button>
    <div class="adv" id="adv"><div>
      ${BIKE_RANGES.filter(([k]) => k !== 'bikeKg').map(([k, title, min, max, step, f]) => `
        <div class="range-row">
          <div class="top"><span>${title}</span><output data-bout="${k}">${f(b[k])}</output></div>
          <input type="range" data-bike="${k}" min="${min}" max="${max}" step="${step}" value="${b[k]}">
        </div>`).join('')}
      <div class="sec">Sitzposition</div>
      <div class="seg" data-seg="aero">${AERO.map((a) => `<button class="${a.id === b.aero ? 'on' : ''}" data-v="${a.id}">${a.name}</button>`).join('')}</div>
      <div class="sec">Wegewahl</div>
      ${BIKE_TOGGLES.map(([k, ic, t, sub]) => `
        <label class="row"><span class="ic">${ic}</span><span class="lbl"><b>${t}</b><small>${sub}</small></span>
        <span class="switch"><input type="checkbox" data-bike="${k}" ${b[k] ? 'checked' : ''}><span></span></span></label>`).join('')}
      <p class="hint">Gewicht, Leistung, Reifen und Sitzposition fließen in die Fahrzeit (BRouter-Physikmodell) ein. Radtyp und Wegewahl bestimmen, welche Wege bevorzugt werden.</p>
    </div></div>`;

  const body = $('#bike-body');
  body.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'bike-aero') {
      const t = settings.bike.type;
      setSetting('bike.aero', el.checked ? (t === 'road' || t === 'speed' ? 'aero' : 'sport') : (t === 'cargo' ? 'cargo' : 'upright'));
      buildBikeSheetValues();
      return;
    }
    if (el.id === 'bike-tyre') { setSetting('bike.tyre', el.value); return; }
    const k = el.dataset.bike;
    if (!k) return;
    if (el.type === 'checkbox') setSetting(`bike.${k}`, el.checked);
    else {
      const v = Number(el.value);
      const def = BIKE_RANGES.find((r) => r[0] === k);
      $(`output[data-bout="${k}"]`).textContent = def[5](v);
      setSetting(`bike.${k}`, v);
    }
  });
  body.addEventListener('click', (e) => {
    const t = e.target.closest('#type-chips button');
    if (t) { selectBikeType(t.dataset.type); return; }
    const bt = e.target.closest('[data-batt]');
    if (bt) { setSetting('bike.batteryWh', +bt.dataset.batt); $$('#batt-chips button').forEach((x) => x.classList.toggle('on', x === bt)); return; }
    const wr = e.target.closest('[data-wear-reset]');
    if (wr) { resetPart(wr.dataset.wearReset); renderWear(); toast('Zähler zurückgesetzt – gute Fahrt!'); return; }
    const ws = e.target.closest('[data-wear-shop]');
    if (ws) { window.open(ws.dataset.wearShop, '_blank'); return; }
    if (e.target.closest('#wear-add')) { askManualKm(); return; }
    const st = e.target.closest('[data-step]');
    if (st) {
      const v = Math.max(5, Math.min(70, Math.round((settings.bike.bikeKg + Number(st.dataset.step)) * 2) / 2));
      setSetting('bike.bikeKg', v);
      $('#bike-kg').textContent = String(v).replace('.', ',');
      return;
    }
    if (e.target.closest('#adv-toggle')) {
      $('#adv-toggle').classList.toggle('open');
      $('#adv').classList.toggle('open');
      return;
    }
    const segBtn = e.target.closest('.seg button');
    if (segBtn) {
      const key = segBtn.parentElement.dataset.seg;
      $$('button', segBtn.parentElement).forEach((x) => x.classList.toggle('on', x === segBtn));
      setSetting(`bike.${key}`, segBtn.dataset.v);
      buildBikeSheetValues();
    }
  });
  $('#bike-close').onclick = () => closeSheet('sheet-bike');
  $('#bike-save').onclick = () => { closeSheet('sheet-bike'); toast(`${bikeType().name} gespeichert`); };
  buildBikeSheetValues();
  updateBikeSummary();
}

function selectBikeType(id) {
  applyBikeType(id);
  setSetting('bike.type', id);  // speichert & löst Neuberechnung aus
  buildBikeSheetValues();
  renderPlan();
  const stage = $('#bike-stage');
  if (stage) stage.innerHTML = bikeSvg(id);
  toast(`${bikeType().name} gewählt`);
}

/** Werte im Sheet nach Änderungen aktualisieren */
function buildBikeSheetValues() {
  const b = settings.bike;
  $$('#type-chips button').forEach((x) => x.classList.toggle('on', x.dataset.type === b.type));
  // gewählten Radtyp in der wischbaren Reihe sichtbar halten (ohne die Seite zu scrollen)
  const row = $('#type-chips'), on = $('#type-chips .on');
  if (row && on) row.scrollTo({ left: Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2), behavior: 'smooth' });
  for (const [k, , , , , f] of BIKE_RANGES) {
    const inp = $(`input[data-bike="${k}"]`);
    if (inp) inp.value = b[k];
    const out = $(`output[data-bout="${k}"]`);
    if (out) out.textContent = f(b[k]);
  }
  for (const [k] of BIKE_TOGGLES) { const inp = $(`input[data-bike="${k}"]`); if (inp) inp.checked = !!b[k]; }
  $$('#bike-body .seg').forEach((seg) => $$('button', seg).forEach((x) => x.classList.toggle('on', x.dataset.v === b[seg.dataset.seg])));
  if ($('#bike-tyre')) $('#bike-tyre').value = b.tyre;
  if ($('#bike-kg')) $('#bike-kg').textContent = String(b.bikeKg).replace('.', ',');
  if ($('#bike-aero')) $('#bike-aero').checked = ['aero', 'sport'].includes(b.aero);
  if ($('#bike-ebike')) {
    $('#bike-ebike').hidden = !isEbike();
    $$('#batt-chips button').forEach((x) => x.classList.toggle('on', +x.dataset.batt === b.batteryWh));
  }
  renderWear();
}

// ---------------------------------------------------------------------
// Wartung & Verschleiß (Pro)
// ---------------------------------------------------------------------
function renderWear() {
  const el = $('#wear-list');
  updateWearDot();
  if (!el) return;
  el.innerHTML = wearStatus().map((p) => {
    const pct = Math.round(p.pct);
    const st = pct >= 100 ? 'due' : pct >= 90 ? 'soon' : 'ok';
    const info = p.months && p.pct >= 90 && p.km < p.interval * 0.9 ? 'jährlich fällig' : `${Math.round(p.km).toLocaleString('de-DE')} / ${p.interval.toLocaleString('de-DE')} km`;
    return `<div class="wear-row ${st}">
      <div class="wr-top"><b>${p.name}</b><small>${info}</small></div>
      <div class="wr-bar"><i style="width:${Math.min(100, pct)}%"></i></div>
      ${st !== 'ok' ? `<div class="wr-act"><span>${st === 'due' ? 'Wechsel fällig' : 'Bald fällig'}</span>
        ${p.q ? `<button class="btn tiny ghost" data-wear-shop="${esc(shopUrl(p))}">Teil finden</button>` : ''}
        <button class="btn tiny" data-wear-reset="${p.id}">Erneuert</button></div>` : ''}
    </div>`;
  }).join('');
}

function updateWearDot() {
  const n = dueCount();
  const dot = $('#wear-dot');
  if (dot) dot.hidden = n === 0;
  const td = $('#trophy-dot');
  if (n > 0 && td) td.hidden = false;
}

function onRideWear(result) {
  if (!result?.ride) return;
  const due = wearAddRide(result.ride, isEbike());
  updateWearDot();
  if (due.length) setTimeout(() => toast(`Wartung: ${due.map((d) => d.name).join(', ')} bald fällig`), 2500);
}

async function askManualKm() {
  const v = prompt('Wie viele Kilometer bist du ohne App gefahren?', '100');
  const km = Number(String(v || '').replace(',', '.'));
  if (!(km > 0)) return;
  addManualKm(Math.min(20000, km));
  renderWear();
  toast(`${Math.round(km)} km nachgetragen`);
}

function updateBikeSummary() {
  const s = bikeSummary();
  const t = bikeType();
  const kmh = s.kmh.toFixed(1).replace('.', ',');
  const info = $('#bike-info');
  if (info) info.innerHTML = `${ICON.gear}<div><b>${esc(TYPE_INFO[t.id] || '')}</b><small>${Math.round(s.mass)} kg gesamt · ${Math.round(s.power)} W · Profil ${brouterRequest().profile}</small></div><div class="kmh"><b>${kmh}</b><small>km/h Ø</small></div>`;
  if ($('#bike-row-sub')) $('#bike-row-sub').textContent = `${t.name} · Ø ${kmh} km/h`;
}

const recomputeSoon = debounce(() => { if (plan.end && !nav.active) recompute(); }, 700);
function onBikeChanged() {
  updateBikeSummary();
  recomputeSoon();
}



// =====================================================================
// Kartenstil – Vorschaubilder
// =====================================================================
const THUMB = {
  liberty:   { sky: ['#bfe3ff', '#eaf6ff'], far: '#7fa889', mid: '#5f9a4f', near: '#86c060', water: '#5fb7e8', road: '#fff6d8', snow: '#ffffff' },
  bright:    { sky: ['#fdf6e8', '#fdf6e8'], flat: true, bg: '#f6f1e4', park: '#cfe8b8', water: '#9fd3f2', road: '#f7c948', road2: '#ffffff' },
  positron:  { sky: ['#f4f4f4', '#f4f4f4'], flat: true, bg: '#eeeeee', park: '#e2e7df', water: '#d3dde3', road: '#ffffff', road2: '#ffffff' },
  dark:      { sky: ['#0d1626', '#0d1626'], flat: true, bg: '#121b2a', park: '#16243a', water: '#0a1220', road: '#3b82f6', road2: '#24406b', glow: true },
  fiord:     { sky: ['#4a6a8c', '#9bb6cf'], far: '#c9d8e6', mid: '#8eaac4', near: '#5c7d9c', water: '#3c5d7d', road: '#e9f0f6', snow: '#ffffff' },
  cyclosm:   { special: 'cyclosm' },
  satellite: { sky: ['#8fb8d8', '#d5e6f2'], far: '#56704a', mid: '#3f5c33', near: '#6b7d45', water: '#2f5f7a', road: '#d9c9a3', snow: '#f1f1f1', photo: true }
};

function styleThumb(id) {
  const p = THUMB[id];
  const trail = '<path d="M14 92 C 34 76, 52 84, 60 66 S 84 44, 98 30" fill="none" stroke="#8be13a" stroke-width="3.4" stroke-linecap="round"/>';
  if (p.special === 'cyclosm') {
    return `<svg viewBox="0 0 110 95"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b4f35a"/><stop offset="1" stop-color="#4fbf22"/></linearGradient></defs>
      <rect width="110" height="95" fill="url(#cg)"/>
      <g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="translate(26 26) scale(2.4)">
      <circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9 12 16.5h-1M15 9l-1.5-3H11"/></g></svg>`;
  }
  if (p.flat) {
    const glow = p.glow ? 'filter="url(#gw)"' : '';
    return `<svg viewBox="0 0 110 95"><defs><filter id="gw"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect width="110" height="95" fill="${p.bg}"/>
      <path d="M0 18 Q30 10 46 26 T110 22 V0 H0Z" fill="${p.park}"/>
      <path d="M62 70 q20 -10 48 -4 V95 H56 Z" fill="${p.water}"/>
      <path d="M-4 60 L114 38" stroke="${p.road}" stroke-width="5" ${glow}/>
      <path d="M30 -4 L46 100" stroke="${p.road}" stroke-width="4" ${glow}/>
      <path d="M0 82 L70 20 M80 95 L104 0 M8 30 L104 62" stroke="${p.road2}" stroke-width="1.6" opacity=".8" ${glow}/>
      <circle cx="44" cy="51" r="3.2" fill="${p.glow ? '#7cc4ff' : '#e2574c'}" ${glow}/></svg>`;
  }
  const grain = p.photo ? '<filter id="ph"><feTurbulence baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .25  0 0 0 0 .15  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' : '';
  return `<svg viewBox="0 0 110 95"><defs><linearGradient id="sk${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>${grain}</defs>
    <rect width="110" height="95" fill="url(#sk${id})"/>
    <path d="M0 40 L18 22 L30 32 L48 10 L66 30 L80 18 L110 38 V95 H0Z" fill="${p.far}"/>
    <path d="M44 14 L48 10 L52 14 L49 13Z" fill="${p.snow}"/><path d="M76 21 L80 18 L84 21Z" fill="${p.snow}"/>
    <path d="M0 58 Q20 40 40 52 T80 46 T110 54 V95 H0Z" fill="${p.mid}"/>
    <path d="M0 74 Q30 62 54 72 T110 70 V95 H0Z" fill="${p.near}"/>
    <ellipse cx="80" cy="80" rx="18" ry="5" fill="${p.water}"/>
    <path d="M-2 88 Q40 72 112 80" stroke="${p.road}" stroke-width="2" fill="none" opacity=".9"/>
    ${p.photo ? '<rect width="110" height="95" filter="url(#ph)" opacity=".6"/>' : ''}${trail}</svg>`;
}

function buildStyleSheet() {
  const names = { liberty: 'Liberty', bright: 'Bright', positron: 'Light / Positron', dark: 'Night / Dark', fiord: 'Fjord', cyclosm: 'CyclOSM (Radkarte)', satellite: 'Satellit' };
  $('#style-body').innerHTML = `
    <div class="style-grid">${MAP_STYLES.map((st, i) => `
      <button class="sg-card ${st.id === settings.style ? 'on' : ''}" data-id="${st.id}" style="--i:${i}">
        <div class="sg-thumb">${styleThumb(st.id)}</div>
        <span class="sg-check">${ICON.check}</span>
        <b>${names[st.id] || st.name}</b>
      </button>`).join('')}
      <label class="style-3d in-grid">
        <span class="lbl"><b>3D-Ansicht</b><small>Gelände & Gebäude</small></span>
        <span class="switch"><input type="checkbox" id="style-3d" ${settings.terrain && settings.buildings ? 'checked' : ''}><span></span></span>
      </label>
    </div>
    <button class="style-more" id="style-more">${ICON.gear}<span>Kartenansicht & Details</span>${ICON.chevR}</button>`;
  $('#style-body').addEventListener('click', (e) => {
    const c = e.target.closest('.sg-card');
    if (c && c.dataset.id !== settings.style) setSetting('style', c.dataset.id);
  });
  $('#style-more').onclick = () => { closeSheet('sheet-style'); setTimeout(() => openSheet('sheet-layers'), 180); };
  $('#style-3d').addEventListener('change', (e) => {
    const on = e.target.checked;
    setSetting('terrain', on);
    setSetting('buildings', on);
    $$('input[data-set="terrain"], input[data-set="buildings"]').forEach((x) => { x.checked = on; });
    if (on) { map.easeTo({ pitch: camPitch(), duration: 1200 }); glow3d(); }
  });
}

// =====================================================================
// Legende Radwege & Trails
// =====================================================================
function buildLegend() {
  const scale = ['S0 – leicht', 'S1 – leicht', 'S2 – mittel', 'S3 – anspruchsvoll', 'S4 – schwer', 'S5 – sehr schwer', 'S6 – extrem'];
  $('#lg-mtb').innerHTML = `<span class="lg-mtb-t">${ICON.bike}MTB</span>${ICON.chevD}`;
  $('#lg-mtb').classList.add('open');
  $('#lg-scale').innerHTML = scale.map((t, i) => `<div style="--i:${i}"><i style="--c:${C.mtb[i]}"></i>${t}</div>`).join('');
  $('#lg-mtb').onclick = () => {
    const sc = $('#lg-scale');
    sc.hidden = !sc.hidden;
    $('#lg-mtb').classList.toggle('open', !sc.hidden);
  };
}

// =====================================================================
// Karten-HUD (Höhe, Strecke, Zeit)
// =====================================================================
function hudElevation() {
  if (!map || !$('#hud-ele')) return;
  let ele = null, sub = 'Kartenmitte';
  const ex = settings.terrain ? currentExaggeration() : 1;
  try {
    const c = map.getCenter();
    const e = map.queryTerrainElevation ? map.queryTerrainElevation(c) : null;
    if (e != null && settings.terrain) ele = e / ex;
  } catch { /* kein Gelände */ }
  if (ele == null || Math.abs(ele) < 0.5) { $('#hud-ele-chip').hidden = true; return; }
  $('#hud-ele-chip').hidden = false;
  if (route.data?.hasEle) sub = `+${Math.round(route.data.ascent).toLocaleString('de-DE')} m`;
  countUp($('#hud-ele'), ele, (v) => `${Math.round(v).toLocaleString('de-DE')} m`, 600);
  $('#hud-ele-sub').textContent = sub;
  $('#hud-ele-sub').classList.toggle('up', !!route.data?.hasEle);
}

function updateHudRoute() {
  const r = route.data;
  $('#hud-dist-chip').hidden = !r;
  $('#hud-time-chip').hidden = !r;
  if (r) {
    countUp($('#hud-dist'), r.total, (v) => fmtDist(v));
    countUp($('#hud-time'), r.time, (v) => fmtDur(v));
  }
}

function wireHud() {
  map.on('moveend', debounce(hudElevation, 250));
  map.on('idle', hudElevation);
  setTimeout(hudElevation, 2500);
}

// =====================================================================
// Offline-Karten
// =====================================================================
const VECTOR_STYLE_URLS = MAP_STYLES.filter((s) => s.url).map((s) => s.url);
let savedHashes = new Set();
let ocState = 'idle';

async function refreshSavedHashes() {
  savedHashes = new Set((await listRegions()).map((r) => r.routeHash).filter(Boolean));
}

function updateNetChip() {
  const el = $('#net-chip');
  const restricted = !mapNetAllowed();
  el.hidden = !restricted;
  const txt = !isOnline() ? 'Offline · gespeicherte Karten'
    : settings.mapAccess === 'offline' ? 'Nur offline · gespeicherte Karten'
    : 'Mobile Daten · nur gespeicherte Karten';
  el.innerHTML = `${ICON.offline}${txt}`;
  document.body.classList.toggle('is-offline', restricted);
}

function setOcProgress(f) {
  $('#oc-bar').hidden = false;
  $('#oc-fill').style.width = `${Math.round(f * 100)}%`;
}

/** Offline-Karte in der Routenplanung aktualisieren */
function updateOfflineCard() {
  const card = $('#offline-card');
  const r = route.data;
  if (!r) { card.hidden = true; return; }
  card.hidden = false;
  if (ocState === 'busy') return;
  const saved = savedHashes.has(routeHash(r.coords));
  card.className = `offline-card ${saved ? 'done' : !mapNetAllowed() ? 'warn' : ''}`;
  $('#oc-bar').hidden = true;
  if (saved) {
    $('#oc-ic').innerHTML = ICON.check;
    $('#oc-title').textContent = 'Offline verfügbar';
    $('#oc-sub').textContent = 'Karte, 3D-Gelände, Trails und Route sind gespeichert.';
    $('#oc-btn').textContent = 'Verwalten';
  } else {
    const est = planTiles({ coords: r.coords });
    $('#oc-ic').innerHTML = ICON.cloud;
    $('#oc-title').textContent = mapNetAllowed() ? 'Für unterwegs offline speichern' : 'Karte für diese Tour fehlt offline';
    $('#oc-sub').textContent = `≈ ${fmtBytes(est.bytes)} · Karte, Gelände, Trails & Route`;
    $('#oc-btn').textContent = 'Speichern';
  }
}

async function confirmMobileData(bytes) {
  if (!settings.wifiOnly || net.type !== 'cellular') return true;
  const d = dialog({
    icon: ICON.cloud, title: 'Mobile Daten verwenden?',
    text: `Du bist nicht im WLAN. Der Download umfasst etwa ${fmtBytes(bytes)}.`,
    buttons: [{ label: 'Trotzdem laden', value: true, primary: true }, { label: 'Abbrechen', value: false }]
  });
  const res = await d; d.close();
  return res.value;
}

function routeRecord(r) {
  return {
    coords: r.coords, maneuvers: r.maneuvers, total: r.total, ascent: r.ascent, descent: r.descent,
    hasEle: r.hasEle, time: r.time, profile: r.profile
  };
}

function tourName() {
  const a = plan.start.gps ? 'Mein Standort' : plan.start.label;
  return `${a} → ${plan.end?.label || 'Ziel'}`;
}

/** Route speichern; onProgress(f) optional für Dialoge */
async function saveRouteOffline(onProgress) {
  const r = route.data;
  if (!r || isDownloading()) return null;
  const est = planTiles({ coords: r.coords });
  if (!(await confirmMobileData(est.bytes))) return null;
  ocState = 'busy';
  const card = $('#offline-card');
  card.className = 'offline-card busy';
  $('#oc-ic').innerHTML = ICON.cloud;
  $('#oc-title').textContent = 'Wird gespeichert …';
  $('#oc-btn').textContent = 'Abbrechen';
  setOcProgress(0);
  try {
    const lats = r.coords.map((c) => c[1]), lngs = r.coords.map((c) => c[0]);
    const pad = 0.02;
    const region = await downloadRegion({
      kind: 'route',
      name: tourName(),
      coords: r.coords,
      bbox: [[Math.min(...lngs) - pad, Math.min(...lats) - pad], [Math.max(...lngs) + pad, Math.max(...lats) + pad]],
      route: routeRecord(r),
      plan: { start: plan.start, end: plan.end, vias: plan.vias },
      routeHash: routeHash(r.coords),
      styleUrls: VECTOR_STYLE_URLS,
      onProgress: (p) => {
        const f = p.total ? p.done / p.total : 0;
        setOcProgress(f);
        onProgress?.(f, p);
        $('#oc-sub').textContent = p.phase === 'assets' ? 'Kartenstile & Schriften …'
          : p.phase === 'trails' ? 'Trails werden gespeichert …'
          : `${p.done} / ${p.total} Kacheln · ${fmtBytes(p.bytes)}`;
      }
    });
    await refreshSavedHashes();
    toast(region.failed ? `Gespeichert (${region.failed} Kacheln fehlen)` : 'Tour offline gespeichert');
    return region;
  } catch (e) {
    toast(/abgebrochen/.test(e.message) ? 'Download abgebrochen' : 'Speichern fehlgeschlagen – Verbindung prüfen');
    return null;
  } finally {
    ocState = 'idle';
    updateOfflineCard();
  }
}

/** Vor dem Tourstart aktiv anbieten, die Karte zu speichern (abschaltbar) */
async function offerOfflineBeforeStart() {
  const r = route.data;
  if (!settings.offlinePrompt || !isOnline() || savedHashes.has(routeHash(r.coords))) return true;
  const est = planTiles({ coords: r.coords });
  const d = dialog({
    icon: ICON.cloud,
    title: 'Karte für unterwegs speichern?',
    text: `Im Wald oder am Berg reißt der Empfang oft ab. Gespeichert bleiben Karte, 3D-Gelände, Trails und Route ohne Netz verfügbar (≈ ${fmtBytes(est.bytes)}).`,
    buttons: [
      { label: 'Speichern & losfahren', value: 'save', primary: true },
      { label: 'Ohne Speichern starten', value: 'skip' }
    ],
    checkbox: 'Nicht mehr fragen'
  });
  const res = await d;
  if (res.checked) setSetting('offlinePrompt', false);
  if (res.value === 'save') {
    d.setText('Wird gespeichert …');
    d.setButtons([{ label: 'Abbrechen und ohne starten', value: 'cancel' }]);
    d.then(() => {}); // Promise bereits erfüllt
    const act = $('#dlg-actions');
    act.onclick = () => cancelDownload();
    d.setProgress(0);
    await saveRouteOffline((f, p) => {
      d.setProgress(f);
      d.setText(p.phase === 'tiles' ? `${p.done} von ${p.total} Kacheln · ${fmtBytes(p.bytes)}` : 'Kartenstile, Schriften & Trails …');
    });
  }
  d.close();
  return true;
}

// ---------- Verwaltung ----------
function areaEstimate() {
  const b = map.getBounds();
  const bbox = [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]];
  return { bbox, ...planTiles({ bbox }) };
}

async function renderOfflineSheet() {
  const regions = await listRegions();
  const st = await storageInfo();
  const est = areaEstimate();
  const tooBig = est.count > AREA_MAX_TILES;
  const fmtDate = (t) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  $('#offline-body').innerHTML = `
    ${!isOnline() ? `<div class="offline-card warn"><span class="oc-ic">${ICON.offline}</span><div class="oc-txt"><b>Du bist offline</b><small>Gespeicherte Gebiete und Touren funktionieren weiter. Höhenlinien, Suche und neue Routen brauchen Internet.</small></div></div>` : ''}
    <div class="sec">Kartenzugriff</div>
    <div class="seg access-seg" id="access-seg">
      ${Object.entries(MAP_ACCESS).map(([k, v]) => `<button data-acc="${k}" class="${settings.mapAccess === k ? 'on' : ''}">${v.name}</button>`).join('')}
    </div>
    <p class="hint" id="access-hint">${MAP_ACCESS[settings.mapAccess].hint}</p>

    <div class="sec">Speicher</div>
    <div class="store-bar"><div class="oc-bar"><i style="width:${st.quota ? Math.min(100, (st.used / st.quota) * 100).toFixed(1) : 0}%"></i></div></div>
    <div class="store-meta"><span>${fmtBytes(st.used)} belegt</span><span>${st.quota ? fmtBytes(st.quota) + ' verfügbar' : ''}</span></div>

    <div class="sec">Kartenausschnitt</div>
    <div class="area-card">
      <b>Aktuellen Ausschnitt speichern</b>
      <p>${tooBig ? `Der Ausschnitt ist zu groß (${est.count} Kacheln). Bitte näher heranzoomen.` : `Ideal vor der Tourenplanung: Karte, 3D-Gelände und Trails dieses Gebiets bis Zoomstufe 14 · ≈ ${fmtBytes(est.bytes)}`}</p>
      <button class="btn primary" id="area-save" ${tooBig || !isOnline() || isDownloading() ? 'disabled' : ''}>${ICON.cloud}<span>Ausschnitt speichern</span></button>
      <div class="oc-bar" id="area-bar" hidden><i id="area-fill"></i></div>
      <small class="store-meta" id="area-status"></small>
    </div>

    <div class="sec">Gespeichert</div>
    <div id="region-list">${regions.length ? regions.map((r) => `
      <div class="region" data-id="${r.id}">
        <span class="ic">${r.kind === 'route' ? ICON.nav : ICON.layers}</span>
        <span class="lbl"><b>${esc(r.name)}</b><small>${r.kind === 'route' ? 'Tour' : 'Gebiet'} · ${fmtBytes(r.bytes)} · ${fmtDate(r.created)}</small></span>
        ${r.kind === 'route' ? `<button class="rb" data-a="open" aria-label="Tour öffnen">${ICON.fly}</button>` : ''}
        <button class="rb" data-a="show" aria-label="Zeigen">${ICON.zoom}</button>
        <button class="rb del" data-a="del" aria-label="Löschen">${ICON.trash}</button>
      </div>`).join('') : '<p class="empty-note">Noch nichts gespeichert. Speichere einen Ausschnitt oder nach der Routenplanung die Tour.</p>'}</div>

    <div class="sec">Einstellungen</div>
    ${toggleRow('offlinePrompt', ICON.cloud, 'Vor Tourstart anbieten', 'Fragt vor der Navigation, ob die Karte gespeichert werden soll')}
    ${toggleRow('wifiOnly', ICON.globe, 'Mobile Daten nur nach Rückfrage', 'Downloads ohne WLAN bestätigen')}
    <p class="hint">Offline gespeichert werden die Vektorkarte (für alle Stile außer CyclOSM und Satellit), das Höhenmodell für 3D und Schummerung, Trails sowie die Tour selbst. Höhenlinien werden live berechnet und brauchen Internet.</p>`;
}

async function openOfflineSheet() {
  await renderOfflineSheet();
  openSheet('sheet-offline');
}

async function loadSavedTour(region) {
  const r = { ...region.route };
  r.cum = cumulative(r.coords);
  r.total = r.cum[r.cum.length - 1];
  plan.start = region.plan?.start || { gps: true, lngLat: null, label: 'Mein Standort' };
  plan.end = region.plan?.end || { lngLat: r.coords[r.coords.length - 1], label: 'Ziel' };
  plan.vias = region.plan?.vias || [];
  routeSeq++;
  closeSheet('sheet-offline');
  renderPlan();
  syncMarkers();
  openSheet('sheet-route');
  $('#route-error').hidden = true;
  $('#route-loading').hidden = true;
  showRoute(r, { padding: { top: 120, bottom: Math.min(window.innerHeight * 0.62, 470), left: 50, right: 50 } });
  renderStats();
  requestAnimationFrame(() => drawElevation($('#elev'), r, onElevHover));
  $('#btn-go').disabled = false;
  $('#btn-fly').disabled = false; $('#btn-video').disabled = false;
  updateOfflineCard();
}

function wireOffline() {
  updateNetChip();
  refreshSavedHashes();
  storedTrails().then((list) => list.forEach(({ region, data }) => ingestTrails(data, region.bbox)));
  onNetChange(() => {
    if (effectiveStyleId(settings.style) !== activeStyleId) switchStyle(settings.style);
    else swapDem();
    updateNetChip();
    applyDetailVisibility();
    updateOfflineCard();
    if (isOnline()) { refreshTrails(); toast('Wieder online'); }
    else toast('Offline – gespeicherte Karten werden genutzt', 3500);
    if (isSheetOpen('sheet-offline')) renderOfflineSheet();
  });
  $('#net-chip').onclick = () => openOfflineSheet();
  $('#btn-offline').onclick = () => (isSheetOpen('sheet-offline') ? closeSheet('sheet-offline') : openOfflineSheet());
  $('#offline-close').onclick = () => closeSheet('sheet-offline');
  map.on('moveend', debounce(() => { if (isSheetOpen('sheet-offline') && !isDownloading()) renderOfflineSheet(); }, 500));

  $('#oc-btn').onclick = () => {
    if (ocState === 'busy') { cancelDownload(); return; }
    if (route.data && savedHashes.has(routeHash(route.data.coords))) { openOfflineSheet(); return; }
    if (!isOnline()) { toast('Zum Speichern wird Internet benötigt'); return; }
    saveRouteOffline();
  };

  const body = $('#offline-body');
  body.addEventListener('input', (e) => {
    const path = e.target.dataset.set;
    if (path && e.target.type === 'checkbox') setSetting(path, e.target.checked);
  });
  body.addEventListener('click', async (e) => {
    const acc = e.target.closest('[data-acc]');
    if (acc) { if (acc.dataset.acc !== settings.mapAccess) setSetting('mapAccess', acc.dataset.acc); return; }
    if (e.target.closest('#area-save')) {
      const est = areaEstimate();
      if (!(await confirmMobileData(est.bytes))) return;
      const btn = $('#area-save');
      btn.disabled = true;
      $('#area-bar').hidden = false;
      const c = map.getCenter();
      const label = (await reverseGeocode([c.lng, c.lat])) || 'Kartenausschnitt';
      try {
        const region = await downloadRegion({
          kind: 'area', name: `Gebiet ${label}`, bbox: est.bbox, styleUrls: VECTOR_STYLE_URLS,
          onProgress: (p) => {
            $('#area-fill').style.width = `${Math.round((p.total ? p.done / p.total : 0) * 100)}%`;
            $('#area-status').textContent = p.phase === 'tiles' ? `${p.done} / ${p.total} Kacheln · ${fmtBytes(p.bytes)}` : p.phase === 'trails' ? 'Trails …' : 'Kartenstile & Schriften …';
          }
        });
        ingestTrails((await storedTrails()).find((t) => t.region.id === region.id)?.data, region.bbox);
        toast('Gebiet offline gespeichert');
      } catch (err) {
        toast(/abgebrochen/.test(err.message) ? 'Download abgebrochen' : 'Speichern fehlgeschlagen');
      }
      renderOfflineSheet();
      return;
    }
    const btn = e.target.closest('.rb');
    if (!btn) return;
    const id = btn.closest('.region').dataset.id;
    const region = (await listRegions()).find((r) => r.id === id);
    if (!region) return;
    if (btn.dataset.a === 'show') {
      closeSheet('sheet-offline');
      map.fitBounds(region.bbox, { padding: 50, pitch: map.getPitch(), duration: 1400 });
    } else if (btn.dataset.a === 'open') {
      loadSavedTour(region);
    } else if (btn.dataset.a === 'del') {
      const d = dialog({ icon: ICON.trash, title: 'Löschen?', text: `„${region.name}“ (${fmtBytes(region.bytes)}) wird vom Gerät entfernt.`, buttons: [{ label: 'Löschen', value: true, danger: true }, { label: 'Abbrechen', value: false }] });
      const res = await d; d.close();
      if (!res.value) return;
      await deleteRegion(id);
      await refreshSavedHashes();
      updateOfflineCard();
      renderOfflineSheet();
    }
  });
}


// =====================================================================
// Freie Fahrt aufzeichnen
// =====================================================================
let rideTimer = null;

async function startFreeRide() {
  const ok = await startLocation();
  if (!ok) { toast('Für die Aufzeichnung wird der Standort benötigt'); return; }
  startRide('free');
  document.body.classList.add('recording');
  $('#rec-label').textContent = 'Aufzeichnung beenden';
  $('#ride-hud').hidden = false;
  followMode = true;
  $('#btn-locate').classList.add('tracking');
  if (loc.pos) map.easeTo({ center: loc.pos, zoom: Math.max(map.getZoom(), 15.5), pitch: camPitch(), duration: 1200 });
  if (settings.keepAwake) import('@capacitor-community/keep-awake').then((m) => m.KeepAwake.keepAwake()).catch(() => {});
  const t0 = Date.now();
  clearInterval(rideTimer);
  rideTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    $('#ride-clock').textContent = h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
  }, 1000);
  toast('Aufzeichnung gestartet');
}

function stopFreeRide(showSummary = true) {
  clearInterval(rideTimer);
  document.body.classList.remove('recording');
  $('#rec-label').textContent = 'Fahrt aufzeichnen';
  $('#ride-hud').hidden = true;
  import('@capacitor-community/keep-awake').then((m) => m.KeepAwake.allowSleep()).catch(() => {});
  const result = finishRide();
  onRideWear(result);
  if (!showSummary) return;
  if (!result) { toast('Fahrt zu kurz – nicht gespeichert'); return; }
  showRideSummary(result.ride, result.unlocked);
}

// =====================================================================
// Meilensteine
// =====================================================================
const TIER_NAME = ['Gesperrt', 'Bronze', 'Silber', 'Gold'];
const TIER_ID = ['none', 'bronze', 'silver', 'gold'];
const catOf = (id) => MS_CATS.find((c) => c.id === id);
let msTab = 'ms', msCat = 'all';

function updateTrophyDot() {
  const ev = evaluate(stats);
  const total = Object.values(ev).reduce((a, x) => a + x.tier, 0);
  $('#trophy-dot').hidden = total === 0;
}

function renderMilestones() {
  const ev = evaluate(stats);
  const c = medalCounts(ev);
  const done = Object.values(ev).reduce((a, x) => a + x.tier, 0);
  const hours = stats.totalTimeH;
  let html = `
    <div class="ms-summary">
      <div class="ms-count">${medalSvg(3, 'trophy', '#e0a51c', 44)}<b>${c.gold}</b><small>Gold</small></div>
      <div class="ms-count">${medalSvg(2, 'trophy', '#8e9aa6', 44)}<b>${c.silver}</b><small>Silber</small></div>
      <div class="ms-count">${medalSvg(1, 'trophy', '#b8682e', 44)}<b>${c.bronze}</b><small>Bronze</small></div>
      <div class="ms-total"><div class="row2"><span>${done} von 150 Stufen</span><span>${Math.round((done / 150) * 100)} %</span></div>
        <div class="ms-bar" style="--i:0"><i style="width:${(done / 150) * 100}%"></i></div></div>
    </div>
    <div class="ms-totals">
      <div><b>${fmtValue({ unit: 'km' }, stats.totalKm)}</b><small>gesamt</small></div>
      <div><b>${Math.round(stats.totalHm).toLocaleString('de-DE')} hm</b><small>bergauf</small></div>
      <div><b>${stats.rides}</b><small>Fahrten</small></div>
      <div><b>${hours < 10 ? hours.toFixed(1).replace('.', ',') : Math.round(hours)} h</b><small>im Sattel</small></div>
    </div>
    <div class="ms-tabs"><button data-tab="ms" class="${msTab === 'ms' ? 'on' : ''}">Meilensteine</button><button data-tab="rides" class="${msTab === 'rides' ? 'on' : ''}">Fahrten (${rides.length})</button></div>`;
  if (msTab === 'ms') {
    html += `<div class="ms-cats"><button data-cat="all" class="${msCat === 'all' ? 'on' : ''}">Alle 50</button>${MS_CATS.map((k) => `<button data-cat="${k.id}" style="--c:${k.color}" class="${msCat === k.id ? 'on' : ''}">${k.name}</button>`).join('')}</div>`;
    let i = 0;
    for (const k of MS_CATS) {
      if (msCat !== 'all' && msCat !== k.id) continue;
      const list = MILESTONES.filter((m) => m.cat === k.id);
      html += `<div class="ms-cat-title" style="--c:${k.color}"><i></i>${k.name}</div><div class="ms-grid">${list.map((m) => {
        const { value, tier } = ev[m.id];
        const next = tier < 3 ? m.t[tier] : null;
        return `<button class="ms-card t${tier}" data-ms="${m.id}" style="--i:${i++}">
          ${medalSvg(tier, m.icon, k.color, 58)}
          <b>${esc(m.name)}</b>
          <div class="ms-bar ${TIER_ID[Math.min(3, tier + 1)]}"><i style="width:${progress(m, value) * 100}%"></i></div>
          <small>${tier >= 3 ? 'Gold ✓' : `${fmtValue(m, value)} / ${fmtValue(m, next)}`}</small>
        </button>`;
      }).join('')}</div>`;
    }
  } else {
    html += rides.length ? rides.map((r, i) => {
      const d = new Date(r.start);
      return `<button class="ride-item" data-ride="${i}" style="animation-delay:${i * 40}ms">
        <span class="ri-ic">${r.mode === 'nav' ? ICON.nav : ICON.bike}</span>
        <span class="lbl"><b>${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</b>
        <small>${fmtDur(r.movingS)} · +${Math.round(r.ascent)} hm · max ${Math.round(r.maxKmh)} km/h</small></span>
        <span class="km">${fmtDist(r.km * 1000)}</span>
      </button>`;
    }).join('') : `<div class="ms-empty">${ICON.bike}<br>Noch keine Fahrten.<br>Starte eine Navigation oder tippe auf den roten Aufnahme-Knopf.</div>`;
  }
  $('#ms-body').innerHTML = html;
  const on = $('.ms-cats button.on');
  if (on) { const box = on.parentElement; box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2; }
}

function showMilestoneDetail(id) {
  const m = MILESTONES.find((x) => x.id === id);
  const ev = evaluate(stats)[id];
  const k = catOf(m.cat);
  $('#ms-detail-card').innerHTML = `
    ${medalSvg(ev.tier, m.icon, k.color, 110)}
    <div class="cat" style="color:${k.color}">${esc(k.name)}</div>
    <h3>${esc(m.name)}</h3>
    <p>${esc(m.desc)}</p>
    <div class="cur">Dein Wert: ${fmtValue(m, ev.value)}</div>
    ${[1, 2, 3].map((t) => `<div class="tier-row ${ev.tier >= t ? 'done' : ''}">${medalSvg(ev.tier >= t ? t : 0, m.icon, k.color, 30)}<span class="tn">${TIER_NAME[t]}</span><span class="tv">${ev.tier >= t ? '✓ ' : ''}${fmtValue(m, m.t[t - 1])}</span></div>`).join('')}
    <button class="btn ghost" id="ms-detail-close">Schließen</button>`;
  $('#ms-detail').hidden = false;
}

// ---------- Fahrt-Zusammenfassung ----------
function showRideSummary(r, unlocked = []) {
  const d = new Date(r.start);
  $('#ride-title').textContent = unlocked?.length !== undefined && r === rides[0] ? 'Fahrt beendet' : d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const total = Math.max(0.001, Object.values(r.surf || {}).reduce((a, b) => a + b, 0));
  const SURF = [['cycleway', 'Radweg', '#5fd12f'], ['track', 'Wald-/Feldweg', '#3b82f6'], ['path', 'Pfad', '#facc15'], ['mtb', 'MTB-Trail', '#ef4444'], ['road', 'Straße', '#9aa5ae']];
  const tiles = [
    [ICON.clock, fmtDur(r.movingS), 'Fahrzeit'], [ICON.fast, `${r.avgKmh.toFixed(1).replace('.', ',')} km/h`, 'Schnitt'], [ICON.gauge, `${Math.round(r.maxKmh)} km/h`, 'Höchstwert'],
    [ICON.up, `${Math.round(r.ascent)} hm`, 'Anstieg'], [ICON.down, `${Math.round(r.descent)} hm`, 'Abstieg'], [ICON.peaks, r.maxAlt ? `${Math.round(r.maxAlt)} m` : '–', 'Höchster Punkt']
  ];
  $('#ride-body').innerHTML = `
    <div class="rs-hero"><div class="big">${fmtDist(r.km * 1000)}</div><small>${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · ${esc(bikeTypeName(r.bikeType))}</small></div>
    <div class="rs-grid">${tiles.map(([ic, v, l], i) => `<div style="--i:${i}">${ic}<b>${v}</b><small>${l}</small></div>`).join('')}</div>
    <div class="rs-elev"><canvas id="ride-elev"></canvas></div>
    <div class="sec">Untergrund</div>
    <div class="surf-bar">${SURF.map(([k, , c]) => `<i style="width:${((r.surf?.[k] || 0) / total) * 100}%;background:${c}"></i>`).join('')}</div>
    <div class="surf-legend">${SURF.filter(([k]) => (r.surf?.[k] || 0) > 0.01).map(([k, n, c]) => `<span style="--c:${c}">${n} ${fmtDist((r.surf[k] || 0) * 1000)}</span>`).join('')}</div>
    ${unlocked?.length ? `<div class="sec">Neue Meilensteine (${uniqBest(unlocked).length})</div><div class="rs-medals">${uniqBest(unlocked).map((u, i) => `<div style="--i:${i}">${medalSvg(u.tier, u.m.icon, catOf(u.m.cat).color, 56)}<b>${esc(u.m.name)}</b><small>${TIER_NAME[u.tier]}</small></div>`).join('')}</div>` : ''}
    <button class="btn video-cta" id="rs-video">${ICON.film || ICON.fly}<span>Als 3D-Video teilen</span><span class="pro-badge">PRO</span></button>
    <div class="actions"><button class="btn ghost" id="rs-ms">${ICON.trophy}<span>Meilensteine</span></button><button class="btn primary" id="rs-done">Fertig</button></div>`;
  ['sheet-route', 'sheet-info', 'sheet-ms'].forEach(closeSheet);
  openSheet('sheet-ride');
  const er = rideElevationRoute(r);
  requestAnimationFrame(() => drawElevation($('#ride-elev'), er, null));
  $('#rs-done').onclick = () => closeSheet('sheet-ride');
  $('#rs-video').hidden = !er;
  $('#rs-video').onclick = () => {
    const prev = route.data;
    let up = 0; for (let i = 1; i < er.coords.length; i++) up += Math.max(0, er.coords[i][2] - er.coords[i - 1][2]);
    showRoute({ ...er, ascent: r.ascent || up, time: r.movingS || 0, maneuvers: [] }, { animate: false, fit: false });
    makeVideo({ title: d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }), restore: () => showRoute(prev, { animate: false, fit: false }) });
  };
  $('#rs-ms').onclick = () => { closeSheet('sheet-ride'); msTab = 'ms'; renderMilestones(); openSheet('sheet-ms'); };
  if (unlocked?.length) setTimeout(() => celebrate(unlocked), 700);
  updateTrophyDot();
}

function uniqBest(list) {
  const best = new Map();
  for (const u of list || []) if (!best.has(u.m.id) || best.get(u.m.id).tier < u.tier) best.set(u.m.id, u);
  return [...best.values()].sort((a, b) => b.tier - a.tier);
}

function bikeTypeName(id) {
  return (BIKE_TYPES.find((t) => t.id === id) || {}).name || 'Fahrrad';
}

// ---------- Feier ----------
let celQueue = [];
let confettiRaf = null;

function confetti(tier) {
  const cv = $('#confetti');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = tier === 3 ? ['#ffe58a', '#ffd34d', '#e0a51c', '#8be13a', '#ffffff'] : tier === 2 ? ['#ffffff', '#cfd8e0', '#8e9aa6', '#8be13a'] : ['#ffd0a0', '#d98c4a', '#8a4b1f', '#8be13a'];
  const parts = Array.from({ length: settings.animations ? 150 : 40 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 60, y: innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4, r: 3 + Math.random() * 5,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], shape: Math.random() < 0.5
  }));
  cancelAnimationFrame(confettiRaf);
  const t0 = performance.now();
  const tick = (t) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.shape) ctx.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    if (t - t0 < 4200) confettiRaf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  confettiRaf = requestAnimationFrame(tick);
}

function showNextCelebration() {
  const u = celQueue.shift();
  const wrap = $('#celebrate');
  if (!u) { wrap.hidden = true; cancelAnimationFrame(confettiRaf); return; }
  const k = catOf(u.m.cat);
  wrap.className = `celebrate ${TIER_ID[u.tier]}`;
  const medal = $('#cel-medal');
  medal.innerHTML = medalSvg(u.tier, u.m.icon, k.color, 150);
  const tierEl = $('#cel-tier');
  tierEl.className = `cel-tier ${TIER_ID[u.tier]}`;
  tierEl.textContent = `${TIER_NAME[u.tier]} erreicht`;
  $('#cel-name').textContent = u.m.name;
  $('#cel-desc').textContent = `${u.m.desc}: ${fmtValue(u.m, u.m.t[u.tier - 1])}`;
  $('#cel-count').textContent = celQueue.length ? `Noch ${celQueue.length} weitere` : '';
  $('#cel-next').textContent = celQueue.length ? 'Weiter' : 'Super!';
  // Animationen neu starten
  [...wrap.querySelectorAll('.cel-card > *')].forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  wrap.hidden = false;
  confetti(u.tier);
  import('@capacitor/haptics').then((h) => h.Haptics.notification({ type: 'SUCCESS' })).catch(() => {});
  if (settings.voice && !nav.active) speak(`${TIER_NAME[u.tier]}: ${u.m.name}`);
}

function celebrate(list) {
  if (!list?.length) return;
  // pro Meilenstein nur die höchste neue Stufe feiern
  const best = new Map();
  for (const u of list) if (!best.has(u.m.id) || best.get(u.m.id).tier < u.tier) best.set(u.m.id, u);
  const sorted = [...best.values()].sort((a, b) => b.tier - a.tier);
  const wasIdle = $('#celebrate').hidden;
  celQueue.push(...sorted);
  if (wasIdle) showNextCelebration();
  updateTrophyDot();
}

let bannerT;
function liveBanner(u) {
  const el = $('#ms-banner');
  const k = catOf(u.m.cat);
  el.classList.remove('out');
  el.innerHTML = `${medalSvg(u.tier, u.m.icon, k.color, 42)}<div><b>${TIER_NAME[u.tier]} · ${esc(u.m.name)}</b><small>${fmtValue(u.m, u.m.t[u.tier - 1])} erreicht – wird nach der Fahrt gefeiert</small></div>`;
  el.hidden = false;
  clearTimeout(bannerT);
  bannerT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 400); }, 3800);
  import('@capacitor/haptics').then((h) => h.Haptics.impact({ style: 'MEDIUM' })).catch(() => {});
}

function wireMilestones() {
  initRecorder();
  set_icons();
  updateTrophyDot();
  $('#btn-trophy').onclick = () => {
    if (isSheetOpen('sheet-ms')) { closeSheet('sheet-ms'); return; }
    ['sheet-layers', 'sheet-style', 'sheet-offline', 'sheet-bike'].forEach(closeSheet);
    renderMilestones();
    openSheet('sheet-ms');
  };
  $('#ms-close').onclick = () => closeSheet('sheet-ms');
  $('#ride-close').onclick = () => closeSheet('sheet-ride');
  $('#ms-body').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { msTab = tab.dataset.tab; renderMilestones(); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) { msCat = cat.dataset.cat; renderMilestones(); return; }
    const card = e.target.closest('[data-ms]');
    if (card) { showMilestoneDetail(card.dataset.ms); return; }
    const ri = e.target.closest('[data-ride]');
    if (ri) { showRideSummary(rides[Number(ri.dataset.ride)], null); }
  });
  $('#ms-detail').addEventListener('click', (e) => {
    if (e.target.id === 'ms-detail' || e.target.closest('#ms-detail-close')) $('#ms-detail').hidden = true;
  });
  $('#cel-next').onclick = showNextCelebration;
  $('#btn-rec').onclick = () => (rec.active ? stopFreeRide() : startFreeRide());
  $('#ride-stop').onclick = () => stopFreeRide();

  let lastLiveCheck = 0;
  onRecord((type, r) => {
    if (type !== 'update' || !r) return;
    if (r.mode === 'free') {
      $('#ride-speed').textContent = Math.round(r.kmh || 0);
      $('#ride-km').textContent = fmtDist(r.km * 1000);
      $('#ride-max').textContent = Math.round(r.maxKmh || 0);
      $('#ride-asc').textContent = `+${Math.round(r.ascent)} hm`;
    }
    if (Date.now() - lastLiveCheck > 10000) {
      lastLiveCheck = Date.now();
      const live = liveUnlocks();
      live.forEach((u, i) => setTimeout(() => liveBanner(u), i * 4300));
    }
  });
}

function set_icons() {
  $('#ms-close').innerHTML = ICON.close;
  $('#ride-close').innerHTML = ICON.close;
  $('#btn-trophy .mm-ic').innerHTML = ICON.trophy;
  $('#ride-stop').innerHTML = ICON.stop;
  $('#rt-speed-ic').innerHTML = ICON.gauge;
  $('#rt-dist-ic').innerHTML = ICON.routeIc;
  $('#rt-max-ic').innerHTML = ICON.fast;
}

// =====================================================================
// Navigation
// =====================================================================
function updateVoiceBtn() {
  const b = $('#nav-voice');
  if (b) b.innerHTML = settings.voice ? ICON.sound : ICON.mute;
}

let lastManeuverKey = '';

/** Straßennummer (z. B. „B307“) am Abbiegepunkt aus der Karte lesen – gelbes Schild wie in der Vorlage */
function showRoadRef(m) {
  const badge = $('#nav-badge');
  badge.hidden = true;
  try {
    const c = route.data?.coords?.[Math.min(m.idx + 2, route.data.coords.length - 1)];
    if (!c || m.type === 'arrive') return;
    const p = map.project(c);
    const feats = map.queryRenderedFeatures([[p.x - 28, p.y - 28], [p.x + 28, p.y + 28]]);
    const f = feats.find((x) => x.properties?.ref && /^[ABKLSE]\s?\d/.test(x.properties.ref));
    if (f) { badge.textContent = String(f.properties.ref).split(';')[0].replace(/\s+/g, ''); badge.hidden = false; }
  } catch { /* Karte noch nicht bereit */ }
}
let arrivedOnce = false;
const navUi = {
  update({ m, distTo, next, remaining, speed, eta, onRoute }) {
    const icon = $('#nav-icon');
    const key = `${m.idx}|${m.type}|${onRoute}`;
    if (key !== lastManeuverKey) {
      lastManeuverKey = key;
      icon.innerHTML = maneuverSvg(m.type, m.angle, m.exit);
      const main = $('#nav-main');
      main.classList.remove('swap'); void main.offsetWidth; main.classList.add('swap');
      showRoadRef(m);
    }
    icon.classList.toggle('pulse', distTo < 60 && m.type !== 'arrive');
    $('#nav-dist').textContent = fmtDist(distTo);
    const txt = m.text.charAt(0).toUpperCase() + m.text.slice(1);
    $('#nav-instr').textContent = onRoute ? txt : 'Zur Route zurückkehren';
    const then = $('#nav-then');
    if (next) { then.innerHTML = `Danach ${maneuverSvg(next.type, next.angle, next.exit)}`; then.hidden = false; }
    else then.hidden = true;
    $('#nav-speed').textContent = Math.round((speed || 0) * 3.6);
    $('#nav-remain').textContent = fmtDist(remaining);
    const left = Math.max(0, (eta.getTime() - Date.now()) / 1000);
    $('#nav-left').textContent = fmtDur(left);
    $('#nav-eta').textContent = `Ankunft ${fmtClock(eta)}`;
  },
  arrived() {
    if (!nav.active || arrivedOnce) return;
    arrivedOnce = true;
    markArrived();
    toast('Ziel erreicht – gute Fahrt gehabt!', 4000);
    setTimeout(endNavigation, 3500);
  },
  rerouting(on) { $('#nav-reroute').hidden = !on; },
  offline() { toast('Offline – Neuberechnung nicht möglich. Folge der Route.', 3500); }
};

let navStarting = false;
async function beginNavigation() {
  if (!route.data || !plan.end) return;
  stopFlyover();
  if (!(await offerOfflineBeforeStart())) return;
  navStarting = true;
  closeSheet('sheet-route');
  closeSheet('sheet-info');
  closeSheet('sheet-layers');
  closeSheet('sheet-bike');
  closeSheet('sheet-style');
  $('#legend-panel').hidden = true;
  document.body.classList.remove('legend-open');
  elevMarker?.remove(); elevMarker = null;
  document.body.classList.add('navigating');
  $('#nav-hud').hidden = false;
  $('#nav-recenter').classList.remove('attn');
  $('#trail-status').hidden = true;
  lastManeuverKey = '';
  markers.start?.remove(); markers.start = null;
  const first = route.data.maneuvers[0];
  navUi.update({ m: first, distTo: first.d, next: null, remaining: route.data.total, speed: 0, eta: new Date(Date.now() + route.data.time * 1000), onRoute: true });
  if (rec.active && rec.ride?.mode === 'free') stopFreeRide(false);
  startRide('nav');
  try {
    await startNavigation(plan.end.lngLat, plan.vias.map((v) => v.lngLat), navUi);
  } finally {
    navStarting = false;
  }
}

function endNavigation() {
  arrivedOnce = false;
  stopNavigation();
  const result = finishRide();
  onRideWear(result);
  if (result) setTimeout(() => showRideSummary(result.ride, result.unlocked), 400);
  document.body.classList.remove('navigating');
  $('#nav-hud').hidden = true;
  $('#nav-reroute').hidden = true;
  clearPlan();
  renderPlan();
}

function wireNavigation() {
  $('#nav-stop').onclick = endNavigation;
  $('#nav-voice').onclick = () => {
    setSetting('voice', !settings.voice);
    toast(settings.voice ? 'Sprachansagen an' : 'Sprachansagen aus');
    if (settings.voice) speak('Sprachansagen aktiviert.');
  };
  $('#nav-recenter').onclick = () => { $('#nav-recenter').classList.remove('attn'); recenterNav(); };
  $('#nav-3d').classList.add('on');
  $('#nav-3d').onclick = () => {
    nav.flat = !nav.flat;
    $('#nav-3d').textContent = nav.flat ? '2D' : '3D';
    $('#nav-3d').classList.toggle('on', !nav.flat);
    recenterNav();
  };
  map.on('dragstart', () => {
    if (!nav.active) return;
    nav.follow = false;
    $('#nav-recenter').classList.add('attn');
  });
}

// =====================================================================
// Android-Zurück-Taste
// =====================================================================
function wireBackButton() {
  if (!isNative) return;
  App.addListener('backButton', () => {
    if (isFlying()) { stopFlyover(); endFly(); return; }
    if (ctxPopup?.isOpen()) { ctxPopup.remove(); return; }
    if (!$('#results').hidden) { $('#results').hidden = true; return; }
    if (nav.active) { if (confirm('Navigation beenden?')) endNavigation(); return; }
    if (!$('#dialog').hidden) return;
    if (!$('#celebrate').hidden) { showNextCelebration(); return; }
    if (!$('#ms-detail').hidden) { $('#ms-detail').hidden = true; return; }
    for (const id of ['sheet-ride', 'sheet-ms', 'sheet-style', 'sheet-offline', 'sheet-bike', 'sheet-layers', 'sheet-info', 'sheet-route']) {
      if (isSheetOpen(id)) { closeSheet(id); if (id === 'sheet-info') selectTrail(null); return; }
    }
    App.minimizeApp();
  });
}

boot();
