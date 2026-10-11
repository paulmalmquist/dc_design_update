// The CRUD contract behind Dreamcatcher, as one pure request handler.
// The local dev server (scripts/serve.mjs, JSON file) and the in-browser store (lib/api.mjs, localStorage)
// both run this exact code, so permissions and validation behave the same everywhere.
// Production: implement the same routes against the real Dreamcatcher database (see docs/CRUD_CONTRACT.md).
import {validateApp} from './catalog.mjs';

export const ROLES = ['viewer', 'creator', 'admin'];
export const STATUSES = ['draft', 'published', 'archived'];
export const RAILS = [
  {key: 'continue', title: 'Continue exploring'}, {key: 'top', title: 'Top 10 apps this week'},
  {key: 'new', title: 'New on Dreamcatcher'}, {key: 'originals', title: 'Dreamcatcher Originals'},
  {key: 'hubs', title: 'Browse by domain'}, {key: 'because', title: 'Because you opened'},
  {key: 'mylist', title: 'My List'}, {key: 'domains', title: 'Domain collections'}
];
const ADMIN_FIELDS = ['featured', 'original', 'rank'];
const iso = ms => new Date(ms).toISOString();
const day = ms => iso(ms).slice(0, 10);
const ok = body => ({status: 200, body});
const fail = (status, error) => ({status, body: {error}});
const clone = v => JSON.parse(JSON.stringify(v));

export function seedDb({apps = [], users = [], now = Date.now()} = {}) {
  const db = {version: 1, apps: {}, users: {}, lists: {}, history: {}, captures: {}, audit: [],
    curation: {hero: [], rails: RAILS.map(r => ({...r, enabled: true}))}};
  for (const u of users) db.users[u.id] = {id: u.id, name: u.name, team: u.team || '', role: ROLES.includes(u.role) ? u.role : 'viewer', prefs: {intro: true}};
  for (const raw of apps) {
    const app = validateApp(raw);
    db.apps[app.id] = {...app, origin: 'seed', status: STATUSES.includes(raw.status) ? raw.status : 'published', ownerId: db.users[raw.ownerId] ? raw.ownerId : Object.keys(db.users)[0] || '',
      createdAt: raw.publishedAt ? `${raw.publishedAt}T12:00:00.000Z` : iso(now), updatedAt: raw.updatedAt ? `${raw.updatedAt}T12:00:00.000Z` : (raw.publishedAt ? `${raw.publishedAt}T12:00:00.000Z` : iso(now))};
  }
  db.curation.hero = Object.values(db.apps).filter(a => a.featured && a.status === 'published').map(a => a.id).slice(0, 8);
  return db;
}

const isAdmin = u => u?.role === 'admin';
const canCreate = u => u?.role === 'creator' || u?.role === 'admin';
const canEdit = (u, app) => isAdmin(u) || (u?.role === 'creator' && app.ownerId === u.id);
const visible = (u, app) => app.status === 'published' || canEdit(u, app);
function audit(db, user, action, target, summary, now) {
  db.audit.unshift({at: iso(now), userId: user?.id || 'system', userName: user?.name || 'System', action, target, summary});
  db.audit.length = Math.min(db.audit.length, 500);
}
function view(db, app) {
  const owner = db.users[app.ownerId];
  return {...clone(app), ownerName: owner?.name || 'Unassigned', capture: db.captures[app.id] || null};
}
function writeApp(db, user, input, existing, now) {
  const base = existing ? {...existing} : {};
  const patch = {...input};
  if (!isAdmin(user)) for (const f of ADMIN_FIELDS) delete patch[f];
  delete patch.ownerId; delete patch.createdAt; delete patch.updatedAt; delete patch.capture; delete patch.origin;
  delete patch.keyVisualSource;                               // "drawn from the app itself" is only set by the capture worker
  const merged = {...base, ...patch};
  if ('keyVisual' in patch) merged.keyVisualSource = 'metadata';
  const app = validateApp(merged);                         // throws a readable error on bad input
  const status = STATUSES.includes(merged.status) ? merged.status : (existing?.status || 'draft');
  if (status === 'published' && !app.publishedAt) app.publishedAt = day(now);
  return {...app, origin: existing?.origin || 'app', status, ownerId: existing?.ownerId || user.id, createdAt: existing?.createdAt || iso(now), updatedAt: iso(now)};
}

