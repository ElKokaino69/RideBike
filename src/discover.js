// RideBike – Entdecken: Einkehr, Rad-Service, Übernachten, Erlebnisse, Einkaufen, Rast
// © 2026 Florian Enders
//
// Live aus OpenStreetMap (Overpass): Orte im Kartenausschnitt oder entlang der Route,
// als 3D-Pins mit Clustern; Infokarte mit Öffnungszeiten („jetzt geöffnet“), Kontakt
// und „Als Zwischenstopp“. Partner-Einträge können später hervorgehoben werden.

import { map, onStyleReady } from './mapcore.js';
import { overpass } from './trails.js';

export const CATS = [
  { id: 'food',  name: 'Essen & Trinken', short: 'Einkehr', color: '#f59e0b',
    path: 'M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5ZM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3',
    q: ['node["amenity"~"^(cafe|restaurant|biergarten|ice_cream|pub)$"]', 'way["amenity"~"^(cafe|restaurant|biergarten)$"]'] },
  { id: 'bike',  name: 'Rad-Service', short: 'Rad-Service', color: '#2563eb',
    path: 'M5.5 17.5a3 3 0 1 0 0-.01M18.5 17.5a3 3 0 1 0 0-.01M5.5 17.5 9 10h6l3.5 7.5M9 10l3 7.5M15 10l-1.5-3H11',
    q: ['node["shop"="bicycle"]', 'way["shop"="bicycle"]', 'node["amenity"~"^(bicycle_repair_station|bicycle_rental)$"]', 'node["amenity"="charging_station"]["bicycle"="yes"]'] },
  { id: 'rest',  name: 'Rast, Wasser & WC', short: 'Rast', color: '#0ea5e9',
    path: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
    q: ['node["amenity"~"^(drinking_water|toilets|shelter)$"]', 'node["tourism"="picnic_site"]'] },
  { id: 'sleep', name: 'Übernachten', short: 'Schlafen', color: '#16a34a',
    path: 'M3 18V8M3 14h18v4M21 18v-6a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
    q: ['node["tourism"~"^(hotel|guest_house|hostel|camp_site|alpine_hut|wilderness_hut)$"]', 'way["tourism"~"^(hotel|guest_house|hostel|camp_site|alpine_hut)$"]'] },
  { id: 'see',   name: 'Erleben & Sehenswertes', short: 'Erleben', color: '#a855f7',
    path: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    q: ['node["tourism"~"^(viewpoint|attraction|museum)$"]', 'node["historic"~"^(castle|ruins|monument)$"]', 'way["historic"~"^(castle|ruins)$"]', 'node["leisure"="swimming_area"]', 'way["leisure"~"^(swimming_area|bathing_place)$"]', 'node["natural"="beach"]'] },
  { id: 'shop',  name: 'Einkaufen', short: 'Einkaufen', color: '#ef4444',
    path: 'M5 8h14l-1.5 11h-11ZM9 8V6a3 3 0 0 1 6 0v2',
    q: ['node["shop"~"^(supermarket|bakery|convenience|butcher|farm)$"]', 'way["shop"="supermarket"]'] }
];

const KIND_DE = {
  cafe: 'Café', restaurant: 'Restaurant', biergarten: 'Biergarten', ice_cream: 'Eisdiele', pub: 'Kneipe',
  bicycle: 'Fahrradladen', bicycle_repair_station: 'Rad-Reparaturstation', bicycle_rental: 'Radverleih', charging_station: 'E-Bike-Ladestation',
  drinking_water: 'Trinkwasser', toilets: 'WC', shelter: 'Unterstand', picnic_site: 'Rastplatz',
  hotel: 'Hotel', guest_house: 'Pension', hostel: 'Hostel', camp_site: 'Campingplatz', alpine_hut: 'Berghütte', wilderness_hut: 'Schutzhütte',
  viewpoint: 'Aussichtspunkt', attraction: 'Sehenswürdigkeit', museum: 'Museum', castle: 'Burg / Schloss', ruins: 'Ruine', monument: 'Denkmal',
  swimming_area: 'Badestelle', bathing_place: 'Badestelle', beach: 'Strand',
  supermarket: 'Supermarkt', bakery: 'Bäckerei', convenience: 'Laden', butcher: 'Metzgerei', farm: 'Hofladen'
};

export const disc = { on: new Set(), data: new Map(), lastKey: '', loading: false, along: false };
let onStatus = null;
export const onDiscoverStatus = (fn) => { onStatus = fn; };

