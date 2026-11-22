// RideBike – 3D-Flyover als Hochformat-Video (Reels/Stories/WhatsApp)
// © 2026 Florian Enders
//
// Die Karte wird bei jedem Neuzeichnen in ein Zwischenbild kopiert; ein eigener
// Zeichen-Loop legt Branding, Tourdaten, Höhenprofil und Fahrer-Punkt darüber und
// nimmt das Ganze per MediaRecorder auf. Teilen über das Android-Teilen-Menü.

import { Capacitor } from '@capacitor/core';
import { map } from './mapcore.js';
import { route, startFlyover, stopFlyover, flyState } from './routing.js';
import { fmtDist, fmtDur } from './geo.js';

const W = 720, H = 1280, FPS = 30;

function pickMime() {
  const c = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return c.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

export const videoSupported = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && pickMime());

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/**
 * Flyover aufnehmen. Gibt { blob, mime, ext } zurück.
 * @param {object} o  title, sub, watermark, seconds, onProgress(k)
 */
export function recordFlyover(o = {}) {
  const r = route.data;
  if (!r) return Promise.reject(new Error('Keine Route'));
  const mime = pickMime();
  if (!mime) return Promise.reject(new Error('Video wird auf diesem Gerät nicht unterstützt'));
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d');
  const last = document.createElement('canvas');
  const lg = last.getContext('2d');
  const src = map.getCanvas();
  const grab = () => {
    if (last.width !== src.width || last.height !== src.height) { last.width = src.width; last.height = src.height; }
    lg.drawImage(src, 0, 0);
  };
  map.on('render', grab);

  // Höhenprofil vorberechnen
  const prof = [];
  const n = 120;
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i <= n; i++) {
    const d = (i / n) * r.total;
    let j = r.cum.findIndex((c) => c >= d); if (j < 0) j = r.cum.length - 1;
    const z = r.coords[j][2] ?? 0;
    prof.push(z); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
  }
  const seconds = o.seconds || Math.max(12, Math.min(22, r.total / 1000 * 1.2));
  const outroMs = 2200;
  let ending = 0, t0 = performance.now();

  const draw = () => {
    // Karte „cover“ ins Hochformat
    g.fillStyle = '#070b10'; g.fillRect(0, 0, W, H);
    if (last.width) {
      const s = Math.max(W / last.width, H / last.height);
      const dw = last.width * s, dh = last.height * s;
      g.drawImage(last, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // Fahrer-Punkt
      if (flyState.p && !ending) {
        const pt = map.project(flyState.p);
        const ratio = last.width / map.getContainer().clientWidth;
        const x = (W - dw) / 2 + pt.x * ratio * s, y = (H - dh) / 2 + pt.y * ratio * s;
        const pulse = 1 + 0.25 * Math.sin(performance.now() / 180);
        g.fillStyle = 'rgba(139,225,58,.35)'; g.beginPath(); g.arc(x, y, 22 * pulse, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill();
        g.fillStyle = '#8be13a'; g.beginPath(); g.arc(x, y, 7.5, 0, 7); g.fill();
      }
    }
    // obere Verlaufsblende + Marke
    let gr = g.createLinearGradient(0, 0, 0, 260);
    gr.addColorStop(0, 'rgba(5,8,12,.75)'); gr.addColorStop(1, 'rgba(5,8,12,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 260);
    g.font = '900 46px Inter, system-ui, sans-serif'; g.textBaseline = 'top';
    g.fillStyle = '#fff'; g.fillText('Ride', 44, 52);
    const rw = g.measureText('Ride').width;
    g.fillStyle = '#8be13a'; g.fillText('Bike', 44 + rw, 52);
    g.font = '600 26px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(o.title || 'Meine Tour in 3D', 46, 112, W - 92);
    if (o.sub) { g.font = '500 22px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(o.sub, 46, 148, W - 92); }

    // untere Karte: Werte + Höhenprofil
    gr = g.createLinearGradient(0, H - 420, 0, H);
    gr.addColorStop(0, 'rgba(5,8,12,0)'); gr.addColorStop(1, 'rgba(5,8,12,.85)');
    g.fillStyle = gr; g.fillRect(0, H - 420, W, 420);
    const bx = 36, by = H - 300, bw = W - 72, bh = 250;
    roundRect(g, bx, by, bw, bh, 30); g.fillStyle = 'rgba(14,20,28,.72)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 2; g.stroke();
    const k = ending ? 1 : flyState.k;
    const vals = [
      ['Strecke', fmtDist(r.total * (ending ? 1 : Math.min(1, flyState.d / r.total || 0)))],
      ['Höhenmeter', r.hasEle ? `+${Math.round(r.ascent).toLocaleString('de-DE')} m` : '–'],
      ['Fahrzeit', fmtDur(r.time)]
    ];
    vals.forEach(([l, v], i) => {
      const cx = bx + 30 + i * (bw - 60) / 3;
      g.font = '800 38px Inter, system-ui, sans-serif'; g.fillStyle = i === 1 ? '#8be13a' : '#fff'; g.fillText(v, cx, by + 26, (bw - 60) / 3 - 10);
      g.font = '600 20px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(l, cx, by + 74);
    });
    // Profil
    const px = bx + 30, py = by + 118, pw = bw - 60, ph = 100;
    const yOf = (z) => py + ph - ((z - zmin) / Math.max(1, zmax - zmin)) * ph;
    g.beginPath(); g.moveTo(px, py + ph);
    prof.forEach((z, i) => g.lineTo(px + (i / n) * pw, yOf(z)));
    g.lineTo(px + pw, py + ph); g.closePath();
    gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, 'rgba(139,225,58,.55)'); gr.addColorStop(1, 'rgba(139,225,58,.05)');
    g.fillStyle = gr; g.fill();
    g.save(); g.beginPath(); g.rect(px, py - 10, pw * k, ph + 20); g.clip();
    g.beginPath(); prof.forEach((z, i) => (i ? g.lineTo : g.moveTo).call(g, px + (i / n) * pw, yOf(z)));
    g.strokeStyle = '#8be13a'; g.lineWidth = 4; g.stroke(); g.restore();
    const ki = Math.round(k * n);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px + k * pw, yOf(prof[ki] ?? zmin), 8, 0, 7); g.fill();

    if (o.watermark !== false) {
      g.font = '600 20px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)';
      g.textAlign = 'right'; g.fillText('Erstellt mit RideBike', W - 44, H - 40); g.textAlign = 'left';
    }
    // Abspann
    if (ending) {
      const a = Math.min(1, (performance.now() - ending) / 600);
      g.fillStyle = `rgba(5,8,12,${0.55 * a})`; g.fillRect(0, 0, W, H);
      g.globalAlpha = a; g.textAlign = 'center';
      g.font = '900 64px Inter, system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(fmtDist(r.total), W / 2, H / 2 - 150);
      g.font = '700 30px Inter, system-ui, sans-serif'; g.fillStyle = '#8be13a'; g.fillText('Tour geschafft!', W / 2, H / 2 - 70);
      g.textAlign = 'left'; g.globalAlpha = 1;
    }
  };

  return new Promise((resolve, reject) => {
    const stream = out.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    let raf = 0;
    const cleanup = () => { cancelAnimationFrame(raf); map.off('render', grab); stopFlyover(); };
    rec.onstop = () => {
      cleanup();
      const type = mime.split(';')[0];
      resolve({ blob: new Blob(chunks, { type }), mime: type, ext: type.includes('mp4') ? 'mp4' : 'webm' });
    };
    rec.onerror = (e) => { cleanup(); reject(e.error || new Error('Aufnahme fehlgeschlagen')); };
    const loop = () => {
      draw();
      o.onProgress?.(ending ? 1 : flyState.k);
      o.onFrame?.(out);
      if (ending && performance.now() - ending > outroMs) { rec.state === 'recording' && rec.stop(); return; }
      raf = requestAnimationFrame(loop);
    };
    rec.start(500);
    t0 = performance.now();
    startFlyover(() => { ending = performance.now(); map.triggerRepaint(); }, { duration: seconds * 1000 });
    loop();
    o.signal?.addEventListener('abort', () => { ending = performance.now() - outroMs; });
  });
}

/** Video teilen (Android: Teilen-Menü) bzw. herunterladen (Browser) */
export async function shareVideo({ blob, ext }, name = 'RideBike-Tour') {
  const file = `${name}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    const w = await Filesystem.writeFile({ path: file, data: b64, directory: Directory.Cache });
    await Share.share({ title: 'Meine Tour mit RideBike', text: 'Meine Tour in 3D – erstellt mit RideBike', url: w.uri, dialogTitle: 'Video teilen' });
    return 'shared';
  }
  const f = new File([blob], file, { type: blob.type });
  if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'Meine Tour mit RideBike' }); return 'shared'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'downloaded';
}
