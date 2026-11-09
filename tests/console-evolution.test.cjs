const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');
const root = path.join(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('projects and custom channels persist through workspace rehydration, preserving scoped sessions', () => {
  const workspace = defaultWorkspace();
  const project = { id:'project-a', name:'Editor', description:'', instructions:'project only', folder:'C:\\MyProject', sparkId:null, modelId:null, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  workspace.projects = [project]; workspace.activeProjectId = project.id;
  workspace.preferences.startupView = 'home';
  workspace.preferences.consoleChannels = [{id:'channel-a',title:'Video Editor',projectId:project.id,sparkId:workspace.selectedSparkId,icon:'✦',createdAt:'2026-01-01'}];
  const spark = workspace.selectedSparkId;
  workspace.sessions.push({ id:'chat-a', title:'Project chat', sparkId:spark, modelId:null, projectId:project.id, mode:'conversation', createdAt:'2026-01-01',updatedAt:'2026-01-01', messages:[] });
  workspace.sessions.push({ id:'chat-b', title:'Global chat', sparkId:spark, modelId:null, projectId:null, mode:'conversation', createdAt:'2026-01-01',updatedAt:'2026-01-01', messages:[] });
  const loaded = validateWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(loaded.projects[0].name, 'Editor');
  assert.equal(loaded.preferences.consoleChannels[0].projectId,'project-a');
  assert.equal(loaded.preferences.startupView,'home');
  assert.deepEqual(loaded.sessions.filter(s=>s.projectId===loaded.activeProjectId).map(s=>s.id), ['chat-a']);
  assert.deepEqual(loaded.sessions.filter(s=>!s.projectId).map(s=>s.id), ['chat-b']);
});

test('unknown project / deleted Spark channel references are safely unlinked during load', () => {
  const w = defaultWorkspace();
  w.preferences.consoleChannels = [{id:'bad',title:'Shortcut',projectId:'deleted',sparkId:'deleted',icon:'✦',createdAt:'2026-01-01'}];
  const validated = validateWorkspace(w);
  assert.equal(validated.preferences.consoleChannels[0].projectId, null);
  assert.equal(validated.preferences.consoleChannels[0].sparkId, null);
});

test('project creation and project chats are discoverable directly from Conversations', () => {
  const shell=source('src/components/Shell.tsx');
  const dialog=source('src/components/CreateProjectDialog.tsx');
  const store=source('src/state/useSolarium.ts');
  assert.match(shell,/Create project/);
  assert.match(shell,/New \{currentProject \? 'project conversation'/);
  assert.match(dialog,/addProject\(name, target, sparkId \|\| null, modelId \|\| null\)/);
  assert.match(store,/draft\.activeProjectId = project\?\.id \?\? null/);
  assert.match(shell,/\(s\.projectId \?\? null\) === \(workspace\.activeProjectId \?\? null\)/);
});

test('action tools are backed by approved native commands, never simulated success strings', () => {
  const agent=source('src/engine/agent.ts');
  const tools=source('src/engine/tools.ts');
  const rust=source('src-tauri/src/creator.rs');
  for (const action of ['inspect_project','search_project_code','apply_project_changes']) assert.match(tools,new RegExp(action));
  assert.match(agent,/await authorize\(call\.function\.name, args, editReview\?\.args\)/);
  assert.match(source('src/engine/action-permissions.ts'), /mode === 'yolo'/);
  assert.match(agent,/events\.emit\('tool_result', output\.slice\(0, 800\), \{ tool: call\.function\.name, status: resultStatus \}\)/);
  assert.match(rust,/pub fn apply_project_changes\(/);
  assert.match(rust,/canonicalize\(\)/);
  assert.match(rust,/previously written files were rolled back/i);
});

test('real tool results include their session ID in activity history', () => {
  const results=[];
  const emitter=new AgentEventEmitter(event=>results.push(event),'session-42');
  emitter.emit('tool_call','request',{tool:'inspect_project',status:'started'});
  emitter.emit('tool_result','files found',{tool:'inspect_project',status:'completed'});
  assert.deepEqual(results.map(x=>x.sessionId),['session-42','session-42']);
  const workspace=defaultWorkspace();
  workspace.workEvents=results;
  const loaded=validateWorkspace(workspace);
  assert.deepEqual(loaded.workEvents.map(x=>x.status), ['started','completed']);
});

test('server lifecycle uses Windows Job Object and dedicated WSL shutdown, no blind port takeover', () => {
  const lib=source('src-tauri/src/lib.rs');
  const win=source('src-tauri/src/windows_job.rs');
  assert.match(win,/JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(win,/AssignProcessToJobObject/);
  assert.match(lib,/RunEvent::Exit/);
  assert.match(lib,/--terminate/);
  assert.match(lib,/will not terminate unrelated processes/);
});

test('console UI is distinct, theme driven, motion responsive and keyboard accessible', () => {
  const home=source('src/views/ConsoleHome.tsx');
  const theme=source('src/themes/console.css');
  assert.match(home,/createSession\(undefined, null\)/); assert.match(home,/setCreateOpen\(true\)/);
  assert.match(home,/create Channel|Create Channel/);
  assert.match(home,/type="button"/);
  assert.match(theme,/var\(--accent\)/);
  assert.match(theme, /data-motion='reduced'/);
});

test('manual tool calling toggle persists on selected GGUF without altering the original model context', () => {
  const w=defaultWorkspace();
  w.models=[{ id:'llama-1', name:'Gemma', backend:'llama.cpp', endpoint:'http://127.0.0.1:8080',modelId:'gemma.gguf',toolCalling:true, contextSize:4096, temperature:.7,maxTokens:2048, createdAt:'now' }];
  const ready=validateWorkspace(w);
  assert.equal(ready.models[0].toolCalling, true);
  assert.equal(ready.models[0].contextSize,4096);
  assert.match(source('src/engine/llama.ts'), /model\.toolCalling \? 'supported'/);
  assert.match(source('src/views/Models.tsx'), /Enable tool calling/);
});

test('project scope never leaks orphaned project chat messages into All Conversations', () => {
  const w=defaultWorkspace();
  w.sessions=[{id:'private',projectId:'deleted-project',sparkId:w.selectedSparkId,title:'Private',modelId:null,mode:'work',createdAt:'now',updatedAt:'now',messages:[]}];
  assert.equal(validateWorkspace(w).sessions.length,0);
});

test('precise replace tool follows composer mode while native verifies exact match', () => {
  const tools=source('src/engine/tools.ts');
  const rust=source('src-tauri/src/creator.rs');
  const agent=source('src/engine/agent.ts');
  assert.match(agent,/await authorize\(call\.function\.name, args, editReview\?\.args\)/);
  assert.match(rust,/old\.matches\(&expected_fragment\)\.count\(\)/);
  assert.match(rust,/if matches != 1/);
  assert.match(tools,/replaceProjectText\(project.folder/);
});
