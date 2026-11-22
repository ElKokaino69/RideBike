// RideBike – Sicherheit: Sturzerkennung & Notfall
// © 2026 Florian Enders
//
// Während einer Fahrt (Aufzeichnung oder Navigation) wird der Beschleunigungssensor
// beobachtet. Ein harter Aufprall (> ~3,5 g) mit anschließendem Stillstand löst einen
// Countdown aus. Reagiert niemand, öffnet die App eine Notfall-SMS mit Standort-Link.

import { settings } from './settings.js';

let active = false;
let impactAt = 0;
let lastMove = 0;
let onAlarm = null;
let speedFn = () => 0;
const G = 9.81;

function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a || a.x == null) return;
  const mag = Math.hypot(a.x, a.y, a.z);
  const now = Date.now();
  if (Math.abs(mag - G) > 2.5) lastMove = now;
  if (mag > 3.5 * G && now - impactAt > 15000) {
    impactAt = now;
    // nach dem Aufprall 8 s prüfen: liegt das Handy still und steht das Rad?
    setTimeout(() => {
      const still = Date.now() - lastMove > 4000;
      const stopped = speedFn() < 3;
      if (active && still && stopped) onAlarm?.('fall');
    }, 8000);
  }
}

export function startFallDetection(opts) {
  if (active || !settings.safety?.fall) return;
  onAlarm = opts.onAlarm; speedFn = opts.speed || speedFn;
  active = true; lastMove = Date.now();
  window.addEventListener('devicemotion', onMotion);
}

export function stopFallDetection() {
  active = false;
  window.removeEventListener('devicemotion', onMotion);
}

export const fallActive = () => active;

export function locationLink([lng, lat]) {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function emergencyText(pos, reason = 'fall') {
  const where = pos ? locationLink(pos) : 'Standort unbekannt';
  return reason === 'fall'
    ? `RideBike Notfall: Ich bin mit dem Rad gestürzt und reagiere nicht. Mein Standort: ${where}`
    : `Mein aktueller Standort (RideBike): ${where}`;
}

/** SMS-App mit vorausgefüllter Nachricht öffnen (Android: sms:nummer?body=) */
export function openSms(phone, text) {
  const num = String(phone || '').replace(/[^\d+]/g, '');
  window.location.href = `sms:${num}?body=${encodeURIComponent(text)}`;
}

export function callNumber(n) { window.location.href = `tel:${n}`; }
