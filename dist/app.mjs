import {THEMES, DOMAINS} from './lib/themes.mjs';
import {esc, enrich} from './lib/catalog.mjs';
import {formation, artSvg, LAYOUT, validateKeyVisual, KEY_VISUAL_TYPES} from './lib/constellation.mjs';
import {plainChartSvg} from './lib/chart.mjs';
import {markSvg, logoFormation} from './lib/brand.mjs';
import {Sky} from './lib/sky.mjs';
import {connect} from './lib/api.mjs';
import {RAILS, STATUSES, ROLES} from './lib/db-core.mjs';

// ── basics ───────────────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)'), reduced = () => RM.matches;
const DAY = 864e5, DWELL = 8000, NEW_DAYS = 21;
const wait = ms => new Promise(r => setTimeout(r, ms));
let uid = 0; const mini = () => markSvg({id: `m${++uid}`, title: ''});
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  resume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>'
};
const chev = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d < 0 ? 'M15 5 8 12l7 7' : 'm9 5 7 7-7 7'}"/></svg>`;

const S = {api: null, me: null, apps: [], byId: new Map(), curation: null, list: new Set(), history: [], from: null, booted: false};
const sky = new Sky($('#sky'), {reduced: reduced()});
RM.addEventListener?.('change', () => sky.setReduced(reduced()));

// ── data ─────────────────────────────────────────────────────────────────────
const call = (m, p, b) => S.api.call(m, p, b);
function toApp(rec) {
  const a = enrich(rec);
  return {...a, origin: rec.origin || 'seed', status: rec.status || 'published', ownerId: rec.ownerId || '', ownerName: rec.ownerName || '', createdAt: rec.createdAt || '',
    updatedAt: (rec.updatedAt || '').slice(0, 10) || a.updatedAt, capture: rec.capture || null, screenshot: rec.screenshot || (a.screenshotSource === 'approved-screenshot' ? {path: a.screenshotPath} : null)};
}
async function refresh() {
  const [apps, cur, list, hist] = await Promise.all([call('GET', 'apps'), call('GET', 'curation'), call('GET', 'me/list'), call('GET', 'me/history')]);
  S.apps = apps.map(toApp).sort((a, b) => a.title.localeCompare(b.title)); S.byId = new Map(S.apps.map(a => [a.id, a]));
  S.curation = cur; S.list = new Set(list); S.history = hist; paintChrome();
}
const byId = id => S.byId.get(id);
const role = () => S.me?.role || 'viewer';
const isCreator = () => role() === 'creator' || role() === 'admin';
const isAdmin = () => role() === 'admin';
const canEdit = a => isAdmin() || (role() === 'creator' && a.ownerId === S.me?.id);
const daysAgo = d => d ? Math.floor((Date.now() - Date.parse(d)) / DAY) : Infinity;
const isNew = a => daysAgo(a.publishedAt) <= NEW_DAYS;
const isUpdated = a => !isNew(a) && daysAgo(a.updatedAt) <= 10;
const justAdded = a => a.origin === 'app' && a.ownerId === S.me?.id && daysAgo(a.createdAt) <= 2 && a.status === 'published';
const fmt = d => d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: daysAgo(d) > 300 ? 'numeric' : undefined}) : '';
const ago = iso => { const m = (Date.now() - Date.parse(iso)) / 6e4; return m < 2 ? 'just now' : m < 60 ? `${Math.round(m)} minutes ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
const artCache = new Map();
function art(app, shape = 'wide') {
  const k = `${app.id}|${shape}|${app.revision}`;
  if (!artCache.has(k)) artCache.set(k, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSvg(app, {shape})));
  return artCache.get(k);
}
const accent = a => (THEMES[a.domain] || THEMES.Platform).accent;
const recentApps = () => S.history.map(h => byId(h.id)).filter(Boolean);
const topApps = () => S.apps.filter(a => a.rank).sort((a, b) => a.rank - b.rank).slice(0, 10);
const newApps = () => [...S.apps].sort((a, b) => (Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))).slice(0, 12);
function similar(app) {
  const score = b => (b.domain === app.domain ? 2 : 0) + b.tags.filter(t => app.tags.includes(t)).length + (b.audience === app.audience ? 1 : 0);
  return S.apps.filter(b => b.id !== app.id).map(b => [score(b), b]).sort((x, y) => y[0] - x[0]).slice(0, 10).map(x => x[1]);
}

// ── shared markup ────────────────────────────────────────────────────────────
const titleArt = (a, tag = 'div', cls = '') => `<${tag} class="title-art title-art--${a.titleStyle} ${cls}">${esc(a.title)}</${tag}>`;
function kicker(a, mode = '') {
  if (mode === 'preview') return `<p class="kicker"><b>Preview</b> · ${esc(THEMES[a.domain].label)}</p>`;
  if (justAdded(a)) return `<p class="kicker"><b>Just added</b> · by you</p>`;
  if (a.original) return `<p class="kicker"><span class="brand-mark">${mini()}</span><b>Dreamcatcher</b>&nbsp;Original</p>`;
  if (isNew(a)) return `<p class="kicker"><b>New app</b> · ${esc(THEMES[a.domain].label)}</p>`;
  return `<p class="kicker">${esc(THEMES[a.domain].label)}</p>`;
}
function meta(a) {
  const bits = [`<span class="pill">${esc(a.domain)}</span>`, `<span>${esc(a.owner || a.ownerName)}</span>`];
  const when = a.updatedAt && a.updatedAt !== a.publishedAt ? `Updated ${fmt(a.updatedAt)}` : a.publishedAt ? `Published ${fmt(a.publishedAt)}` : '';
  if (when) bits.push('<span class="sep"></span>', `<span>${when}</span>`);
  if (a.rank) bits.push('<span class="sep"></span>', `<span>#${a.rank} this week</span>`);
  return `<div class="meta">${bits.join('')}</div>`;
}
const saved = id => S.list.has(id);
const saveBtn = (a, cls = 'btn-round') => `<button class="${cls}" type="button" data-save="${a.id}" aria-pressed="${saved(a.id)}" aria-label="${saved(a.id) ? 'Remove from' : 'Add to'} My List: ${esc(a.title)}">${saved(a.id) ? '✓' : '+'}</button>`;
function graphNote(a) {
  const f = formation(a);
  return `<p class="graph-note">${f.source === 'generated' ? 'Constellation: <b>placeholder pattern</b>, until the app publishes its key graph' : `Constellation drawn from ${f.source === 'app' ? 'the app’s own ' : ''}<b>${esc(f.label || `${f.type} chart`)}</b>`}</p>`;
}
function tile(a, {shape = 'wide', rank = 0, foot = ''} = {}) {
  const tall = shape !== 'wide', badge = justAdded(a) ? '<span class="badge">Just added</span>' : isNew(a) ? '<span class="badge">New</span>' : isUpdated(a) ? '<span class="badge badge--updated">Updated</span>' : '';
  const link = `<a class="tile-link" href="#app/${a.id}" data-tile="${a.id}" aria-label="${esc(`${a.title}. ${a.domain}. ${a.logline}`)}"><div class="tile-art"><img src="${art(a, tall ? 'tall' : 'wide')}" alt="" decoding="async">${badge}${a.original ? `<span class="corner-mark" aria-hidden="true">${mini()}</span>` : ''}<div class="tile-info">${titleArt(a, 'div', 'tile-title')}<div class="tile-hover"><div><p class="meta-line">${esc(a.domain)}</p><p>${esc(a.logline)}</p></div></div></div></div></a>${saveBtn(a, 'tile-save')}${foot ? `<p class="tile-foot">${esc(foot)}</p>` : ''}`;
  return rank ? `<li class="tile tile--top" data-id="${a.id}"><span class="rank" aria-hidden="true">${rank}</span>${link}</li>` : `<li class="tile tile--${tall ? 'tall' : 'wide'}" data-id="${a.id}">${link}</li>`;
}
function rail({id, title, sub = '', items, shape = 'wide', top = false, href = '', foot = null}) {
  if (!items.length) return '';
  const lis = items.map((a, i) => tile(a, {shape: top ? 'tall' : shape, rank: top ? i + 1 : 0, foot: foot ? foot(a) : ''})).join('');
  const head = href ? `<a href="${href}">${esc(title)}<span class="more">See all ›</span></a>` : esc(title);
  return `<section class="rail" id="${id}" aria-labelledby="${id}-h"><div class="rail-head"><h2 id="${id}-h">${head}${sub ? `<span class="rail-sub">${esc(sub)}</span>` : ''}</h2><div class="pager" aria-hidden="true"></div></div>` +
    `<div class="rail-view"><button class="arrow prev" type="button" data-dir="-1" aria-label="Scroll ${esc(title)} back">${chev(-1)}</button><ol class="track">${lis}</ol><button class="arrow next" type="button" data-dir="1" aria-label="Scroll ${esc(title)} forward">${chev(1)}</button></div></section>`;
}
function hubRail(title) {
  const items = DOMAINS.map(d => { const t = THEMES[d], n = S.apps.filter(a => a.domain === d).length; return `<li><a class="hub" href="#hub/${d}"><img src="${art({id: `hub-${d}`, domain: d, title: d, revision: 'hub'}, 'hub')}" alt=""><span class="hub-name title-art title-art--${t.title}">${d}</span><span class="hub-label">${esc(t.label)} · ${n} apps</span></a></li>`; }).join('');
  return `<section class="rail" id="rail-hubs" aria-labelledby="rail-hubs-h"><div class="rail-head"><h2 id="rail-hubs-h">${esc(title)}</h2><div class="pager" aria-hidden="true"></div></div><div class="rail-view"><button class="arrow prev" type="button" data-dir="-1" aria-label="Scroll domains back">${chev(-1)}</button><ol class="track">${items}</ol><button class="arrow next" type="button" data-dir="1" aria-label="Scroll domains forward">${chev(1)}</button></div></section>`;
}
const status = s => `<span class="status status--${s}">${s[0].toUpperCase() + s.slice(1)}</span>`;

