import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_VISUAL_TYPES, validateKeyVisual, formation, artSvg, generatedKeyVisual} from '../dist/lib/constellation.mjs';
import {DOMAINS} from '../dist/lib/themes.mjs';
import {logoFormation, markSvg, faviconSvg} from '../dist/lib/brand.mjs';

const samples = {
  line: {type: 'line', series: [3, 5, 4, 8, 12]}, area: {type: 'area', series: [1, 2, 3]}, bar: {type: 'bar', series: [6, 9, 4]},
  funnel: {type: 'funnel', series: [100, 60, 30, 12]}, wave: {type: 'wave', lines: [[0, .5, 1, .5, 0]]},
  scatter: {type: 'scatter', points: [[1, 2], [3, 4, 2], [5, 1]]}, network: {type: 'network', nodes: 6, edges: [[0, 1], [1, 5]]},
  flow: {type: 'flow', stages: [1, 3, 2]}, radial: {type: 'radial', rings: [5, 9]}, matrix: {type: 'matrix', rows: [[1, 2, 3], [3, 2, 1]]}
};
const base = {id: 'kv-test', title: 'KV test', domain: 'Data'};

test('every key graph type validates and becomes a bounded, deterministic constellation', () => {
  for (const type of KEY_VISUAL_TYPES) {
    const kv = validateKeyVisual(samples[type]);
    const f = formation({...base, keyVisual: kv});
    assert.equal(f.type, type);
    assert.ok(f.points.length >= 2 && f.points.length <= 64, type);
    for (const p of f.points) { assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, `${type} point out of box`); assert.ok(p.m > 0 && p.m <= 1); }
    for (const [a, b] of f.edges) assert.ok(a < f.points.length && b < f.points.length);
    assert.deepEqual(formation({...base, keyVisual: kv}), f, `${type} is not deterministic`);
  }
});

test('the highest value in a line graph becomes the bright peak star', () => {
  const f = formation({...base, keyVisual: {type: 'line', series: [1, 9, 2]}});
  assert.equal(f.points.findIndex(p => p.peak), 1);
});

test('key graphs from app pages are untrusted: only numbers, only within limits', () => {
  for (const bad of [
    'line', [], {type: 'pie', series: [1, 2]}, {type: 'line', series: ['1', 2]}, {type: 'line', series: [1, NaN]}, {type: 'line', series: [1, Infinity]},
    {type: 'line', series: Array(41).fill(1)}, {type: 'network', nodes: 31}, {type: 'network', nodes: 4, edges: [[0, 9]]},
    {type: 'flow', stages: [1, 5]}, {type: 'matrix', rows: [[1, 2], [1, 2, 3]]}, {type: 'wave', lines: [[1, 2, 3, 4]].concat([[1, 2, 3, 4]], [[1, 2, 3, 4]], [[1, 2, 3, 4]])}
  ]) assert.throws(() => validateKeyVisual(bad), undefined, JSON.stringify(bad));
  assert.equal(validateKeyVisual(null), null);
  assert.equal(validateKeyVisual({type: 'bar', series: [1, 2], label: '<img src=x onerror=alert(1)>\u0000Open holds'}).label, 'img src=x onerror=alert(1) Open holds');
  assert.equal(validateKeyVisual({type: 'bar', series: [1, 2], extra: 'ignored'}).extra, undefined);
});

test('a broken key graph falls back to the generated pattern instead of failing the page', () => {
  const f = formation({...base, keyVisual: {type: 'line', series: ['x']}});
  assert.equal(f.source, 'generated');
  assert.equal(formation({...base, keyVisual: samples.bar, keyVisualSource: 'app'}).source, 'app');
});

test('every domain has a generated pattern that passes its own validation', () => {
  for (const d of DOMAINS) assert.doesNotThrow(() => validateKeyVisual(generatedKeyVisual(`app-${d}`, d)), d);
});

test('art SVG is well formed and escapes titles', () => {
  for (const shape of ['wide', 'tall']) {
    const svg = artSvg({...base, title: 'Cost & <b>risk</b>', keyVisual: samples.scatter}, {shape, title: true});
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.doesNotMatch(svg, /<b>|&(?!(amp|lt|gt|quot|apos|#\d+);)/);
  }
});

test('the logo constellation and marks are well formed', () => {
  const f = logoFormation();
  assert.ok(f.points.length > 15 && f.points.some(p => p.peak));
  for (const s of [markSvg({id: 't'}), faviconSvg()]) assert.match(s, /^<svg[\s\S]*<\/svg>$/);
});
