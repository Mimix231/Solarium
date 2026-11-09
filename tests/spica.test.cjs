const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { starterGraph, changeGraph, compileGraph, validateGraph, collectionUpgrade, stableGraphJson } = require('../.test-dist/spica/graph.js');
const { SpicaRepository } = require('../.test-dist/spica/repository.js');
const { isSpicaProgramRequest, isSpicaStyleRequest, reviewSpicaEdit, selectSpicaTools, spicaEditSignature, spicaTools } = require('../.test-dist/spica/tools.js');
const { appearanceCss, STANDALONE_STYLE_SCOPE, styleChanges, styleTargets } = require('../.test-dist/spica/appearance.js');
const { decideToolPermission } = require('../.test-dist/engine/action-permissions.js');
const { validateToolArguments } = require('../.test-dist/engine/intelligence/tool-validation.js');
const { blockRegistry, recipeCatalog } = require('../.test-dist/spica/program.js');
const { inspectSpicaComponent, searchSpicaWarehouse } = require('../.test-dist/spica/warehouse.js');

const toggle = { op: 'add_setting', page: 'general', key: 'show_tips', label: 'Show tips', type: 'boolean', initial: false };

test('notes and tasks reuse the record contract and preview the same additive field the target emits', () => {
  const notes = starterGraph('Notes Organizer', 'notes');
  const tasks = starterGraph('Task Tracker', 'tasks');
  assert.equal(notes.collection.recipeVersion, tasks.collection.recipeVersion);
  assert.deepEqual(tasks.collection.fields.slice(0, 2).map(field => [field.key, field.type]),
    notes.collection.fields.map(field => [field.key, field.type]));
  assert.equal(tasks.collection.fields.at(-1).filter, true);
  const patch = { op: 'add_record_toggle', key: 'pinned', label: 'Pinned', initial: false, filter: true };
  assert.equal(validateToolArguments('edit_spica_graph', { revision: 1, edits: [patch] }, spicaTools).ok, true);
  const upgraded = changeGraph(notes, [patch]);
  const readback = JSON.parse(stableGraphJson(upgraded));
  assert.notEqual(JSON.stringify(readback), JSON.stringify(upgraded));
  assert.equal(stableGraphJson(readback), stableGraphJson(upgraded));
  assert.equal(stableGraphJson(compileGraph(readback)), stableGraphJson(compileGraph(upgraded)));
  const added = collectionUpgrade(notes.collection, upgraded.collection);
  assert.deepEqual(added, [{ key: 'pinned', label: 'Pinned', type: 'boolean', initial: false, filter: true }]);
  assert.deepEqual(compileGraph(upgraded).collection.fields.at(-1), added[0]);
  assert.throws(() => collectionUpgrade(upgraded.collection, notes.collection), /storage contract/);
  assert.throws(() => collectionUpgrade(notes.collection, tasks.collection), /storage identity/);
  assert.throws(() => changeGraph(notes, [{ ...patch, initial: 'false' }]), /Boolean/);
});
test('SPICA lowers typed graph connections to controls and preserves false defaults', () => {
  const graph = starterGraph('Settings', 'settings');
  const next = changeGraph(graph, [toggle]);
  const plan = compileGraph(next);
  assert.equal(graph.controls.length, 3);
  assert.deepEqual(plan.pages[0].controls.at(-1), {
    id: 'show_tips', label: 'Show tips', widget: 'toggle',
    definition: { key: 'show_tips', type: 'boolean', initial: false },
  });
  for (const edit of [{ ...toggle, key: 'notifications' }, { ...toggle, page: 'foreign' }, { ...toggle, initial: 'false' }]) {
    assert.throws(() => changeGraph(graph, [edit]));
  }
  next.controls.at(-1).widget = 'select';
  assert.throws(() => validateGraph(next), /compatible/);
});

test('SPICA accepts Dona’s archived toggle proposal and rejects incompatible values atomically', () => {
  const request = { edits: [{ initial: false, key: 'show_tips', label: 'Show tips', op: 'add_setting', page: 'general' }], revision: 8 };
  assert.equal(validateToolArguments('edit_spica_graph', request, spicaTools).ok, true);
  const graph = starterGraph('SPICA Settings', 'settings');
  const saved = changeGraph(graph, request.edits);
  assert.deepEqual(saved.preferences.at(-1), { key: 'show_tips', type: 'boolean', initial: false });
  assert.equal(saved.controls.at(-1).widget, 'toggle');
  assert.throws(() => changeGraph(graph, [request.edits[0], { ...toggle, key: 'bad', initial: 'false' }]), /initial must be a JSON boolean/);
  assert.equal(graph.preferences.some(p => p.key === 'show_tips'), false);
  assert.throws(() => changeGraph(saved, request.edits), /"show_tips" already exists/);
  assert.throws(() => changeGraph(graph, [{ ...request.edits[0], page: 'General' }]), /Available IDs are general, appearance/);
  const reordered = { revision: 8, edits: [{ page: 'general', op: 'add_setting', label: 'Show tips', key: 'show_tips', initial: false }] };
  assert.equal(spicaEditSignature(request), spicaEditSignature(reordered));
  assert.notEqual(spicaEditSignature(request), spicaEditSignature({ ...reordered, revision: 9 }));
  assert.notEqual(spicaEditSignature(request), spicaEditSignature({ ...reordered, edits: [{ ...reordered.edits[0], initial: true }] }));
});

