const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = file => fs.readFileSync(path.join(root,file), 'utf8');
const { prepareGeneration } = require('../.test-dist/engine/context-window.js');
const { allowedToolDefinitions, selectActionTools } = require('../.test-dist/engine/tools.js');
const { streamContinuousAnswer } = require('../.test-dist/engine/continuous-generation.js');
const controller = new AbortController();
const model = {backend:'llama.cpp',modelId:'demo',endpoint:'http://127.0.0.1:8080',contextSize:4096,temperature:.6};
const caps = {reasoning:'supported',tools:'supported',vision:'unknown',contextSize:4096,source:'server-properties'};

test('canonical inference contract is discoverable by future code agents',()=>{
  assert.match(source('AGENTS.md'),/docs\/info\/INFERENCE_ARCHITECTURE\.md/);
  const docs=source('docs/info/INFERENCE_ARCHITECTURE.md');
  assert.match(docs,/max_tokens: -1/);
  assert.match(docs,/Tool context/);
  assert.match(docs,/Input context vs output streaming/);
});

test('empty linked project offers a real file writer before checks, not nine expensive schemas',()=>{
  const allowed=allowedToolDefinitions(false,true);
  const tools=selectActionTools(allowed,{projectHasFiles:false});
  assert.equal(tools[0].function.name,'apply_project_changes');
  assert.ok(tools.length<=4);
  assert.ok(tools.some(t=>t.function.name==='run_project_check'));
  assert.ok(!tools.some(t=>t.function.name==='search_web'));
  assert.ok(!tools.some(t=>t.function.name==='inspect_project')); // already inspected by runAgent
  assert.ok(tools.every(t=>allowed.some(a=>a.function.name===t.function.name)));
});

test('after a source write, tools for actual checking and correction become available',()=>{
  const allowed=allowedToolDefinitions(false,true);
  const tools=selectActionTools(allowed,{projectHasFiles:false,lastTool:'apply_project_changes'});
  assert.equal(tools[0].function.name,'run_project_check');
  assert.ok(tools.some(t=>t.function.name==='read_project_file'));
  assert.ok(tools.some(t=>t.function.name==='apply_project_changes'));
});

test('input fitting pages extra required tool schemas instead of blocking all actions',async()=>{
  const allowed=allowedToolDefinitions(false,true);
  const toolSet=selectActionTools(allowed,{projectHasFiles:false});
  const messages=[{role:'system',content:'Dona persona and identity ' .repeat(18)},
    {role:'system',content:'Project Video Editor, create a Tauri skeleton.'},
    {role:'user',content:'Build the Tauri 2 + React + MUI skeleton in the linked folder.'}];
  const mockAdapter={countTokens:async(_m,msg)=>msg.reduce((sum,item)=>sum+(typeof item.content==='string'?item.content.length:100),0),kind:'llama.cpp'};
  const prepared=await prepareGeneration(mockAdapter,model,caps,messages,controller.signal,{tools:toolSet,requireTools:true,toolChoice:'required'});
  assert.ok(prepared.tools.length>0);
  assert.equal(prepared.tools[0].function.name,'apply_project_changes');
  assert.ok(prepared.promptTokens+96<4096);
  assert.deepEqual(prepared.messages,messages);
});

test('oversized tool list is paged for a required action, never rejected merely for unused schemas', async()=>{
  const available=allowedToolDefinitions(true,true);
  const preferred=selectActionTools(available,{projectHasFiles:false});
  // Fake optional tool schemas that earlier updates would have forced into a
  // single prompt; they must not crowd out the real apply_project_changes tool.
  const bulky=[preferred[0], ...Array.from({length:7},(_,i)=>({
    type:'function',function:{name:'unneeded_'+i,description:'Verbose schema '.repeat(280),
      parameters:{type:'object',properties:{}}},
  }))];
  const messages=[{role:'system',content:'You are Dona. Follow user directions.'},
    {role:'user',content:'Build my Video Editor application skeleton in the linked folder.'}];
  const adapter={kind:'llama.cpp', countTokens:async(_m,ms)=>ms.reduce((sum,m)=>sum+String(m.content).length,0)};
  const planned=await prepareGeneration(adapter,model,caps,messages,controller.signal,
    {tools:bulky,requireTools:true,toolChoice:'required'});
  assert.ok(planned.tools.length>=1 && planned.tools.length<bulky.length);
  assert.equal(planned.tools[0].function.name,'apply_project_changes');
  assert.deepEqual(planned.messages,messages);
});