// ── hero carousel ────────────────────────────────────────────────────────────
const H = {
  list: [], i: 0, timer: 0, paused: false, focused: false, preview: null, visible: true, io: null, el: null,
  mount(list, opening) {
    this.list = list; this.i = 0; this.preview = null; this.el = $('#hero'); clearTimeout(this.timer);
    this.io?.disconnect(); this.io = new IntersectionObserver(([e]) => { this.visible = e.intersectionRatio > .3; this.schedule(); }, {threshold: [0, .3, .6]}); this.io.observe(this.el);
    this.focused = false;                                     // keyboard focus inside the hero holds the rotation
    this.el.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) { this.focused = true; this.schedule(); } });
    this.el.addEventListener('focusout', e => { if (!this.el.contains(e.relatedTarget)) { this.focused = false; this.schedule(); } });
    this.el.querySelector('.pips').innerHTML = list.map((a, k) => `<button class="pip" type="button" data-pip="${k}" aria-label="Show ${esc(a.title)}"><i></i></button>`).join('');
    this.paint(true, opening);
  },
  app() { return this.preview || this.list[this.i]; },
  async paint(first = false, opening) {
    const a = this.app(), copy = $('#hero-copy'); if (!a || !copy) return;
    const html = `${kicker(a, this.preview ? 'preview' : '')}${titleArt(a, 'h2')}${meta(a)}<p class="logline">${esc(a.logline)}</p><div class="actions"><button class="btn btn-play" type="button" data-open="${a.id}">${ICON.play}Open app</button><a class="btn btn-ghost" href="#app/${a.id}" data-hero-info="${a.id}">${ICON.info}More info</a>${saveBtn(a)}</div>${graphNote(a)}`;
    if (first || reduced()) copy.innerHTML = html;
    else { copy.classList.add('is-leaving'); await wait(260); if (!copy.isConnected) return; copy.innerHTML = html; copy.classList.remove('is-leaving'); copy.classList.add('is-entering'); setTimeout(() => copy.classList.remove('is-entering'), 720); }
    this.el.classList.toggle('is-previewing', !!this.preview);
    $$('.pip', this.el).forEach((p, k) => { p.classList.toggle('is-done', k < this.i); p.classList.remove('is-active'); p.setAttribute('aria-current', k === this.i ? 'true' : 'false'); });
    const pip = $$('.pip', this.el)[this.i]; if (pip) { void pip.offsetWidth; pip.classList.add('is-active'); }
    if (first && S.intro) { await S.intro; if (!this.el?.isConnected) return; }
    sky.show(formation(a), {target: () => $('#hero-art'), color: accent(a), duration: first && opening ? 1700 : 1500});
    this.schedule();
  },
  go(i) { this.preview = null; this.i = (i + this.list.length) % this.list.length; this.paint(); },
  schedule() {
    clearTimeout(this.timer); if (!this.el?.isConnected) return;
    this.el.classList.toggle('is-paused', this.paused || this.focused);
    if (this.paused || this.focused || this.preview || !this.visible || reduced() || document.hidden || this.list.length < 2) return;
    this.timer = setTimeout(() => this.go(this.i + 1), DWELL);
  },
  startPreview(a) { if (!this.el?.isConnected || a === this.app()) return; this.preview = a; this.paint(); },
  endPreview() { if (!this.preview) return; this.preview = null; this.paint(); },
  togglePause() { this.paused = !this.paused; const b = $('[data-hero=pause]'); if (b) { b.innerHTML = this.paused ? ICON.resume : ICON.pause; b.setAttribute('aria-label', this.paused ? 'Resume rotation' : 'Pause rotation'); b.setAttribute('aria-pressed', String(this.paused)); } if (!this.paused) { const p = $$('.pip', this.el)[this.i]; if (p) { p.classList.remove('is-active'); void p.offsetWidth; p.classList.add('is-active'); } } this.schedule(); }
};
document.addEventListener('visibilitychange', () => H.schedule());

// ── pages ────────────────────────────────────────────────────────────────────
function pageHome() {
  const cur = S.curation?.rails || RAILS.map(r => ({...r, enabled: true}));
  const mine = S.apps.filter(justAdded).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 1);
  const heroList = [...mine, ...(S.curation?.hero || []).map(byId).filter(Boolean).filter(a => !mine.includes(a))].slice(0, 7);
  if (!heroList.length) heroList.push(...S.apps.slice(0, 5));
  const rails = [];
  for (const r of cur) {
    if (!r.enabled) continue;
    if (r.key === 'continue') rails.push(rail({id: 'rail-continue', title: r.title, items: recentApps(), foot: a => `Opened ${ago(S.history.find(h => h.id === a.id).at)}`}));
    if (r.key === 'top') rails.push(rail({id: 'rail-top', title: r.title, items: topApps(), top: true}));
    if (r.key === 'new') rails.push(rail({id: 'rail-new', title: r.title, items: newApps()}));
    if (r.key === 'originals') rails.push(rail({id: 'rail-originals', title: r.title, items: S.apps.filter(a => a.original), shape: 'tall'}));
    if (r.key === 'hubs') rails.push(hubRail(r.title));
    if (r.key === 'because') { const seed = recentApps()[0]; if (seed) rails.push(rail({id: 'rail-because', title: `${r.title} ${seed.title}`, items: similar(seed)})); }
    if (r.key === 'mylist') rails.push(rail({id: 'rail-mylist', title: r.title, items: S.apps.filter(a => saved(a.id)), href: '#my-stuff'}));
    if (r.key === 'domains') for (const d of DOMAINS) { const items = S.apps.filter(a => a.domain === d); if (items.length >= 2) rails.push(rail({id: `rail-d-${d.toLowerCase()}`, title: THEMES[d].label, sub: d, items, href: `#hub/${d}`})); }
  }
  return {
    title: 'Dreamcatcher', hero: true,
    html: `<h1 class="sr">Dreamcatcher home</h1><section class="hero" id="hero" aria-roledescription="carousel" aria-label="Featured apps"><div class="hero-art" id="hero-art"></div><div class="hero-shade"></div><div class="hero-copy" id="hero-copy" aria-live="polite"></div>` +
      `<div class="hero-controls"><button class="hero-btn" type="button" data-hero="prev" aria-label="Previous featured app">${ICON.prev}</button><div class="pips" role="group" aria-label="Featured apps"></div><button class="hero-btn" type="button" data-hero="next" aria-label="Next featured app">${ICON.next}</button><button class="hero-btn" type="button" data-hero="pause" aria-label="Pause rotation" aria-pressed="false">${ICON.pause}</button></div></section>` +
      `<div class="rails" id="home-rails">${rails.join('')}</div>`,
    after: opening => { H.mount(heroList, opening); wireHoverPreview(); }
  };
}

