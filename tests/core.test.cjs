const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, executeTool } = require('../.test-dist/engine/tools.js');
const { SSEDecoder } = require('../.test-dist/engine/sse.js');
const { ReasoningSplitter } = require('../.test-dist/engine/reasoning.js');
const { detectCapabilities } = require('../.test-dist/engine/capabilities.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { composeSparkInstructions } = require('../.test-dist/domain/persona.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const { AgentEventEmitter } = require('../.test-dist/engine/activity.js');

test('arithmetic respects precedence, unary signs and parentheses', () => {
  assert.equal(calculate('2 + 3 * (4 - 1)'), 11);
  assert.equal(calculate('-.5 * 8'), -4);
  assert.equal(calculate('1/4'), .25);
  assert.throws(() => calculate('1/0'), /Division by zero/);
  assert.throws(() => calculate('process.exit(1)'), /Unsupported/);
  assert.throws(() => calculate('2**3'), /Expected/);
});
test('SSE decoder reconstructs chunked multiline events and CRLF data', () => {
  const sse = new SSEDecoder();
  assert.deepEqual(sse.push('data: {"x"'), []);
  assert.deepEqual(sse.push(':1}\r\n\r\ndata: first\n'), ['{"x":1}']);
  assert.deepEqual(sse.push('data: second\n\n'), ['first\nsecond']);
  assert.deepEqual(sse.push('data: [DONE]'), []);
  assert.deepEqual(sse.flush(), ['[DONE]']);
});
test('reasoning tags split across transport chunks never leak into the answer', () => {
  const parser = new ReasoningSplitter();
  const pieces = ['Hi <th', 'ink>re', 'ason</thi', 'nk> there'].flatMap((x) => parser.push(x)).concat(parser.finish());
  assert.equal(pieces.filter((x) => x.kind === 'answer').map((x) => x.text).join(''), 'Hi  there');
  assert.equal(pieces.filter((x) => x.kind === 'reasoning').map((x) => x.text).join(''), 'reason');
});
test('unknown model capabilities remain unknown, never invented', () => {
  const unknown = detectCapabilities({ model_metadata: {} });
  assert.equal(unknown.tools, 'unknown'); assert.equal(unknown.vision, 'unknown'); assert.equal(unknown.reasoning, 'unknown');
  const observed = detectCapabilities({ chat_template: '{{ tool_calls }}', default_generation_settings: { n_ctx: 8192 } });
  assert.equal(observed.tools, 'supported'); assert.equal(observed.contextSize, 8192);
});
test('memory scoping isolates Spark memory and preserves global memory', () => {
  const w = defaultWorkspace();
  const [sparkA, sparkB] = w.sparks;
  const memories = [
    { id: 'm1', text: 'Always save work locally', scope: 'global', sparkId: null, enabled: true, createdAt: '' },
    { id: 'm2', text: 'Private A fact', scope: 'spark', sparkId: sparkA.id, enabled: true, createdAt: '' },
    { id: 'm3', text: 'Disabled memory', scope: 'global', sparkId: null, enabled: false, createdAt: '' },
  ];
  const a = composeSparkInstructions(sparkA, 'work', memories);
  const b = composeSparkInstructions(sparkB, 'research', memories);
  assert.ok(a.includes('Private A fact'));
  assert.ok(b.includes('Always save work locally'));
  assert.ok(!b.includes('Private A fact'));
  assert.ok(!a.includes('Disabled memory'));
  assert.ok(b.includes('Distinguish facts'));
  assert.deepEqual(JSON.parse(JSON.stringify(validateWorkspace(w))).schemaVersion, 1);
  assert.throws(() => validateWorkspace({ schemaVersion: 999 }), /Unrecognized/);
});
test('tool registry cannot run arbitrary commands or read another Spark private memory', () => {
  const w = defaultWorkspace();
  const memories = [{ id: 'x', text: 'Secret! This is private.', scope: 'spark', sparkId: w.sparks[0].id, enabled: true, createdAt: '' }];
  assert.equal(executeTool('search_memories', { query: 'Secret' }, w.sparks[1], memories), '[]');
  assert.throws(() => executeTool('shell', {}, w.sparks[0], memories), /Unsupported tool/);
});
test('agent activity event IDs and sequences describe real transitions', () => {
  const events = []; const emitter = new AgentEventEmitter((x) => events.push(x));
  emitter.phase('thinking', 'started', 'Request sent');
  emitter.phase('thinking', 'completed', 'Generation completed');
  emitter.emit('tool_result', '42', { tool: 'calculate' });
  assert.deepEqual(events.map((event) => event.sequence), [1,2,3]);
  assert.equal(new Set(events.map((event) => event.runId)).size, 1);
});

test('integration: streaming model answer respects split reasoning and emits actual reasoning', async () => {
  const { streamLlamaTurn } = require('../.test-dist/engine/llama.js');
  const originalFetch = global.fetch;
  const encoder = new TextEncoder();
  const mk = (content) => `data: ${JSON.stringify({choices:[{ delta: {content} }]})}\n\n`;
  global.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      const chunks = [mk('Hello <th'), mk('ink>internal detail</thi'), mk('nk> friend'), 'data: [DONE]\n\n'];
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  try {
    const output = [];
    const reasoning = [];
    const r = await streamLlamaTurn({endpoint:'http://127.0.0.1:8080',modelId:'test',temperature:.5,maxTokens:80}, [{role:'user',content:'hi'}], {tools:'unknown'}, {answer:(s)=>output.push(s),reasoning:(s)=>reasoning.push(s)}, new AbortController().signal);
    assert.equal(r.answer, 'Hello  friend');
    assert.deepEqual(r.calls, []);
    assert.equal(reasoning.join(''), 'internal detail');
    assert.equal(output.join(''), 'Hello  friend');
  } finally { global.fetch = originalFetch; }
});

test('integration: local agent tool approval mediates calculation and reports ordered events', async () => {
  const { runAgent } = require('../.test-dist/engine/agent.js');
  const originalFetch = global.fetch;
  const encoder = new TextEncoder();
  let step = 0;
  const calls = [];
  const streamed = [];
  const toSSE = (x) => `data: ${JSON.stringify({choices:[{delta:x}]})}\n\n`;
  global.fetch = async (url, options) => {
    if (url.endsWith('/props')) return Response.json({ chat_template: 'supports tool_calls' });
    if (url.endsWith('/v1/models')) return Response.json({ data: [{id:'local'}] });
    if (url.endsWith('/v1/chat/completions')) {
      calls.push(JSON.parse(options.body));
      const body = ++step === 1 ? [
        toSSE({tool_calls:[{index:0,id:'call_1',type:'function',function:{name:'calculate',arguments:'{"expression":"2+3"}'}}]})
      ] : [toSSE({content:'The result is 5.'})];
      return new Response(new ReadableStream({start(c){body.forEach((b)=>c.enqueue(encoder.encode(b)));c.close();}}), {status:200});
    }
    throw new Error('Unexpected route: '+url);
  };
  try {
    const w = defaultWorkspace(); const events=[]; const approvals=[];
    const model={id:'model',modelId:'local',endpoint:'http://127.0.0.1:8080',temperature:.5,maxTokens:400};
    const answer = await runAgent({
      spark:w.sparks[0], model, session:{mode:'work',messages:[{role:'user',content:'2+3'}]},
      memories:[],preferences:w.preferences,events:new AgentEventEmitter((e)=>events.push(e)),
      signal:new AbortController().signal,
      onAnswer:(s)=>streamed.push(s), onApproval:async (name)=>{approvals.push(name);return 'allow';}
    });
    assert.equal(answer, 'The result is 5.');
    assert.equal(streamed.join(''), answer);
    assert.deepEqual(approvals, ['calculate']);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].messages.at(-1).content, '5');
    assert.ok(events.some((x)=>x.kind === 'tool_result' && x.text === '5'));
  } finally { global.fetch = originalFetch; }
});

