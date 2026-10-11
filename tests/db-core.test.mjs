import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDb, handle} from '../dist/lib/db-core.mjs';

const users = [{id: 'u-admin', name: 'Ada', role: 'admin'}, {id: 'u-cre', name: 'Cy', role: 'creator'}, {id: 'u-cre2', name: 'Cleo', role: 'creator'}, {id: 'u-view', name: 'Vi', role: 'viewer'}];
const apps = [
  {id: 'pub', title: 'Published one', domain: 'Data', ownerId: 'u-cre', status: 'published', featured: true, publishedAt: '2026-09-01'},
  {id: 'draft', title: 'Draft one', domain: 'Quality', ownerId: 'u-cre', status: 'draft'},
  {id: 'other', title: 'Other creator', domain: 'Finance', ownerId: 'u-cre2', status: 'published', publishedAt: '2026-08-01'}
];
const fresh = () => seedDb({apps, users, now: Date.parse('2026-10-01T12:00:00Z')});
const as = (db, id) => (method, path, body) => handle(db, db.users[id], method, path, body, Date.parse('2026-10-10T12:00:00Z'));

test('requests without a signed-in user are refused', () => {
  assert.equal(handle(fresh(), null, 'GET', 'apps').status, 401);
});

test('everyone sees published apps; drafts only reach their owner and admins', () => {
  const db = fresh();
  assert.deepEqual(as(db, 'u-view')('GET', 'apps').body.map(a => a.id).sort(), ['other', 'pub']);
  assert.equal(as(db, 'u-view')('GET', 'apps/draft').status, 404);
  assert.equal(as(db, 'u-cre2')('GET', 'apps/draft').status, 404);
  assert.equal(as(db, 'u-cre')('GET', 'apps/draft').status, 200);
  assert.deepEqual(as(db, 'u-cre')('GET', 'apps?scope=mine').body.map(a => a.id).sort(), ['draft', 'pub']);
  assert.equal(as(db, 'u-cre')('GET', 'apps?scope=all').status, 403);
  assert.equal(as(db, 'u-admin')('GET', 'apps?scope=all').body.length, 3);
});

test('viewers cannot create; creators create apps they own; IDs are unique', () => {
  const db = fresh(), body = {id: 'new-app', title: 'New app', domain: 'Platform', status: 'published', keyVisual: {type: 'bar', series: [1, 2, 3]}};
  assert.equal(as(db, 'u-view')('POST', 'apps', body).status, 403);
  const r = as(db, 'u-cre')('POST', 'apps', {...body, ownerId: 'u-admin', featured: true, rank: 1});
  assert.equal(r.status, 200);
  assert.equal(r.body.ownerId, 'u-cre');                       // owner comes from the session, not the body
  assert.equal(r.body.featured, false);                        // editorial fields are admin-only
  assert.equal(r.body.rank, null);
  assert.equal(r.body.origin, 'app');
  assert.equal(as(db, 'u-cre')('POST', 'apps', {...body, id: 'claims-app', keyVisualSource: 'app', origin: 'seed'}).body.keyVisualSource, 'metadata');
  assert.equal(r.body.publishedAt, '2026-10-10');
  assert.equal(as(db, 'u-cre')('POST', 'apps', body).status, 409);
});

test('bad input is rejected with a readable message and nothing is written', () => {
  const db = fresh();
  for (const body of [{id: '../x', title: 'x', domain: 'Data'}, {id: 'x', title: 'x', domain: 'Nowhere'}, {id: 'x', title: 'x', domain: 'Data', keyVisual: {type: 'line', series: ['<script>']}}]) {
    const r = as(db, 'u-cre')('POST', 'apps', body);
    assert.equal(r.status, 400); assert.equal(typeof r.body.error, 'string');
  }
  assert.equal(Object.keys(db.apps).length, 3);
});

