from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time
from typing import Any
from urllib.parse import urlparse,unquote
from .processes import ProcessJob


LANGUAGE_BY_SUFFIX = {
    ".ts": "typescript", ".tsx": "typescriptreact", ".js": "javascript", ".jsx": "javascriptreact",
    ".mjs":"javascript", ".cjs":"javascript", ".mts":"typescript", ".cts":"typescript",
    ".py": "python", ".rs": "rust", ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".hpp": "cpp",
}


@dataclass(slots=True)
class ServerDefinition:
    family: str
    command: list[str]
    languages: tuple[str, ...]


class LspProtocolError(RuntimeError):
    pass


def _uri(path: Path) -> str:
    return path.resolve().as_uri()


def _uri_key(uri:str)->str:
    path=unquote(urlparse(uri).path)
    if os.name=="nt" and len(path)>2 and path[0]=="/" and path[2]==":":path=path[1:]
    return os.path.normcase(str(Path(path).resolve()))


def _local_bin(root: Path, name: str) -> str | None:
    suffix = ".cmd" if os.name == "nt" else ""
    candidate = root / "node_modules" / ".bin" / f"{name}{suffix}"
    return str(candidate) if candidate.exists() else None


def discover_servers(root: Path) -> list[ServerDefinition]:
    ts = _local_bin(root, "typescript-language-server") or os.environ.get("SOLARIUM_TYPESCRIPT_LANGUAGE_SERVER") or shutil.which("typescript-language-server")
    pyright = _local_bin(root, "pyright-langserver") or shutil.which("pyright-langserver")
    rust = shutil.which("rust-analyzer")
    clangd = shutil.which("clangd")
    found: list[ServerDefinition] = []
    if ts:
        script=Path(ts).parent.parent/"typescript-language-server"/"lib"/"cli.mjs"
        command=[shutil.which("node") or "node",str(script),"--stdio"] if script.is_file() else [ts,"--stdio"]
        found.append(ServerDefinition("typescript", command, ("typescript", "typescriptreact", "javascript", "javascriptreact")))
    if pyright:
        found.append(ServerDefinition("python", [pyright, "--stdio"], ("python",)))
    if rust:
        found.append(ServerDefinition("rust", [rust], ("rust",)))
    if clangd:
        found.append(ServerDefinition("clangd", [clangd, "--background-index"], ("c", "cpp")))
    return found


