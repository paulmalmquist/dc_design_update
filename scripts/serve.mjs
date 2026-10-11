// Local dev server: serves dist/ and the Dreamcatcher CRUD API from a JSON-file database (data/db.json).
// The API is the same contract the real Dreamcatcher database implements in production (docs/CRUD_CONTRACT.md).
// Identity here is a dev cookie with sample users. Production identity must come from your sign-in system.
import http from 'node:http';
import path from 'node:path';
import {readFile, writeFile, rename, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {handle, seedDb} from '../dist/lib/db-core.mjs';
import {usableCapture} from '../capture/policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const DB_FILE = process.env.DREAMCATCHER_DB || path.join(root, 'data/db.json');
const DEV_AUTH = process.env.DEV_AUTH !== '0';
// With DEV_AUTH=0 the dc_user cookie is ignored. Identity then comes only from a header your sign-in proxy sets
// (TRUSTED_USER_HEADER, e.g. x-forwarded-user), naming a user ID in the database. No header, no access.
const TRUSTED_USER_HEADER = (process.env.TRUSTED_USER_HEADER || '').toLowerCase();
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain'};
const port = Number(process.env.PORT || 4173);

async function seed() {
  const [apps, users] = await Promise.all(['data/apps.json', 'data/users.json'].map(async f => JSON.parse(await readFile(path.join(root, f), 'utf8'))));
  return seedDb({apps, users});
}
let db;
try { db = JSON.parse(await readFile(DB_FILE, 'utf8')); if (db.version !== 1) throw new Error('old'); } catch { db = await seed(); }
let chain = Promise.resolve();
const save = () => (chain = chain.then(async () => { const tmp = `${DB_FILE}.tmp`; await writeFile(tmp, JSON.stringify(db, null, 1)); await rename(tmp, DB_FILE); }).catch(e => console.error('Could not save the database:', e.message)));
await save();

// Screenshots and app-published key graphs come from the capture manifest (see docs/SCREENSHOT_PIPELINE.md).
async function captures() {
  try { return JSON.parse(await readFile(path.join(root, 'data/capture-manifest.json'), 'utf8')); } catch { return {apps: {}, maxAgeHours: 168}; }
}
async function decorate(body) {
  const m = await captures();
  const one = async a => {
    const c = a && typeof a === 'object' ? m.apps?.[a.id] : null; if (!c || !usableCapture(c, Date.now(), m.maxAgeHours)) return a;
    try { await access(path.join(dist, c.path)); } catch { return a; }
    return {...a, screenshot: {path: c.path, capturedAt: c.capturedAt}, ...(c.keyVisual ? {keyVisual: c.keyVisual, keyVisualSource: 'app'} : {})};
  };
  return Array.isArray(body) ? Promise.all(body.map(one)) : one(body);
}

const cookie = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=').map(v => { try { return decodeURIComponent(v); } catch { return v; } })).filter(p => p[0]));
const send = (res, status, body, headers = {}) => { res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers}); res.end(JSON.stringify(body)); };
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 256 * 1024) throw Object.assign(new Error('Request body is too large.'), {status: 413}); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Send JSON.'), {status: 400}); }
}

async function api(req, res, rel) {
  const user = DEV_AUTH ? db.users[cookie(req).dc_user] || Object.values(db.users).find(u => u.role === 'admin')
    : TRUSTED_USER_HEADER ? db.users[req.headers[TRUSTED_USER_HEADER]] || null : null;
  if (DEV_AUTH && rel.startsWith('session/dev-')) {
    if (rel === 'session/dev-users' && req.method === 'GET') return send(res, 200, Object.values(db.users).map(u => ({id: u.id, name: u.name, role: u.role})));
    if (rel === 'session/dev-switch' && req.method === 'POST') { const {userId} = await readBody(req); if (!db.users[userId]) return send(res, 404, {error: 'No such sample user.'}); return send(res, 200, {ok: true}, {'Set-Cookie': `dc_user=${encodeURIComponent(userId)}; Path=/; SameSite=Strict; HttpOnly`}); }
    if (rel === 'session/dev-reset' && req.method === 'POST') { db = await seed(); await save(); return send(res, 200, {ok: true}); }
  }
  if (req.method !== 'GET' && req.headers['content-type']?.split(';')[0] !== 'application/json') return send(res, 415, {error: 'Send JSON.'});
  const body = req.method === 'GET' ? {} : await readBody(req);
  const out = handle(db, user, req.method, rel, body);
  if (req.method !== 'GET' && out.status < 400) await save();
  return send(res, out.status, out.status < 400 && rel.startsWith('apps') ? await decorate(out.body) : out.body);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) return await api(req, res, pathname.slice(5) + url.search);
    const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(dist + path.sep)) throw new Error('outside');
    const content = await readFile(file);
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'});
    res.end(content);
  } catch (error) {
    if (error.status) return send(res, error.status, {error: error.message});
    res.writeHead(404); res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Dreamcatcher at http://127.0.0.1:${port}  ·  database: ${path.relative(root, DB_FILE)}${DEV_AUTH ? '  ·  dev sign-in on' : ''}`));
