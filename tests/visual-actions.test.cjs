const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evolveVisualAction, restoreVisualAction, visibleActions } = require('../.test-dist/engine/visual-actions.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { parseWorkflow } = require('../.test-dist/blocks/workflow.js');
const { parseMessageParts, INLINE_FORMAT_KINDS } = require('../.test-dist/blocks/protocol.js');
const source = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const moment = () => new Date().toISOString();
const create = (fields = {}) => evolveVisualAction(undefined,{operationId:'tool:1:2:0',kind:'generate',status:'running',title:'Generating App.tsx',files:[{path:'src/App.tsx',content:'import React',complete:false}],...fields},'s1','m1', moment());

test('same tool operation updates code progressively; no false completed result', () => {
  const initial = create();
  const later = evolveVisualAction(initial,{operationId:initial.id,kind:'generate',status:'running',title:initial.title,files:[{path:'src/App.tsx',content:'import React from "react";',complete:true}]},'s1','m1',moment());
  assert.equal(later.files[0].complete,true);
  assert.equal(later.status,'running');
  assert.equal(later.createdAt,initial.createdAt);
  assert.throws(()=>evolveVisualAction(later,{operationId:later.id,kind:'save',status:'completed',title:'Saved'},'other-session','m1',moment()),/may not migrate/);
  const saved = evolveVisualAction(later,{operationId:later.id,kind:'save',status:'completed',title:'Saved',detail:'Native project write confirmed.'},'s1','m1',moment());
  assert.equal(saved.status,'completed');
  assert.match(saved.detail,/Native/);
});

test('web research grid distinguishes found from read and keeps actual sites', () => {
  const action = evolveVisualAction(undefined, { operationId:'research:a',kind:'search',status:'running',title:'Research',query:'tauri rust',sources:[{title:'Tauri Docs',url:'https://v2.tauri.app',status:'found'},{title:'FFmpeg',url:'https://ffmpeg.org',status:'reading'},{title:'Bad',url:'javascript:alert(1)',status:'read'}]}, 's1','m1', moment());
  assert.equal(action.sources.length,2);
  assert.deepEqual(action.sources.map(s=>s.status),['found','reading']);
  const read = evolveVisualAction(action,{operationId:'research:a',kind:'search',status:'completed',title:'Research',sources:[{title:'Tauri Docs',url:'https://v2.tauri.app',status:'read'}]},'s1','m1', moment());
  assert.equal(read.sources[0].status,'read');
});

test('saved visual actions are limited to real conversations; interrupted stays unverified',()=>{
  const workspace = defaultWorkspace();
  const spark = workspace.sparks[0];
  workspace.sessions.push({id:'s1',sparkId:spark.id,modelId:null,projectId:null,mode:'conversation',createdAt:moment(),updatedAt:moment(),title:'Task',messages:[{id:'m1',role:'assistant',createdAt:moment(),content:'Done'}]});
  workspace.visualActions=[create(),{...create(),id:'orphan',messageId:'deleted-message'}, {...create(),id:'other',sessionId:'other-session'}];
  const reloaded = validateWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(reloaded.visualActions.length,1);
  assert.equal(reloaded.visualActions[0].status,'failed');
  assert.match(reloaded.visualActions[0].detail,/interrupted/);
  assert.equal(visibleActions(reloaded.visualActions,'s1','m1').length,1);
  assert.equal(visibleActions(reloaded.visualActions,'s2','m1').length,0);
});

test('rendering converts safe workflow syntax into inline graph data',()=>{
  const content='flowchart LR\nA[Inspect] --> B[Generate] --> C[Test]';
  const workflow = parseWorkflow(content);
  assert.deepEqual(workflow.edges.map(e=>`${e.from}-${e.to}`),['A-B','B-C']);
  assert.equal(workflow.nodes.find(node=>node.id==='A').label,'Inspect');
  assert.equal(parseWorkflow('alert(1);'),null);
  const parts=parseMessageParts('This is a design, not proof of execution\n```mermaid\n'+content+'\n```');
  assert.equal(parts[1].block.kind,'workflow');
  assert.equal(INLINE_FORMAT_KINDS.has('workflow'),true);
});

test('visual workspace replaces activity rail, does not display simulated successes',()=>{
  const chat=source('src/views/Chat.tsx');
  const agent=source('src/engine/agent.ts');
  const card=source('src/components/VisualActionCard.tsx');
  assert.doesNotMatch(chat, /<ActivityPanel/);
  assert.match(chat, /<WorkLog/);
  assert.match(chat, /pendingActions\.current/);
  assert.match(agent,/const operationId = `tool:\$\{events\.runId\}/);
  assert.match(agent,/selectActionTools\(toolDefinitions/);
  assert.match(source('src/engine/tools.ts'),/name: 'inspect_project'/);
  assert.match(card,/Found · not yet read/);
  assert.match(agent,/resultStatus === 'completed'/);
});

test('code work can require a real tool call without forcing every subsequent turn', async () => {
  const { streamLlamaTurn } = require('../.test-dist/engine/llama.js');
  const original = global.fetch;
  let sent;
  global.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(new ReadableStream({start(controller) {
      const bytes = new TextEncoder();
      controller.enqueue(bytes.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\n'));
      controller.enqueue(bytes.encode('data: [DONE]\n\n'));
      controller.close();
    }}));
  };
  try {
    const model={endpoint:'http://127.0.0.1:8080',modelId:'test',temperature:0.5,maxTokens:2048};
    const options={tools:[{type:'function',function:{name:'inspect_project',description:'Inspect',parameters:{type:'object',properties:{}}}}],toolChoice:'required'};
    await streamLlamaTurn(model,[{role:'user',content:'Build the app'}],{tools:'supported',reasoning:'unknown',vision:'unknown',contextSize:4096,source:'unavailable'}, {answer:()=>{},reasoning:()=>{}},new AbortController().signal,options);
    assert.equal(sent.tool_choice,'required');
    assert.equal(sent.tools[0].function.name,'inspect_project');
  } finally {global.fetch=original;}
});
