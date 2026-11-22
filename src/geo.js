// RideBike – Geometrie-Helfer
// © 2026 Florian Enders

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function dist(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function angleDiff(a, b) {
  let d = ((b - a + 540) % 360) - 180;
  return d;
}

export function lerpAngle(a, b, t) {
  return (a + angleDiff(a, b) * t + 360) % 360;
}

export function cumulative(coords) {
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + dist(coords[i - 1], coords[i]);
  return cum;
}

// Punkt bei Distanz d entlang der Linie
export function along(coords, cum, d) {
  if (d <= 0) return coords[0];
  const total = cum[cum.length - 1];
  if (d >= total) return coords[coords.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid; else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  const a = coords[lo], b = coords[hi];
  const ea = a[2], eb = b[2];
  const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  if (ea != null && eb != null) p.push(ea + (eb - ea) * t);
  return p;
}

// Lokale Projektion (äquirektangulär) für Punkt-Segment-Abstände
function proj(p, lat0) {
  return [rad(p[0]) * Math.cos(rad(lat0)) * R, rad(p[1]) * R];
}

/**
 * Nächster Punkt auf Linie.
 * @returns {{dist:number, along:number, idx:number, point:number[]}}
 */
export function nearestOnLine(coords, cum, p, from = 0, to = coords.length - 1) {
  from = Math.max(0, from);
  to = Math.min(coords.length - 1, to);
  const lat0 = p[1];
  const P = proj(p, lat0);
  let best = { dist: Infinity, along: 0, idx: from, point: coords[from] };
  for (let i = from; i < to; i++) {
    const A = proj(coords[i], lat0), B = proj(coords[i + 1], lat0);
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const x = A[0] + t * dx, y = A[1] + t * dy;
    const d = Math.hypot(P[0] - x, P[1] - y);
    if (d < best.dist) {
      const a = coords[i], b = coords[i + 1];
      best = {
        dist: d,
        idx: i,
        along: cum[i] + (cum[i + 1] - cum[i]) * t,
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      };
    }
  }
  return best;
}

export function bboxOf(coords) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const c of coords) {
    if (c[0] < w) w = c[0];
    if (c[0] > e) e = c[0];
    if (c[1] < s) s = c[1];
    if (c[1] > n) n = c[1];
  }
  return [[w, s], [e, n]];
}

export function lineLength(coords) {
  let l = 0;
  for (let i = 1; i < coords.length; i++) l += dist(coords[i - 1], coords[i]);
  return l;
}

export function fmtDist(m) {
  if (m == null || isNaN(m)) return '–';
  if (m < 950) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 1000)} km`;
}

export function fmtDur(sec) {
  if (sec == null || isNaN(sec)) return '–';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')}`;
}

export function fmtClock(date) {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