test('streamed reasoning and answer share one actual request and one loaded model',async()=>{
  const calls=[];let reason='',answer='';
  const adapter={kind:'llama.cpp',countTokens:async()=>200,
    generate:async(_m,_messages,_c,callbacks,_signal,opts)=>{
      calls.push(opts.outputTokens);
      callbacks.reasoning('Reason '.repeat(3000));
      callbacks.answer('Here are the files to create.');
      return {calls:[],finishReason:'stop',answer:'Here are the files to create.'};
    }};
  const result=await streamContinuousAnswer({adapter,model,capabilities:caps,messages:[{role:'user',content:'Build it'}],signal:controller.signal,onReasoning:t=>reason+=t,onAnswer:t=>answer+=t});
  assert.deepEqual(calls,[-1]);
  assert.ok(reason.length>2048);
  assert.equal(result.answer,answer);
});

test('real agent wiring can reach a file-writing tool at 4096 context without fake continuation',async()=>{
  const { runAgent }=require('../.test-dist/engine/agent.js');
  const { AgentEventEmitter }=require('../.test-dist/engine/activity.js');
  const { defaultWorkspace }=require('../.test-dist/domain/defaults.js');
  const original=global.fetch;
  const w=defaultWorkspace();
  const session={id:'integration',projectId:'video',sparkId:w.sparks[0].id,modelId:'demo',mode:'work',
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),title:'Video Editor',
    messages:[{id:'m1',role:'user',content:'Build the Tauri 2, React and MUI Video Editor skeleton in this project folder.',createdAt:new Date().toISOString()}]};
  const project={id:'video',name:'Video Editor',description:'Open-source Tauri 2, Rust, React, MUI video editor',
    folder:'E:\\DemoProjects\\VideoEditor',instructions:'Use clean compact UI'};
  w.preferences.toolPermissions.inspect_project='deny'; // Avoid invoking a native filesystem from Node test.
  let body;
  global.fetch=async(url,opts={})=>{
    const str=String(url);
    if(str.endsWith('/v1/models'))return Response.json({data:[{id:'demo'}]});
    if(str.endsWith('/props'))return Response.json({supports_tools:true,default_generation_settings:{n_ctx:4096}});
    if(str.endsWith('/apply-template'))return Response.json({prompt:JSON.stringify(JSON.parse(opts.body).messages)});
    if(str.endsWith('/tokenize'))return Response.json({tokens:Array(Math.min(3800,Math.ceil(JSON.parse(opts.body).content.length/4))).fill(1)});
    if(str.endsWith('/v1/chat/completions')){
      body=JSON.parse(opts.body);
      const chunk='data: {"choices":[{"delta":{"content":"No changes applied yet."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
      return new Response(new TextEncoder().encode(chunk),{headers:{'Content-Type':'text/event-stream'}});
    }
    throw new Error('Unexpected mocked URL: '+str);
  };
  try{
    await runAgent({spark:w.sparks[0],model:{id:'demo',modelId:'demo',backend:'llama.cpp',endpoint:'http://127.0.0.1:8080',contextSize:4096,temperature:0.6,toolCalling:true},
      session,projects:[project],memories:[],preferences:w.preferences,events:new AgentEventEmitter(()=>{}),
      signal:new AbortController().signal,onAnswer(){},onApproval:async()=> 'deny'});
    assert.ok(body,'inference HTTP request was reached');
    assert.equal(body.max_tokens,-1);
    assert.equal(body.tool_choice,'required');
    assert.ok(body.tools.some(t=>t.function.name==='apply_project_changes'));
    assert.ok(body.tools.length<9);
  }finally{global.fetch=original;}
});
