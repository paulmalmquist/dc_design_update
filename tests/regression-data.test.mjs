import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDb, handle} from '../dist/lib/db-core.mjs';
import {approvedScreenshot} from '../dist/lib/capture-record.mjs';
import {validateLaunchUrl} from '../dist/lib/catalog.mjs';
const now = Date.parse('2026-10-10T12:00:00Z');
const users = [{id: 'admin', role: 'admin'}, {id: 'creator', role: 'creator'}, {id: 'viewer', role: 'viewer'}];
const apps = [{id: 'pub', title: 'Published', domain: 'Data', status: 'published', ownerId: 'creator'}, {id: 'draft', title: 'Draft', domain: 'Data', status: 'draft', ownerId: 'creator'}];
const fresh = () => seedDb({apps, users, now});
const as = (db, id) => (m, p, body) => handle(db, db.users[id], m, p, body, now);

test('history rejects hidden drafts and writes never return hidden IDs', () => {
  const db = fresh(), viewer = as(db, 'viewer');
  assert.equal(viewer('POST', 'me/history', {id: 'draft'}).status, 404);
  db.lists.viewer = ['draft']; db.history.viewer = [{id: 'draft', at: '2026-10-01T12:00:00Z'}];
  assert.deepEqual(viewer('PUT', 'me/list/pub').body, ['pub']);
  assert.deepEqual(viewer('DELETE', 'me/list/pub').body, []);
  assert.deepEqual(viewer('POST', 'me/history', {id: 'pub'}).body.map(h => h.id), ['pub']);
});
test('session subroutes are not mistaken for session details', () => {
  const db = fresh(); assert.equal(as(db, 'viewer')('GET', 'session/dev-users').status, 404);
});
test('trusted screenshot metadata survives seeding and editing, but edits cannot forge it', () => {
  const screenshot = {path: 'screenshots/pub-123456abcdef.jpg', capturedAt: '2026-10-10T11:00:00Z', expiresAt: '2026-10-17T11:00:00Z', approved: true};
  const db = seedDb({apps: [{...apps[0], screenshot}], users, now});
  assert.deepEqual(db.apps.pub.screenshot, screenshot);
  const result = as(db, 'creator')('PATCH', 'apps/pub', {title: 'New title', screenshot: {...screenshot, path: 'screenshots/other-123456abcdef.jpg'}, screenshotApproved: true, screenshotPath: 'screenshots/forged.jpg'});
  assert.deepEqual(result.body.screenshot, screenshot);
  assert.equal(result.body.screenshotPath, ''); assert.equal(result.body.screenshotApproved, false);
  for (const record of [{...screenshot, approved: false}, {...screenshot, path: 'https://bad.example/a.jpg'}, {...screenshot, expiresAt: '2026-10-01'}, {...screenshot, capturedAt: 'bad'}]) assert.equal(approvedScreenshot(record, 'pub', now), null);
  assert.equal(approvedScreenshot(screenshot, 'other', now), null);
});
test('capture requests are idempotent while queued or running', () => {
  const db = fresh(), creator = as(db, 'creator');
  creator('POST', 'apps/pub/capture'); const first = db.captures.pub;
  creator('POST', 'apps/pub/capture'); assert.equal(db.captures.pub, first);
  first.status = 'running'; creator('POST', 'apps/pub/capture'); assert.equal(db.captures.pub.status, 'running');
  first.status = 'failed'; creator('POST', 'apps/pub/capture'); assert.equal(db.captures.pub.status, 'queued');
});
test('launch URLs round-trip but reject active schemes and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.example', 'http://example.com', 'https://user:pass@example.com']) assert.throws(() => validateLaunchUrl(url), /HTTPS/);
  assert.equal(validateLaunchUrl(''), '');
  const db = fresh(), r = as(db, 'creator')('PATCH', 'apps/pub', {launchUrl: 'https://apps.example.com/report'});
  assert.equal(r.body.launchUrl, 'https://apps.example.com/report');
  assert.equal(as(db, 'creator')('PATCH', 'apps/pub', {launchUrl: 'javascript:alert(1)'}).status, 400);
  assert.equal(db.apps.pub.launchUrl, r.body.launchUrl);
});
