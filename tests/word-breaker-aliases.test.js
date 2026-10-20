import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {judge, cleanEntries} from '../word-breaker-engine.js';
import {parseVocabulary} from '../word-breaker-data.js';
import {WORD_ALIASES} from '../word-breaker-aliases.js';

const master = JSON.parse(readFileSync(new URL('../monstudy_vocab_master.json', import.meta.url), 'utf8'));
const vocabulary = parseVocabulary(master);
const entries = Object.values(vocabulary).flat();

test('reviewed aliases apply to every occurrence in all six courses', () => {
  for (const [word, aliases] of Object.entries(WORD_ALIASES)) {
    const matches = entries.filter(e => e.word.toLowerCase() === word);
    assert.ok(matches.length, `Unregistered alias key: ${word}`);
    for (const entry of matches) for (const alias of aliases) {
      assert.ok(judge(entry, alias), `${entry.id}: ${alias}`);
      assert.ok(judge(entry, `${alias}です`), `${entry.id}: ${alias}です`);
    }
  }
});

test('colorful and give accept natural answers in every registered course', () => {
  for (const entry of entries.filter(e => ['colorful', 'give'].includes(e.word))) {
    const answers = entry.word === 'colorful'
      ? ['カラフル', 'ｶﾗﾌﾙ', 'からふる', 'カラフルな', '色鮮やか', '色とりどり']
      : ['あげる', 'くれる', '渡す', '何かをあげる', 'あげるという意味'];
    for (const answer of answers) assert.ok(judge(entry, answer), `${entry.id}: ${answer}`);
  }
});

test('negated and unrelated surrounding text never matches registered meanings', () => {
  // Include existing answers/keywords as well as new aliases, across all courses.
  for (const entry of entries) for (const answer of new Set([...entry.answers, ...entry.keywords])) {
    for (const input of [`${answer}ではない`, `${answer}じゃない`, `${answer}ではありません`,
      `${answer}とは違う`, `無関係${answer}`, `${answer}無関係`]) {
      assert.equal(judge(entry, input), false, `${entry.id}: ${input}`);
    }
  }
});

test('word-specific meanings do not leak into homophones, opposites or substrings', () => {
  const cases = {
    colorful: ['色', 'カラー', 'フル', '無色', 'カラフルじゃない', 'カラフルさがない'],
    give: ['あげない', 'くれない', 'もらう', '借りる', '上げる', '揚げる', '投げる', 'あげ'],
    receive: ['あげる', '貸す'],
    raise: ['くれる'],
    lend: ['借りる'],
    borrow: ['貸す'],
    light: ['観光', '日光浴', '重い'],
    sleep: ['寝ない', '起きる'],
    repair: ['直さない', '壊す'],
    hungry: ['おなか', 'おなかがすいていない'],
    empty: ['空港', 'そら', '満杯'],
    useful: ['役立たない', '役に立たない'],
    dull: ['つまる'],
  };
  for (const [word, inputs] of Object.entries(cases)) {
    const matches = entries.filter(e => e.word === word);
    assert.ok(matches.length, word);
    for (const entry of matches) for (const input of inputs)
      assert.equal(judge(entry, input), false, `${entry.id}: ${input}`);
  }
  // Negative wording can itself be the correct definition; no blanket "ない" ban.
  for (const [word, input] of [['useless', '役立たない'], ['dull', 'つまらない'],
    ['unknown', '知られていない'], ['unusual', '普通でない']]) {
    assert.ok(judge(entries.find(e => e.word === word), input), `${word}: ${input}`);
  }
});

test('alias enrichment is idempotent and does not mutate source data', () => {
  const source = [{word:'give', answers:['与える'], keywords:['あたえる']}];
  const snapshot = structuredClone(source);
  const once = cleanEntries(source);
  assert.deepEqual(cleanEntries(once), once);
  assert.deepEqual(source, snapshot);
  assert.deepEqual(cleanEntries([{word:'unlisted', answers:['与える']}])[0].keywords, []);
});
