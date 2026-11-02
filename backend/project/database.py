from __future__ import annotations
import hashlib, os, sqlite3, threading, time
from pathlib import Path
from dataclasses import dataclass

SCHEMA_VERSION=1

def _cache_root() -> Path:
    root=os.environ.get("SOLARIUM_PROJECT_CACHE") or os.environ.get("GLITCH_RUNTIME_ROOT")
    return (Path(root) if root else Path.home()/".glitch").joinpath("project-index")

def database_path(root:Path)->Path:
    digest=hashlib.sha256(str(root.resolve()).encode("utf-8")).hexdigest()[:24]
    p=_cache_root()/f"{digest}.sqlite3";p.parent.mkdir(parents=True,exist_ok=True);return p

class ProjectDatabase:
    def __init__(self,root:Path):
        self.root=root.resolve();self.path=database_path(self.root);self.lock=threading.RLock()
        self.db=sqlite3.connect(self.path,check_same_thread=False,timeout=15);self.db.row_factory=sqlite3.Row;self.db.execute("PRAGMA foreign_keys=ON")
        with self.db:
            self.db.execute("PRAGMA journal_mode=WAL")
            self.db.execute("PRAGMA synchronous=NORMAL")
            self.db.executescript('''
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY,relative_path TEXT NOT NULL,language TEXT NOT NULL,size INTEGER NOT NULL,mtime_ns INTEGER NOT NULL,sha256 TEXT NOT NULL,preview TEXT NOT NULL,indexed_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS symbols(id INTEGER PRIMARY KEY AUTOINCREMENT,file_path TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,line INTEGER NOT NULL,column_no INTEGER NOT NULL,signature TEXT,FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE);
            CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name COLLATE NOCASE);
            CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);
            CREATE TABLE IF NOT EXISTS imports(id INTEGER PRIMARY KEY AUTOINCREMENT,file_path TEXT NOT NULL,target TEXT NOT NULL,line INTEGER NOT NULL,FOREIGN KEY(file_path) REFERENCES files(path) ON DELETE CASCADE);
            CREATE INDEX IF NOT EXISTS idx_imports_target ON imports(target COLLATE NOCASE);
            ''')
            self.db.execute("INSERT OR REPLACE INTO meta(key,value) VALUES('schema_version',?)",(str(SCHEMA_VERSION),))
            self.db.execute("INSERT OR REPLACE INTO meta(key,value) VALUES('root',?)",(str(self.root),))
    def close(self):
        with self.lock:self.db.close()
    def file_record(self,path:Path):
        with self.lock:return self.db.execute("SELECT * FROM files WHERE path=?",(str(path.resolve()),)).fetchone()
    def upsert_file(self,*,path:Path,relative_path:str,language:str,size:int,mtime_ns:int,sha256:str,preview:str,symbols:list[dict],imports:list[dict]):
        absolute=str(path.resolve());now=time.time()
        with self.lock,self.db:
            self.db.execute("INSERT OR REPLACE INTO files(path,relative_path,language,size,mtime_ns,sha256,preview,indexed_at) VALUES(?,?,?,?,?,?,?,?)",(absolute,relative_path,language,size,mtime_ns,sha256,preview,now))
            self.db.execute("DELETE FROM symbols WHERE file_path=?",(absolute,));self.db.execute("DELETE FROM imports WHERE file_path=?",(absolute,))
            self.db.executemany("INSERT INTO symbols(file_path,name,kind,line,column_no,signature) VALUES(?,?,?,?,?,?)",[(absolute,s['name'],s.get('kind','symbol'),int(s.get('line',1)),int(s.get('column',1)),s.get('signature')) for s in symbols])
            self.db.executemany("INSERT INTO imports(file_path,target,line) VALUES(?,?,?)",[(absolute,i['target'],int(i.get('line',1))) for i in imports])
    def delete_missing(self,existing:set[str]):
        with self.lock,self.db:
            rows=self.db.execute("SELECT path FROM files").fetchall()
            for row in rows:
                if row['path'] not in existing:self.db.execute("DELETE FROM files WHERE path=?",(row['path'],))
    def files(self):
        with self.lock:return self.db.execute("SELECT * FROM files ORDER BY relative_path COLLATE NOCASE").fetchall()
    def symbols_for_file(self,path:str):
        with self.lock:return self.db.execute("SELECT * FROM symbols WHERE file_path=? ORDER BY line,column_no",(path,)).fetchall()
    def imports_for_file(self,path:str):
        with self.lock:return self.db.execute("SELECT * FROM imports WHERE file_path=? ORDER BY line",(path,)).fetchall()
    def find_symbols(self,query:str,limit:int=100):
        q=f"%{query}%"
        with self.lock:return self.db.execute("SELECT s.name,s.kind,s.line,s.column_no,s.signature,f.relative_path FROM symbols s JOIN files f ON f.path=s.file_path WHERE s.name LIKE ? COLLATE NOCASE ORDER BY CASE WHEN lower(s.name)=lower(?) THEN 0 WHEN lower(s.name) LIKE lower(?) THEN 1 ELSE 2 END,s.name LIMIT ?",(q,query,query+'%',limit)).fetchall()
    def find_references(self,symbol:str,limit:int=200):
        # Reference extraction starts with exact identifier scanning over indexed source.
        # It is intentionally database-backed so LSP results can replace/augment it later.
        out=[]
        for row in self.files():
            p=Path(row['path'])
            if row['size']>4*1024*1024:continue
            if not p.resolve().is_relative_to(self.root) or p.is_symlink():continue
            try:lines=p.read_text('utf-8').splitlines()
            except Exception:continue
            import re
            pattern=re.compile(rf"\b{re.escape(symbol)}\b")
            for i,line in enumerate(lines,1):
                for m in pattern.finditer(line):
                    out.append({'name':symbol,'kind':'reference','path':row['relative_path'],'line':i,'column':len(line[:m.start()].encode('utf-16-le'))//2+1,'signature':line.strip()[:300]})
                    if len(out)>=limit:return out
        return out
    def stats(self):
        with self.lock:
            f=self.db.execute("SELECT count(*) c FROM files").fetchone()['c'];s=self.db.execute("SELECT count(*) c FROM symbols").fetchone()['c'];i=self.db.execute("SELECT count(*) c FROM imports").fetchone()['c']
        return {'files':f,'symbols':s,'imports':i,'database':str(self.path)}
