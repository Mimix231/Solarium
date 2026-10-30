const test = require('node:test');
const assert = require('node:assert/strict');
const { streamContinuousAnswer, OUTPUT_SEGMENT_TOKENS } = require('../.test-dist/engine/continuous-generation.js');
const { streamLlamaTurn } = require('../.test-dist/engine/llama.js');
const { formatThinkingDuration } = require('../.test-dist/engine/duration.js');
const { buildSearchIntent, rankResearchResults } = require('../.test-dist/engine/search-intent.js');
const { allowedToolDefinitions } = require('../.test-dist/engine/tools.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');

const model = { backend: 'llama.cpp', endpoint: 'http://127.0.0.1:8080', modelId: 'demo', name:'Demo', temperature: 0.5, maxTokens: 32, contextSize: 8192 };
const capabilities = { tools: 'unknown', vision: 'unknown', reasoning: 'unknown', contextSize: 8192, source: 'unavailable' };
const messages = [{role:'system',content:'You are a helpful local Spark.'},{role:'user',content:'Write a complete tutorial.'}];

function streamPayload(events) {
  const lines = [...events.map((e)=> `data: ${JSON.stringify(e)}\n\n`),'data: [DONE]\n\n'];
  return new Response(new ReadableStream({start(c){
    const text = lines.join(''); const encoded = new TextEncoder().encode(text);
    // Split raw UTF8 bytes and SSE events across multiple chunks.
    for (let i=0; i<encoded.length; i+=17) c.enqueue(encoded.slice(i,i+17));
    c.close();
  }}),{status:200,headers:{'content-type':'text/event-stream'}});
}

test('llama.cpp retains one inference stream through reasoning and answer', async () => {
  const previous=global.fetch;let count=0;const bodies=[];
  global.fetch=async(_url,init)=>{
    count++; bodies.push(JSON.parse(init.body));
    return streamPayload([
      {choices:[{delta:{reasoning_content:'Check the architecture. '}}]},
      {choices:[{delta:{reasoning_content:'Consider memory usage.'}}]},
      {choices:[{delta:{content:'Section one. '}}]},
      {choices:[{delta:{content:'Section two. Done.'}}]},
      {choices:[{delta:{},finish_reason:'stop'}]},
    ]);
  };
  let out='';let thought='';const states=[];
  try {
    const result=await streamContinuousAnswer({adapter:{kind:'llama.cpp',generate:(...args)=>streamLlamaTurn(...args)},model,capabilities,messages,
      signal:new AbortController().signal,onAnswer:t=>out+=t,onReasoning:t=>thought+=t,onReasoningState:v=>states.push(v)});
    assert.equal(result.answer,'Section one. Section two. Done.');
    assert.equal(out,result.answer);
    assert.equal(thought,'Check the architecture. Consider memory usage.');
    assert.deepEqual(states,[true,false]);
    assert.equal(count,1);
    assert.equal(bodies[0].max_tokens,-1);
    assert.deepEqual(bodies[0].messages.map(m=>m.role),['system','user']);
    assert.equal(result.segments,1);
  } finally {global.fetch=previous;}
});

test('natural stop never starts another request', async () => {
  let count=0;
  const adapter={kind:'llama.cpp',generate:async(_model,_messages,_caps,cb)=>{count++; cb.answer('Finished.');return {answer:'Finished.',finishReason:'stop',calls:[]};}};
  const result=await streamContinuousAnswer({adapter,model,capabilities,messages,signal:new AbortController().signal,onAnswer(){},onReasoning(){}});
  assert.equal(result.segments,1); assert.equal(count,1);
});

test('user cancellation stops the single active request without starting another', async () => {
  const controller=new AbortController();let count=0;
  const adapter={kind:'llama.cpp',generate:async(_m,_messages,_caps,cb,_signal)=>{
    count++;cb.answer('Partial');controller.abort();
    throw new DOMException('Stopped','AbortError');
  }};
  await assert.rejects(streamContinuousAnswer({adapter,model,capabilities,messages,signal:controller.signal,onAnswer(){},onReasoning(){}}),/Stop|Abort/);
  assert.equal(count,1);
});

