// RideBike – Routen-Analyse: Untergrund, Wegarten, Anstiege („Climb-Assistent“)
// © 2026 Florian Enders

// ---------- Untergrund & Wegart aus BRouter-WayTags ----------
export const SURF = [
  { id: 'asphalt', name: 'Asphalt', color: '#94a3b8' },
  { id: 'paved', name: 'Pflaster', color: '#a78bfa' },
  { id: 'gravel', name: 'Schotter', color: '#e3b341' },
  { id: 'unpaved', name: 'Erde & Wiese', color: '#b7793e' },
  { id: 'trail', name: 'Trail', color: '#ef4444' },
  { id: 'unknown', name: 'Unbekannt', color: '#475569' }
];
export const WAYS = [
  { id: 'cycleway', name: 'Radweg', color: '#5fd12f' },
  { id: 'quiet', name: 'Ruhige Straße', color: '#38bdf8' },
  { id: 'track', name: 'Wirtschaftsweg', color: '#3b82f6' },
  { id: 'path', name: 'Pfad', color: '#facc15' },
  { id: 'busy', name: 'Straße mit Verkehr', color: '#f97316' }
];

function tagsOf(s) {
  const t = {};
  for (const kv of String(s || '').split(' ')) { const i = kv.indexOf('='); if (i > 0) t[kv.slice(0, i)] = kv.slice(i + 1); }
  return t;
}

function classify(t) {
  const hw = t.highway || '';
  const s = t.surface || '';
  let surf = 'unknown';
  if (/^(asphalt|paved|concrete|concrete:plates|chipseal)$/.test(s)) surf = 'asphalt';
  else if (/^(paving_stones|sett|cobblestone|unhewn_cobblestone|bricks)$/.test(s)) surf = 'paved';
  else if (/^(gravel|fine_gravel|compacted|pebblestone)$/.test(s)) surf = 'gravel';
  else if (/^(dirt|ground|earth|grass|mud|sand|unpaved|wood|woodchips|rock)$/.test(s)) surf = 'unpaved';
  else if (!s) {
    if (/^(primary|secondary|tertiary|residential|unclassified|living_street|service|cycleway|trunk)/.test(hw)) surf = 'asphalt';
    else if (hw === 'track') surf = /grade1/.test(t.tracktype || '') ? 'asphalt' : /grade2/.test(t.tracktype || '') ? 'gravel' : 'unpaved';
    else if (hw === 'path' || hw === 'footway' || hw === 'bridleway') surf = 'unpaved';
  }
  if (t['mtb:scale'] && +t['mtb:scale'] >= 1) surf = 'trail';
  let way = 'quiet';
  if (hw === 'cycleway' || t.bicycle === 'designated' || /^(lane|track)$/.test(t.cycleway || t['cycleway:right'] || t['cycleway:both'] || '')) way = 'cycleway';
  else if (/^(primary|secondary|trunk)/.test(hw) || (hw === 'tertiary' && !t.cycleway)) way = 'busy';
  else if (hw === 'track') way = 'track';
  else if (/^(path|footway|bridleway|steps)$/.test(hw)) way = 'path';
  return { surf, way };
}

/** BRouter „messages“ → Meter je Untergrund/Wegart (+ Abschnitte für die Karte) */
export function analyzeSurface(messages) {
  const out = { surf: {}, way: {}, segs: [] };
  if (!Array.isArray(messages) || messages.length < 2) return null;
  const h = messages[0];
  const iD = h.indexOf('Distance'), iW = h.indexOf('WayTags');
  if (iD < 0 || iW < 0) return null;
  for (const row of messages.slice(1)) {
    const d = +row[iD] || 0;
    const c = classify(tagsOf(row[iW]));
    out.surf[c.surf] = (out.surf[c.surf] || 0) + d;
    out.way[c.way] = (out.way[c.way] || 0) + d;
    out.segs.push({ d, ...c });
  }
  return out;
}

// ---------- Anstiege ----------
/** Elevation glätten (gleitendes Mittel über ~60 m) */
function smooth(r) {
  const z = r.coords.map((c) => c[2] ?? 0);
  const out = new Array(z.length);
  let a = 0, sum = 0;
  for (let i = 0; i < z.length; i++) {
    sum += z[i];
    while (r.cum[i] - r.cum[a] > 60) { sum -= z[a]; a++; }
    out[i] = sum / (i - a + 1);
  }
  return out;
}

/**
 * Anstiege finden: min. 30 Hm, Ø ≥ 3 %, ≥ 300 m. Kategorie nach Länge × Steigung (wie im Radsport).
 * @returns [{ startM, endM, len, gain, avg, max, cat, catName }]
 */
