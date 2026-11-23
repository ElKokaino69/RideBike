// RideBike – Demo-Paket aufzeichnen: echte Antworten (Karten, Gelände, Route, Wetter …) für die Offline-Vorschau
// Läuft in GitHub Actions. © 2026 Florian Enders
import puppeteer from 'puppeteer';
import fs from 'fs';
import { demoKey } from '../src/demo.js';
const BASE = process.env.BASE || 'http://localhost:4173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = 'CapacitorStorage.ridebike.settings.v1';
const POS = [10.0050, 50.4020]; // Bischofsheim i. d. Rhön
const VIEW = { center: [9.9660, 50.3580], zoom: 13.2, pitch: 68, bearing: 40 };
const pack = { info: { area: 'Rhön · Kreuzberg', position: POS, recorded: new Date().toISOString().slice(0, 10) }, r: {} };
let bytes = 0;

const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await browser.defaultBrowserContext().overridePermissions(BASE, ['geolocation']);
await page.setGeolocation({ latitude: POS[1], longitude: POS[0], accuracy: 8 });
await page.evaluateOnNewDocument((k, v) => localStorage.setItem(k, JSON.stringify({ style: 'satellite', quality: 'balanced', designVersion: 16, offlinePrompt: false, lastView: v })), KEY, VIEW);
page.on('response', async (res) => {
  const req = res.request();
  const url = req.url();
  if (!/^https?:/.test(url) || url.startsWith(BASE) || res.status() !== 200) return;
  if (/fonts\.g|google/.test(url)) return;
  try {
    const buf = await res.buffer();
    const k = demoKey(url, req.postData() || '');
    if (pack.r[k]) return;
    pack.r[k] = [res.headers()['content-type'] || 'application/octet-stream', buf.toString('base64')];
    bytes += buf.length;
  } catch { /* z. B. Weiterleitung */ }
});
const settle = async (ms = 60000) => {
  const t0 = Date.now(); await wait(4000);
  while (Date.now() - t0 < ms) { if (await page.evaluate(() => window.__rb?.map?.areTilesLoaded()).catch(() => false)) break; await wait(1500); }
  await wait(3000);
};
const cam = (o) => page.evaluate((o) => { setTimeout(() => window.__rb.map.jumpTo(o), 0); }, o).catch((e) => console.log('cam', e.message));
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('Schritt', name, 'übersprungen:', e.message); } };

await page.goto(BASE + '/?debug', { waitUntil: 'domcontentloaded', timeout: 120000 });
await settle(90000);
for (const b of [130, 220, 310, 40]) { await cam({ bearing: b }); await settle(); console.log('Blick', b, Math.round(bytes / 1e6), 'MB'); }
await cam({ zoom: 14.3, pitch: 70 }); await settle();
await cam(VIEW); await settle();
// Route: Bischofsheim → Kreuzberg
await step('route', async () => {
await page.evaluate(() => document.querySelectorAll('.sheet.open').forEach((x) => window.__rb.closeSheet(x.id)));
await page.evaluate(() => { const q = document.querySelector('#q'); q.scrollIntoView(); q.focus(); q.click(); });
await wait(600);
for (const ch of 'Kreuzberg') { await page.keyboard.type(ch); await wait(450); }
await page.waitForSelector('.result:not(.wish)', { timeout: 60000 }); await wait(1500);
await page.evaluate(() => document.querySelector('.result:not(.wish)').click());
await page.waitForFunction(() => window.__rb?.route?.data, { timeout: 90000 }).catch(() => console.log('keine Route'));
await settle(); await wait(15000); // Wetter, Analyse, Orte entlang der Route
console.log('Route', await page.evaluate(() => window.__rb.route.data ? Math.round(window.__rb.route.data.total) : 0));
await page.evaluate(() => window.__rb.closeSheet('sheet-route'));
await page.evaluate(() => { const r = window.__rb.route.data; if (!r) return; const m = r.coords[Math.floor(r.coords.length * 0.55)]; window.__rb.map.jumpTo({ center: [m[0], m[1]], zoom: 13.4, pitch: 70, bearing: 200 }); });
await settle();
});
await browser.close();
fs.writeFileSync('demo-pack.json', JSON.stringify(pack));
console.log('Einträge', Object.keys(pack.r).length, 'Rohdaten', (bytes / 1e6).toFixed(1), 'MB', 'Paket', (fs.statSync('demo-pack.json').size / 1e6).toFixed(1), 'MB');
