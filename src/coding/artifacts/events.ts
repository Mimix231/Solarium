const listeners=new Set<()=>void>();
let revision=0;
const activeMessages=new Set<string>();
export const codeArtifactEvents={
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  snapshot:()=>revision,
  changed(){revision++;for(const listener of listeners)listener();},
  isStreaming(sessionId:string,messageId:string){return activeMessages.has(sessionId+'\0'+messageId);},
  setStreaming(sessionId:string,messageId:string,active:boolean){const key=sessionId+'\0'+messageId;if(active)activeMessages.add(key);else activeMessages.delete(key);this.changed();},
};