export function findClimbs(r) {
  if (!r?.hasEle || r.coords.length < 5) return [];
  const z = smooth(r);
  const res = [];
  let i = 0;
  const n = z.length;
  while (i < n - 1) {
    // Beginn: es geht bergauf
    if (z[i + 1] <= z[i]) { i++; continue; }
    let s = i, top = i, j = i;
    while (j < n - 1) {
      j++;
      if (z[j] > z[top]) top = j;
      if (z[top] - z[j] > 12 || (r.cum[j] - r.cum[top] > 500 && z[j] <= z[top])) break; // Abfahrt > 12 m oder lange flach
    }
    const len = r.cum[top] - r.cum[s];
    const gain = z[top] - z[s];
    if (gain >= 30 && len >= 300 && gain / len >= 0.03) {
      let max = 0;
      for (let k = s, b = s; k <= top; k++) {
        while (r.cum[k] - r.cum[b] > 100) b++;
        if (r.cum[k] - r.cum[b] > 50) max = Math.max(max, (z[k] - z[b]) / (r.cum[k] - r.cum[b]));
      }
      const avg = gain / len;
      const score = len * avg * 100;
      const cat = score >= 80000 ? 0 : score >= 64000 ? 1 : score >= 32000 ? 2 : score >= 16000 ? 3 : score >= 8000 ? 4 : 5;
      res.push({ startM: r.cum[s], endM: r.cum[top], len, gain, avg, max: Math.max(max, avg), cat,
        catName: ['HC', 'Kat. 1', 'Kat. 2', 'Kat. 3', 'Kat. 4', 'Hügel'][cat], startEle: z[s], topEle: z[top], i0: s, i1: top });
    }
    i = Math.max(top, i + 1);
  }
  return res;
}

export const gradeColor = (g) => (g < 0.03 ? '#5fd12f' : g < 0.06 ? '#facc15' : g < 0.09 ? '#f97316' : g < 0.12 ? '#ef4444' : '#991b1b');

/** Mini-Höhenprofil eines Anstiegs als SVG (eingefärbt nach Steigung) */
export function climbSvg(r, c, w = 120, h = 34, progressM = null) {
  const z = smooth(r);
  const pts = [];
  const steps = 24;
  for (let k = 0; k <= steps; k++) {
    const d = c.startM + (k / steps) * c.len;
    let i = r.cum.findIndex((x) => x >= d); if (i < 0) i = r.cum.length - 1;
    pts.push([d, z[i]]);
  }
  const zmin = Math.min(...pts.map((p) => p[1])), zmax = Math.max(...pts.map((p) => p[1]));
  const X = (d) => ((d - c.startM) / c.len) * w, Y = (v) => h - 2 - ((v - zmin) / Math.max(1, zmax - zmin)) * (h - 6);
  let bars = '';
  for (let k = 0; k < steps; k++) {
    const g = (pts[k + 1][1] - pts[k][1]) / (pts[k + 1][0] - pts[k][0]);
    const x0 = X(pts[k][0]), x1 = X(pts[k + 1][0]);
    bars += `<path d="M${x0.toFixed(1)} ${h} L${x0.toFixed(1)} ${Y(pts[k][1]).toFixed(1)} L${x1.toFixed(1)} ${Y(pts[k + 1][1]).toFixed(1)} L${x1.toFixed(1)} ${h}Z" fill="${gradeColor(g)}" opacity="${progressM != null && pts[k + 1][0] <= progressM ? 0.35 : 0.95}"/>`;
  }
  const mark = progressM != null && progressM >= c.startM && progressM <= c.endM ? `<line x1="${X(progressM)}" x2="${X(progressM)}" y1="0" y2="${h}" stroke="#fff" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="climb-svg">${bars}${mark}</svg>`;
}

// ---------- GPX ----------
export function toGpx(r, name = 'RideBike-Tour') {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const pts = r.coords.map((c) => `<trkpt lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}">${c[2] != null ? `<ele>${c[2].toFixed(1)}</ele>` : ''}</trkpt>`).join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RideBike – © Florian Enders" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date().toISOString()}</time></metadata>
  <trk><name>${esc(name)}</name><type>cycling</type>
    <trkseg>
      ${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** GPX lesen (Track oder Route) → Koordinaten [lng, lat, ele] + Name */
export function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Keine gültige GPX-Datei');
  let nodes = [...doc.getElementsByTagName('trkpt')];
  if (!nodes.length) nodes = [...doc.getElementsByTagName('rtept')];
  if (!nodes.length) nodes = [...doc.getElementsByTagName('wpt')];
  const coords = nodes.map((n) => {
    const e = n.getElementsByTagName('ele')[0];
    return [+n.getAttribute('lon'), +n.getAttribute('lat'), e ? +e.textContent : null];
  }).filter((c) => isFinite(c[0]) && isFinite(c[1]));
  if (coords.length < 2) throw new Error('Die Datei enthält keinen Track');
  const name = (doc.querySelector('trk > name') || doc.querySelector('rte > name') || doc.querySelector('metadata > name'))?.textContent?.trim() || 'Importierte Tour';
  // zu dichte Tracks ausdünnen (Navigation & Darstellung)
  const out = [coords[0]];
  for (const c of coords.slice(1)) {
    const p = out[out.length - 1];
    if (Math.abs(c[0] - p[0]) + Math.abs(c[1] - p[1]) > 0.00004) out.push(c);
  }
  return { coords: out, name };
}
