// Dreamcatcher mark: the "hanging ligature". The bowl of the d is a c; the stem passes over it at the top,
// under it at the bottom, and hangs from a loop. A star sits in the counter.
// One geometry drives the header logo, the favicon and the intro constellation.
export const MARK = {w: 255, h: 402, cx: 135, cy: 267, r: 115, gap: 30, sx: 173, stemTop: 41, stemBot: 382, loop: {x: 173, y: 25, r: 16}, spark: {x: 121, y: 259}, stroke: 30};
export const BRAND = {lilac: '#CE96FF', ink: '#F1EEF6', night: '#0B0D1F'};

const rad = d => d * Math.PI / 180;
const pt = (a, r = MARK.r) => [MARK.cx + r * Math.cos(rad(a)), MARK.cy + r * Math.sin(rad(a))];
const n = v => Math.round(v * 10) / 10;
function sparkle(x, y, R, r) {
  return 'M' + Array.from({length: 8}, (_, i) => { const t = rad(i * 45 - 90), q = i % 2 ? r : R; return `${n(x + q * Math.cos(t))} ${n(y + q * Math.sin(t))}`; }).join('L') + 'Z';
}

export function markSvg({id = 'dcm', c = BRAND.lilac, ink = BRAND.ink, title = 'Dreamcatcher', className = ''} = {}) {
  const {cx, cy, r, gap, sx, stemTop, stemBot, loop, spark, stroke} = MARK, g = 10, w = stroke + 2 * g;
  const [ax, ay] = pt(-gap), [bx, by] = pt(gap);
  const dy = Math.sqrt(r * r - (sx - cx) ** 2), yT = cy - dy, aB = Math.atan2(dy, sx - cx) * 180 / Math.PI;
  const [p0x, p0y] = pt(aB - 20), [p1x, p1y] = pt(aB + 20);
  const cPath = `M${n(ax)} ${n(ay)}A${r} ${r} 0 1 0 ${n(bx)} ${n(by)}`;
  return `<svg class="${className}" viewBox="0 0 ${MARK.w} ${MARK.h}" role="img" aria-label="${title}"><defs>` +
    `<mask id="${id}c" maskUnits="userSpaceOnUse" x="0" y="0" width="${MARK.w}" height="${MARK.h}"><rect width="${MARK.w}" height="${MARK.h}" fill="#fff"/><path d="M${sx} ${n(yT - 35)}V${n(yT + 35)}" stroke="#000" stroke-width="${w}"/></mask>` +
    `<mask id="${id}s" maskUnits="userSpaceOnUse" x="0" y="0" width="${MARK.w}" height="${MARK.h}"><rect width="${MARK.w}" height="${MARK.h}" fill="#fff"/><path d="M${n(p0x)} ${n(p0y)}A${r} ${r} 0 0 1 ${n(p1x)} ${n(p1y)}" fill="none" stroke="#000" stroke-width="${w}"/></mask></defs>` +
    `<path d="${cPath}" fill="none" stroke="${c}" stroke-width="${stroke}" stroke-linecap="round" mask="url(#${id}c)"/>` +
    `<path d="M${sx} ${stemTop}V${stemBot}" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round" mask="url(#${id}s)"/>` +
    `<circle cx="${loop.x}" cy="${loop.y}" r="${loop.r}" fill="none" stroke="${ink}" stroke-width="8"/>` +
    `<path d="${sparkle(spark.x, spark.y, 15, 3.2)}" fill="${ink}"/></svg>`;
}

// Favicon / app icon: the heavy ligature, simplified for 16–64 px.
export function faviconSvg() {
  const cx = 30, cy = 35, r = 16.5, a = 27, sx = 34.6, [ax, ay] = [cx + r * Math.cos(rad(-a)), cy + r * Math.sin(rad(-a))], [bx, by] = [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${BRAND.night}"/>` +
    `<path d="M${n(ax)} ${n(ay)}A${r} ${r} 0 1 0 ${n(bx)} ${n(by)}" fill="none" stroke="${BRAND.lilac}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M${sx} 9V${cy + r}" stroke="${BRAND.night}" stroke-width="13" stroke-linecap="round"/><path d="M${sx} 9V${cy + r}" stroke="${BRAND.ink}" stroke-width="8" stroke-linecap="round"/></svg>`;
}

// The mark as a constellation, for the intro: stars along the c, the stem and the loop, one bright star in the counter.
export function logoFormation() {
  const {cx, cy, r, gap, sx, stemTop, stemBot, loop, spark, w, h} = {...MARK, w: MARK.w, h: MARK.h};
  const P = [], E = [], add = (x, y, m, peak = false) => (P.push({x: x / w, y: y / h, m, peak}), P.length - 1);
  const arc = []; for (let i = 0; i <= 12; i++) { const ang = -gap - i * (360 - 2 * gap) / 12, [x, y] = pt(ang); arc.push(add(x, y, i === 0 || i === 12 ? .8 : .5)); }
  arc.slice(1).forEach((id, i) => E.push([arc[i], id, 1]));
  const stem = []; for (let i = 0; i <= 5; i++) stem.push(add(sx, stemTop + (stemBot - stemTop) * i / 5, i === 0 ? .7 : .45));
  stem.slice(1).forEach((id, i) => E.push([stem[i], id, 1]));
  const lp = []; for (let i = 0; i < 5; i++) { const t = rad(90 + i * 72); lp.push(add(loop.x + loop.r * 1.5 * Math.cos(t), loop.y - 4 + loop.r * 1.5 * Math.sin(t), .4)); }
  lp.forEach((id, i) => E.push([id, lp[(i + 1) % 5], .8]));
  add(spark.x, spark.y, 1, true);
  return {points: P, edges: E, aspect: w / h, type: 'logo', label: ''};
}
