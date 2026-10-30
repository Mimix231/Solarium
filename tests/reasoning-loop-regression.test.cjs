const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { streamContinuousAnswer } = require('../.test-dist/engine/continuous-generation.js');
const { streamLlamaTurn } = require('../.test-dist/engine/llama.js');
const { runAgent } = require('../.test-dist/engine/agent.js');
const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');

const model = { backend: 'llama.cpp', endpoint: 'http://127.0.0.1:8080', modelId: 'demo', temperature: 0.5, contextSize: 8192, maxTokens: 2048 };
const capabilities = { contextSize: 8192, tools: 'unknown', vision: 'unknown', reasoning: 'observed', source: 'unavailable' };
const messages = [{ role: 'system', content: 'Act as Dona.' }, { role: 'user', content: 'How would I build a video editor?' }];
function response(events) {
  const bytes = new TextEncoder().encode(events.map(data => `data: ${JSON.stringify(data)}\n\n`).join('') + 'data: [DONE]\n\n');
  return new Response(new ReadableStream({start(c) { for(let i=0;i<bytes.length;i+=513)c.enqueue(bytes.slice(i,i+513)); c.close(); }}), {status:200});
}

test('regression: a long multi-thousand-token thought transitions to a final answer in ONE request', async () => {
  const old = global.fetch;
  let requests = 0;
  const thought = 'I should assess the architecture carefully. '.repeat(900);
  const parts = [...thought.matchAll(/.{1,120}/gs)].map(([value]) => ({ choices: [{ delta: { reasoning_content: value } }] }));
  parts.push({ choices: [{ delta: { content: 'Use Tauri 2, React, Rust and FFmpeg for a video editor.' } }] });
  parts.push({ choices: [{ delta: {}, finish_reason: 'stop' }] });
  global.fetch = async (_url, init) => {
    requests++;
    const data = JSON.parse(init.body);
    assert.equal(data.max_tokens, -1);
    assert.deepEqual(data.messages.map(m=>m.role), ['system', 'user']);
    assert.doesNotMatch(JSON.stringify(data), /UNFINISHED REASONING TAIL|Continue working from the unfinished reasoning/);
    return response(parts);
  };
  let reasoning = '', visible = '';
  try {
    const result = await streamContinuousAnswer({ adapter: { kind: 'llama.cpp', countTokens: async()=>130, generate: (...args)=>streamLlamaTurn(...args) }, model, capabilities, messages,
      signal: new AbortController().signal, onAnswer: t=>visible+=t, onReasoning:t=>reasoning+=t });
    assert.equal(requests, 1);
    assert.equal(reasoning, thought);
    assert.equal(result.answer, visible);
    assert.match(visible, /Use Tauri 2/);
    assert.equal(result.warning, undefined);
  } finally { global.fetch = old; }
});

test('reasoning-only capacity end is reported honestly, never sent back as a new user prompt', async () => {
  let requests = 0, reasoning = '';
  const result = await streamContinuousAnswer({adapter: {kind:'vllm',countTokens:async()=>155,generate:async(_m,requestMessages,_caps,cb)=>{
    requests++;
    assert.equal(requestMessages.length,2);
    cb.reasoning('I am reviewing the source.');
    return {answer:'',reasoning:'I am reviewing the source.',finishReason:'length',calls:[]};
  }},model:{...model,backend:'vllm'},capabilities,messages,signal:new AbortController().signal,onAnswer(){},onReasoning:t=>reasoning+=t});
  assert.equal(requests, 1);
  assert.equal(reasoning, 'I am reviewing the source.');
  assert.equal(result.answer, '');
  assert.match(result.warning, /reached its context\/output capacity during reasoning/);
});

test('agent preserves a reasoning-only outcome without falsely claiming an answer', async () => {
  const w = defaultWorkspace();
  const old = global.fetch;
  let generations = 0;
  global.fetch = async(url, init) => {
    if (String(url).endsWith('/v1/models')) return Response.json({data:[{id:'demo'}]});
    if (String(url).endsWith('/props')) return Response.json({default_generation_settings:{n_ctx:8192}});
    if (String(url).endsWith('/apply-template') || String(url).endsWith('/tokenize')) return Response.json({}, {status:404});
    generations++;
    assert.equal(JSON.parse(init.body).max_tokens, -1);
    return response([
      {choices:[{delta:{reasoning_content:'Reasoning only.'}}]},
      {choices:[{delta:{},finish_reason:'stop'}]},
    ]);
  };
  let warning = '', snapshot;
  try {
    const answer = await runAgent({spark:w.sparks[0],model,session:{mode:'conversation',messages:[{role:'user',content:'Hi!'}]},memories:[],preferences:w.preferences,
      events:new AgentEventEmitter(()=>{}),signal:new AbortController().signal,webEnabled:false,onAnswer(){},onApproval:async()=> 'deny',
      onWarning:s=>warning=s,onThinking:s=>snapshot=s});
    assert.equal(answer,'');
    assert.equal(generations,1);
    assert.equal(snapshot.text,'Reasoning only.');
    assert.match(warning,/reasoning|final answer/i);
  } finally {global.fetch = old;}
});

test('both Solarium-managed llama.cpp server launch paths enable bounded context shifting', () => {
  const rust = fs.readFileSync(path.resolve(__dirname, '../src-tauri/src/lib.rs'),'utf8');
  const flags = rust.match(/"--context-shift"/g) ?? [];
  assert.equal(flags.length, 2);
});

test('reasoning-only chat record and its diagnostic survive workspace serialization', () => {
  const { validateWorkspace } = require('../.test-dist/domain/validation.js');
  const workspace = defaultWorkspace();
  workspace.sessions=[{id:'reasoning-only',title:'Test',sparkId:workspace.sparks[0].id,modelId:null,mode:'conversation',createdAt:'2026-10-10',updatedAt:'2026-10-10',messages:[{id:'assistant',role:'assistant',content:'',reasoning:'Inspected the architecture.',reasoningMs:4000,generationWarning:'Model finished reasoning without a final answer.',createdAt:'2026-10-10'}]}];
  const restored = validateWorkspace(JSON.parse(JSON.stringify(workspace))).sessions[0].messages[0];
  assert.equal(restored.content,'');
  assert.equal(restored.reasoning,'Inspected the architecture.');
  assert.match(restored.generationWarning,/without a final answer/);
});
