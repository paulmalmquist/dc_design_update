import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {enrich,thumbnailSvg} from '../dist/lib/catalog.mjs';
import {usableCapture} from '../capture/policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=JSON.parse(await readFile(path.join(root,'data/apps.json'),'utf8'));
if(!Array.isArray(input)) throw new Error('Catalog must be an array.');
let captures={apps:{},maxAgeHours:168};
try {captures=JSON.parse(await readFile(path.join(root,'data/capture-manifest.json'),'utf8'));} catch(error) {if(error.code!=='ENOENT')throw error;}
const seen=new Set();
// Validate the entire batch before writes; fail rather than silently publishing bad entries.
const apps=input.map(a=>{const app=enrich(a); if(seen.has(app.id)) throw new Error(`Duplicate ID: ${app.id}`); seen.add(app.id); return app;});
for(const app of apps) if(app.artworkSource==='approved-screenshot') await access(path.join(root,'dist',app.screenshotPath));
await mkdir(path.join(root,'dist/thumbnails'),{recursive:true});
for(const app of apps) {
  await writeFile(path.join(root,`dist/thumbnails/${app.id}.svg`),thumbnailSvg(app));
  app.thumbnailPath=app.artworkSource==='approved-screenshot'?app.screenshotPath:`thumbnails/${app.id}.svg`;
  const capture=captures.apps?.[app.id];
  if(usableCapture(capture,Date.now(),captures.maxAgeHours)){
    try{await access(path.join(root,'dist',capture.path));app.thumbnailPath=capture.path;app.artworkSource='captured-screenshot';app.capturedAt=capture.capturedAt;app.captureRevision=capture.revision;}catch{console.warn(`${app.id}: screenshot file missing; using fallback.`);}
  }
}
await writeFile(path.join(root,'dist/catalog.json'),JSON.stringify(apps,null,2)+'\n');
console.log(`Generated ${apps.length} app thumbnails and descriptions from supplied metadata.`);
