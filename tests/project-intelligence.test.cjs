const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { buildProjectAwareness, formatProjectInspection } = require('../.test-dist/engine/project-context.js');
const { isImplementationRequest, shouldAutoResearch } = require('../.test-dist/engine/task-intent.js');
const { buildContextualSearchIntent } = require('../.test-dist/engine/search-intent.js');
const { prepareGeneration } = require('../.test-dist/engine/context-window.js');
const { runAgent } = require('../.test-dist/engine/agent.js');
const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');

const project = { id: 'editor-01', name: 'Video Editor', description: 'Open source video editor using Tauri 2, React, MUI, Rust and FFmpeg', instructions: 'Keep a liquid glass aesthetic', folder: 'E:\\Projects\\VideoEditor', sparkId: null, modelId: null };
const session = { id: 'test-chat', projectId: 'editor-01', mode: 'conversation', messages: [
  { id: 'u1', role: 'user', content: 'I want to build a professional video editor using Tauri 2, Rust, React, Material UI, FFmpeg, and liquid glass.' },
  { id: 'a1', role: 'assistant', content: 'Here is my roadmap:\nPhase 1: The Skeleton. Scaffold Tauri 2 and MUI.\nPhase 2: Media library and metadata.\nPhase 3: Timeline.' },
  { id: 'u2', role: 'user', content: "Let's start with Phase 1, the skeleton. Can you set this up for me in the project folder?" },
] };

test('Dona receives linked-folder state, project requirements and specific earlier Phase 1 plan', () => {
  const result = buildProjectAwareness(project, session);
  assert.equal(result.folderAttached, true);
  assert.equal(result.folder, project.folder);
  assert.match(result.briefing, /Video Editor/);
  assert.match(result.briefing, /Tauri 2/);
  assert.match(result.briefing, /FFmpeg/);
  assert.match(result.briefing, /Phase 1: The Skeleton/);
  assert.match(result.briefing, /NOT executed work/);
});

test('missing source folders are stated explicitly, not represented as available', () => {
  const without = buildProjectAwareness({ ...project, folder: '' }, session);
  assert.equal(without.folderAttached, false);
  assert.equal(without.folder, null);
  assert.match(without.briefing, /No project folder is attached/);
  const global = buildProjectAwareness(undefined, session);
  assert.match(global.briefing, /No project is attached/);
});

test('inspection snapshot represents actual results and rejects malformed tool output', () => {
  const snapshot = formatProjectInspection(JSON.stringify({ count: 3, files: ['package.json','src/App.tsx','src-tauri/Cargo.toml'], inspected: [{path:'package.json',content:'{"name":"video-editor"}'}] }));
  assert.match(snapshot, /Directory listing succeeded/);
  assert.match(snapshot, /src\/App.tsx/);
  assert.match(snapshot, /video-editor/);
  assert.doesNotMatch(snapshot, /file was modified successfully/);
  assert.throws(() => formatProjectInspection('{}'), /incomplete/);
});

test('task intent distinguishes implementing from explaining and web lookup permissions', () => {
  assert.equal(isImplementationRequest("Let's start with Phase 1, the skeleton. Can you set this up for me in the project folder?"), true);
  assert.equal(isImplementationRequest('How would I build an app?'), false);
  assert.equal(isImplementationRequest('Explain how to fix this'), false);
  assert.equal(isImplementationRequest('Create a fantasy story about two dragons'), false);
  assert.equal(isImplementationRequest('Write Chapter 1 of my fantasy novel'), false);
  assert.equal(isImplementationRequest('Can you help me build this program?'), true);
  assert.equal(isImplementationRequest('Fix this please', true), true);
  assert.equal(isImplementationRequest('Fix this please', false), false);
  assert.equal(shouldAutoResearch("Let's start with Phase 1, the skeleton."), false);
  assert.equal(shouldAutoResearch('Can you search online for current Tauri 2 docs?'), true);
  assert.equal(shouldAutoResearch('Search online and implement this in the project folder.'), false);
});

test('vague research request uses original project technology instead of dictionary results', () => {
  const result = buildContextualSearchIntent('Look up the latest references for Phase 1', project.description);
  assert.equal(result.topic, 'software');
  assert.match(result.query, /video editing|tauri/i);
  assert.doesNotMatch(result.query, /^let\b/i);
});

