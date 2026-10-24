import {mountRecords} from './word-breaker-records.js?v=1.10.4';
import { GAME_NAME, COURSES, Round, LIMIT_MS, WARNING_MS } from './word-breaker-engine.js?v=1.7';
import { DEMO, loadVocabulary } from './word-breaker-data.js?v=1.5';

const $=id=>document.getElementById(id);
const worldRecords=mountRecords();
document.title=`${GAME_NAME} | もんすたでぃ`;
document.querySelectorAll('[data-game-name]').forEach(el=>el.textContent=GAME_NAME);
let titleWrong=new Set(),titleRecovered=false,titleOneLife=0;
let vocabulary={},bests={},localBests={},store=null,user=null,round=null,course=null,run=null,playerUid=null;
let animation=0,transition=0,wrongReset=0,generation=0,saveChain=Promise.resolve(),savedCoins=0,saving=0,unsaved=false,oldBest={};
const mobile=matchMedia('(max-width:720px)');
let composing=false,viewportFrame=0;
function focusAnswer(){if(document.activeElement!==$('answer'))$('answer').focus({preventScroll:true});}
function updatePlayViewport(){
  viewportFrame=0;
  const viewport=window.visualViewport;
  const height=viewport?.height||window.innerHeight;
  document.documentElement.classList.toggle('word-breaker-compact',height<330);
  document.documentElement.style.setProperty('--wb-visible-height',`${height}px`);
  document.documentElement.style.setProperty('--wb-visible-top',`${viewport?.offsetTop||0}px`);
}
function queuePlayViewport(){if(!viewportFrame)viewportFrame=requestAnimationFrame(updatePlayViewport);}
window.visualViewport?.addEventListener('resize',queuePlayViewport);
window.visualViewport?.addEventListener('scroll',queuePlayViewport);
window.addEventListener('resize',queuePlayViewport);
updatePlayViewport();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
try {localBests=JSON.parse(localStorage.getItem('word-breaker-guest-bests')||'{}');} catch {}
function show(id) {document.documentElement.classList.toggle('word-breaker-playing',id==='play');updatePlayViewport();if(id==='play')$('previous-feedback').open=!mobile.matches;worldRecords.setCourse(id==='selection'||course==='demo'?null:course);for(const section of ['selection','play','result']) $(section).hidden=section!==id;}
function best(id) {return user ? bests[id]||{} : localBests[id]||{};}
function renderCourses() {
  $('courses').replaceChildren();
  for(const [id,label] of COURSES) {
    const button=document.createElement('button');button.className='course';button.disabled=!vocabulary[id];
    const title=document.createElement('strong');title.textContent=label;button.append(title);
    const record=best(id),row=document.createElement('div');row.className='best';
    for(const [name,value] of [['BEST SCORE',record.score||0],['BEST COMBO',record.combo||0]]){const el=document.createElement('small');el.textContent=`${name}　${value}`;row.append(el);}
    button.append(row);
    button.onclick=()=>start(id);$('courses').append(button);
  }
}
function safeGuestSave() {
  if(course==='demo' || playerUid) return;
  const previous=localBests[course]||{};
  localBests[course]={score:Math.max(previous.score||0,round.score),combo:Math.max(previous.combo||0,round.bestCombo)};
  try {localStorage.setItem('word-breaker-guest-bests',JSON.stringify(localBests));} catch { $('message').textContent='このブラウザでは自己ベストを保存できません。'; }
}
function updateHUD() {$('score').textContent=round.score;$('combo').textContent=round.combo;$('life').textContent=round.life?'♥ '.repeat(round.life):'0';}
function saveProgress(publishWorldRecord=false) {
  safeGuestSave();
  if(!run || !store || !user || course==='demo') return Promise.resolve();
  const titleData={kind:'run',eventId:run.id,score:round.score,combo:round.bestCombo,course,oneLifeCorrect:titleOneLife,recovered:titleRecovered};
  const snapshot={...run,rewards:round.rewards,score:round.score,bestCombo:round.bestCombo};
  const attempted=round.score>0||round.life<2;
  saving++;$('save-status').textContent='記録とコインを保存中…';$('retry-save').hidden=true;
  saveChain=saveChain.catch(()=>{}).then(async()=>{
    try {await run.ready;} catch {run.ready=run.register();await run.ready;}
    savedCoins=await store.saveRun(snapshot);if(publishWorldRecord&&attempted&&user?.uid===snapshot.uid)window.EnglishPlayroomCoins?.recordTitleEvent?.('word-breaker',titleData);unsaved=false;if(attempted)window.EnglishPlayroomCoins?.recordLearningActivity?.();
    bests[course]={score:Math.max(bests[course]?.score||0,snapshot.score),combo:Math.max(bests[course]?.combo||0,snapshot.bestCombo)};
    if(publishWorldRecord&&store.publishRecord){
      try {await store.publishRecord(course);document.dispatchEvent(new Event('word-breaker-record-saved'));} catch {}
    }
    $('result-coins').textContent=savedCoins;
    $('save-status').textContent='共通コインと自己ベストを保存しました。';
  }).catch(error=>{unsaved=true;$('save-status').textContent=`保存できませんでした。画面を閉じずに再試行してください。${error.message}`;$('retry-save').hidden=false;})
    .finally(()=>{saving--; $('retry').disabled=saving>0||unsaved;$('choose').disabled=saving>0||unsaved;});
  $('retry').disabled=true;$('choose').disabled=true;
  return saveChain;
}
async function start(id) {
  if(saving||unsaved) return;
  cancelAnimationFrame(animation);clearTimeout(transition);clearTimeout(wrongReset);generation++;
  const current=generation;
  titleWrong=new Set();titleRecovered=false;titleOneLife=0;course=id;round=new Round(id==='demo'?DEMO:vocabulary[id]);oldBest={...best(id)};savedCoins=0;run=null;playerUid=null;
  $('save-status').textContent='';$('retry-save').hidden=true;$('feedback-empty').hidden=false;$('feedback-detail').hidden=true;
  show('play');updateHUD();$('message').textContent='';$('word').textContent='準備中…';$('answer').value='';$('answer').disabled=false;$('submit').disabled=true;focusAnswer();
  // SDK failure must never prevent a guest from playing.
  if(store && id!=='demo') {
    try {user=await store.currentAccount();} catch {user=null;}
    if(user) {
      playerUid=user.uid;
      const record={id:crypto.randomUUID(),course:id,uid:user.uid};
      const register=()=>store.openRun(record.id,id,user.uid).then(ok=>{if(!ok)throw new Error('ログインを確認してください');});
      record.ready=register();
      record.register=register;
      // Keep failures handled until saving is requested.
      record.ready.catch(()=>{});run=record;
    }
  }
  if(current===generation)next();
}
function next(keepInput=false) {
  clearTimeout(wrongReset);
  round.next(performance.now());$('word').textContent=round.current.word;$('word').className='word';$('word').style.opacity='1';$('distance-label').textContent='BREAK BEFORE IMPACT';
  $('arena').classList.remove('explode');$('burst').replaceChildren();if(!keepInput)$('answer').value='';$('answer').classList.remove('wrong');$('answer').disabled=false;$('submit').disabled=false;if(!keepInput)focusAnswer();
  animation=requestAnimationFrame(tick);
}
function tick(now) {
  if(!round?.active) return;
  const elapsed=now-round.started,p=Math.min(1,elapsed/LIMIT_MS);
  const word=$('word');word.style.top='50%';
  word.style.transform=reduced?'translateY(-50%)':`translateY(-50%) scale(${.35+p*2.85})`;
  $('word').classList.toggle('danger',elapsed>=WARNING_MS);
  if(elapsed>=LIMIT_MS) settle(round.timeout()); else animation=requestAnimationFrame(tick);
}
function feedback(type) {
  $('distance-label').textContent=`${round.current.word}：${round.current.answers[0]||''}`;
  $('feedback-empty').hidden=true;$('feedback-detail').hidden=false;
  $('feedback-word').textContent=round.current.word;$('feedback-user').textContent=round.lastAnswer||'（未回答）';
  $('feedback-answers').textContent=round.current.answers.join(' / ');
  $('feedback-result').textContent=type==='correct'?'✓ 正解':'時間切れ · LIFE −1';
}
function particles() {
  for(let i=0;i<16;i++){const el=document.createElement('i');el.className='shard';const angle=i*Math.PI/8;el.style.setProperty('--x',`${Math.cos(angle)*(70+i*6)}px`);el.style.setProperty('--y',`${Math.sin(angle)*100}px`);el.style.setProperty('--angle',`${i*23}deg`);$('burst').append(el);}
}
function wrongFeedback() {
  clearTimeout(wrongReset);
  const word=$('word'),answer=$('answer');
  word.classList.remove('wrong');answer.classList.remove('wrong');
  void word.offsetWidth;
  word.classList.add('wrong');answer.classList.add('wrong');
  wrongReset=setTimeout(()=>{word.classList.remove('wrong');answer.classList.remove('wrong');},460);
}
function settle(result) {
  if(result.type==='ignored') return;
  if(result.type==='wrong') {titleWrong.add(round.current.word);wrongFeedback();$('message').textContent='もう一度！ 制限時間内なら何回でも答えられます。';$('answer').select();return;}
  if(result.type==='correct'){if(titleWrong.has(round.current.word))titleRecovered=true;if(round.life===1)titleOneLife++;}else titleWrong.add(round.current.word);
  cancelAnimationFrame(animation);clearTimeout(wrongReset);$('answer').classList.remove('wrong');$('answer').value='';$('submit').disabled=true;
  feedback(result.type);updateHUD();particles();$('word').style.opacity='0';
  if(result.type!=='correct') $('arena').classList.add('explode');
  $('message').textContent=result.type==='correct'?`✓ 撃破！${result.reward?' コイン獲得条件達成！':''}`:'時間切れ。COMBOが0になりました。';
  saveProgress();
  const current=generation;transition=setTimeout(()=>{if(current!==generation)return;if(!round.life)finish();else next(true);},reduced?180:650);
}
function finish(abandoned=false) {
  if(!round) return;
  cancelAnimationFrame(animation);clearTimeout(transition);clearTimeout(wrongReset);round.active=false;generation++;
  $('answer').disabled=true;$('submit').disabled=true;composing=false;
  $('result-heading').textContent=abandoned?'今回の記録':course==='demo'?'操作体験の結果':'おつかれさま！';
  $('result-score').textContent=round.score;$('result-combo').textContent=round.bestCombo;$('result-coins').textContent=savedCoins;
  // Keep the final timed-out question readable after the play section is hidden.
  $('final-review').hidden=round.life!==0;
  $('final-word').textContent=round.life===0?round.current.word:'';
  $('final-user').textContent=round.life===0?(round.lastAnswer||'（未回答）'):'';
  $('final-answers').textContent=round.life===0?round.current.answers.join(' / '):'';
  $('record').hidden=course==='demo'||!(round.score>(oldBest.score||0)||round.bestCombo>(oldBest.combo||0));
  if(course==='demo') $('save-status').textContent='操作体験です。コイン・自己ベストは保存されません。';
  else if(!playerUid) $('save-status').textContent='ゲスト記録はこのブラウザに保存。コイン獲得にはプレイ前にログインしてください。';
  show('result');$('result').focus();saveProgress(true);
}
$('answer-form').addEventListener('submit',e=>{e.preventDefault();if(e.isComposing || composing || !round?.active || !$('answer').value.trim())return;focusAnswer();settle(round.resolve($('answer').value,performance.now()));});
// Keep the soft keyboard open when the submit button is tapped.
$('submit').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'&&document.activeElement===$('answer'))e.preventDefault();});
$('answer').addEventListener('compositionstart',()=>{composing=true;});
$('answer').addEventListener('compositionend',()=>{composing=false;});
$('answer').addEventListener('keydown',e=>{if(e.key==='Enter' && (e.isComposing||e.keyCode===229))e.preventDefault();});
$('quit').onclick=()=>finish(true);$('retry').onclick=()=>start(course);$('choose').onclick=()=>{show('selection');renderCourses();};$('demo').onclick=()=>start('demo');$('retry-save').onclick=()=>saveProgress(!round?.active);
// Leaving the tab does not grant extra time. Expiry resolves once on return.
document.addEventListener('visibilitychange',()=>{if(!document.hidden && round?.active && performance.now()-round.started>=LIMIT_MS)settle(round.timeout());});
renderCourses();
loadVocabulary().then(data=>{vocabulary=data;$('data-status').textContent='6コースから選択できます。';renderCourses();}).catch(error=>{$('data-status').textContent=error.message;$('demo').hidden=false;});
// Load Firebase independently: vocabulary and gameplay remain usable offline.
import('./word-breaker-store.js?v=1.10.4').then(async module=>{
  user=await module.currentAccount();store=module;
  if(user){$('account').textContent='ログイン中';$('account').href='./index.html';try{bests=await store.readBests();}catch{$('data-status').textContent+=' 自己ベストの読み込みに失敗しました。';}}
  renderCourses();
}).catch(()=>{$('account').textContent='ゲストでプレイ';});
