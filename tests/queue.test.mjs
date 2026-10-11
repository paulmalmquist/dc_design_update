import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureQueue} from '../capture/queue.mjs';
const config = {allowedOrigins: ['https://approved.example'], apps: [{id: 'new-app', url: 'https://approved.example/preview', readySelector: '[data-ready]', safePreview: true}]};
function setup(run, loadConfig = async () => config) {
  const db = {apps: {'new-app': {id: 'new-app'}}, captures: {'new-app': {status: 'queued'}}}, states = [];
  const queue = createCaptureQueue({getDb: () => db, mutate: async f => { const result = f(db); states.push(db.captures['new-app']?.status); return result; }, loadConfig, run});
  return {db, states, queue};
}
test('queue processes newly created database apps and persists running/success states once', async () => {
  let runs = 0;
  const {db, states, queue} = setup(async args => { runs++; assert.deepEqual(args.catalog, [{id: 'new-app'}]); assert.equal(args.onlyId, 'new-app'); return {captured: 1, failed: 0}; });
  await Promise.all([queue.kick(), queue.kick()]); assert.equal(runs, 1); assert.deepEqual(states, ['running', 'succeeded']); assert.equal(db.captures['new-app'].status, 'succeeded');
});
test('missing approved configuration never opens a browser and reports not configured', async () => {
  const {db, queue} = setup(() => { throw new Error('must not run'); }, async () => ({...config, apps: []}));
  await queue.kick(); assert.equal(db.captures['new-app'].status, 'not_configured');
});
test('worker errors and partial failures report failure; restarted running jobs recover', async () => {
  for (const run of [async () => { throw new Error('sensitive browser details'); }, async () => ({captured: 0, failed: 1})]) {
    const {db, queue} = setup(run); db.captures['new-app'].status = 'running'; await queue.recover();
    assert.equal(db.captures['new-app'].status, 'failed'); assert.doesNotMatch(JSON.stringify(db), /sensitive/);
  }
});
test('completion cannot resurrect a deleted app or overwrite a replacement job', async () => {
  const h = setup(async () => { delete h.db.apps['new-app']; delete h.db.captures['new-app']; return {captured: 1, failed: 0}; });
  await h.queue.kick(); assert.equal(h.db.captures['new-app'], undefined);
});
