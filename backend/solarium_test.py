"""Regression tests for the imported project service. No alternative Solarium client."""
import io,json,os,subprocess,sys,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
from solarium import ProjectService,scoped_path
from project.lsp import LspProcess

class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="solarium-glitch-")
        self.base=Path(self.temp.name);self.root=self.base/"project";self.root.mkdir()
        self.other=self.base/"other";self.other.mkdir()
        self.env=patch.dict(os.environ,{"SOLARIUM_PROJECT_CACHE":str(self.base/"cache"),"SOLARIUM_TYPESCRIPT_LANGUAGE_SERVER":str(Path(__file__).resolve().parents[1]/"node_modules/.bin/typescript-language-server.cmd")})
        self.env.start();self.service=ProjectService()
    def tearDown(self):
        self.service.close();self.env.stop();self.temp.cleanup()
    def call(self,method,**params):return self.service.request(str(self.root),method,params)
    def test_scopes_and_forbidden_operations(self):
        (self.other/"secret.py").write_text("def secret(): pass",encoding="utf-8")
        for path in [str(self.other/"secret.py"),"../other/secret.py"]:
            with self.assertRaises(PermissionError):self.call("lsp.open",path=path,text="")
        for method in ["generate","model.load","write_file","run_shell"]:
            with self.assertRaises(ValueError):self.call(method)
        self.assertEqual(self.call("health")["loadedTensorModules"],[])
    def test_latest_symbols_removals_and_project_isolation(self):
        source=self.root/"birbs.py";source.write_text("def chirp():\n    return '水😀'\n",encoding="utf-8")
        self.assertEqual(self.call("project.symbols",query="chirp")["items"][0]["path"],str(source))
        self.assertEqual(self.service.request(str(self.other),"project.symbols",{"query":"chirp"})["items"],[])
        source.write_text("def fly():\n    return 2\n",encoding="utf-8")
        self.assertEqual(self.call("project.symbols",query="chirp")["items"],[])
        self.assertEqual(len(self.call("project.symbols",query="fly")["items"]),1)
        source.unlink();self.assertEqual(self.call("project.symbols",query="fly")["items"],[])
    def test_exact_context_refresh_and_stable_repeated_evidence(self):
        source=self.root/"birds.ts";text="export function feedBirds() { return '水😀'; }\n";source.write_text(text,encoding="utf-8")
        first=self.call("project.context",query="feedBirds");second=self.call("project.context",query="feedBirds")
        self.assertIn(text.strip(),first["text"]);self.assertEqual(first["text"],second["text"])
        source.write_text(text.replace("水😀","café"),encoding="utf-8")
        self.assertIn("café",self.call("project.context",query="feedBirds")["text"])
    def test_pruned_dependencies_and_authored_runtime_folder(self):
        dependency=self.root/"node_modules";dependency.mkdir();(dependency/"hidden.py").write_text("def hidden(): pass")
        runtime=self.root/"runtime";runtime.mkdir();(runtime/"authored.py").write_text("def authored(): pass")
        self.assertEqual(self.call("project.symbols",query="hidden")["items"],[])
        self.assertEqual(len(self.call("project.symbols",query="authored")["items"]),1)
    def test_symlink_escape_is_rejected(self):
        target=self.other/"secret.py";target.write_text("def secret(): pass")
        try:(self.root/"link.py").symlink_to(target)
        except OSError as error:self.skipTest("Host does not permit symlink creation: "+str(error))
        with self.assertRaises(PermissionError):scoped_path(self.root,"link.py")
        self.assertEqual(self.call("project.symbols",query="secret")["items"],[])
    def test_real_typescript_server_diagnostics_definition_and_dirty_isolation(self):
        source=self.root/"birds.ts";text="export function feedBirds() { return 42; }\nconst broken: string = feedBirds();\n"
        source.write_text(text,encoding="utf-8")
        opened=self.call("lsp.open",path=str(source),text=text,language="typescript")
        self.assertTrue(opened["available"],"Installed TypeScript server must actually run")
        result=self.call("lsp.request",path=str(source),lspMethod="textDocument/definition",lspParams={"textDocument":{"uri":source.as_uri()},"position":{"line":1,"character":25}})
        self.assertTrue(result["result"])
        deadline=time.monotonic()+15
        while time.monotonic()<deadline:
            diagnostics=self.call("lsp.diagnostics",path=str(source))
            if not diagnostics.get("pending"):break
            time.sleep(.1)
        self.assertFalse(diagnostics.get("pending"));self.assertTrue(any(str(item.get("code"))=="2322" for item in diagnostics["diagnostics"]))
        dirty=text+"// unsaved editor note 水😀\n";self.call("lsp.change",path=str(source),text=dirty)
        disk=self.call("lsp.diagnostics",path=str(source),disk=True)
        self.assertFalse(disk["available"]);self.assertIn("unsaved",disk["reason"])
        session=next(iter(self.service.projects.values()));self.assertEqual(session.lsp.document_text[source.as_uri()],dirty)
        with self.assertRaises(PermissionError):self.call("lsp.request",path=str(source),lspMethod="textDocument/definition",lspParams={"textDocument":{"uri":(self.other/"secret.ts").as_uri()}})
    def test_inspect_uses_compiler_and_preserves_editor_ownership(self):
        source=self.root/"nav.ts";text="export function chirp() { return 42; }\nconst count = chirp();\n"
        source.write_text(text,encoding="utf-8")
        result=self.call("lsp.inspect",path="nav.ts",line=2,column=16,kind="definition")
        self.assertEqual(result["provider"],"language-server");self.assertTrue(result["result"])
        refs=self.call("lsp.inspect",path="nav.ts",line=1,column=18,kind="references")
        self.assertGreaterEqual(len(refs["result"]),2)
        dirty=text+"// editor owns this buffer\n";self.call("lsp.open",path=str(source),text=dirty,editorId="live")
        result=self.call("lsp.inspect",path="nav.ts",line=2,column=16,kind="hover")
        self.assertEqual(result["source"],"editor-buffer")
        session=next(iter(self.service.projects.values()));self.assertEqual(session.lsp.document_text[source.as_uri()],dirty)
        with self.assertRaises(PermissionError):self.call("lsp.inspect",path="../other/secret.ts",line=1,column=1,kind="definition")
    @unittest.skipUnless(os.name == "nt", "Windows extended path regression")
    def test_windows_extended_roots_share_the_same_scoped_document(self):
        source=self.root/"extended.ts";text="export const value = 42;\n";source.write_text(text,encoding="utf-8")
        extended="\\\\?\\"+str(self.root)
        opened=self.service.request(extended,"lsp.open",{"path":str(source),"text":text,"editorId":"live"})
        self.assertTrue(opened["available"])
        result=self.service.request(str(self.root),"lsp.diagnostics",{"path":"\\\\?\\"+str(source),"editorId":"live"})
        self.assertTrue(result["available"])
        self.assertEqual(len(self.service.projects),1)
        with self.assertRaises(PermissionError):self.service.request(extended,"lsp.open",{"path":str(self.other/"foreign.ts"),"text":""})
    def test_stdio_health_and_forbidden_rpc_roundtrip(self):
        requests=[{"id":"one","method":"health","root":"","params":{}},{"id":"two","method":"model.load","root":str(self.root),"params":{}}]
        run=subprocess.run([sys.executable,"-I","-X","utf8",str(Path(__file__).with_name("solarium.py"))],input="".join(json.dumps(r)+"\n" for r in requests),text=True,encoding="utf-8",capture_output=True,timeout=20)
        self.assertEqual(run.returncode,0,run.stderr);rows=[json.loads(s) for s in run.stdout.splitlines()]
        self.assertEqual([r["id"] for r in rows],["one","two"]);self.assertTrue(rows[0]["ok"]);self.assertFalse(rows[1]["ok"]);self.assertFalse(rows[0]["result"]["loadsModel"])
    def test_disk_query_and_old_editor_cleanup_cannot_replace_a_live_buffer(self):
        source=self.root/"owner.ts";source.write_text("export const a=1;",encoding="utf-8")
        self.call("lsp.open",path=str(source),text=source.read_text(),editorId="old")
        result=self.call("lsp.diagnostics",path=str(source),disk=True)
        self.assertFalse(result["available"]);self.assertEqual(result["source"],"editor-buffer")
        self.call("lsp.open",path=str(source),text="export const a=2;",editorId="new")
        self.assertTrue(self.call("lsp.close",path=str(source),editorId="old")["staleOwner"])
        self.assertTrue(self.call("lsp.change",path=str(source),text="stale",editorId="old")["staleOwner"])
        session=next(iter(self.service.projects.values()));self.assertEqual(session.lsp.document_text[source.as_uri()],"export const a=2;")
    def test_fragmented_unicode_lsp_frame(self):
        body=json.dumps({"jsonrpc":"2.0","result":"水😀"},ensure_ascii=False).encode()
        class Fragmented(io.BytesIO):
            def read(self,n=-1):return super().read(min(n,3) if n>=0 else 3)
        process=object.__new__(LspProcess);import threading
        process._stop=threading.Event();process._stdout=Fragmented(f"Content-Length: {len(body)}\r\n\r\n".encode()+body)
        self.assertEqual(process._read_message()["result"],"水😀")
if __name__=="__main__":unittest.main()
