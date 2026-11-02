export type SidebarView = "explorer" | "search" | "source-control" | "run" | "generated";

export type BottomView = "problems" | "terminal" | "language";

export interface CodeWorkspaceSettings {
  editorFontSize:number;editorFontFamily:string;editorWordWrap:'off'|'on';editorMinimap:boolean;
  editorTabSize:number;editorInsertSpaces:boolean;editorStickyScroll:boolean;editorAutoSave:'off'|'afterDelay';
  editorAutoSaveDelayMs:number;lspEnabled:boolean;restoreWorkspace:boolean;terminalFontSize:number;terminalFontFamily:string;
  autoWatchWorkspace:boolean;confirmDeletes:boolean;explorerWidth:number;bottomHeight:number;ambientMotion:boolean;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export interface OpenDocument {
  sourceRoot?:string;
  generated?:{messageId?:string;artifactId:string;access:import('../artifacts/repository').CodeAccessContext;version:number};
  path: string;
  name: string;
  language: string;
  content: string;
  savedContent: string;
  viewState?: unknown;
  externalVersion?: number;
  pinned?: boolean;
  preview?: boolean;
}

export interface EditorDiagnostic {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source?: string;
  code?: string | number;
}

export interface WorkspaceFsEvent { root?:string; kind:string; paths:string[]; error?:string }

export interface SearchHit {
  path: string;
  relativePath: string;
  line: number;
  column: number;
  preview: string;
}

export interface TerminalEvent {
  terminalId: string;
  kind: "data" | "exit" | "error";
  data?: string;
  code?: number | null;
  error?: string;
}

export interface TerminalDescriptor {
  root?: string;
  id: string;
  title: string;
  cwd: string;
  shell: string;
}

export interface ProjectIndexSummary {
  root: string;
  files: number;
  symbols: number;
  imports: number;
  languages: Record<string, number>;
  indexedAt: number;
  changedFiles?: number;
  database?: string | null;
}

export interface ProjectTask { service?:boolean;network?:boolean;behavioral?:boolean; id: string; label: string; command: string; kind: string; cwd: string; }

export interface GitFileStatus { path: string; indexStatus: string; worktreeStatus: string; }

export interface GitStatus { repository: boolean; branch?: string | null; files: GitFileStatus[]; }

export interface SymbolLocation { name: string; kind: string; path: string; line: number; column: number; signature?: string | null; }

export interface LspServerDefinition { family:string; command:string[]; languages:string[]; }

export interface LspRunningServer { pid:number; alive:boolean; languages:string[]; logTail:string[]; }

export interface LspStatus { root?:string|null; available:LspServerDefinition[]; running:Record<string,LspRunningServer>; }

export interface LspDocumentResult { available:boolean; family?:string; language?:string; version?:number; }

export interface LspRequestResult<T=unknown> { available:boolean; family?:string; result:T|null; }

export interface LspDiagnosticResult { available:boolean; pending?:boolean; family?:string; diagnostics:Array<{range:{start:{line:number;character:number};end:{line:number;character:number}};severity?:number;code?:string|number;source?:string;message:string}>; }
