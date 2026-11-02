/** Production-module/native IPC acceptance in the isolated QA profile only. */
export async function connectQa(){
  const targets=await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());
  const target=targets.find(t=>t.type==='page'&&t.url==='http://127.0.0.1:1420/');if(!target)throw Error('Isolated Solarium dev WebView not found.');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map();ws.addEventListener('message',event=>{const value=JSON.parse(String(event.data));const p=pending.get(value.id);if(p){pending.delete(value.id);clearTimeout(p.timer);if(value.error)p.reject(Error(JSON.stringify(value.error)));else p.resolve(value.result);}});
  const evaluate=async(expression,timeout=3_600_000)=>{const callId=++id;const promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(callId);reject(Error('Native QA operation timed out'));},timeout);pending.set(callId,{resolve,reject,timer});});ws.send(JSON.stringify({id:callId,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const result=await promise;if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
  await evaluate(`(async()=>{const app=await import('/node_modules/@tauri-apps/api/app.js');if(await app.getName()!=='Solarium Foundation QA')throw Error('Native QA refuses to mutate a production profile.');return true;})()`);
  // Vite HMR can leave the unversioned URL cached beside the module used by
  // React. Use the actual most recently loaded resource URL for app modules.
  await evaluate(`globalThis.__qaImport=async(path)=>{if(!path.startsWith('/src/state/'))return import(path+'?nativeQa='+Date.now());const resource=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===path).at(-1);return import(resource?.name??path);};true`);
  await evaluate(`(async()=>{const {useSolarium}=await __qaImport('/src/state/useSolarium.ts');const started=Date.now();while(!useSolarium.getState().ready){if(Date.now()-started>15000)throw Error('Workspace hydration did not finish');await new Promise(r=>setTimeout(r,100));}return true;})()`);
  return{evaluate,close(){for(const p of pending.values())clearTimeout(p.timer);pending.clear();ws.close();}};
}
