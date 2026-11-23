// RideBike – Demo-Paket: eingebettete echte Kartendaten für Vorschauen ohne Internet
// (z. B. Dateivorschau im Chat, abgeschottete iframes). Aktiv nur, wenn die HTML-Datei
// ein <script id="rb-demo" type="application/json"> mit aufgezeichneten Antworten enthält.
// © 2026 Florian Enders

const el = typeof document !== 'undefined' ? document.getElementById('rb-demo') : null;
let pack = null;
try { pack = el ? JSON.parse(el.textContent) : null; } catch { pack = null; }

export const DEMO = !!pack;
export const DEMO_INFO = pack?.info || null;

const bytesCache = new Map();
function toBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Gleicher Schlüssel beim Aufzeichnen und Abspielen (wechselnde Parameter werden ignoriert) */
export function demoKey(url, body) {
  let u;
  try { u = new URL(url); } catch { return url; }
  if (u.hostname.includes('photon')) {
    if (u.pathname.includes('reverse')) return 'photon-rev';
    return 'photon:' + (u.searchParams.get('q') || '').trim().toLowerCase();
  }
  if (u.hostname.includes('overpass') || u.pathname.includes('interpreter')) return 'ovp:' + (body || u.search);
  if (u.hostname.includes('open-meteo')) return 'meteo';
  if (u.hostname.includes('brouter')) { u.searchParams.delete('alternativeidx'); return 'brouter:' + u.searchParams.get('lonlats') + '|' + u.searchParams.get('profile'); }
  return u.href;
}

function lookup(key) {
  if (!pack) return null;
  let e = pack.r[key];
  if (!e && key.startsWith('photon:')) {
    // Tippen in der Suche: nächstliegende aufgezeichnete Suche verwenden
    const q = key.slice(7);
    const cand = Object.keys(pack.r).filter((k) => k.startsWith('photon:') && q && k.slice(7).startsWith(q)).sort((a, b) => a.length - b.length)[0]
      || Object.keys(pack.r).filter((k) => k.startsWith('photon:') && q.startsWith(k.slice(7)) && k.length > 9).sort((a, b) => b.length - a.length)[0];
    if (cand) e = pack.r[cand];
  }
  if (!e && key.startsWith('brouter:')) e = pack.r[Object.keys(pack.r).find((k) => k.startsWith('brouter:') && k.endsWith('|' + key.split('|').pop()))] || pack.r[Object.keys(pack.r).find((k) => k.startsWith('brouter:'))];
  if (!e) return null;
  if (!bytesCache.has(key)) bytesCache.set(key, { ct: e[0], bytes: toBytes(e[1]) });
  return bytesCache.get(key);
}

/** Antwort aus dem Paket als ArrayBuffer (für das rbc://-Protokoll) */
export function demoGet(url) {
  const hit = lookup(demoKey(url));
  return hit ? hit.bytes.slice().buffer : null;
}

function emptyFor(key) {
  if (key.startsWith('ovp:')) return new Response('{"elements":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  if (key.startsWith('photon:')) return new Response('{"type":"FeatureCollection","features":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('', { status: 503, statusText: 'Demo offline' });
}

export function installDemo() {
  if (!pack) return;
  document.documentElement.classList.add('demo');
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/^(data|blob):/.test(url)) return realFetch(input, init);
    const body = typeof init.body === 'string' ? init.body : '';
    const key = demoKey(url, body);
    const hit = lookup(key);
    if (hit) { await new Promise((r) => setTimeout(r, 30)); return new Response(hit.bytes.slice(), { status: 200, headers: { 'content-type': hit.ct } }); }
    return emptyFor(key);
  };
  // Standort: fester Demo-Standort, da Vorschauen den echten Standort nicht freigeben
  const pos = pack.info?.position || [10.005, 50.402];
  const fake = () => ({ coords: { latitude: pos[1], longitude: pos[0], accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(fake()), 200),
    watchPosition: (ok) => { const id = setInterval(() => ok(fake()), 5000); setTimeout(() => ok(fake()), 200); return id; },
    clearWatch: (id) => clearInterval(id)
  };
  try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch { /* egal */ }
  try {
    const perms = { query: async () => ({ state: 'granted', onchange: null, addEventListener() {}, removeEventListener() {} }) };
    Object.defineProperty(navigator, 'permissions', { value: perms, configurable: true });
  } catch { /* egal */ }
}