test('SPICA rejects stale and concurrent edits, and undo/redo survives reopening', async () => {
  const rows = new Map();
  const store = {
    async list({ scopes }) { return structuredClone([...rows.values()].filter(r => scopes.some(s => s.id === r.scope.id))); },
    async batch(puts) {
      for (const { record, expected } of puts) assert.equal(rows.get(record.id)?.version ?? null, expected, 'revision conflict');
      for (const { record } of puts) rows.set(record.id, structuredClone(record));
    },
  };
  let repo = new SpicaRepository('project-a', store);
  const created = await repo.create('Settings', 'blank');
  const results = await Promise.allSettled([
    repo.update(created.data.revision, [toggle]),
    repo.update(created.data.revision, [{ ...toggle, label: 'Alternate tips label' }]),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(await new SpicaRepository('project-b', store).read(), null);
  await assert.rejects(repo.update(1, 'undo'), /revision changed/);
  repo = new SpicaRepository('project-a', store);
  const current = await repo.read();
  const undone = await repo.update(current.data.revision, 'undo');
  assert.equal(undone.data.graph.controls.length, 0);
  const redone = await repo.update(undone.data.revision, 'redo');
  assert.equal(redone.data.graph.controls.length, 1);
  assert.equal(redone.data.appId, created.data.appId);
});

test('SPICA tools are paged and edits, exports and builds require their normal grants', () => {
  const names = (...args) => selectSpicaTools(spicaTools, ...args).map(tool => tool.function.name);
  assert.deepEqual(names(null, true, false), ['read_spica_graph']);
  assert.deepEqual(names('read_spica_graph', true, false), ['edit_spica_graph']);
  assert.equal(names('edit_spica_graph', false, false)[0], 'export_spica_app');
  assert.equal(names('export_spica_app', false, false)[0], 'verify_spica_app');
  assert.deepEqual(names('verify_spica_app', false, true), []);
  const call = { revision: 3, edits: [toggle] };
  assert.equal(validateToolArguments('edit_spica_graph', call, spicaTools).ok, true);
  assert.equal(validateToolArguments('edit_spica_graph', { ...call, root: 'other' }, spicaTools).ok, false);
  for (const name of ['edit_spica_graph', 'export_spica_app', 'verify_spica_app']) {
    assert.equal(decideToolPermission({ mode: 'auto', name, projectAttached: true, webEnabled: false }), 'ask');
    assert.equal(decideToolPermission({ mode: 'yolo', name, projectAttached: true, webEnabled: false, configured: 'deny' }), 'deny');
    assert.equal(decideToolPermission({ mode: 'yolo', name, projectAttached: false, webEnabled: false }), 'deny');
  }
});

test('the warehouse searches only registered runtime entries and returns a bounded truthful shortlist', () => {
  const graph = starterGraph('Notes', 'notes');
  const result = searchSpicaWarehouse(graph, { query: 'quick capture pinned note', limit: 99 });
  assert.equal(result.registryRevision, 'spica-runtime-1');
  assert.equal(result.totalMatches > 0, true);
  assert.equal(result.candidates.length <= 12, true);
  assert.equal(result.candidates[0].id, 'spica.recipe.quick_capture');
  assert.equal(result.candidates[0].maturity, 'prototype');
  assert.equal(result.candidates[0].executableNow, false);
  assert.equal(result.candidates[0].installableNow, true);
  assert.match(result.candidates[0].blockedReasons.join(' '), /not been installed/);
  assert.equal(searchSpicaWarehouse(graph, { query: 'quick capture', executableOnly: true }).candidates.some(candidate =>
    candidate.id === 'spica.recipe.quick_capture'), false);
  assert.equal(searchSpicaWarehouse(graph, { query: 'stl mesh', target: 'desktop' }).candidates.some(candidate =>
    candidate.id === 'spica.block.models'), true);
  assert.equal(blockRegistry.length + recipeCatalog.length, 14);
  assert.throws(() => searchSpicaWarehouse(graph, { query: '   ' }), /nonempty query/);
});

test('warehouse inspection validates exact versions and resolves recipe executability from the graph', () => {
  const graph = starterGraph('Notes', 'notes');
  const recipe = inspectSpicaComponent(graph, 'spica.recipe.quick_capture', '1');
  assert.equal(recipe.installableNow, true);
  assert.equal(recipe.executableNow, false);
  assert.deepEqual(recipe.dependencies.map(dependency => dependency.id), [
    'spica.block.validate', 'spica.block.set', 'spica.block.save', 'spica.block.navigate',
    'spica.block.status', 'spica.block.form', 'spica.block.list',
  ]);
  const installed = changeGraph(graph, [{ op: 'install_recipe', recipe: 'quick_capture' }]);
  const ready = inspectSpicaComponent(installed, 'spica.recipe.quick_capture', '1', 'desktop');
  assert.equal(ready.executableNow, true);
  assert.equal(ready.installableNow, false);
  assert.throws(() => inspectSpicaComponent(graph, 'spica.recipe.quick_capture', '2'), /Unknown SPICA component/);
  assert.throws(() => inspectSpicaComponent(graph, 'spica.recipe.unknown', '1'), /Unknown SPICA component/);
});

test('SPICA behavior discovery and recipe schemas follow real staged tool turns', () => {
  assert.equal(isSpicaProgramRequest('Build a task app using reusable blocks'), true);
  assert.equal(isSpicaProgramRequest('Make a notebook app'), true);
  assert.equal(isSpicaProgramRequest('Explain how reusable blocks work'), false);
  const names = (last, program = true) => selectSpicaTools(spicaTools, last, true, false, false, program).map(tool => tool.function.name);
  assert.deepEqual(names(null), ['search_spica_warehouse']);
  assert.deepEqual(names('search_spica_warehouse'), ['inspect_spica_component', 'read_spica_graph']);
  assert.deepEqual(names('inspect_spica_component'), ['read_spica_graph']);
  assert.ok(names('read_spica_graph').includes('edit_spica_graph'));
  const edit = names('read_spica_graph').find(name => name === 'edit_spica_graph');
  assert.equal(validateToolArguments(edit, { revision: 1, edits: [{ op: 'install_recipe', recipe: 'quick_capture' }] },
    selectSpicaTools(spicaTools, 'read_spica_graph', true, false, false, true)).ok, true);
  const permission = mode => decideToolPermission({ mode, name: 'search_spica_warehouse', webEnabled: false, projectAttached: true });
  assert.equal(permission('ask'), 'ask');
  assert.equal(permission('auto'), 'allow');
  assert.equal(permission('yolo'), 'allow');
  assert.equal(decideToolPermission({ mode: 'yolo', name: 'search_spica_warehouse', webEnabled: false, projectAttached: true,
    configured: 'deny' }), 'deny');
});

const style = (target, property, value, state) => ({ op: 'set_style', target, property, value, ...(state ? { state } : {}) });

test('manual and Spark appearance edits lower to the same scoped styles, with typed states and legacy storage', () => {
  const legacy = starterGraph('Notes', 'notes');
  const edits = [style('app', 'scheme', 'dark'), style('app', 'background', '#202329'), style('app', 'accent', '#FFBF47'),
    style('record-save', 'radius', 18), style('record-save', 'background', '#ffe9b3', 'hover'),
    style('record-save', 'focusRing', '#ffffff', 'focus'), style('record-row', 'background', '#5a4422', 'selected')];
  assert.equal(validateToolArguments('edit_spica_graph', { revision: 2, edits }, spicaTools).ok, true);
  const edited = changeGraph(legacy, edits);
  assert.deepEqual(edited.collection, legacy.collection);
  assert.deepEqual(collectionUpgrade(legacy.collection, edited.collection), []);
  const restored = JSON.parse(stableGraphJson(edited));
  assert.deepEqual(compileGraph(restored).appearance, edited.appearance);
  const css = appearanceCss(compileGraph(restored).appearance, 'sample', { target: 'record-save', state: 'focus', inspect: false });
  assert.match(css, /--accent:#ffbf47;--accent-ink:#000000/);
  assert.match(css, /--surface:#202329/);
  assert.match(css, /data-spica-surface="sample".*data-spica-part="record-save"\]\{border-radius:18px\}/);
  assert.match(css, /:hover.*background-color:#ffe9b3/);
  assert.match(css, /data-spica-simulate.*outline-color:#ffffff/);
  assert.match(css, /:checked.*background-color:#5a4422/);
  assert.doesNotMatch(appearanceCss(edited.appearance, 'app'), /data-spica-simulate/);
  assert.deepEqual(styleChanges(legacy, edited).find(change => change.property === 'accent'), {
    target: 'app', label: 'App theme', state: 'base', property: 'accent', before: null, after: '#ffbf47',
  });
  assert.equal(changeGraph(edited, [style('record-save', 'radius', null)]).appearance.blocks['record-save'].base, undefined);
  assert.equal(compileGraph(legacy).appearance, undefined);
});

test('appearance edits reject unsupported targets, states and CSS payloads as one atomic operation', () => {
  const legacy = starterGraph('Notes', 'notes');
  for (const bad of [style('record-save', 'background', '#000;display:none'), style('record-save', 'radius', '18px'),
    style('record-save', 'radius', 1000), style('record-save', 'background', '#000000', 'selected'),
    style('record-sidebar', 'text', '#000000', 'hover'), style('record-filter', 'radius', 10),
    style('__proto__', 'radius', 8), style('app', 'direction', 'column')]) {
    assert.throws(() => changeGraph(legacy, [style('app', 'accent', '#ffbf47'), bad]), /Style property|Unknown appearance target|has no/);
    assert.equal(legacy.appearance, undefined);
  }
  assert.throws(() => validateGraph({ ...legacy, appearance: { blocks: { 'record-save': { base: { transform: 'url(file)' } } } } }), /unavailable/);
  const settings = changeGraph(starterGraph('Settings', 'settings'), [style('setting-input-notifications', 'accent', '#11aabb')]);
  const renamed = changeGraph(settings, [{ op: 'label_setting', key: 'notifications', label: 'Show alerts' }]);
  assert.equal(renamed.appearance.blocks['setting-input-notifications'].base.accent, '#11aabb');
  assert.equal(styleTargets(renamed).find(part => part.id === 'setting-input-notifications').label, 'Show alerts control');
  assert.equal(changeGraph(renamed, [{ op: 'remove_setting', key: 'notifications' }]).appearance, undefined);
});

test('SPICA checks an appearance proposal before Ask and shows the exact valid change', () => {
  const record = { data: { revision: 5, graph: starterGraph('Notes', 'notes') } };
  const proposal = { revision: 5, edits: [style('app', 'background', '#202329')] };
  const reviewed = reviewSpicaEdit(record, proposal);
  assert.equal(reviewed.ok, true);
  assert.deepEqual(reviewed.args.review.appearance[0], {
    target: 'app', label: 'App theme', state: 'base', property: 'background', before: null, after: '#202329',
  });
  assert.equal(reviewSpicaEdit(record, { ...proposal, revision: 4 }).result.code, 'STALE_GRAPH');
  const invalid = reviewSpicaEdit(record, { ...proposal, edits: [style('record-save', 'radius', '18px')] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.result.message, /integer from 0 to 64/);
  assert.equal(record.data.graph.appearance, undefined);
});

test('standalone appearance is emitted as a scoped asset under a self-only style policy', () => {
  const source = name => readFileSync(join(__dirname, '../src/spica', name), 'utf8');
  const graph = changeGraph(starterGraph('Notes', 'notes'), [style('app', 'accent', '#ffbf47')]);
  assert.match(appearanceCss(compileGraph(graph).appearance, STANDALONE_STYLE_SCOPE), /data-spica-surface="standalone".*--accent:#ffbf47/);
  assert.match(source('emit.ts'), /appearanceCss\(plan.appearance, STANDALONE_STYLE_SCOPE\)/);
  assert.match(source('emit.ts'), /'src\/settings\.css': stylesheet/);
  assert.match(source('emit.ts'), /style-src 'self'"/);
  assert.doesNotMatch(source('emit.ts'), /unsafe-inline|<style>/);
  assert.match(source('target/entry.txt'), /<SpicaApp standalone/);
  assert.match(source('target/SettingsApp.tsx'), /stylesheetScope \? '' : appearanceCss/);
});

test('linked appearance requests retain staged reads, edits and real verification', () => {
  for (const prompt of ['Give Notes a charcoal theme, use amber for the accent, and round the Save button',
    'Restyle the notes sidebar', 'Could you make the Save button amber?', 'Round the Save button']) assert.equal(isSpicaStyleRequest(prompt), true);
  for (const prompt of ['How can I recolor the Save button?', 'Explain a charcoal theme', 'Give me some palette suggestions for Notes', 'Make a task to paint the door',
    'In Code Studio, change the button CSS']) assert.equal(isSpicaStyleRequest(prompt), false);
  const names = (last, needsEdit, verified = false) => selectSpicaTools(spicaTools, last, needsEdit, verified, true).map(tool => tool.function.name);
  assert.deepEqual(names(null, true), ['read_spica_graph']);
  assert.deepEqual(names('read_spica_graph', true), ['edit_spica_graph', 'read_spica_graph']);
  assert.equal(names('edit_spica_graph', false)[0], 'export_spica_app');
  assert.equal(names('export_spica_app', false)[0], 'verify_spica_app');
  assert.deepEqual(names('verify_spica_app', false, true), []);
});
