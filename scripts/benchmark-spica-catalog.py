#!/usr/bin/env python3
"""Synthetic SQLite FTS5 scale check. Fixtures are never written to shipped app data.

Uses the same catalog_entries/catalog_fts schema and query pattern as the native
Rust provider. It is NOT a substitute for compiling/running native Tauri tests.
"""
import argparse
import json
import os
import sqlite3
import statistics
import tempfile
import time
from pathlib import Path


def run(entries: int = 350_000, rounds: int = 4) -> dict:
    if entries < 1 or entries > 500_000:
        raise ValueError("entries must be between 1 and 500000")
    with tempfile.TemporaryDirectory(prefix='spica-catalog-scale-') as tmp:
        db_path = Path(tmp) / 'synthetic.db'
        db = sqlite3.connect(db_path)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('CREATE TABLE catalog_entries(rowid INTEGER PRIMARY KEY,id TEXT NOT NULL,version TEXT NOT NULL,category INTEGER NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,tags TEXT NOT NULL,reference TEXT NOT NULL,UNIQUE(id,version))')
        db.execute('CREATE INDEX catalog_category ON catalog_entries(category,kind,id)')
        db.execute("CREATE VIRTUAL TABLE catalog_fts USING fts5(id,title,summary,tags,content='catalog_entries',prefix='2 3')")
        begin = time.perf_counter()
        for offset in range(0, entries, 5000):
            rows = []
            for n in range(offset, min(offset+5000, entries)):
                cat = (n // 10_000) + 1
                family = ['styling','variables','functions','layout','visual-appearance','interface','ui','professionalism','web-research'][n % 9]
                rows.append((f'spica.synthetic.category{cat:03d}.block{n:06d}', '1.0.0', cat, 'profile' if n%13==0 else 'primitive',
                             f'{family} accessible panel {n}', 'Synthetic configuration profile, non executable test metadata',
                             f'{family} category{cat} sample', 'NON-EXECUTABLE SYNTHETIC TEST'))
            db.executemany('INSERT INTO catalog_entries(id,version,category,kind,title,summary,tags,reference) VALUES(?,?,?,?,?,?,?,?)', rows)
        db.execute("INSERT INTO catalog_fts(catalog_fts) VALUES('rebuild')")
        db.commit()
        indexing_seconds = time.perf_counter() - begin
        times = []
        queries = [
          ('"accessible"* AND "panel"*', None, None),
          ('"styling"*', 29, 'primitive'),
          ('"ui"*', 34, None),
          ('"category20"*', 20, 'profile'),
          ('"configuration"*', None, None),
        ]
        for iteration in range(rounds):
            for expression, category, kind in queries:
                start = time.perf_counter()
                sql = "FROM catalog_fts JOIN catalog_entries AS e ON e.rowid=catalog_fts.rowid WHERE catalog_fts MATCH ? AND (? IS NULL OR e.category=?) AND (? IS NULL OR e.kind=?)"
                params = (expression, category, category, kind, kind)
                total = db.execute('SELECT count(*) ' + sql, params).fetchone()[0]
                page = db.execute('SELECT e.id,e.category ' + sql + ' ORDER BY bm25(catalog_fts,1.0,5.0,2.0,1.0), e.id LIMIT ? OFFSET ?', params + (12, iteration*12)).fetchall()
                assert len(page) <= 12
                if page:
                    assert all('.synthetic.' in id for id, _ in page)
                times.append({'query': expression, 'category': category, 'kind': kind, 'matches': total,
                              'durationMs': round((time.perf_counter() - start) * 1000, 3)})
        total_on_disk = sum(p.stat().st_size for p in Path(tmp).glob('synthetic.db*') if p.exists())
        assert db.execute('SELECT count(*) FROM catalog_entries').fetchone()[0] == entries
        assert db.execute('SELECT count(*) FROM catalog_fts').fetchone()[0] == entries
        db.close()
        metrics = sorted(item['durationMs'] for item in times)
        return {'fixture': 'non-executable synthetic SQLite FTS5', 'entries': entries, 'categories': (entries+9999)//10000,
                'recordsPerCategoryTarget': 10_000, 'indexSeconds': round(indexing_seconds,3), 'diskMiB':round(total_on_disk/(1024*1024),2),
                'samples':len(times),'medianSearchMs': round(statistics.median(metrics),3),
                'p95SearchMs': metrics[min(len(metrics)-1,int(len(metrics)*.95))],
                'maxSearchMs': max(metrics), 'individual':times,
                'warning':'Benchmarks native-like SQLite indexing only; not native Tauri app build or JS memory.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--entries', type=int, default=350_000)
    parser.add_argument('--rounds', type=int, default=4)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = run(args.entries,args.rounds)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key:value for key,value in result.items() if key!='individual'},indent=2))
