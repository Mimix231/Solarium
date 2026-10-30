import { BlockStreamAssembler } from '../blocks/protocol';
import { markdownContent } from './schema';
import { WritingRepository } from './repository';
import type { WritingDocument } from './types';
import type { LibraryScope } from '../foundation/types';
/** Consumes the existing answer stream. Never generates tokens or changes inference requests. */
export class WritingDraftStream {
  private assembler=new BlockStreamAssembler();private documents=new Map<string,WritingDocument>();private pending=Promise.resolve();private last=0;private stopped=false;
  constructor(private repo:WritingRepository,private scope:LibraryScope,private messageId:string,private storyId:string|null,private onError:(error:unknown)=>void){}
  push(delta:string):void{if(this.stopped)return;this.assembler.push(delta);if(performance.now()-this.last>1200){this.last=performance.now();this.enqueue(false,false);}}
  private enqueue(final:boolean,cancelled:boolean,autoSaveCategory?:string|null){
    const snapshot=this.assembler.snapshot();
    this.pending=this.pending.then(async()=>{
      for(const part of snapshot){if(part.type!=='block'||part.block.kind!=='writing')continue;const block=part.block;
        let doc=this.documents.get(block.id);
        if(!doc){doc=(await this.repo.list()).find(d=>d.data.originConversationId===this.repo.context.sessionId&&d.data.originMessageId===this.messageId&&(d.data.legacyBlockId===block.id||!d.data.legacyBlockId&&d.title===block.title));
          doc??=await this.repo.create({scope:this.scope,title:block.title,storyId:this.storyId,messageId:this.messageId,legacyBlockId:block.id,markdown:''});this.documents.set(block.id,doc);}
        await this.repo.checkpoint(doc,block.content,cancelled?'cancelled':final?'draft':'generating');
        if(final&&!cancelled&&block.status==='complete'&&autoSaveCategory!==undefined){const current=(await this.repo.get(doc.id)).document;if(current.version===doc.version&&doc.version===1){doc=await this.repo.save(current,markdownContent(block.content),{categoryId:autoSaveCategory,status:'draft'});this.documents.set(block.id,doc);}else this.onError(Error('Your edited document was preserved; generated text remains in its recovery draft.'));}
      }
    }).catch(this.onError);
  }
  async finish(cancelled:boolean,autoSaveCategory?:string|null):Promise<void>{this.stopped=true;this.enqueue(true,cancelled,autoSaveCategory);await this.pending;}
}