function pinImage(color, path, size = 84) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size * 0.34, cx = size / 2, cy = size * 0.4;
  // Schatten am Boden
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(cx, size * 0.93, r * 0.55, r * 0.16, 0, 0, 7); g.fill();
  // Tropfen-Pin mit Glanz
  g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.82, Math.PI * 0.18); g.lineTo(cx, size * 0.9); g.closePath();
  g.fillStyle = '#ffffff'; g.fill();
  g.shadowColor = 'transparent';
  g.beginPath(); g.arc(cx, cy, r * 0.84, 0, 7);
  const grd = g.createLinearGradient(0, cy - r, 0, cy + r); grd.addColorStop(0, shade(color, 30)); grd.addColorStop(1, shade(color, -25));
  g.fillStyle = grd; g.fill();
  g.save();
  const s = (r * 1.15) / 24;
  g.translate(cx - 12 * s, cy - 12 * s); g.scale(s, s);
  g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(new Path2D(path)); g.restore();
  g.beginPath(); g.ellipse(cx - r * 0.3, cy - r * 0.45, r * 0.35, r * 0.18, -0.5, 0, 7); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
  return g.getImageData(0, 0, size, size);
}
function shade(hex, p) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + p));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const EMPTY = { type: 'FeatureCollection', features: [] };
function addLayers(m) {
  const pr = 2;
  for (const c of CATS) if (!m.hasImage(`disc-${c.id}`)) m.addImage(`disc-${c.id}`, pinImage(c.color, c.path), { pixelRatio: pr });
  if (!m.getSource('rb-disc')) m.addSource('rb-disc', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 46, clusterMaxZoom: 15 });
  m.addLayer({ id: 'rb-disc-cluster', type: 'circle', source: 'rb-disc', filter: ['has', 'point_count'],
    paint: { 'circle-color': 'rgba(14,20,28,.82)', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 30, 24],
      'circle-stroke-color': '#8be13a', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'viewport' } });
  m.addLayer({ id: 'rb-disc-count', type: 'symbol', source: 'rb-disc', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' } });
  m.addLayer({ id: 'rb-disc', type: 'symbol', source: 'rb-disc', filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['concat', 'disc-', ['get', 'cat']], 'icon-anchor': 'bottom', 'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 15, 1, 18, 1.15],
      'symbol-sort-key': ['case', ['get', 'open'], 0, 1],
      'text-field': ['step', ['zoom'], '', 14.5, ['get', 'name']], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5,
      'text-anchor': 'top', 'text-offset': [0, 0.3], 'text-optional': true, 'text-max-width': 9
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,.75)', 'text-halo-width': 1.4,
      'icon-opacity': ['case', ['==', ['get', 'open'], false], 0.6, 1] } });
  refresh();
}

/** Overpass-Abfrage für Kategorien in einem Bereich (bbox oder Linie entlang der Route) */
async function query(cats, area) {
  const parts = cats.flatMap((c) => c.q.map((q) => `${q}${area};`));
  const data = await overpass(`[out:json][timeout:25];(${parts.join('')});out center tags 400;`);
  return (data.elements || []).map((e) => toFeature(e, cats)).filter(Boolean);
}

function toFeature(e, cats) {
  const t = e.tags || {};
  const lng = e.lon ?? e.center?.lon, lat = e.lat ?? e.center?.lat;
  if (lng == null) return null;
  const kindKey = t.amenity || t.shop || t.tourism || t.historic || t.leisure || t.natural || '';
  const cat = cats.find((c) => c.q.some((q) => {
    const m = q.match(/\["(\w+)"(?:~"\^\(([^)]+)\)\$"|="([^"]+)")\]/);
    if (!m) return false;
    const val = t[m[1]]; if (!val) return false;
    return m[2] ? m[2].split('|').includes(val) : val === m[3];
  }));
  if (!cat) return null;
  const oh = t.opening_hours ? isOpen(t.opening_hours) : null;
  return {
    type: 'Feature', id: e.id, geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: `${e.type}/${e.id}`, cat: cat.id, name: t.name || KIND_DE[kindKey] || cat.short, kind: KIND_DE[kindKey] || cat.short,
      open: oh, hours: t.opening_hours || '', phone: t.phone || t['contact:phone'] || '', web: t.website || t['contact:website'] || '',
      cuisine: t.cuisine || '', street: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), city: t['addr:city'] || '',
      outdoor: t.outdoor_seating === 'yes', fee: t.fee || '', ele: t.ele || '', stars: t.stars || '', partner: false,
      wiki: t.wikipedia || '', wikidata: t.wikidata || ''
    }
  };
}

