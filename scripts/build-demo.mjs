// Fügt das Demo-Paket in die Einzel-HTML ein → RideBike-Demo.html
import fs from 'fs';
const html = fs.readFileSync(process.argv[2] || 'dist-single/RideBike-App.html', 'utf8');
const pack = fs.readFileSync(process.argv[3] || 'demo-pack.json', 'utf8');
const tag = `<script id="rb-demo" type="application/json">${pack.replace(/<\//g, '<\\/')}</script>`;
const out = html.replace('</body>', tag + '\n</body>');
fs.writeFileSync(process.argv[4] || 'RideBike-Demo.html', out);
console.log('Demo-HTML', (out.length / 1e6).toFixed(1), 'MB');
