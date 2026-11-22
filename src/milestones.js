// RideBike – 50 Meilensteine mit Bronze, Silber und Gold
// © 2026 Florian Enders

export const TIERS = [
  { id: 'bronze', name: 'Bronze' },
  { id: 'silver', name: 'Silber' },
  { id: 'gold', name: 'Gold' }
];

export const CATS = [
  { id: 'dist', name: 'Distanz', color: '#5fd12f' },
  { id: 'climb', name: 'Höhenmeter', color: '#f59e0b' },
  { id: 'speed', name: 'Tempo', color: '#ef4444' },
  { id: 'endure', name: 'Ausdauer', color: '#3b82f6' },
  { id: 'time', name: 'Tageszeit & Saison', color: '#a855f7' },
  { id: 'terrain', name: 'Gelände & Trails', color: '#16a34a' },
  { id: 'explore', name: 'Entdecken', color: '#06b6d4' },
  { id: 'bike', name: 'Rad & Antrieb', color: '#eab308' },
  { id: 'photo', name: 'Fotojäger', color: '#ec4899' }
];

const maxOf = (o) => Object.values(o || {}).reduce((m, v) => Math.max(m, v), 0);
const size = (a) => (Array.isArray(a) ? a.length : 0);

/** Längste Serie aufeinanderfolgender Tage (Schlüssel YYYY-MM-DD) */
export function streakDays(days) {
  const sorted = [...new Set(days || [])].sort();
  let best = 0, cur = 0, prev = null;
  for (const d of sorted) {
    const t = Date.parse(d + 'T12:00:00');
    cur = prev != null && Math.round((t - prev) / 864e5) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

/** Längste Serie aufeinanderfolgender Kalenderwochen (Schlüssel = Wochenindex) */
export function streakWeeks(weeks) {
  const sorted = [...new Set(weeks || [])].map(Number).sort((a, b) => a - b);
  let best = 0, cur = 0, prev = null;
  for (const w of sorted) { cur = prev != null && w - prev === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = w; }
  return best;
}

// unit: km | hm | m | kmh | h | n | pct | scale
const ph = (s) => s.photo || {};
export const MILESTONES = [
  // ---------------- Fotojäger (7) – Foto-Spots im Sammelpass
  { id: 'ph_spots', cat: 'photo', icon: 'camera', name: 'Sammelpass', desc: 'Verschiedene Foto-Spots mit der App fotografiert', unit: 'n', t: [5, 25, 100], v: (s) => ph(s).spots },
  { id: 'ph_peaks', cat: 'photo', icon: 'peaks', name: 'Gipfelfoto', desc: 'Gipfel fotografiert', unit: 'n', t: [1, 10, 30], v: (s) => ph(s).peaks },
  { id: 'ph_castles', cat: 'photo', icon: 'shield', name: 'Burgenjäger', desc: 'Burgen und Ruinen fotografiert', unit: 'n', t: [1, 5, 15], v: (s) => ph(s).castles },
  { id: 'ph_views', cat: 'photo', icon: 'eye', name: 'Weitblick', desc: 'Aussichtspunkte und -türme fotografiert', unit: 'n', t: [3, 15, 50], v: (s) => ph(s).views },
  { id: 'ph_water', cat: 'photo', icon: 'wave', name: 'Wasserwelten', desc: 'Seen und Wasserfälle fotografiert', unit: 'n', t: [2, 10, 30], v: (s) => ph(s).water },
  { id: 'ph_kinds', cat: 'photo', icon: 'medal', name: 'Vielfalt', desc: 'Verschiedene Spot-Arten fotografiert', unit: 'n', t: [3, 5, 8], v: (s) => ph(s).kinds },
  { id: 'ph_day', cat: 'photo', icon: 'sun', name: 'Fotosafari', desc: 'Meiste neue Spots an einem Tag', unit: 'n', t: [3, 6, 10], v: (s) => ph(s).bestDay },

  // ---------------- Distanz (8)
  { id: 'total_km', cat: 'dist', icon: 'routeIc', name: 'Kilometerfresser', desc: 'Gesamtkilometer aller Fahrten', unit: 'km', t: [100, 1000, 5000], v: (s) => s.totalKm },
  { id: 'longest', cat: 'dist', icon: 'finish', name: 'Langstrecke', desc: 'Längste einzelne Tour', unit: 'km', t: [25, 50, 100], v: (s) => s.longestKm },
  { id: 'earth', cat: 'dist', icon: 'globe', name: 'Erdumrundung', desc: 'Gesamtkilometer bis einmal um die Erde', unit: 'km', t: [2500, 10000, 40075], v: (s) => s.totalKm },
  { id: 'day_km', cat: 'dist', icon: 'sun', name: 'Tagesetappe', desc: 'Meiste Kilometer an einem Tag', unit: 'km', t: [30, 80, 150], v: (s) => maxOf(s.dayKm) },
  { id: 'week_km', cat: 'dist', icon: 'calendar', name: 'Wochenpensum', desc: 'Meiste Kilometer in einer Kalenderwoche', unit: 'km', t: [50, 150, 300], v: (s) => maxOf(s.weekKm) },
  { id: 'month_km', cat: 'dist', icon: 'calendar', name: 'Monatsmarathon', desc: 'Meiste Kilometer in einem Monat', unit: 'km', t: [200, 500, 1000], v: (s) => maxOf(s.monthKm) },
  { id: 'fifties', cat: 'dist', icon: 'flag', name: 'Halbe Hundert', desc: 'Touren mit mindestens 50 km', unit: 'n', t: [3, 10, 30], v: (s) => s.fifties },
  { id: 'centuries', cat: 'dist', icon: 'trophy', name: 'Century Ride', desc: 'Touren mit mindestens 100 km', unit: 'n', t: [1, 5, 20], v: (s) => s.centuries },

  // ---------------- Höhenmeter (7)
  { id: 'total_hm', cat: 'climb', icon: 'peaks', name: 'Höhenjäger', desc: 'Gesamte Höhenmeter bergauf', unit: 'hm', t: [1000, 10000, 50000], v: (s) => s.totalHm },
  { id: 'ride_hm', cat: 'climb', icon: 'up', name: 'Bergetappe', desc: 'Meiste Höhenmeter auf einer Tour', unit: 'hm', t: [300, 1000, 2000], v: (s) => s.maxRideHm },
  { id: 'everest', cat: 'climb', icon: 'mountain', name: 'Everesting', desc: 'Höhenmeter in einer Woche – Gold = Mount Everest', unit: 'hm', t: [2000, 5000, 8848], v: (s) => maxOf(s.weekHm) },
  { id: 'max_alt', cat: 'climb', icon: 'flag', name: 'Dach der Tour', desc: 'Höchster erreichter Punkt über dem Meer', unit: 'm', t: [500, 1000, 2000], v: (s) => s.maxAlt },
  { id: 'climb_days', cat: 'climb', icon: 'peaks', name: 'Bergziege', desc: 'Touren mit mindestens 500 Höhenmetern', unit: 'n', t: [5, 20, 50], v: (s) => s.climbDays },
  { id: 'steepest', cat: 'climb', icon: 'up', name: 'Rampensau', desc: 'Steilste gefahrene Steigung (über 100 m)', unit: 'pct', t: [8, 12, 18], v: (s) => s.steepest },
  { id: 'descent', cat: 'climb', icon: 'down', name: 'Abfahrtskünstler', desc: 'Meiste Tiefenmeter auf einer Tour', unit: 'hm', t: [300, 1000, 2000], v: (s) => s.maxRideDescent },

  // ---------------- Tempo (5)
  { id: 'top_speed', cat: 'speed', icon: 'gauge', name: 'Höchstgeschwindigkeit', desc: 'Schnellste gemessene Geschwindigkeit', unit: 'kmh', t: [30, 50, 70], v: (s) => s.topSpeed },
  { id: 'best_avg', cat: 'speed', icon: 'fast', name: 'Tempomacher', desc: 'Bester Schnitt einer Tour ab 10 km', unit: 'kmh', t: [18, 24, 30], v: (s) => s.bestAvg },
  { id: 'fast_rides', cat: 'speed', icon: 'fast', name: 'Konstant schnell', desc: 'Touren ab 20 km mit Schnitt über 20 km/h', unit: 'n', t: [3, 15, 50], v: (s) => s.fastRides },
  { id: 'speed_km', cat: 'speed', icon: 'gauge', name: 'Tempokilometer', desc: 'Kilometer schneller als 25 km/h', unit: 'km', t: [10, 100, 500], v: (s) => s.speedKm },
  { id: 'fast_long', cat: 'speed', icon: 'routeIc', name: 'Windschnell', desc: 'Längste Tour mit Schnitt über 25 km/h', unit: 'km', t: [10, 30, 60], v: (s) => s.longestFastKm },

  // ---------------- Ausdauer (6)
  { id: 'total_time', cat: 'endure', icon: 'clock', name: 'Sattelzeit', desc: 'Gesamte Fahrzeit in Bewegung', unit: 'h', t: [10, 50, 200], v: (s) => s.totalTimeH },
  { id: 'long_time', cat: 'endure', icon: 'clock', name: 'Sitzfleisch', desc: 'Längste Fahrzeit einer Tour', unit: 'h', t: [1, 3, 6], v: (s) => s.longestTimeH },
  { id: 'rides', cat: 'endure', icon: 'bike', name: 'Stammgast', desc: 'Anzahl aufgezeichneter Fahrten', unit: 'n', t: [10, 50, 250], v: (s) => s.rides },
  { id: 'streak_days', cat: 'endure', icon: 'fire', name: 'Tagesserie', desc: 'Tage in Folge mit mindestens einer Fahrt', unit: 'n', t: [3, 7, 30], v: (s) => streakDays(s.rideDays) },
  { id: 'streak_weeks', cat: 'endure', icon: 'fire', name: 'Wochenserie', desc: 'Wochen in Folge mit mindestens einer Fahrt', unit: 'n', t: [4, 12, 52], v: (s) => streakWeeks(s.weeks) },
  { id: 'month_rides', cat: 'endure', icon: 'calendar', name: 'Vielfahrer', desc: 'Meiste Fahrten in einem Monat', unit: 'n', t: [8, 15, 25], v: (s) => maxOf(s.monthRides) },

  // ---------------- Tageszeit & Saison (7)
  { id: 'early', cat: 'time', icon: 'sunrise', name: 'Frühaufsteher', desc: 'Fahrten mit Start vor 7 Uhr', unit: 'n', t: [1, 10, 30], v: (s) => s.early },
  { id: 'night', cat: 'time', icon: 'moon', name: 'Nachtfalke', desc: 'Fahrten nach 21 Uhr', unit: 'n', t: [1, 10, 30], v: (s) => s.night },
  { id: 'golden', cat: 'time', icon: 'sun', name: 'Goldene Stunde', desc: 'Fahrten bei Sonnenauf- oder -untergang', unit: 'n', t: [1, 10, 25], v: (s) => s.golden },
  { id: 'weekend', cat: 'time', icon: 'calendar', name: 'Wochenendkrieger', desc: 'Fahrten am Samstag oder Sonntag', unit: 'n', t: [5, 25, 100], v: (s) => s.weekend },
  { id: 'commute', cat: 'time', icon: 'bike', name: 'Pendler', desc: 'Werktags-Fahrten zur Rushhour (6–9 und 16–19 Uhr)', unit: 'n', t: [10, 50, 200], v: (s) => s.commute },
  { id: 'winter', cat: 'time', icon: 'snow', name: 'Wintertreu', desc: 'Fahrten im Dezember, Januar oder Februar', unit: 'n', t: [1, 10, 30], v: (s) => s.winter },
  { id: 'months', cat: 'time', icon: 'calendar', name: 'Ganzjahresfahrer', desc: 'Verschiedene Kalendermonate mit Fahrten', unit: 'n', t: [4, 8, 12], v: (s) => size(s.months) },

  // ---------------- Gelände & Trails (7)
  { id: 'trails', cat: 'terrain', icon: 'trail', name: 'Trail-Entdecker', desc: 'Verschiedene Radrouten und Trails befahren', unit: 'n', t: [1, 10, 30], v: (s) => size(s.trails) },
  { id: 'mtb_km', cat: 'terrain', icon: 'mountain', name: 'Singletrail-Fan', desc: 'Kilometer auf MTB-Trails', unit: 'km', t: [5, 50, 250], v: (s) => s.mtbKm },
  { id: 'mtb_scale', cat: 'terrain', icon: 'mountain', name: 'Schwierigkeitsgrad', desc: 'Schwierigster gefahrener MTB-Trail', unit: 'scale', t: [1, 2, 3], v: (s) => s.maxMtb },
  { id: 'cycleway_km', cat: 'terrain', icon: 'bike', name: 'Radweg-Liebhaber', desc: 'Kilometer auf Radwegen', unit: 'km', t: [25, 250, 1000], v: (s) => s.cyclewayKm },
  { id: 'gravel_km', cat: 'terrain', icon: 'trail', name: 'Schotterkönig', desc: 'Kilometer auf Wald- und Feldwegen', unit: 'km', t: [10, 100, 500], v: (s) => s.gravelKm },
  { id: 'network_km', cat: 'terrain', icon: 'routeIc', name: 'Fernradler', desc: 'Kilometer auf beschilderten Radrouten', unit: 'km', t: [10, 100, 500], v: (s) => s.networkKm },
  { id: 'peaks', cat: 'terrain', icon: 'peaks', name: 'Gipfelstürmer', desc: 'Verschiedene Gipfel erreicht (bis 150 m)', unit: 'n', t: [1, 5, 20], v: (s) => size(s.peaks) },

  // ---------------- Entdecken (6)
  { id: 'cells10', cat: 'explore', icon: 'globe', name: 'Neue Regionen', desc: 'Besuchte 10-×-10-km-Gebiete', unit: 'n', t: [5, 25, 100], v: (s) => size(s.cells10) },
  { id: 'cells1', cat: 'explore', icon: 'layers', name: 'Kachelsammler', desc: 'Befahrene 1-km-Quadrate', unit: 'n', t: [50, 500, 2000], v: (s) => size(s.cells1) },
  { id: 'far_home', cat: 'explore', icon: 'home', name: 'Weit weg', desc: 'Größte Entfernung vom Startpunkt der ersten Fahrt', unit: 'km', t: [25, 100, 500], v: (s) => s.farHome },
  { id: 'arrivals', cat: 'explore', icon: 'finish', name: 'Ziel erreicht', desc: 'Navigationen bis ins Ziel', unit: 'n', t: [1, 10, 50], v: (s) => s.arrivals },
  { id: 'offline', cat: 'explore', icon: 'cloud', name: 'Funkloch-Profi', desc: 'Fahrten mit offline gespeicherten Karten', unit: 'n', t: [1, 5, 20], v: (s) => s.offlineRides },
  { id: 'flyovers', cat: 'explore', icon: 'fly', name: 'Vorausflieger', desc: '3D-Flyover vor der Tour angesehen', unit: 'n', t: [1, 10, 50], v: (s) => s.flyovers },

  // ---------------- Rad & Antrieb (4)
  { id: 'bike_types', cat: 'bike', icon: 'bike', name: 'Radsammler', desc: 'Verschiedene Radtypen gefahren', unit: 'n', t: [2, 4, 6], v: (s) => size(s.bikeTypes) },
  { id: 'ebike_km', cat: 'bike', icon: 'bolt', name: 'E-Power', desc: 'Kilometer mit Motorunterstützung', unit: 'km', t: [50, 500, 2000], v: (s) => s.ebikeKm },
  { id: 'muscle_km', cat: 'bike', icon: 'fire', name: 'Muskelkraft', desc: 'Kilometer ohne Motor', unit: 'km', t: [100, 1000, 5000], v: (s) => s.muscleKm },
  { id: 'cargo_km', cat: 'bike', icon: 'shield', name: 'Lastenträger', desc: 'Kilometer mit Lastenrad oder mind. 10 kg Gepäck', unit: 'km', t: [10, 100, 500], v: (s) => s.cargoKm }
];

if (MILESTONES.length !== 50) console.warn('Meilensteine:', MILESTONES.length);

export function tierOf(m, value) {
  let t = 0;
  for (let i = 0; i < 3; i++) if ((value || 0) >= m.t[i]) t = i + 1;
  return t;
}

export function fmtValue(m, v) {
  const n = Number(v) || 0;
  const de = (x, d = 0) => x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  switch (m.unit) {
    case 'km': return `${de(n, n < 100 && n % 1 ? 1 : 0)} km`;
    case 'hm': return `${de(Math.round(n))} hm`;
    case 'm': return `${de(Math.round(n))} m`;
    case 'kmh': return `${de(n, n % 1 ? 1 : 0)} km/h`;
    case 'h': return `${de(n, n < 10 && n % 1 ? 1 : 0)} h`;
    case 'pct': return `${de(n, n % 1 ? 1 : 0)} %`;
    case 'scale': return n >= 0 ? `S${Math.round(n)}` : '–';
    default: return de(Math.round(n));
  }
}

/** Fortschritt zur nächsten Stufe (0..1) */
export function progress(m, value) {
  const t = tierOf(m, value);
  if (t >= 3) return 1;
  const lo = t === 0 ? (m.unit === 'scale' ? 0 : 0) : m.t[t - 1];
  const hi = m.t[t];
  return Math.max(0, Math.min(1, ((value || 0) - lo) / (hi - lo)));
}

/** Alle Stufen für einen Statistikstand */
export function evaluate(stats) {
  const out = {};
  for (const m of MILESTONES) {
    const value = m.v(stats) || 0;
    out[m.id] = { value, tier: tierOf(m, value) };
  }
  return out;
}

export function medalCounts(ev) {
  const c = { bronze: 0, silver: 0, gold: 0 };
  for (const { tier } of Object.values(ev)) {
    if (tier >= 1) c.bronze++;
    if (tier >= 2) c.silver++;
    if (tier >= 3) c.gold++;
  }
  return c;
}

/** Neu erreichte Stufen zwischen zwei Auswertungen */
export function diffTiers(before, after) {
  const out = [];
  for (const m of MILESTONES) {
    const a = before[m.id]?.tier || 0, b = after[m.id]?.tier || 0;
    for (let t = a + 1; t <= b; t++) out.push({ m, tier: t, value: after[m.id].value });
  }
  return out;
}
