// Shared by the browser and build pipeline. No network or model dependency.
import {THEMES, TITLE_STYLES} from './themes.mjs';
import {validateKeyVisual, artSvg, esc} from './constellation.mjs';
export {THEMES, esc};
export const GENERATOR_VERSION = '2.0.0';

const clean = (value, max = 180) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value) && Number.isFinite(Date.parse(value)) ? value.slice(0, 10) : '';

export function validateLaunchUrl(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Launch URL must be an HTTPS URL.');
  let url; try { url = new URL(value); } catch { throw new Error('Launch URL must be an HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Launch URL must use HTTPS without embedded credentials.');
  return url.href;
}

export function validateApp(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('App metadata must be an object.');
  const app = {
    id: clean(input.id, 64), title: clean(input.title, 60), domain: clean(input.domain, 40), launchUrl: validateLaunchUrl(input.launchUrl),
    task: clean(input.task, 120), subject: clean(input.subject, 180), audience: clean(input.audience, 100),
    owner: clean(input.owner, 100), description: clean(input.description, 360), logline: clean(input.logline, 120),
    descriptionApproved: input.descriptionApproved === true,
    tags: Array.isArray(input.tags) ? input.tags.filter(x => typeof x === 'string').slice(0, 8).map(x => clean(x, 40)).filter(Boolean) : [],
    screenshotPath: clean(input.screenshotPath, 200), screenshotApproved: input.screenshotApproved === true,
    featured: input.featured === true, original: input.original === true,
    rank: Number.isInteger(input.rank) && input.rank >= 1 && input.rank <= 99 ? input.rank : null,
    publishedAt: isoDate(input.publishedAt), updatedAt: isoDate(input.updatedAt),
    titleStyle: TITLE_STYLES.includes(input.titleStyle) ? input.titleStyle : '',
    keyVisual: null, keyVisualSource: input.keyVisualSource === 'app' ? 'app' : 'metadata'
  };
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(app.id)) throw new Error('Use a lowercase app ID with letters, numbers, and hyphens (2–64 characters).');
  if (!app.title) throw new Error('An app title is required.');
  if (!THEMES[app.domain]) throw new Error('Select a supported app domain.');
  // Do not fetch arbitrary URLs, authenticated pages, remote SVGs, or private-network endpoints.
  if (app.screenshotPath && !/^screenshots\/[a-zA-Z0-9_-]+\.(png|webp|jpe?g)$/.test(app.screenshotPath)) throw new Error('Screenshots must be local PNG, JPG, or WebP files under screenshots/.');
  app.keyVisual = validateKeyVisual(input.keyVisual);          // throws on malformed graphs
  return app;
}

export function describe(app) {
  if (app.descriptionApproved && app.description) return {text: app.description, source: 'owner', needsReview: false};
  if (app.task && app.subject) {
    const task = app.task[0].toUpperCase() + app.task.slice(1).replace(/[.!?]+$/, '');
    const subject = app.subject.replace(/[.!?]+$/, '');
    const audience = app.audience ? ` for ${app.audience.replace(/[.!?]+$/, '')}` : '';
    return {text: `${task} ${subject}${audience}.`, source: 'metadata', needsReview: true};
  }
  return {text: `${app.title} is a ${app.domain.toLowerCase()} app. Add its purpose and audience to describe what it helps people do.`, source: 'fallback', needsReview: true};
}

export function hash(text) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Exported thumbnail (for chat links, docs, other tools): constellation key art plus the title.
// The gallery itself draws title art in HTML over title-free art from artSvg().
export function thumbnailSvg(input) { return artSvg(validateApp(input), {shape: 'wide', title: true}); }

export function enrich(input) {
  const app = validateApp(input), d = describe(app);
  const revision = hash(JSON.stringify({app, version: GENERATOR_VERSION}));
  return {...app, summary: d.text, descriptionSource: d.source, needsReview: d.needsReview,
    logline: app.logline || d.text, titleStyle: app.titleStyle || THEMES[app.domain].title,
    keyVisualSource: app.keyVisual ? app.keyVisualSource : 'generated',
    revision, generatorVersion: GENERATOR_VERSION,
    artworkSource: 'constellation', screenshotSource: app.screenshotApproved && app.screenshotPath ? 'approved-screenshot' : 'none'};
}