/** Handle one request. `path` has no leading slash and may carry a query string, e.g. "apps?scope=all". */
export function handle(db, user, method, path, body = {}, now = Date.now()) {
  const [route, query = ''] = String(path).split('?'), q = new URLSearchParams(query), parts = route.split('/').filter(Boolean).map(decodeURIComponent);
  const M = method.toUpperCase(), [res, id, sub] = parts;
  if (!user) return fail(401, 'Sign in to use Dreamcatcher.');
  try {
    if (res === 'session' && M === 'GET') return ok({user: clone(user), roles: ROLES});
    if (res === 'apps') {
      if (!id && M === 'GET') {
        const scope = q.get('scope');
        let list = Object.values(db.apps);
        if (scope === 'all') { if (!isAdmin(user)) return fail(403, 'Site admin access is required.'); }
        else if (scope === 'mine') list = list.filter(a => a.ownerId === user.id);
        else list = list.filter(a => a.status === 'published');
        return ok(list.map(a => view(db, a)));
      }
      if (!id && M === 'POST') {
        if (!canCreate(user)) return fail(403, 'Creator access is required to add apps.');
        const app = writeApp(db, user, body, null, now);
        if (db.apps[app.id]) return fail(409, 'An app with this ID already exists. Choose another name or ID.');
        db.apps[app.id] = app; audit(db, user, 'create', app.id, `Created “${app.title}” as ${app.status}`, now);
        return ok(view(db, app));
      }
      const app = db.apps[id];
      if (!app || !visible(user, app)) return fail(404, 'That app is not in the catalog.');
      if (!sub && M === 'GET') return ok(view(db, app));
      if (!sub && M === 'PATCH') {
        if (!canEdit(user, app)) return fail(403, 'Only the app owner or a site admin can edit this app.');
        const next = writeApp(db, user, body, app, now);
        if (next.id !== app.id) return fail(400, 'An app ID cannot be changed.');
        db.apps[id] = next;
        if (next.status !== 'published') db.curation.hero = db.curation.hero.filter(h => h !== id);
        if (isAdmin(user) && 'featured' in body) db.curation.hero = body.featured ? [...new Set([...db.curation.hero, id])].slice(0, 8) : db.curation.hero.filter(h => h !== id);
        const changed = Object.keys(body).filter(k => JSON.stringify(body[k]) !== JSON.stringify(app[k]));
        audit(db, user, app.status !== next.status ? `status:${next.status}` : 'update', id, changed.length ? `Changed ${changed.join(', ')}` : 'Saved without changes', now);
        return ok(view(db, next));
      }
      if (!sub && M === 'DELETE') {
        if (!canEdit(user, app)) return fail(403, 'Only the app owner or a site admin can delete this app.');
        delete db.apps[id]; delete db.captures[id];
        db.curation.hero = db.curation.hero.filter(h => h !== id);
        for (const k in db.lists) db.lists[k] = db.lists[k].filter(x => x !== id);
        for (const k in db.history) db.history[k] = db.history[k].filter(x => x.id !== id);
        audit(db, user, 'delete', id, `Deleted “${app.title}”`, now);
        return ok({deleted: id});
      }
      if (sub === 'capture' && M === 'POST') {
        if (!canEdit(user, app)) return fail(403, 'Only the app owner or a site admin can request a new screenshot.');
        db.captures[id] = {status: 'queued', requestedAt: iso(now), requestedBy: user.name};
        audit(db, user, 'capture', id, 'Requested a new screenshot', now);
        return ok(db.captures[id]);
      }
    }
    if (res === 'curation') {
      if (M === 'GET') return ok(clone(db.curation));
      if (M === 'PUT') {
        if (!isAdmin(user)) return fail(403, 'Site admin access is required.');
        const hero = Array.isArray(body.hero) ? [...new Set(body.hero.filter(h => db.apps[h]?.status === 'published'))].slice(0, 8) : db.curation.hero;
        const known = new Map(RAILS.map(r => [r.key, r]));
        const rails = Array.isArray(body.rails) ? body.rails.filter(r => known.has(r?.key)).map(r => ({key: r.key, title: String(r.title || known.get(r.key).title).slice(0, 60).trim() || known.get(r.key).title, enabled: r.enabled !== false})) : db.curation.rails;
        for (const r of RAILS) if (!rails.some(x => x.key === r.key)) rails.push({...r, enabled: false});
        if (Array.isArray(body.top)) {
          const top = [...new Set(body.top.filter(t => db.apps[t]))].slice(0, 10);
          for (const a of Object.values(db.apps)) a.rank = top.includes(a.id) ? top.indexOf(a.id) + 1 : null;
        }
        Object.values(db.apps).forEach(a => { a.featured = hero.includes(a.id); });
        db.curation = {hero, rails};
        audit(db, user, 'curation', 'home', `Hero: ${hero.length} apps · rails: ${rails.filter(r => r.enabled).length} on`, now);
        return ok(clone(db.curation));
      }
    }
    if (res === 'users') {
      if (!isAdmin(user)) return fail(403, 'Site admin access is required.');
      if (!id && M === 'GET') return ok(Object.values(db.users).map(u => ({...clone(u), apps: Object.values(db.apps).filter(a => a.ownerId === u.id).length})));
      const target = db.users[id]; if (!target) return fail(404, 'No such user.');
      if (M === 'PATCH') {
        if (!ROLES.includes(body.role)) return fail(400, 'Choose viewer, creator or admin.');
        if (target.role === 'admin' && body.role !== 'admin' && Object.values(db.users).filter(u => u.role === 'admin').length === 1) return fail(409, 'Keep at least one site admin.');
        const before = target.role; target.role = body.role;
        audit(db, user, 'role', target.id, `${target.name}: ${before} → ${body.role}`, now);
        return ok(clone(target));
      }
    }
    if (res === 'me') {
      const lists = db.lists[user.id] ||= [], hist = db.history[user.id] ||= [];
      if (id === undefined && M === 'PATCH') {
        const me = db.users[user.id];
        if (typeof body.name === 'string' && body.name.trim()) me.name = body.name.trim().slice(0, 60);
        if (body.prefs && typeof body.prefs.intro === 'boolean') me.prefs = {...me.prefs, intro: body.prefs.intro};
        return ok(clone(me));
      }
      if (id === 'list') {
        if (!sub && M === 'GET') return ok(lists.filter(a => db.apps[a] && visible(user, db.apps[a])));
        if (sub && M === 'PUT') { if (!db.apps[sub] || !visible(user, db.apps[sub])) return fail(404, 'That app is not in the catalog.'); if (!lists.includes(sub)) lists.unshift(sub); return ok(lists); }
        if (sub && M === 'DELETE') { db.lists[user.id] = lists.filter(x => x !== sub); return ok(db.lists[user.id]); }
      }
      if (id === 'history') {
        if (M === 'GET') return ok(hist.filter(h => db.apps[h.id] && visible(user, db.apps[h.id])));
        if (M === 'POST') { const appId = String(body.id || ''); if (!db.apps[appId]) return fail(404, 'That app is not in the catalog.'); db.history[user.id] = [{id: appId, at: iso(now)}, ...hist.filter(h => h.id !== appId)].slice(0, 30); return ok(db.history[user.id]); }
        if (M === 'DELETE') { db.history[user.id] = []; return ok([]); }
      }
    }
    if (res === 'audit' && M === 'GET') { if (!isAdmin(user)) return fail(403, 'Site admin access is required.'); return ok(db.audit.slice(0, 200)); }
    return fail(404, 'Unknown request.');
  } catch (error) {
    return fail(400, error.message || 'That request could not be saved.');
  }
}
