// Local JSON-file reference adapter. Put the production API behind your real sign-in and database.
import http from 'node:http';
import path from 'node:path';
import {readFile, writeFile, rename, access} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {handle, seedDb} from '../dist/lib/db-core.mjs';
import {approvedScreenshot} from '../dist/lib/capture-record.mjs';
import {usableCapture} from '../capture/policy.mjs';
import {createCaptureQueue} from '../capture/queue.mjs';
import {runCapture} from '../capture/worker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain'};
const send = (res, status, body, headers = {}) => { res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers}); res.end(JSON.stringify(body)); };
const cookie = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=').map(v => { try { return decodeURIComponent(v); } catch { return v; } })).filter(p => p[0]));
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 256 * 1024) throw Object.assign(new Error('Request body is too large.'), {status: 413}); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Send JSON.'), {status: 400}); }
}

export async function createDreamcatcherServer({
  dbFile = process.env.DREAMCATCHER_DB || path.join(root, 'data/db.json'),
  devAuth = process.env.DEV_AUTH === '1' || (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH !== '0'),
  trustedUserHeader = (process.env.TRUSTED_USER_HEADER || '').toLowerCase(),
  captureConfigPath = process.env.CAPTURE_CONFIG || '',
  captureRunner = runCapture
} = {}) {
  async function seed() {
    const [apps, users] = await Promise.all(['data/apps.json', 'data/users.json'].map(async f => JSON.parse(await readFile(path.join(root, f), 'utf8'))));
    return seedDb({apps, users});
  }
  let db;
  try { db = JSON.parse(await readFile(dbFile, 'utf8')); if (db.version !== 1) throw new Error('Unsupported database version.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; db = await seed(); }
  let chain = Promise.resolve();
  async function persist() {
    const tmp = `${dbFile}.tmp`; await writeFile(tmp, JSON.stringify(db, null, 1)); await rename(tmp, dbFile);
  }
  // API and queue writes share one transaction chain. Persistence failure rolls back, and returns an error.
  function mutate(work) {
    const pending = chain.then(async () => {
      const before = structuredClone(db);
      try { const result = await work(db); await persist(); return result; }
      catch (error) { db = before; throw error; }
    });
    chain = pending.catch(() => {});
    return pending;
  }
  await persist();
  const queue = createCaptureQueue({
    getDb: () => db, mutate,
    loadConfig: async () => {
      if (!captureConfigPath) throw new Error('Capture is not configured.');
      return JSON.parse(await readFile(captureConfigPath, 'utf8'));
    },
    run: captureRunner
  });
  const kick = () => queue.kick().catch(() => console.error('Capture queue could not persist its status. Check database storage.'));
  await queue.recover();

  async function decorate(body) {
    let manifest;
    try { manifest = JSON.parse(await readFile(path.join(root, 'data/capture-manifest.json'), 'utf8')); }
    catch { return body; }
    const one = async a => {
      const c = a && typeof a === 'object' ? manifest.apps?.[a.id] : null;
      if (!c || !usableCapture(c, Date.now(), manifest.maxAgeHours)) return a;
      const screenshot = approvedScreenshot({...c, expiresAt: new Date(Date.parse(c.capturedAt) + (manifest.maxAgeHours || 168) * 3600000).toISOString()}, a.id);
      if (!screenshot) return a;
      try { await access(path.join(dist, screenshot.path)); } catch { return a; }
      return {...a, screenshot, ...(c.keyVisual ? {keyVisual: c.keyVisual, keyVisualSource: 'app'} : {})};
    };
    return Array.isArray(body) ? Promise.all(body.map(one)) : one(body);
  }
  function identity(req) {
    return devAuth ? db.users[cookie(req).dc_user] || Object.values(db.users).find(u => u.role === 'admin')
      : trustedUserHeader ? db.users[req.headers[trustedUserHeader]] || null : null;
  }
  async function api(req, res, rel) {
    if (req.method !== 'GET' && req.headers['content-type']?.split(';')[0] !== 'application/json') return send(res, 415, {error: 'Send JSON.'});
    const body = req.method === 'GET' ? {} : await readBody(req);
    if (devAuth && rel.startsWith('session/dev-')) {
      if (rel === 'session/dev-users' && req.method === 'GET') return send(res, 200, Object.values(db.users).map(u => ({id: u.id, name: u.name, role: u.role})));
      if (rel === 'session/dev-switch' && req.method === 'POST') {
        if (!db.users[body.userId]) return send(res, 404, {error: 'No such sample user.'});
        return send(res, 200, {ok: true}, {'Set-Cookie': `dc_user=${encodeURIComponent(body.userId)}; Path=/; SameSite=Strict; HttpOnly`});
      }
      if (rel === 'session/dev-reset' && req.method === 'POST') { await mutate(async () => { db = await seed(); }); return send(res, 200, {ok: true}); }
    }
    const work = () => {
      const out = handle(db, identity(req), req.method, rel, body);
      // Saving a published app requests a fresh capture; operator config remains the URL authority.
      if (out.status < 400 && ['POST', 'PATCH'].includes(req.method) && /^apps(?:\/[^/?]+)?$/.test(rel) && out.body.status === 'published') {
        handle(db, identity(req), 'POST', `apps/${out.body.id}/capture`);
      }
      return out;
    };
    const out = req.method === 'GET' ? work() : await mutate(work);
    if (req.method !== 'GET' && out.status < 400) void kick();
    return send(res, out.status, out.status < 400 && rel.startsWith('apps') ? await decorate(out.body) : out.body);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'), pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/')) return await api(req, res, pathname.slice(5) + url.search);
      // The reference server always uses its API, even after a demo build.
      if (pathname === '/runtime.json') return send(res, 200, {mode: 'server'});
      const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(dist + path.sep)) return send(res, 404, {error: 'Not found'});
      const content = await readFile(file);
      res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'});
      res.end(content);
    } catch (error) {
      const status = error.status || (!req.url.startsWith('/api/') && error.code === 'ENOENT' ? 404 : 500);
      send(res, status, {error: error.status ? error.message : status === 404 ? 'Not found' : 'The request could not be completed. Check server storage and configuration.'});
    }
  });
  return {server, queue};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const {server} = await createDreamcatcherServer();
  const port = Number(process.env.PORT || 4173);
  server.listen(port, '127.0.0.1', () => console.log(`Dreamcatcher at http://127.0.0.1:${port} · local reference API`));
}

