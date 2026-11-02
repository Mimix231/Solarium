type Listener=()=>void;
interface Work {id:string;label:string;modelPath?:string;controller:AbortController;done:Promise<void>}
const work=new Map<string,Work>(),listeners=new Set<Listener>();
let revision=0;
const changed=()=>{revision++;for(const listener of listeners)listener();};
export const workLifecycle={
  subscribe(listener:Listener){listeners.add(listener);return()=>{listeners.delete(listener);};},
  snapshot:()=>revision,
  active:()=>[...work.values()].map(({id,label,modelPath})=>({id,label,modelPath})),
  assertIdle(){if(work.size)throw Error('Finish or stop the active local task before changing the model or starting another run.');},
  async stopAll(){const current=[...work.values()];for(const item of current)item.controller.abort();await Promise.all(current.map(item=>item.done));},
};
/** Owns cancellation/finalization, not inference turns or thought text. */
export async function withLocalWork<T>(id:string,label:string,modelPath:string|undefined,signal:AbortSignal,run:(signal:AbortSignal)=>Promise<T>):Promise<T>{
  workLifecycle.assertIdle();
  const controller=new AbortController(),stop=()=>controller.abort();signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
  let finish!:()=>void;const done=new Promise<void>(resolve=>{finish=resolve;});work.set(id,{id,label,modelPath,controller,done});changed();
  try{return await run(controller.signal);}finally{signal.removeEventListener('abort',stop);work.delete(id);finish();changed();}
}
