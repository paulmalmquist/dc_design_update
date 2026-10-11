// Turns an app's key graph into a constellation: stars at the data points, thin lines between them.
// Shared by the browser (tiles, hero sky) and the build (static thumbnails). No DOM, no network.
import {THEMES} from './themes.mjs';

export const KEY_VISUAL_TYPES = ['line', 'area', 'bar', 'funnel', 'wave', 'scatter', 'network', 'flow', 'radial', 'matrix'];
const ASPECT = 1.6;                       // formations are laid out in a 1.6 : 1 box
const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cleanText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed) {                // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── validation: key visuals can come from an app's own page, so they are untrusted input ──
function numbers(value, name, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max || !value.every(finite)) throw new Error(`keyVisual.${name} must be ${min}–${max} finite numbers.`);
  return value.map(v => clamp(v, -1e12, 1e12));
}
function ints(value, name, min, max, lo, hi) {
  if (!Array.isArray(value) || value.length < min || value.length > max || !value.every(v => Number.isInteger(v) && v >= lo && v <= hi)) throw new Error(`keyVisual.${name} must be ${min}–${max} whole numbers between ${lo} and ${hi}.`);
  return value.slice();
}
export function validateKeyVisual(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('keyVisual must be an object.');
  const type = String(input.type || '');
  if (!KEY_VISUAL_TYPES.includes(type)) throw new Error(`keyVisual.type must be one of ${KEY_VISUAL_TYPES.join(', ')}.`);
  const out = {type};
  if (['line', 'area', 'bar', 'funnel'].includes(type)) out.series = numbers(input.series, 'series', 2, 40);
  if (type === 'wave') {
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 3) throw new Error('keyVisual.lines must hold 1–3 series.');
    out.lines = input.lines.map((l, i) => numbers(l, `lines[${i}]`, 4, 60));
  }
  if (type === 'scatter') {
    if (!Array.isArray(input.points) || input.points.length < 3 || input.points.length > 60) throw new Error('keyVisual.points must hold 3–60 points.');
    out.points = input.points.map((p, i) => numbers(p, `points[${i}]`, 2, 3));
  }
  if (type === 'network') {
    if (!Number.isInteger(input.nodes) || input.nodes < 3 || input.nodes > 30) throw new Error('keyVisual.nodes must be 3–30.');
    out.nodes = input.nodes;
    if (input.edges !== undefined) {
      if (!Array.isArray(input.edges) || input.edges.length > 80) throw new Error('keyVisual.edges must hold up to 80 pairs.');
      out.edges = input.edges.map((e, i) => ints(e, `edges[${i}]`, 2, 2, 0, out.nodes - 1)).filter(([a, b]) => a !== b);
    }
  }
  if (type === 'flow') out.stages = ints(input.stages, 'stages', 2, 8, 1, 4);
  if (type === 'radial') out.rings = ints(input.rings, 'rings', 1, 4, 2, 16);
  if (type === 'matrix') {
    if (!Array.isArray(input.rows) || input.rows.length < 2 || input.rows.length > 6) throw new Error('keyVisual.rows must hold 2–6 rows.');
    out.rows = input.rows.map((r, i) => numbers(r, `rows[${i}]`, 2, 10));
    if (new Set(out.rows.map(r => r.length)).size !== 1) throw new Error('keyVisual.rows must all be the same length.');
  }
  const label = cleanText(input.label, 80);
  if (label) out.label = label;
  return out;
}

// ── generated key visual, used only when the app has not published one ──
export function generatedKeyVisual(id, domain) {
  const r = rng(seedOf(`${id}|${domain}`));
  const motif = (THEMES[domain] || THEMES.Platform).motif;
  const walk = (n, start = .5, step = .22) => { let v = start; return Array.from({length: n}, () => (v = clamp(v + (r() - .42) * step, .05, 1))); };
  switch (motif) {
    case 'flow': return {type: 'flow', stages: Array.from({length: 4 + Math.floor(r() * 3)}, () => 1 + Math.floor(r() * 3))};
    case 'network': return {type: 'network', nodes: 8 + Math.floor(r() * 6)};
    case 'matrix': return {type: 'matrix', rows: Array.from({length: 4}, () => Array.from({length: 7}, () => +r().toFixed(2)))};
    case 'wave': return {type: 'wave', lines: [0, 1].map(k => Array.from({length: 22}, (_, i) => Math.sin(i * .45 + k * 1.3 + r() * 2) * (1 - k * .35) + r() * .3))};
    case 'bar': return {type: 'bar', series: walk(7, .35, .35)};
    default: return {type: 'radial', rings: [5 + Math.floor(r() * 3), 8 + Math.floor(r() * 4)]};
  }
}

