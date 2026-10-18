import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {GAME_NAME,COURSES,Round,LIMIT_MS,WARNING_MS} from '../word-breaker-engine.js';
import {DEMO} from '../word-breaker-data.js';
const raw=fs.readFileSync(new URL('../word-breaker.js',import.meta.url),'utf8');
const source=raw.slice(0,raw.indexOf('// Load Firebase independently:')).replace(/^import .*;\r?\n/gm,'');
function harness({mobile=true,reduced=false,viewport=true}={}){
 const timers=new Map(),frames=new Map(),els={},viewEvents={},windowEvents={};let id=0,now=0,focuses=0;
 const document={activeElement:null,hidden:false,title:'',querySelectorAll:()=>[],addEventListener(){}};
 function element(){let disabled=false;const classes=new Set();return {value:'',textContent:'',hidden:false,open:true,children:[],listeners:{},style:{setProperty(k,v){this[k]=v;}},classList:{add(...keys){keys.forEach(k=>classes.add(k));},remove(...keys){keys.forEach(k=>classes.delete(k));},toggle(k,on){if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)},
  get disabled(){return disabled;},set disabled(value){disabled=value;if(value&&document.activeElement===this)document.activeElement=null;},
  focus(options){document.activeElement=this;this.focusOptions=options;focuses++;},select(){document.activeElement=this;},
  addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};}
 document.getElementById=id=>els[id]??=(element());document.createElement=()=>element();document.documentElement=element();
 const visualViewport=viewport?{height:760,offsetTop:0,addEventListener:(name,fn)=>{viewEvents[name]=fn;}}:null;
 const context={document,window:{visualViewport,innerHeight:760,addEventListener:(name,fn)=>{windowEvents[name]=fn;}},GAME_NAME,COURSES,Round,LIMIT_MS,WARNING_MS,DEMO,
  mountRecords:()=>({setCourse(){}}),loadVocabulary:async()=>({junior1:DEMO}),matchMedia:query=>({matches:query.includes('reduced')?reduced:mobile}),localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now},
  requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),console,Promise};
 vm.createContext(context);vm.runInContext(source,context);
 const runTimers=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}};
 const runFrames=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn(now);}};
 const answer=()=>vm.runInContext('round.current.answers[0]',context);
 const score=()=>vm.runInContext('round.score',context);
 const submit=()=>els['answer-form'].listeners.submit({preventDefault(){},isComposing:false});
 return {context,document,els,visualViewport,viewEvents,windowEvents,runTimers,runFrames,answer,score,submit,focuses:()=>focuses,setNow:value=>{now=value;}};
}
test('correct answers keep focus and editable input through consecutive questions',async()=>{
 const h=harness();await h.context.start('demo');const input=h.els.answer;
 assert.equal(h.document.activeElement,input);assert.equal(input.focusOptions.preventScroll,true);
 const focused=h.focuses();input.value=h.answer();h.submit();assert.equal(h.score(),1);
 assert.equal(input.disabled,false);assert.equal(h.document.activeElement,input);assert.equal(input.value,'');
 assert.equal(h.els.submit.disabled,true);
 input.value='次の入力';h.submit();assert.equal(h.score(),1,'transition submission cannot score twice');
 h.runTimers();assert.equal(input.value,'次の入力');assert.equal(h.document.activeElement,input);assert.equal(h.focuses(),focused);
 assert.equal(h.els.submit.disabled,false);
 input.value=h.answer();h.submit();h.runTimers();assert.equal(h.score(),2);assert.equal(input.disabled,false);
});
test('next question does not reopen a keyboard the user dismissed',async()=>{
 const h=harness();await h.context.start('demo');h.els.answer.value=h.answer();h.submit();
 h.document.activeElement=null;h.runTimers();assert.equal(h.document.activeElement,null);
});
test('Japanese IME confirmation is not treated as an answer submission',async()=>{
 const h=harness();await h.context.start('demo');h.els.answer.value=h.answer();
 h.els.answer.listeners.compositionstart();h.submit();assert.equal(h.score(),0);
 let prevented=false;h.els.answer.listeners.keydown({key:'Enter',isComposing:true,preventDefault(){prevented=true;}});assert.equal(prevented,true);
 h.els.answer.listeners.compositionend();h.submit();assert.equal(h.score(),1);
});
test('touch submit keeps keyboard focus; wrong answers and timeout allow continuous input',async()=>{
 const h=harness();await h.context.start('demo');let prevented=false;
 h.els.submit.listeners.pointerdown({pointerType:'touch',preventDefault(){prevented=true;}});assert.equal(prevented,true);
 h.els.answer.value='ぜんぜん違う';h.submit();assert.equal(h.score(),0);assert.equal(h.document.activeElement,h.els.answer);assert.equal(h.els.answer.disabled,false);
 h.setNow(LIMIT_MS);h.context.tick(LIMIT_MS);assert.equal(h.els.life.textContent,'♥ ');assert.equal(h.els.answer.disabled,false);h.runTimers();
 assert.equal(h.document.activeElement,h.els.answer);h.setNow(LIMIT_MS*2);h.context.tick(LIMIT_MS*2);h.runTimers();
 assert.equal(h.els.result.hidden,false);assert.equal(h.els.answer.disabled,true);assert.equal(h.document.documentElement.classList.contains('word-breaker-playing'),false);
});
test('visual viewport follows keyboard height, pan and rotation; fallback works without API',async()=>{
 const h=harness();await h.context.start('demo');h.visualViewport.height=320;h.visualViewport.offsetTop=110;h.viewEvents.resize();h.viewEvents.scroll();h.runFrames();
 assert.equal(h.document.documentElement.classList.contains('word-breaker-compact'),true);assert.equal(h.document.documentElement.style['--wb-visible-height'],'320px');assert.equal(h.document.documentElement.style['--wb-visible-top'],'110px');
 assert.equal(h.els['previous-feedback'].open,false);h.context.finish(true);assert.equal(h.els.result.hidden,false);
 const fallback=harness({viewport:false,mobile:false});await fallback.context.start('demo');assert.equal(fallback.document.documentElement.style['--wb-visible-height'],'760px');assert.equal(fallback.els['previous-feedback'].open,true);
});
test('iOS focus happens before asynchronous account lookup',async()=>{
 const h=harness();await Promise.resolve();let release;h.context.testStore={currentAccount:()=>new Promise(resolve=>{release=resolve;})};vm.runInContext('store=testStore',h.context);
 const starting=h.context.start('junior1');assert.equal(h.document.activeElement,h.els.answer);assert.equal(h.els.answer.disabled,false);
 release(null);await starting;assert.ok(h.els.word.textContent);assert.equal(h.els.submit.disabled,false);
});
