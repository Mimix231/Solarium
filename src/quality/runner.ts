import { sourceIdentity } from './source-identity.generated';
import { saveStorySetup } from '../stories/setup';
import { runLongWriting } from '../writing/long-task';
import { prepareGeneration } from '../engine/context-window';
import { readyModel } from '../engine/model-ready';
import { uid, now, type ChatSession, type LocalModel, type Spark, type GenerationMetrics } from '../domain/types';
import { useSolarium } from '../state/useSolarium';
import { foundationStore, newRecord } from '../foundation/store';
import type { StoredRecord } from '../foundation/types';
import { runAgent } from '../engine/agent';
import { runConversation } from '../engine/conversation-run';
import { AgentEventEmitter } from '../engine/activity';
import { parseMessageParts } from '../blocks/protocol';
import { WritingRepository, wordCount } from '../writing/repository';
import { StoryRepository } from '../stories/repository';
import { SourceRepository } from '../sources/repository';
import { readProjectFile } from '../engine/creator';
import { readableProse, repeatedPassages } from '../writing/prose';
import { deriveBrief, resolveBrief } from '../engine/intelligence/brief';
import type { TaskData } from '../engine/intelligence/task';
import type { QualityCase } from './cases';
import { CodeRepository } from '../coding/artifacts/repository';
import {taskBoardAcceptance} from './app-acceptance';

