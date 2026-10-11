// Static checks: JS syntax, generated asset paths, unique HTML IDs, and well-formed SVG (an unescaped "&" once broke half the thumbnails).
import {readFile, access, readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const html = await readFile('dist/index.html', 'utf8');
for (const resource of ['dist/styles.css', 'dist/app.mjs', 'dist/catalog.json', 'dist/seed.json', 'dist/runtime.json', 'dist/brand/favicon.svg']) await access(resource);
const js = ['dist/app.mjs', ...(await readdir('dist/lib')).map(f => `dist/lib/${f}`), 'capture/policy.mjs', 'capture/worker.mjs', 'capture/queue.mjs', ...(await readdir('scripts')).filter(x => x.endsWith('.mjs')).map(x => `scripts/${x}`)];
for (const f of js) execFileSync(process.execPath, ['--check', f]);
const apps = JSON.parse(await readFile('dist/catalog.json', 'utf8'));
for (const a of apps) for (const p of [a.art.wide, a.art.tall, a.thumbnailPath]) await access(`dist/${p}`);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]); if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
let svgs = 0;
for (const dir of ['art', 'thumbnails', 'brand']) for (const f of await readdir(`dist/${dir}`)) {
  const s = await readFile(`dist/${dir}/${f}`, 'utf8'); svgs++;
  if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(s)) throw new Error(`dist/${dir}/${f}: unescaped "&" makes the SVG invalid`);
  if (!s.startsWith('<svg') || !s.trimEnd().endsWith('</svg>')) throw new Error(`dist/${dir}/${f}: not a complete SVG`);
}
console.log(`Checked ${js.length} scripts, ${apps.length} published apps, ${svgs} SVG files and HTML IDs.`);

