// Baut RideBike als eine einzige, funktionsfähige HTML-Datei (dist-single/RideBike-App.html)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
execSync('npx vite build -c vite.single.config.js', { stdio: 'inherit' });
let html = fs.readFileSync('dist-single/index.html', 'utf8');
for (const f of ['logo.svg', 'peaks.svg']) {
  const uri = 'data:image/svg+xml;base64,' + fs.readFileSync(`public/${f}`).toString('base64');
  html = html.split(`./${f}`).join(uri);
}
fs.writeFileSync('dist-single/RideBike-App.html', html);
fs.rmSync('dist-single/index.html');
for (const f of fs.readdirSync('dist-single')) if (f !== 'RideBike-App.html') fs.rmSync(`dist-single/${f}`, { recursive: true });
console.log('→ dist-single/RideBike-App.html', (fs.statSync('dist-single/RideBike-App.html').size / 1e6).toFixed(1), 'MB');
