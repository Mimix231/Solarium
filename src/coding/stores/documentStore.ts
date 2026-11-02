import { CodeRepository,generatedPath,type CodeAccessContext } from '../artifacts/repository';
import type { AccessContext } from '../../foundation/types';
import { create } from "zustand";
import { api,selectedRoot } from "../integration/api";
import type { EditorDiagnostic, OpenDocument } from "../lib/types";

const extLang: Record<string,string> = { ts:"typescript",tsx:"typescript",js:"javascript",jsx:"javascript",py:"python",rs:"rust",json:"json",md:"markdown",css:"css",scss:"scss",html:"html",xml:"xml",mjs:"javascript",cjs:"javascript",mts:"typescript",cts:"typescript",yml:"yaml",yaml:"yaml",toml:"toml",cpp:"cpp",c:"c",h:"cpp",hpp:"cpp",java:"java",kt:"kotlin",go:"go",sh:"shell",ps1:"powershell" };
function language(path:string){ const ext=path.split(".").pop()?.toLowerCase() ?? ""; return extLang[ext] ?? "plaintext"; }
function normalized(path:string){return path.replace(/\\/g,"/");}
function isAtOrUnder(path:string,parent:string){const p=normalized(path),root=normalized(parent).replace(/\/$/,"");return p===root||p.startsWith(`${root}/`);}
function remapped(path:string,oldPath:string,newPath:string){const p=normalized(path),old=normalized(oldPath).replace(/\/$/,"");if(p===old)return newPath;if(!p.startsWith(`${old}/`))return path;const suffix=p.slice(old.length+1);const sep=newPath.includes("\\")?"\\":"/";return `${newPath}${sep}${suffix.replace(/\//g,sep)}`;}
let documentGeneration=0;let latestOpen=0;
const saving=new Map<string,Promise<void>>();
interface Reveal { path:string;line:number;column:number;nonce:number }
interface ClosedDocument { path:string;name:string;at:number;generated?:OpenDocument['generated'] }
interface State {
  documents: OpenDocument[]; activePath?: string; reveal?:Reveal; diagnostics:Record<string,EditorDiagnostic[]>; recentlyClosed:ClosedDocument[];
  openGenerated(id:string,access:CodeAccessContext):Promise<void>;
  open(path:string,name?:string,line?:number,column?:number,preview?:boolean):Promise<void>; close(path:string,force?:boolean):boolean; closeUnder(path:string):void; closeOthers(path:string):void; closeSaved():void; reopenClosed():Promise<void>; setActive(path:string):void;
  update(path:string,content:string):void; save(path?:string):Promise<void>; saveAll():Promise<void>; revertActive():Promise<void>;
  markSaved(path:string,content:string):void; requestReveal(path:string,line:number,column?:number):void; applyExternal(path:string,content:string):void;
  remapPath(oldPath:string,newPath:string):void; setDiagnostics(path:string,items:EditorDiagnostic[]):void; setViewState(path:string,viewState:unknown):void; togglePinned(path:string):void;
  restoreRecovered(path:string,content:string,expected?:string):void; reset(keepGenerated?:boolean,access?:AccessContext):void;
}
export const useDocumentStore = create<State>((set,get)=>({
  documents: [], activePath: undefined, diagnostics:{}, recentlyClosed:[],
  openGenerated:async(id,access)=>{const {artifact,content}=await new CodeRepository(access).get(id);if(artifact.data.state==='streaming')throw Error('This generated draft is still streaming. Stop or wait before editing.');const path=generatedPath(id),aliases:Record<string,string>={js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',py:'python',rs:'rust',html:'html',bash:'shell'};set(s=>{const existing=s.documents.find(d=>d.path===path);return {documents:existing?s.documents.map(d=>d.path===path&&d.content===d.savedContent?{...d,content,savedContent:content,generated:{messageId:artifact.data.origin.messageId,artifactId:id,access,version:artifact.version}}:d):[...s.documents,{path,name:artifact.data.pathHint??artifact.title,language:aliases[artifact.data.language]??artifact.data.language,content,savedContent:content,generated:{messageId:artifact.data.origin.messageId,artifactId:id,access,version:artifact.version},preview:false}],activePath:path};});},
  open: async (path,name,line,column,preview=false) => {
    const generation=documentGeneration,request=++latestOpen;
    const existing=get().documents.find(d=>d.path===path);
    if(existing){set({activePath:path,reveal:line?{path,line,column:column??1,nonce:Date.now()}:get().reveal});return;}
    const sourceRoot=selectedRoot();const content=await api.readTextFile(path,sourceRoot);
    if(generation!==documentGeneration)return;
    set(s=>{
      if(s.documents.some(d=>d.path===path))return {activePath:request===latestOpen?path:s.activePath};
      // A single clean preview tab is replaced by the next preview file. Pinned/dirty tabs are never replaced.
      const replace=s.documents.find(d=>d.preview&&!d.pinned&&d.content===d.savedContent);
      const documents=replace?s.documents.filter(d=>d.path!==replace.path):s.documents;
      return {documents:[...documents,{path,sourceRoot,name:name ?? path.split(/[\\/]/).pop() ?? path,language:language(path),content,savedContent:content,preview}],activePath:request===latestOpen?path:s.activePath,reveal:line?{path,line,column:column??1,nonce:Date.now()}:s.reveal};
    });
  },
  close: (path,force=false) => {const doc=get().documents.find(d=>d.path===path);if(doc&&!force&&doc.content!==doc.savedContent){return false;}set(s=>{const docs=s.documents.filter(d=>d.path!==path);const active=s.activePath===path?(docs.at(-1)?.path):s.activePath;const diagnostics={...s.diagnostics};delete diagnostics[path];const recentlyClosed=doc?[{path:doc.path,name:doc.name,at:Date.now(),generated:doc.generated},...s.recentlyClosed.filter(x=>x.path!==doc.path)].slice(0,20):s.recentlyClosed;return {documents:docs,activePath:active,diagnostics,recentlyClosed};});return true;},
  closeUnder: path => set(s=>{const removed=s.documents.filter(d=>isAtOrUnder(d.path,path));const removedSet=new Set(removed.map(d=>d.path));const docs=s.documents.filter(d=>!removedSet.has(d.path));const diagnostics={...s.diagnostics};for(const key of Object.keys(diagnostics)){if(isAtOrUnder(key,path))delete diagnostics[key];}const active=s.activePath&&removedSet.has(s.activePath)?docs.at(-1)?.path:s.activePath;const recentlyClosed=[...removed.map(d=>({path:d.path,name:d.name,at:Date.now()})),...s.recentlyClosed].slice(0,20);return {documents:docs,activePath:active,diagnostics,recentlyClosed};}),
  closeOthers:path=>set(s=>{const keep=s.documents.find(d=>d.path===path);if(!keep)return {};const blocked=s.documents.filter(d=>d.path!==path&&d.content!==d.savedContent);const docs=[...blocked,keep].filter((d,i,a)=>a.findIndex(x=>x.path===d.path)===i);const diagnostics=Object.fromEntries(Object.entries(s.diagnostics).filter(([p])=>docs.some(d=>d.path===p)));return {documents:docs,activePath:path,diagnostics};}),
  closeSaved:()=>set(s=>{const docs=s.documents.filter(d=>d.content!==d.savedContent||d.path===s.activePath);const diagnostics=Object.fromEntries(Object.entries(s.diagnostics).filter(([p])=>docs.some(d=>d.path===p)));return {documents:docs,diagnostics};}),
  reopenClosed:async()=>{const item=get().recentlyClosed[0];if(!item)return;if(item.generated)await get().openGenerated(item.generated.artifactId,item.generated.access);else await get().open(item.path,item.name);set(s=>({recentlyClosed:s.recentlyClosed.slice(1)}));},
  setActive: activePath=>set({activePath}),
  update: (path,content)=>set(s=>({documents:s.documents.map(d=>d.path===path?{...d,content,preview:false}:d)})),
  save: path=>saveOne(path??get().activePath),
  saveAll: async()=>{for(const d of get().documents.filter(x=>x.content!==x.savedContent))await saveOne(d.path);},
  revertActive:async()=>{const p=get().activePath;if(!p)return;const doc=get().documents.find(d=>d.path===p);const content=doc?.generated?(await new CodeRepository(doc.generated.access).get(doc.generated.artifactId)).content:await api.readTextFile(p,doc?.sourceRoot);set(s=>({documents:s.documents.map(d=>d.path===p?{...d,content,savedContent:content,preview:false}:d)}));},
  markSaved:(path,content)=>set(s=>({documents:s.documents.map(d=>d.path===path?{...d,savedContent:content,preview:false}:d)})),
  requestReveal:(path,line,column=1)=>set({activePath:path,reveal:{path,line,column,nonce:Date.now()}}),
  applyExternal:(path,content)=>set(s=>({documents:s.documents.map(d=>d.path===path&&d.content===d.savedContent?{...d,content,savedContent:content,externalVersion:(d.externalVersion??0)+1}:d)})),
  remapPath:(oldPath,newPath)=>set(s=>{const documents=s.documents.map(d=>isAtOrUnder(d.path,oldPath)?(()=>{const path=remapped(d.path,oldPath,newPath);return {...d,path,name:path.split(/[\\/]/).pop()??d.name,language:language(path)};})():d);const diagnostics:Record<string,EditorDiagnostic[]>={};for(const [key,value] of Object.entries(s.diagnostics) as Array<[string,EditorDiagnostic[]]>)diagnostics[isAtOrUnder(key,oldPath)?remapped(key,oldPath,newPath):key]=value;const activePath=s.activePath&&isAtOrUnder(s.activePath,oldPath)?remapped(s.activePath,oldPath,newPath):s.activePath;const reveal=s.reveal&&isAtOrUnder(s.reveal.path,oldPath)?{...s.reveal,path:remapped(s.reveal.path,oldPath,newPath),nonce:Date.now()}:s.reveal;return {documents,diagnostics,activePath,reveal};}),
  setDiagnostics:(path,items)=>set(s=>s.documents.some(d=>d.path===path)?{diagnostics:{...s.diagnostics,[path]:items}}:{}),
  setViewState:(path,viewState)=>set(s=>({documents:s.documents.map(d=>d.path===path?{...d,viewState}:d)})),
  togglePinned:path=>set(s=>({documents:s.documents.map(d=>d.path===path?{...d,pinned:!d.pinned,preview:false}:d)})),
  restoreRecovered:(path,content,expected)=>set(s=>({documents:s.documents.some(d=>d.path===path)?s.documents.map(d=>d.path===path?{...d,content,savedContent:expected??d.savedContent,preview:false}:d):[...s.documents,{path,name:path.split(/[\\/]/).pop()??path,language:language(path),content,savedContent:expected??'',preview:false}]})),
  reset:(keepGenerated=false,access)=>{documentGeneration++;latestOpen++;set(s=>{const documents=keepGenerated?s.documents.filter(d=>d.generated&&(d.generated.access.projectId?d.generated.access.projectId===access?.projectId:d.generated.access.sessionId===access?.sessionId)):[];return {documents,activePath:documents.some(d=>d.path===s.activePath)?s.activePath:documents.at(-1)?.path,reveal:undefined,diagnostics:{},recentlyClosed:[]};});},
}));

function saveOne(path:string|undefined):Promise<void>{
 if(!path)return Promise.resolve();
 const task=(saving.get(path)??Promise.resolve()).catch(()=>{}).then(async()=>{const document=useDocumentStore.getState().documents.find(d=>d.path===path);if(!document||document.content===document.savedContent)return;const content=document.content;if(document.generated){const meta=document.generated;const artifact=await new CodeRepository(meta.access).edit(meta.artifactId,content,meta.version);useDocumentStore.setState(s=>({documents:s.documents.map(d=>d.path===path?{...d,savedContent:content,generated:{...meta,version:artifact.version}}:d)}));}else{await api.writeTextFile(path,content,document.savedContent,document.sourceRoot);useDocumentStore.getState().markSaved(path,content);}});
 saving.set(path,task);void task.finally(()=>{if(saving.get(path)===task)saving.delete(path);}).catch(()=>{});return task;
}

export async function saveGeneratedBuffers(){for(const doc of useDocumentStore.getState().documents.filter(d=>d.generated&&d.content!==d.savedContent))await saveOne(doc.path);}
