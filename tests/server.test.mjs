import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createDreamcatcherServer} from '../scripts/serve.mjs';

async function setup(t, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'dc-server-test-')), dbFile = path.join(dir, 'db.json');
  const configPath = path.join(dir, 'capture.json');
  await writeFile(configPath, JSON.stringify({allowedOrigins: ['https://approved.example'], apps: [{id: 'new-app', url: 'https://approved.example/preview', readySelector: '[data-ready]', safePreview: true}]}));
  const {server, queue} = await createDreamcatcherServer({dbFile, devAuth: true, captureConfigPath: configPath, ...options});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await queue.kick(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, {recursive: true, force: true}); });
  const call = async (method, route, body, headers = {}) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/${route}`, {method, headers: {'content-type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
    return {status: r.status, body: await r.json()};
  };
  return {call, queue, dbFile};
}
test('HTTP create → published app → configured capture → status read uses the database catalog', async t => {
  let runs = 0;
  const {call, queue, dbFile} = await setup(t, {captureRunner: async args => { runs++; assert.ok(args.catalog.some(a => a.id === 'new-app')); return {captured: 1, failed: 0}; }});
  assert.deepEqual((await call('GET', 'runtime.json')).body, {mode: 'server'});
  const created = await call('POST', 'api/apps', {id: 'new-app', title: 'New app', domain: 'Data', status: 'published', launchUrl: 'https://approved.example/app'});
  assert.equal(created.status, 200); await queue.kick();
  const fetched = await call('GET', 'api/apps/new-app'); assert.equal(fetched.body.capture.status, 'succeeded'); assert.equal(runs, 1);
  assert.equal(JSON.parse(await readFile(dbFile, 'utf8')).captures['new-app'].status, 'succeeded');
  assert.equal(fetched.body.launchUrl, 'https://approved.example/app');
});
test('HTTP unconfigured captures are honest and unauthorized identities cannot read drafts', async t => {
  const {call, queue} = await setup(t, {captureRunner: async () => { throw new Error('must not run'); }});
  await call('POST', 'api/apps', {id: 'no-preview', title: 'No preview', domain: 'Data', status: 'published'});
  await queue.kick(); assert.equal((await call('GET', 'api/apps/no-preview')).body.capture.status, 'not_configured');
  const created = await call('POST', 'api/apps', {id: 'private-draft', title: 'Private', domain: 'Data', status: 'draft'});
  assert.equal(created.status, 200); assert.equal((await call('GET', 'api/apps/private-draft')).status, 200);
  const users = (await call('GET', 'api/session/dev-users')).body, viewer = users.find(u => u.role === 'viewer');
  assert.equal((await call('GET', 'api/apps/private-draft', undefined, {cookie: `dc_user=${viewer.id}`})).status, 404);
  assert.equal((await call('POST', 'api/me/history', {id: 'private-draft'}, {cookie: `dc_user=${viewer.id}`})).status, 404);
});
test('server identity fails closed when dev auth is disabled', async t => {
  const {call} = await setup(t, {devAuth: false, trustedUserHeader: ''});
  assert.equal((await call('GET', 'api/session')).status, 401);
  assert.equal((await call('POST', 'api/apps', {id: 'new-app'})).status, 401);
});
test('failed database persistence returns 500, rolls back, and does not poison later writes', async t => {
  const {call, dbFile} = await setup(t);
  const blockedTemp = dbFile + '.tmp'; await mkdir(blockedTemp);
  const body = {id: 'storage-test', title: 'Storage test', domain: 'Data', status: 'draft'};
  assert.equal((await call('POST', 'api/apps', body)).status, 500);
  assert.equal((await call('GET', 'api/apps/storage-test')).status, 404);
  await rm(blockedTemp, {recursive: true});
  assert.equal((await call('POST', 'api/apps', body)).status, 200);
});