// ── formations: normalised stars + edges in a 1.6 : 1 box ──
const X0 = .06, X1 = .94, Y0 = .1, Y1 = .9;
const nx = t => X0 + t * (X1 - X0), ny = t => Y0 + t * (Y1 - Y0);
function normalise(values) { const lo = Math.min(...values), hi = Math.max(...values); return values.map(v => hi === lo ? .5 : (v - lo) / (hi - lo)); }
function resample(values, max) { if (values.length <= max) return values; return Array.from({length: max}, (_, i) => values[Math.round(i * (values.length - 1) / (max - 1))]); }
function argmax(list, key) { let best = 0; list.forEach((v, i) => { if (key(v) > key(list[best])) best = i; }); return best; }

export function formation(app) {
  let kv = null;
  try { kv = validateKeyVisual(app.keyVisual); } catch { kv = null; }
  const source = kv ? (app.keyVisualSource === 'app' ? 'app' : 'metadata') : 'generated';
  if (!kv) kv = generatedKeyVisual(app.id || 'app', app.domain);
  const f = build(kv, rng(seedOf(app.id || 'app')));
  f.points = f.points.slice(0, 64);
  f.edges = f.edges.filter(([a, b]) => a < f.points.length && b < f.points.length);
  return {...f, type: kv.type, label: kv.label || '', source, aspect: ASPECT};
}

