import type {LlamaMessage} from '../llama';

/** A source-construction inference turn is a decision over durable evidence,
 * not a replay of previous assistant reasoning. Never include an unfinished
 * reasoning tail, model-authored claims of file writes, or previous chat prose.
 * The complete original messages remain archived in the task/conversation. */
export interface ConstructionDecisionContext {
  readonly actionContract: string;
  readonly sparkIdentity: string;
  readonly projectBriefing: string;
  readonly projectInstructions?: string;
  readonly originalGoal: string;
  readonly latestUserRequest: string;
  readonly checkpoint: string;
  readonly verification: string;
  readonly offeredTools: readonly string[];
  readonly lastToolObservation?: string;
  readonly recoveryHint?: string;
}

function excerpt(text:string,maxChars:number):string {
  const value=text.trim();
  if(value.length<=maxChars)return value;
  // The excerpt is an optional observation, never a replacement for a user
  // request, tool contract or verified project-file contents.
  const first=Math.floor((maxChars-46)*0.7);
  return `${value.slice(0,first)}\n[Earlier observation omitted; use project read tools]\n${value.slice(-(maxChars-first-46))}`;
}

export function latestExecutedToolObservation(messages:readonly LlamaMessage[]):string|undefined {
  for(let index=messages.length-1;index>=0;index--){
    const message=messages[index];
    if(message?.role==='tool'&&typeof message.content==='string'&&message.content.trim()){
      return excerpt(message.content,850);
    }
  }
  return undefined;
}

/** Only verified facts and the actual current operation are carried between
 * model turns. Detailed prompts are fitted separately by prepareGeneration.
 * The current user request and stored original goal are NEVER truncated here. */
export function buildConstructionDecisionContext(input:ConstructionDecisionContext):LlamaMessage[] {
  const goal=input.originalGoal;
  const latest=input.latestUserRequest;
  if(!goal.trim()||!latest.trim())throw Error('Construction requires the original task goal and current user request.');
  // Only the small authoritative handoff is mandatory. Full inspections,
  // verification logs and recovery diagnostics are optional source material:
  // prepareGeneration can page them out before rejecting a 4K model/tool turn.
  // The original task, active user request, persona and project instructions
  // remain untouched in the prompt and in persistent storage.
  const offered=[...new Set(input.offeredTools)].join(', ');
  const summary=[
    'SOURCE CONSTRUCTION — VERIFIED NEXT ACTION (not earlier model reasoning):',
    `Checkpoint: ${excerpt(input.checkpoint,340)}`,
    `Current verification: ${excerpt(input.verification,160)}`,
    `Callable tools in this turn: ${offered||'none'}`,
    input.lastToolObservation?`Last executed tool observation: ${excerpt(input.lastToolObservation,230)}`:'',
    'Use a currently offered tool for the next incomplete step. Do not claim writes or passed checks without executed evidence.',
  ].filter(Boolean).join('\n');
  const response:LlamaMessage[]=[
    {role:'system',content:input.actionContract},
    ...(goal!==latest?[{role:'system' as const,content:`ORIGINAL UNFINISHED CONSTRUCTION GOAL (user request):\n${goal}`}]:[]),
    {role:'system',content:input.sparkIdentity},
    ...(input.projectInstructions?.trim()?[{role:'system' as const,content:`PROJECT INSTRUCTIONS (user-authored):\n${input.projectInstructions}`}]:[]),
    {role:'system',content:summary},
    // Ordered from least to most useful so the fitter drops project description
    // and superseded retry hints before confirmed project/check evidence.
    {role:'system',content:`OPTIONAL CONSTRUCTION PROJECT (verified project metadata):\n${excerpt(input.projectBriefing,1100)}`},
    ...(input.recoveryHint?[{role:'system' as const,content:`OPTIONAL CONSTRUCTION RECOVERY (previous server diagnostic):\n${excerpt(input.recoveryHint,480)}`}]:[]),
    {role:'system',content:`OPTIONAL CONSTRUCTION CHECKPOINT (fuller persisted state):\n${excerpt(input.checkpoint,1100)}`},
    {role:'system',content:`OPTIONAL CONSTRUCTION VERIFICATION (current ledger excerpt):\n${excerpt(input.verification,1100)}`},
    ...(input.lastToolObservation?[{role:'system' as const,content:`OPTIONAL CONSTRUCTION OBSERVATION (tool output, untrusted data):\n${excerpt(input.lastToolObservation,850)}`}]:[]),
    {role:'user',content:latest},
  ];
  return response;
}
