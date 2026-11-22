// RideBike – Einstellungen (persistent)
// © 2026 Florian Enders

import { Preferences } from '@capacitor/preferences';
import { DEFAULT_SETTINGS } from './config.js';
import { DEFAULT_BIKE } from './bike-defaults.js';

const KEY = 'ridebike.settings.v1';
const listeners = new Set();

export const settings = structuredClone({ ...DEFAULT_SETTINGS, bike: DEFAULT_BIKE });

export async function loadSettings() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      const saved = JSON.parse(value);
      Object.assign(settings, saved, {
        layers: { ...DEFAULT_SETTINGS.layers, ...(saved.layers || {}) },
        bike: { ...DEFAULT_BIKE, ...(saved.bike || {}) },
        details: { ...DEFAULT_SETTINGS.details, ...(saved.details || {}) },
        safety: { ...DEFAULT_SETTINGS.safety, ...(saved.safety || {}) }
      });
    }
    // Einmalig auf das neue Premium-Erscheinungsbild umstellen (Satellit 3D)
    if (!settings.designVersion || settings.designVersion < 14) {
      if (settings.style === 'liberty') settings.style = 'satellite';
      settings.designVersion = 14;
      saveSettings();
    }
    // v1.5: fotorealistische 3D-Ansicht – steilere Kamera, Horizont sichtbar
    if (settings.designVersion < 15) {
      if (settings.pitch <= 60) settings.pitch = 78;
      if (settings.exaggeration === 1.4) settings.exaggeration = 1.5;
      settings.designVersion = 15;
      saveSettings();
    }
    // v1.5.1: Weitwinkel-Kamera – etwas flachere Neigung, natürliche Überhöhung
    if (settings.designVersion < 16) {
      if (settings.pitch >= 74) settings.pitch = 70;
      if (settings.exaggeration >= 1.4 && settings.exaggeration <= 1.5) settings.exaggeration = 1.3;
      settings.designVersion = 16;
      saveSettings();
    }
  } catch (e) {
    console.warn('Einstellungen konnten nicht geladen werden', e);
  }
  return settings;
}

let saveTimer = null;
export function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    Preferences.set({ key: KEY, value: JSON.stringify(settings) }).catch(() => {});
  }, 250);
}

/** Setzt einen Wert (Pfad mit Punkt, z.B. "layers.mtb") und benachrichtigt Listener. */
export function setSetting(path, value) {
  const parts = path.split('.');
  let o = settings;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts.at(-1)] = value;
  saveSettings();
  listeners.forEach((fn) => fn(path, value));
}

export function getSetting(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), settings);
}

export function onSettingChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