function build(kv, r) {
  const P = [], E = [];
  const add = (x, y, m = .5, extra = {}) => (P.push({x: clamp(x, 0, 1), y: clamp(y, 0, 1), m: clamp(m, .05, 1), ...extra}), P.length - 1);
  const link = (a, b, w = 1) => E.push([a, b, w]);
  const peak = i => { if (P[i]) { P[i].peak = true; P[i].m = 1; } };
  switch (kv.type) {
    case 'line': case 'area': {
      const s = normalise(resample(kv.series, 24)), ids = s.map((v, i) => add(nx(i / (s.length - 1)), ny(.92 - v * .84), .32 + v * .55));
      ids.slice(1).forEach((id, i) => link(ids[i], id, 1));
      if (kv.type === 'area') { const a = add(P[ids[0]].x, ny(1), .18), b = add(P[ids.at(-1)].x, ny(1), .18); link(ids[0], a, .3); link(a, b, .3); link(b, ids.at(-1), .3); }
      peak(ids[argmax(s, v => v)]); break;
    }
    case 'bar': {
      const s = normalise(resample(kv.series, 12)), tops = [];
      s.forEach((v, i) => {
        const x = nx(.04 + .92 * i / Math.max(1, s.length - 1)), h = .12 + v * .8, k = 1 + Math.round(h * 4);
        let prev = -1;
        for (let j = 0; j <= k; j++) { const id = add(x, ny(1 - h * j / k), j === k ? .45 + v * .5 : .22); if (prev >= 0) link(prev, id, .85); prev = id; }
        tops.push(prev);
      });
      tops.slice(1).forEach((id, i) => link(tops[i], id, .22));
      peak(tops[argmax(s, v => v)]); break;
    }
    case 'funnel': {
      const s = normalise(kv.series.slice(0, 7)); let prev = null;
      s.forEach((v, i) => {
        const y = ny(i / Math.max(1, s.length - 1)), w = .1 + v * .8;
        const a = add(.5 - w / 2, y, .3 + v * .5), b = add(.5 + w / 2, y, .3 + v * .5);
        link(a, b, .45); if (prev) { link(prev[0], a, .9); link(prev[1], b, .9); } prev = [a, b];
      });
      peak(0); break;
    }
    case 'wave': {
      const all = kv.lines.flat(), lo = Math.min(...all), hi = Math.max(...all); let best = -1, bestV = -Infinity;
      kv.lines.forEach((line, k) => {
        const s = resample(line, 20), ids = s.map((v, i) => { const t = hi === lo ? .5 : (v - lo) / (hi - lo); const id = add(nx(i / (s.length - 1)), ny(.9 - t * .8), k ? .26 : .3 + t * .5); if (v > bestV) { bestV = v; best = id; } return id; });
        ids.slice(1).forEach((id, i) => link(ids[i], id, k ? .45 : 1));
      });
      peak(best); break;
    }
    case 'scatter': {
      const xs = normalise(kv.points.map(p => p[0])), ys = normalise(kv.points.map(p => p[1])), sz = kv.points.every(p => p.length > 2) ? normalise(kv.points.map(p => p[2])) : null;
      const ids = kv.points.map((_, i) => add(nx(xs[i]), ny(1 - ys[i]), sz ? .25 + sz[i] * .7 : .45));
      const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
      const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
      const a = add(nx(0), ny(1 - clamp(my - slope * mx, 0, 1)), .12), b = add(nx(1), ny(1 - clamp(my + slope * (1 - mx), 0, 1)), .12);
      link(a, b, .28); peak(ids[argmax(ids, i => P[i].m)]); break;
    }
    case 'network': {
      const n = kv.nodes, pos = Array.from({length: n}, (_, i) => { const t = i / n * Math.PI * 2; return [Math.cos(t) * .8 + (r() - .5) * .5, Math.sin(t) * .8 + (r() - .5) * .5]; });
      let edges = kv.edges;
      if (!edges) { edges = []; for (let i = 1; i < n; i++) { let best = 0, bd = Infinity; for (let j = 0; j < i; j++) { const d = (pos[i][0] - pos[j][0]) ** 2 + (pos[i][1] - pos[j][1]) ** 2; if (d < bd) { bd = d; best = j; } } edges.push([i, best]); if (r() < .35 && i > 2) edges.push([i, Math.floor(r() * i)]); } }
      for (let it = 0; it < 140; it++) {
        const f = pos.map(() => [0, 0]);
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1], d2 = dx * dx + dy * dy + .01, k = .012 / d2; f[i][0] += dx * k; f[i][1] += dy * k; f[j][0] -= dx * k; f[j][1] -= dy * k; }
        for (const [a, b] of edges) { const dx = pos[b][0] - pos[a][0], dy = pos[b][1] - pos[a][1], k = .06; f[a][0] += dx * k; f[a][1] += dy * k; f[b][0] -= dx * k; f[b][1] -= dy * k; }
        pos.forEach((p, i) => { p[0] += clamp(f[i][0], -.05, .05) - p[0] * .004; p[1] += clamp(f[i][1], -.05, .05) - p[1] * .004; });
      }
      const xs = normalise(pos.map(p => p[0])), ys = normalise(pos.map(p => p[1])), deg = Array(n).fill(0);
      edges.forEach(([a, b]) => { deg[a]++; deg[b]++; });
      const maxDeg = Math.max(...deg);
      const ids = pos.map((_, i) => add(nx(.06 + xs[i] * .88), ny(.04 + ys[i] * .92), .25 + .7 * deg[i] / maxDeg));
      edges.forEach(([a, b]) => link(ids[a], ids[b], .8)); peak(ids[argmax(deg, d => d)]); break;
    }
    case 'flow': {
      const st = kv.stages.slice(0, 8); let prev = [];
      st.forEach((count, s) => {
        const x = nx(s / (st.length - 1)), ids = Array.from({length: count}, (_, k) => add(x, ny(.5 + (k - (count - 1) / 2) * .26 + (r() - .5) * .06), s === st.length - 1 ? .8 : .45));
        for (const a of prev) for (const b of ids) link(a, b, .65);
        prev = ids;
      });
      peak(prev[0]); break;
    }
    case 'radial': {
      const c = add(.5, .5, 1, {peak: true}); let first = null;
      kv.rings.slice(0, 4).forEach((count, k) => {
        const rx = .14 + k * .14, ry = rx * ASPECT * .92, off = r() * Math.PI * 2;
        const ids = Array.from({length: count}, (_, i) => { const t = off + i / count * Math.PI * 2; return add(.5 + Math.cos(t) * rx, .5 + Math.sin(t) * ry, .3 + (k ? 0 : .25)); });
        ids.forEach((id, i) => { if (i % 3 !== 2 || k === 0) link(id, ids[(i + 1) % count], .55); });
        if (!first) { first = ids; ids.forEach((id, i) => { if (i % 2 === 0) link(c, id, .35); }); }
      });
      break;
    }
    case 'matrix': {
      const rows = kv.rows, flat = normalise(rows.flat()), cols = rows[0].length; let best = 0;
      rows.forEach((row, i) => row.forEach((_, j) => { const v = flat[i * cols + j]; const id = add(nx(.08 + .84 * j / Math.max(1, cols - 1)), ny(.08 + .84 * i / Math.max(1, rows.length - 1)), .15 + v * .8); if (v >= flat[best]) best = i * cols + j; if (j) link(id - 1, id, .12 + v * .25); }));
      peak(best); break;
    }
  }
  return {points: P, edges: E};
}

