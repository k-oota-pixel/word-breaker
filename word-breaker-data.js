import { COURSES, cleanEntries } from './word-breaker-engine.js?v=1.5';
// Small practice fixture, also used by engine tests. Course play uses the master.
export const DEMO = cleanEntries([
  {word:'important',answers:['重要な','大切な','大事な'],keywords:['じゅうよう','たいせつ','だいじ']},
  {word:'light',answers:['光','明かり','軽い'],keywords:['ひかり','あかり','かるい','軽く','かるく']},
  {word:'kind',answers:['親切な','優しい','種類'],keywords:['しんせつ','やさしい','しゅるい']},
  {word:'run',answers:['走る','経営する'],keywords:['はしる','けいえい']},
  {word:'study',answers:['勉強する','研究する'],keywords:['べんきょう','けんきゅう']},
  {word:'bank',answers:['銀行','土手'],keywords:['ぎんこう','どて']},
  {word:'spring',answers:['春','ばね','泉'],keywords:['はる','いずみ']},
  {word:'right',answers:['右','正しい','権利'],keywords:['みぎ','ただしい','けんり']},
  {word:'watch',answers:['見る','腕時計'],keywords:['みる','うでどけい']},
  {word:'like',answers:['好き','好む','のような'],keywords:['すき','このむ']},
  {word:'elderly',answers:['高齢の','年配の'],keywords:['こうれい','ねんぱい'],note:'元データの用法注記を分離'},
  {word:'fair',answers:['公平な','公正な','品評会'],keywords:['こうへい','こうせい','ひんぴょうかい']},
  {word:'patient',answers:['患者','忍耐強い'],keywords:['かんじゃ','にんたいづよい']},
  {word:'current',answers:['現在の','流れ','電流'],keywords:['げんざい','ながれ','でんりゅう']},
  {word:'charge',answers:['料金','請求する','充電する','非難する'],keywords:['りょうきん','せいきゅう','じゅうでん','ひなん']},
  {word:'match',answers:['試合','一致する','マッチ'],keywords:['しあい','いっち']},
  {word:'matter',answers:['問題','物質','重要である'],keywords:['もんだい','ぶっしつ','じゅうよう']},
  {word:'suit',answers:['似合う','適する','スーツ'],keywords:['にあう','てきする']},
  {word:'appeal',answers:['訴える','魅力','上訴する'],keywords:['うったえる','みりょく','じょうそ']},
  {word:'stock',answers:['在庫','株式','蓄え'],keywords:['ざいこ','かぶしき','たくわえ']}
]);
export async function loadVocabulary() {
  const response=await fetch('./monstudy_vocab_master.json?v=1.5');
  if (!response.ok) throw new Error('単語データを読み込めませんでした。再読み込みするか操作体験をご利用ください。');
  const data=await response.json();
  return parseVocabulary(data);
}
export function parseVocabulary(data) {
  const source=data.levels || data.courses || data;
  const result={};
  for (const [id,label] of COURSES) {
    const raw=Array.isArray(source)?source.find(c=>c.id===id || c.name===label || c.label===label):source[id] || source[label];
    const entries=Array.isArray(raw)?raw:raw?.words || raw?.entries;
    if (!Array.isArray(entries)) throw new Error(`${label}の語彙データを確認してください`);
    result[id]=cleanEntries(entries);
    if (!result[id].length) throw new Error(`${label}の語彙が空です`);
  }
  return result;
}