class LspProcess:
    def __init__(self, definition: ServerDefinition, root: Path):
        self.definition = definition
        self.root = root.resolve()
        self.process = subprocess.Popen(
            definition.command,
            cwd=self.root,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        try:self._job=ProcessJob(self.process)
        except Exception:
            self.process.kill();self.process.wait()
            raise
        if self.process.stdin is None or self.process.stdout is None:
            raise RuntimeError(f"Failed to open stdio for {definition.family} language server")
        self._stdin = self.process.stdin
        self._stdout = self.process.stdout
        self._send_lock = threading.RLock()
        self._pending: dict[int, queue.Queue[dict[str, Any]]] = {}
        self._pending_lock = threading.RLock()
        self._next_id = 1
        self._stop = threading.Event()
        self.diagnostics: dict[str, list[dict[str, Any]]] = {}
        self.diagnostic_versions: dict[str,int|None] = {}
        self.log: list[str] = []
        self._reader = threading.Thread(target=self._read_loop, name=f"glitch-lsp-{definition.family}", daemon=True)
        self._reader.start()
        if self.process.stderr is not None:
            threading.Thread(target=self._stderr_loop, name=f"glitch-lsp-{definition.family}-stderr", daemon=True).start()
        try:self._initialize()
        except Exception:
            self.close()
            raise

    def _stderr_loop(self) -> None:
        assert self.process.stderr is not None
        for raw in iter(self.process.stderr.readline, b""):
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line:
                self.log.append(line)
                self.log[:] = self.log[-200:]

    def _read_message(self) -> dict[str, Any] | None:
        headers: dict[str, str] = {}
        while not self._stop.is_set():
            raw = self._stdout.readline()
            if not raw:
                return None
            line = raw.decode("ascii", errors="replace").strip("\r\n")
            if not line:
                break
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.lower().strip()] = value.strip()
        length = int(headers.get("content-length", "0") or "0")
        if length <= 0:
            return None
        if length > 16_000_000:
            raise LspProtocolError("Language-server frame exceeds 16 MB")
        chunks=[];remaining=length
        while remaining:
            chunk=self._stdout.read(remaining)
            if not chunk:raise LspProtocolError("Language server disconnected inside a JSON-RPC frame")
            chunks.append(chunk);remaining-=len(chunk)
        body=b"".join(chunks)
        value = json.loads(body.decode("utf-8"))
        if not isinstance(value, dict):
            raise LspProtocolError("Language server emitted a non-object JSON-RPC message")
        return value

    def _read_loop(self) -> None:
        while not self._stop.is_set():
            try:
                message = self._read_message()
                if message is None:
                    break
                if "id" in message and ("result" in message or "error" in message):
                    try:
                        request_id = int(message["id"])
                    except (TypeError, ValueError):
                        continue
                    with self._pending_lock:
                        target = self._pending.get(request_id)
                    if target:
                        target.put(message)
                    continue
                method = message.get("method")
                if "id" in message and method:
                    if method == "workspace/configuration":
                        result=[{} for _ in (message.get("params") or {}).get("items",[])]
                    elif method == "workspace/applyEdit":
                        result={"applied":False,"failureReason":"Edits require Solarium's reviewed native save path"}
                    elif method in {"client/registerCapability","client/unregisterCapability","window/workDoneProgress/create"}:
                        result=None
                    else:
                        self._write({"jsonrpc":"2.0","id":message["id"],"error":{"code":-32601,"message":"Unsupported client request"}})
                        continue
                    self._write({"jsonrpc":"2.0","id":message["id"],"result":result})
                    continue
                if method == "textDocument/publishDiagnostics":
                    params = message.get("params") or {}
                    uri = str(params.get("uri") or "")
                    diagnostics = params.get("diagnostics") or []
                    if uri:
                        self.diagnostics[_uri_key(uri)] = list(diagnostics) if isinstance(diagnostics, list) else []
                        self.diagnostic_versions[_uri_key(uri)]=params.get("version")
            except Exception as exc:
                self.log.append(f"Protocol reader error: {exc}")
                self.log[:] = self.log[-200:]
                break

        with self._pending_lock:
            for target in self._pending.values():
                try:target.put_nowait({"error":{"message":"Language server disconnected"}})
                except queue.Full:pass

    def _write(self, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        frame = f"Content-Length: {len(data)}\r\n\r\n".encode("ascii") + data
        with self._send_lock:
            self._stdin.write(frame)
            self._stdin.flush()

    def request(self, method: str, params: dict[str, Any] | None = None, timeout: float = 20.0) -> Any:
        if self.process.poll() is not None:
            raise RuntimeError(f"{self.definition.family} language server exited with code {self.process.returncode}")
        with self._pending_lock:
            request_id = self._next_id
            self._next_id += 1
            target: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=1)
            self._pending[request_id] = target
        try:
            self._write({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}})
            try:
                response = target.get(timeout=timeout)
            except queue.Empty as exc:
                raise TimeoutError(f"LSP request timed out: {method}") from exc
            if "error" in response:
                raise LspProtocolError(json.dumps(response["error"], ensure_ascii=False))
            return response.get("result")
        finally:
            with self._pending_lock:
                self._pending.pop(request_id, None)

    def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        if self.process.poll() is None:
            self._write({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def _initialize(self) -> None:
        capabilities = {
            "textDocument": {
                "completion": {"completionItem": {"snippetSupport": True}},
                "hover": {"contentFormat": ["markdown", "plaintext"]},
                "definition": {"linkSupport": True},
                "references": {},
                "publishDiagnostics": {"relatedInformation": True},
                "synchronization": {"didSave": True},
            },
            "workspace": {"workspaceFolders": True, "symbol": {}},
        }
        self.request("initialize", {
            "processId": os.getpid(),
            "rootUri": _uri(self.root),
            "workspaceFolders": [{"uri": _uri(self.root), "name": self.root.name}],
            "capabilities": capabilities,
            "clientInfo": {"name": "Solarium Glitch workspace", "version": "0.1"},
        }, timeout=30.0)
        self.notify("initialized", {})

    def close(self) -> None:
        if self._stop.is_set():
            return
        try:
            if self.process.poll() is None:
                try:
                    self.request("shutdown", {}, timeout=3.0)
                except Exception:
                    pass
                try:
                    self.notify("exit", {})
                except Exception:
                    pass
        finally:
            self._stop.set()
            self._job.close()
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=2.0)
            for stream in (self.process.stdin,self.process.stdout,self.process.stderr):
                if stream is not None:stream.close()
            self._reader.join(timeout=1.0)


class LspManager:
    def __init__(self):
        self.root: Path | None = None
        self.definitions: list[ServerDefinition] = []
        self.processes: dict[str, LspProcess] = {}
        self.document_versions: dict[str, int] = {}
        self.document_text: dict[str,str] = {}
        self._lock = threading.RLock()

    def set_workspace(self, root: Path) -> dict[str, Any]:
        root = root.resolve()
        with self._lock:
            if self.root != root:
                self.close()
                self.root = root
                self.definitions = discover_servers(root)
        return self.status()

    def _definition(self, language: str) -> ServerDefinition | None:
        return next((item for item in self.definitions if language in item.languages), None)

    def _language_for(self, path: Path, explicit: str | None = None) -> str:
        if path.suffix.lower() in {".tsx",".jsx"}:
            return LANGUAGE_BY_SUFFIX[path.suffix.lower()]
        if explicit:
            return explicit
        return LANGUAGE_BY_SUFFIX.get(path.suffix.lower(), "plaintext")

    def _process_for(self, path: Path, language: str | None = None) -> LspProcess | None:
        if self.root is None:
            raise RuntimeError("No workspace is open")
        language_id = self._language_for(path, language)
        definition = self._definition(language_id)
        if definition is None:
            return None
        with self._lock:
            process = self.processes.get(definition.family)
            if process is None or process.process.poll() is not None:
                if process is not None:
                    process.close()
                process = LspProcess(definition, self.root)
                self.processes[definition.family] = process
            return process

    def open_document(self, path: str, text: str, language: str | None = None) -> dict[str, Any]:
        p = Path(path).resolve()
        if self.root is None or not p.is_relative_to(self.root):
            raise PermissionError("Document is outside the selected project")
        process = self._process_for(p, language)
        if process is None:
            return {"available": False, "language": self._language_for(p, language)}
        uri = _uri(p)
        if uri in self.document_versions:
            if self.document_text.get(uri)==text:return {"available":True,"family":process.definition.family,"version":self.document_versions[uri]}
            return self.change_document(path,text,language)
        version = self.document_versions.get(uri, 0) + 1
        self.document_versions[uri] = version
        self.document_text[uri]=text
        process.diagnostics.pop(_uri_key(uri),None)
        process.diagnostic_versions.pop(_uri_key(uri),None)
        process.notify("textDocument/didOpen", {"textDocument": {"uri": uri, "languageId": self._language_for(p, language), "version": version, "text": text}})
        return {"available": True, "family": process.definition.family, "language": self._language_for(p, language), "version": version}

    def change_document(self, path: str, text: str, language: str | None = None) -> dict[str, Any]:
        p = Path(path).resolve()
        if self.root is None or not p.is_relative_to(self.root):
            raise PermissionError("Document is outside the selected project")
        process = self._process_for(p, language)
        if process is None:
            return {"available": False, "language": self._language_for(p, language)}
        uri = _uri(p)
        if uri not in self.document_versions:return self.open_document(path,text,language)
        version = self.document_versions.get(uri, 0) + 1
        self.document_versions[uri] = version
        self.document_text[uri]=text
        process.diagnostics.pop(_uri_key(uri),None)
        process.diagnostic_versions.pop(_uri_key(uri),None)
        process.notify("textDocument/didChange", {"textDocument": {"uri": uri, "version": version}, "contentChanges": [{"text": text}]})
        return {"available": True, "family": process.definition.family, "version": version}

    def save_document(self, path: str, text: str | None = None, language: str | None = None) -> dict[str, Any]:
        p = Path(path).resolve()
        if self.root is None or not p.is_relative_to(self.root):
            raise PermissionError("Document is outside the selected project")
        process = self._process_for(p, language)
        if process is None:
            return {"available": False}
        params: dict[str, Any] = {"textDocument": {"uri": _uri(p)}}
        if text is not None:
            params["text"] = text
        process.notify("textDocument/didSave", params)
        return {"available": True, "family": process.definition.family}

    def close_document(self, path: str, language: str | None = None) -> dict[str, Any]:
        p = Path(path).resolve()
        if self.root is None or not p.is_relative_to(self.root):
            raise PermissionError("Document is outside the selected project")
        process = self._process_for(p, language)
        if process is None:
            return {"available": False}
        uri = _uri(p)
        process.notify("textDocument/didClose", {"textDocument": {"uri": uri}})
        self.document_versions.pop(uri, None)
        self.document_text.pop(uri, None)
        return {"available": True, "family": process.definition.family}

    def request(self, path: str, method: str, params: dict[str, Any], language: str | None = None) -> dict[str, Any]:
        p = Path(path).resolve()
        if self.root is None or not p.is_relative_to(self.root):
            raise PermissionError("Document is outside the selected project")
        process = self._process_for(p, language)
        if process is None:
            return {"available": False, "result": None}
        return {"available": True, "family": process.definition.family, "result": process.request(method, params)}

    def diagnostics_for(self, path: str, language: str | None = None) -> dict[str, Any]:
        p = Path(path).resolve()
        if self.root is None or not p.is_relative_to(self.root):
            raise PermissionError("Document is outside the selected project")
        process = self._process_for(p, language)
        if process is None:
            return {"available": False, "diagnostics": []}
        uri=_uri_key(_uri(p));version=process.diagnostic_versions.get(uri);current=self.document_versions.get(_uri(p))
        pending=uri not in process.diagnostics or version is not None and version!=current
        return {"available": True, "pending":pending,"version":version,"documentVersion":current,"family": process.definition.family, "diagnostics": [] if pending else process.diagnostics[uri]}

    def status(self) -> dict[str, Any]:
        with self._lock:
            definitions = [{"family": d.family, "command": d.command, "languages": list(d.languages)} for d in self.definitions]
            running = {
                family: {
                    "pid": process.process.pid,
                    "alive": process.process.poll() is None,
                    "languages": list(process.definition.languages),
                    "logTail": process.log[-20:],
                }
                for family, process in self.processes.items()
            }
        return {"root": str(self.root) if self.root else None, "available": definitions, "running": running}

    def close(self) -> None:
        with self._lock:
            processes = list(self.processes.values())
            self.processes = {}
            self.document_versions = {}
            self.document_text = {}
        for process in processes:
            process.close()