export interface QualityCheck { name: string; passed: boolean; detail: string }
export interface QualityRun {
  caseId: string; caseSet?:'regression'|'holdout'; caseTitle: string; category: string; sessionId: string; projectId: string | null;
  model: Pick<LocalModel, 'id' | 'name' | 'backend' | 'contextSize' | 'temperature'>;
  instance: { app: string; identifier: string };
  fingerprints?:{engine:string;scenario:string;conditions:string;source?:string;nativeBinary?:string;commit?:string|null}; startedAt: string; finishedAt?: string;
  state: 'running' | 'passed' | 'failed' | 'needs_review' | 'cancelled' | 'blocked';
  checks: QualityCheck[]; warnings: string[]; metrics: GenerationMetrics[]; reasoningCharacters: number;
  capabilities?:import('../domain/types').Capabilities;outcomes?:import('../engine/continuous-generation').GenerationOutcome[];operations: { tool?: string; status?: string }[]; review: string[]; ratings?: Record<string, number>; notes?: string;interventions?:{kind:'manual_code_correction';detail:string;at:string}[];
}
export interface QualityOptions {
  model: LocalModel; spark: Spark; signal: AbortSignal; webEnabled: boolean;
  onApproval: (name: string, args: Record<string, unknown>) => Promise<'allow' | 'deny'>;
  onProgress?: (run: QualityRun) => void;
}
const hashText=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function qualityEngineFingerprint(nativeBinary?:string):Promise<string>{
  let binary=nativeBinary??'browser';
  if(!nativeBinary&&typeof window!=='undefined'&&'__TAURI_INTERNALS__' in window){const {invoke}=await import('@tauri-apps/api/core');binary=(await invoke<{nativeBinarySha256:string}>('coding_quality_identity')).nativeBinarySha256;}
  return hashText(sourceIdentity.sha256+'\n'+binary+'\n'+[runAgent,runLongWriting,deriveBrief,resolveBrief,saveStorySetup,prepareGeneration,runConversation,parseMessageParts,WritingRepository.prototype.bind,StoryRepository.prototype.contextPack].map(String).join('\n'));
}
/** Executes inside the normal Solarium renderer, with its real engine, workspace and permissions. */
export async function runQualityCase(test: QualityCase, options: QualityOptions): Promise<StoredRecord<QualityRun>> {
  const { getName, getIdentifier } = await import('@tauri-apps/api/app');
  const instance = { app: await getName(), identifier: await getIdentifier() };
  const {invoke}=await import('@tauri-apps/api/core');
  const binary=await invoke<{nativeBinarySha256:string}>('coding_quality_identity');
  if (test.requiresWeb && !options.webEnabled) throw Error('This case requires the app’s Web Search permission. It was not enabled by the quality runner.');
  const state = useSolarium.getState();
  const ready=await readyModel(options.model,state.workspace.preferences);options={...options,model:ready.model};state.upsertModel(ready.model);
  const time = now(); const sessionId = uid(); let projectId: string | null = null;
  if (test.files) {
    const { invoke } = await import('@tauri-apps/api/core');
    const fixture = await invoke<{ root: string; files: number }>('create_quality_fixture', { files: test.files });
    projectId = uid();
    useSolarium.setState(s => ({ workspace: { ...s.workspace, projects: [...(s.workspace.projects ?? []), { id: projectId!, name: 'Quality · '+test.title, description: test.title, instructions: 'Preserve the public interface and independent reference tests. Verify actual behaviour.', folder: fixture.root, sparkId: options.spark.id, modelId: options.model.id, createdAt: time, updatedAt: time }] } }));
  }
  const session: ChatSession = { id: sessionId, title: 'Quality · '+test.title, sparkId: options.spark.id, modelId: options.model.id, projectId, mode: test.category === 'coding' ? 'work' : test.category === 'research' ? 'research' : 'creative', createdAt: time, updatedAt: time, messages: test.messages.map(m => ({ ...m, id: uid(), createdAt: time })) };
  useSolarium.setState(s => ({ workspace: { ...s.workspace, sessions: [...s.workspace.sessions, session] } }));
  const access = { sessionId, projectId }; const scope = projectId ? { kind: 'project' as const, id: projectId } : { kind: 'chat' as const, id: sessionId };
  const writing = new WritingRepository(access); const messageId = uid(); const warnings: string[] = [];
  let fixtureSourceId:string|null=null;const suppliedSources:string[]=[];
  if (test.source) fixtureSourceId=(await new SourceRepository(access).create({ scope, title: test.source.title, content: test.source.text, kind: 'note', origin: { kind: 'user_note' } })).id;
  let record = newRecord<QualityRun>('quality_run', uid(), scope, test.title, { caseId: test.id, caseSet:test.caseSet, caseTitle: test.title, category: test.category, sessionId, projectId, model: { id: options.model.id, name: options.model.name, backend: options.model.backend, contextSize: options.model.contextSize, temperature: options.model.temperature }, instance, fingerprints:{engine:await qualityEngineFingerprint(binary.nativeBinarySha256),source:sourceIdentity.sha256,nativeBinary:binary.nativeBinarySha256,commit:sourceIdentity.commit,scenario:await hashText(JSON.stringify(test)),conditions:await hashText(JSON.stringify({spark:options.spark,model:options.model,permissions:state.workspace.preferences.toolPermissions,mode:state.workspace.preferences.actionMode,web:options.webEnabled}))}, startedAt: time, state: 'running', checks: [], warnings, metrics: [], reasoningCharacters: 0, operations: [], review: test.review ?? [] } satisfies QualityRun);
  await foundationStore.batch([{ record, expected: null }]);
  const publish = async () => { const next = { ...record, version: record.version + 1, updatedAt: now() }; await foundationStore.batch([{ record: next, expected: record.version }]); record = next; options.onProgress?.(record.data); };
  const controller = new AbortController(); const stop = () => controller.abort(); options.signal.addEventListener('abort', stop, { once: true }); if (options.signal.aborted) stop();
  let answer='',intentionalStop=false;
  const check = (name: string, passed: boolean, detail: string) => record.data.checks.push({ name, passed, detail });
  try {
    options.onProgress?.(record.data);
    await runConversation({ ...options, session, messageId, memories: state.workspace.memories, worlds: state.workspace.worlds, preferences: state.workspace.preferences, projects: useSolarium.getState().workspace.projects, signal: controller.signal,
      events: new AgentEventEmitter(event => { if (event.kind === 'tool_result') record.data.operations.push({ tool: event.tool, status: event.status }); }),
      onAnswer: delta => { answer += delta; if (test.cancelAfterCharacters && answer.length > test.cancelAfterCharacters && !intentionalStop) { intentionalStop = true; controller.abort(); } },
      onAnswerReplace: text => { answer = text; },
      onWorkUpdate:text=>{answer=answer.slice(0,-text.length);},
      onStory:id=>{session.storyId=id;},
      onSavedSources:references=>suppliedSources.push(...references.map(r=>r.sourceId)),onWarning: warning => warnings.push(warning), 
      onCapabilities:capabilities=>{record.data.capabilities=capabilities;},onGenerationOutcome:outcome=>{(record.data.outcomes??=[]).push(outcome);},onMetrics: metrics => { record.data.metrics.push(metrics); options.onProgress?.(record.data); },
      onThinking: thought => { record.data.reasoningCharacters = thought.text.length;options.onProgress?.(record.data); },
    },state);
  } catch (error) { if (!controller.signal.aborted) warnings.push(String(error)); }
  finally {
    const documents = (await writing.list()).filter(d => d.data.originMessageId === messageId||d.data.messageBindings?.includes(messageId));
    const prose = (await Promise.all(documents.map(async d => (await writing.get(d.id)).content.markdownProjection))).join('\n');
    if (test.cancelAfterCharacters) {
      const tasks = await foundationStore.list<{ state: string }>({ collection: 'writing_task', scopes: [scope] });
      const drafts = await Promise.all(documents.map(d => writing.draft(d.id)));
      check('Cancelled work remains incomplete', intentionalStop && tasks.some(t => t.data.state === 'cancelled'), 'The real generation was stopped through its AbortSignal.');
      check('Recovery text exists', drafts.some(d => Boolean(d?.markdown.trim())), 'Actual recovery text was read back from the writing repository.');
    } else {
      check('Completed without unexpected runtime warnings', warnings.every(w=>test.offlineDisclosure&&w.startsWith('Online research is blocked because Web Search is OFF.')), warnings.join('\n') || 'No generation or storage warning.');
      if (test.files) {
        const project = useSolarium.getState().workspace.projects!.find(p => p.id === projectId)!;
        const task = (await foundationStore.list<TaskData>({ collection: 'task_execution', scopes: [scope] })).find(t => t.data.sessionId === sessionId);
        check('All current project checks passed', task?.data.state === 'completed' && Boolean(task.data.verification?.writes) && (task.data.verification?.required.length ?? 0) >= (test.minimumChecks??3) && task.data.verification!.required.every(id => task.data.verification!.checks[id]?.status === 'passed' && task.data.verification!.checks[id]?.revision === task.data.verification!.revision), 'Actual native command results and file revisions are required.');
        if(test.minimumEditedFiles){const edited=new Set(task?.data.operations.flatMap(o=>o.status==='completed'?o.files??[]:[])??[]);check('Requested source modules were actually edited',edited.size>=test.minimumEditedFiles,`${edited.size}/${test.minimumEditedFiles} confirmed file paths`);}
        for (const file of test.files.filter(f => f.path.startsWith('tests/'))) check('Reference tests preserved', (await readProjectFile(project.folder, file.path)) === file.content, file.path);
        if(test.appAcceptance&&task?.data.state==='completed'){
          try{const result=await taskBoardAcceptance(project.folder,controller.signal);check('Independent application acceptance',result.exit_code===0&&!result.timed_out&&!result.cancelled,`${result.stdout}\n${result.stderr}`);}
          catch(error){check('Independent application acceptance',false,String(error));}
          check('Complete application plan and duplication audit',Boolean(task.data.appPlan?.audit&&task.data.appPlan.steps.every(s=>s.state==='verified')&&!task.data.appPlan.audit.duplicates.length),'Read the durable feature plan and actual source audit. Functional/UI review remains separate.');
        }
      } else if(test.generatedCode){
        const repo=new CodeRepository(access),artifacts=(await repo.list()).filter(a=>a.data.origin.messageId===messageId);
        const blocks=parseMessageParts(answer).flatMap(p=>p.type==='block'&&['code','preview'].includes(p.block.kind)?[p.block]:[]);
        check('Generated source saved with its actual origin',artifacts.length>0&&artifacts.every(a=>a.data.origin.sparkId===options.spark.id&&a.data.state==='ready'&&Boolean(a.data.currentRevisionId)),`${artifacts.length} saved source artifacts; natural model completion is required.`);
        const exact=await Promise.all(artifacts.map(async a=>{const {content}=await repo.get(a.id);return blocks.some(b=>b.id===a.data.origin.blockId&&b.content===content);}));
        check('Saved source matches the visible code fences',exact.length>0&&exact.every(Boolean),'Read back the complete saved source, without a clipping or synthetic replacement step.');
        check('Generation did not claim a native project write',artifacts.every(a=>!a.data.applied)&&!record.data.operations.some(o=>['apply_project_changes','replace_project_text','run_project_command'].includes(o.tool??'')),'Applying files and verifying behaviour remain separate native actions.');
      } else if (test.category === 'writing' || test.category === 'memory') {
        check('One saved writing artifact', documents.length === 1, `${documents.length} actual documents.`);
        check('Readable artifact structure', !readableProse(prose).issues.length && !parseMessageParts(answer).some(p => p.type === 'block' && p.block.issues?.length), 'No nested writing opener in the saved prose or display block.');
        check('No substantial repeated passages', repeatedPassages(prose).length === 0, 'Checks substantial four-word overlap; literary coherence is reviewed separately.');
        if (test.minimumCharacters) check('Character target reached', Array.from(prose).length >= test.minimumCharacters, `${Array.from(prose).length}/${test.minimumCharacters}`);
        if (test.minimumWords) check('Word target reached', wordCount(prose) >= test.minimumWords, `${wordCount(prose)}/${test.minimumWords}`);
        if (test.approvedBeats) {
          const brief = deriveBrief(session); const tasks = await foundationStore.list<{ state: string; scenes: { status: string; beatId?: string; proof?: { quote: string } }[] }>({ collection: 'writing_task', scopes: [scope] });
          check('Approved beats have saved supporting passages', Boolean(brief.approvedPlan) && brief.approvedPlan!.beats.every(b => tasks.some(t => t.data.state === 'completed' && t.data.scenes.some(s => s.beatId === b.id && s.status === 'accepted' && s.proof?.quote && prose.includes(s.proof.quote)))), 'Passages prove actual text exists; review judges whether it fulfils the intended event.');
        }
      }
      if (test.facts?.length || test.forbidden?.length) {
        const stories = new StoryRepository(access); const world = session.storyId ? await stories.world(session.storyId) : null;
        const claims = world ? (await Promise.all((await stories.characters(world.id)).map(c => stories.claims(c.id, world.id)))).flat() : [];
        const text = claims.map(c => c.data.value).join('\n').toLowerCase();
        for (const fact of test.facts ?? []) check('User fact retained: '+fact, text.includes(fact.toLowerCase()), 'Read back from persisted character claims.');
        for (const forbidden of test.forbidden ?? []) check('Suggestion not promoted: '+forbidden, !text.includes(forbidden.toLowerCase()), 'Examines saved claims, not an imagined expected response.');
        check('User facts have original-message evidence', claims.filter(c => c.data.kind === 'user_defined').every(c => session.messages.some(m => m.role === 'user' && m.id === c.data.userMessageId && c.data.userQuote && m.content.includes(c.data.userQuote) && c.data.userQuote.includes(c.data.value))), 'Exact human message and quoted value are required.');
      }
      if (test.offlineDisclosure) check('Offline research is disclosed', /\b(offline|web.{0,12}(off|disabled|unavailable)|cannot (?:browse|access)|existing (?:model )?knowledge|training data|not.{0,12}(brows|online))\b/i.test(answer) && !record.data.operations.some(e => ['search_web','open_web_page','search_specific_scene'].includes(e.tool ?? '')), 'The run made no web tool call.');
      if (test.source) check('Saved source was actually read or retrieved', Boolean(fixtureSourceId&&suppliedSources.includes(fixtureSourceId))||record.data.operations.some(e => ['read_saved_source'].includes(e.tool ?? '')), 'Scoped retrieval or a real source-reading operation is required.');
    }
    record.data.finishedAt = now();
    record.data.state = controller.signal.aborted && !intentionalStop ? 'cancelled' : record.data.checks.some(c => !c.passed) ? 'failed' : test.review?.length ? 'needs_review' : 'passed';
    await publish(); options.signal.removeEventListener('abort', stop);
  }
  return record;
}

