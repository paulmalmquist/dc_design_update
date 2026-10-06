import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateConfig,assertAllowedUrl} from './policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=b=>createHash('sha256').update(b).digest('hex').slice(0,12);
async function atomicJson(file,value){const temp=file+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,file);}
export async function captureOne(browser, config, app, outputDir, env=process.env){
  assertAllowedUrl(app.url,config);
  const authPath=app.authStateEnv?env[app.authStateEnv]:undefined;
  if(app.authStateEnv&&!authPath)throw new Error('Capture authentication is not configured.');
  const context=await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false,...(authPath?{storageState:authPath}:{})});
  try {
    // Every HTTP request is checked, including redirected navigation and subresources.
    // Run behind a network egress allowlist too; browser routes are not a security sandbox.
    await context.route('**/*',async route=>{try{assertAllowedUrl(route.request().url(),config);await route.continue();}catch{await route.abort('blockedbyclient');}});
    if(context.routeWebSocket)await context.routeWebSocket('**/*',socket=>socket.close());
    const page=await context.newPage();page.setDefaultTimeout(15000);
    const response=await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:30000});
    if(!response||response.status()>=400)throw new Error('App returned a non-success page.');
    assertAllowedUrl(page.url(),config);
    await page.locator(app.readySelector).waitFor({state:'visible',timeout:20000});
    for(const selector of ['input[type=password]',...(app.rejectSelectors||[])])if(await page.locator(selector).isVisible())throw new Error('App is showing a login or error state.');
    let assetTimer;
    try {await Promise.race([page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));}),new Promise((_,reject)=>{assetTimer=setTimeout(()=>reject(new Error('App assets did not become ready.')),10000);})]);}finally{clearTimeout(assetTimer);}
    const masks=(app.maskSelectors||[]).map(s=>page.locator(s));
    const bytes=await page.screenshot({type:'jpeg',quality:84,fullPage:false,animations:'disabled',caret:'hide',mask:masks,maskColor:'#21192f',timeout:20000});
    const revision=digest(bytes);const name=`${app.id}-${revision}.jpg`;
    await mkdir(outputDir,{recursive:true});const temp=path.join(outputDir,name+'.tmp');await writeFile(temp,bytes);await rename(temp,path.join(outputDir,name));
    return {path:`screenshots/${name}`,capturedAt:new Date().toISOString(),revision,approved:true,width:1440,height:810,source:'playwright',appId:app.id};
  } finally {await context.close();}
}
export async function runCapture({configPath=path.join(root,'capture/config.json'),onlyId,chromium,env=process.env}={}){
  const config=validateConfig(JSON.parse(await readFile(configPath,'utf8')));
  const manifestPath=path.join(root,'data/capture-manifest.json');
  // Exclusive lock prevents concurrent jobs from dropping each other's manifest entries.
  const lock=path.join(root,'capture/.capture-lock');try{await mkdir(lock);}catch{throw new Error('Another capture is running (or a stale .capture-lock needs investigation).');}
  let browser;
  try {
    let manifest={version:1,apps:{},maxAgeHours:config.maxAgeHours||168};try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!manifest.apps||typeof manifest.apps!=='object')throw new Error('Invalid existing capture manifest.');
    manifest.maxAgeHours=config.maxAgeHours||168;
    const selected=onlyId?config.apps.filter(a=>a.id===onlyId):config.apps;if(!selected.length)throw new Error('No configured app matches the requested ID.');
    const catalog=JSON.parse(await readFile(path.join(root,'data/apps.json'),'utf8'));
    if(selected.some(a=>!catalog.some(c=>c.id===a.id)))throw new Error('Capture ID is absent from data/apps.json.');
    if(!chromium)({chromium}=await import('playwright'));
    browser=await chromium.launch({headless:true});let failed=0;
    for(const app of selected){try{const result=await captureOne(browser,config,app,path.join(root,'dist/screenshots'),env);manifest.apps[app.id]={...result,lastAttemptAt:result.capturedAt,lastAttemptStatus:'succeeded'};console.log(`${app.id}: screenshot captured`);}catch{failed++;manifest.apps[app.id]={...manifest.apps[app.id],lastAttemptAt:new Date().toISOString(),lastAttemptStatus:'failed'};console.error(`${app.id}: capture failed; last approved image retained if still fresh. Check app readiness, allowed origins, and capture credentials.`);}}
    await atomicJson(manifestPath,manifest);
    return {captured:selected.length-failed,failed};
  } finally {try{if(browser)await browser.close();}finally{await rm(lock,{recursive:true,force:true});}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const configPath=process.argv[2]?path.resolve(process.argv[2]):undefined;runCapture({configPath,onlyId:process.env.CAPTURE_APP_ID}).then(result=>{console.log(JSON.stringify(result));if(result.failed)process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});}
