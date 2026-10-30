const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const { worldContext, retrieveWorldEntries } = require('../.test-dist/domain/worlds.js');
const { composeSparkInstructions } = require('../.test-dist/domain/persona.js');
const { suggestExpression } = require('../.test-dist/domain/expressions.js');

test('World retrieval ranks actual matching entries and isolates Spark identities', () => {
  const w = defaultWorkspace();
  const [a, b] = w.sparks;
  const entry = { id: 'e', title: 'The Witch Tea Party', keywords: ['Echidna', 'Sanctuary'], content: 'Tea is served in the garden.', enabled: true };
  const worlds = [{ id: 'w', sparkId: a.id, title: 'Lore', description: '', entries: [entry], createdAt: '' }];
  assert.equal(retrieveWorldEntries(worlds, a.id, 'Tell me about Sanctuary tea')[0].title, entry.title);
  assert.equal(retrieveWorldEntries(worlds, b.id, 'Tell me about Sanctuary tea').length, 0);
  assert.ok(composeSparkInstructions(a, 'conversation', [], worlds, 'Sanctuary tea').includes('Tea is served'));
  assert.ok(!composeSparkInstructions(b, 'conversation', [], worlds, 'Sanctuary tea').includes('Tea is served'));
  assert.equal(worldContext(worlds, a.id, 'unrelated topic'), '');
});

test('Worlds, lab cases, teams, branches survive workspace validation without cross-Spark data leaks', () => {
  const w = defaultWorkspace();
  const sparkId = w.sparks[0].id;
  const other = w.sparks[1].id;
  w.worlds.push({ id: 'world', sparkId, title: 'My world', description: 'Lore', createdAt: '', entries: [{ id:'e', title:'Home', content:'Base', keywords:['base'], enabled:true }] });
  w.labCases.push({ id:'lab', sparkId, title:'Voice', prompt:'Hello', expectedPhrases:['hello'], lastResponse:'Hello!', rating:4 });
  w.teamRuns.push({ id:'team', title:'Build', task:'Do useful work', sparkIds:[sparkId,other], modelId:'x', createdAt:'', steps:[{ sparkId, content:'Plan' }] });
  w.sessions.push({ id:'branch', sparkId, parentSessionId:'original', forkMessageId:'message', title:'Branch', modelId:null, mode:'work', createdAt:'', updatedAt:'', messages:[] });
  const restored = validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(restored.worlds[0].entries[0].title,'Home');
  assert.equal(restored.labCases[0].rating,4);
  assert.equal(restored.teamRuns[0].steps[0].content,'Plan');
  assert.equal(restored.sessions[0].parentSessionId, 'original');
  assert.equal(restored.sessions[0].forkMessageId,'message');
  const invalid = structuredClone(w);
  invalid.worlds[0].sparkId = 'unknown';
  assert.equal(validateWorkspace(invalid).worlds.length,0);
});

test('Conservative avatar expressions are descriptive and never imply thought detection', () => {
  assert.equal(suggestExpression('What a fascinating situation!'), 'curious');
  assert.equal(suggestExpression('Congratulations, this is wonderful!'), 'happy');
  assert.equal(suggestExpression('I have been examining the results.'), 'neutral');
  assert.equal(suggestExpression(''), 'neutral');
});

test('Extended anime avatar data and real strawberry theme round-trip with safe defaults', () => {
  const w = defaultWorkspace();
  w.preferences.theme = 'strawberry';
  w.preferences.workspaceMode = 'workspace';
  w.sparks[0].avatar.anime.sideHair = 'braids';
  w.sparks[0].avatar.anime.pupil = 'star';
  w.sparks[0].avatar.anime.shoulderWidth = 118;
  w.sparks[0].avatar.expression = 'embarrassed';
  const restored = validateWorkspace(w);
  assert.equal(restored.preferences.theme, 'strawberry');
  assert.equal(restored.preferences.workspaceMode, 'workspace');
  assert.equal(restored.sparks[0].avatar.anime.sideHair, 'braids');
  assert.equal(restored.sparks[0].avatar.anime.shoulderWidth, 118);
  assert.equal(restored.sparks[0].avatar.expression, 'embarrassed');
});

test('Native install jobs are persistent and reachable from the global application shell', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const job = fs.readFileSync('src-tauri/src/install_jobs.rs', 'utf8');
  const main = fs.readFileSync('src/main.tsx', 'utf8');
  const models = fs.readFileSync('src/views/Models.tsx', 'utf8');
  assert.match(src, /start_install_job, get_install_jobs, cancel_install_job/);
  assert.match(job, /installer state|Installer state|installer\/jobs\.json|pub fn new\(/i);
  assert.match(job, /interrupted/);
  assert.match(main, /startInstallerTracking\(\)/);
  assert.doesNotMatch(models, /useState<\{engine: string; phase: string; downloaded:/);
});

test('Fruit themes have distinct materials and Strawberry uses red white green', () => {
  const fs = require('node:fs');
  for (const fruit of ['strawberry','cherry','peach','lime','kiwi','blueberry','tangerine']) {
    const css = fs.readFileSync(`src/themes/${fruit}/${fruit}.css`, 'utf8');
    assert.match(css, new RegExp(`data-theme='${fruit}'`));
    assert.match(css, /\.spark-card::after/);
    assert.match(css, /--rail-surface/);
  }
  const strawberry = fs.readFileSync('src/themes/strawberry/strawberry.css', 'utf8');
  assert.match(strawberry, /#c82643/); // berry red
  assert.match(strawberry, /#fff9f4/); // cream white
  assert.match(strawberry, /#275c42/); // leafy green
});
