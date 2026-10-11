// The app's key graph drawn plainly, shown beside its constellation on the title page.
import {formation, validateKeyVisual, generatedKeyVisual, esc} from './constellation.mjs';
import {THEMES} from './themes.mjs';

const nrm = v => { const lo = Math.min(...v), hi = Math.max(...v); return v.map(x => hi === lo ? .5 : (x - lo) / (hi - lo)); };
const fmt = v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${+(+v).toFixed(2)}`;
const n1 = v => v.toFixed(1);

export function plainChartSvg(app) {
  let kv = null; try { kv = validateKeyVisual(app.keyVisual); } catch { kv = null; }
  if (!kv) kv = generatedKeyVisual(app.id, app.domain);
  const W = 800, H = 450, L = 72, R = 32, T = 36, B = 44, pw = W - L - R, ph = H - T - B, acc = (THEMES[app.domain] || THEMES.Platform).accent;
  const axis = `<path d="M${L} ${T}V${T + ph}H${L + pw}" stroke="#4A4560" fill="none"/>`;
  const grid = [.25, .5, .75].map(f => `<path d="M${L} ${n1(T + ph * f)}H${L + pw}" stroke="#2A2638" stroke-dasharray="3 6"/>`).join('');
  const ylab = (lo, hi) => `<text x="${L - 12}" y="${T + 4}" text-anchor="end">${fmt(hi)}</text><text x="${L - 12}" y="${T + ph + 4}" text-anchor="end">${fmt(lo)}</text>`;
  const line = (values, lo, hi, attrs) => 'M' + values.map((v, i) => `${n1(L + pw * i / (values.length - 1))} ${n1(T + ph * (1 - (hi === lo ? .5 : (v - lo) / (hi - lo))))}`).join('L');
  let body = '';
  switch (kv.type) {
    case 'line': case 'area': {
      const s = kv.series, lo = Math.min(...s), hi = Math.max(...s), d = line(s, lo, hi);
      body = grid + axis + (kv.type === 'area' ? `<path d="${d}L${L + pw} ${T + ph}L${L} ${T + ph}Z" fill="${acc}" fill-opacity=".14"/>` : '') +
        `<path d="${d}" fill="none" stroke="${acc}" stroke-width="2.5" stroke-linejoin="round"/>` +
        s.map((v, i) => `<circle cx="${n1(L + pw * i / (s.length - 1))}" cy="${n1(T + ph * (1 - (hi === lo ? .5 : (v - lo) / (hi - lo))))}" r="3.5" fill="${acc}"/>`).join('') + ylab(lo, hi);
      break;
    }
    case 'bar': {
      const s = kv.series, hi = Math.max(...s, 0), lo = Math.min(0, ...s), span = (hi - lo) || 1, bw = pw / s.length * .62;
      body = grid + axis + s.map((v, i) => { const h = ph * (v - lo) / span, x = L + pw * (i + .5) / s.length - bw / 2; return `<rect x="${n1(x)}" y="${n1(T + ph - h)}" width="${n1(bw)}" height="${n1(h)}" rx="2" fill="${acc}" fill-opacity="${(.45 + .5 * (v - lo) / span).toFixed(2)}"/>`; }).join('') + ylab(lo, hi);
      break;
    }
    case 'funnel': {
      const s = kv.series, hi = Math.max(...s) || 1, rh = ph / s.length * .74;
      body = s.map((v, i) => { const w = Math.max(30, pw * v / hi), y = T + ph * i / s.length; return `<rect x="${n1(L + (pw - w) / 2)}" y="${n1(y)}" width="${n1(w)}" height="${n1(rh)}" rx="3" fill="${acc}" fill-opacity="${(.9 - i * .1).toFixed(2)}"/><text x="${L + pw / 2}" y="${n1(y + rh / 2 + 4)}" text-anchor="middle" fill="#0B0812" font-weight="600">${fmt(v)}</text>`; }).join('');
      break;
    }
    case 'wave': {
      const all = kv.lines.flat(), lo = Math.min(...all), hi = Math.max(...all);
      body = grid + axis + kv.lines.map((l, k) => `<path d="${line(l, lo, hi)}" fill="none" stroke="${acc}" stroke-opacity="${k ? .45 : 1}" stroke-width="${k ? 1.8 : 2.5}" stroke-linejoin="round"/>`).join('') + ylab(lo, hi);
      break;
    }
    case 'scatter': {
      const xs = nrm(kv.points.map(p => p[0])), ys = nrm(kv.points.map(p => p[1])), sz = kv.points.every(p => p.length > 2) ? nrm(kv.points.map(p => p[2])) : null;
      const yv = kv.points.map(p => p[1]);
      body = grid + axis + kv.points.map((_, i) => `<circle cx="${n1(L + pw * xs[i])}" cy="${n1(T + ph * (1 - ys[i]))}" r="${n1(sz ? 4 + sz[i] * 7 : 5)}" fill="${acc}" fill-opacity=".72"/>`).join('') + ylab(Math.min(...yv), Math.max(...yv));
      break;
    }
    case 'matrix': {
      const rows = kv.rows, flat = nrm(rows.flat()), c = rows[0].length, cw = pw / c, ch = ph / rows.length;
      body = rows.map((r, i) => r.map((_, j) => `<rect x="${n1(L + cw * j + 2)}" y="${n1(T + ch * i + 2)}" width="${n1(cw - 4)}" height="${n1(ch - 4)}" rx="3" fill="${acc}" fill-opacity="${(.07 + flat[i * c + j] * .86).toFixed(2)}"/>`).join('')).join('');
      break;
    }
    default: {                         // network, flow, radial: a plain node-link diagram
      const f = formation({...app, keyVisual: kv}), X = x => L + pw * x, Y = y => T + ph * y;
      body = f.edges.map(([a, b]) => `<path d="M${n1(X(f.points[a].x))} ${n1(Y(f.points[a].y))}L${n1(X(f.points[b].x))} ${n1(Y(f.points[b].y))}" stroke="#5E587A" stroke-width="1.5"/>`).join('') +
        f.points.map(p => `<circle cx="${n1(X(p.x))}" cy="${n1(Y(p.y))}" r="${n1(4 + p.m * 5)}" fill="#141122" stroke="${acc}" stroke-width="2"/>`).join('');
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(kv.label || `${kv.type} chart`)}"><rect width="${W}" height="${H}" fill="#0D0B16"/><g font-family="'JetBrains Mono',ui-monospace,monospace" font-size="12" fill="#8E87A3">${body}</g></svg>`;
}
