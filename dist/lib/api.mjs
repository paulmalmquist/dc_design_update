// Data access. One interface, two backends:
//  • ServerStore — the REST CRUD contract over HTTP (`/api/...`): the dev server now, the real Dreamcatcher database in production.
//  • BrowserStore — explicit demo builds only. API errors must never change identity or storage mode.
import {handle, seedDb} from './db-core.mjs';

export async function connect({mode = 'server'} = {}) {
  if (mode === 'demo') return BrowserStore.open();
  if (mode !== 'server') throw new Error('Unknown catalog mode. Use server or demo.');
  try {
    const r = await fetch('api/session', {headers: {accept: 'application/json'}, cache: 'no-store'});
    const json = (r.headers.get('content-type') || '').includes('json');
    if (r.ok && json) return new ServerStore(await r.json());
    const data = json ? await r.json().catch(() => ({})) : {};
    throw Object.assign(new Error(data.error || ([401, 403].includes(r.status) ? 'Sign in to use Dreamcatcher.' : 'The catalog API is unavailable. Please retry.')), {status: r.status || 503});
  } catch (err) {
    if (err.status) throw err;
    throw Object.assign(new Error('Could not connect to the catalog API. Check your connection and retry.'), {status: 503});
  }
}

class ServerStore {
  constructor(session) { this.mode = 'server'; this.session = session; }
  async call(method, path, body) {
    const r = await fetch(`api/${path}`, {method, cache: 'no-store', headers: {'content-type': 'application/json', accept: 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `The request failed (${r.status}).`), {status: r.status});
    return data;
  }
  async users() { return this.call('GET', 'session/dev-users').catch(() => []); }
  async switchUser(id) { await this.call('POST', 'session/dev-switch', {userId: id}); this.session = await this.call('GET', 'session'); }
  async reset() { await this.call('POST', 'session/dev-reset', {}); }
}

const KEY = 'dreamcatcher-db-v1', USER_KEY = 'dreamcatcher-user-v1';
class BrowserStore {
  static async open() {
    const s = new BrowserStore(); s.mode = 'browser'; s.persistent = true;
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s.persistent = false; }
    if (!db || db.version !== 1) db = await BrowserStore.seed();
    s.db = db;
    try { s.userId = localStorage.getItem(USER_KEY) || ''; } catch { s.userId = ''; }
    if (!s.db.users[s.userId]) s.userId = Object.values(s.db.users).find(u => u.role === 'admin')?.id || Object.keys(s.db.users)[0];
    s.save(); s.session = {user: s.db.users[s.userId]};
    return s;
  }
  static async seed() {
    const r = await fetch('seed.json', {cache: 'no-store'});
    if (!r.ok) throw new Error('The sample data could not be loaded.');
    return seedDb(await r.json());
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); localStorage.setItem(USER_KEY, this.userId); } catch { this.persistent = false; } }
  async call(method, path, body) {
    if (method === 'POST' && /^apps\/[^/]+\/capture$/.test(path)) throw new Error('Screenshot capture requires the server and an approved capture configuration; it is not available in demo mode.');
    const res = handle(this.db, this.db.users[this.userId], method, path, body ?? {});
    if (method !== 'GET' && res.status < 400) this.save();
    if (res.status >= 400) throw Object.assign(new Error(res.body.error), {status: res.status});
    return JSON.parse(JSON.stringify(res.body));
  }
  async users() { return Object.values(this.db.users).map(u => ({id: u.id, name: u.name, role: u.role})); }
  async switchUser(id) { if (this.db.users[id]) { this.userId = id; this.save(); this.session = {user: this.db.users[id]}; } }
  async reset() { this.db = await BrowserStore.seed(); this.save(); }
}