test('token fitting retains the project brief and follow-up while using a smaller output allowance', async () => {
  const messages = [
    { role:'system',content:'SPARK PERSONA '.repeat(30)},
    { role:'system',content:buildProjectAwareness(project,session).briefing },
    { role:'user',content:session.messages[0].content.repeat(10)},
    { role:'assistant',content:'older reply '.repeat(160)},
    { role:'user',content:session.messages[2].content },
  ];
  const caps = { contextSize: 4096, tools:'unknown',vision:'unknown',reasoning:'unknown',source:'unavailable' };
  const model = { contextSize: 4096 };
  const adapter = { countTokens:async(_m,list) => list.reduce((total,item)=>total+item.content.length, 0) };
  const result = await prepareGeneration(adapter,model,caps,messages,new AbortController().signal);
  assert.ok(result.outputTokens >= 64);
  assert.ok(result.messages.some(m => String(m.content).includes('Open source video editor')));
  assert.equal(result.messages.at(-1).content, session.messages[2].content);
});

test('project implementation without a folder returns an actionable answer, not a fabricated file change', async () => {
  const original = global.fetch;
  global.fetch = async (url) => String(url).endsWith('/v1/models') ? Response.json({data:[{id:'demo'}]}) : Response.json({supports_tools:true});
  const w = defaultWorkspace(); let output='', prompts=[];
  try {
    const answer = await runAgent({ spark:w.sparks[0], model: {id:'x',modelId:'demo',backend:'llama.cpp',contextSize:4096,endpoint:'http://127.0.0.1:8080'}, session, projects:[{...project,folder:''}],memories:[],preferences:w.preferences,events:new AgentEventEmitter(e=>prompts.push(e)), signal:new AbortController().signal,onAnswer: delta=>output+=delta,onApproval: async()=> 'allow' });
    assert.match(answer,/no source folder attached/i);
    assert.equal(output, answer);
    assert.ok(!prompts.some(e=>e.tool==='inspect_project' && e.status==='completed'));
  } finally { global.fetch = original; }
});

test('Thinking renders safe Markdown and auto-research is not triggered by project edits', () => {
  const root=path.join(__dirname,'..');
  assert.match(fs.readFileSync(path.join(root,'src/components/ThinkingPanel.tsx'),'utf8'), /<MarkdownBody text=/);
  assert.match(fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8'), /researchStage \? webNow/);
  assert.match(fs.readFileSync(path.join(root,'src/views/Projects.tsx'),'utf8'), /No source folder attached/);
});

test('actual Phase 1 prompt retains project goal, linked folder and edit tools without faking inspection', async () => {
  const originalFetch=global.fetch;
  const w=defaultWorkspace(); w.preferences.toolPermissions.inspect_project='deny';
  const recorded=[];const events=[];
  global.fetch=async(url, opts)=>{
    const str=String(url);
    if(str.endsWith('/v1/models'))return Response.json({data:[{id:'demo'}]});
    if(str.endsWith('/props'))return Response.json({supports_tools:true,default_generation_settings:{n_ctx:8192}});
    if(str.endsWith('/apply-template') || str.endsWith('/tokenize'))return Response.json({error:'not present'},{status:404});
    if(str.endsWith('/v1/chat/completions')){
      recorded.push(JSON.parse(opts.body));
      const enc=new TextEncoder();
      return new Response(new ReadableStream({start(c){
        c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Project recognized; tools available."}}]}\n\n'));
        c.enqueue(enc.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'));
        c.enqueue(enc.encode('data: [DONE]\n\n'));c.close();
      }}));
    }
    throw new Error(`Unexpected API: ${str}`);
  };
  try {
    const answer=await runAgent({spark:w.sparks[0], model:{id:'model',modelId:'demo',backend:'llama.cpp',endpoint:'http://127.0.0.1:8080',contextSize:8192,temperature:.7,toolCalling:true}, session, projects:[project], memories:[],preferences:w.preferences,events:new AgentEventEmitter(e=>events.push(e)),signal:new AbortController().signal,onAnswer(){},onApproval:async()=> 'deny'});
    assert.equal(answer,'Project recognized; tools available.');
    assert.equal(recorded.length,1);
    const prompt=JSON.stringify(recorded[0].messages);
    assert.match(prompt,/Tauri 2/);
    assert.match(prompt,/Phase 1: The Skeleton/);
    assert.match(prompt,/E:\\\\Projects\\\\VideoEditor/);
    assert.ok(recorded[0].tools.some(t=>t.function.name==='apply_project_changes'));
    assert.ok(!recorded[0].tools.some(t=>t.function.name==='search_web'));
    assert.ok(events.some(e=>e.tool==='inspect_project' && e.status==='denied'));
    assert.ok(!events.some(e=>e.tool==='inspect_project' && e.status==='completed'));
  }finally{global.fetch=originalFetch;}
});
