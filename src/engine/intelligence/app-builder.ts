import type { VerificationLedger } from './commands';
import { duplicatedCode, type SourceText } from './code-duplication';

export const APP_AUTHORING_GUIDE = 'Coding has no short-answer or 4,096-character ceiling. Implement the complete requested application, using as much original source as its functionality needs. Keep modules, interfaces, persistence, user flows, errors and tests coherent. A starter or two helper functions is not a finished app. Build in complete feature/file operations; preserve progress and continue with the remaining work after real tool results. Never inflate length with repeated functions, copied files, filler, TODO implementations or invented successes. For chat source use separate named file fences; saved code is distinct from executed project files.';

export function needsAppPlan(goal: string): boolean {
  return /\b(build|create|develop|implement|make)\b/i.test(goal) && /\b(app(?:lication)?|website|dashboard|IDE|editor|studio|builder)\b/i.test(goal) && !/\b(only|just)\s+(?:a\s+)?(?:plan|example|snippet|explanation)\b|\b(skeleton|scaffold|phase\s*1)\b/i.test(goal);
}
export interface AppStepInput { id: string; title: string; files: string[]; depends_on: string[]; acceptance: string[] }
export interface AppStep extends AppStepInput { state: 'pending' | 'verified'; sources?: { path: string; sha256: string }[]; checks?: string[] }
export interface AppPlan { goal: string; architecture: string; steps: AppStep[]; updatedAt: string; audit?: { at: string; characters: number; files: number; duplicates: ReturnType<typeof duplicatedCode> } }
export type SourceReader = (path: string) => Promise<string>;
const sha = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(n => n.toString(16).padStart(2, '0')).join('');
function relative(path: string): boolean { return Boolean(path) && !/[:\\\0]|^\//.test(path) && path.split('/').every(p => p !== '..' && p !== '.' && p !== '') && !/(?:^|\/)(?:node_modules|target|dist|\.git)(?:\/|$)/.test(path); }

export function validateAppPlan(value:unknown):asserts value is AppPlan {
  const p=value as AppPlan;
  if(!p||typeof p.goal!=='string'||typeof p.architecture!=='string'||!Array.isArray(p.steps)||!p.steps.length||p.steps.some(s=>!s||typeof s.id!=='string'||typeof s.title!=='string'||!Array.isArray(s.files)||!s.files.length||s.files.some(f=>typeof f!=='string'||!relative(f))||!Array.isArray(s.depends_on)||!Array.isArray(s.acceptance)||s.acceptance.some(a=>typeof a!=='string')||!['pending','verified'].includes(s.state)))throw Error('Invalid saved application plan.');
  const ids=new Set(p.steps.map(s=>s.id));
  if(ids.size!==p.steps.length||p.steps.some(s=>s.depends_on.some(id=>!ids.has(id)||id===s.id)||s.state==='verified'&&(!Array.isArray(s.sources)||s.sources.length!==s.files.length||s.sources.some(f=>!s.files.includes(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256))||!Array.isArray(s.checks)||!s.checks.length)))throw Error('Saved application evidence is missing or inconsistent.');
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(id:string)=>{if(visiting.has(id))throw Error('Saved application dependencies contain a cycle.');if(visited.has(id))return;visiting.add(id);for(const dep of p.steps.find(s=>s.id===id)!.depends_on)visit(dep);visiting.delete(id);visited.add(id);};
  for(const id of ids)visit(id);
}

/** Durable feature operations inside the ordinary agent loop. No additional inference, timers or continuation prompts. */
export class AppBuilder {
  data?: AppPlan;
  constructor(readonly goal: string, readonly required: boolean, saved?: AppPlan) { if(saved)validateAppPlan(saved);this.data = saved ? structuredClone(saved) : undefined; }
  get pending(): AppStep[] { return this.data?.steps.filter(s => s.state !== 'verified') ?? []; }

  plan(architecture: string, steps: AppStepInput[], extend = false): void {
    if (this.data && !extend) throw Error('An application plan already exists. Read it and extend unfinished scope; do not discard implemented features.');
    if (!architecture.trim() || architecture.length > 2000 || !steps.length || steps.length > 64) throw Error('Provide an architecture and 1–64 feature work packages per planning operation; extend the saved plan for additional scope.');
    const combined = [...(this.data?.steps ?? []), ...steps];
    const ids = new Set(combined.map(s => s.id));
    if (ids.size !== combined.length) throw Error('Step IDs must be unique; do not repeat an implemented work package.');
    for (const step of steps) {
      if (!/^[a-z][a-z0-9-]{0,59}$/.test(step.id) || !step.title.trim() || step.title.length > 300 || !step.files.length || step.files.length > 32 || step.files.some(p => !relative(p)) || new Set(step.files).size !== step.files.length || !step.acceptance.length || step.acceptance.some(s => !s.trim() || s.length > 600) || step.depends_on.some(id => id === step.id || !ids.has(id))) throw Error('Each work package needs a unique ID, scoped authored files, observable acceptance criteria and valid dependencies.');
    }
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string) => { if (visiting.has(id)) throw Error('Application dependencies contain a cycle.'); if (visited.has(id)) return; visiting.add(id); for (const dep of combined.find(s => s.id === id)!.depends_on) visit(dep); visiting.delete(id); visited.add(id); };
    for (const id of ids) visit(id);
    this.data = { goal: this.data?.goal??this.goal, architecture: this.data?.architecture ?? architecture.trim(), steps: [...(this.data?.steps ?? []), ...steps.map(s => ({ ...structuredClone(s), state: 'pending' as const }))], updatedAt: new Date().toISOString() };
  }

  async verifyStep(id: string, checks: string[], read: SourceReader, ledger: VerificationLedger): Promise<unknown> {
    const step = this.data?.steps.find(s => s.id === id);
    if (!step) throw Error('Read the saved plan and select an exact step ID.');
    if (step.depends_on.some(id => this.data!.steps.find(s => s.id === id)?.state !== 'verified')) throw Error('Complete and verify this feature’s dependencies first.');
    if (!checks.length || checks.some(id => !ledger.state.required.includes(id) || ledger.state.checks[id]?.status !== 'passed' || ledger.state.checks[id]?.revision !== ledger.state.revision || !ledger.state.checks[id]?.fingerprint)) throw Error('Supply current native verification IDs for this feature. Execute its real checks against the current source first.');
    const sources = await Promise.all(step.files.map(async path => { const text = await read(path); if (!text.trim()) throw Error('Planned implementation is empty: ' + path); return { path, sha256: await sha(text) }; }));
    step.state = 'verified'; step.sources = sources; step.checks = [...new Set(checks)]; this.data!.audit=undefined;this.data!.updatedAt = new Date().toISOString();
    return { id, state: step.state, files: sources, acceptance: step.acceptance, notice: 'Actual files and native check evidence recorded. Acceptance descriptions are the implementation plan, not independent semantic proof. Full-project checks and duplicate-source audit remain required.', next: this.pending[0]?.id ?? 'final application audit' };
  }

  async audit(read: SourceReader, ledger: VerificationLedger): Promise<{ ok: boolean; reason?: string; pending?: string[]; duplicates?: ReturnType<typeof duplicatedCode>; characters?: number }> {
    if (!this.data) return this.required ? { ok: false, reason: 'Save the complete application implementation plan before claiming the app is finished. A starter is only the first work package.' } : { ok: true };
    if (this.pending.length) return { ok: false, reason: 'Requested application work packages remain unfinished. Implement their real functionality and verify each package.', pending: this.pending.map(s => s.id) };
    const sources: SourceText[] = await Promise.all([...new Set(this.data.steps.flatMap(s => s.files))].map(async path => ({ path, content: await read(path) })));
    const changed: string[] = [];
    for (const step of this.data.steps) {
      if (step.checks?.some(id => !ledger.state.required.includes(id))) changed.push(step.id);
      for (const original of step.sources ?? []) if (await sha(sources.find(s => s.path === original.path)!.content) !== original.sha256) changed.push(step.id);
    }
    if (changed.length) { for (const id of changed) this.data.steps.find(s => s.id === id)!.state = 'pending'; return { ok: false, reason: 'Changed feature files or removed check commands need fresh step verification.', pending: [...new Set(changed)] }; }
    const duplicates = duplicatedCode(sources), characters = sources.reduce((n, s) => n + Array.from(s.content).length, 0);
    this.data.audit = { at: new Date().toISOString(), characters, files: sources.length, duplicates };
    return duplicates.length ? { ok: false, reason: 'Substantial repeated code was found. Consolidate shared implementation and repair the affected features; source length is not completion.', duplicates, characters } : { ok: true, characters };
  }

  context(): string {
    if (!this.data) return this.required ? 'APPLICATION BUILD: Save the complete feature/file plan with plan_project_app. A starter is not completion. Implement all requested functionality without a code-length ceiling or padding.' : '';
    const next = this.pending.find(s => s.depends_on.every(id => this.data!.steps.find(dep => dep.id === id)?.state === 'verified'));
    return `APPLICATION BUILD: ${this.data.steps.filter(s => s.state === 'verified').length}/${this.data.steps.length} feature operations verified. Architecture: ${this.data.architecture.slice(0, 220)}. ${next ? `Next ${next.id}: ${next.title}; files ${next.files.slice(0,8).join(', ')}; acceptance ${next.acceptance.join('; ').slice(0, 500)}.` : 'Reconcile changed source and perform final application audit.'} Use read_app_plan for full saved feature details. Do not stop at the starter, replace the plan, repeat completed modules, or inflate source length.`;
  }
}
