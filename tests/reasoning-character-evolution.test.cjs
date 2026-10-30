const test = require('node:test');
const assert = require('node:assert/strict');
const { streamContinuousAnswer } = require('../.test-dist/engine/continuous-generation.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateSpark } = require('../.test-dist/domain/validation.js');
const { avatarLayerOrder, resolveLayer, migrateAvatarAppearance } = require('../.test-dist/avatar/layer-system.js');

const model = { backend: 'llama.cpp', modelId: 'demo', endpoint: 'http://127.0.0.1:8080', temperature: .6, contextSize: 32768, maxTokens: 2048 };
const capabilities = { tools: 'unknown', vision: 'unknown', reasoning: 'observed', source: 'unavailable', contextSize: 32768 };
const messages = [{ role: 'system', content: 'You are the curious research Spark.' }, { role: 'user', content: 'Help me build a video editor.' }];

test('extended native reasoning transitions to answering without restarting or resetting thought', async () => {
  let calls=0,thinking='',answer='';const states=[];
  const results=await streamContinuousAnswer({adapter:{kind:'llama.cpp',countTokens:async()=>220,generate:async(_m,history,_caps,cb,_signal,options)=>{
    calls++;assert.equal(options.outputTokens,-1);
    assert.equal(history.length,2);
    for (let index=1;index<=5;index++) cb.reasoning(`Reasoning part ${index}. `);
    cb.answer('Complete response.');
    return {answer:'Complete response.',finishReason:'stop',calls:[]};
  }},model,capabilities,messages,signal:new AbortController().signal,onReasoning:text=>thinking+=text,onAnswer:text=>answer+=text,onReasoningState:active=>states.push(active)});
  assert.equal(calls,1);
  assert.equal(results.segments,1);
  assert.match(thinking,/Reasoning part 5/);
  assert.equal(answer,'Complete response.');
  assert.deepEqual(states,[true,false]);
});

test('prompt replay instructions are absent from the assembled inference request', async () => {
  const {prepareGeneration}=require('../.test-dist/engine/context-window.js');
  const planned=await prepareGeneration({kind:'llama.cpp',countTokens:async()=>150},model,capabilities,messages,new AbortController().signal);
  assert.deepEqual(planned.messages,messages);
  assert.doesNotMatch(JSON.stringify(planned.messages),/UNFINISHED REASONING TAIL|Continue working from the unfinished reasoning/);
});

test('reasoning and answer deltas from a single request preserve their original order',async()=>{
  let calls=0,visible='',reasoning='';
  const result=await streamContinuousAnswer({adapter:{kind:'vllm',countTokens:async()=>300,generate:async(_m,_messages,_caps,cb)=>{
    calls++;
    cb.reasoning('Inspect types.');cb.reasoning('Review API.');cb.answer('Part A. ');cb.answer('Part B.');
    return {answer:'Part A. Part B.',finishReason:'stop',calls:[]};
  }},model:{...model,backend:'vllm'},capabilities,messages,signal:new AbortController().signal,onAnswer:t=>visible+=t,onReasoning:t=>reasoning+=t});
  assert.equal(calls,1);
  assert.equal(result.answer,'Part A. Part B.');
  assert.equal(visible,'Part A. Part B.');
  assert.equal(reasoning,'Inspect types.Review API.');
});

test('new anime layer settings survive validation without damaging legacy characters', () => {
  const old = defaultWorkspace().sparks[0];
  const raw = structuredClone(old);
  raw.avatar.anime = { ...raw.avatar.anime, artStyle: 'chibi', leftEyeColor: '#ff0088', rightEyeColor: '#40c0ff',
    layers: { frontHair: { visible: false }, eyes: { offsetX: 14, scale: 120 }, accessories: { offsetY: -5 } } };
  const validated = validateSpark(raw);
  assert.equal(validated.avatar.anime.artStyle, 'chibi');
  assert.equal(validated.avatar.anime.layers.frontHair.visible, false);
  assert.equal(validated.avatar.anime.leftEyeColor, '#ff0088');
  assert.equal(validated.avatar.anime.rightEyeColor, '#40c0ff');
  assert.equal(resolveLayer(validated.avatar.anime, 'eyes').scale, 120);
  assert.deepEqual(migrateAvatarAppearance({ ...old.avatar.anime, artStyle: undefined }).layers, {});
  assert.equal(new Set(avatarLayerOrder).size, avatarLayerOrder.length);
});

test('split <think> region stays reasoning when request ends on the 2048 boundary', async () => {
  const { streamLlamaTurn } = require('../.test-dist/engine/llama.js');
  const previousFetch = global.fetch;
  global.fetch = async () => {
    const events = [
      { choices: [{ delta: { content: '<thi' } }] },
      { choices: [{ delta: { content: 'nk>Check image dimensions and dependencies.' } }] },
      { choices: [{ delta: {}, finish_reason: 'length' }] },
    ];
    const encoded = new TextEncoder().encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n');
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoded); controller.close(); } }), { status: 200 });
  };
  let answer = '';
  let reasoning = '';
  try {
    const result = await streamLlamaTurn(model, messages, capabilities, {
      reasoning: (t) => reasoning += t, answer: (t) => answer += t,
    }, new AbortController().signal, { outputTokens: 2048 });
    assert.equal(reasoning, 'Check image dimensions and dependencies.');
    assert.equal(result.reasoning, reasoning);
    assert.equal(result.reasoningOpen, true);
    assert.equal(result.answer, '');
    assert.equal(answer, '');
  } finally { global.fetch = previousFetch; }
});

test('legacy anime appearances stay compatible with a new layer document and arbitrary layers are ignored', () => {
  const source = defaultWorkspace().sparks[0];
  const raw = structuredClone(source);
  delete raw.avatar.anime.artStyle;
  raw.avatar.anime.layers = { invalidLayer: { visible: false, offsetX: 2000 } };
  const validated = validateSpark(raw);
  assert.equal(validated.avatar.anime.artStyle, 'modern');
  assert.ok(!('invalidLayer' in validated.avatar.anime.layers));
  assert.ok(avatarLayerOrder.every((layer) => validated.avatar.anime.layers[layer].visible));
});