test('only the owner or an admin can edit, delete or request a screenshot', () => {
  const db = fresh();
  assert.equal(as(db, 'u-cre2')('PATCH', 'apps/pub', {title: 'Hijack'}).status, 403);
  assert.equal(as(db, 'u-cre2')('DELETE', 'apps/pub').status, 403);
  assert.equal(as(db, 'u-cre2')('POST', 'apps/pub/capture').status, 403);
  assert.equal(as(db, 'u-cre')('PATCH', 'apps/pub', {title: 'Renamed'}).body.title, 'Renamed');
  assert.equal(as(db, 'u-cre')('PATCH', 'apps/pub', {id: 'moved'}).status, 400);
  assert.equal(as(db, 'u-admin')('PATCH', 'apps/other', {original: true}).body.original, true);
  assert.equal(as(db, 'u-cre')('POST', 'apps/pub/capture').body.status, 'queued');
});

test('unpublishing or deleting an app removes it from the hero, lists and history', () => {
  const db = fresh();
  as(db, 'u-view')('PUT', 'me/list/pub'); as(db, 'u-view')('POST', 'me/history', {id: 'pub'});
  assert.deepEqual(db.curation.hero, ['pub']);
  as(db, 'u-cre')('PATCH', 'apps/pub', {status: 'draft'});
  assert.deepEqual(db.curation.hero, []);
  assert.deepEqual(as(db, 'u-view')('GET', 'me/list').body, []);  // hidden from the viewer once it is a draft
  as(db, 'u-cre')('DELETE', 'apps/pub');
  assert.equal(db.apps.pub, undefined);
  assert.deepEqual(db.lists['u-view'], []); assert.deepEqual(db.history['u-view'], []);
});

test('home curation is admin-only; hero takes published apps only; Top 10 sets ranks', () => {
  const db = fresh();
  assert.equal(as(db, 'u-cre')('PUT', 'curation', {hero: ['pub']}).status, 403);
  const r = as(db, 'u-admin')('PUT', 'curation', {hero: ['other', 'draft', 'ghost'], top: ['other', 'pub'], rails: [{key: 'top', title: 'Most opened', enabled: true}, {key: 'bogus'}]});
  assert.deepEqual(r.body.hero, ['other']);
  assert.equal(db.apps.other.rank, 1); assert.equal(db.apps.pub.rank, 2); assert.equal(db.apps.draft.rank, null);
  assert.equal(db.apps.other.featured, true); assert.equal(db.apps.pub.featured, false);
  assert.equal(r.body.rails[0].title, 'Most opened');
  assert.ok(!r.body.rails.some(x => x.key === 'bogus'));
  assert.ok(r.body.rails.find(x => x.key === 'new').enabled === false); // rails left out are kept, switched off
});

test('roles are admin-only and the last admin cannot be demoted', () => {
  const db = fresh();
  assert.equal(as(db, 'u-cre')('GET', 'users').status, 403);
  assert.equal(as(db, 'u-admin')('PATCH', 'users/u-view', {role: 'creator'}).body.role, 'creator');
  assert.equal(as(db, 'u-admin')('PATCH', 'users/u-view', {role: 'owner'}).status, 400);
  assert.equal(as(db, 'u-admin')('PATCH', 'users/u-admin', {role: 'viewer'}).status, 409);
});

test('every write lands in the audit log, newest first, readable by admins only', () => {
  const db = fresh();
  as(db, 'u-cre')('PATCH', 'apps/pub', {logline: 'Sharper.'});
  as(db, 'u-admin')('PATCH', 'users/u-view', {role: 'creator'});
  const log = as(db, 'u-admin')('GET', 'audit').body;
  assert.deepEqual(log.map(e => e.action), ['role', 'update']);
  assert.equal(log[1].userName, 'Cy'); assert.match(log[1].summary, /logline/);
  assert.equal(as(db, 'u-cre')('GET', 'audit').status, 403);
});

test('My List and history are per user and capped', () => {
  const db = fresh(), v = as(db, 'u-view');
  v('PUT', 'me/list/pub'); v('PUT', 'me/list/pub'); v('PUT', 'me/list/other');
  assert.deepEqual(v('GET', 'me/list').body, ['other', 'pub']);
  assert.deepEqual(as(db, 'u-cre')('GET', 'me/list').body, []);
  assert.equal(v('PUT', 'me/list/draft').status, 404);
  for (let i = 0; i < 40; i++) v('POST', 'me/history', {id: i % 2 ? 'pub' : 'other'});
  assert.equal(v('GET', 'me/history').body.length, 2);
  assert.equal(v('PATCH', 'me', {prefs: {intro: false}}).body.prefs.intro, false);
});
