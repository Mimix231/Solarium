from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
import hashlib,re,time,os
from .database import ProjectDatabase

IGNORE={".git","node_modules","target","dist","build",".venv","venv","__pycache__",".idea",".next","coverage",".glitch",".solarium",".solarium-trash"}
EXT_LANG={".mjs":"javascript",".cjs":"javascript",".mts":"typescript",".cts":"typescript",".ts":"typescript",".tsx":"typescript",".js":"javascript",".jsx":"javascript",".py":"python",".rs":"rust",".cpp":"cpp",".cc":"cpp",".c":"c",".h":"cpp",".hpp":"cpp",".java":"java",".kt":"kotlin",".go":"go",".json":"json",".md":"markdown",".css":"css",".scss":"scss",".html":"html",".toml":"toml",".yaml":"yaml",".yml":"yaml"}
SYMBOL_PATTERNS={
 "python":[("function",re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)")),("class",re.compile(r"^\s*class\s+([A-Za-z_]\w*)"))],
 "typescript":[("symbol",re.compile(r"\b(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)")),("variable",re.compile(r"\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*="))],
 "javascript":[("symbol",re.compile(r"\b(?:function|class)\s+([A-Za-z_$][\w$]*)")),("variable",re.compile(r"\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*="))],
 "rust":[("symbol",re.compile(r"\b(?:fn|struct|enum|trait|mod)\s+([A-Za-z_]\w*)"))],
 "cpp":[("type",re.compile(r"\b(?:class|struct|enum)\s+([A-Za-z_]\w*)"))],
}
IMPORT_PATTERNS=[re.compile(r"from\s+['\"]([^'\"]+)['\"]"),re.compile(r"import\s+.*?from\s+['\"]([^'\"]+)['\"]"),re.compile(r"^\s*(?:from|import)\s+([\w.]+)",re.M),re.compile(r"#include\s*[<\"]([^>\"]+)")]

@dataclass(slots=True)
class IndexedFile:
    path:str; relative_path:str; language:str; size:int; symbols:list[str]=field(default_factory=list); imports:list[str]=field(default_factory=list); preview:str=""; sha256:str=""

class ProjectIndex:
    def __init__(self):self.root:Path|None=None;self.files:list[IndexedFile]=[];self.indexed_at=0.0;self.database:ProjectDatabase|None=None;self.changed_files=0
    def _parse(self,path:Path,relative:str,lang:str,size:int,mtime_ns:int)->tuple[IndexedFile,list[dict],list[dict]]:
        if size>4*1024*1024:return IndexedFile(str(path),relative,lang,size),[],[]
        try:data=path.read_bytes();text=data.decode('utf-8')
        except Exception:return IndexedFile(str(path),relative,lang,size),[],[]
        digest=hashlib.sha256(data).hexdigest();symbols=[]
        for kind,pattern in SYMBOL_PATTERNS.get(lang,[]):
            for line_no,line in enumerate(text.splitlines(),1):
                for match in pattern.finditer(line):
                    symbols.append({'name':match.group(1),'kind':kind,'line':line_no,'column':len(line[:match.start(1)].encode('utf-16-le'))//2+1,'signature':line.strip()[:500]})
                    if len(symbols)>=500:break
                if len(symbols)>=500:break
        imports=[]
        for pattern in IMPORT_PATTERNS:
            for match in pattern.finditer(text):
                target=match.group(1) if match.groups() else match.group(0);line=text.count('\n',0,match.start())+1;imports.append({'target':target,'line':line})
                if len(imports)>=300:break
        preview="\n".join(text.splitlines()[:16])[:2200]
        return IndexedFile(str(path),relative,lang,size,[x['name'] for x in symbols],list(dict.fromkeys(x['target'] for x in imports)),preview,digest),symbols,imports
    def build(self,root:str)->dict:
        p=Path(root).resolve()
        if not p.is_dir():raise FileNotFoundError(root)
        if self.database:self.database.close()
        self.root=p;self.database=ProjectDatabase(p);self.changed_files=0;existing=set();items=[]
        private={"runtime","output"} if (p/"docs/info/INFERENCE_ARCHITECTURE.md").is_file() else set()
        # Prune before descending; rglob followed by filtering still walks every dependency.
        for current, directories, names in os.walk(p, followlinks=False):
            directories[:]=[name for name in directories if name not in IGNORE and not (Path(current)==p and name in private) and not (Path(current)/name).is_symlink() and not (hasattr(Path(current)/name,"is_junction") and (Path(current)/name).is_junction()) and (Path(current)/name).resolve().is_relative_to(p)]
            for name in names:
                path=Path(current)/name
                if path.is_symlink() or not path.resolve().is_relative_to(p):continue

                try:relative_path=path.relative_to(p)
                except ValueError:continue
                if any(part in IGNORE for part in relative_path.parts):continue
                if not path.is_file():continue
                try:stat=path.stat()
                except OSError:continue
                absolute=str(path.resolve());existing.add(absolute);lang=EXT_LANG.get(path.suffix.lower(),'text')
                old=self.database.file_record(path)
                if old and int(old['size'])==stat.st_size and int(old['mtime_ns'])==stat.st_mtime_ns:
                    symbols=[r['name'] for r in self.database.symbols_for_file(absolute)];imports=[r['target'] for r in self.database.imports_for_file(absolute)]
                    items.append(IndexedFile(absolute,str(relative_path),lang,stat.st_size,symbols,imports,old['preview'],old['sha256']));continue
                item,symbol_rows,import_rows=self._parse(path,str(relative_path),lang,stat.st_size,stat.st_mtime_ns);items.append(item);self.changed_files+=1
                self.database.upsert_file(path=path,relative_path=str(relative_path),language=lang,size=stat.st_size,mtime_ns=stat.st_mtime_ns,sha256=item.sha256,preview=item.preview,symbols=symbol_rows,imports=import_rows)
        self.database.delete_missing(existing);self.files=sorted(items,key=lambda x:x.relative_path.lower());self.indexed_at=time.time();return self.summary()
    def refresh(self)->dict:
        if self.root is None:raise RuntimeError('No workspace open')
        return self.build(str(self.root))
    def summary(self)->dict:
        langs={}
        for f in self.files:langs[f.language]=langs.get(f.language,0)+1
        stats=self.database.stats() if self.database else {'files':len(self.files),'symbols':sum(len(f.symbols) for f in self.files),'imports':sum(len(f.imports) for f in self.files)}
        return {"root":str(self.root or ""),"files":stats['files'],"symbols":stats['symbols'],"imports":stats['imports'],"languages":langs,"indexedAt":self.indexed_at,"changedFiles":self.changed_files,"database":stats.get('database')}
    def rank(self,query:str,limit:int=12)->list[IndexedFile]:
        terms=[x.lower() for x in re.findall(r"[A-Za-z_][\w.-]{2,}",query) if x.lower() not in {"the","and","this","that","with","from","into","fix","make","please"}]
        scored=[]
        for f in self.files:
            hay=(f.relative_path+" "+" ".join(f.symbols)+" "+" ".join(f.imports)).lower();score=sum((5 if t in f.relative_path.lower() else 0)+(3 if any(t in s.lower() for s in f.symbols) else 0)+(1 if t in hay else 0) for t in terms)
            if score:scored.append((score,f))
        scored.sort(key=lambda x:(-x[0],x[1].relative_path));return [f for _,f in scored[:limit]]
    def find_symbols(self,query:str,limit:int=100)->list[dict]:
        if not self.database:return []
        out=[]
        for row in self.database.find_symbols(query,limit):
            item=dict(row);item['column']=item.pop('column_no',1);out.append(item)
        return out
    def find_references(self,symbol:str,limit:int=200)->list[dict]:
        return self.database.find_references(symbol,limit) if self.database else []
    def close(self)->None:
        """Flush and close the persistent project database.

        Foundation Pass 5 routes application shutdown through one coordinator, so
        project intelligence must release WAL/database handles deterministically.
        """
        db=self.database
        self.database=None
        if db is not None:
            db.close()