function pageTitle(id) {
  const a = byId(id);
  if (!a) return pageMissing('That app is not in the catalog.', 'It may be a draft, archived, or removed.');
  if (a.status === 'published') call('POST', 'me/history', {id: a.id}).then(h => { S.history = h; }).catch(() => {});
  const f = formation(a), sourceText = {app: 'Key graph published by the app itself at its last capture', metadata: 'Key graph from the app’s catalog entry', generated: 'Placeholder pattern: this app has not published a key graph yet'}[f.source];
  const shot = a.screenshot?.path ? `<figure class="shot"><img src="${esc(a.screenshot.path)}" alt="${esc(a.title)} screenshot"></figure>` : `<div class="empty-shot">No screenshot yet. The capture worker adds one after the app’s next deploy${a.capture ? ` (requested ${ago(a.capture.requestedAt)})` : ''}.</div>`;
  const facts = [['What it does', a.summary], ['Built for', a.audience || 'Not specified'], ['Owner', `${a.owner || '—'}${a.ownerName ? ` · ${a.ownerName}` : ''}`], ['Domain', a.domain], ['Published', fmt(a.publishedAt) || '—'], ['Updated', fmt(a.updatedAt) || '—']];
  return {
    title: `${a.title} · Dreamcatcher`, hero: true,
    html: `<article><section class="title-hero"><div class="hero-art" id="title-art"></div><div class="hero-shade"></div><div class="hero-copy">${kicker(a)}${titleArt(a, 'h1')}${meta(a)}<p class="logline">${esc(a.logline)}</p>` +
      `<div class="actions"><button class="btn btn-play" type="button" data-open="${a.id}">${ICON.play}Open app</button>${saveBtn(a)}<button class="btn btn-ghost" type="button" data-share="${a.id}">Copy link</button>${canEdit(a) ? `<a class="btn btn-ghost" href="#studio/edit/${a.id}">Edit</a>` : ''}</div>${a.status !== 'published' ? `<p>${status(a.status)} Only you and site admins can see this.</p>` : ''}</div></section>` +
      `<nav class="tabs" aria-label="Sections"><button type="button" data-section="s-overview" class="on">Overview</button><button type="button" data-section="s-graph">The graph</button><button type="button" data-section="s-screens">Screens</button><button type="button" data-section="s-more">More like this</button></nav>` +
      `<section class="page-section" id="s-overview"><h2>Overview</h2><p class="summary">${esc(a.description && a.descriptionApproved ? a.description : a.summary)}</p><dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${a.tags.length ? `<div class="tags">${a.tags.map(t => `<a href="#search/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}</section>` +
      `<section class="page-section" id="s-graph"><h2>The graph behind the art</h2><div class="graph-pair"><figure><div class="frame">${plainChartSvg(a)}</div><figcaption><b>${esc(f.label || `${f.type} chart`)}</b>, drawn plainly</figcaption></figure><figure><div class="frame"><img src="${art(a, 'wide')}" alt=""></div><figcaption><b>The same graph as a constellation</b>, used for this app’s tiles and hero</figcaption></figure></div><span class="source-chip">${esc(sourceText)}</span></section>` +
      `<section class="page-section" id="s-screens"><h2>Screens</h2>${shot}</section>` +
      `<section class="page-section page-section--rail" id="s-more">${rail({id: 'rail-more', title: 'More like this', items: similar(a)})}</section></article>`,
    after: () => {
      const from = S.from?.id === a.id ? S.from : null; S.from = null;
      sky.show(f, {target: () => $('#title-art'), color: accent(a), from: from || undefined, duration: from ? 1300 : 1500});
      const tabs = $$('.tabs button'), spy = new IntersectionObserver(es => {   // keep the tab underline on the section in view
        for (const e of es) if (e.isIntersecting) tabs.forEach(t => t.classList.toggle('on', t.dataset.section === e.target.id));
      }, {rootMargin: '-140px 0px -55% 0px'});
      tabs.forEach(t => { const el = $(`#${t.dataset.section}`); if (el) spy.observe(el); });
    }
  };
}

function pageHub(name) {
  const d = DOMAINS.find(x => x.toLowerCase() === String(name).toLowerCase()); if (!d) return pageMissing('No such domain.', '');
  const t = THEMES[d], items = S.apps.filter(a => a.domain === d), hubApp = {id: `hub-${d}`, domain: d, title: d};
  return {
    title: `${d} · Dreamcatcher`, hero: true,
    html: `<section class="hub-hero title-hero"><div class="hero-art" id="title-art"></div><div class="hero-shade"></div><div class="hero-copy"><p class="kicker">${esc(t.label)}</p><h1 class="title-art title-art--${t.title}">${d}</h1><p class="logline">${items.length} ${items.length === 1 ? 'app' : 'apps'} for ${d.toLowerCase()} work.</p></div></section>` +
      `<div class="rails page-rails">${rail({id: 'rail-hub-top', title: `Top in ${d}`, items: items.filter(a => a.rank).sort((x, y) => x.rank - y.rank), top: true})}${rail({id: 'rail-hub-new', title: `New in ${d}`, items: [...items].sort((x, y) => Date.parse(y.publishedAt || 0) - Date.parse(x.publishedAt || 0))})}</div>` +
      `<section class="page-section"><h2>All ${d} apps</h2></section><ol class="grid">${items.map(a => tile(a)).join('')}</ol>`,
    after: () => sky.show(formation(hubApp), {target: () => $('#title-art'), color: t.accent})
  };
}

function pageSearch(q = '') {
  return {
    title: 'Search · Dreamcatcher',
    html: `<div class="page"><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><span class="sr">Search apps</span><input id="q" type="search" autocomplete="off" placeholder="Search apps, teams, purposes" value="${esc(q)}"></label><div id="results"></div></div>`,
    after: () => { const input = $('#q'); input.focus(); const run = () => { renderResults(input.value); history.replaceState(null, '', `#search/${encodeURIComponent(input.value)}`); }; input.addEventListener('input', run); renderResults(q); sky.clear(); }
  };
}
function renderResults(q) {
  const box = $('#results'); if (!box) return; const s = q.trim().toLowerCase();
  if (!s) { box.innerHTML = `<p class="search-meta">Browse by domain, or start typing.</p>${hubRail('Browse by domain')}${rail({id: 'rail-s-top', title: 'Top 10 apps this week', items: topApps(), top: true})}`; wireRails(box); return; }
  const hits = S.apps.filter(a => [a.title, a.logline, a.summary, a.owner, a.ownerName, a.domain, a.audience, ...a.tags].join(' ').toLowerCase().includes(s));
  box.innerHTML = hits.length ? `<p class="search-meta">${hits.length} ${hits.length === 1 ? 'app' : 'apps'} for “${esc(q)}”</p><ol class="grid">${hits.map(a => tile(a)).join('')}</ol>` : `<div class="empty"><h2>Nothing matches “${esc(q)}”.</h2><p>Try an app name, a team, or what you’re trying to do.</p></div>`;
}

function pageMyStuff(tab = 'list') {
  const list = S.apps.filter(a => saved(a.id)), recent = recentApps();
  const body = tab === 'recent'
    ? (recent.length ? `<ol class="grid">${recent.map(a => tile(a, {foot: `Opened ${ago(S.history.find(h => h.id === a.id).at)}`})).join('')}</ol><p class="search-meta"><button class="link-button" type="button" data-act="clear-history">Clear history</button></p>` : `<div class="empty"><h2>Nothing opened yet.</h2><p>Apps you open show up here.</p></div>`)
    : (list.length ? `<ol class="grid">${list.map(a => tile(a)).join('')}</ol>` : `<div class="empty"><h2>Your list is empty.</h2><p>Use + on any app to keep it here.</p><a class="btn btn-play" href="#home">Browse apps</a></div>`);
  return {title: 'My Stuff · Dreamcatcher', html: `<div class="page"><header class="page-head"><h1 class="title-art title-art--condensed">My Stuff</h1></header><nav class="segmented" aria-label="My Stuff"><a href="#my-stuff/list" class="${tab !== 'recent' ? 'on' : ''}">My List · ${list.length}</a><a href="#my-stuff/recent" class="${tab === 'recent' ? 'on' : ''}">Continue exploring · ${recent.length}</a></nav>${body}</div>`, after: () => sky.clear()};
}

function pageMissing(h, p) { return {title: 'Not found · Dreamcatcher', html: `<div class="page"><div class="empty"><h2>${esc(h)}</h2><p>${esc(p)}</p><a class="btn btn-play" href="#home">Back to home</a></div></div>`, after: () => sky.clear()}; }
function pageDenied(need) { return pageMissing(`This area needs ${need} access.`, isCreator() ? 'Ask a site admin to change your role.' : 'Ask a site admin to make you a creator.'); }

// ── personal admin: Your apps ────────────────────────────────────────────────
async function pageStudio(sub, id) {
  if (!isCreator()) return pageDenied('creator');
  if (sub === 'new' || sub === 'edit') return pageEditor(sub === 'edit' ? id : null);
  const mine = (await call('GET', 'apps?scope=mine')).map(toApp).sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
  const count = s => mine.filter(a => a.status === s).length;
  const rows = mine.map(a => adminRow(a)).join('');
  return {
    title: 'Your apps · Dreamcatcher',
    html: `<div class="page admin"><header class="page-head"><p class="kicker">Personal admin</p><h1 class="title-art title-art--condensed">Your apps</h1><p>Create, edit and publish the apps you own. Tiles and hero art are drawn from each app’s key graph, so they update when the graph does.</p></header>` +
      `<div class="admin-bar"><div class="chips">${STATUSES.map(s => `<span>${status(s)} ${count(s)}</span>`).join('')}</div><a class="btn btn-play" href="#studio/new">+ New app</a></div>` +
      (mine.length ? `<ul class="rows">${rows}</ul>` : `<div class="empty"><h2>You don’t own any apps yet.</h2><p>Create one and it gets a constellation tile and hero automatically.</p><a class="btn btn-play" href="#studio/new">Create your first app</a></div>`) +
      `<section class="page-section"><h2>Your settings</h2><div class="settings"><label class="field">Display name<input id="pref-name" value="${esc(S.me.name)}" maxlength="60"></label><label class="check"><input type="checkbox" id="pref-intro" ${S.me.prefs?.intro !== false ? 'checked' : ''}> Play the opening animation</label><div class="settings-actions"><button class="btn btn-ghost" type="button" data-act="save-prefs">Save settings</button><button class="btn btn-ghost" type="button" data-act="clear-history">Clear my history</button></div></div></section></div>`,
    after: () => sky.clear()
  };
}
function adminRow(a, {admin = false} = {}) {
  const cap = a.capture ? `Screenshot ${a.capture.status}` : a.screenshot ? 'Screenshot ready' : 'No screenshot';
  const pub = a.status === 'published' ? `<button class="btn-sm" type="button" data-act="status" data-id="${a.id}" data-to="draft">Unpublish</button>` : `<button class="btn-sm" type="button" data-act="status" data-id="${a.id}" data-to="published">Publish</button>`;
  return `<li class="row" data-row="${a.id}"><img class="row-art" src="${art(a)}" alt=""><div class="row-main"><a class="row-title" href="#app/${a.id}">${esc(a.title)}</a><p class="row-meta">${status(a.status)} ${esc(a.domain)} · updated ${fmt(a.updatedAt) || '—'} · ${cap}${admin ? ` · ${esc(a.ownerName)}` : ''}</p></div>` +
    `<div class="row-actions"><a class="btn-sm" href="#studio/edit/${a.id}">Edit</a>${pub}${a.status !== 'archived' ? `<button class="btn-sm" type="button" data-act="status" data-id="${a.id}" data-to="archived">Archive</button>` : ''}<button class="btn-sm" type="button" data-act="capture" data-id="${a.id}">Request screenshot</button><button class="btn-sm btn-danger" type="button" data-act="delete" data-id="${a.id}">Delete</button></div></li>`;
}

const KV_HELP = {line: 'Numbers in order, e.g. 12, 14, 13, 17, 19', area: 'Numbers in order, e.g. 46, 44, 41, 37, 33', bar: 'One number per bar, e.g. 42, 38, 51, 47', funnel: 'One number per step, largest first, e.g. 120, 84, 61, 40',
  wave: 'One line of numbers per series (up to 3 lines)', scatter: 'One point per line: x y, or x y size', network: 'Number of nodes, then optional links, e.g. 9 then 0-1 1-2 2-5', flow: 'Nodes per stage, e.g. 2, 3, 3, 1', radial: 'Stars per ring, e.g. 6, 11', matrix: 'One row of numbers per line, all the same length'};
function kvToText(kv) {
  if (!kv) return '';
  if (kv.series) return kv.series.join(', ');
  if (kv.lines) return kv.lines.map(l => l.join(', ')).join('\n');
  if (kv.points) return kv.points.map(p => p.join(' ')).join('\n');
  if (kv.type === 'network') return `${kv.nodes}${kv.edges ? '\n' + kv.edges.map(e => e.join('-')).join(' ') : ''}`;
  if (kv.stages) return kv.stages.join(', ');
  if (kv.rings) return kv.rings.join(', ');
  if (kv.rows) return kv.rows.map(r => r.join(', ')).join('\n');
  return '';
}
function textToKv(type, text, label) {
  if (!type) return null;
  const nums = s => s.split(/[\s,]+/).filter(Boolean).map(Number), lines = text.split(/\n|;/).map(s => s.trim()).filter(Boolean);
  const kv = {type, label};
  if (['line', 'area', 'bar', 'funnel'].includes(type)) kv.series = nums(text);
  if (type === 'wave') kv.lines = lines.map(nums);
  if (type === 'scatter') kv.points = lines.map(nums);
  if (type === 'matrix') kv.rows = lines.map(nums);
  if (type === 'flow') kv.stages = nums(text).map(Math.round);
  if (type === 'radial') kv.rings = nums(text).map(Math.round);
  if (type === 'network') { const [first, ...rest] = text.trim().split(/\s+/); kv.nodes = Math.round(Number(first)); const pairs = rest.filter(p => /^\d+-\d+$/.test(p)).map(p => p.split('-').map(Number)); if (pairs.length) kv.edges = pairs; }
  return validateKeyVisual(kv);
}
const slug = t => (t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '') || 'app').slice(0, 56);

async function pageEditor(id) {
  let a = null;
  if (id) { try { a = toApp(await call('GET', `apps/${encodeURIComponent(id)}`)); } catch { return pageMissing('That app could not be found.', ''); } if (!canEdit(a)) return pageDenied('owner or site admin'); }
  const kv = a?.keyVisual, v = (k, d = '') => esc(a ? (a[k] ?? d) : d);
  const domainOpts = DOMAINS.map(d => `<option ${(a?.domain || 'Engineering') === d ? 'selected' : ''}>${d}</option>`).join('');
  const isNewApp = !a;
  const typeOpts = `<option value="">Let Dreamcatcher pick a pattern</option>` + KEY_VISUAL_TYPES.map(t => `<option value="${t}" ${(kv ? kv.type === t : isNewApp && t === 'area') ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('');
  return {
    title: `${a ? `Edit ${a.title}` : 'New app'} · Dreamcatcher`,
    html: `<div class="page admin"><header class="page-head"><p class="kicker"><a href="#studio">Your apps</a> ›</p><h1 class="title-art title-art--condensed">${a ? esc(a.title) : 'New app'}</h1></header>` +
      `<div class="create"><form id="app-form" novalidate>` +
      `<label class="field">App name<input name="title" required maxlength="60" value="${v('title', 'Launch weather')}"></label>` +
      `<div class="row-2"><label class="field">Domain<select name="domain">${domainOpts}</select></label><label class="field">Owning team<input name="owner" maxlength="100" value="${v('owner', S.me.team || '')}"></label></div>` +
      `<div class="row-2"><label class="field">What does it do?<input name="task" maxlength="120" value="${v('task', 'Check')}" placeholder="Track, Compare, Trace…"></label><label class="field">About what?<input name="subject" maxlength="180" value="${v('subject', 'wind, lightning and range weather before a launch window')}"></label></div>` +
      `<label class="field">Who is it for?<input name="audience" maxlength="100" value="${v('audience', 'launch teams')}"></label>` +
      `<label class="field">Logline <small>One line, shown on tiles and in the hero</small><input name="logline" maxlength="120" value="${v('logline', 'Know before you go.')}"></label>` +
      `<label class="field">Description <small>Optional. Otherwise generated from the fields above</small><textarea name="description" maxlength="360">${v('description')}</textarea></label>` +
      `<label class="check"><input type="checkbox" name="descriptionApproved" ${a?.descriptionApproved ? 'checked' : ''}> I approve this description as the app owner</label>` +
      `<label class="field">Tags <small>Comma separated</small><input name="tags" maxlength="200" value="${esc((a?.tags || ['Launch', 'Weather']).join(', '))}"></label>` +
      `<fieldset class="graph-fields"><legend>Key graph <small>The app’s main chart. Its tile and hero constellation are drawn from it.</small></legend>` +
      `<div class="row-2"><label class="field">Chart type<select name="kvType">${typeOpts}</select></label><label class="field">Chart title<input name="kvLabel" maxlength="80" value="${esc(kv?.label || (isNewApp ? 'Wind speed by hour' : ''))}"></label></div>` +
      `<label class="field">Values <small id="kv-help"></small><textarea name="kvText">${esc(kv ? kvToText(kv) : isNewApp ? '8, 9, 12, 15, 14, 18, 21, 19, 16, 12' : '')}</textarea></label></fieldset>` +
      `${isAdmin() ? `<div class="row-2"><label class="check"><input type="checkbox" name="featured" ${a?.featured ? 'checked' : ''}> Feature in the home hero</label><label class="check"><input type="checkbox" name="original" ${a?.original ? 'checked' : ''}> Dreamcatcher Original</label></div>` : ''}` +
      `<p class="error" id="form-error" role="alert"></p>` +
      `<div class="actions"><button class="btn btn-play" type="submit" data-status="published">${a?.status === 'published' ? 'Save and keep published' : 'Publish'}</button><button class="btn btn-ghost" type="submit" data-status="draft">${a?.status === 'published' ? 'Save as draft' : 'Save draft'}</button>${a ? `<button class="btn-sm btn-danger" type="button" data-act="delete" data-id="${a.id}" data-back="1">Delete app</button>` : ''}</div>` +
      `<p class="graph-note">${a ? `App ID: ${esc(a.id)} · ${status(a.status)}` : 'App ID is created from the name.'}</p></form>` +
      `<div class="preview-stage" aria-label="Live preview"><p class="label">Live preview: hero</p><div class="preview-hero"><div class="hero-art" id="pv-art"></div><div class="hero-shade"></div><div class="pv-copy" id="pv-copy"></div></div><p class="label">Tiles</p><div class="preview-tiles" id="pv-tiles"></div></div></div></div>`,
    after: () => {
      const form = $('#app-form'); let t = 0;
      const read = () => {
        const fd = new FormData(form), title = String(fd.get('title') || '').trim();
        const out = {id: a?.id || slug(title), title, domain: fd.get('domain'), owner: fd.get('owner'), task: fd.get('task'), subject: fd.get('subject'), audience: fd.get('audience'), logline: fd.get('logline'),
          description: fd.get('description'), descriptionApproved: fd.get('descriptionApproved') === 'on', tags: String(fd.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean),
          keyVisual: textToKv(fd.get('kvType'), String(fd.get('kvText') || ''), String(fd.get('kvLabel') || '').trim()), publishedAt: a?.publishedAt || '', original: isAdmin() ? fd.get('original') === 'on' : a?.original};
        if (isAdmin()) out.featured = fd.get('featured') === 'on';
        return out;
      };
      const paint = () => {
        if (!form.isConnected) return;                             // a debounced paint can land after navigating away
        $('#kv-help').textContent = KV_HELP[form.kvType.value] || 'Pick a chart type to use your app’s own graph.';
        try {
          const app = toApp({...read(), publishedAt: a?.publishedAt || new Date().toISOString().slice(0, 10), ownerId: S.me.id, status: 'published', createdAt: new Date().toISOString()});
          $('#form-error').textContent = '';
          $('#pv-copy').innerHTML = `${kicker(app)}${titleArt(app)}<p>${esc(app.logline)}</p>`;
          $('#pv-tiles').innerHTML = `<ol class="track track--static">${tile(app)}${tile(app, {shape: 'tall'})}</ol>`;
          sky.show(formation(app), {target: () => $('#pv-art'), color: accent(app), duration: 900});
        } catch (e) { $('#form-error').textContent = e.message; }
      };
      form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(paint, 180); });
      form.addEventListener('submit', async e => {
        e.preventDefault(); const btn = e.submitter, want = btn?.dataset.status || 'draft';
        try {
          const body = {...read(), status: want}; if (!body.title) throw new Error('Give the app a name.');
          btn.disabled = true;
          let rec;
          if (a) rec = await call('PATCH', `apps/${a.id}`, body);
          else for (let n = 1; !rec; n++) {                       // IDs come from the name; on a clash, try name-2, name-3…
            try { rec = await call('POST', 'apps', {...body, id: n === 1 ? body.id : `${body.id}-${n}`}); }
            catch (err) { if (err.status !== 409 || n >= 20) throw err; }
          }
          await refresh(); toast(want === 'published' ? `${rec.title} is live. It’s on the home page now.` : `${rec.title} saved as a draft.`);
          location.hash = want === 'published' ? '#home' : '#studio';
        } catch (err) { $('#form-error').textContent = err.message; btn && (btn.disabled = false); }
      });
      paint();
    }
  };
}

// ── site admin ───────────────────────────────────────────────────────────────
async function pageAdmin(tab = 'apps') {
  if (!isAdmin()) return pageDenied('site admin');
  const tabs = [['apps', 'Apps'], ['curation', 'Home curation'], ['users', 'Users and roles'], ['activity', 'Activity']];
  const nav = `<nav class="segmented" aria-label="Site admin">${tabs.map(([k, l]) => `<a href="#admin/${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  const head = `<header class="page-head"><p class="kicker">Site admin · data: ${S.api.mode === 'server' ? 'Dreamcatcher API' : 'this browser'}</p><h1 class="title-art title-art--condensed">Site admin</h1></header>`;
  let body = '', after = null;
  if (tab === 'apps') {
    const all = (await call('GET', 'apps?scope=all')).map(toApp).sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    body = `<div class="admin-bar"><label class="field field--inline"><span class="sr">Filter apps</span><input id="admin-q" type="search" placeholder="Filter by name, owner or domain"></label><div class="chips">${['all', ...STATUSES].map(s => `<button type="button" class="chip ${s === 'all' ? 'on' : ''}" data-filter="${s}">${s === 'all' ? `All · ${all.length}` : `${s[0].toUpperCase() + s.slice(1)} · ${all.filter(a => a.status === s).length}`}</button>`).join('')}</div></div>` +
      `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">App</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Hero</th><th scope="col">Original</th><th scope="col">Top 10</th><th scope="col">Screenshot</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>` +
      all.map(a => `<tr data-row="${a.id}" data-status="${a.status}" data-text="${esc(`${a.title} ${a.ownerName} ${a.owner} ${a.domain}`.toLowerCase())}"><td><div class="cell-app"><img src="${art(a)}" alt=""><div><a href="#app/${a.id}">${esc(a.title)}</a><small>${esc(a.domain)} · updated ${fmt(a.updatedAt) || '—'}</small></div></div></td><td>${esc(a.ownerName)}<small>${esc(a.owner)}</small></td>` +
        `<td><select data-act="set-status" data-id="${a.id}" aria-label="Status of ${esc(a.title)}">${STATUSES.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>` +
        `<td><input type="checkbox" data-act="set-flag" data-flag="featured" data-id="${a.id}" ${a.featured ? 'checked' : ''} ${a.status !== 'published' ? 'disabled' : ''} aria-label="Feature ${esc(a.title)} in the hero"></td><td><input type="checkbox" data-act="set-flag" data-flag="original" data-id="${a.id}" ${a.original ? 'checked' : ''} aria-label="Mark ${esc(a.title)} as an Original"></td>` +
        `<td>${a.rank ? `#${a.rank}` : '—'}</td><td>${a.capture ? esc(a.capture.status) : a.screenshot ? 'Ready' : 'None'} <button class="btn-sm" type="button" data-act="capture" data-id="${a.id}">Request</button></td>` +
        `<td class="nowrap"><a class="btn-sm" href="#studio/edit/${a.id}">Edit</a><button class="btn-sm btn-danger" type="button" data-act="delete" data-id="${a.id}">Delete</button></td></tr>`).join('') + `</tbody></table></div>`;
    after = () => {
      let f = 'all'; const apply = () => { const q = $('#admin-q').value.toLowerCase(); $$('tr[data-row]').forEach(r => { r.hidden = !((f === 'all' || r.dataset.status === f) && r.dataset.text.includes(q)); }); };
      $('#admin-q').addEventListener('input', apply);
      $$('[data-filter]').forEach(b => b.addEventListener('click', () => { f = b.dataset.filter; $$('[data-filter]').forEach(x => x.classList.toggle('on', x === b)); apply(); }));
    };
  }
  if (tab === 'curation') {
    const cur = await call('GET', 'curation'), pub = S.apps;
    const opts = list => `<option value="">Add an app…</option>${pub.filter(a => !list.includes(a.id)).map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join('')}`;
    body = `<div class="curation"><section><h2>Home hero</h2><p class="hint">Up to 8 apps rotate in the hero, in this order.</p><ol class="order" id="cur-hero"></ol><select class="add" data-list="hero"></select></section>` +
      `<section><h2>Top 10</h2><p class="hint">Editorial order for the Top 10 rail. Production can compute this from launches instead.</p><ol class="order" id="cur-top"></ol><select class="add" data-list="top"></select></section>` +
      `<section class="wide"><h2>Home rails</h2><p class="hint">Order, rename or hide the rails on the home page.</p><ol class="order" id="cur-rails"></ol></section></div><div class="actions"><button class="btn btn-play" type="button" id="cur-save">Save curation</button><a class="btn btn-ghost" href="#home">View home</a></div>`;
    after = () => {
      const st = {hero: [...cur.hero], top: pub.filter(a => a.rank).sort((x, y) => x.rank - y.rank).map(a => a.id), rails: cur.rails.map(r => ({...r}))};
      const move = (list, i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; };
      const draw = () => {
        for (const key of ['hero', 'top']) {
          $(`#cur-${key}`).innerHTML = st[key].map((id, i) => { const a = byId(id); return a ? `<li><span class="n">${i + 1}</span><img src="${art(a)}" alt=""><span class="t">${esc(a.title)}</span><button class="btn-sm" type="button" data-mv="${key}:${i}:-1" aria-label="Move ${esc(a.title)} up">↑</button><button class="btn-sm" type="button" data-mv="${key}:${i}:1" aria-label="Move ${esc(a.title)} down">↓</button><button class="btn-sm" type="button" data-rm="${key}:${i}" aria-label="Remove ${esc(a.title)}">Remove</button></li>` : ''; }).join('');
          $(`select[data-list=${key}]`).innerHTML = opts(st[key]); $(`select[data-list=${key}]`).disabled = st[key].length >= (key === 'hero' ? 8 : 10);
        }
        $('#cur-rails').innerHTML = st.rails.map((r, i) => `<li><label class="check"><input type="checkbox" data-en="${i}" ${r.enabled ? 'checked' : ''}><span class="sr">Show</span></label><input class="t-input" data-ti="${i}" value="${esc(r.title)}" maxlength="60" aria-label="Rail title"><button class="btn-sm" type="button" data-mv="rails:${i}:-1" aria-label="Move up">↑</button><button class="btn-sm" type="button" data-mv="rails:${i}:1" aria-label="Move down">↓</button></li>`).join('');
      };
      const root = $('#main');
      root.addEventListener('click', e => { const b = e.target.closest('[data-mv],[data-rm]'); if (!b) return; const [k, i, d] = (b.dataset.mv || b.dataset.rm).split(':'); if (b.dataset.mv) move(st[k], +i, +d); else st[k].splice(+i, 1); draw(); });
      root.addEventListener('change', e => { const s = e.target; if (s.dataset.list && s.value) { st[s.dataset.list].push(s.value); draw(); } if (s.dataset.en) st.rails[+s.dataset.en].enabled = s.checked; });
      root.addEventListener('input', e => { if (e.target.dataset.ti) st.rails[+e.target.dataset.ti].title = e.target.value; });
      $('#cur-save').addEventListener('click', async () => { try { await call('PUT', 'curation', st); await refresh(); toast('Curation saved. The home page uses it now.'); } catch (err) { toast(err.message); } });
      draw();
    };
  }
  if (tab === 'users') {
    const users = await call('GET', 'users');
    body = `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Person</th><th scope="col">Team</th><th scope="col">Role</th><th scope="col">Apps owned</th></tr></thead><tbody>${users.map(u => `<tr><td>${esc(u.name)}${u.id === S.me.id ? ' <small>(you)</small>' : ''}</td><td>${esc(u.team)}</td><td><select data-act="set-role" data-id="${u.id}" aria-label="Role for ${esc(u.name)}">${ROLES.map(r => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td>${u.apps}</td></tr>`).join('')}</tbody></table></div><p class="hint">Viewers browse and keep a list. Creators also publish and edit their own apps. Site admins manage every app, the home page and roles. In production, identity and roles come from your sign-in system.</p>`;
  }
  if (tab === 'activity') {
    const log = await call('GET', 'audit');
    body = log.length ? `<ol class="log">${log.map(e => `<li><time datetime="${e.at}">${ago(e.at)}</time><span><b>${esc(e.userName)}</b> ${esc(e.summary)}</span><a href="#app/${encodeURIComponent(e.target)}">${esc(e.target)}</a></li>`).join('')}</ol>` : `<div class="empty"><h2>No activity yet.</h2><p>Every create, edit, delete, role and curation change is recorded here.</p></div>`;
  }
  return {title: 'Site admin · Dreamcatcher', html: `<div class="page admin">${head}${nav}<div class="admin-body">${body}</div></div>`, after: () => { sky.clear(); after?.(); }};
}

// ── router ───────────────────────────────────────────────────────────────────
function parse() { const h = (location.hash || '#home').slice(1), [name, ...rest] = h.split('/'); return {name: name || 'home', rest: rest.map(x => { try { return decodeURIComponent(x); } catch { return x; } })}; }
let renderSeq = 0;
async function render(opening = false) {
  const seq = ++renderSeq, {name, rest} = parse(); closeBrowse(); closeMenu(); clearTimeout(H.timer); H.el = null;
  let page;
  try {
    page = name === 'home' ? pageHome() : name === 'app' ? pageTitle(rest[0]) : name === 'hub' ? pageHub(rest[0]) : name === 'search' ? pageSearch(rest[0] || '') :
      name === 'my-stuff' ? pageMyStuff(rest[0]) : name === 'studio' ? await pageStudio(rest[0], rest[1]) : name === 'admin' ? await pageAdmin(rest[0] || 'apps') : name === 'create' ? await pageStudio('new') : pageMissing('That page doesn’t exist.', '');
  } catch (err) { page = pageMissing('Something went wrong loading this page.', err.message); }
  if (seq !== renderSeq) return;
  const main = $('#main'); main.innerHTML = page.html; document.title = page.title;
  $('#topbar').classList.toggle('over-hero', !!page.hero); onScroll();
  if (!opening) window.scrollTo({top: 0, behavior: 'instant'});
  wireRails(main); page.after?.(opening);
  if (!opening && S.booted) main.focus({preventScroll: true});
  $$('.browse nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${name}` && !a.dataset.jump));
}
addEventListener('hashchange', () => render());

// ── rails, tiles and hover preview ───────────────────────────────────────────
function wireRails(root) {
  $$('.rail-view', root).forEach(view => {
    const track = $('.track', view), prev = $('.arrow.prev', view), next = $('.arrow.next', view), pager = view.parentElement.querySelector('.pager');
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2; prev.disabled = track.scrollLeft <= 2; next.disabled = track.scrollLeft >= max;
      if (pager) { const pages = Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth)), at = max > 0 ? Math.round(track.scrollLeft / max * (pages - 1)) : 0; pager.innerHTML = pages > 1 ? Array.from({length: pages}, (_, i) => `<i class="${i === at ? 'on' : ''}"></i>`).join('') : ''; }
    };
    track.addEventListener('scroll', () => requestAnimationFrame(update), {passive: true}); update(); addEventListener('resize', update);
    view.addEventListener('click', e => { const b = e.target.closest('.arrow'); if (!b) return; const first = track.querySelector('li'); const step = track.clientWidth - (first ? first.getBoundingClientRect().width : 0); track.scrollBy({left: Number(b.dataset.dir) * Math.max(step, 200), behavior: reduced() ? 'instant' : 'smooth'}); });
    track.addEventListener('pointerover', e => { const li = e.target.closest('.tile'); if (!li) return; const r = li.getBoundingClientRect(), t = track.getBoundingClientRect(), gut = parseFloat(getComputedStyle(track).paddingLeft); li.querySelector('.tile-art')?.style.setProperty('--origin', r.left < t.left + gut + 8 ? 'left center' : r.right > t.right - gut - 8 ? 'right center' : 'center'); });
    track.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; const links = $$('.tile-link,.hub', track), i = links.indexOf(document.activeElement); if (i < 0) return;
      const n = links[i + (e.key === 'ArrowRight' ? 1 : -1)]; if (n) { e.preventDefault(); n.focus({preventScroll: true}); n.scrollIntoView({inline: 'nearest', block: 'nearest', behavior: reduced() ? 'instant' : 'smooth'}); }
    });
  });
}
function wireHoverPreview() {
  const rails = $('#home-rails'); if (!rails) return; let t = 0, leave = 0;
  rails.addEventListener('pointerover', e => {
    const link = e.target.closest('.tile-link'); if (!link || e.pointerType !== 'mouse') return;
    clearTimeout(leave); clearTimeout(t);
    t = setTimeout(() => { if (H.visible && $('#hero')) { const a = byId(link.dataset.tile); if (a) H.startPreview(a); } }, 600);
  });
  rails.addEventListener('pointerleave', () => { clearTimeout(t); leave = setTimeout(() => H.endPreview(), 1500); });
  rails.addEventListener('pointerout', e => { if (!e.relatedTarget?.closest?.('.tile-link')) clearTimeout(t); });
}
// remember where a tile's stars were, so they can fly into the title page
document.addEventListener('click', e => {
  const link = e.target.closest('.tile-link,[data-hero-info]'); if (!link) return;
  const id = link.dataset.tile || link.dataset.heroInfo, a = byId(id); if (!a) return;
  if (link.dataset.tile) { const artEl = link.querySelector('.tile-art'), tall = !link.closest('.tile--wide'); S.from = {id, rect: artEl.getBoundingClientRect(), box: LAYOUT[tall ? 'tall' : 'wide'].box, formation: formation(a)}; }
  else S.from = null;
}, true);

// ── actions ──────────────────────────────────────────────────────────────────
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
async function toggleSave(id) {
  const a = byId(id); if (!a) return; const add = !saved(id);
  try { const list = await call(add ? 'PUT' : 'DELETE', `me/list/${id}`); S.list = new Set(list); } catch (e) { toast(e.message); return; }
  $$(`[data-save="${id}"]`).forEach(b => { b.setAttribute('aria-pressed', String(add)); b.setAttribute('aria-label', `${add ? 'Remove from' : 'Add to'} My List: ${a.title}`); b.textContent = add ? '✓' : '+'; });
  paintChrome(); toast(add ? `Added ${a.title} to My List` : `Removed ${a.title} from My List`);
}
const pendingDelete = new Map();
document.addEventListener('click', async e => {
  const b = e.target.closest('button,a'); if (!b) return;
  if (b.dataset.save) { e.preventDefault(); return toggleSave(b.dataset.save); }
  if (b.dataset.open) return toast('Opening an app connects to your app registry. It isn’t connected in this prototype.');
  if (b.dataset.share) { const url = `${location.href.split('#')[0]}#app/${b.dataset.share}`; try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); } return; }
  if (b.dataset.hero) { if (b.dataset.hero === 'pause') H.togglePause(); else { H.paused = false; H.go(H.i + (b.dataset.hero === 'next' ? 1 : -1)); } return; }
  if (b.dataset.pip) { H.go(Number(b.dataset.pip)); return; }
  if (b.dataset.section) { $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); $(`#${b.dataset.section}`)?.scrollIntoView({behavior: reduced() ? 'instant' : 'smooth', block: 'start'}); return; }
  if (b.dataset.jump) { e.preventDefault(); const target = b.dataset.jump; if (parse().name !== 'home') { location.hash = '#home'; await wait(80); } closeBrowse(); $(`#${target}`)?.scrollIntoView({behavior: reduced() ? 'instant' : 'smooth', block: 'center'}); return; }
  const act = b.dataset.act; if (!act) return;
  try {
    if (act === 'status') { await call('PATCH', `apps/${b.dataset.id}`, {status: b.dataset.to}); await refresh(); toast(`Moved to ${b.dataset.to}`); render(); }
    if (act === 'capture') { await call('POST', `apps/${b.dataset.id}/capture`); toast('Screenshot requested. The capture worker picks it up after the next deploy.'); render(); }
    if (act === 'delete') {
      if (!pendingDelete.has(b)) { pendingDelete.set(b, b.textContent); b.textContent = 'Confirm delete'; b.classList.add('is-armed'); setTimeout(() => { if (pendingDelete.has(b)) { b.textContent = pendingDelete.get(b); b.classList.remove('is-armed'); pendingDelete.delete(b); } }, 4000); return; }
      pendingDelete.delete(b); await call('DELETE', `apps/${b.dataset.id}`); await refresh(); toast('App deleted'); if (b.dataset.back) location.hash = '#studio'; else render();
    }
    if (act === 'clear-history') { await call('DELETE', 'me/history'); S.history = []; toast('History cleared'); render(); }
    if (act === 'save-prefs') { S.me = await call('PATCH', 'me', {name: $('#pref-name').value, prefs: {intro: $('#pref-intro').checked}}); paintChrome(); toast('Settings saved'); }
    if (act === 'switch-user') { await S.api.switchUser(b.dataset.id); S.me = (await call('GET', 'session')).user; await refresh(); toast(`Signed in as ${S.me.name} (${S.me.role})`); render(); }
    if (act === 'reset-data') { await S.api.reset(); S.me = (await call('GET', 'session')).user; await refresh(); toast('Sample data restored'); render(); }
  } catch (err) { toast(err.message); }
});
document.addEventListener('change', async e => {
  const el = e.target, act = el.dataset?.act; if (!act) return;
  try {
    if (act === 'set-status') { await call('PATCH', `apps/${el.dataset.id}`, {status: el.value}); toast(`Status set to ${el.value}`); await refresh(); render(); }
    if (act === 'set-flag') { await call('PATCH', `apps/${el.dataset.id}`, {[el.dataset.flag]: el.checked}); await refresh(); toast('Saved'); }
    if (act === 'set-role') { await call('PATCH', `users/${el.dataset.id}`, {role: el.value}); toast('Role updated'); if (el.dataset.id === S.me.id) { S.me = (await call('GET', 'session')).user; paintChrome(); render(); } }
  } catch (err) { toast(err.message); render(); }
});

