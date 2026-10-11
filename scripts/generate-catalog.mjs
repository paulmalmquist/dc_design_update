// Build: validate the sample data, then write the public catalog, the browser seed, constellation art and brand files.
import {readFile, writeFile, mkdir, rm, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {enrich, thumbnailSvg} from '../dist/lib/catalog.mjs';
import {artSvg, validateKeyVisual} from '../dist/lib/constellation.mjs';
import {seedDb} from '../dist/lib/db-core.mjs';
import {markSvg, faviconSvg} from '../dist/lib/brand.mjs';
import {usableCapture} from '../capture/policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async f => JSON.parse(await readFile(path.join(root, f), 'utf8'));
const out = (f, s) => writeFile(path.join(root, 'dist', f), s);
const apps = await read('data/apps.json'), users = await read('data/users.json');
if (!Array.isArray(apps) || !Array.isArray(users)) throw new Error('data/apps.json and data/users.json must be arrays.');
seedDb({apps, users});                                       // validates every record; throws on the first bad one
const ids = new Set(); for (const a of apps) { if (ids.has(a.id)) throw new Error(`Duplicate ID: ${a.id}`); ids.add(a.id); }

let captures = {apps: {}, maxAgeHours: 168};
try { captures = await read('data/capture-manifest.json'); } catch (e) { if (e.code !== 'ENOENT') throw e; }

for (const dir of ['art', 'thumbnails', 'brand']) { await rm(path.join(root, 'dist', dir), {recursive: true, force: true}); await mkdir(path.join(root, 'dist', dir), {recursive: true}); }
const seedApps = [], catalog = [];
for (const raw of apps) {
  const rec = {...raw}, cap = captures.apps?.[raw.id];
  if (usableCapture(cap, Date.now(), captures.maxAgeHours)) {
    try {
      await access(path.join(root, 'dist', cap.path)); rec.screenshot = {path: cap.path, capturedAt: cap.capturedAt, approved: true, expiresAt: new Date(Date.parse(cap.capturedAt) + (captures.maxAgeHours || 168) * 3600000).toISOString()};
      if (cap.keyVisual) { rec.keyVisual = validateKeyVisual(cap.keyVisual); rec.keyVisualSource = 'app'; }   // the app's own graph wins
    } catch { console.warn(`${raw.id}: screenshot file missing; skipping it.`); }
  }
  seedApps.push(rec);
  const app = enrich(rec);
  await out(`art/${app.id}-wide.svg`, artSvg(app, {shape: 'wide'}));
  await out(`art/${app.id}-tall.svg`, artSvg(app, {shape: 'tall'}));
  await out(`thumbnails/${app.id}.svg`, thumbnailSvg(rec));
  if ((raw.status || 'published') === 'published') catalog.push({...app, art: {wide: `art/${app.id}-wide.svg`, tall: `art/${app.id}-tall.svg`}, thumbnailPath: rec.screenshot?.path || `thumbnails/${app.id}.svg`, ...(rec.screenshot ? {screenshot: rec.screenshot} : {})});
}
await out('catalog.json', JSON.stringify(catalog, null, 2) + '\n');          // public, published apps only
await out('seed.json', JSON.stringify({apps: seedApps, users}) + '\n');       // sample data for the in-browser store
await out('runtime.json', JSON.stringify({mode: process.argv.includes('--demo') ? 'demo' : 'server'}) + '\n');
await out('brand/favicon.svg', faviconSvg());
await out('brand/mark.svg', markSvg({id: 'b'}).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
console.log(`Built ${catalog.length} published apps (${apps.length} records), ${apps.length * 3} art files and brand assets.`);

