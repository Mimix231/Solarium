const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { catalogToModels, mergeCatalog } = require(path.join(__dirname, '../.test-dist/engine/catalog.js'));
const { validateWorkspace } = require(path.join(__dirname, '../.test-dist/domain/validation.js'));
const { defaultWorkspace } = require(path.join(__dirname, '../.test-dist/domain/defaults.js'));

test('catalog creates stable keys and does not duplicate after rescans', () => {
  const file = { name: 'My Qwen 7B.Q4.gguf', path: 'D:\\models\\My Qwen 7B.Q4.gguf', sizeBytes: 900_000 };
  const first = catalogToModels([file], 8080);
  const second = catalogToModels([file], 8080);
  assert.equal(first[0].id, second[0].id);
  assert.equal(first[0].ggufPath, file.path);
  assert.equal(mergeCatalog(first, second, 'D:\\models').length, 1);
  assert.equal(first[0].backend, 'llama.cpp');
});

test('switching model folders removes stale auto-discovered files without removing manually registered servers', () => {
  const old = catalogToModels([{name: 'Old.gguf', path: 'D:\\old\\Old.gguf', sizeBytes: 1}], 8080);
  const next = catalogToModels([{name: 'New.gguf', path: 'E:\\new\\New.gguf', sizeBytes: 1}], 8080);
  const manual = { ...old[0], id: 'manual', name: 'Ollama', ggufPath: undefined, backend: 'ollama' };
  const merged = mergeCatalog([...old,manual], next, 'E:\\new');
  assert.equal(merged.length, 2);
  assert.ok(merged.some(m=>m.id === 'manual'));
  assert.ok(!merged.some(m=>m.id === old[0].id));
});

test('workspace round trip preserves anime layers, fruit themes and GGUF model folder', () => {
  const w = defaultWorkspace();
  w.preferences.theme = 'cherry';
  w.preferences.ggufDirectory = 'E:\\my files\\AI Models';
  w.sparks[0].avatar.anime = { ...w.sparks[0].avatar.anime, hairstyle: 'twin-tails', eyeColor: '#eeddcc' };
  const validated = validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(validated.preferences.theme, 'cherry');
  assert.equal(validated.preferences.ggufDirectory, 'E:\\my files\\AI Models');
  assert.equal(validated.sparks[0].avatar.anime.hairstyle, 'twin-tails');
});
