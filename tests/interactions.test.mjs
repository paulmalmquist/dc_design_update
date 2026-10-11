import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {wireCardPreview, createTransitionGuard} from '../dist/lib/interactions.mjs';
import {approvedScreenshot} from '../dist/lib/capture-record.mjs';

function clock() {
  let time = 0, id = 0; const tasks = new Map();
  return {set(fn, ms) { tasks.set(++id, {at: time + ms, fn}); return id; }, clear(id) { tasks.delete(id); }, tick(ms) { time += ms; for (const [key, task] of [...tasks]) if (task.at <= time) { tasks.delete(key); task.fn(); } }};
}
function harness() {
  const timers = clock(), rails = new EventTarget(), a = {dataset: {id: 'alpha'}}, b = {dataset: {id: 'beta'}};
  a.closest = b.closest = function () { return this; }; rails.contains = el => el === a || el === b;
  const shown = []; let hidden = 0;
  const dispose = wireCardPreview(rails, {...timers, show: id => shown.push(id), hide: () => hidden++});
  const event = (type, target, relatedTarget, pointerType = 'mouse') => {
    const e = new Event(type); Object.defineProperties(e, {target: {value: target}, relatedTarget: {value: relatedTarget}, pointerType: {value: pointerType}}); rails.dispatchEvent(e);
  };
  return {timers, a, b, shown, hidden: () => hidden, event, dispose};
}
test('mouse dwell does not restart within a card, and whitespace restores the hero', () => {
  const h = harness(); h.event('pointerover', h.a); h.timers.tick(300); h.event('pointerover', h.a); h.timers.tick(300);
  assert.deepEqual(h.shown, ['alpha']); h.event('pointerout', h.a, null); h.timers.tick(1499); assert.equal(h.hidden(), 0);
  h.timers.tick(1); assert.equal(h.hidden(), 1); h.dispose();
});
test('keyboard focus previews, moving focus cancels stale dwell, touch does not hover', () => {
  const h = harness(); h.event('pointerover', h.a, null, 'touch'); h.timers.tick(600); assert.deepEqual(h.shown, []);
  h.event('focusin', h.a); h.timers.tick(300); h.event('focusout', h.a, h.b); h.event('focusin', h.b); h.timers.tick(600);
  assert.deepEqual(h.shown, ['beta']); h.event('focusout', h.b, null); h.timers.tick(1500); assert.equal(h.hidden(), 1); h.dispose();
});
test('route disposal cancels pending preview and restore timers and removes listeners', () => {
  const h = harness(); h.event('focusin', h.a); h.dispose(); h.timers.tick(1000); assert.deepEqual(h.shown, []);
  h.event('focusin', h.b); h.timers.tick(1000); assert.deepEqual(h.shown, []);
});

