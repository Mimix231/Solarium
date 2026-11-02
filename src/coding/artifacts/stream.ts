import { BlockStreamAssembler } from '../../blocks/protocol';
import type { CodeOrigin } from './repository';
import { CodeRepository } from './repository';
import { codeArtifactEvents } from './events';
/** Checkpoint actual source fences; never restart inference or manufacture file writes. */
export class GeneratedCodeStream {
  private scanner=new BlockStreamAssembler();private queue=Promise.resolve();private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private repo:CodeRepository,private origin:Omit<CodeOrigin,'blockId'>,private onError:(error:unknown)=>void){codeArtifactEvents.setStreaming(origin.sessionId,origin.messageId,true);}
  push(delta:string){this.scanner.push(delta);if(!this.timer)this.timer=setTimeout(()=>{this.timer=undefined;this.checkpoint();},450);}
  replace(text:string){this.scanner.reset();this.scanner.push(text);}
  private checkpoint(ended=false,cancelled=false,finished=false){
    const blocks=this.scanner.snapshot().flatMap(p=>p.type==='block'&&['code','preview'].includes(p.block.kind)?[p.block]:[]);
    this.queue=this.queue.catch(()=>{}).then(async()=>{for(const block of blocks)await this.repo.capture(block,{...this.origin,blockId:block.id},ended,cancelled,finished);});
    void this.queue.catch(this.onError);
  }
  async finish(ended:boolean,cancelled:boolean){if(this.timer)clearTimeout(this.timer);this.timer=undefined;try{this.checkpoint(ended,cancelled,true);await this.queue;}finally{codeArtifactEvents.setStreaming(this.origin.sessionId,this.origin.messageId,false);}}
}
