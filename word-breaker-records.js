import {makeDialog} from 'https://k-oota-pixel.github.io/english-playroom/learning-titles.js?v=1.10.2';
import {COURSES} from './word-breaker-engine.js';
const API='https://task-quest.onrender.com/api/word-breaker/records';
export function mountRecords(){
 const panel=document.getElementById('world-records');
 if(!panel)return {setCourse(){},refresh(){}};
 const list=document.getElementById('world-record-list'),status=document.getElementById('world-record-status'),retry=document.getElementById('world-record-refresh');
 const trigger=document.createElement('button');trigger.type='button';trigger.className='secondary';trigger.textContent='🏆 ランキングを見る';trigger.setAttribute('aria-haspopup','dialog');panel.before(trigger);const dialog=makeDialog('ワードブレイカーのランキング');dialog.append(panel);const css=document.createElement('link');css.rel='stylesheet';css.href='https://k-oota-pixel.github.io/english-playroom/learning-titles.css?v=1.10.1';document.head.append(css);trigger.addEventListener('click',()=>{dialog.showModal();refresh();});
 let records=null,pending=false,lastAttempt=0,activeCourse='';
 function render(){
  list.replaceChildren();
  for(const [id,label] of COURSES){
   const item=document.createElement('article');item.className='world-record-card';item.dataset.course=id;item.hidden=!!activeCourse&&activeCourse!==id;
   const heading=document.createElement('h3');heading.textContent=label;
   const value=records?.courses?.[id],names=Array.isArray(value?.petNames)?value.petNames.filter(n=>typeof n==='string'):[];
   const name=document.createElement('p');name.className='world-record-name';
   const score=document.createElement('p');score.className='world-record-score';
   if(value?.score>0&&names.length){
    name.textContent='👑 '+(Array.isArray(value.leaders)?value.leaders.map(v=>v.petName+' ー'+(v.title||'称号なし')+'ー').join('・'):names.map(n=>n+' ー称号なしー').join('・'))+(value.leaderCount>names.length?` ほか${value.leaderCount-names.length}匹`:'');
    score.textContent=`${value.score.toLocaleString()} SCORE`+(value.leaderCount>1?' · 同率1位':'');
   }else{
    name.textContent=records?'最初のチャンピオンになろう！':'—';
    score.textContent=records?'まだ記録がありません':'';
   }
   item.append(heading,name,score);list.append(item);
  }
 }
 async function refresh(){
  if(pending||document.hidden||!dialog.open||Date.now()-lastAttempt<1000)return;
  pending=true;lastAttempt=Date.now();retry.disabled=true;
  if(!records)status.textContent='みんなの記録を読み込み中…';
  try{
   const response=await fetch(API,{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('records unavailable');
   const data=await response.json();
   if(!data?.courses||!COURSES.every(([id])=>Number.isSafeInteger(data.courses[id]?.score)&&data.courses[id].score>=0&&Array.isArray(data.courses[id].petNames)))throw Error('invalid records');
   records=data;render();status.textContent='みんなの最高スコア · ペット名で表示 · 称号を表示';
  }catch{
   status.textContent=records?'更新できませんでした。前回取得した記録を表示しています。':'記録を取得できませんでした。「更新」で再試行できます。';
  }finally{pending=false;retry.disabled=false;}
 }
 retry.addEventListener('click',refresh);
 window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 document.addEventListener('word-breaker-record-saved',refresh);
 render();
 return {setCourse(id){activeCourse=id||'';panel.dataset.activeCourse=activeCourse;for(const card of list.children)card.hidden=!!id&&card.dataset.course!==id;},refresh};
}
