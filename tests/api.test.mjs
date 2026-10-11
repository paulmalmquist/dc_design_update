import test from 'node:test';
import assert from 'node:assert/strict';
import {connect} from '../dist/lib/api.mjs';

test('server mode never falls back on HTTP, HTML, malformed JSON or network errors', async t => {
  for (const response of [new Response('{}', {status: 500, headers: {'content-type': 'application/json'}}), new Response('login', {status: 200}), new Response('{', {headers: {'content-type': 'application/json'}}), new Error('offline')]) {
    t.mock.method(globalThis, 'fetch', async () => { if (response instanceof Error) throw response; return response; });
    await assert.rejects(connect(), /API|connect|catalog/i);
    t.mock.restoreAll();
  }
});
test('sign-in failures keep their status for JSON and HTML responses', async t => {
  for (const status of [401, 403]) for (const json of [true, false]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(json ? '{"error":"Sign in"}' : 'Sign in', {status, headers: {'content-type': json ? 'application/json' : 'text/html'}}));
    await assert.rejects(connect(), error => error.status === status); t.mock.restoreAll();
  }
});
test('an explicit demo uses local storage and refuses screenshot requests', async t => {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = {getItem: k => values.get(k), setItem: (k, v) => values.set(k, v)};
  t.after(() => { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; });
  const paths = [];
  t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return new Response(JSON.stringify({apps: [], users: [{id: 'admin', name: 'Demo', role: 'admin'}]})); });
  const api = await connect({mode: 'demo'});
  assert.equal(api.mode, 'browser'); assert.deepEqual(paths, ['seed.json']);
  await assert.rejects(api.call('POST', 'apps/example/capture'), /requires the server/);
  await assert.rejects(connect({mode: 'typo'}), /Unknown catalog mode/);
});
