import { BlockStreamAssembler } from '../blocks/protocol';
import { markdownContent } from './schema';
import { WritingRepository } from './repository';
import type { WritingDocument } from './types';
import type { LibraryScope } from '../foundation/types';
/** Consumes the existing answer stream. Never generates tokens or changes inference requests. */
export class WritingDraftStream {
  private assembler=new BlockStreamAssembler();private documents=new Map<string,WritingDocument>();private pending=Promise.resolve();private last=0;private stopped=false;private completed=new Set<string>();private owned=new Map<string,string>();
  constructor(private repo:WritingRepository,private scope:LibraryScope,private messageId:string,private storyId:string|null,private onError:(error:unknown)=>void){}
  push(delta:string):void{if(this.stopped)return;this.assembler.push(delta);let closed=false;if(delta.includes('`'))for(const part of this.assembler.snapshot()){if(part.type==='block'&&part.block.kind==='writing'&&part.block.status==='complete'&&!this.completed.has(part.block.id)){this.completed.add(part.block.id);closed=true;}}if(closed||performance.now()-this.last>1200){this.last=performance.now();this.enqueue(false,false);}}
  parts(){return this.assembler.snapshot();}
  setStory(id:string):void{this.storyId=id;this.pending=this.pending.then(async()=>{for(const [blockId,doc]of this.documents)if(!doc.storyId&&this.owned.get(doc.id)===doc.data.currentRevisionId)this.documents.set(blockId,await this.repo.bind(doc,this.messageId,id));}).catch(this.onError);}
  replaceVisible(text:string):void{this.assembler.reset();this.assembler.push(text);}
  async flush():Promise<void>{this.enqueue(false,false);await this.pending;}
  private enqueue(final:boolean,cancelled:boolean,autoSaveCategory?:string|null){
    const snapshot=this.assembler.snapshot();
    this.pending=this.pending.then(async()=>{
      for(const part of snapshot){if(part.type!=='block'||part.block.kind!=='writing')continue;const block=part.block;
        let doc=this.documents.get(block.id);
        if(!doc){const candidates=(await this.repo.list()).filter(d=>d.data.originConversationId===this.repo.context.sessionId&&d.data.originMessageId===this.messageId);doc=candidates.find(d=>d.data.legacyBlockId===block.id||!d.data.legacyBlockId&&d.title===block.title)??(candidates.length===1&&candidates[0]!.version===1&&candidates[0]!.data.wordCount===0?candidates[0]:undefined);
          doc??=await this.repo.create({scope:this.scope,title:block.title,storyId:this.storyId,messageId:this.messageId,legacyBlockId:block.id,markdown:''});if(doc.version===1&&doc.data.wordCount===0)this.owned.set(doc.id,doc.data.currentRevisionId);if(this.owned.get(doc.id)===doc.data.currentRevisionId&&((this.storyId&&!doc.storyId)||doc.data.legacyBlockId!==block.id))doc=await this.repo.bind(doc,this.messageId,this.storyId??doc.storyId??null,block.id);this.documents.set(block.id,doc);}
        await this.repo.checkpoint(doc,block.content,cancelled?'cancelled':final||block.status==='complete'?'draft':'generating');
        if(final&&!cancelled&&block.status==='complete'){const saved=await this.repo.get(doc.id);const current=saved.document;if(current.version===doc.version&&this.owned.get(doc.id)===doc.data.currentRevisionId){doc=await this.repo.save(current,markdownContent(block.content),{...(autoSaveCategory!==undefined?{categoryId:autoSaveCategory}:{}),status:'draft'});this.documents.set(block.id,doc);}else if((current.version!==doc.version||this.owned.get(doc.id)!==current.data.currentRevisionId)&&saved.content.markdownProjection!==block.content)this.onError(Error('Your edited document was preserved; generated text remains in its recovery draft.'));else this.documents.set(block.id,current);}
      }
    }).catch(this.onError);
  }
  async finish(cancelled:boolean,autoSaveCategory?:string|null):Promise<void>{this.stopped=true;this.enqueue(true,cancelled,autoSaveCategory);await this.pending;}
}