test('SSRF guard rejects non-loopback model endpoints', async () => {
  const { inspectModel } = require('../.test-dist/engine/llama.js');
  await assert.rejects(inspectModel({ endpoint: 'http://example.com', modelId:'foo' }), /Only local HTTP/);
  await assert.rejects(inspectModel({ endpoint: 'https://127.0.0.1:8080', modelId:'foo' }), /Only local HTTP/);
});

test('workspace import sanitizes invalid theme, model endpoints, and malformed chats', () => {
  const { validateSpark } = require('../.test-dist/domain/validation.js');
  const w = defaultWorkspace();
  w.preferences.theme = 'unknown';
  w.models.push({ id:'unsafe', modelId:'x', name:'danger', endpoint:'http://example.com',contextSize:4096,temperature:.7,maxTokens:1000 });
  w.sessions.push({id:'junk',sparkId:w.sparks[0].id,title:'test',mode:'work',messages:[null, {role:'assistant',content:'Valid answer',id:'x'}]});
  w.sparks[0].traits.curiosity = 500;
  w.sparks[0].avatar.image = 'javascript:alert(1)';
  const recovered = validateWorkspace(w);
  assert.equal(recovered.preferences.theme, 'obsidian');
  assert.equal(recovered.models.length, 0);
  assert.equal(recovered.sessions[0].messages.length, 1);
  assert.equal(recovered.sparks[0].traits.curiosity, 100);
  assert.equal(recovered.sparks[0].avatar.image, undefined);
  assert.throws(() => validateSpark({name:123}), /valid name/);
});
