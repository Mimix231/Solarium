import type { ChatAttachment, ChatSource } from '../domain/types';
import { uid } from '../domain/types';
const invokeDesktop = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) throw Error('This feature requires Solarium Desktop.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(name, args);
};
export const createProjectDirectory = (parent: string, name: string) => invokeDesktop<string>('create_project_directory', { parent, name });
export interface CodeMatch { path: string; line: number; text: string }
export const searchProjectCode = (root: string, query: string) => invokeDesktop<CodeMatch[]>('search_project_code', { root, query });
export const replaceProjectText = (root: string, relative: string, expectedFragment: string, replacement: string) => invokeDesktop<number>('replace_project_text', { root, relative, expectedFragment, replacement });
export interface ProjectFileChange { path: string; content: string; expected?: string | null }
export interface AppliedChange { path: string; operation: 'created' | 'updated' }
export const applyProjectChanges = (root: string, files: ProjectFileChange[]) => invokeDesktop<AppliedChange[]>('apply_project_changes', { root, files });
export const listProjectFiles = (root: string) => invokeDesktop<string[]>('list_project_files', { root });
export interface ProjectInspection { files:string[];fileCount:number;rootEntryCount:number;truncated:boolean;manifests:{path:string;content:string}[];hasGit:boolean;dependenciesInstalled:boolean;errors:string[] }
export const inspectProjectEnvironment = (root:string) => invokeDesktop<ProjectInspection>('inspect_project_environment',{root});
export const readProjectFile = (root: string, relative: string) => invokeDesktop<string>('read_project_file', { root, relative });
export const writeProjectFile = (root: string, relative: string, content: string, expected: string) => invokeDesktop<void>('write_project_file', { root, relative, content, expected });
export const inspectGeneratedFile = (root: string, relative: string) => invokeDesktop<{ exists: boolean; current: string }>('inspect_generated_file', { root, relative });
export const saveGeneratedFile = (root: string, relative: string, content: string, expected: string | null) => invokeDesktop<void>('save_generated_file', { root, relative, content, expected });
export interface ProjectCheckResult { command: string; exit_code: number | null; stdout: string; stderr: string; timed_out: boolean }
export interface ProjectCheckOutput { stream: 'stdout' | 'stderr'; chunk: string }
export async function runProjectCheck(root: string, check: string, onOutput?: (event: ProjectCheckOutput) => void): Promise<ProjectCheckResult> {
  if (!onOutput) return invokeDesktop<ProjectCheckResult>('run_project_check', { root, check });
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) throw Error('Project checks require Solarium Desktop.');
  const { Channel, invoke } = await import('@tauri-apps/api/core');
  const channel = new Channel<ProjectCheckOutput>();
  channel.onmessage = (event) => onOutput(event);
  return invoke<ProjectCheckResult>('run_project_check_stream', { root, check, onEvent: channel });
}
export const searchPublicWeb = (query: string, webEnabled=false, provider?:import('../research/research').SearchProviderConfig) => {
  if(!webEnabled) return Promise.reject(Error('Web Search is OFF.'));
  return invokeDesktop<ChatSource[]>('search_public_web', { query, webEnabled, provider });
};
export const readPublicWebpage = (url: string, webEnabled=false) => {
  if(!webEnabled) return Promise.reject(Error('Web Search is OFF.'));
  return invokeDesktop<string>('read_public_webpage', { url,webEnabled });
};
export const readResearchPage = (url:string,query:string,webEnabled=false,storyReference=false) => {
  if(!webEnabled) return Promise.reject(Error('Web Search is OFF.'));
  return invokeDesktop<import('../research/research').ResearchPage>('read_research_page',{url,query,webEnabled,storyReference}).then(page=>({...page,retrievedAt:page.retrievedAt.startsWith('unix:')?new Date(Number(page.retrievedAt.slice(5))*1000).toISOString():page.retrievedAt}));
};

const imageTypes = ['image/png','image/jpeg','image/webp'];
const textExtensions = /\.(?:txt|md|ts|tsx|js|jsx|json|css|html|py|rs|go|java|cpp|c|h|xml|yml|yaml|toml|sql|csv|sh|log|svg)$/i;
const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('Could not read image')); reader.readAsDataURL(file); });
/** Explicit 8-file limit; never silently strip file content before submitting to a model. */
export async function readAttachments(files: FileList | File[]): Promise<ChatAttachment[]> {
  const selected = Array.from(files);
  if (selected.length > 8) throw Error('Attach up to eight files per message.');
  const attachments: ChatAttachment[] = [];
  for (const file of selected) {
    if (imageTypes.includes(file.type)) {
      if (file.size > 1_500_000) throw Error(`${file.name}: images must be smaller than 1.5 MB.`);
      attachments.push({ id: uid(), name: file.name, kind: 'image', size: file.size, mime: file.type, dataUrl: await readAsDataUrl(file) });
    } else if (textExtensions.test(file.name) || file.type.startsWith('text/')) {
      if (file.size > 450_000) throw Error(`${file.name}: text attachments must be smaller than 450 KB.`);
      attachments.push({ id: uid(), name: file.name, kind: 'text', size: file.size, mime: file.type || 'text/plain', text: await file.text() });
    } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > 8_000_000) throw Error(`${file.name}: PDFs must be smaller than 8 MB.`);
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, disableFontFace: true }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(document.numPages, 80); i++) {
        const page = await document.getPage(i); const content = await page.getTextContent();
        pages.push(`[Page ${i}] ${content.items.map((item: unknown) => {
          if (typeof item !== 'object' || item === null || !('str' in item)) return '';
          return typeof item.str === 'string' ? item.str : '';
        }).join(' ')}`);
      }
      attachments.push({ id: uid(), name: file.name, kind: 'document', size: file.size, mime: 'application/pdf', text: pages.join('\n').slice(0, 110_000) });
    } else if (/\.docx$/i.test(file.name)) {
      if (file.size > 8_000_000) throw Error(`${file.name}: Word documents must be smaller than 8 MB.`);
      const { default: mammoth } = await import('mammoth/mammoth.browser');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      attachments.push({ id: uid(), name: file.name, kind: 'document', size: file.size, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: result.value.slice(0,110_000) });
    } else throw Error(`${file.name}: unsupported attachment type. Use images, PDF, DOCX or text/code files.`);
  }
  return attachments;
}