test('native reasoning and split <think> markers remain separate from displayed answer', async () => {
  const previous=global.fetch;
  global.fetch=async()=>streamPayload([
    {choices:[{delta:{content:'<thi'}}]},
    {choices:[{delta:{content:'nk>Check inputs</thi'}}]},
    {choices:[{delta:{content:'nk>Here is an answer.'}}]},
    {choices:[{delta:{},finish_reason:'stop'}]},
  ]);
  let thought='';let answer='';
  try {
    const result=await streamLlamaTurn(model,messages,capabilities,{reasoning:t=>thought+=t,answer:t=>answer+=t},new AbortController().signal);
    assert.equal(thought,'Check inputs'); assert.equal(answer,'Here is an answer.'); assert.equal(result.finishReason,'stop');
  } finally {global.fetch=previous;}
});

test('searches for an app creator target software instead of cinemas',()=>{
  const intent=buildSearchIntent('Echidna, I want to create a video editing program using Tauri, Rust, React and FFmpeg');
  assert.equal(intent.topic,'software');
  assert.match(intent.query,/video editing software architecture/);
  assert.match(intent.query,/FFmpeg/);
  const results=[
    {title:'Film theater tickets and screenings',url:'https://cinema.example.com/tickets',excerpt:'movie theater showtimes'},
    {title:'FFmpeg developer documentation',url:'https://docs.example.com/ffmpeg',excerpt:'Software API for video processing'},
  ];
  const ranked=rankResearchResults(results,intent);
  assert.equal(ranked.length,1);
  assert.match(ranked[0].title,/FFmpeg/);
});

test('web toggle excludes search and open tools even if other tools are available',()=>{
  assert.ok(!allowedToolDefinitions(false).some(t=>t.function.name==='search_web'||t.function.name==='open_web_page'));
  assert.ok(allowedToolDefinitions(true).some(t=>t.function.name==='search_web'));
  assert.ok(allowedToolDefinitions(false).some(t=>t.function.name==='calculate'));
});

test('stored reasoning survives validation and cannot be confused with answer content',()=>{
  const w=defaultWorkspace();const s=w.sparks[0];
  w.sessions=[{id:'chat',title:'Test',sparkId:s.id,modelId:null,mode:'work',createdAt:'now',updatedAt:'now',messages:[{id:'x',role:'assistant',createdAt:'now',content:'Answer here',reasoning:'Native thought here',reasoningMs:2300}]}];
  const restored=validateWorkspace(w).sessions[0].messages[0];
  assert.equal(restored.content,'Answer here'); assert.equal(restored.reasoning,'Native thought here'); assert.equal(restored.reasoningMs,2300);
});


test('thinking duration uses compact seconds, minutes and hours', () => {
  assert.equal(formatThinkingDuration(9000),'9s');
  assert.equal(formatThinkingDuration(74000),'1m 14s');
  assert.equal(formatThinkingDuration(3802000),'1h 3m 22s');
});

test('tool-permission gate blocks model-requested website tools when Web is off', async () => {
  const { runAgent } = require('../.test-dist/engine/agent.js');
  const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');
  const old=global.fetch; let turn=0; const bodies=[];
  global.fetch=async(url, init)=>{
    if (String(url).endsWith('/v1/models')) return Response.json({data:[{id:'demo'}]});
    if (String(url).endsWith('/props')) return Response.json({supports_tools:true});
    if (String(url).endsWith('/apply-template') || String(url).endsWith('/tokenize')) return Response.json({error:'Unsupported endpoint'}, {status:404});
    const body=JSON.parse(init.body); bodies.push(body); turn++;
    if (turn===1) return streamPayload([{choices:[{delta:{tool_calls:[{index:0,id:'tool1',type:'function',function:{name:'search_web',arguments:'{"query":"movie theaters"}'}}]}}]},{choices:[{delta:{},finish_reason:'tool_calls'}]}]);
    return streamPayload([{choices:[{delta:{content:'The search was not permitted.'}}]},{choices:[{delta:{},finish_reason:'stop'}]}]);
  };
  const w=defaultWorkspace();w.preferences.toolPermissions.search_web='allow';
  let approvals=0;
  try {
    const answer=await runAgent({spark:w.sparks[0],model,session:{mode:'conversation',messages:[{role:'user',content:'Find the latest documentation'}]},memories:[],preferences:w.preferences,events:new AgentEventEmitter(()=>{}),signal:new AbortController().signal,webEnabled:false,onAnswer(){},onApproval:async()=>{approvals++;return 'allow';}});
    assert.match(answer,/not permitted/);assert.equal(approvals,0);
    assert.ok(!bodies[0].tools?.some(t=>t.function.name==='search_web'));
    assert.match(JSON.stringify(bodies[1].messages),/User denied permission/);
  } finally {global.fetch=old;}
});