// ── SVG art (static thumbnails). Title text is only drawn for exported thumbnails. ──
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const f1 = v => Math.round(v * 10) / 10;
export const LAYOUT = {
  wide: {w: 800, h: 450, box: [.36, .1, .96, .74]},
  tall: {w: 600, h: 900, box: [.07, .1, .93, .5]},
  hub:  {w: 800, h: 450, box: [.3, .12, .95, .88]},
  square: {w: 600, h: 600, box: [.08, .14, .92, .7]}
};
function fit(box, w, h) {           // fit the 1.6:1 formation inside a box, centred
  const bw = (box[2] - box[0]) * w, bh = (box[3] - box[1]) * h;
  const fw = Math.min(bw, bh * ASPECT), fh = fw / ASPECT;
  return {x: box[0] * w + (bw - fw) / 2, y: box[1] * h + (bh - fh) / 2, w: fw, h: fh};
}
export function artSvg(app, {shape = 'wide', title = false} = {}) {
  const L = LAYOUT[shape] || LAYOUT.wide, t = THEMES[app.domain] || THEMES.Platform, {w, h} = L;
  const f = formation(app), b = fit(L.box, w, h), s = Math.min(w, h) / 450;
  const r = rng(seedOf(`${app.id}|sky`)), uid = `a${seedOf(`${app.id}|${shape}`).toString(36)}`;
  const sky = Array.from({length: Math.round(w * h / 5200)}, () => `<circle cx="${f1(r() * w)}" cy="${f1(r() * h)}" r="${f1((r() < .12 ? 1.3 : .7) * s)}" fill="#fff" opacity="${(.12 + r() * .38).toFixed(2)}"/>`).join('');
  const px = p => [f1(b.x + p.x * b.w), f1(b.y + p.y * b.h)];
  const lines = f.edges.map(([a, c, wgt]) => { const [x1, y1] = px(f.points[a]), [x2, y2] = px(f.points[c]); return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-opacity="${(.14 + wgt * .46).toFixed(2)}"/>`; }).join('');
  const stars = f.points.map(p => {
    const [x, y] = px(p), core = (1.1 + p.m * 2.4) * s, glow = core * (p.peak ? 6 : 3.6);
    let out = `<circle cx="${x}" cy="${y}" r="${f1(glow)}" fill="url(#${uid}g)" opacity="${(.35 + p.m * .6).toFixed(2)}"/><circle cx="${x}" cy="${y}" r="${f1(core)}" fill="#fff" opacity="${(.55 + p.m * .45).toFixed(2)}"/>`;
    if (p.peak) { const R = 11 * s, q = 1.8 * s; out += `<path d="M${x} ${f1(y - R)}L${f1(x + q)} ${f1(y - q)}L${f1(x + R)} ${y}L${f1(x + q)} ${f1(y + q)}L${x} ${f1(y + R)}L${f1(x - q)} ${f1(y + q)}L${f1(x - R)} ${y}L${f1(x - q)} ${f1(y - q)}Z" fill="#fff"/>`; }
    return out;
  }).join('');
  const label = esc(app.title || '');
  const text = title ? `<text x="${f1(w * .06)}" y="${f1(h * (shape === 'tall' ? .84 : .82))}" fill="#F6F3FF" font-family="'Instrument Sans','Helvetica Neue',Arial,sans-serif" font-size="${f1(s * (label.length > 22 ? 30 : 38))}" font-weight="600" letter-spacing="-.5">${label}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}: constellation drawn from its ${esc(f.type)} graph">` +
    `<defs><radialGradient id="${uid}n" cx=".7" cy=".38" r=".75"><stop offset="0" stop-color="${t.deep}"/><stop offset="1" stop-color="#07060D"/></radialGradient>` +
    `<radialGradient id="${uid}g"><stop offset="0" stop-color="${t.accent}" stop-opacity=".9"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#07060D" stop-opacity="0"/><stop offset="1" stop-color="#07060D" stop-opacity=".85"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#${uid}n)"/>${sky}<g stroke="${t.accent}" stroke-width="${f1(1.3 * s)}" fill="none" stroke-linecap="round">${lines}</g>${stars}` +
    `<rect width="${w}" height="${h}" fill="url(#${uid}f)"/>${text}</svg>`;
}
