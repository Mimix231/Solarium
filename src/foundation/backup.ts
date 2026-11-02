import type { Workspace } from '../domain/types';
import type { LibraryScope, RecordStore, StoredRecord, RecordWrite } from './types';
import { MAX_BODY } from './types';
import { foundationStore, exportFoundation } from './store';
import { validateStructured, readWritingContent } from '../writing/schema';
import { claimKinds, claimSections } from '../stories/repository';
import { validateCodeArtifact,type CodeArtifactData } from '../coding/artifacts/repository';
import { uid } from '../domain/types';
import { validateWorkspaceSnapshot, type WorkspaceSnapshot } from '../coding/integration/session';
const collections=new Set(['model_compatibility','source','source_chunk','writing_document','writing_revision','writing_category','writing_draft','story_world','story_character','character_claim','character_claim_revision','story_event','story_relation','task_execution','context_archive','context_page','writing_task','conversation_brief','quality_run','code_workspace_state','code_artifact','code_revision']);
export function workspaceScopes(workspace:Workspace):LibraryScope[]{return [...workspace.sessions.map(s=>({kind:'chat' as const,id:s.id})),...(workspace.projects??[]).map(p=>({kind:'project' as const,id:p.id})),{kind:'library',id:'personal'}];}
export async function exportAll(workspace:Workspace,store:RecordStore=foundationStore):Promise<unknown>{
  const records=[];for(const scope of workspaceScopes(workspace)){const archive=await exportFoundation(store,[scope]);records.push(...archive.records);}
  return {...workspace,foundation:{schemaVersion:1,records}};
}
/** Validate an entire archive before any writes. A backup carries explicit owner IDs. */
export async function importFoundation(data:unknown,workspace:Workspace,store:RecordStore=foundationStore):Promise<void>{
  if(!data)return;const archive=data as {schemaVersion?:number;records?:{record:StoredRecord;body:string|null}[]};
  if(archive.schemaVersion!==1||!Array.isArray(archive.records)||archive.records.length>20_000)throw Error('Invalid foundation archive.');
  const scopes=workspaceScopes(workspace);const existing:StoredRecord[]=[];for(const scope of scopes)existing.push(...await store.list({scopes:[scope]}));const byId=new Map(existing.map(r=>[r.id,r]));const writes:RecordWrite[]=[];const seen=new Set<string>();let total=0;
  for(const entry of archive.records){const r=entry?.record;
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>180||seen.has(r.id)||!collections.has(r.collection)||!r.scope||!scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)||typeof r.title!=='string'||!r.data||typeof r.data!=='object'||Array.isArray(r.data)||!Number.isSafeInteger(r.version)||r.version<1)throw Error('Archive contains an invalid record, duplicate ID or foreign owner.');
    seen.add(r.id);if(entry.body!==null&&(typeof entry.body!=='string'||entry.body.length>MAX_BODY))throw Error('Invalid archive content.');total+=(entry.body?.length??0)+JSON.stringify(r).length;if(total>100_000_000)throw Error('Archive exceeds 100 MB.');
    const d=r.data as Record<string,unknown>;
    if(r.collection==='code_workspace_state'){
      if(r.scope.kind!=='project'||r.id!=='code-workspace:'+r.scope.id||typeof d.root!=='string'||entry.body===null)throw Error('Invalid workspace recovery owner.');
      validateWorkspaceSnapshot(JSON.parse(entry.body) as WorkspaceSnapshot,d.root);
    }
    if(r.collection==='code_artifact'){validateCodeArtifact(d);if(!['chat','project','library'].includes(r.scope.kind))throw Error('Generated source needs an accessible owner.');}
    if(r.collection==='code_revision'&&(typeof d.artifactId!=='string'||!['model','user'].includes(String(d.origin))))throw Error('Invalid code revision.');
    if(r.collection==='writing_revision'&&entry.body!==null){const content=readWritingContent(entry.body);validateStructured(content.structuredJson);}
    if(r.collection==='conversation_brief'&&(typeof d.sessionId!=='string'||!Array.isArray(d.instructions)||d.instructions.some(m=>!m||typeof m.id!=='string'||typeof m.text!=='string')))throw Error('Invalid conversation requirements.');
    if(r.collection==='model_compatibility'&&(!d.model||!['passed','failed','cancelled'].includes(String(d.state))||!Array.isArray(d.metrics)||typeof d.nativeBinarySha256!=='string'||typeof d.toolCalled!=='boolean'||typeof d.returnedActualValue!=='boolean'))throw Error('Invalid model compatibility trial.');
    if(r.collection==='quality_run'&&(typeof d.sessionId!=='string'||typeof d.caseId!=='string'||!Array.isArray(d.checks)||!Array.isArray(d.metrics)||!Array.isArray(d.warnings)||!Array.isArray(d.review)||!d.instance||!d.model))throw Error('Invalid quality run.');
    if(r.collection==='source'&&(!['chat','project'].includes(r.scope.kind)||typeof d.kind!=='string'||!Array.isArray(d.tags)||!d.origin||typeof d.contentHash!=='string'))throw Error('Invalid source metadata.');
    if(r.collection==='character_claim'&&(!claimKinds.includes(d.kind as typeof claimKinds[number])||!claimSections.includes(d.section as typeof claimSections[number])||typeof d.value!=='string'||!Array.isArray(d.sourceLinks)))throw Error('Invalid character claims.');
    if(r.collection==='story_character'&&typeof d.portrait==='string'&&!/^data:image\/(?:png|jpeg|webp);base64,/.test(d.portrait))throw Error('Remote portraits are not imported.');
    const current=byId.get(r.id);if(current&&(current.collection!==r.collection||current.scope.kind!==r.scope.kind||current.scope.id!==r.scope.id))throw Error('Archive ID conflicts with a different owner or record type.');
    writes.push({record:{...r,version:(current?.version??0)+1},expected:current?.version??null,...(entry.body!==null?{body:entry.body}:{})});
  }
  const available=new Map([...existing,...writes.map(w=>w.record)].map(r=>[r.id,r]));
  for(const {record:r} of writes){const d=r.data as Record<string,unknown>;
    if(r.storyId){const world=available.get(r.storyId);if(!world||world.collection!=='story_world'||world.scope.kind!==r.scope.kind||world.scope.id!==r.scope.id)throw Error('Archive record refers to an inaccessible Story World.');}
    if(r.collection==='code_artifact'){const id=(d as unknown as CodeArtifactData).currentRevisionId;if(id){const revision=available.get(id);if(!revision||revision.collection!=='code_revision'||(revision.data as {artifactId:string}).artifactId!==r.id||revision.scope.kind!==r.scope.kind||revision.scope.id!==r.scope.id)throw Error('Generated code revision is missing or foreign.');}}
    if(r.collection==='writing_document'){const revision=available.get(String(d.currentRevisionId));if(!revision||revision.collection!=='writing_revision'||(revision.data as {documentId:string}).documentId!==r.id)throw Error('Document revision is missing from archive.');}
    if(r.collection==='writing_category'&&d.parentId){let parent=String(d.parentId);const visited=new Set([r.id]);while(parent){if(visited.has(parent))throw Error('Category cycle in archive.');visited.add(parent);const p=available.get(parent);if(!p||p.collection!=='writing_category'||p.scope.kind!==r.scope.kind||p.scope.id!==r.scope.id)throw Error('Invalid category parent.');parent=String((p.data as {parentId:string|null}).parentId??'');}}
  }
  await store.batch(writes);
}
/** Explicit portable-library import copies identities into the chosen owner; it never grants foreign access. */
export async function importScopedArchive(data:unknown,scope:LibraryScope,workspace:Workspace,store:RecordStore=foundationStore):Promise<void>{
  const archive=data as {schemaVersion:number;records:{record:StoredRecord;body:string|null}[]};
  if(archive?.schemaVersion!==1||!Array.isArray(archive.records)||archive.records.length>20_000)throw Error('Invalid library archive.');
  if(!workspaceScopes(workspace).some(s=>s.kind===scope.kind&&s.id===scope.id))throw Error('Import destination is outside this workspace.');
  if(scope.kind==='library'&&archive.records.some(e=>e.record.collection==='source'))throw Error('Evidence Sources need a conversation or project destination. Open a project before importing this archive.');
  const ids=new Map(archive.records.map(e=>[e.record.id,uid()]));
  const remap=(v:unknown):unknown=>typeof v==='string'?(ids.get(v)??v):Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[ids.get(k)??k,remap(value)])):v;
  const copied={schemaVersion:1,records:archive.records.map(e=>({record:{...e.record,id:ids.get(e.record.id)!,scope,storyId:e.record.storyId?(ids.get(e.record.storyId)??e.record.storyId):undefined,data:remap(e.record.data),version:1},body:e.body}))};
  await importFoundation(copied,workspace,store);
}
/** Deleting owners removes references; authored writing is recovered to the personal library. */
export async function cleanupDeletedOwners(before:Workspace,after:Workspace,store:RecordStore=foundationStore):Promise<void>{
  const live=new Set(workspaceScopes(after).map(s=>`${s.kind}:${s.id}`));
  for(const scope of workspaceScopes(before).filter(s=>!live.has(`${s.kind}:${s.id}`))){
    const rows=await store.list({scopes:[scope]});const preserve=rows.filter(r=>!['source','source_chunk','task_execution','context_archive','context_page','conversation_brief','quality_run','code_workspace_state'].includes(r.collection));const remove=rows.filter(r=>!preserve.includes(r));
    await store.batch(preserve.map(r=>({record:{...r,scope:{kind:'library',id:'personal'},version:r.version+1,updatedAt:new Date().toISOString()},expected:r.version})),remove.map(r=>({id:r.id,expected:r.version})));
  }
}