/** Kategorien neu laden (Kartenausschnitt) */
export async function refresh(force = false) {
  const src = map.getSource('rb-disc');
  if (!src) return;
  if (!disc.on.size) { if (!disc.along) src.setData(EMPTY); onStatus?.({ count: 0 }); return; }
  if (map.getZoom() < 11.5) { src.setData(EMPTY); onStatus?.({ zoomIn: true }); return; }
  const b = map.getBounds();
  const pad = 0.15;
  const dLng = (b.getEast() - b.getWest()) * pad, dLat = (b.getNorth() - b.getSouth()) * pad;
  // Bei starker Neigung reicht der Ausschnitt bis zum Horizont → auf sinnvolle Größe begrenzen
  const c = map.getCenter();
  const maxD = 0.12;
  const s = Math.max(b.getSouth() - dLat, c.lat - maxD), n = Math.min(b.getNorth() + dLat, c.lat + maxD);
  const w = Math.max(b.getWest() - dLng, c.lng - maxD * 1.5), e = Math.min(b.getEast() + dLng, c.lng + maxD * 1.5);
  const key = [...disc.on].sort().join(',') + '|' + [s, w, n, e].map((x) => x.toFixed(2)).join(',');
  if (key === disc.lastKey && !force) return;
  disc.lastKey = key;
  disc.loading = true; onStatus?.({ loading: true });
  try {
    const cats = CATS.filter((x) => disc.on.has(x.id));
    const feats = await query(cats, `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`);
    if (key !== disc.lastKey) return;
    feats.forEach((f) => disc.data.set(f.properties.id, f));
    src.setData({ type: 'FeatureCollection', features: feats });
    onStatus?.({ count: feats.length });
  } catch {
    disc.lastKey = '';
    onStatus?.({ error: true });
  } finally { disc.loading = false; }
}

export function clearAlong() {
  if (!disc.along) return;
  disc.along = false; disc.lastKey = '';
  refresh(true);
}

export function toggleCat(id) {
  disc.along = false;
  if (disc.on.has(id)) disc.on.delete(id); else disc.on.add(id);
  refresh(true);
  return disc.on.has(id);
}

/** Orte entlang einer Route (Korridor ~350 m), sortiert nach Kilometer */
export async function alongRoute(r, catIds = ['food', 'bike', 'rest', 'see', 'shop'], radius = 350) {
  const step = Math.max(1, Math.floor(r.coords.length / 70));
  const line = r.coords.filter((_, i) => i % step === 0 || i === r.coords.length - 1).map((p) => `${p[1].toFixed(5)},${p[0].toFixed(5)}`).join(',');
  const cats = CATS.filter((c) => catIds.includes(c.id));
  const feats = await query(cats, `(around:${radius},${line})`);
  // Position entlang der Route
  for (const f of feats) {
    const p = f.geometry.coordinates;
    let best = Infinity, at = 0;
    for (let i = 0; i < r.coords.length; i += step) {
      const q = r.coords[i];
      const d = (q[0] - p[0]) ** 2 * Math.cos((p[1] * Math.PI) / 180) ** 2 + (q[1] - p[1]) ** 2;
      if (d < best) { best = d; at = r.cum[i]; }
    }
    f.properties.atM = at;
    f.properties.offM = Math.sqrt(best) * 111000;
  }
  return feats.sort((a, b) => a.properties.atM - b.properties.atM);
}

// ---------- Öffnungszeiten (häufige OSM-Formate) ----------
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export function isOpen(spec, now = new Date()) {
  try {
    const s = spec.trim();
    if (s === '24/7') return true;
    const day = (now.getDay() + 6) % 7;
    const mins = now.getHours() * 60 + now.getMinutes();
    let result = null;
    for (const rule of s.split(';').map((x) => x.trim()).filter(Boolean)) {
      const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+)?\s*(.*)$/);
      if (!m) return null;
      const daysPart = (m[1] || 'Mo-Su').replace(/\s/g, '');
      let hit = false;
      for (const d of daysPart.split(',').filter(Boolean)) {
        if (d === 'PH') continue;
        const [a, b] = d.split('-');
        const ia = DAYS.indexOf(a), ib = b ? DAYS.indexOf(b) : ia;
        if (ia < 0 || ib < 0) return null;
        if (ia <= ib ? day >= ia && day <= ib : day >= ia || day <= ib) hit = true;
      }
      if (!hit) continue;
      const times = m[2].trim();
      if (/^(off|closed)$/i.test(times)) { result = false; continue; }
      if (!times) { result = true; continue; }
      let open = false;
      for (const span of times.split(',')) {
        const t = span.trim().match(/^(\d\d):(\d\d)-(\d\d):(\d\d)\+?$/);
        if (!t) return null;
        const from = +t[1] * 60 + +t[2]; let to = +t[3] * 60 + +t[4]; if (to <= from) to += 1440;
        if (mins >= from && mins < to) open = true;
      }
      result = open;
    }
    return result;
  } catch { return null; }
}

/** Öffnungszeiten lesbar machen */
export function hoursDe(spec) {
  return spec.replace(/Mo/g, 'Mo').replace(/Tu/g, 'Di').replace(/We/g, 'Mi').replace(/Th/g, 'Do').replace(/Fr/g, 'Fr')
    .replace(/Sa/g, 'Sa').replace(/Su/g, 'So').replace(/PH/g, 'Feiertag').replace(/off/g, 'geschlossen').replace(/;\s*/g, ' · ');
}

export function initDiscover() {
  onStyleReady(addLayers);
  let t = 0;
  map.on('moveend', () => { clearTimeout(t); t = setTimeout(() => refresh(), 500); });
}
