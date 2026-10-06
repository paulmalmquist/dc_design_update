// Shared by the browser and build pipeline. No network or model dependency.
export const GENERATOR_VERSION = '1.0.0';
export const THEMES = {
  Manufacturing: {accent:'#b7a0ff', deep:'#32224c', label:'BUILD SYSTEMS', motif:'flow'},
  Data: {accent:'#91caff', deep:'#1b345c', label:'CONNECTED KNOWLEDGE', motif:'lineage'},
  Quality: {accent:'#99e6cb', deep:'#153f3a', label:'QUALITY & TRUST', motif:'matrix'},
  Engineering: {accent:'#e2acf1', deep:'#472245', label:'ENGINEERING SIGNALS', motif:'wave'},
  Finance: {accent:'#eac9a1', deep:'#493726', label:'COST & PLANNING', motif:'bars'},
  Platform: {accent:'#c1b8ff', deep:'#30275e', label:'APPS & INTELLIGENCE', motif:'orbit'}
};
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = (value, max = 180) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,max) : '';
export function validateApp(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('App metadata must be an object.');
  const app = {
    id: clean(input.id,64), title: clean(input.title,60), domain: clean(input.domain,40),
    task: clean(input.task,120), subject: clean(input.subject,180), audience: clean(input.audience,100),
    owner: clean(input.owner,100), description: clean(input.description,360),
    descriptionApproved: input.descriptionApproved === true,
    tags: Array.isArray(input.tags) ? input.tags.filter(x=>typeof x==='string').slice(0,8).map(x=>clean(x,40)) : [],
    screenshotPath: clean(input.screenshotPath,200), screenshotApproved: input.screenshotApproved === true,
    featured: input.featured === true
  };
  if(!/^[a-z][a-z0-9-]{1,63}$/.test(app.id)) throw new Error('Use a lowercase app ID with letters, numbers, and hyphens (2–64 characters).');
  if(!app.title) throw new Error('An app title is required.');
  if(!THEMES[app.domain]) throw new Error('Select a supported app domain.');
  // Do not fetch arbitrary URLs, authenticated pages, remote SVGs, or private-network endpoints.
  if(app.screenshotPath && !/^screenshots\/[a-zA-Z0-9_-]+\.(png|webp|jpe?g)$/.test(app.screenshotPath)) throw new Error('Screenshots must be local PNG, JPG, or WebP files under screenshots/.');
  return app;
}
export function describe(app) {
  if(app.descriptionApproved && app.description) return {text:app.description,source:'owner',needsReview:false};
  if(app.task && app.subject) {
    const task = app.task[0].toUpperCase()+app.task.slice(1).replace(/[.!?]+$/,'');
    const subject = app.subject.replace(/[.!?]+$/,'');
    const audience = app.audience ? ` for ${app.audience.replace(/[.!?]+$/,'')}` : '';
    return {text:`${task} ${subject}${audience}.`,source:'metadata',needsReview:true};
  }
  return {text:`${app.title} is a ${app.domain.toLowerCase()} app. Add its purpose and audience to describe what it helps people do.`,source:'fallback',needsReview:true};
}
export function hash(text) {
  let h=2166136261; for (let i=0;i<text.length;i++) h=Math.imul(h^text.charCodeAt(i),16777619);
  return (h>>>0).toString(16).padStart(8,'0');
}
function diagram(motif, color) {
  const line=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
  const dot=(x,y,r=6)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`;
  let geometry='';
  if(motif==='lineage') { const nodes=[[390,110],[390,230],[510,170],[625,90],[650,250],[745,170]]; geometry=nodes.slice(0,2).map(p=>line(...p,510,170)).join('')+nodes.slice(3,5).map(p=>line(510,170,...p)+line(...p,745,170)).join('')+nodes.map(p=>dot(...p)).join(''); }
  if(motif==='flow') {geometry=[0,1,2,3].map(i=>`<path d="M${375+i*92} ${100+i*24}l35 -20 35 20v80l-35 20 -35 -20z"/><path opacity=".35" d="M${375+i*92} ${100+i*24}l35 20 35 -20m-35 20v80"/>`).join('');}
  if(motif==='matrix') {geometry=Array.from({length:20},(_,i)=>`<rect x="${402+(i%5)*61}" y="${75+Math.floor(i/5)*58}" width="36" height="36" rx="4" fill="${color}" fill-opacity="${[.08,.18,.38,.6,.9][(i*3)%5]}" stroke-opacity=".2"/>`).join('');}
  if(motif==='wave') {geometry=`<path opacity=".25" d="M360 110H760M360 175H760M360 240H760"/>`+[0,1,2].map(j=>`<path opacity="${1-j*.25}" d="${Array.from({length:81},(_,i)=>`${i?'L':'M'}${360+i*5} ${175+Math.sin(i*.18+j*.7)*Math.sin(i*.038)*65+j*12}`).join(' ')}"/>`).join('');}
  if(motif==='bars') {geometry=[90,135,112,180,210,155].map((h,i)=>`<rect x="${390+i*59}" y="${300-h}" width="32" height="${h}" rx="3" fill="${color}" fill-opacity="${.1+i*.11}"/>`).join('')+`<path d="M370 307H758" opacity=".4"/>`;}
  if(motif==='orbit') {geometry=`<ellipse cx="575" cy="175" rx="162" ry="72" transform="rotate(-28 575 175)"/><ellipse cx="575" cy="175" rx="112" ry="138" transform="rotate(-28 575 175)" opacity=".4"/>${dot(575,175,10)}${dot(436,248)}${dot(718,98)}${dot(520,58,4)}`;}
  return `<g stroke="${color}" stroke-width="2" fill="none">${geometry}</g>`;
}
export function thumbnailSvg(input) {
  const app=validateApp(input), t=THEMES[app.domain];
  const short=app.title.length>28 ? app.title.slice(0,27)+'…' : app.title;
  const seed=parseInt(hash(app.id),16);
  const stars=Array.from({length:30},(_,i)=>`<circle cx="${(seed%791+i*137)%800}" cy="${(seed%443+i*61)%450}" r="${i%4===0?1.4:.7}" fill="#fff" opacity="${.12+(i%4)*.1}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450" role="img" aria-label="${esc(app.title)}: ${esc(app.domain)} concept artwork"><defs><linearGradient id="bg"><stop stop-color="#13101f"/><stop offset="1" stop-color="${t.deep}"/></linearGradient><radialGradient id="glow"><stop stop-color="${t.accent}" stop-opacity=".15"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient></defs><rect width="800" height="450" fill="url(#bg)"/><ellipse cx="580" cy="180" rx="340" ry="290" fill="url(#glow)"/>${stars}${diagram(t.motif,t.accent)}<path d="M44 53h22m-11 -11v22" stroke="${t.accent}"/><text x="84" y="58" fill="${t.accent}" font-family="Arial,sans-serif" font-size="17" letter-spacing="3">${t.label}</text><text x="44" y="350" fill="#f8f5ff" font-family="Arial,sans-serif" font-size="${short.length>22?32:40}" font-weight="600" letter-spacing="-1">${esc(short)}</text><text x="46" y="393" fill="#bbb3ca" font-family="Arial,sans-serif" font-size="17">${esc(app.tags.slice(0,2).join('  /  ')||app.domain)}</text></svg>`;
}
export function enrich(input) {
  const app=validateApp(input), descriptionInfo=describe(app);
  const revision=hash(JSON.stringify({app,version:GENERATOR_VERSION}));
  return {...app,summary:descriptionInfo.text,descriptionSource:descriptionInfo.source,needsReview:descriptionInfo.needsReview,
    revision,generatorVersion:GENERATOR_VERSION,artworkSource:app.screenshotApproved&&app.screenshotPath?'approved-screenshot':'generated-diagram'};
}
