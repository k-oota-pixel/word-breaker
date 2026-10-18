import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {getFirestore,doc,getDoc} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyAllLjPcGhygMSEIORXhKZOaDjYvpSJ4EQ",
  authDomain:"eiken-retry.firebaseapp.com",
  projectId:"eiken-retry",
  storageBucket:"eiken-retry.firebasestorage.app",
  messagingSenderId:"231308672297",
  appId:"1:231308672297:web:5e8b8ede3a0246c2318b38",
  measurementId:"G-8CWR37L5K0"
};
const API='https://task-quest.onrender.com';
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
let generation=0,currentNickname='';

function normalizeNickname(value){return String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');}
function validNickname(value){const n=normalizeNickname(value),length=[...n].length;return length>=1&&length<=20&&!/[\u0000-\u001f\u007f]/.test(n);}
function profileRef(user){return doc(db,'users',user.uid,'apps','english-playroom');}
function publish(nickname){
  currentNickname=normalizeNickname(nickname);
  document.documentElement.dataset.englishPlayroomNickname=currentNickname;
  window.EnglishPlayroomProfile=Object.freeze({nickname:currentNickname});
  window.dispatchEvent(new CustomEvent('english-playroom-profile',{detail:{nickname:currentNickname}}));
}
function ensureUi(){
  let overlay=document.getElementById('englishPlayroomNicknameOverlay');
  if(overlay)return overlay;
  const style=document.createElement('style');
  style.textContent=`#englishPlayroomNicknameOverlay{position:fixed;inset:0;z-index:2147483647;background:#10251fcc;display:grid;place-items:center;padding:18px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}#englishPlayroomNicknameOverlay[hidden]{display:none}#englishPlayroomNicknameCard{width:min(430px,100%);background:#fff;color:#193d38;border-radius:20px;padding:22px;box-shadow:0 24px 80px #0006}#englishPlayroomNicknameCard h2{margin:0 0 8px;font-size:22px}#englishPlayroomNicknameCard p{margin:0 0 14px;color:#64756e;font-size:13px;line-height:1.65}#englishPlayroomNicknameCard label{display:block;font-size:12px;font-weight:850;margin-bottom:6px}#englishPlayroomNicknameInput{width:100%;border:1px solid #cbd8d0;border-radius:12px;padding:11px 12px;font:inherit;font-size:16px;outline:none}#englishPlayroomNicknameInput:focus{border-color:#4a8a72;box-shadow:0 0 0 3px #4a8a7222}#englishPlayroomNicknameHelp{font-size:10.5px;color:#819087;margin-top:6px}#englishPlayroomNicknameError{min-height:20px;margin-top:8px;color:#a4463a;font-size:11px;font-weight:750}#englishPlayroomNicknameSubmit{width:100%;margin-top:6px;border:0;border-radius:12px;background:#246a57;color:#fff;padding:11px 13px;font:inherit;font-weight:900;cursor:pointer}#englishPlayroomNicknameSubmit:disabled{opacity:.55;cursor:default}`;
  document.head.appendChild(style);
  overlay=document.createElement('div');
  overlay.id='englishPlayroomNicknameOverlay';overlay.hidden=true;
  overlay.innerHTML=`<div id="englishPlayroomNicknameCard" role="dialog" aria-modal="true" aria-labelledby="englishPlayroomNicknameTitle"><h2 id="englishPlayroomNicknameTitle">ニックネームを登録</h2><p>先生が学習状況を確認するときに使う名前です。管理画面にはGmailアドレスを表示しません。</p><form id="englishPlayroomNicknameForm"><label for="englishPlayroomNicknameInput">ニックネーム</label><input id="englishPlayroomNicknameInput" maxlength="20" autocomplete="off" placeholder="例：2F12 Haru" required><div id="englishPlayroomNicknameHelp">1〜20文字。ほかの利用者と同じ名前は登録できません。</div><div id="englishPlayroomNicknameError" role="alert"></div><button id="englishPlayroomNicknameSubmit" type="submit">この名前で登録する</button></form></div>`;
  document.body.appendChild(overlay);
  return overlay;
}
function hideUi(){const el=document.getElementById('englishPlayroomNicknameOverlay');if(el)el.hidden=true;}
async function registerNickname(user,nickname){
  const token=await user.getIdToken();
  const res=await fetch(API+'/api/profile/nickname',{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({nickname})});
  let body={};try{body=await res.json();}catch{}
  if(!res.ok)throw Error(body.error||`登録に失敗しました (${res.status})`);
  return normalizeNickname(body.nickname||nickname);
}
async function requireNickname(user,myGeneration){
  let data={};
  try{const snap=await getDoc(profileRef(user));data=snap.exists()?(snap.data()||{}):{};}catch(error){console.error('Nickname profile read failed',error);}
  if(myGeneration!==generation||auth.currentUser?.uid!==user.uid)return;
  const existing=normalizeNickname(data.nickname);
  if(validNickname(existing)){publish(existing);hideUi();return;}
  const overlay=ensureUi(),form=overlay.querySelector('#englishPlayroomNicknameForm'),input=overlay.querySelector('#englishPlayroomNicknameInput'),errorEl=overlay.querySelector('#englishPlayroomNicknameError'),submit=overlay.querySelector('#englishPlayroomNicknameSubmit');
  overlay.hidden=false;input.value='';errorEl.textContent='';submit.disabled=false;queueMicrotask(()=>input.focus());
  form.onsubmit=async event=>{
    event.preventDefault();
    const nickname=normalizeNickname(input.value);
    if(!validNickname(nickname)){errorEl.textContent='1〜20文字でニックネームを入力してください。';input.focus();return;}
    submit.disabled=true;input.disabled=true;errorEl.textContent='登録しています…';
    try{
      const saved=await registerNickname(user,nickname);
      if(myGeneration!==generation||auth.currentUser?.uid!==user.uid)return;
      publish(saved);overlay.hidden=true;
    }catch(error){
      if(myGeneration!==generation)return;
      errorEl.textContent=error.message||'登録できませんでした。';submit.disabled=false;input.disabled=false;input.focus();
    }
  };
}

onAuthStateChanged(auth,user=>{
  const myGeneration=++generation;
  currentNickname='';delete document.documentElement.dataset.englishPlayroomNickname;
  if(!user){hideUi();return;}
  requireNickname(user,myGeneration).catch(error=>console.error('Nickname profile failed',error));
});

export function getRegisteredNickname(){return currentNickname;}

queueMicrotask(()=>import('./version-badge.js?v=1.5.7').catch(error=>console.error('Version badge failed to load',error)));
