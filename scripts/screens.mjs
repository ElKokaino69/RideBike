// RideBike – echte Vorschaubilder (läuft in GitHub Actions mit freiem Internet)
// © 2026 Florian Enders
import puppeteer from 'puppeteer';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = process.env.OUT || 'screens';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = 'CapacitorStorage.ridebike.settings.v1';
const base = { animations: false, drift: false, terrain: true, hillshade: true, sky: true, skyFx: true, cloudShadows: true, hdTerrain: true,
  daylight: true, quality: 'high', designVersion: 16, offlinePrompt: false, style: 'satellite' };

const VIEWS = [
  { n: '01-zugspitze', v: { center: [10.9862, 47.4210], zoom: 12.9, pitch: 74, bearing: 205 }, s: { daylightMode: 'noon' } },
  { n: '02-drei-zinnen', v: { center: [12.2950, 46.6050], zoom: 13.4, pitch: 76, bearing: 10 }, s: { daylightMode: 'evening' } },
  { n: '03-matterhorn', v: { center: [7.6900, 45.9600], zoom: 12.7, pitch: 74, bearing: 250 }, s: { daylightMode: 'morning' } },
  { n: '04-rhoen-kreuzberg', v: { center: [9.9660, 50.3580], zoom: 13.4, pitch: 70, bearing: 40 }, s: { daylightMode: 'noon' } },
  { n: '05-gardasee', v: { center: [10.8700, 45.8650], zoom: 12.6, pitch: 72, bearing: 190 }, s: { daylightMode: 'evening' } },
  { n: '06-eibsee-nacht', v: { center: [10.9750, 47.4500], zoom: 13.6, pitch: 70, bearing: 170 }, s: { daylightMode: 'night' } },
  { n: '07-liberty-3d', v: { center: [10.2160, 50.3220], zoom: 15.6, pitch: 66, bearing: -20 }, s: { daylightMode: 'noon', style: 'liberty' } },
  { n: '02b-seceda', v: { center: [11.7300, 46.6000], zoom: 13.2, pitch: 76, bearing: 300 }, s: { daylightMode: 'evening' } },
  { n: '03b-eiger', v: { center: [8.0050, 46.6100], zoom: 12.9, pitch: 74, bearing: 160 }, s: { daylightMode: 'noon' } },
  { n: '06b-matterhorn-abend', v: { center: [7.6900, 45.9600], zoom: 12.7, pitch: 74, bearing: 250 }, s: { daylightMode: 'evening' } },
  { n: '07b-cyclosm', v: { center: [10.2160, 50.3220], zoom: 13.8, pitch: 60, bearing: 10 }, s: { daylightMode: 'noon', style: 'cyclosm' } },
  { n: '08-bad-neustadt', v: { center: [10.2160, 50.3220], zoom: 14.8, pitch: 68, bearing: 30 }, s: { daylightMode: 'noon' } }
];

const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 300000,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

async function settle(page, max = 90000) {
  const t0 = Date.now();
  await wait(5000);
  while (Date.now() - t0 < max) {
    const ok = await page.evaluate(() => { const m = window.__rb?.map; return !!m && m.loaded() && m.areTilesLoaded(); }).catch(() => false);
    if (ok) break;
    await wait(1500);
  }
  await wait(5000);
}

async function view(name, v, s, after) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log(name, 'PAGEERR', e.message));
  page.on('requestfailed', (r) => { if (/brouter|photon|overpass/.test(r.url())) console.log(name, 'FAIL', r.url().slice(0, 160), r.failure()?.errorText); });
  page.on('response', (r) => { if (/brouter|photon/.test(r.url()) && r.status() >= 400) console.log(name, 'HTTP', r.status(), r.url().slice(0, 160)); });
  await page.evaluateOnNewDocument((k, st) => localStorage.setItem(k, JSON.stringify(st)), KEY, { ...base, ...s, lastView: v });
  if (s.geo) { await browser.defaultBrowserContext().overridePermissions(BASE, ['geolocation']); await page.setGeolocation(s.geo); }
  await page.goto(BASE + '/?debug', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await settle(page);
  if (after) await after(page);
  console.log(name, 'CAM', await page.evaluate(() => { const m = window.__rb.map; const tr = m.transform; const c = m.getCenter();
    return JSON.stringify({ alt: Math.round(tr.getCameraAltitude()), camE: m.queryTerrainElevation(tr.getCameraLngLat()), cE: m.queryTerrainElevation(c), trE: m.transform.elevation, ex: m.getTerrain()?.exaggeration,
      pitch: m.getPitch().toFixed(1), zoom: m.getZoom().toFixed(2), rawC: m.terrain?.getElevationForLngLatZoom?.(c, m.transform.tileZoom) }); }).catch((e) => e.message));
  await page.evaluate(() => { const t = document.querySelector('#trail-status'); if (t && /geladen/.test(t.textContent)) t.hidden = true; });
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 86 });
  console.log('✓', name);
  await page.close();
}

for (const x of VIEWS.filter((x) => !process.env.ONLY || process.env.ONLY.split(',').includes(x.n))) { try { await view(x.n, x.v, x.s); } catch (e) { console.log('✗', x.n, e.message); } }

if (!process.env.ONLY) {
// Route planen am echten Gelände: Bischofsheim → Kreuzberg
try {
  await view('09-route-kreuzberg', { center: [9.99, 50.36], zoom: 12.6, pitch: 62, bearing: 20 },
    { daylightMode: 'noon', geo: { latitude: 50.4020, longitude: 10.0050, accuracy: 8 } }, async (page) => {
      await page.click('#q'); await page.type('#q', 'Kreuzberg Rhön', { delay: 40 });
      await page.waitForSelector('.result:not(.wish)', { timeout: 60000 }); await wait(800);
      await page.click('.result:not(.wish)');
      await page.waitForFunction(() => window.__rb?.route?.data, { timeout: 90000 }).catch(() => {});
      await settle(page, 60000);
      console.log('route', await page.evaluate(() => window.__rb?.route?.data ? Math.round(window.__rb.route.data.total) + ' m' : 'keine'));
    });
} catch (e) { console.log('✗ route', e.message); }
}

await browser.close();
