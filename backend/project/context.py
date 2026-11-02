from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import re
import threading
from typing import Optional

from .indexer import ProjectIndex, IndexedFile


@dataclass(slots=True)
class ContextItem:
    tier: str
    kind: str
    source: str
    chars: int
    score: float
    exact: bool
    cache_hit: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class ContextReport:
    selection_mode: str
    attention_capacity_chars: int | None
    used_chars: int
    active_chars: int
    near_chars: int
    project_chars: int
    considered_files: int
    cache_hits: int
    items: list[ContextItem]

    def to_dict(self) -> dict:
        # Pass 9.1 deliberately has no artificial character quota. The only ceiling reported here
        # is the model's physical attention capacity, which is not a work quota.
        return {
            "selectionMode": self.selection_mode,
            "attentionCapacityChars": self.attention_capacity_chars,
            "usedChars": self.used_chars,
            "activeChars": self.active_chars,
            "nearChars": self.near_chars,
            "projectChars": self.project_chars,
            "consideredFiles": self.considered_files,
            "cacheHits": self.cache_hits,
            "items": [x.to_dict() for x in self.items],
        }


class ContextAssembler:
    """Context Loom v2 — unmetered relevance retrieval.

    Pass 5 used an artificial character budget and filled it until exhausted.  That
    made the pre-model "Context Loom" stage look like a 700–800k-character job on
    long-context Qwen models and encouraged unnecessary source reads.

    Pass 9.1 removes that budget model.  Retrieval is driven by relevance and the
    persistent project index.  Exact source is cached by file mtime/size.  The only
    size ceiling accepted by :meth:`assemble` is ``attention_capacity_chars``: the
    transformer's real physical input capacity after protocol/conversation space, not
    a token/step/work allowance.  Context Loom never tries to *fill* that capacity.
    """

    def __init__(self, index: ProjectIndex):
        self.index = index
        self.last_report = ContextReport("unmetered_relevance", None, 0, 0, 0, 0, 0, 0, [])
        self._source_cache: dict[str, tuple[int, int, str]] = {}
        self._lock = threading.RLock()

    @staticmethod
    def _query_terms(request: str) -> set[str]:
        ignored = {"the", "and", "this", "that", "with", "from", "into", "fix", "make", "please", "can", "you", "for", "our", "now"}
        return {x.lower() for x in re.findall(r"[A-Za-z_][\w.-]{2,}", request) if x.lower() not in ignored}

    def _score(self, f: IndexedFile, terms: set[str], rank: int) -> float:
        path = f.relative_path.lower()
        symbols = [s.lower() for s in f.symbols]
        imports = [s.lower() for s in f.imports]
        lexical = 0.0
        for term in terms:
            if term in path:
                lexical += 6.0
            if any(term in symbol for symbol in symbols):
                lexical += 3.0
            if any(term in target for target in imports):
                lexical += 1.25
        # `rank()` has already performed the index-side lexical ordering.  This
        # decaying term lets a strong first result dominate without imposing a file
        # count quota.
        return lexical + (2.0 / float(rank + 1))

    def _read_cached(self, f: IndexedFile) -> tuple[str | None, bool]:
        if f.size > 4 * 1024 * 1024:
            return None, False
        try:
            path = Path(f.path)
            if self.index.root is None or path.is_symlink() or not path.resolve().is_relative_to(self.index.root):
                return None, False
            stat = path.stat()
            key = str(path)
            signature = (int(stat.st_mtime_ns), int(stat.st_size))
            with self._lock:
                cached = self._source_cache.get(key)
                if cached and cached[:2] == signature:
                    return cached[2], True
            text = path.read_text("utf-8")
            with self._lock:
                self._source_cache[key] = (signature[0], signature[1], text)
            return text, False
        except Exception:
            return None, False

    def assemble(self, request: str, attention_capacity_chars: Optional[int] = None) -> str:
        if self.index.root is None:
            self.last_report = ContextReport("unmetered_relevance", attention_capacity_chars, 0, 0, 0, 0, 0, 0, [])
            return "No workspace is open."

        capacity = None if attention_capacity_chars is None else max(2048, int(attention_capacity_chars))
        chunks: list[str] = []
        items: list[ContextItem] = []
        active_chars = near_chars = project_chars = cache_hits = 0

        summary = "PROJECT INDEX / LIBRARY\n" + str({k:v for k,v in self.index.summary().items() if k not in {"indexedAt","changedFiles"}})
        chunks.append(summary)
        project_chars += len(summary)
        items.append(ContextItem("PROJECT", "index", str(self.index.root), len(summary), 1.0, False, False))
        used = len(summary)

        terms = self._query_terms(request)
        # Ask the index for every lexical match.  Selection below ends naturally when
        # relevance falls away; this is intentionally not a top-N context budget.
        ranked = self.index.rank(request, limit=max(1, len(self.index.files)))
        considered = len(ranked)
        if not ranked:
            self.last_report = ContextReport("unmetered_relevance", capacity, used, 0, 0, project_chars, 0, 0, items)
            return "\n".join(chunks)

        best_score: float | None = None
        for rank, f in enumerate(ranked):
            score = self._score(f, terms, rank)
            if best_score is None:
                best_score = max(score, 1e-9)
            relative = score / best_score
            # Stop because relevance has collapsed, not because N files or N chars
            # were "spent".  A path/symbol direct hit is always retained.
            direct = any(term in f.relative_path.lower() or any(term in s.lower() for s in f.symbols) for term in terms)
            if rank > 0 and relative < 0.16 and not direct:
                continue

            symbols = ", ".join(f.symbols[:80])
            near = f"\nNEAR: {f.relative_path}\nLANGUAGE: {f.language}\nSYMBOLS: {symbols}\n"
            if capacity is None or used + len(near) <= capacity:
                chunks.append(near)
                used += len(near)
                near_chars += len(near)
                items.append(ContextItem("NEAR", "symbols", f.relative_path, len(near), score, False, False))

            # Exact source is selected only for genuinely relevant files.  We no longer
            # grow the prompt simply because unused attention capacity exists.
            if relative < 0.28 and not direct:
                continue
            # The index already knows file size, so do not touch disk for exact source
            # that physically cannot fit in this attention window.
            if capacity is not None and used + int(f.size) + 64 > capacity:
                continue
            text, hit = self._read_cached(f)
            if text is None:
                continue
            if hit:
                cache_hits += 1
            block = f"ACTIVE SOURCE: {f.relative_path}\n---\n{text}\n---\n"
            if capacity is not None and used + len(block) > capacity:
                # Physical attention cannot contain this source as a whole.  Keep its
                # indexed NEAR representation and let Dona explicitly read it by tool.
                continue
            chunks.append(block)
            used += len(block)
            active_chars += len(block)
            items.append(ContextItem("ACTIVE", "source", f.relative_path, len(block), score, True, hit))

        self.last_report = ContextReport(
            "unmetered_relevance", capacity, used, active_chars, near_chars, project_chars,
            considered, cache_hits, items,
        )
        return "\n".join(chunks)
