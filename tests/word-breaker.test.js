import test from 'node:test';
import assert from 'node:assert/strict';
import {judge,normalize,cleanEntries,Round,LIMIT_MS,WARNING_MS} from '../word-breaker-engine.js';
import {DEMO,parseVocabulary} from '../word-breaker-data.js';
import {readFileSync} from 'node:fs';
const important=DEMO.find(e=>e.word==='important'),light=DEMO.find(e=>e.word==='light');
test('Japanese normalization and grammatical variants, with semantic boundaries',()=>{
  for(const answer of ['重要な','大事','だいじ','とても大切です','重要なこと','　大切、です！'])assert.ok(judge(important,answer),answer);
  for(const answer of ['必要','重要ではない','大事じゃない','不重要','大事ではありません','大切さはない','観光',''])assert.equal(judge(important,answer),false,answer);
  for(const answer of ['光','ひかり','明かり','軽い','軽く','かるく'])assert.ok(judge(light,answer),answer);
  for(const answer of ['観光','日光浴','重い','軽くない','光らない'])assert.equal(judge(light,answer),false,answer);
  assert.equal(normalize(' アカリ！ '),'あかり');
});
test('common everyday paraphrases are accepted without unsafe fuzzy matches',()=>{
  const word=name=>vocabulary.basic.find(e=>e.word===name)||Object.values(vocabulary).flat().find(e=>e.word===name);
  const breakfast=word('breakfast'),lunch=word('lunch'),dinner=word('dinner'),angry=word('angry'),tired=word('tired');
  for(const answer of ['朝ごはん','朝ご飯','朝御飯','朝飯','あさごはん','朝ごはんです'])assert.ok(judge(breakfast,answer),answer);
  for(const answer of ['朝','ごはん','昼ごはん','朝ごはんじゃない'])assert.equal(judge(breakfast,answer),false,answer);
  for(const answer of ['昼ごはん','昼御飯','ひるめし'])assert.ok(judge(lunch,answer),answer);
  for(const answer of ['晩ごはん','夜ご飯','夕飯','ばんめし'])assert.ok(judge(dinner,answer),answer);
  for(const answer of ['怒っている','怒ってる','おこっている','腹を立てている'])assert.ok(judge(angry,answer),answer);
  assert.equal(judge(angry,'怒っていない'),false);
  for(const answer of ['疲れている','疲れてる'])assert.ok(judge(tired,answer),answer);
  assert.ok(judge(word('child'),'子供'));
  assert.ok(judge(word('beautiful'),'綺麗'));
  assert.ok(judge(word('delicious'),'美味しい'));
  assert.ok(judge(word('cute'),'可愛い'));
});
test('cleanup deduplicates within course and excludes unknown nat',()=>{
  const result=cleanEntries(['human ～','human','usual ～','nat','elderly （失礼な場合olderの形容詞を使う）'].map(word=>({word,answers:['訳']})));
  assert.deepEqual(result.map(e=>e.word),['human','usual','elderly']);
});
test('wrong answers are retryable, deadlines are strict and only one life is lost',()=>{
  const round=new Round([important]);round.next(100);
  assert.equal(round.resolve('必要',200).type,'wrong');assert.equal(round.life,2);
  assert.equal(round.resolve('だいじ',17099).type,'correct');assert.equal(round.score,1);
  assert.equal(round.resolve('重要',17100).type,'ignored');
  round.next(20000);assert.equal(round.resolve('重要',20000+LIMIT_MS).type,'timeout');
  assert.equal(round.life,1);assert.equal(round.combo,0);assert.equal(round.timeout().type,'ignored');
  round.next(40000);assert.equal(round.timeout().type,'over');assert.equal(round.life,0);
  assert.equal(LIMIT_MS-WARNING_MS,5000);
});
test('pass costs exactly one life, resets combo, preserves score and cannot double-charge',()=>{
  const round=new Round([important]);
  round.score=3;round.combo=3;round.bestCombo=3;round.next(100);
  assert.equal(round.pass().type,'pass');assert.equal(round.life,1);assert.equal(round.combo,0);assert.equal(round.score,3);assert.equal(round.bestCombo,3);
  assert.equal(round.pass().type,'ignored');assert.equal(round.timeout().type,'ignored');assert.equal(round.life,1);
  round.next(200);assert.equal(round.pass().type,'pass');assert.equal(round.life,0);
  assert.equal(round.pass().type,'ignored');assert.equal(round.timeout().type,'ignored');assert.equal(round.life,0);
});
test('coin rewards follow total scores 10, 25, 40, 55 and survive combo resets',()=>{
  const round=new Round([important]);
  const correct=()=>{round.next(0);return round.resolve('大切',1);};
  for(let i=1;i<=80;i++){const r=correct();assert.equal(r.reward,i>=10&&(i-10)%15===0?1:0);}
  assert.equal(round.rewards,5);assert.equal(round.bestCombo,80);
  round.next(0);round.timeout();assert.equal(round.combo,0);
  for(let i=0;i<20;i++)correct();assert.equal(round.rewards,7);assert.equal(round.score,100);assert.equal(round.bestCombo,80);
});
test('shuffle cycles continue without adjacent duplicate at cycle boundaries',()=>{
  const round=new Round(DEMO,()=>0.2);let previous;
  for(let i=0;i<DEMO.length*3;i++){round.next(i);assert.notEqual(round.current,previous);previous=round.current;round.active=false;}
});
const master=JSON.parse(readFileSync(new URL('../monstudy_vocab_master.json',import.meta.url),'utf8'));
const vocabulary=parseVocabulary(master);
test('complete supplied six-course master has expected counts and valid unique entries',()=>{
  assert.deepEqual(Object.values(vocabulary).map(c=>c.length),[272,344,340,420,482,619]);
  for(const entries of Object.values(vocabulary)){
    assert.equal(new Set(entries.map(e=>e.word.toLowerCase())).size,entries.length);
    for(const e of entries){assert.ok(e.answers.length && e.keywords.length,e.word);assert.ok(!/[～~（）]/.test(e.word),e.word);assert.notEqual(e.word,'nat');}
  }
  assert.ok(vocabulary.high2.find(e=>e.word==='elderly').note);
});
test('all declared meanings and aliases are accepted with real master readings',()=>{
  for(const course of Object.values(vocabulary))for(const entry of course)for(const answer of [...entry.answers,...entry.keywords])assert.ok(judge(entry,answer),`${entry.word}: ${answer}`);
  const light=vocabulary.basic.find(e=>e.word==='light');
  for(const answer of ['ひかり','あかり','かるい','かるく','とても軽いです'])assert.ok(judge(light,answer),answer);
  assert.equal(judge(light,'観光'),false);
  assert.ok(judge(vocabulary.junior1.find(e=>e.word==='egg'),'たまご'));
});
test('noun endings and spelling mistakes cannot collapse to unrelated words',()=>{
  assert.equal(judge({answers:['カナダ'],keywords:[]},'か'),false);
  assert.equal(judge({answers:['バナナ'],keywords:[]},'ば'),false);
  assert.equal(judge({answers:['ひらがな'],keywords:[]},'ひらが'),false);
  assert.ok(judge({answers:['勉強する'],keywords:['勉強']},'勉強しています'));
});
test('ambiguous kanji readings use the English meaning, including common numeric months',()=>{
  const word=name=>vocabulary.basic.find(e=>e.word===name)||Object.values(vocabulary).flat().find(e=>e.word===name);
  for(const [name,answer] of [['water','みず'],['rice','こめ'],['tree','き'],['fire','ひ'],['April','しがつ'],['minute','ふん'],['empty','から'],['twice','にど']])assert.ok(judge(word(name),answer),`${name}: ${answer}`);
  for(const [name,answer] of [['empty','そら'],['gold','かね'],['corner','つの'],['minute','ぶん']])assert.equal(judge(word(name),answer),false,`${name}: ${answer}`);
});
