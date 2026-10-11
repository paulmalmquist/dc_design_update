// The sky: one persistent canvas behind the whole app. Background stars drift with scroll depth;
// a pool of "hero stars" morphs between formations — the logo, then each featured app's graph.
// Formations are positioned against live DOM elements, so they scroll with the page.
const TAU = Math.PI * 2;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

export class Sky {
  constructor(canvas, {reduced = false} = {}) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.reduced = reduced;
    this.pool = []; this.edges = []; this.oldEdges = []; this.target = null; this.layout = null;
    this.color = hex('#CE96FF'); this.fromColor = this.color; this.toColor = this.color;
    this.t0 = 0; this.dur = 0; this.edgeT0 = 0; this.edgeFade0 = 0; this.flare = 0; this.ptr = [0, 0]; this.sp = [0, 0];
    this.sprites = new Map(); this.running = false; this.dpr = 1; this.visible = true;
    addEventListener('resize', () => this.resize()); this.resize();
    addEventListener('pointermove', e => { this.ptr = [e.clientX / innerWidth - .5, e.clientY / innerHeight - .5]; }, {passive: true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.start(); });
  }
  setReduced(v) { this.reduced = v; }
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2); this.W = innerWidth; this.H = innerHeight;
    this.c.width = Math.round(this.W * this.dpr); this.c.height = Math.round(this.H * this.dpr);
    const count = Math.round(this.W * this.H / 2600), r = mulberry(7);
    this.bg = Array.from({length: count}, () => ({x: r() * this.W, y: r() * this.H * 1.6, z: .15 + r() * .85, ph: r() * TAU, sp: .4 + r() * 1.4, warm: r() < .08}));
  }
  sprite(rgb) {                                   // cached radial glow per colour
    const key = rgb.join(); if (this.sprites.has(key)) return this.sprites.get(key);
    const s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${key},.95)`); gr.addColorStop(.18, `rgba(${key},.5)`); gr.addColorStop(.5, `rgba(${key},.12)`); gr.addColorStop(1, `rgba(${key},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); this.sprites.set(key, s); return s;
  }
  // Fit a formation (1.6:1 or the logo's aspect) inside an element, in document coordinates.
  box() {
    if (!this.target) return null;
    const el = typeof this.target === 'function' ? this.target() : this.target; if (!el) return null;
    const r = el.getBoundingClientRect(), a = this.layout.aspect || 1.6, fw = Math.min(r.width, r.height * a), fh = fw / a;
    return {x: r.left + (r.width - fw) / 2, y: r.top + scrollY + (r.height - fh) / 2, w: fw, h: fh, onscreen: r.bottom > -40 && r.top < innerHeight + 40};
  }
  /** Morph the hero stars into a formation placed inside `target`.
   *  from: 'scatter' (fly in from the sky) | {rect, box:[x0,y0,x1,y1], formation} (start at a tile's stars) | undefined (current) */
  show(form, {target, color = '#CE96FF', from, duration = 1500} = {}) {
    const instant = this.reduced; this.layout = form; this.target = target;
    this.fromColor = this.currentColor(); this.toColor = hex(color);
    const now = performance.now(), b = this.box(), n = form.points.length;
    let starts = null;
    if (from && from.rect && from.formation) {              // stars start exactly where the tile drew them
      const r = from.rect, [x0, y0, x1, y1] = from.box, bw = (x1 - x0) * r.width, bh = (y1 - y0) * r.height, fw = Math.min(bw, bh * 1.6), fh = fw / 1.6;
      const ox = r.left + x0 * r.width + (bw - fw) / 2, oy = r.top + scrollY + y0 * r.height + (bh - fh) / 2;
      starts = from.formation.points.map(p => [ox + p.x * fw, oy + p.y * fh]);
    }
    while (this.pool.length < n) this.pool.push({x: Math.random() * this.W, y: scrollY + Math.random() * this.H, a: 0, m: .4, peak: false});
    const order = form.points.map((p, i) => i).sort((i, j) => form.points[i].x - form.points[j].x);
    // reuse the brightest (visible) stars first, then match them left-to-right so the morph reads as one motion
    const live = this.pool.map((s, i) => i).sort((i, j) => this.pool[j].a - this.pool[i].a).slice(0, n).sort((i, j) => this.pool[i].x - this.pool[j].x);
    this.map = new Array(n);
    order.forEach((pi, k) => { this.map[pi] = live[k]; });
    const used = new Set(this.map);
    this.pool.forEach((s, i) => {
      s.fx = s.x; s.fy = s.y; s.fa = s.a; s.fm = s.m;
      if (!used.has(i)) { s.target = null; s.ta = 0; return; }
    });
    form.points.forEach((p, pi) => {
      const s = this.pool[this.map[pi]];
      if (starts) { [s.fx, s.fy] = starts[pi] || [s.x, s.y]; s.fa = 1; }
      else if (from === 'scatter' || s.a < .05) { s.fx = Math.random() * this.W; s.fy = scrollY + Math.random() * this.H; s.fa = 0; }
      s.target = p; s.ta = 1; s.tm = p.m; s.peak = !!p.peak; s.delay = instant ? 0 : (pi / n) * 260 + Math.random() * 120;
    });
    this.oldEdges = this.edges; this.edges = form.edges.map(([a, c, w]) => [this.map[a], this.map[c], w]);
    this.t0 = now; this.dur = instant ? 0 : duration; this.edgeFade0 = now; this.edgeT0 = now + (instant ? 0 : duration * .7); this.flare = now + (instant ? 0 : duration * .95);
    if (!b) { /* target not in DOM yet; positions resolve on the next frame */ }
    this.start();
    return new Promise(res => setTimeout(res, instant ? 0 : duration + 500));
  }
  clear(duration = 600) { this.pool.forEach(s => { s.fx = s.x; s.fy = s.y; s.fa = s.a; s.target = null; s.ta = 0; }); this.oldEdges = this.edges; this.edges = []; this.edgeFade0 = this.t0 = performance.now(); this.dur = this.reduced ? 0 : duration; this.target = null; }
  currentColor() { const k = this.dur ? clamp((performance.now() - this.t0) / this.dur, 0, 1) : 1; return mix(this.fromColor, this.toColor, ease(k)); }
  start() { if (this.running) return; this.running = true; const loop = t => { if (document.hidden) { this.running = false; return; } this.frame(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  frame(now) {
    const g = this.g, d = this.dpr, W = this.W, H = this.H, sy = scrollY, rm = this.reduced;
    this.sp[0] += (this.ptr[0] - this.sp[0]) * .05; this.sp[1] += (this.ptr[1] - this.sp[1]) * .05;
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
    // background stars, parallax by depth (wraps vertically)
    for (const s of this.bg) {
      const y = ((s.y - sy * s.z * .35) % (H * 1.6) + H * 1.6) % (H * 1.6) - H * .3; if (y < -2 || y > H + 2) continue;
      const x = s.x + (rm ? 0 : this.sp[0] * 14 * s.z), tw = rm ? .8 : .62 + .38 * Math.sin(now * .001 * s.sp + s.ph);
      g.globalAlpha = (.18 + s.z * .55) * tw; g.fillStyle = s.warm ? '#FFD9B0' : '#E9E6FF';
      const r = .35 + s.z * .9; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // hero stars
    const b = this.box(), k = this.dur ? clamp((now - this.t0) / this.dur, 0, 1) : 1, col = mix(this.fromColor, this.toColor, ease(k)), spr = this.sprite(col);
    const px = rm ? 0 : this.sp[0] * 10, py = rm ? 0 : this.sp[1] * 8, scale = b ? clamp(b.w / 720, .55, 1.5) : 1;
    for (const s of this.pool) {
      const local = this.dur ? clamp((now - this.t0 - (s.delay || 0)) / (this.dur * .72), 0, 1) : 1, e = ease(local);
      let tx = s.fx, ty = s.fy;
      if (s.target && b) { tx = b.x + s.target.x * b.w; ty = b.y + s.target.y * b.h; }
      else if (!s.target) { tx = s.fx + (s.fx - W / 2) * .15; ty = s.fy - 30; }
      s.x = s.fx + (tx - s.fx) * e; s.y = s.fy + (ty - s.fy) * e; s.a = s.fa + ((s.ta ?? 0) - s.fa) * e; s.m = (s.fm ?? .4) + ((s.tm ?? .4) - (s.fm ?? .4)) * e;
    }
    const on = !b || b.onscreen;
    if (on && b && this.edges.length) {                 // soft key light behind the formation
      const cx = b.x + b.w / 2 + px, cy = b.y + b.h / 2 - sy + py, R = Math.max(b.w, b.h) * .62, lit = this.dur ? clamp((now - this.t0) / this.dur, 0, 1) : 1;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, `rgba(${col},${.13 * lit})`); gr.addColorStop(.55, `rgba(${col},${.05 * lit})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    if (on) {
      g.lineCap = 'round';
      const drawEdges = (list, alpha, prog) => list.forEach(([a, c, w], i) => {
        const A = this.pool[a], C = this.pool[c]; if (!A || !C) return;
        const p = prog === 1 ? 1 : clamp(prog * (list.length * .35 + 1) - i * .35, 0, 1); if (p <= 0) return;
        g.globalAlpha = alpha * (.22 + w * .55) * Math.min(A.a, C.a); g.strokeStyle = `rgb(${col})`; g.lineWidth = 1.25 * scale + .35;
        g.beginPath(); g.moveTo(A.x + px, A.y - sy + py); g.lineTo(A.x + (C.x - A.x) * p + px, A.y + (C.y - A.y) * p - sy + py); g.stroke();
      });
      const fade = this.dur ? 1 - clamp((now - this.edgeFade0) / 300, 0, 1) : 0; if (fade > 0) drawEdges(this.oldEdges, fade, 1);
      const prog = this.dur ? clamp((now - this.edgeT0) / 700, 0, 1) : 1; if (prog > 0) drawEdges(this.edges, 1, prog);
      for (const s of this.pool) {
        if (s.a < .01) continue;
        const x = s.x + px, y = s.y - sy + py; if (y < -60 || y > H + 60) continue;
        const tw = rm ? 1 : .86 + .14 * Math.sin(now * .002 + s.fx), core = (1.2 + s.m * 2.6) * scale, glow = core * (s.peak ? 9.5 : 6);
        g.globalAlpha = s.a * (.45 + s.m * .5) * tw; g.drawImage(spr, x - glow, y - glow, glow * 2, glow * 2);
        g.globalAlpha = s.a * (.7 + s.m * .3); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, core * .62, 0, TAU); g.fill();
        if (s.peak && s.target) {
          const f = rm ? 1 : clamp((now - this.flare) / 500, 0, 1), pulse = rm ? 1 : 1 + .12 * Math.sin(now * .0024), R = 13 * scale * (f < 1 ? .4 + f * .8 : pulse), q = 1.7 * scale;
          g.globalAlpha = s.a * Math.min(1, f * 1.4) * .95; g.beginPath();
          for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? q : R; i ? g.lineTo(x + rr * Math.cos(t), y + rr * Math.sin(t)) : g.moveTo(x + rr * Math.cos(t), y + rr * Math.sin(t)); }
          g.closePath(); g.fill();
        }
      }
    }
    g.globalAlpha = 1;
  }
}
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
