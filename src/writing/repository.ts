import { now, uid } from '../domain/types';
import { foundationStore, newRecord } from '../foundation/store';
import { accessibleScopes, assertScope, sameScope, validateBody, type AccessContext, type LibraryScope, type RecordStore } from '../foundation/types';
import { markdownContent, readWritingContent, validateStructured } from './schema';
import type { CategoryData, WritingCategory, WritingContent, WritingData, WritingDocument, WritingDraft, WritingKind, WritingRevision, WritingRevisionData, WritingSelection } from './types';
export class WritingRepository {
  constructor(public context:AccessContext,public store:RecordStore=foundationStore){}
  scopes():LibraryScope[]{return accessibleScopes(this.context,true);}
  async list():Promise<WritingDocument[]>{return this.store.list<WritingData>({collection:'writing_document',scopes:this.scopes()});}
  async categories():Promise<WritingCategory[]>{return this.store.list<CategoryData>({collection:'writing_category',scopes:this.scopes()});}
  async category(name:string,scope:LibraryScope,parentId:string|null=null,storyId:string|null=null):Promise<WritingCategory>{
    assertScope(scope,this.context,true);if(!name.trim()||name.length>160)throw Error('Category names must contain 1–160 characters.');
    const categories=await this.categories(); const parent=categories.find(c=>c.id===parentId);
    if(parentId&&(!parent||!sameScope(parent.scope,scope)||(parent.storyId??null)!==storyId))throw Error('Parent category belongs to another library or story.');
    if(categories.some(c=>sameScope(c.scope,scope)&&c.data.parentId===parentId&&(c.storyId??null)===storyId&&c.title.toLowerCase()===name.trim().toLowerCase()))throw Error('A category with this name already exists here.');
    const rec=newRecord('writing_category',uid(),scope,name.trim(),{parentId,sortOrder:categories.length,archived:false},storyId);
    await this.store.batch([{record:rec,expected:null}]);return rec;
  }
  async ensureCategoryPath(path:string,scope:LibraryScope,storyId:string|null=null):Promise<string|null>{
    let parentId:string|null=null;for(const part of path.split('/').map(p=>p.trim()).filter(Boolean)){
      const found=(await this.categories()).find(c=>sameScope(c.scope,scope)&&(c.storyId??null)===storyId&&c.data.parentId===parentId&&c.title.toLowerCase()===part.toLowerCase());
      parentId=found?.id??(await this.category(part,scope,parentId,storyId)).id;
    }return parentId;
  }
  async editCategory(category:WritingCategory,title:string,parentId=category.data.parentId,archived=category.data.archived):Promise<void>{
    assertScope(category.scope,this.context,true);const all=await this.categories();
    if(!title.trim())throw Error('A category name is required.');let cursor=parentId;const seen=new Set<string>();
    while(cursor){if(cursor===category.id||seen.has(cursor))throw Error('A category cannot be moved inside itself or a descendant.');seen.add(cursor);const parent=all.find(c=>c.id===cursor);if(!parent||!sameScope(parent.scope,category.scope)||(parent.storyId??null)!==(category.storyId??null))throw Error('Parent category is outside this library.');cursor=parent.data.parentId;}
    if(all.some(c=>c.id!==category.id&&sameScope(c.scope,category.scope)&&(c.storyId??null)===(category.storyId??null)&&c.data.parentId===parentId&&c.title.toLowerCase()===title.trim().toLowerCase()))throw Error('A sibling category already has that name.');
    await this.store.batch([{record:{...category,title:title.trim(),version:category.version+1,data:{...category.data,parentId,archived},updatedAt:now()},expected:category.version}]);
  }
  async deleteCategory(category:WritingCategory):Promise<void>{
    assertScope(category.scope,this.context,true);const cats=await this.categories();const docs=await this.list();
    const affected=[...cats.filter(c=>c.data.parentId===category.id).map(c=>({...c,data:{...c.data,parentId:category.data.parentId}})),...docs.filter(d=>d.data.categoryId===category.id).map(d=>({...d,data:{...d.data,categoryId:null}}))];
    await this.store.batch(affected.map(r=>({record:{...r,version:r.version+1,updatedAt:now()},expected:r.version})),[{id:category.id,expected:category.version}]);
  }
  async create(input:{scope:LibraryScope;title:string;kind?:WritingKind;markdown?:string;categoryId?:string|null;storyId?:string|null;messageId?:string|null;legacyBlockId?:string}):Promise<WritingDocument>{
    assertScope(input.scope,this.context,true);if(!input.title.trim())throw Error('A document title is required.');
    if(input.categoryId)await this.checkCategory(input.categoryId,input.scope,input.storyId??null);
    if(input.storyId){const stories=await this.store.list({collection:'story_world',scopes:this.scopes()});if(!stories.some(s=>s.id===input.storyId&&sameScope(s.scope,input.scope)))throw Error('Story World is outside this library.');}
    const id=uid(),revisionId=uid(),time=now(),content=markdownContent(input.markdown??'');
    const doc=newRecord('writing_document',id,input.scope,input.title.slice(0,180),{schemaVersion:1,kind:input.kind??'chapter',categoryId:input.categoryId??null,currentRevisionId:revisionId,status:'draft',tags:[],originConversationId:this.context.sessionId,originMessageId:input.messageId??null,legacyBlockId:input.legacyBlockId,createdAt:time,wordCount:wordCount(content.markdownProjection),sourceIds:[],characterIds:[],metadata:{}} satisfies WritingData,input.storyId);
    const revision=newRecord('writing_revision',revisionId,doc.scope,doc.title,{documentId:id,parentRevisionId:null,schemaVersion:1,isPartialDraft:true,reason:'import',createdAt:time} satisfies WritingRevisionData,doc.storyId);
    await this.store.batch([{record:doc,expected:null},{record:revision,expected:null,body:JSON.stringify(content)}]);return doc;
  }
  private async checkCategory(id:string,scope:LibraryScope,storyId:string|null){const c=(await this.categories()).find(c=>c.id===id);if(!c||!sameScope(c.scope,scope)||(c.storyId??null)!==storyId)throw Error('Category belongs to another project or story.');}
  async get(id:string):Promise<{document:WritingDocument;content:WritingContent}>{
    const document=(await this.list()).find(d=>d.id===id);if(!document)throw Error('Document is outside this library.');
    const body=await this.store.body(document.data.currentRevisionId,this.scopes());if(body===null)throw Error('Document revision is missing.');
    return {document,content:readWritingContent(body)};
  }
  async revisions(id:string):Promise<WritingRevision[]>{await this.get(id);return (await this.store.list<WritingRevisionData>({collection:'writing_revision',scopes:this.scopes()})).filter(r=>r.data.documentId===id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async save(document:WritingDocument,content:WritingContent,patch:Partial<WritingData>={},partial=false):Promise<WritingDocument>{
    assertScope(document.scope,this.context,true);validateBody(content.markdownProjection);validateStructured(content.structuredJson);
    const actual=(await this.get(document.id)).document;
    if(actual.version!==document.version||!sameScope(actual.scope,document.scope)||(actual.storyId??null)!==(document.storyId??null))throw Error('Revision conflict or document ownership changed. Reload before saving.');
    if(content.schemaVersion!==1)throw Error('Unknown writing schema.');
    if(patch.categoryId)await this.checkCategory(patch.categoryId,document.scope,document.storyId??null);
    const revisionId=uid(),time=now();const next={...document,version:document.version+1,updatedAt:time,data:{...document.data,...patch,schemaVersion:1 as const,currentRevisionId:revisionId,wordCount:wordCount(content.markdownProjection)}};
    const revision=newRecord('writing_revision',revisionId,document.scope,document.title,{documentId:document.id,parentRevisionId:document.data.currentRevisionId,schemaVersion:1,isPartialDraft:partial,reason:'user_edit',createdAt:time} satisfies WritingRevisionData,document.storyId);
    await this.store.batch([{record:next,expected:document.version},{record:revision,expected:null,body:JSON.stringify(content)}]);return next;
  }
  async checkpoint(document:WritingDocument,markdown:string,status:WritingDraft['status']):Promise<void>{
    validateBody(markdown);assertScope(document.scope,this.context,true);
    const id=`draft:${document.id}`;const previous=(await this.store.list<WritingDraft>({collection:'writing_draft',scopes:this.scopes()})).find(d=>d.id===id);
    const draft=newRecord('writing_draft',id,document.scope,document.title,{documentId:document.id,markdown:'',baseRevisionId:document.data.currentRevisionId,owner:document.scope,status,updatedAt:now()} satisfies WritingDraft,document.storyId);
    await this.store.batch([{record:{...draft,version:(previous?.version??0)+1},expected:previous?.version??null,body:markdown}]);
  }
  async draft(id:string):Promise<{markdown:string;status:WritingDraft['status'];baseRevisionId:string}|null>{
    const d=(await this.store.list<WritingDraft>({collection:'writing_draft',scopes:this.scopes()})).find(d=>d.data.documentId===id);if(!d)return null;
    const markdown=await this.store.body(d.id,this.scopes());return markdown===null?null:{markdown,status:d.data.status,baseRevisionId:d.data.baseRevisionId};
  }
  async selection(selection:WritingSelection,replacement:string):Promise<WritingDocument>{
    const {document,content}=await this.get(selection.documentId);const text=content.markdownProjection;
    if(document.data.currentRevisionId!==selection.revisionId||text.slice(selection.from,selection.to)!==selection.text)throw Error('Revision conflict: this selection has changed. No text was replaced.');
    return this.save(document,markdownContent(text.slice(0,selection.from)+replacement+text.slice(selection.to)),{},false);
  }
  async remove(id:string):Promise<void>{const {document}=await this.get(id);const rows=(await this.store.list<{documentId?:string}>({scopes:this.scopes()})).filter(r=>r.data.documentId===id);await this.store.batch([],[document,...rows].map(r=>({id:r.id,expected:r.version})));}
}
export const wordCount=(text:string):number=>(text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)??[]).length;
