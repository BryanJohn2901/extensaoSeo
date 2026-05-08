const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outFile = path.join(ROOT, `seo-analyzer-pro-v${version}.zip`);

if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

const files = [
  'manifest.json',
  'dist/popup.js',
  'dist/content-script.js',
  'dist/background-script.js',
  'src/popup/popup.html',
  'src/popup/popup.css',
  'public/icons/icon-16.png',
  'public/icons/icon-48.png',
  'public/icons/icon-128.png',
  'public/icons/icon-256.png',
];

for (const f of files) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.error(`ERRO: arquivo esperado nao encontrado: ${f}`);
    process.exit(1);
  }
}

execSync(`cd "${ROOT}" && zip -r "${outFile}" ${files.map(f => `"${f}"`).join(' ')}`);

const stats = fs.statSync(outFile);
console.log(`\nPacote gerado: ${path.basename(outFile)} (${(stats.size / 1024).toFixed(1)} KB)`);
console.log('Pronto para upload na Chrome Web Store.');
