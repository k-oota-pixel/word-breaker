import { auth, db, authReady, walletRef } from './coin-reward.js?v=2.1.3';
import { runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

const RECORD_API='https://task-quest.onrender.com/api/word-breaker/records';
export async function currentAccount() { await authReady; return auth.currentUser; }
// Receipts share the already-authorized wallet document. A run must be registered
// before rewarding it. Evicted receipts cannot be recreated by a retry.
export async function openRun(id, course, uid) {
  const user=await currentAccount();
  if (!user || user.uid!==uid) return false;
  await runTransaction(db, async tx => {
    const ref=walletRef(user), snap=await tx.get(ref), data=snap.data() || {};
    const receipts={...(data.wordBreakerRuns || {})};
    if (!receipts[id]) receipts[id]={course,earned:0,opened:Date.now()};
    const sorted=Object.keys(receipts).sort((a,b)=>receipts[b].opened-receipts[a].opened);
    for (const old of sorted.slice(64)) delete receipts[old];
    tx.set(ref,{wordBreakerRuns:receipts},{mergeFields:['wordBreakerRuns']});
  });
  return true;
}
export async function saveRun({id,course,uid,rewards,score,bestCombo}) {
  const user=await currentAccount();
  if (!user || user.uid!==uid) throw new Error('プレイ開始時のアカウントでログインしてください');
  let earned=0;
  await runTransaction(db, async tx => {
    const ref=walletRef(user),snap=await tx.get(ref),data=snap.data() || {};
    const receipts={...(data.wordBreakerRuns || {})}, receipt=receipts[id];
    if (!receipt || receipt.course!==course) throw new Error('このプレイの保存期限が切れました');
    earned=Math.max(receipt.earned,rewards);
    receipts[id]={...receipt,earned,updatedAt:Date.now()};
    const previous=data.wordBreakerBests?.[course] || {};
    tx.set(ref,{
      coins:Math.max(0,Math.floor(Number(data.coins)||0))+earned-receipt.earned,
      coinUpdatedAt:serverTimestamp(),
      wordBreakerLastPlayedDate:(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})(),
      wordBreakerRuns:receipts,
      wordBreakerBests:{[course]:{score:Math.max(previous.score||0,score),combo:Math.max(previous.combo||0,bestCombo)}}
    },{mergeFields:['coins','coinUpdatedAt','wordBreakerLastPlayedDate','wordBreakerRuns',`wordBreakerBests.${course}`]});
  });
  return earned;
}
export async function publishRecord(course) {
  const user=await currentAccount();
  if (!user) return false;
  const token=await user.getIdToken();
  const response=await fetch(RECORD_API,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({course}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('ランキングを更新できませんでした');
  return response.json();
}
export async function readBests() {
  const user=await currentAccount(); if (!user) return {};
  // Transactional read uses the same SDK surface as the existing reward module.
  return runTransaction(db,async tx => (await tx.get(walletRef(user))).data()?.wordBreakerBests || {});
}
