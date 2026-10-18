const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const appMock='export const initializeApp=()=>({}),getApps=()=>[{}],getApp=()=>({});';
const authMock=`const auth={currentUser:window.guest?null:{uid:'tester'}};export const getAuth=()=>auth;export function onAuthStateChanged(a,fn){queueMicrotask(()=>fn(auth.currentUser));}`;
const firestoreMock=`export const getFirestore=()=>({}),doc=(db,...p)=>p.join('/'),serverTimestamp=()=>0;
export async function runTransaction(db,fn){let staged;const result=await fn({get:async()=>({exists:()=>true,data:()=>structuredClone(window.wallet)}),set:(ref,payload,options)=>{if(window.failSave)throw Error('offline');staged=structuredClone(window.wallet);for(const field of options.mergeFields){const parts=field.split('.');let dest=staged,src=payload;for(const part of parts.slice(0,-1)){dest=dest[part]??={};src=src[part];}dest[parts.at(-1)]=structuredClone(src[parts.at(-1)]);}}});if(staged)window.wallet=staged;return result;}`;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
 const {DEMO}=await import('../word-breaker-data.js');
 const courses=JSON.parse(fs.readFileSync(path.join(root,'monstudy_vocab_master.json'),'utf8'));
 const actualWords=courses.levels.junior1.words;
 async function setup(guest,missing=false){
   const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install();
   await page.addInitScript(({guest})=>{window.guest=guest;window.wallet={coins:90,petName:'ふわ',petShop:{ownedItems:['crown']},wordBreakerBests:{high2:{score:100,combo:90}}};},{guest});
   await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('firebase-app')?appMock:route.request().url().includes('firebase-auth')?authMock:firestoreMock}));
   await context.route('http://localhost:8765/**',route=>{
     const name=new URL(route.request().url()).pathname.slice(1);
     if(name==='nickname-profile.js')return route.fulfill({contentType:'text/javascript',body:''});
     if(name==='monstudy_vocab_master.json')return route.fulfill({status:missing?404:200,contentType:'application/json',body:JSON.stringify(courses)});
     const file=path.join(root,name);return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
   });
   await page.goto('http://localhost:8765/index.html');return {page,context,errors};
 }
 const guest=await setup(true,true),p=guest.page;
 await p.locator('#demo').waitFor({state:'visible'});assert.equal(await p.locator('.course:disabled').count(),6);
 await p.locator('#demo').click();await p.locator('#answer:enabled').waitFor();
 await p.locator('#answer').fill('ぜんぜん違う');await p.locator('#answer-form').evaluate(f=>f.requestSubmit());assert.equal(await p.locator('#life').textContent(),'♥ ♥ ');
 const demoWord=await p.locator('#word').textContent(),demoEntry=DEMO.find(entry=>entry.word===demoWord);
 await p.clock.runFor(12020);assert.equal(await p.locator('#word').evaluate(el=>el.classList.contains('danger')),true);
 await p.clock.runFor(5000);assert.equal(await p.locator('#life').textContent(),'♥ ');assert.equal(await p.locator('#distance-label').textContent(),`${demoWord}：${demoEntry.answers[0]}`);
 await p.clock.runFor(700);assert.equal(await p.locator('#feedback-result').textContent(),'時間切れ · LIFE −1');assert.equal(await p.locator('#feedback-user').textContent(),'ぜんぜん違う');
 await p.clock.runFor(17020+700);await p.locator('#result').waitFor({state:'visible'});assert.equal(await p.locator('#result-coins').textContent(),'0');
 await p.locator('#retry').click();assert.equal(await p.locator('#score').textContent(),'0');assert.deepEqual(guest.errors,[]);
 const signed=await setup(false),q=signed.page;
 await q.locator('#account').filter({hasText:'ログイン中'}).waitFor();await q.locator('.course').first().click();await q.locator('#answer:enabled').waitFor();
 async function correct(){const word=await q.locator('#word').textContent();const entry=actualWords.find(e=>e.word===word);await q.locator('#answer').fill(entry.answers[0]);await q.locator('#answer-form').evaluate(f=>f.requestSubmit());assert.equal(await q.locator('#distance-label').textContent(),`${word}：${entry.answers[0]||''}`);await q.clock.runFor(700);await q.locator('#answer:enabled').waitFor();}
 for(let i=0;i<40;i++)await correct();
 await q.waitForFunction(()=>window.wallet.coins===93);assert.equal(await q.locator('#score').textContent(),'40');
 assert.deepEqual(await q.evaluate(()=>window.wallet.petShop),{ownedItems:['crown']});assert.equal(await q.evaluate(()=>window.wallet.petName),'ふわ');assert.deepEqual(await q.evaluate(()=>window.wallet.wordBreakerBests.high2),{score:100,combo:90});
 await q.locator('#quit').click();await q.waitForFunction(()=>!document.getElementById('retry').disabled);assert.equal(await q.locator('#result-coins').textContent(),'3');
 await q.locator('#retry-save').evaluate(el=>el.click());await q.waitForFunction(()=>!document.getElementById('retry').disabled);assert.equal(await q.evaluate(()=>window.wallet.coins),93);
 await q.locator('#retry').click();await q.locator('#answer:enabled').waitFor();
 await q.evaluate(()=>window.failSave=true);await correct();await q.locator('#quit').click();await q.locator('#retry-save').waitFor({state:'visible'});
 await q.evaluate(()=>window.failSave=false);await q.locator('#retry-save').click();await q.waitForFunction(()=>!document.getElementById('retry').disabled);
 await q.locator('#choose').click();assert.match(await q.locator('.course').first().textContent(),/BEST SCORE　40/);
 await q.setViewportSize({width:390,height:844});assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await q.locator('.course').first().click();await q.locator('#answer:enabled').waitFor();assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.env.SCREENSHOT_PATH)await q.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 assert.deepEqual(signed.errors,[]);console.log('WORD BREAKER browser checks passed: warning/deadline, retry, previous answers, 40-word rewards, idempotency, save retry, wallet/PET preservation, course bests, mobile layout.');
 }finally{await browser.close();}
})();
