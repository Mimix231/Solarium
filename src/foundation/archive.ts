import { uid } from '../domain/types';
import { accessibleScopes, assertScope, type AccessContext, type RecordStore, type SourceScope, type StoredRecord } from './types';
import { foundationStore, newRecord } from './store';
export interface ArchiveData {kind:'conversation'|'tool_result'|'file'|'research';sessionId:string;taskId?:string;pages:string[];length:number;hash:string;locator?:string}
const PAGE=32_000;
/** Full originals stay on disk. Context fitting selects pages, never deletes them. */
export class ContextArchive {
  constructor(readonly access:AccessContext,readonly store:RecordStore=foundationStore){}
  async save(scope:SourceScope,title:string,text:string,metadata:Omit<ArchiveData,'pages'|'length'|'hash'>):Promise<StoredRecord<ArchiveData>>{
    assertScope(scope,this.access);const id=uid();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const pages=[];for(let offset=0;offset<text.length;offset+=PAGE)pages.push(newRecord('context_page',uid(),scope,title,{archiveId:id,offset},null));
    const record=newRecord('context_archive',id,scope,title,{...metadata,pages:pages.map(p=>p.id),length:text.length,hash});
    await this.store.batch([{record,expected:null},...pages.map((page,i)=>({record:page,body:text.slice(i*PAGE,(i+1)*PAGE),expected:null}))]);return record;
  }
  async list(query=''):Promise<StoredRecord<ArchiveData>[]>{return this.store.list<ArchiveData>({scopes:accessibleScopes(this.access),collection:'context_archive',...(query?{query}:{})});}
  async read(id:string,offset=0,length=8000):Promise<{text:string;offset:number;nextOffset:number;total:number;hasMore:boolean;hash:string}>{
    const record=(await this.list()).find(r=>r.id===id);if(!record)throw Error('Archived context is unavailable in this conversation/project.');
    if(!Number.isSafeInteger(offset)||offset<0||offset>record.data.length||!Number.isSafeInteger(length)||length<1||length>32000)throw Error('Invalid archive range.');
    const end=Math.min(record.data.length,offset+length);let text='';
    for(let i=Math.floor(offset/PAGE);i<Math.ceil(end/PAGE);i++){const body=await this.store.body(record.data.pages[i]!,[record.scope]);if(body===null)throw Error('Archive page is missing; original evidence is incomplete.');text+=body.slice(Math.max(0,offset-i*PAGE),Math.min(PAGE,end-i*PAGE));}
    return{text,offset,nextOffset:end,total:record.data.length,hasMore:end<record.data.length,hash:record.data.hash};
  }
  async search(query:string):Promise<{archiveId:string;title:string;offset:number;excerpt:string}[]>{
    const terms=query.toLowerCase().split(/\s+/).filter(t=>t.length>2);if(!terms.length)return[];const found=[];
    for(const record of (await this.list()).slice().reverse())for(let i=0;i<record.data.pages.length;i++){
      const body=await this.store.body(record.data.pages[i]!,[record.scope]);if(body===null)continue;const lower=body.toLowerCase();const index=terms.map(t=>lower.indexOf(t)).filter(n=>n>=0).sort((a,b)=>a-b)[0];
      if(index!==undefined)found.push({archiveId:record.id,title:record.title,offset:i*PAGE+Math.max(0,index-200),excerpt:body.slice(Math.max(0,index-200),index+700)});if(found.length>=8)return found;
    }return found;
  }
}
