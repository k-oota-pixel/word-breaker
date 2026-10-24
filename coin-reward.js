import {announceTitles} from 'https://k-oota-pixel.github.io/english-playroom/learning-titles.js?v=1.10.1';
import 'https://k-oota-pixel.github.io/english-playroom/material-open.js?v=1.9.6';
import {interviewAttemptPatch} from './dashboard-extra.js?v=1';
import './nickname-profile.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyAllLjPcGhygMSEIORXhKZOaDjYvpSJ4EQ",
  authDomain:"eiken-retry.firebaseapp.com",
  projectId:"eiken-retry",
  storageBucket:"eiken-retry.firebasestorage.app",
  messagingSenderId:"231308672297",
  appId:"1:231308672297:web:5e8b8ede3a0246c2318b38",
  measurementId:"G-8CWR37L5K0"
};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
// Reuse the site's existing Firebase app and wallet without changing daily rewards.
export { auth, db, authReady, walletRef };
let currentUser=auth.currentUser||null;
let authResolved=false,resolveAuth;
const authReady=new Promise(r=>resolveAuth=r);
onAuthStateChanged(auth,user=>{currentUser=user||null;if(!authResolved){authResolved=true;resolveAuth();}});

function todayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function cleanPart(value){return String(value??'').trim().replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,80)||'item';}
function walletRef(user){return doc(db,'users',user.uid,'apps','english-playroom');}
function ensureToast(){
  let el=document.getElementById('englishPlayroomCoinToast');if(el)return el;
  const style=document.createElement('style');style.textContent='#englishPlayroomCoinToast{position:fixed;right:14px;bottom:14px;z-index:2147483646;background:#193d38;color:#fff;border:1px solid #ffffff28;border-radius:999px;padding:9px 13px;font:800 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 28px #10251f35;opacity:0;transform:translateY(8px);pointer-events:none;transition:.18s}#englishPlayroomCoinToast.show{opacity:1;transform:translateY(0)}';document.head.appendChild(style);
  el=document.createElement('div');el.id='englishPlayroomCoinToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);return el;
}
let toastTimer=0;
function toast(text){const el=ensureToast();el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}

let lastLearningUid='',lastLearningApp='',lastLearningSent=0;
function learningContentFromPage(){const path=location.pathname;return ['word-breaker','ateru','basic-quest','eiken-retry','task-quest','eiken-cloze','eiken-title','listening-training','pre2-interview-questions','eiken-pre2-interview-a','talk-quest','pet-catch'].find(id=>path.split('/').includes(id));}
async function recordLearningActivity(appId=learningContentFromPage()){
  await authReady;const user=currentUser;if(!user||typeof fetch!=='function')return;
  if(lastLearningUid===user.uid&&lastLearningApp===appId&&Date.now()-lastLearningSent<1000)return;lastLearningUid=user.uid;lastLearningApp=appId;lastLearningSent=Date.now();
  try{const token=await user.getIdToken();const response=await fetch('https://task-quest.onrender.com/api/learning/activity',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(appId?{appId}:{}),keepalive:true});if(!response.ok)throw Error('HTTP '+response.status);const result=await response.json();if(currentUser?.uid===user.uid)announceTitles(result.freshTitles);}catch(error){console.warn('Learning activity update deferred',error);}
}

async function awardOncePerDay(appId,itemId,label='1コインGET！'){
  await authReady;
  const user=currentUser;if(!user)return {awarded:false,reason:'signed-out'};
  const today=todayKey(),claim=`${cleanPart(appId)}:${cleanPart(itemId)}`;
  let awarded=false,newCoins=0;
  try{
    await runTransaction(db,async tx=>{
      const ref=walletRef(user),snap=await tx.get(ref),data=snap.exists()?(snap.data()||{}):{};
      const sameDay=data.coinRewardDate===today;
      const claims=sameDay&&Array.isArray(data.coinRewardClaims)?data.coinRewardClaims.filter(x=>typeof x==='string'):[];
      const coins=Math.max(0,Math.floor(Number(data.coins)||0));
      const interview=appId==='eiken-pre2-interview-a'?interviewAttemptPatch(data,itemId.replace(/^theme-/,''),today):null;
      if(claims.includes(claim)){
        if(interview)tx.set(ref,{pre2InterviewA:interview},{merge:true});
        newCoins=coins;return;
      }
      claims.push(claim);newCoins=coins+1;awarded=true;
      tx.set(ref,{...(interview?{pre2InterviewA:interview}:{}),coins:newCoins,coinRewardDate:today,coinRewardClaims:claims,coinUpdatedAt:serverTimestamp(),coinSchemaVersion:1},{merge:true});
    });
    if(awarded)toast(`🪙 +1　${label}`);
    return {awarded,coins:newCoins,reason:awarded?'awarded':'already-today'};
  }catch(error){console.error('Coin reward failed',error);return {awarded:false,reason:'error',error};}
}

async function recordRetryAttempt(questionId){
  await authReady;
  const user=currentUser;if(!user)return {awarded:false,reason:'signed-out'};
  const today=todayKey(),claim=`eiken-retry:${cleanPart(questionId)}`;
  let awarded=false,progress=0,newCoins=0,counted=false;
  try{
    await runTransaction(db,async tx=>{
      const ref=walletRef(user),snap=await tx.get(ref),data=snap.exists()?(snap.data()||{}):{};
      const sameDay=data.coinRewardDate===today;
      const claims=sameDay&&Array.isArray(data.coinRewardClaims)?data.coinRewardClaims.filter(x=>typeof x==='string'):[];
      const coins=Math.max(0,Math.floor(Number(data.coins)||0));
      progress=Math.max(0,Math.min(4,Math.floor(Number(data.retryCoinProgress)||0)));
      if(claims.includes(claim)){newCoins=coins;return;}
      claims.push(claim);counted=true;progress+=1;newCoins=coins;
      if(progress>=5){progress-=5;newCoins=coins+1;awarded=true;}
      tx.set(ref,{coins:newCoins,retryCoinProgress:progress,coinRewardDate:today,coinRewardClaims:claims,coinUpdatedAt:serverTimestamp(),coinSchemaVersion:1},{merge:true});
    });
    if(awarded)toast('🪙 +1　リトライ5問達成！');
    else if(counted)toast(`リトライコインまで ${5-progress}問`);
    return {awarded,counted,progress,coins:newCoins,reason:counted?'counted':'already-today'};
  }catch(error){console.error('Retry coin reward failed',error);return {awarded:false,counted:false,reason:'error',error};}
}

window.EnglishPlayroomCoins=Object.freeze({
  recordLearningActivity,
  awardOncePerDay,
  recordRetryAttempt,
  awardAteru:roundId=>awardOncePerDay('ateru',`round-${cleanPart(roundId)}`,'アテル5問クリア！'),
  awardBasic:stageId=>awardOncePerDay('basic-quest',`stage-${cleanPart(stageId)}`,'Basic Questクリア！'),
  awardCloze:themeId=>awardOncePerDay('eiken-cloze',`theme-${cleanPart(themeId)}`,'空所補充に挑戦！'),
  awardTitle:themeId=>awardOncePerDay('eiken-title',`theme-${cleanPart(themeId)}`,'タイトルに挑戦！'),
  awardTask:themeId=>awardOncePerDay('task-quest',`theme-${cleanPart(themeId)}`,'Task-Questに挑戦！'),
  awardPre2A:themeId=>awardOncePerDay('eiken-pre2-interview-a',`theme-${cleanPart(themeId)}`,'準2級面接Aに挑戦！')
});
