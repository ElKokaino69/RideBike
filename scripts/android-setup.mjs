// RideBike – Android-Projekt nach "npx cap add android" anpassen
// © 2026 Florian Enders
// Ergänzt Standort-Berechtigungen und App-Metadaten im AndroidManifest.

import fs from 'node:fs';
import path from 'node:path';

const manifest = path.resolve('android/app/src/main/AndroidManifest.xml');
if (!fs.existsSync(manifest)) {
  console.error('AndroidManifest.xml nicht gefunden – zuerst "npx cap add android" ausführen.');
  process.exit(1);
}

let xml = fs.readFileSync(manifest, 'utf8');
const perms = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
];

let added = 0;
for (const p of perms) {
  const name = p.match(/android:name="([^"]+)"/)[1];
  if (!xml.includes(`"${name}"`)) {
    xml = xml.replace(/<\/manifest>\s*$/, `    ${p}\n</manifest>\n`);
    added++;
  }
}

// TTS-Dienst (Android 11+ Paketsichtbarkeit) für Sprachansagen
if (!xml.includes('android.intent.action.TTS_SERVICE')) {
  xml = xml.replace(/<\/manifest>\s*$/, `    <queries>\n        <intent>\n            <action android:name="android.intent.action.TTS_SERVICE" />\n        </intent>\n    </queries>\n</manifest>\n`);
  added++;
}

fs.writeFileSync(manifest, xml);
console.log(`AndroidManifest aktualisiert (${added} Einträge ergänzt).`);

// Hochformat erzwingen ist bewusst NICHT gesetzt – Querformat am Lenker funktioniert ebenfalls.