// ── chrome: header, browse drawer, profile menu ──────────────────────────────
function onScroll() { $('#topbar').classList.toggle('is-solid', scrollY > 40 || !$('#topbar').classList.contains('over-hero')); }
addEventListener('scroll', onScroll, {passive: true});
function paintChrome() {
  const n = S.apps.filter(a => saved(a.id)).length, c = $('#list-count'); c.hidden = !n; c.textContent = n;
  $('#avatar-initial').textContent = (S.me?.name || '?')[0].toUpperCase();
  $$('.browse [data-role]').forEach(a => { a.hidden = a.dataset.role === 'admin' ? !isAdmin() : !isCreator(); });
  $('.create-link').hidden = !isCreator();
}
let lastFocus = null;
function openBrowse() { lastFocus = document.activeElement; $('#browse').hidden = false; $('#browse-scrim').hidden = false; $('#browse-open').setAttribute('aria-expanded', 'true'); $('#browse nav a')?.focus(); }
function closeBrowse() { if ($('#browse').hidden) return; $('#browse').hidden = true; $('#browse-scrim').hidden = true; $('#browse-open').setAttribute('aria-expanded', 'false'); lastFocus?.focus?.({preventScroll: true}); }
$('#browse-open').addEventListener('click', openBrowse); $('#browse-close').addEventListener('click', closeBrowse); $('#browse-scrim').addEventListener('click', closeBrowse);
$('#browse').addEventListener('keydown', e => { if (e.key !== 'Tab') return; const f = $$('a:not([hidden]),button', $('#browse')); const i = f.indexOf(document.activeElement); if (e.shiftKey && i === 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } });
$('#browse-domains').innerHTML = DOMAINS.map(d => `<a href="#hub/${d}"><span class="dot" style="background:${THEMES[d].accent}"></span>${d}</a>`).join('');
async function openMenu() {
  const m = $('#profile-menu'), users = await S.api.users();
  m.innerHTML = `<div class="menu-head"><b>${esc(S.me.name)}</b><span>${esc(S.me.team || '')} · ${esc(S.me.role)}</span></div>` +
    `<a href="#my-stuff">My Stuff</a>${isCreator() ? '<a href="#studio">Your apps</a>' : ''}${isAdmin() ? '<a href="#admin">Site admin</a>' : ''}` +
    `<p class="menu-group">Sign in as (sample users)</p>${users.map(u => `<button type="button" data-act="switch-user" data-id="${u.id}" ${u.id === S.me.id ? 'aria-current="true"' : ''}>${esc(u.name)} <small>${esc(u.role)}</small></button>`).join('')}` +
    `<p class="menu-group">Data</p><p class="menu-note">${S.api.mode === 'server' ? 'Connected to the Dreamcatcher API.' : `Stored in this browser${S.api.persistent ? '' : ' for this visit only'}.`}</p><button type="button" data-act="reset-data">Restore sample data</button>`;
  m.hidden = false; $('#profile-btn').setAttribute('aria-expanded', 'true'); m.querySelector('a,button')?.focus();
}
function closeMenu() { const m = $('#profile-menu'); if (m.hidden) return; m.hidden = true; $('#profile-btn').setAttribute('aria-expanded', 'false'); }
$('#profile-btn').addEventListener('click', e => { e.stopPropagation(); $('#profile-menu').hidden ? openMenu() : closeMenu(); });
document.addEventListener('click', e => { if (!e.target.closest('.profile')) closeMenu(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeBrowse(); closeMenu(); }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); location.hash = '#search'; }
});
$('#about-open').addEventListener('click', () => {
  $('#about-body').innerHTML = `<div class="dialog-body"><button class="icon-link dialog-close" type="button" data-close-about aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button><h2>About this prototype</h2>` +
    `<p>Dreamcatcher browses apps the way a streaming service browses shows. A rotating hero, rails, Top 10, Originals and full title pages, with My List and Continue exploring.</p>` +
    `<ul><li>Every tile and hero is drawn from the app’s own key graph, as a constellation. Change the graph and the art changes with it.</li><li>Hovering a tile previews it in the hero, the way HBO Max previews titles at the top of its home page.</li><li>Apps, owners, rankings and graphs here are sample data. Data is ${S.api.mode === 'server' ? 'served by the local Dreamcatcher API' : 'stored in this browser'}.</li></ul>` +
    `<p>Design notes, the CRUD contract and the capture pipeline are in the repository’s <code>docs/</code> folder.</p></div>`;
  $('#about').showModal();
});
$('#about').addEventListener('click', e => { if (e.target === $('#about') || e.target.closest('[data-close-about]')) $('#about').close(); });