export async function saveQualityReview(record: StoredRecord<QualityRun>, ratings: Record<string, number>, notes: string): Promise<void> {
  if (Object.values(ratings).some(n => !Number.isInteger(n) || n < 1 || n > 5)) throw Error('Ratings must be between 1 and 5.');
  const reviewed = record.data.review.length > 0 && record.data.review.every(item => ratings[item] !== undefined);
  const allGood = reviewed && record.data.review.every(item => ratings[item]! >= 4);
  await foundationStore.batch([{ record: { ...record, version: record.version + 1, updatedAt: now(), data: { ...record.data, ratings, notes, state: record.data.checks.some(c => !c.passed) ? 'failed' : allGood ? 'passed' : reviewed ? 'failed' : 'needs_review' } }, expected: record.version }]);
}

/** Record later human changes without rewriting the original autonomous result. */
export async function recordQualityIntervention(record:StoredRecord<QualityRun>,detail:string):Promise<void>{
  if(!detail.trim())throw Error('Describe the actual manual correction.');
  await foundationStore.batch([{record:{...record,version:record.version+1,updatedAt:now(),data:{...record.data,interventions:[...(record.data.interventions??[]),{kind:'manual_code_correction',detail:detail.trim(),at:now()}]}},expected:record.version}]);
}
