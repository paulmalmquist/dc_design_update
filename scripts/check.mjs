import {readFile,access,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const html=await readFile('dist/index.html','utf8');
for(const resource of ['dist/styles.css','dist/app.mjs','dist/catalog.json'])await access(resource);
for(const f of ['dist/app.mjs','dist/lib/catalog.mjs','capture/policy.mjs','capture/worker.mjs',...(await readdir('scripts')).filter(x=>x.endsWith('.mjs')).map(x=>'scripts/'+x)])execFileSync(process.execPath,['--check',f]);
const apps=JSON.parse(await readFile('dist/catalog.json','utf8'));
for(const a of apps)await access('dist/'+a.thumbnailPath);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);if(new Set(ids).size!==ids.length)throw new Error('Duplicate HTML IDs');
console.log(`Validated JavaScript syntax, ${apps.length} thumbnail paths, HTML IDs, and required app assets.`);
