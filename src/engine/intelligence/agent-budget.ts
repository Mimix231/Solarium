import type { SpicaContextCycle, SpicaTaskPlan } from './spica-task-orchestrator';
/** Budget governs input assembly at natural model/tool-turn boundaries, NEVER
 * splits a reasoning stream, duplicates a model load or generates fake Continue prompts. */
export type AgentCycleBudget = 2048 | 4096 | 8192 | 'auto';
export interface AgentBudgetAllocation {workingLimit:number;modelCapacity:number;reservedOutput:number;cycle:number}
export class AgentBudgetScheduler {
  private index=0;
  constructor(private readonly configured:AgentCycleBudget,private readonly modelCapacity:number,previousCycles=0) {
    if(!Number.isInteger(modelCapacity)||modelCapacity<512)throw Error('Invalid model context capacity.');
    this.index=previousCycles;
  }
  allocate():AgentBudgetAllocation {
    const target=this.configured==='auto'?this.modelCapacity:this.configured;
    // Smaller configured windows are still limited by the real model.
    const workingLimit=Math.min(this.modelCapacity,target);
    return {workingLimit,modelCapacity:this.modelCapacity,reservedOutput:Math.max(64,Math.min(512,Math.floor(workingLimit/8))),cycle:++this.index};
  }
  checkpoint(allocation:AgentBudgetAllocation,promptTokens:number|null,source:'server'|'estimate'|'unknown',graphRevision:number|null):SpicaContextCycle {
    return {index:allocation.cycle,budget:allocation.workingLimit,promptTokens,tokenSource:source,
      contextCapacity:this.modelCapacity,graphRevision,at:new Date().toISOString()};
  }
}
/** Select only verified state: no model-generated summaries or untrusted tool prose. */
export class AgentContextAssembler {
  assemble(plan:SpicaTaskPlan,maxChars=1500):string {
    const steps=plan.steps.map(s=>`${s.title}: ${s.state}${s.evidence.length?' ('+s.evidence.at(-1)+')':''}`).join('; ');
    return (`SAVED SPICA TASK CHECKPOINT: ${plan.goal}\nProject ${plan.projectId}; revision ${plan.graphRevision??'none'}; status ${plan.status}; verified graph changes ${plan.verifiedChanges}.\n${steps}\n`+
      `Next action: ${plan.steps.find(s=>s.state!=='completed')?.title??'Verify outcome'}. `+
      `Previous tool: ${plan.lastTool??'none'}. ${plan.lastError?`Diagnostic: ${plan.lastError}. `:''}`+
      `Use exact registered parameters, real tool outputs, and revision checks; never mistake inspection for saving.`).slice(0,Math.max(0,maxChars));
  }
}
