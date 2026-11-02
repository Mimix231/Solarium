import {invoke} from '@tauri-apps/api/core';
import {adapterFor,generationMetrics} from './backends';
import {prepareGeneration} from './context-window';
import {readyModel} from './model-ready';
import {withLocalWork} from './work-lifecycle';
import {foundationStore,newRecord} from '../foundation/store';
import {uid,type LocalModel,type Preferences,type GenerationMetrics} from '../domain/types';
import type {LlamaMessage} from './llama';
import type {AgentToolDefinition} from './tools';

export interface LoadPlan {modelPath:string;fileSignature:string;architecture:string;blocks:number;weightBytes:number;contextSize:number;recommendedGpuLayers:number;estimatedGpuBytes:number;currentlyLoaded:boolean;hardware:{gpuName:string|null;gpuTotalBytes:number;gpuFreeBytes:number;ramAvailableBytes:number|null;cpu:string};warnings:string[]}
export const modelLoadPlan=(model:LocalModel)=>invoke<LoadPlan>('model_load_plan',{gguf:model.ggufPath,context:model.contextSize});
export interface CompatibilityTrial {model:LocalModel;startedAt:string;finishedAt:string;state:'passed'|'failed'|'cancelled';error?:string;toolCalled:boolean;returnedActualValue:boolean;metrics:GenerationMetrics[];loadPlan?:LoadPlan;nativeBinarySha256:string;templateSha256:string;response:string}
const hash=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
/** A genuine model-selected read-only native call, followed by its actual result. */
export async function testLocalModel(model:LocalModel,preferences:Preferences,signal:AbortSignal,onProgress:(detail:string)=>void=()=>{}):Promise<CompatibilityTrial>{
  onProgress('Inspecting hardware and loading the selected model');
  const loadPlan=model.ggufPath?await modelLoadPlan(model):undefined;
  const ready=await readyModel(model,preferences),id=uid();
  return withLocalWork(id,'Local model compatibility',model.ggufPath,signal,async stop=>{
    const start=new Date().toISOString(),adapter=adapterFor(ready.model),metrics:GenerationMetrics[]=[];let response='',toolCalled=false,returnedActualValue=false,error:string|undefined,templateSha256='';
    const native=await invoke<{nativeBinarySha256:string}>('coding_quality_identity');
    const messages:LlamaMessage[]=[{role:'system',content:'Perform this local compatibility check precisely. Use the offered read-only tool once. After receiving its actual result, return its value exactly. Do not invent a value.'},{role:'user',content:'Read the native probe value using read_local_probe, then return its exact value.'}];
    const tools:AgentToolDefinition[]=[{type:'function',function:{name:'read_local_probe',description:'Read an actual value from the running Solarium native process. No file writes or network requests.',parameters:{type:'object',properties:{},additionalProperties:false}}}];
    const transcripts:unknown[]=[];
    try{
      const inspected=await adapter.inspect(ready.model,stop);
      const props:Record<string,unknown>=await fetch(ready.model.endpoint+'/props',{signal:stop}).then(r=>r.ok?r.json():{}).catch(()=>({}));templateSha256=await hash(JSON.stringify(props.chat_template??null));
      const first=await prepareGeneration(adapter,ready.model,inspected.capabilities,messages,stop,{tools,requireTools:true,toolChoice:'required'});
      onProgress('Waiting for the model to request the native probe');let firstToken:number|null=null,output='';const started=performance.now();
      const callbacks={answer:(d:string)=>{firstToken??=performance.now();output+=d;},reasoning:(d:string)=>{firstToken??=performance.now();output+=d;}};
      const turn=await adapter.generate(ready.model,first.messages,inspected.capabilities,callbacks,stop,{tools:first.tools,outputTokens:first.outputTokens,requireTools:true,toolChoice:'required'});
      transcripts.push(turn);metrics.push(generationMetrics(adapter.kind,ready.model.modelId,started,firstToken,performance.now(),output+JSON.stringify(turn.calls),turn.usage?.completionTokens));
      if(turn.calls.length!==1||turn.calls[0]?.function.name!=='read_local_probe')throw Error('The model did not request the offered native tool exactly once.');
      const args=JSON.parse(turn.calls[0].function.arguments);if(!args||Array.isArray(args)||Object.keys(args).length)throw Error('The probe arguments do not match its schema.');
      const actual=await invoke<{value:string;source:string}>('local_coding_probe');toolCalled=true;messages.push({role:'assistant',content:turn.answer,tool_calls:turn.calls},{role:'tool',tool_call_id:turn.calls[0].id,content:JSON.stringify(actual)});transcripts.push(actual);onProgress('Checking whether the answer uses the executed native result');
      const second=await prepareGeneration(adapter,ready.model,inspected.capabilities,messages,stop);const answerStart=performance.now();let answerFirst:number|null=null,answerOutput='';
      const final=await adapter.generate(ready.model,second.messages,inspected.capabilities,{answer:d=>{answerFirst??=performance.now();answerOutput+=d;},reasoning:d=>{answerFirst??=performance.now();answerOutput+=d;}},stop,{outputTokens:second.outputTokens});transcripts.push(final);response=final.answer;
      metrics.push(generationMetrics(adapter.kind,ready.model.modelId,answerStart,answerFirst,performance.now(),answerOutput,final.usage?.completionTokens));returnedActualValue=final.finishReason==='stop'&&final.calls.length===0&&final.answer.includes(actual.value);if(!returnedActualValue)throw Error('The final answer did not return the actual native value after a natural model stop.');
    }catch(reason){error=String(reason);}
    const result:CompatibilityTrial={model:ready.model,startedAt:start,finishedAt:new Date().toISOString(),state:stop.aborted?'cancelled':error?'failed':'passed',error,toolCalled,returnedActualValue,metrics,loadPlan,nativeBinarySha256:native.nativeBinarySha256,templateSha256,response};
    await foundationStore.batch([{record:newRecord('model_compatibility',id,{kind:'library',id:'personal'},model.name+' · native tool round trip',result),expected:null,body:JSON.stringify(transcripts)}]);return result;
  });
}
