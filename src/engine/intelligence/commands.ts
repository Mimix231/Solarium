import { uid } from '../../domain/types';
import type { ProjectCheckOutput, ProjectCheckResult } from '../creator';
export interface ProjectCommand { id:string;command:string;purpose:string;verification:boolean;cwd:string;service?:boolean;network?:boolean;behavioral?:boolean }
export interface CommandResult extends ProjectCheckResult {run_id:string;command_id:string;output_complete:boolean;cancelled:boolean;duration_ms:number;source_before?:string;source_after?:string;verification?:boolean}
export interface OutputPage {text:string;offset:number;nextOffset:number;totalBytes:number;hasMore:boolean}
export const invokeProject=async<T>(name:string,args:Record<string,unknown>):Promise<T>=>{
  if(typeof window==='undefined'||!('__TAURI_INTERNALS__' in window))throw Error('Project commands require Solarium Desktop.');
  return (await import('@tauri-apps/api/core')).invoke<T>(name,args);
};
export const projectSourceSnapshot=(root:string)=>invokeProject<{sha256:string;files:number}>('project_source_snapshot',{root});
export interface CommandProposal{program:string;args:string[];cwd:string;purpose:string;kind:'setup'|'check'|'test'|'service';network:boolean}
export const registerProjectCommand=(root:string,proposal:CommandProposal)=>invokeProject<ProjectCommand>('register_project_command',{root,proposal});
export interface ProjectServiceStatus{id:string;pid:number;state:'starting'|'running'|'ready'|'exited';url:string|null;httpStatus:number|null;exitCode:number|null;stdout:string;stderr:string;source:string}
export const startProjectService=(root:string,commandId:string,readyUrl:string|undefined,webEnabled:boolean)=>invokeProject<string>('start_project_service',{root,commandId,readyUrl:readyUrl??null,webEnabled});
export const inspectProjectService=(root:string,serviceId:string)=>invokeProject<ProjectServiceStatus>('inspect_project_service',{root,serviceId});
export const stopProjectService=(root:string,serviceId:string)=>invokeProject<void>('stop_project_service',{root,serviceId});
export const listProjectCommands=(root:string)=>invokeProject<ProjectCommand[]>('list_project_commands',{root});
export const readCommandOutput=(root:string,runId:string,stream:'stdout'|'stderr',offset=0)=>invokeProject<OutputPage>('read_command_output',{root,runId,stream,offset});
export async function runProjectCommand(root:string,commandId:string,webEnabled:boolean,signal?:AbortSignal,onOutput?:(event:ProjectCheckOutput)=>void):Promise<CommandResult>{
  if(signal?.aborted)throw new DOMException('Stopped','AbortError');
  const {Channel}=await import('@tauri-apps/api/core');const channel=new Channel<ProjectCheckOutput>();channel.onmessage=event=>onOutput?.(event);
  const runId=uid();let cancelling=false;
  // A cancellation arriving before native registration is retried until the
  // command settles, so Stop cannot lose a race with process creation.
  const cancel=()=>{cancelling=true;void invokeProject('cancel_project_command',{root,runId}).catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setInterval(()=>{if(cancelling)cancel();},100);
  try{return await invokeProject<CommandResult>('run_project_command',{root,commandId,runId,webEnabled,timeoutSeconds:600,onEvent:channel});}
  finally{clearInterval(timer);signal?.removeEventListener('abort',cancel);}
}
/** All failed checks survive unrelated successes. Edits invalidate prior passes. */
export interface CheckEvidence {id:string;command:string;revision:number;status:'passed'|'failed'|'cancelled';attempts:number;runId?:string;diagnostic:string;fingerprint?:string}
export interface VerificationState {revision:number;writes:number;required:string[];checks:Record<string,CheckEvidence>;requiresBehavior?:boolean;fingerprint?:string;behaviorCommands?:string[]}
export class VerificationLedger {
  readonly state:VerificationState;
  constructor(state?:VerificationState){this.state=state?structuredClone(state):{revision:0,writes:0,required:[],checks:{}};}
  configure(commands:readonly ProjectCommand[]):void{this.state.required=commands.filter(c=>c.verification&&!c.service&&(/^(script:(check|test|lint|build|typecheck|validate|verify)(:|$))|^(cargo|tauri):(check|test|build)$|^python:(test|check)$|^local:/.test(c.id))).map(c=>c.id);this.state.behaviorCommands=commands.filter(c=>c.behavioral||/^(script:.*(?:test|e2e|integration|verify)|(?:cargo|tauri):test|python:test)$/.test(c.id)).map(c=>c.id);}
  edited(count=1):void{this.state.revision++;this.state.writes+=count;this.state.fingerprint=undefined;}
  observeSource(fingerprint:string):void{if(this.state.fingerprint?this.state.fingerprint!==fingerprint:Object.values(this.state.checks).some(c=>c.status==='passed'&&!c.fingerprint))this.state.revision++;this.state.fingerprint=fingerprint;}
  record(id:string,result:ProjectCheckResult&Partial<CommandResult>):void{
    if(result.source_before)this.observeSource(result.source_before);const changed=Boolean(result.source_before&&result.source_after&&result.source_before!==result.source_after);if(result.source_after)this.observeSource(result.source_after);
    const changedCheck=changed&&result.verification!==false&&!id.startsWith('install:');
    this.state.checks[id]={id,command:result.command,revision:this.state.revision,status:result.cancelled?'cancelled':result.exit_code===0&&!result.timed_out&&!changedCheck?'passed':'failed',attempts:(this.state.checks[id]?.attempts??0)+1,runId:result.run_id,fingerprint:result.source_after,diagnostic:(`${result.stdout}\n${result.stderr}`+(changedCheck?'\nSource changed during verification. Run the check against the resulting current source.':'')).slice(-6000)};
  }
  pending():string[]{return [...new Set([...this.state.required,...Object.keys(this.state.checks).filter(id=>this.state.checks[id]!.status!=='passed')])].filter(id=>{const c=this.state.checks[id];return !c||c.status!=='passed'||c.revision!==this.state.revision;});}
  get behaviorMissing():boolean{return Boolean(this.state.requiresBehavior&&!this.state.required.some(id=>(this.state.behaviorCommands??[]).includes(id)||/^(script:.*(?:test|e2e|integration|verify)|(?:cargo|tauri):test|python:test)$/.test(id)));}
  completion(requireWrite:boolean):{ok:boolean;pending:string[];reason?:string}{
    const pending=this.pending();if(requireWrite&&this.state.writes===0)return{ok:false,pending,reason:'No actual project write has been confirmed.'};
    if(this.behaviorMissing)return{ok:false,pending,reason:'Functional changes require a focused behavioral test command in the project manifests. Inspect the affected behavior, add a test that fails before the repair when appropriate, and execute it. Build/type checks alone do not validate a feature.'};
    return pending.length?{ok:false,pending,reason:'Run these commands against the current files; inspect diagnostics and repair failures before completing.'}:{ok:true,pending};
  }
  context():string{return JSON.stringify({fileRevision:this.state.revision,behaviorEvidenceMissing:this.behaviorMissing,pendingCommands:this.pending(),passedCurrentCommands:Object.values(this.state.checks).filter(c=>c.status==='passed'&&c.revision===this.state.revision).map(c=>c.id),checks:Object.values(this.state.checks).filter(c=>c.status!=='passed').map(c=>({id:c.id,status:c.status,revision:c.revision,attempts:c.attempts,runId:c.runId,diagnostic:(c.diagnostic.split('\n').find(l=>/ERR_[A-Z_]+|Cannot find|error TS[0-9]|error\[E[0-9]/.test(l))??c.diagnostic.slice(-180)).slice(0,220)}))});}

}