const source = await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8');
test('actual hero paint safely stops after route disposal during its awaited transition', async () => {
  let resume; const classes = {add() {}, remove() {}, toggle() {}};
  const copy = {isConnected: true, classList: classes}, el = {isConnected: true, classList: classes};
  const H = vm.runInNewContext(source.slice(source.indexOf('const H = {'), source.indexOf("document.addEventListener('visibilitychange'")) + '\nH;', {
    createTransitionGuard, $: () => copy, $$: () => [], reduced: () => false, kicker: () => '', titleArt: () => '', meta: () => '', graphNote: () => '', launchBtn: () => '', saveBtn: () => '', esc: x => x,
    ICON: {info: ''}, wait: () => new Promise(resolve => { resume = resolve; }), clearTimeout, setTimeout, S: {}, sky: {show() { throw new Error('stale render must not draw'); }}
  });
  H.el = el; H.list = [{id: 'alpha', logline: 'Test'}]; const pending = H.paint(); H.unmount(); resume(); await pending;
  assert.equal(H.el, null);
});
test('standard card markup selects a real screenshot; portrait and expired captures use art', () => {
  const tile = vm.runInNewContext(source.slice(source.indexOf('function tile('), source.indexOf('function rail(')) + '\ntile;', {
    approvedScreenshot, justAdded: () => false, isNew: () => false, isUpdated: () => false, art: () => 'constellation.svg', esc: x => x, titleArt: () => 'Title', saveBtn: () => '', mini: () => ''
  });
  const a = {id: 'alpha', title: 'Alpha', domain: 'Data', logline: 'Description', screenshot: {path: 'screenshots/alpha-123456abcdef.jpg', approved: true, capturedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString()}};
  assert.match(tile(a), /src="screenshots\/alpha-/); assert.match(tile(a), /App screenshot/);
  assert.match(tile(a, {shape: 'tall'}), /src="constellation.svg"/);
  assert.match(tile({...a, screenshot: {...a.screenshot, expiresAt: '2000-01-01'}}), /Constellation preview/);
});
test('draft title route requests its authorized record rather than the published catalog', async () => {
  const calls = [];
  const pageTitle = vm.runInNewContext(source.slice(source.indexOf('async function pageTitle('), source.indexOf('function screenMarkup(')) + '\npageTitle;', {
    toApp: x => x, call: async (method, path) => { calls.push([method, path]); throw {status: 404}; }, pageMissing: () => 'missing'
  });
  assert.equal(await pageTitle('private-draft'), 'missing'); assert.deepEqual(calls, [['GET', 'apps/private-draft']]);
});
test('My List refresh replaces removed cards and updates its count immediately', () => {
  const body = {innerHTML: '', contains: () => false}, count = {textContent: ''};
  const code = source.slice(source.indexOf('function myListBody('), source.indexOf('function pageMyStuff('));
  const context = {S: {apps: [{id: 'alpha'}, {id: 'beta'}]}, saved: id => id === 'beta', document: {activeElement: null}, tile: a => `<li>${a.id}</li>`, $: selector => ({'#my-list-results': body, '#my-list-count': count})[selector]};
  vm.runInNewContext(code + '\nsyncMyList();', context);
  assert.match(body.innerHTML, /beta/); assert.doesNotMatch(body.innerHTML, /alpha/); assert.equal(count.textContent, 1);
  context.saved = () => false; vm.runInNewContext(code + '\nsyncMyList();', context);
  assert.match(body.innerHTML, /Your list is empty/); assert.equal(count.textContent, 0);
});
test('keyboard, coarse-pointer and mobile control rules remain present', async () => {
  const css = await readFile(new URL('../dist/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.tile:focus-within \.tile-hover\{grid-template-rows:1fr\}/);
  assert.match(css, /@media \(hover:none\),\(pointer:coarse\)/);
  assert.doesNotMatch(css, /\.hero-btn\{display:none\}/);
  assert.doesNotMatch(css, /\.avatar\{display:none\}/);
});
test('actual save handler updates all matching buttons and synchronizes the list', async () => {
  const buttons = [0, 1].map(() => ({attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }}));
  const S = {list: new Set(['alpha'])}; let synced = 0;
  const toggleSave = vm.runInNewContext(source.slice(source.indexOf('async function toggleSave('), source.indexOf('const pendingDelete')) + '\ntoggleSave;', {
    byId: () => ({id: 'alpha', title: 'Alpha'}), pendingSaves: new Set(), saved: id => S.list.has(id), S,
    call: async (method, path) => { assert.equal(method, 'DELETE'); assert.equal(path, 'me/list/alpha'); return []; },
    $$: () => buttons, paintChrome() {}, syncMyList() { synced++; }, toast() {}
  });
  await toggleSave('alpha'); assert.equal(synced, 1); assert.equal(S.list.size, 0);
  for (const button of buttons) { assert.equal(button.attributes['aria-pressed'], 'false'); assert.equal(button.textContent, '+'); }
});
test('rail wiring tolerates empty pages and repeated mount calls', () => {
  const listeners = new Map();
  const code = source.slice(source.indexOf('const wiredRails'), source.indexOf('function wireHoverPreview'));
  vm.runInNewContext(code + '\nwireRails({}); wireRails({});', {$$: () => [], addEventListener: (type, fn) => listeners.set(type, fn)});
  assert.doesNotThrow(() => listeners.get('resize')());
});
test('capture status polling updates every marker and stops after route cleanup', async () => {
  const markers = [{dataset: {captureStatus: 'alpha', status: 'queued'}}, {dataset: {captureStatus: 'alpha', status: 'running'}}];
  const callbacks = [], cleanup = [], S = {api: {mode: 'server'}, apps: [{id: 'alpha'}], byId: new Map()}; let cleared = 0;
  const code = source.slice(source.indexOf('function wireCaptureStatus('), source.indexOf('function pageHub('));
  vm.runInNewContext(code + '\nwireCaptureStatus();', {
    S, pageCleanups: cleanup, $$: () => markers, setTimeout: fn => callbacks.push(fn), clearTimeout: () => cleared++,
    call: async () => ({id: 'alpha', capture: {status: 'succeeded'}}), toApp: x => x, screenshotLabel: () => 'Ready', parse: () => ({name: 'studio'})
  });
  await callbacks.shift()(); assert.ok(markers.every(el => el.dataset.status === 'succeeded' && el.textContent === 'Ready'));
  assert.equal(S.byId.get('alpha').capture.status, 'succeeded'); cleanup[0](); assert.equal(cleared, 1);
});