// ── intro: the stars form the mark, then fly into the first featured app ─────
async function intro() {
  let seen = false; try { seen = sessionStorage.getItem('dc-intro') === '1'; sessionStorage.setItem('dc-intro', '1'); } catch {}
  if (seen || reduced() || parse().name !== 'home' || S.me?.prefs?.intro === false) return;
  const body = document.body, box = $('#intro'); let skipped = false;
  const skip = () => { skipped = true; }; addEventListener('keydown', skip, {once: true}); box.addEventListener('pointerdown', skip, {once: true});
  body.classList.add('is-intro');
  const shown = sky.show(logoFormation(), {target: $('#intro-mark'), color: '#CE96FF', from: 'scatter', duration: 1700});
  await Promise.race([shown, new Promise(r => { const t = setInterval(() => { if (skipped) { clearInterval(t); r(); } }, 50); })]);
  if (!skipped) { box.classList.add('show-word'); for (let i = 0; i < 18 && !skipped; i++) await wait(50); }
  box.classList.add('is-out'); body.classList.remove('is-intro'); body.classList.add('reveal');
  setTimeout(() => { box.classList.remove('is-out', 'show-word'); body.classList.remove('reveal'); }, 1000);
}

// ── boot ─────────────────────────────────────────────────────────────────────
['#brand-mark', '#browse-mark', '#footer-mark'].forEach(s => { $(s).innerHTML = mini(); });
async function boot() {
  try {
    S.api = await connect(); S.me = (await call('GET', 'session')).user; await refresh();
  } catch (err) {
    document.body.classList.remove('is-booting');
    $('#main').innerHTML = err.status === 401 || err.status === 403 ? `<div class="page"><div class="empty"><h2>Sign in to see the catalog.</h2><p>${esc(err.message)}</p><button class="btn btn-play" type="button" onclick="location.reload()">I’ve signed in</button></div></div>` : `<div class="page"><div class="empty"><h2>The app catalog could not be loaded.</h2><p>${esc(err.message)}</p><button class="btn btn-play" type="button" onclick="location.reload()">Try again</button></div></div>`;
    return;
  }
  document.body.classList.remove('is-booting');
  S.intro = intro();
  await render(true); S.booted = true; await S.intro; S.intro = null;
  registerTools();
}
function registerTools() {
  const ctx = document.modelContext; if (!ctx?.registerTool) return;
  try { Promise.resolve(ctx.registerTool({name: 'search_dreamcatcher_apps', title: 'Search Dreamcatcher apps', description: 'Search the catalog and show matching apps.', inputSchema: {type: 'object', properties: {query: {type: 'string', maxLength: 200}}, required: ['query'], additionalProperties: false}, annotations: {readOnlyHint: true, untrustedContentHint: true},
    execute(input) { const q = String(input?.query || '').slice(0, 200); location.hash = `#search/${encodeURIComponent(q)}`; return S.apps.filter(a => [a.title, a.summary, a.owner, ...a.tags].join(' ').toLowerCase().includes(q.toLowerCase())).map(a => ({id: a.id, title: a.title, summary: a.summary})); }})).catch(() => {}); } catch {}
}
boot();
