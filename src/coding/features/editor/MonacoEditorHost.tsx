import { useCallback, useEffect, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Braces,FolderOpen,Sparkles } from "lucide-react";
import { useWorkbenchStore } from "../../stores/workbenchStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { defineGlitchMonaco } from "../../theme/monacoTheme";
import { registerGlitchLsp } from "./lspIntegration";
import { projectRequest } from "../../integration/api";
import { useSolarium } from "../../../state/useSolarium";
import { normalizedRoot,sourceFileUri } from "../../integration/session";
import type { Monaco } from "@monaco-editor/react";
import type { EditorDiagnostic, LspDiagnosticResult } from "../../lib/types";

function mapLspDiagnostics(result: LspDiagnosticResult): EditorDiagnostic[] {
  return result.diagnostics.map(item => ({
    severity: item.severity === 1 ? 8 : item.severity === 2 ? 4 : item.severity === 3 ? 2 : 1,
    message: item.message,
    startLineNumber: item.range.start.line + 1,
    startColumn: item.range.start.character + 1,
    endLineNumber: item.range.end.line + 1,
    endColumn: item.range.end.character + 1,
    source: item.source ? `LSP · ${item.source}` : "LSP",
    code: item.code,
  }));
}

export default function MonacoEditorHost() {
  const docs = useDocumentStore(s => s.documents);
  const activePath = useDocumentStore(s => s.activePath);
  const update = useDocumentStore(s => s.update);
  const reveal = useDocumentStore(s => s.reveal);
  const settings = useSettingsStore(s => s.settings);
  const reducedMotion=useSolarium(s=>s.workspace.preferences.reducedMotion);
  const setDiagnostics = useDocumentStore(s => s.setDiagnostics);
  const setViewState = useDocumentStore(s => s.setViewState);
  const selectedOwner=useSolarium(state=>state.workspace.projects?.find(p=>p.id===state.workspace.activeProjectId)?.folder??'');
  const lspReady=useRef(false),monacoRef=useRef<Monaco|null>(null);
  const editorOwner=useRef('');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoMarkers = useRef<EditorDiagnostic[]>([]);
  const lspMarkers = useRef<EditorDiagnostic[]>([]);
  const changeTimer = useRef<number | undefined>(undefined);
  const active = docs.find(d => d.path === activePath);
  const activeRef=useRef(active);activeRef.current=active;
  const owner=active?.sourceRoot??selectedOwner;
  const activeFile=active?.path,activeLanguage=active?.language,savedContent=active?.savedContent;
  const activeContent=active?.content;

  const publishDiagnostics = useCallback((path: string) => {
    setDiagnostics(path, [...monacoMarkers.current, ...lspMarkers.current]);
  }, [setDiagnostics]);

  const before: BeforeMount = monaco => {
    monacoRef.current=monaco;
    defineGlitchMonaco(monaco);
    registerGlitchLsp(monaco);
  };

  const mounted: OnMount = ed => {
    editorRef.current = ed;
    if (active?.viewState) ed.restoreViewState(active.viewState as editor.ICodeEditorViewState);
    ed.focus();
    if (reveal && reveal.path === activePath) {
      ed.revealLineInCenter(reveal.line);
      ed.setPosition({ lineNumber: reveal.line, column: reveal.column });
    }
  };

  useEffect(() => {
    const ed = editorRef.current;
    if (ed && reveal && reveal.path === activePath) {
      ed.revealLineInCenter(reveal.line);
      ed.setPosition({ lineNumber: reveal.line, column: reveal.column });
      ed.focus();
    }
  }, [reveal, activePath]);

  // Keep only one diagnostics request in flight, with an explicit document owner.
  useEffect(()=>{
    if(!activeFile||!owner||!settings.lspEnabled||!normalizedRoot(activeFile).startsWith(normalizedRoot(owner)+'/'))return;
    let disposed=false;let timer:number|undefined;lspReady.current=false;monacoMarkers.current=[];lspMarkers.current=[];
    const params={path:activeFile,language:activeLanguage,editorId:crypto.randomUUID()};editorOwner.current=params.editorId;
    const poll=async()=>{try{const result=await projectRequest<LspDiagnosticResult>('lsp.diagnostics',params,owner);if(disposed)return;lspMarkers.current=result.available?mapLspDiagnostics(result):[];const model=editorRef.current?.getModel();if(model)monacoRef.current?.editor.setModelMarkers(model,'solarium-lsp',lspMarkers.current);publishDiagnostics(activeFile);}catch(error){if(!disposed)void import('../../stores/workspaceStore').then(({useWorkspaceStore})=>useWorkspaceStore.setState({error:'Language services: '+String(error)}));}finally{if(!disposed)timer=window.setTimeout(()=>void poll(),1200);}};
    void(async()=>{try{const result=await projectRequest<{available:boolean}>('lsp.open',{...params,text:activeRef.current?.content??''},owner);if(disposed){if(result.available)await projectRequest('lsp.close',params,owner);return;}lspReady.current=result.available;if(!result.available)return;await projectRequest('lsp.change',{...params,text:activeRef.current?.content??''},owner);await poll();}catch(error){if(!disposed)void import('../../stores/workspaceStore').then(({useWorkspaceStore})=>useWorkspaceStore.setState({error:'Language services: '+String(error)}));}})();
    return()=>{disposed=true;window.clearTimeout(timer);window.clearTimeout(changeTimer.current);const state=editorRef.current?.saveViewState();if(state)setViewState(activeFile,state);void projectRequest('lsp.close',params,owner).catch(()=>{});lspReady.current=false;};
  },[activeFile,activeLanguage,owner,settings.lspEnabled,publishDiagnostics,setViewState]);
  // Both typing and verified external/recovery updates change the same buffer.
  // Monaco's controlled value updates do not always emit its onChange callback.
  useEffect(()=>{
    if(!activeFile||!owner||!settings.lspEnabled||!lspReady.current)return;
    const editorId=editorOwner.current;
    window.clearTimeout(changeTimer.current);
    changeTimer.current=window.setTimeout(()=>{void projectRequest('lsp.change',{path:activeFile,text:activeContent??'',language:activeLanguage,editorId},owner).catch(()=>{});},140);
    return()=>window.clearTimeout(changeTimer.current);
  },[activeContent,activeFile,activeLanguage,owner,settings.lspEnabled]);
  useEffect(()=>{if(!activeFile||!owner||!settings.lspEnabled||!lspReady.current)return;void projectRequest('lsp.save',{path:activeFile,text:savedContent,language:activeLanguage,editorId:editorOwner.current},owner).catch(()=>{});},[activeFile,activeLanguage,savedContent,owner,settings.lspEnabled]);

  if (!active) {
    return <div className="studio-editor-empty"><div className="studio-empty-glyph"><Braces size={34}/></div><h2>A little space. A lot of possibility.</h2><p>Open your project source, or bring a generated code block from chat. Your files, edits and ideas belong together.</p><div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}><button className="studio-button studio-primary" onClick={()=>void useWorkspaceStore.getState().choose().catch(error=>useWorkspaceStore.setState({error:String(error)}))}><FolderOpen size={14}/>Open a project</button><button className="studio-button" onClick={()=>useWorkbenchStore.getState().setSidebarView('generated')}><Sparkles size={14}/>Generated source</button></div><div className="studio-empty-shortcuts"><span><kbd>Ctrl P</kbd>Quick open</span><span><kbd>Ctrl Shift P</kbd>Commands</span></div></div>;
  }

  return <Editor
    key={active.path}
    beforeMount={before}
    onMount={mounted}
    path={active.generated?`solarium-generated:///${active.generated.artifactId}/${encodeURIComponent(active.name)}`:sourceFileUri(active.path)}
    language={active.language}
    value={active.content}
    theme="solarium-studio"
    onChange={value => {
      const content = value ?? "";
      update(active.path, content);
    }}
    onValidate={markers => {
      monacoMarkers.current = markers.filter(m=>!m.source?.startsWith("LSP")).map(m => ({
        severity: m.severity,
        message: m.message,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn,
        source: m.source,
        code: typeof m.code === "string" ? m.code : m.code?.value,
      }));
      publishDiagnostics(active.path);
    }}
    options={{
      automaticLayout: true,
      fontFamily: settings.editorFontFamily,
      fontSize: settings.editorFontSize,
      lineHeight:Math.round(settings.editorFontSize*1.75),
      letterSpacing:.15,
      lineNumbersMinChars:3,
      glyphMargin:false,
      roundedSelection:true,
      cursorSmoothCaretAnimation:reducedMotion?"off":"explicit",
      cursorBlinking:reducedMotion?"solid":"smooth",
      fontLigatures: true,
      minimap: { enabled: settings.editorMinimap },
      wordWrap: settings.editorWordWrap,
      scrollBeyondLastLine: false,
      smoothScrolling: !reducedMotion,
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      padding: { top: 18, bottom: 24 },
      tabSize: settings.editorTabSize,
      insertSpaces: settings.editorInsertSpaces,
      formatOnPaste: true,
      formatOnType: false,
      stickyScroll: { enabled: settings.editorStickyScroll },
    }}
  />;
}
