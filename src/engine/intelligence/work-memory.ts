import type { AgentToolDefinition } from '../tools';
import type { ProjectEnvironment } from './project';

export interface WorkNote { decisions?: { key: string; value: string; reason?: string }[]; next_action?: string }
interface Observation { tool: string; signature: string; result: string; status: string; revision: number; count: number; summary: string }
export interface WorkMemoryData {
  decisions: { key: string; value: string; reason?: string }[];
  nextAction: string;
  revision: number;
  affectedFiles?:string[];
  failurePaths?:string[];
  starterCreated?:boolean;
  observations: Observation[];
  facts?: { rootEntries: number; readableFiles: number; commandIds: string[]; stack: string[]; paths?:string[] };
}
const short = (text: string, length = 240) => text.replace(/\s+/g, ' ').slice(0, length);
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
// Compare the evidence, not a fresh archive/log locator or elapsed process time.
// The original output and all metadata remain in task archives and command logs.
function evidenceFingerprint(output: string): string {
  try {
    const parsed: unknown = JSON.parse(output);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const evidence = { ...(parsed as Record<string, unknown>) };
      if(evidence.provider==='glitch-project-index')return fingerprint({provider:evidence.provider,root:evidence.root,text:evidence.text});
      for (const key of ['archiveId', 'run_id', 'duration_ms']) delete evidence[key];
      return fingerprint(evidence);
    }
  } catch { /* Plain diagnostics are compared exactly. */ }
  return fingerprint(output);
}
/** A compact decision record, not a transcript or a generated reasoning channel. */
export class WorkMemory {
  readonly data: WorkMemoryData;
  environment: ProjectEnvironment | null = null;
  private nextWasNoted=false;
  constructor(saved?: WorkMemoryData) {
    this.data = saved ? structuredClone(saved) : { decisions: [], nextAction: '', revision: 0, observations: [] };
  }
  note(note?: WorkNote): string[] {
    this.nextWasNoted=Boolean(note?.next_action?.trim());
    const conflicts: string[] = [];
    for (const item of note?.decisions ?? []) {
      const key = short(item.key, 60).toLowerCase(); const value = short(item.value);
      if (!key || !value) continue;
      const old = this.data.decisions.find(d => d.key === key);
      if (old && old.value !== value && !item.reason?.trim()) { conflicts.push(`Retained ${key}=${old.value}; a change requires its reason/evidence.`); continue; }
      const decision = { key, value, ...(item.reason ? { reason: short(item.reason) } : {}) };
      if (old) Object.assign(old, decision); else this.data.decisions.push(decision);
    }
    if (note?.next_action) this.data.nextAction = short(note.next_action);
    return conflicts;
  }
  observe(tool: string, args: Record<string, unknown>, status: string, output: string, changedFiles = false): void {
    if (changedFiles){this.data.revision++;const paths=[...(typeof args.path==='string'?[args.path]:[]),...(Array.isArray(args.files)?args.files.map((f:unknown)=>typeof f==='object'&&f?String((f as {path?:unknown}).path??''):''):[])];this.data.affectedFiles=[...new Set([...(this.data.affectedFiles??[]),...paths.filter(Boolean)])];}
    if(status==='failed'){this.data.failurePaths=[...new Set(output.match(/(?:src|tests?|app|lib|scripts)[/\\][A-Za-z0-9_./\\-]+\.(?:tsx?|jsx?|rs|py|go|vue|svelte|cs|java)/g)??[])];}
    if(tool==='create_video_editor_project'&&status==='completed')this.data.starterCreated=true;
    const signature = fingerprint([tool, args]); const result = evidenceFingerprint(output);
    const old = this.data.observations.find(o => o.signature === signature && o.revision === this.data.revision && o.result === result);
    if (old) { old.count++; this.data.observations.splice(this.data.observations.indexOf(old), 1); }
    this.data.observations.push({ tool, signature, result, status, revision: this.data.revision, count: (old?.count ?? 0) || 1, summary: short(output, 180) });
    // Full operations remain in task_execution/archives. This is only the live decision index.
    this.data.observations = this.data.observations.slice(-12);
    if(status==='failed')this.data.nextAction=tool==='run_project_command'?'Use actual diagnostics/catalogue evidence; repair the cause before rerunning.':tool==='choose_project_tools'?'Use a returned alternative; file creation is apply_project_changes.':'Resolve the latest diagnostic using a different evidence-backed action.';
    else if(changedFiles&&!this.nextWasNoted)this.data.nextAction='Finish the remaining requested project files in the settled stack, then run all required checks.';
    else if(tool==='list_project_commands'&&!this.environment?.commands.length)this.data.nextAction='Create the requested project files using apply_project_changes.';
    else if(!this.data.nextAction)this.data.nextAction='Advance the original goal using the verified facts and settled decisions.';
    this.captureEnvironment(this.environment);this.nextWasNoted=false;
  }
  captureEnvironment(environment:ProjectEnvironment|null):void {
    this.environment=environment;if(!environment)return;
    let stack:string[]=[];try{const pkg=JSON.parse(environment.manifests?.find(m=>m.path==='package.json')?.content??'{}');stack=Object.keys({...pkg.dependencies,...pkg.devDependencies});}catch{/* The parse error remains an inspection diagnostic. */}
    this.data.facts={rootEntries:environment.rootEntryCount,readableFiles:environment.fileCount,commandIds:environment.commands.map(c=>c.id),stack,paths:environment.files??[]};
  }
  get stalled(): boolean {
    const current=this.data.observations.filter(o=>o.revision===this.data.revision);
    const discovery=current.slice(-3).filter(o=>/choose_project_tools|get_project_map|list_project_commands|inspect_project/.test(o.tool));
    return discovery.reduce((n,o)=>n+o.count,0)>=2||current.slice(-3).some(o=>o.count>1&&(o.status==='failed'||/^(read_project_file|search_project_code|query_project_intelligence|run_project_command|run_project_check)$/.test(o.tool)));
  }
  context(): string {
    this.captureEnvironment(this.environment);const facts=this.data.facts;
    const core=this.data.decisions.filter(d=>/stack|frontend|framework|architecture|phase|goal/.test(d.key));
    const decisions=[...core,...this.data.decisions.filter(d=>!core.includes(d)).slice(-1)].slice(0,4);
    const failed=[...this.data.observations].reverse().find(o=>o.status==='failed');
    return `WORK MEMORY (retained decisions; model notes are subordinate to the user):
${facts?`Verified entries=${facts.rootEntries}; files=${facts.paths?.slice(0,12).join(', ')||'none'}; command IDs=${facts.commandIds.join(', ')||'NONE'}. Manifest stack=${facts.stack.filter(name=>!name.startsWith('@types/')).slice(0,6).join(', ')||'not declared'}.`:'Folder state unconfirmed.'}
Settled: ${decisions.map(d=>d.key+'='+d.value.slice(0,120)).join('; ')||'use user requirements'}.
Affected source: ${this.data.affectedFiles?.slice(-6).join(', ')||'none confirmed'}. Diagnostic locations: ${this.data.failurePaths?.slice(0,4).join(', ')||'read the actual failing log'}.
Next: ${this.data.nextAction.slice(0,180)||'Advance the original goal.'}
${facts&&!facts.commandIds.length?'No manifest commands exist. Create files with apply_project_changes (new expected=null); the catalogue runner is not a shell.':''}
${failed?'Rejected route: '+failed.tool+' '+failed.summary.slice(0,180):''}
${this.stalled?'Repeated unchanged investigation or failures made no progress. Use a genuinely different action; do not repeat the unchanged investigation.':''}
Observations: ${this.data.observations.slice(-2).map(o=>o.tool+':'+o.status+(o.count>1?' unchanged x'+o.count:'')).join('; ')}.
${this.data.starterCreated?'The starter files were created. Run the current required checks before rewriting working source.':''}
Keep stack/decisions across turns. Attach changed decisions and next action in work notes. Read full archived results when needed.`;
  }

}

/** Optional notes share the actual tool request; they never trigger another inference. */
export function withWorkNotes(tool: AgentToolDefinition): AgentToolDefinition {
  return { ...tool, function: { ...tool.function, parameters: { ...tool.function.parameters, properties: {
    ...(tool.function.parameters.properties as Record<string, unknown>),
    work: { type: 'object', additionalProperties: false, properties: {
      decisions: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, properties: {
        key: { type: 'string', maxLength: 60 }, value: { type: 'string', maxLength: 240 }, reason: { type: 'string', maxLength: 240 },
      }, required: ['key', 'value'] } },
      next_action: { type: 'string', maxLength: 240 },
    } },
  } } } };
}
