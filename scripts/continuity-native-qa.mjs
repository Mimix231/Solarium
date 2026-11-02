import { readFile, writeFile, mkdtemp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { connectQa } from './native-qa-client.mjs';
// Input is a local copy of the user's selected model/persona and original
// requests. The real project and production profile are never mutated.
const input=JSON.parse(await readFile('output/foundation-qa/continuity-input.json','utf8'));
let root=await mkdtemp(path.join(tmpdir(),'solarium-continuity-'));
const output=path.resolve('output/foundation-qa/continuity-'+Date.now());await mkdir(output,{recursive:true});
const report={at:new Date().toISOString(),root,model:input.model.name};
const client=await connectQa();
let resumeTarget=null;
if(process.argv.includes('--resume')){
 resumeTarget=await client.evaluate(`(async()=>{const {useSolarium}=await __qaImport('/src/state/useSolarium.ts');const w=useSolarium.getState().workspace;const project=w.projects.filter(p=>p.name==='Video Editor · continuity acceptance').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];if(!project)throw Error('No isolated task to resume');const session=w.sessions.find(s=>s.projectId===project.id);return{projectId:project.id,chatId:session.id,root:project.folder};})()`);
 assert.ok(resumeTarget.root.includes('solarium-continuity-'));root=resumeTarget.root;report.root=root;
}

try{
  console.log('Loading the selected 26B Gemma in the isolated native profile.');
  const loaded=await client.evaluate(`(async()=>{
    const {activateGGUFModel}=await __qaImport('/src/engine/desktop.ts');
    const loaded=await activateGGUFModel({executable:'E:/ChatGPTProjects/Solarium/runtime/llama-cpp/llama-server.exe',gguf:${JSON.stringify(input.model.ggufPath)},port:8094,context:${input.model.contextSize},gpuLayers:${input.model.gpuLayers??20}});
    globalThis.continuityModel={...${JSON.stringify(input.model)},modelId:loaded.modelId,endpoint:'http://127.0.0.1:8094'};return loaded;
  })()`);
  console.log(JSON.stringify({loaded:loaded.modelId}));
  report.result=await client.evaluate(`(async()=>{
    const {useSolarium}=await __qaImport('/src/state/useSolarium.ts');const {runAgent}=await __qaImport('/src/engine/agent.ts');const {AgentEventEmitter}=await __qaImport('/src/engine/activity.ts');const {evolveVisualAction}=await __qaImport('/src/engine/visual-actions.ts');
    const state=useSolarium.getState(),spark=${JSON.stringify(input.spark)};const model=globalThis.continuityModel;
    useSolarium.setState(s=>({workspace:{...s.workspace,sparks:[...s.workspace.sparks.filter(c=>c.id!==spark.id),spark],models:[...s.workspace.models.filter(m=>m.id!==model.id),model]}}));
    const resume=${JSON.stringify(resumeTarget)};let projectId,chatId;
    if(resume){projectId=resume.projectId;chatId=resume.chatId;state.appendMessage(chatId,{id:crypto.randomUUID(),role:'user',content:'Resume the coding task. Keep the original goal and chosen stack. Repair the saved native write failure, then run all current checks and verify completion.',createdAt:new Date().toISOString()});}
    else{projectId=state.addProject('Video Editor · continuity acceptance',${JSON.stringify(root)});state.updateProject(projectId,{sparkId:spark.id,modelId:model.id});chatId=state.createSession(spark.id,projectId);for(const message of ${JSON.stringify(input.messages)})state.appendMessage(chatId,message);}
    const workspace=useSolarium.getState().workspace,session=workspace.sessions.find(s=>s.id===chatId),messageId=crypto.randomUUID();const events=[],runs=[],warnings=[],actions=new Map();let reply='',reasoning='';let reasoningMs=0;
    globalThis.continuityController=new AbortController();globalThis.continuityProgress={state:'working',projectId,chatId,tools:[],reasoningCharacters:0};
    const output=await runAgent({spark,model,session,projects:workspace.projects,memories:workspace.memories,preferences:{...workspace.preferences,actionMode:'yolo'},events:new AgentEventEmitter(e=>{if(e.kind==='tool_result'){events.push({tool:e.tool,status:e.status,text:e.text});globalThis.continuityProgress={...globalThis.continuityProgress,tools:events};}}),signal:continuityController.signal,messageId,webEnabled:false,
      onWorkUpdate:text=>{reply=reply.slice(0,-text.length);const id='progress-'+crypto.randomUUID();actions.set(id,evolveVisualAction(undefined,{operationId:id,kind:'inspect',status:'completed',title:'Progress update',detail:text,output:text},chatId,messageId,new Date().toISOString()));},
      onAnswer:d=>reply+=d,onWarning:w=>{warnings.push(w);globalThis.continuityProgress.warning=w;},onTerminal:r=>runs.push(r),onApproval:async()=> 'allow',
      onThinking:s=>{reasoning=s.text;reasoningMs=s.elapsedMs;globalThis.continuityProgress.reasoningCharacters=reasoning.length;globalThis.continuityProgress.reasoningTail=reasoning.slice(-1200);globalThis.continuityProgress.goalRestarts=(reasoning.match(/The user wants/gi)??[]).length;},
      onWorkspace:update=>{const id=update.operationId??crypto.randomUUID();actions.set(id,evolveVisualAction(actions.get(id),{...update,operationId:id},chatId,messageId,new Date().toISOString()));},
    });
    state.appendMessage(chatId,{id:messageId,role:'assistant',content:output,sparkId:spark.id,terminalRuns:runs,reasoning,reasoningMs,generationWarning:warnings.at(-1),createdAt:new Date().toISOString()});for(const a of actions.values())state.upsertVisualAction(a);
    useSolarium.setState({view:'chat'});const {foundationStore}=await __qaImport('/src/foundation/store.ts');const tasks=await foundationStore.list({scopes:[{kind:'project',id:projectId}],collection:'task_execution'});const task=tasks.find(t=>t.data.sessionId===chatId);
    globalThis.continuityProgress={...globalThis.continuityProgress,state:task?.data.state};return{projectId,chatId,reply:output,streamEqualsReply:reply===output,reasoningCharacters:reasoning.length,warnings,runs,events,task:task?.data};
  })()`);
  report.files=await readdir(root,{recursive:true});
  console.log(JSON.stringify({state:report.result.task?.state,files:report.files.length,tools:report.result.events,commands:report.result.runs.map(r=>({command:r.command,exit:r.exitCode})),warnings:report.result.warnings}));
  assert.equal(report.result.task?.state,'completed');assert.ok(report.files.some(p=>String(p).replaceAll('\\','/')==='src-tauri/Cargo.toml'));assert.ok(report.result.task.verification.writes>0);assert.deepEqual(report.result.task.verification.required.filter(id=>report.result.task.verification.checks[id]?.status!=='passed'),[]);assert.equal(report.result.streamEqualsReply,true);
}catch(error){report.error=String(error);console.error(error);process.exitCode=1;}finally{await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Native acceptance report: '+path.join(output,'report.json'));client.close();}
