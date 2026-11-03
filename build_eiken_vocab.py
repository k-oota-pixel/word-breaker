#!/usr/bin/env python3
import csv
import io
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MASTER_PATH = Path('monstudy_vocab_master.json')
OUT_PATH = Path('eiken_vocab_master.json')
SAMPLE_PATH = Path('eiken_vocab_master_samples.txt')
README_PATH = Path('EIKEN_VOCAB_README.md')
NGSL_URL = 'https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv'

LEVEL_ORDER = ['basic', 'junior1', 'junior2', 'junior3', 'high1', 'high2']
LEVEL_INDEX = {key: i for i, key in enumerate(LEVEL_ORDER)}
GRADE_LABELS = {'4': '4級', '3': '3級', 'pre2': '準2級', '2': '2級'}
GRADE_ORDER = ['4', '3', 'pre2', '2']
WORD_RE = re.compile(r"^[A-Za-z]+(?:[-'][A-Za-z]+)*$")


def unique(seq):
    out = []
    seen = set()
    for value in seq or []:
        text = str(value).strip()
        if text and text not in seen:
            seen.add(text)
            out.append(text)
    return out


def fetch_ngsl():
    req = urllib.request.Request(NGSL_URL, headers={'User-Agent': 'Mozilla/5.0 MonstudyVocabularyBuilder/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        text = response.read().decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    ranks = {}
    for row in reader:
        word = (row.get('Lemma') or row.get('lemma') or row.get('word') or row.get('Word') or '').strip().lower()
        raw_rank = row.get('SFI Rank') or row.get('rank') or row.get('Rank') or ''
        if not word:
            continue
        try:
            rank = int(float(str(raw_rank).strip()))
        except (TypeError, ValueError):
            continue
        ranks.setdefault(word, rank)
    if len(ranks) < 2500:
        raise RuntimeError(f'NGSL rank load looks incomplete: {len(ranks)} rows')
    return ranks


def merge_master(master):
    merged = {}
    levels = master.get('levels') or {}
    for level in LEVEL_ORDER:
        block = levels.get(level) or {}
        words = block.get('words') if isinstance(block, dict) else block
        for item in words or []:
            word = str(item.get('word') or '').strip()
            if not WORD_RE.fullmatch(word):
                continue
            key = word.lower()
            entry = merged.setdefault(key, {
                'word': word,
                'answers': [],
                'keywords': [],
                'sourceLevels': [],
            })
            entry['answers'] = unique(entry['answers'] + (item.get('answers') or []))
            entry['keywords'] = unique(entry['keywords'] + (item.get('keywords') or []))
            if level not in entry['sourceLevels']:
                entry['sourceLevels'].append(level)
    for entry in merged.values():
        entry['sourceLevels'].sort(key=lambda x: LEVEL_INDEX.get(x, 99))
        entry['sourceLevel'] = entry['sourceLevels'][0]
    return merged


def assign_grade(level, ngsl_rank):
    # Eiken official school-stage guidance is used as the backbone.
    # NGSL frequency only moves a word one adjacent tier easier at a boundary.
    if level in ('basic', 'junior1'):
        return '4'
    if level == 'junior2':
        return '4' if ngsl_rank is not None and ngsl_rank <= 900 else '3'
    if level == 'junior3':
        return '3' if ngsl_rank is not None and ngsl_rank <= 1600 else 'pre2'
    if level == 'high1':
        return 'pre2' if ngsl_rank is not None and ngsl_rank <= 2300 else '2'
    return '2'


def sort_key(entry):
    return (
        LEVEL_INDEX.get(entry['sourceLevel'], 99),
        entry.get('ngslRank', 999999),
        entry['word'].lower(),
    )


def representative_sample(words, count=20):
    if len(words) <= count:
        return words
    indices = []
    for i in range(count):
        idx = round(i * (len(words) - 1) / (count - 1))
        if idx not in indices:
            indices.append(idx)
    return [words[i] for i in indices]


def main():
    master = json.loads(MASTER_PATH.read_text(encoding='utf-8'))
    ranks = fetch_ngsl()
    merged = merge_master(master)
    grades = {key: [] for key in GRADE_ORDER}

    for key, source in merged.items():
        rank = ranks.get(key)
        grade = assign_grade(source['sourceLevel'], rank)
        entry = {
            'word': source['word'],
            'answers': source['answers'],
            'keywords': source['keywords'],
            'sourceLevel': source['sourceLevel'],
            'sourceLevels': source['sourceLevels'],
        }
        if rank is not None:
            entry['ngslRank'] = rank
        grades[grade].append(entry)

    for grade in GRADE_ORDER:
        grades[grade].sort(key=sort_key)

    all_words = [item['word'].lower() for grade in GRADE_ORDER for item in grades[grade]]
    if len(all_words) != len(set(all_words)):
        raise RuntimeError('Duplicate words remain across grades')
    if len(all_words) < 1800:
        raise RuntimeError(f'Too few usable words: {len(all_words)}')
    for grade in GRADE_ORDER:
        if len(grades[grade]) < 200:
            raise RuntimeError(f'{grade} has too few words: {len(grades[grade])}')

    counts = {grade: len(grades[grade]) for grade in GRADE_ORDER}
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    payload = {
        'schemaVersion': '1.0',
        'version': '1.0.0',
        'generatedAt': generated,
        'name': 'もんすたでぃ独自 英検級別語彙マスター',
        'description': '既存のもんすたでぃ学年別語彙を英検公式の学習段階目安に沿って再編し、NGSL 1.2の頻度順位で隣接級の境界を補正した独自推定データベース。英検公式の単語リストではありません。',
        'disclaimer': '英検協会が公開する公式単語リストではありません。過去問・市販単語帳の語彙表を転載していません。',
        'method': {
            'backbone': {
                '4': '基礎・中1を中心。中2語のうちNGSL上位900語に入る高頻度語を含む。',
                '3': '中2を中心。中3語のうちNGSL上位1600語に入る高頻度語を含む。',
                'pre2': '中3を中心。高1語のうちNGSL上位2300語に入る高頻度語を含む。',
                '2': '高1後半・高2を中心。',
            },
            'dedupe': '同じ英単語が複数学年にある場合は最も早い学年を基準とし、訳語・keywordsは統合。級をまたぐ重複はゼロ。',
            'sort': '基礎学年、NGSL頻度順位、英字順の順。',
        },
        'sources': [
            {
                'name': 'もんすたでぃ monstudy_vocab_master.json',
                'role': '英単語、日本語代表訳、keywords、学年区分',
                'url': 'https://github.com/k-oota-pixel/word-breaker/blob/main/monstudy_vocab_master.json',
            },
            {
                'name': 'New General Service List (NGSL) 1.2',
                'role': '一般英語における頻度順位。級境界の補正にのみ使用。',
                'url': 'https://www.newgeneralservicelist.com/new-general-service-list',
                'license': 'CC BY-SA 4.0',
                'attribution': 'Browne, C., Culligan, B., & Phillips, J. New General Service List.',
            },
            {
                'name': '実用英語技能検定 各級の目安',
                'role': '4級=中学中級、3級=中学卒業、準2級=高校中級、2級=高校卒業という難度設計の参照。単語データは取得していない。',
                'url': 'https://www.eiken.or.jp/eiken/exam/about/',
            },
        ],
        'licenseNote': 'NGSL 1.2由来の頻度情報を含むため、このデータベースを再配布する場合はCC BY-SA 4.0の帰属・継承条件に従ってください。商用利用は可能です。',
        'counts': counts,
        'totalEntries': len(all_words),
        'labels': GRADE_LABELS,
        'grades': {
            grade: {
                'label': GRADE_LABELS[grade],
                'count': len(grades[grade]),
                'words': grades[grade],
            }
            for grade in GRADE_ORDER
        },
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    lines = [
        'もんすたでぃ独自 英検級別語彙マスター サンプル',
        f'生成: {generated}',
        f'総語数: {len(all_words)}',
        ' / '.join(f'{GRADE_LABELS[g]} {counts[g]}語' for g in GRADE_ORDER),
        '',
    ]
    for grade in GRADE_ORDER:
        lines.append(f'[{GRADE_LABELS[grade]}]')
        for item in representative_sample(grades[grade], 20):
            meaning = '・'.join(item['answers'][:2]) or '—'
            rank = f" / NGSL {item['ngslRank']}" if 'ngslRank' in item else ''
            lines.append(f"{item['word']}\t{meaning}\t{item['sourceLevel']}{rank}")
        lines.append('')
    SAMPLE_PATH.write_text('\n'.join(lines), encoding='utf-8')

    README_PATH.write_text(
        '# もんすたでぃ独自 英検級別語彙マスター\n\n'
        '`eiken_vocab_master.json` は英検公式単語リストではありません。既存のもんすたでぃ学年別語彙を、英検協会が示す学習段階の目安に合わせて4級・3級・準2級・2級へ再編し、NGSL 1.2の頻度順位で隣接級の境界のみ補正した独自データです。\n\n'
        '## 出典とライセンス\n\n'
        '- 英検「各級の目安」: 難度設計の参照のみ。単語一覧は取得・転載していません。\n'
        '- New General Service List (NGSL) 1.2: Browne, Culligan & Phillips. CC BY-SA 4.0。一般英語頻度順位を利用しています。\n'
        '- 日本語訳・keywords・学年区分: `monstudy_vocab_master.json`。\n\n'
        'NGSL由来の情報を含む本データを再配布する場合はCC BY-SA 4.0の帰属・継承条件に従ってください。商用利用は認められています。\n',
        encoding='utf-8',
    )

    print(json.dumps({'counts': counts, 'total': len(all_words)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