test('an engine ending at capacity returns partial output without manufacturing new requests', async () => {
  let calls=0;
  const adapter={kind:'llama.cpp',generate:async(_m,_messages,_caps,cb)=>{
    calls++;cb.answer('This is a partial response.');
    return {answer:'This is a partial response.',finishReason:'length',calls:[]};
  }};
  const result=await streamContinuousAnswer({adapter,model,capabilities,messages,signal:new AbortController().signal,onAnswer(){},onReasoning(){}});
  assert.equal(result.answer,'This is a partial response.');
  assert.match(result.warning,/context\/output capacity/);
  assert.equal(calls,1);
});

test('vLLM uses one context-sized stream rather than restarting the reasoning chat',async()=>{
  const old=global.fetch;let count=0;const bodies=[];
  global.fetch=async(_url,init)=>{
    bodies.push(JSON.parse(init.body));count++;
    return streamPayload([
      {choices:[{delta:{reasoning_content:'Checked resources. '}}]},
      {choices:[{delta:{content:'First. Second.'}}]},
      {choices:[{delta:{},finish_reason:'stop'}]},
    ]);
  };
  try {
    const result=await streamContinuousAnswer({adapter:{kind:'vllm',generate:(...args)=>streamLlamaTurn(...args)},model:{...model,backend:'vllm'},capabilities,messages,signal:new AbortController().signal,onAnswer(){},onReasoning(){}});
    assert.equal(result.segments,1);
    assert.equal(count,1);
    assert.ok(bodies[0].max_tokens>2048);
    assert.equal(result.answer,'First. Second.');
    assert.deepEqual(bodies[0].messages.map(m=>m.role),['system','user']);
  } finally {global.fetch=old;}
});

test('long completed answers and their native reasoning survive workspace reload beyond the old 80k truncation',()=>{
  const w=defaultWorkspace();
  const body='Information. '.repeat(7200);
  w.sessions=[{id:'long',title:'Long output',sparkId:w.sparks[0].id,modelId:null,mode:'work',createdAt:'now',updatedAt:'now',messages:[{id:'response',role:'assistant',content:body,reasoning:'reasoning '.repeat(9000),createdAt:'now'}]}];
  const reloaded=validateWorkspace(JSON.parse(JSON.stringify(w))).sessions[0].messages[0];
  assert.equal(reloaded.content,body);
  assert.equal(reloaded.reasoning.length,90000);
});

test('native single-stream chunks never duplicate output or restart prompts',async()=>{
  const parts=['Intro ','repeat-this-tail '.repeat(40),'Brand new ending.'];
  let i=0,output='';
  const adapter={kind:'llama.cpp',generate:async(_m,_history,_caps,cb)=>{
    i++;
    for (const part of parts) for (let j=0;j<part.length;j+=13) cb.answer(part.slice(j,j+13));
    return {answer:parts.join(''),finishReason:'stop',calls:[]};
  }};
  const result=await streamContinuousAnswer({adapter,model,capabilities,messages,signal:new AbortController().signal,onAnswer:t=>output+=t,onReasoning(){}});
  assert.equal(i,1);
  assert.equal(result.answer,parts.join(''));
  assert.equal(output,result.answer);
});

