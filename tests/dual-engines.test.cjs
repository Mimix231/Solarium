const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { composeSparkInstructions } = require('../.test-dist/domain/persona.js');
const { validateSpark, validateWorkspace } = require('../.test-dist/domain/validation.js');
const { adapterFor, generationMetrics } = require('../.test-dist/engine/backends.js');

test('raw personality is authoritative and survives workspace round-trip intact', () => {
  const workspace = defaultWorkspace();
  const spark = workspace.sparks[0];
  const personality = '# Persona\n\nI speak with elaborate curiosity.\nNever use my old personality.\n';
  spark.dna = { mode: 'raw', raw: personality, identity: 'IGNORED', speech: '', behavior: '', relationships: '', workStyle: '', boundaries: '' };
  spark.instructions = 'OLD DETAILS FROM THE SIMPLE EDITOR';
  const restored = validateWorkspace(JSON.parse(JSON.stringify(workspace)));
  const prompt = composeSparkInstructions(restored.sparks[0], 'work', []);
  assert.equal(restored.sparks[0].dna.raw, personality);
  assert.ok(prompt.includes(personality));
  assert.ok(prompt.includes('Current interaction mode: work'));
  assert.ok(!prompt.includes('OLD DETAILS FROM THE SIMPLE EDITOR'));
  assert.ok(!prompt.includes('IGNORED'));
});

test('advanced Spark DNA includes categories and leaves original traits untouched', () => {
  const spark = defaultWorkspace().sparks[0];
  spark.dna = { mode: 'advanced', raw: 'NOT AN ACTIVE RAW PERSONA', identity: 'An astronomer', speech: 'Carefully measured diction', behavior: 'Asks thoughtful questions', relationships: '', workStyle: 'Validates code before presenting it', boundaries: 'No teasing' };
  const prompt = composeSparkInstructions(spark, 'research', []);
  assert.match(prompt, /Identity and background:\nAn astronomer/);
  assert.match(prompt, /Speech and vocabulary:\nCarefully measured diction/);
  assert.match(prompt, /Approach to work:\nValidates code before presenting it/);
  assert.match(prompt, /Personality traits/);
  assert.doesNotMatch(prompt, /NOT AN ACTIVE RAW PERSONA/);
});

test('invalid imported Spark image data and oversized raw personality are sanitized', () => {
  const raw = JSON.parse(JSON.stringify(defaultWorkspace().sparks[0]));
  raw.avatar.expressionImages = { happy: 'javascript:alert(1)', focused: 'data:image/png;base64,AA==', curious: 'https://example.com/evil.png' };
  raw.dna = { mode: 'raw', raw: 'a'.repeat(65_000) };
  const imported = validateSpark(raw);
  assert.equal(imported.dna.raw.length, 64_000);
  assert.equal(imported.avatar.expressionImages.happy, undefined);
  assert.equal(imported.avatar.expressionImages.focused, 'data:image/png;base64,AA==');
  assert.equal(imported.avatar.expressionImages.curious, undefined);
});

test('both OpenAI-compatible backends stream at the same time on separate ports', async () => {
  const original = global.fetch;
  const seen = [];
  const mk = (text, usage) => [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
    `data: ${JSON.stringify({ usage: { completion_tokens: usage } })}\n\n`,
    'data: [DONE]\n\n',
  ].join('');
  global.fetch = async (uri, init = {}) => {
    const url = String(uri);
    seen.push({ url, body: init.body && JSON.parse(init.body) });
    if (url.endsWith('/v1/models')) return Response.json({ data: [{ id: url.includes(':8000') ? 'vllm-model' : 'gguf-model' }] });
    if (url.endsWith('/props')) return new Response('', { status: 404 });
    return new Response(mk(url.includes(':8000') ? 'vLLM response' : 'llama.cpp response', url.includes(':8000') ? 4 : 2), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  const models = [
    { backend: 'llama.cpp', endpoint: 'http://127.0.0.1:8080', modelId: 'gguf-model', maxTokens: 32, temperature: .4 },
    { backend: 'vllm', endpoint: 'http://127.0.0.1:8000', modelId: 'vllm-model', maxTokens: 32, temperature: .4 },
  ];
  try {
    const results = await Promise.all(models.map(async (model) => {
      const adapter = adapterFor(model);
      const capabilities = (await adapter.inspect(model)).capabilities;
      return adapter.generate(model, [{role: 'user', content: 'hi'}], capabilities, {answer() {}, reasoning() {}}, new AbortController().signal);
    }));
    assert.equal(results[0].answer, 'llama.cpp response');
    assert.equal(results[1].answer, 'vLLM response');
    assert.equal(results[1].usage.completionTokens, 4);
    assert.ok(seen.some((x) => x.url === 'http://127.0.0.1:8080/v1/chat/completions'));
    assert.ok(seen.some((x) => x.url === 'http://127.0.0.1:8000/v1/chat/completions' && x.body.stream_options?.include_usage));
  } finally { global.fetch = original; }
});

test('generation metric labels estimated output separately from reported token counts', () => {
  const measured = generationMetrics('vllm', 'test', 10, 110, 2110, '0123456789', 200);
  assert.equal(measured.completionTokens, 200);
  assert.equal(measured.firstTokenMs, 100);
  assert.equal(measured.tokensPerSecond, 100);
  const estimated = generationMetrics('llama.cpp', 'test', 10, null, 1010, 'abcdefghij');
  assert.equal(estimated.completionTokens, null);
  assert.equal(estimated.estimatedTokens, 3);
  assert.equal(estimated.tokensPerSecond, 3);
});

test('backend registration survives storage validation, arbitrary remote endpoints do not', () => {
  const w = defaultWorkspace();
  w.models.push({ id: 'a', name: 'GPU', backend: 'vllm', modelId: 'local', endpoint: 'http://127.0.0.1:8000', contextSize: 4096, temperature: .5, maxTokens: 200, createdAt: '' });
  w.models.push({ id: 'b', name: 'bad', backend: 'vllm', modelId: 'remote', endpoint: 'http://192.168.1.42:8000', contextSize: 4096, temperature: .5, maxTokens: 200, createdAt: '' });
  const validated = validateWorkspace(w);
  assert.deepEqual(validated.models.map((m) => m.id), ['a']);
  assert.equal(validated.models[0].backend, 'vllm');
});
