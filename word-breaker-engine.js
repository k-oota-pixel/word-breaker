export const GAME_NAME = 'WORD BREAKER';
export const COURSES = [ ['junior1','中1'], ['junior2','中2'], ['junior3','中3'], ['high1','高1'], ['high2','高2'], ['basic','基礎英単語'] ];
export const LIMIT_MS = 17000;
export const WARNING_MS = 12000;

export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0)-0x60))
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

// Harmless spelling/orthography differences should not make a learner miss.
// Keep this conservative: these are equivalent spellings, not fuzzy matching.
function canonical(value) {
  let s=normalize(value);
  for (const [pattern,replacement] of [
    [/御飯|ご飯/g,'ごはん'],
    [/子供/g,'子ども'],
    [/友だち/g,'友達'],
    [/綺麗/g,'きれい'],
    [/素晴らしい/g,'すばらしい'],
    [/可愛い/g,'かわいい'],
    [/美味しい/g,'おいしい'],
    [/嬉しい/g,'うれしい'],
    [/様々/g,'さまざま']
  ]) s=s.replace(pattern,replacement);
  return s;
}

// Common everyday paraphrases that are clearly the same classroom meaning.
// These groups deliberately stay small and explicit so unrelated substrings
// (e.g. 光 in 観光) and negated answers never become correct by accident.
const MEANING_GROUPS = [
  ['朝食','朝ごはん','あさごはん','朝飯','あさめし'],
  ['昼食','昼ごはん','ひるごはん','昼飯','ひるめし'],
  ['夕食','晩ごはん','ばんごはん','夜ごはん','よるごはん','夕飯','ゆうはん','晩飯','ばんめし','夜飯','よるめし'],
  ['怒った','怒っている','怒ってる','おこった','おこっている','おこってる'],
  ['腹を立てた','腹を立てている','腹を立ててる','はらをたてた','はらをたてている','はらをたててる'],
  ['疲れた','疲れている','疲れてる','つかれた','つかれている','つかれてる'],
  ['退屈した','退屈している','退屈してる','たいくつした','たいくつしている','たいくつしてる']
];
const MEANING_INDEX = new Map();
for (const group of MEANING_GROUPS) {
  const normalized=[...new Set(group.map(canonical).filter(Boolean))];
  for (const item of normalized) MEANING_INDEX.set(item,normalized);
}
function equivalents(value) {
  const v=canonical(value);
  return MEANING_INDEX.get(v)||[v];
}

// Only grammatical wrappers may surround a meaning. Unrestricted substring
// matching would accept 光 in 観光, or 重要 in 重要ではない.
function forms(value) {
  const result = new Set([canonical(value)]);
  const queue = [...result];
  const prefix = /^(?:とても|非常に|すごく|かなり|たいへん|大変|何かを|なにかを|何か|なにか|人を|ひとを|を|が)/;
  const suffix = /(?:という意味|といういみ|ということ|ことです|こと|ものです|もの|なのです|なんです|でした|です|である|だ|な|に|していました|していた|しています|している|しました|します|する|をする|で)$/;
  while (queue.length) {
    const s = queue.shift();
    for (const t of [s.replace(prefix,''),s.replace(suffix,'')]) {
      if (t && !result.has(t)) { result.add(t); queue.push(t); }
    }
  }
  return result;
}
export function judge(entry, input) {
  if (!normalize(input)) return false;
  const supplied = forms(input);
  return [...entry.answers, ...(entry.keywords || [])].some(answer => {
    const candidates=new Set(equivalents(answer));
    // Only shorten known grammatical endings on mixed kanji expressions.
    // Normalized katakana nouns (カナダ, バナナ) must never lose their ends.
    if (/[一-龯]/u.test(answer)) {
      for (const v of equivalents(answer.replace(/(?:である|です|する|な|の)$/u,''))) candidates.add(v);
      if (/い$/u.test(answer)) for (const v of equivalents(answer.slice(0,-1)+'く')) candidates.add(v);
    }
    return [...candidates].some(v=>v && supplied.has(v));
  });
}
export function cleanEntries(entries) {
  const seen = new Set();
  return entries.map(e => {
    const word = String(e.word || '').normalize('NFKC').replace(/\s*[（(].*$/,'').replace(/[～~]/g,'').trim();
    return {...e, word, answers: (e.answers || []).filter(x => typeof x === 'string' && x.trim()), keywords: (e.keywords || []).filter(x => typeof x === 'string' && x.trim())};
  }).filter(e => {
    const key = e.word.toLowerCase();
    if (!key || key === 'nat' || seen.has(key) || !e.answers.length) return false;
    seen.add(key); return true;
  });
}
export class Round {
  constructor(words, random = Math.random) {
    if (!words.length) throw new Error('語彙データがありません');
    this.words=words; this.random=random; this.bag=[]; this.score=0;
    this.combo=0; this.bestCombo=0; this.life=2; this.rewards=0; this.active=false;
  }
  next(now) {
    if (!this.life) return;
    if (!this.bag.length) {
      this.bag=[...this.words];
      for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
      if(this.bag.length>1 && this.bag.at(-1)===this.current) [this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];
    }
    this.current=this.bag.pop(); this.started=now; this.active=true; this.lastAnswer='';
  }
  resolve(input, now) {
    if (!this.active) return {type:'ignored'};
    if (now-this.started>=LIMIT_MS) return this.timeout();
    this.lastAnswer=input;
    if (!judge(this.current,input)) return {type:'wrong'};
    this.active=false; this.score++; this.combo++; this.bestCombo=Math.max(this.bestCombo,this.combo);
    const reward=Number(this.score===10)+Number(this.combo%20===0);
    this.rewards+=reward;
    return {type:'correct',reward};
  }
  timeout() {
    if(!this.active) return {type:'ignored'};
    this.active=false; this.life--; this.combo=0;
    return {type:this.life?'timeout':'over'};
  }
}
