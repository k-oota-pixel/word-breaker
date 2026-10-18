const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let unavailable=false;
  const ids=['junior1','junior2','junior3','high1','high2','basic'];
  await page.clock.install();
  await context.route('https://task-quest.onrender.com/api/word-breaker/records',route=>route.fulfill({status:unavailable?503:200,contentType:'application/json',body:JSON.stringify({courses:Object.fromEntries(ids.map((id,i)=>[id,{score:120+i,petNames:i===0?['えまめん','<img onerror=alert(1)>']:['ふわ'],leaderCount:i===0?2:1}]))})}));
  await context.route('http://records.test/**',route=>{
   const name=new URL(route.request().url()).pathname.slice(1);
   if(name==='word-breaker-store.js')return route.fulfill({contentType:'text/javascript',body:'export async function currentAccount(){return null;} export async function readBests(){return {};} '});
   if(name==='monstudy_vocab_master.json')return route.fulfill({contentType:'application/json',body:JSON.stringify(Object.fromEntries(ids.map(id=>[id,[{word:'cat',answers:['猫'],keywords:['ねこ']}]])))});
   if(name==='favicon.svg')return route.fulfill({status:204,body:''});
   return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(root,name))});
  });
  await page.goto('http://records.test/index.html');
  await page.locator('.world-record-name').first().filter({hasText:'えまめん'}).waitFor();
  assert.equal(await page.locator('.world-record-card:visible').count(),6);
  assert.equal(await page.locator('#world-record-list img').count(),0);
  assert.match(await page.locator('.world-record-card').first().textContent(),/同率1位/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.course:enabled').first().click();
  await page.locator('#answer:enabled').waitFor();
  assert.equal(await page.locator('.world-record-card:not([hidden])').count(),1);
  assert.equal(await page.locator('.world-record-card:not([hidden])').getAttribute('data-course'),'junior1');
  await page.locator('#answer').fill('猫');await page.locator('#answer-form').evaluate(f=>f.requestSubmit());assert.equal(await page.locator('#distance-label').textContent(),'cat：猫');
  await page.clock.runFor(700);assert.equal(await page.locator('#score').textContent(),'1');
  await page.locator('#quit').click();await page.locator('#result').waitFor({state:'visible'});
  assert.equal(await page.locator('.world-record-card:visible').count(),1);
  await page.locator('#choose').click();assert.equal(await page.locator('.world-record-card:visible').count(),6);
  unavailable=true;await page.clock.runFor(60010);
  await page.locator('#world-record-status').filter({hasText:'前回取得した記録'}).waitFor();
  assert.match(await page.locator('.world-record-name').first().textContent(),/えまめん/);
  await page.reload();await page.locator('#world-record-status').filter({hasText:'取得できません'}).waitFor();
  assert.equal(await page.locator('.course:enabled').count(),6);
  unavailable=false;await page.clock.runFor(60010);
  await page.locator('.world-record-name').first().filter({hasText:'えまめん'}).waitFor();
  if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Browser: guest global records, six courses, ties, safe names, active-course display, gameplay/results, mobile, failure retention and recovery passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
