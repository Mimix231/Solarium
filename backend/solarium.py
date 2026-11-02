"""Glitch's project intelligence, hosted by Solarium without loading another model.

Private stdio transport: requests always identify a canonical workspace. No shell,
file-write, model-loading or generation RPC is exposed by this service.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import sys
import threading
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from project import ProjectIndex, ContextAssembler, LspManager, git_status


def scoped_path(root: Path, value: str) -> Path:
    path = Path(value)
    path = (path if path.is_absolute() else root / path).resolve()
    if not path.is_relative_to(root):
        raise PermissionError("Path is outside the selected Solarium project")
    return path


class ProjectSession:
    def __init__(self, root: Path):
        self.root = root
        self.index = ProjectIndex()
        self.index.build(str(root))
        self.context = ContextAssembler(self.index)
        self.lsp = LspManager()
        self.editor_buffers: dict[str,str] = {}
        self.lsp.set_workspace(root)
        self.lock = threading.RLock()

    def close(self):
        self.lsp.close()
        self.index.close()


class ProjectService:
    def __init__(self):
        self.projects: dict[str, ProjectSession] = {}

    def request(self, root: str, method: str, params: dict):
        if method == "health":
            return {"service": "solarium-glitch-projects", "python": sys.version.split()[0],
                    "pid": os.getpid(), "projects": len(self.projects), "loadsModel": False, "loadedTensorModules": [name for name in ("torch","transformers","codediffusion.runtime") if name in sys.modules]}
        if method == "shutdown":
            self.close()
            return {"closed": True}
        if method not in {"index.refresh","index.summary","project.symbols","project.references","project.context","git.status","lsp.status","lsp.inspect","lsp.open","lsp.change","lsp.save","lsp.close","lsp.diagnostics","lsp.request"}:
            raise ValueError("Unknown project-service method: " + method)
        base = Path(root).resolve(strict=True)
        if not base.is_dir():
            raise NotADirectoryError(str(base))
        key = os.path.normcase(str(base))
        project = self.projects.get(key)
        if project is None:
            project = self.projects[key] = ProjectSession(base)
        with project.lock:
            if method == "index.refresh":
                return project.index.refresh()
            if method == "index.summary":
                return project.index.summary()
            if method == "project.symbols":
                project.index.refresh()
                items=project.index.find_symbols(str(params.get("query", "")), min(300, max(1, int(params.get("limit", 100)))))
                return {"provider":"lexical-index","items":[{**item,"path":str(scoped_path(base,item.get("relative_path",item.get("path",""))))} for item in items]}
            if method == "project.references":
                project.index.refresh()
                return {"provider": "lexical-index", "items": [{**item,"path":str(scoped_path(base,item["path"]))} for item in project.index.find_references(str(params.get("symbol", "")), min(300, max(1, int(params.get("limit", 100)))))]}
            if method == "project.context":
                project.index.refresh()
                text = project.context.assemble(str(params.get("query", "")), attention_capacity_chars=min(100_000, max(2048, int(params.get("capacity", 8000)))))
                report = project.context.last_report
                return {"text": text, "report": report.to_dict() if hasattr(report, "to_dict") else report, "provider": "glitch-project-index", "root": str(base)}
            if method == "git.status":
                return git_status(base)
            if method == "lsp.status":
                return project.lsp.status()
            if method == "lsp.inspect":
                path=scoped_path(base,str(params.get("path","")))
                if not path.is_file():
                    raise FileNotFoundError(str(path))
                text=path.read_text("utf-8")
                line=int(params.get("line",1))-1;column=int(params.get("column",1))-1
                if line<0 or column<0 or line>=len(text.splitlines() or [""]):
                    raise ValueError("Use a real one-based source position")
                uri=path.as_uri();owned=uri in project.editor_buffers
                if not owned:
                    project.lsp.open_document(str(path),text)
                kind=str(params.get("kind","definition"))
                if kind=="diagnostics":
                    return {**project.lsp.diagnostics_for(str(path)),"source":"editor-buffer" if owned else "disk","path":str(path)}
                operation={"definition":"textDocument/definition","references":"textDocument/references","hover":"textDocument/hover"}.get(kind)
                if not operation:
                    raise ValueError("Unsupported source inspection")
                arguments={"textDocument":{"uri":uri},"position":{"line":line,"character":column}}
                if kind=="references":
                    arguments["context"]={"includeDeclaration":True}
                result=project.lsp.request(str(path),operation,arguments)
                return {**result,"provider":"language-server","source":"editor-buffer" if owned else "disk","path":str(path),"notice":"Language-server results are actual source navigation. External locations are references only; project file reads remain scoped."}
            path = str(scoped_path(base, str(params.get("path", ""))))
            language = params.get("language")
            uri=Path(path).as_uri();editor_id=params.get("editorId")
            if method=="lsp.open" and editor_id:
                project.editor_buffers[uri]=str(editor_id)
            if method in {"lsp.change","lsp.save","lsp.close"} and uri in project.editor_buffers and project.editor_buffers[uri]!=editor_id:
                return {"available":False,"staleOwner":True}
            if method=="lsp.close":
                project.editor_buffers.pop(uri,None)
            if method == "lsp.open":
                return project.lsp.open_document(path, str(params.get("text", "")), language)
            if method == "lsp.change":
                return project.lsp.change_document(path, str(params.get("text", "")), language)
            if method == "lsp.save":
                return project.lsp.save_document(path, params.get("text"), language)
            if method == "lsp.close":
                return project.lsp.close_document(path, language)
            if method == "lsp.diagnostics":
                if params.get("disk"):
                    uri=Path(path).as_uri();text=Path(path).read_text("utf-8")
                    if uri in project.editor_buffers:
                        return {"available":False,"diagnostics":[],"reason":"A live editor owns this buffer, including pending unsaved changes. Use manifest checks for disk verification.","source":"editor-buffer"}
                    if uri in project.lsp.document_text and project.lsp.document_text[uri]!=text:
                        return {"available":False,"diagnostics":[],"reason":"An unsaved editor buffer differs from disk. Use manifest checks for disk verification.","source":"disk"}
                    project.lsp.open_document(path,text,language)
                return project.lsp.diagnostics_for(path, language)
            if method == "lsp.request":
                operation = str(params.get("lspMethod", ""))
                if operation not in {"textDocument/completion", "textDocument/hover", "textDocument/definition", "textDocument/references", "textDocument/rename", "textDocument/documentSymbol", "textDocument/signatureHelp", "workspace/symbol"}:
                    raise PermissionError("This language-server operation is not exposed")
                arguments = dict(params.get("lspParams") or {})
                uri = arguments.get("textDocument", {}).get("uri")
                if uri:
                    parsed = urlparse(uri)
                    local = unquote(parsed.path)
                    if os.name == "nt" and len(local) > 2 and local[0] == "/" and local[2] == ":":
                        local = local[1:]
                    if parsed.scheme != "file" or parsed.netloc or scoped_path(base, local) != Path(path):
                        raise PermissionError("Language-server URI does not match the scoped document")
                return project.lsp.request(path, operation, arguments, language)
            raise ValueError("Unknown project-service method: " + method)

    def close(self):
        for session in self.projects.values():
            session.close()
        self.projects.clear()


def main():
    if "--check" in sys.argv:
        if sys.version_info < (3, 10):
            raise RuntimeError("Python 3.10 or later is required")
        print(json.dumps(ProjectService().request("", "health", {})))
        return
    service = ProjectService()
    try:
        for line in sys.stdin.buffer:
            request = {}
            try:
                if len(line) > 8_000_000:
                    raise ValueError("Project request exceeds its transport capacity")
                request = json.loads(line)
                result = service.request(str(request.get("root", "")), str(request["method"]), dict(request.get("params") or {}))
                response = {"id": request.get("id"), "ok": True, "result": result}
            except Exception as error:
                response = {"id": request.get("id"), "ok": False, "error": f"{type(error).__name__}: {error}"}
            sys.stdout.buffer.write((json.dumps(response, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8"))
            sys.stdout.buffer.flush()
            if request.get("method") == "shutdown":
                break
    finally:
        service.close()


if __name__ == "__main__":
    main()
