export const GAME_NAME = 'WORD BREAKER';
export const COURSES = [ ['junior1','中1'], ['junior2','中2'], ['junior3','中3'], ['high1','高1'], ['high2','高2'], ['basic','基礎英単語'] ];
export const LIMIT_MS = 17000;
export const WARNING_MS = 12000;

export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0)-0x60))
    .replace(/[\s\p{P}\p{S}]/gu, '');
}
// Only grammatical wrappers may surround a meaning. Unrestricted substring
// matching would accept 光 in 観光, or 重要 in 重要ではない.
function forms(value) {
  const result = new Set([normalize(value)]);
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
    const candidates=new Set([normalize(answer)]);
    // Only shorten known grammatical endings on mixed kanji expressions.
    // Normalized katakana nouns (カナダ, バナナ) must never lose their ends.
    if (/[一-龯]/u.test(answer)) {
      candidates.add(normalize(answer.replace(/(?:である|です|する|な|の)$/u,'')));
      if (/い$/u.test(answer)) candidates.add(normalize(answer.slice(0,-1)+'く'));
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
