// Copies the static app into dist/ for deployment (no bundler needed).
import fs from 'node:fs';
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
for (const p of ['index.html', 'src', 'samples', 'docs']) if (fs.existsSync(p)) fs.cpSync(p, `dist/${p}`, { recursive: true });
fs.writeFileSync('dist/.nojekyll', '');
console.log('dist/ ready');
