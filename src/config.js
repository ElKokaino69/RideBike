// RideBike – Konfiguration
// © 2026 Florian Enders. Alle Rechte vorbehalten.

export const APP = {
  name: 'RideBike',
  version: '1.9.0',
  author: 'Florian Enders',
  year: 2026
};

const OFM = 'https://tiles.openfreemap.org';
export const OFM_GLYPHS = `${OFM}/fonts/{fontstack}/{range}.pbf`;
export const OFM_VECTOR = `${OFM}/planet`;

// Kartenstile – Vektor (OpenFreeMap / OpenMapTiles) und Raster
export const MAP_STYLES = [
  { id: 'liberty',  name: 'Liberty',  hint: 'Klar & plastisch', url: `${OFM}/styles/liberty`,  dark: false, preview: ['#f3efe6', '#bfe3b4', '#8cc4ec'] },
  { id: 'bright',   name: 'Bright',   hint: 'Kräftige Farben',  url: `${OFM}/styles/bright`,   dark: false, preview: ['#f8f4ec', '#f7c86a', '#a7d7a0'] },
  { id: 'positron', name: 'Light',    hint: 'Minimalistisch',   url: `${OFM}/styles/positron`, dark: false, preview: ['#fafafa', '#e3e3e3', '#cfd8dc'] },
  { id: 'dark',     name: 'Night',    hint: 'Dunkel, nachts',   url: `${OFM}/styles/dark`,     dark: true,  preview: ['#0e1116', '#1d2430', '#3a4556'] },
  { id: 'fiord',    name: 'Fjord',    hint: 'Blau-Nacht',       url: `${OFM}/styles/fiord`,    dark: true,  preview: ['#2b3e50', '#45617a', '#6b8aa6'] },
  {
    id: 'cyclosm', name: 'CyclOSM', hint: 'Radkarte', dark: false, preview: ['#f2efe9', '#2563eb', '#b45309'],
    raster: [
      'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
      'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
      'https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'
    ],
    maxzoom: 20,
    attribution: '<a href="https://www.cyclosm.org" target="_blank">CyclOSM</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  },
  {
    id: 'satellite', name: 'Satellit 3D', hint: 'Luftbild in 3D', dark: true, photo: true, preview: ['#1f3b2a', '#4d6b3c', '#8a7d5a'],
    raster: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 19,
    attribution: 'Bilder © Esri, Maxar, Earthstar Geographics'
  }
];

// Höhendaten (Mapzen/Tilezen Terrain Tiles auf AWS, frei nutzbar)
export const DEM = {
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Höhen: <a href="https://github.com/tilezen/joerd" target="_blank">Mapzen Terrain Tiles</a>'
};

/** Hochaufgelöstes Höhenmodell (online): Mapterhorn – Terrarium, 512er-Kacheln, in den Alpen bis ~1 m */
export const DEM_HD = {
  url: 'https://tiles.mapterhorn.com/tilejson.json',
  attribution: 'Höhen: <a href="https://mapterhorn.com" target="_blank">Mapterhorn</a>'
};

/** Ersatzteil-Suche für den Wartungs-Tracker – hier später die Partner-ID (Affiliate) eintragen */
export const PARTS_SHOP = 'https://www.bike-components.de/de/s/?keywords={q}';

/** Wetter: Open-Meteo (frei für nicht-kommerzielle Nutzung; für den Verkauf Abo/Kundenendpunkt eintragen) */
export const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

export const WAYMARKED = {
  cycling: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
  mtb: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',
  attribution: '<a href="https://waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
};

export const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

export const PHOTON = 'https://photon.komoot.io';
export const BROUTER = 'https://brouter.de/brouter';

// Farben
export const C = {
  accent: '#8be13a',
  accent2: '#5fcb2b',
  cycleway: '#5fd12f',
  track: '#3b82f6',
  path: '#facc15',
  mtb: ['#22c55e', '#4ade80', '#f59e0b', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d'],
  network: { icn: '#f43f5e', ncn: '#d946ef', rcn: '#3b82f6', lcn: '#06b6d4', mtb: '#ff7a1a' }
};

export const DEFAULT_SETTINGS = {
  style: 'satellite',
  designVersion: 16,
  terrain: true,
  exaggeration: 1.3,
  hillshade: true,
  buildings: true,
  sky: true,
  pitch: 70,
  skyFx: true,
  cloudShadows: true,
  subtleNetwork: true,
  hdTerrain: true,
  animations: true,
  daylight: true,          // Licht & Himmel nach Sonnenstand
  daylightMode: 'live',    // live | morning | noon | evening | night
  drift: true,             // Panorama-Drift im Leerlauf
  autoNight: true,         // nachts automatisch dunkle Karte
  quality: 'auto',         // auto | high | balanced | saver
  mapAccess: 'online',     // Kartenzugriff: online | wifi (mobil nur gespeichert) | offline (nur gespeichert)
  offlinePrompt: true,     // vor Tourstart Offline-Speichern anbieten
  wifiOnly: true,          // große Downloads nur im WLAN (sonst nachfragen)
  details: {
    contours: true,
    peaks: true,
    pois: true,
    forest: true,
    water: true,
    forest3d: false,
    unpaved: true
  },
  layers: {
    cycleways: true,
    tracks: true,
    paths: true,
    mtb: true,
    trails: true,
    wmtCycling: false,
    wmtMtb: false
  },
  bike: null, // wird in settings.js mit DEFAULT_BIKE gefüllt
  slopeColors: false,
  voice: true,
  safety: { fall: true, name: '', phone: '', share: true },
  keepAwake: true,
  lastView: null
};
