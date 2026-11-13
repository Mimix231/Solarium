'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const compiled = path.join(root, '.spica-phase01-test/spica');
const baseline = require('./fixtures/spica-phase01-legacy.json');
const registry = require(path.join(compiled, 'runtime/blocks/registry.js'));
const { defineSpicaBlock } = require(path.join(compiled, 'runtime/blocks/defineBlock.js'));
const { blockCategoryValid, spicaBlockCategories } = require(path.join(compiled, 'runtime/blocks/categories.js'));
const { blockRegistry, recipeCatalog, executeFlow } = require(path.join(compiled, 'program.js'));
const { browseSpicaWarehouse, inspectSpicaComponent, registeredWarehouseCounts } = require(path.join(compiled, 'warehouse.js'));
const { draftCapabilityDescriptor, inspectRegisteredCapability, searchRegisteredSpicaCapabilities, spicaRegisteredCapabilityCounts } = require(path.join(compiled, 'capabilities.js'));
const { inlineLegacyBlockRegistry } = require(path.join(compiled, 'runtime/blocks/standalone.js'));
const { starterGraph, changeGraph, compileGraph } = require(path.join(compiled, 'graph.js'));
const generator = require('../scripts/generate-spica-registry.cjs');
const { execFileSync: globalCommand } = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(globalCommand('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }

test('all 26 pre-existing block contracts, IDs, targets, grants and order are preserved', () => {
  assert.equal(blockRegistry.length, 26);
  assert.deepEqual(blockRegistry.map(block => ({...block, capability: block.capability ?? null})),
    baseline.blocks.map(({id, version,kind,label,inputs,outputs,targets,capability}) =>
      ({id, version,kind,label,inputs,outputs,targets,capability:capability??null})));
  assert.deepEqual(recipeCatalog.map(recipe => recipe.id), baseline.recipes);
});

test('exactly one per-file contract is registered with matching category and source location', () => {
  const blocks = registry.listBlocks();
  assert.equal(blocks.length, 26);
  assert.equal(new Set(blocks.map(block => `${block.id}@${block.version}`)).size, blocks.length);
  for (const block of blocks) {
    assert.ok(blockCategoryValid(block), block.id);
    assert.equal(block.implementation.ref, `program:${block.id}`);
    assert.equal(block.ports.inputs[0].description, block.inputs);
    assert.equal(block.ports.outputs[0].description, block.outputs);
    assert.ok(fs.existsSync(path.join(root, block.sourcePath)));
    assert.equal(block.sourcePath.split('/')[5], block.subcategory);
    assert.equal(registry.getBlock(block.id, block.version), block);
    assert.equal(registry.getBlock(`spica.block.${block.id}`, block.version), block);
    assert.equal(registry.isExecutableBlock(block.id, block.version), true);
  }
  assert.equal(spicaBlockCategories.length, 35);
  assert.equal(spicaRegisteredCapabilityCounts().plannedCapacity, 350000);
  assert.equal(spicaRegisteredCapabilityCounts().indexedDraftCount, null);
  assert.equal(spicaRegisteredCapabilityCounts().verifiedExecutableCount, 0);
});

test('metadata-only search does not eagerly import executable block modules', () => {
  const loaded = Object.keys(require.cache).filter(file => file.includes('.spica-phase01-test/spica/runtime/blocks/') &&
    /\/(?:ui|layout|filesystem|game-2d|variables|data-records|functions|form-inputs|styling|orchestration|assets-3d|interface-navigation|professionalism)\//.test(file));
  assert.deepEqual(loaded, []);
  const graph = starterGraph('Audit');
  const page = browseSpicaWarehouse(graph, {query: '', limit: 12});
  assert.equal(page.totalMatches, 29);
  assert.equal(Object.keys(require.cache).filter(file => file.includes('.spica-phase01-test/spica/runtime/blocks/ui/forms/')).length,0);
});

test('lazy loading enforces exact ID/version, targets and grants', async () => {
  await assert.rejects(registry.loadBlock('review','1',{target:'desktop',grants:[]}), /Missing SPICA permission/);
  await assert.rejects(registry.loadBlock('review','2',{target:'desktop',grants:['files.open']}), /Unknown SPICA/);
  await assert.rejects(registry.loadBlock('review','1',{target:'game-2d',grants:['files.open']}), /Unsupported SPICA target/);
  const loaded = await registry.loadBlock('review','1',{target:'desktop',grants:['files.open']});
  assert.equal(loaded.id, 'review');
  assert.equal(loaded.implementation.ref, 'program:review');
  assert.equal(registry.getBlock('spica.ui.record-table'), undefined);
});

test('search and inspection retain old warehouse API and recipe installability', () => {
  assert.equal(registeredWarehouseCounts.adapters, 26);
  assert.equal(registeredWarehouseCounts.recipes, 3);
  const graph = starterGraph('Warehouse', 'notes');
  const result = searchRegisteredSpicaCapabilities(graph,{query:'record',target:'desktop'});
  assert.ok(result.totalMatches > 0);
  const detail = inspectRegisteredCapability(graph, 'spica.block.list','1','desktop');
  assert.equal(detail.origin,'registered-block');
  assert.equal(detail.implementationStatus,'registered-adapter');
  assert.equal(detail.verifiedExecutable,false);
  assert.equal(detail.sourceRef, 'src/spica/runtime/blocks/ui/records/list.ts');
  const recipe = inspectSpicaComponent(graph,'spica.recipe.quick_capture','1','desktop');
  assert.equal(recipe.recipeId,'quick_capture');
  assert.equal(recipe.installableNow, true);
  assert.ok(recipe.dependencies.length);
});

test('metadata-only catalog proposals never become runnable blocks', () => {
  const proposal = draftCapabilityDescriptor({id:'spica.ui.record-table',version:'1',category:34,kind:'primitive',maturity:'draft',
    title:'Table proposal', summary:'Draft only', tags:'table',reference:'catalog'});
  assert.equal(proposal.origin,'catalog-draft');
  assert.equal(proposal.implementationStatus,'metadata-only');
  assert.equal(proposal.verifiedExecutable,false);
  assert.equal(registry.isExecutableBlock(proposal.id,proposal.version),false);
  assert.equal(proposal.targetSupport.length,0);
});

test('schema-1 graph and flow execution still compile with unchanged block IDs', async () => {
  const graph=changeGraph(starterGraph('Compatibility','notes'),[{op:'install_recipe',recipe:'quick_capture'}]);
  const plan=compileGraph(graph);
  assert.equal(plan.program.schema,1);
  assert.ok(plan.blocks.form || plan.blocks.list);
  const changed=changeGraph(graph,[{op:'grant_capability',capability:'files.open'}]);
  assert.ok(changed.program.grants.includes('files.open'));
  assert.equal(typeof executeFlow,'function');
});

test('standalone exports inline the existing registry and do not depend on Solarium internals', () => {
  const programSource=fs.readFileSync(path.join(root,'src/spica/program.ts'),'utf8');
  const inlined=inlineLegacyBlockRegistry(programSource,blockRegistry);
  assert.doesNotMatch(inlined,/Object\.freeze\(listBlocks\(\)/);
  assert.match(inlined,/export const blockRegistry: readonly/);
  assert.match(inlined, /"id": "csv_transform"/);
  assert.equal((inlined.match(/"version": 1/g)||[]).length,26);
  assert.throws(()=>inlineLegacyBlockRegistry('const a=1',blockRegistry),/incompatible/);
});


test('actual emitTauri source produces self-contained standalone schema-1 code', () => {
  const source = fs.readFileSync(path.join(root,'src/spica/emit.ts'),'utf8');
  const compiledSource = ts.transpileModule(source, {compilerOptions:{
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, esModuleInterop:true,
  }}).outputText;
  const substituteRequire = id => {
    if (id.endsWith('?raw')) {
      const rawPath = path.resolve(root, 'src/spica', id.slice(0,-4));
      return {__esModule:true,default:fs.readFileSync(rawPath,'utf8')};
    }
    if (id === './graph') return require(path.join(compiled,'graph.js'));
    if (id === './appearance') return require(path.join(compiled,'appearance.js'));
    if (id === './program') return require(path.join(compiled,'program.js'));
    if (id === './runtime/blocks/standalone') return require(path.join(compiled,'runtime/blocks/standalone.js'));
    throw Error(`Unexpected standalone emitter import: ${id}`);
  };
  const fakeModule={exports:{}};
  new Function('module','exports','require',compiledSource)(fakeModule,fakeModule.exports,substituteRequire);
  const files=fakeModule.exports.emitTauri({appId:'test_app_id',revision:1,graph:starterGraph('Canon Export','notes')});
  assert.equal(typeof files['src/graph.ts'],'string');
  assert.equal(typeof files['src/main.tsx'],'string');
  assert.equal(files['src/graph.ts'].includes('listBlocks()'),false);
  assert.equal(files['src/graph.ts'].includes('program-v1-adapter'),false);
  assert.match(files['src/graph.ts'],/export const blockRegistry: readonly/);
  assert.equal((files['src/graph.ts'].match(/"version": 1/g)||[]).length,26);
  assert.ok(files['src/plan.json'].includes('Canon Export'));
  const standaloneSource = path.join(root,'.spica-phase01-test','generated-standalone-graph.ts');
  fs.writeFileSync(standaloneSource,files['src/graph.ts']);
  const typeProgram = ts.createProgram([standaloneSource], {
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext,
    moduleResolution:ts.ModuleResolutionKind.Bundler, noEmit:true,
    strict:true, skipLibCheck:true, noUncheckedIndexedAccess:true, types:[],
  });
  const errors=ts.getPreEmitDiagnostics(typeProgram);
  assert.deepEqual(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText,' ')),[]);
});

test('duplicate IDs and edited legacy contracts fail generator validation', () => {
  const blocks=registry.listBlocks();
  assert.throws(()=>generator.validateLegacy([...blocks,blocks[0]]),/Duplicate block/);
  assert.throws(()=>generator.validateLegacy(blocks.filter(block=>block.id!=='save')),/Legacy block missing/);
  const invalid=blocks.map(block=>block.id==='review' ? {...block,targets:['desktop']} : block);
  assert.throws(()=>generator.validateLegacy(invalid),/targets\/permissions changed/);
  assert.equal(blockCategoryValid({...blocks[0], categoryId:999}),false);
});

test('malformed target, permission, port or implementation cannot be registered', () => {
  const sample={...registry.listBlocks()[0]};
  assert.throws(()=>defineSpicaBlock({...sample,targets:['game-2d']}),/Unsupported SPICA target/);
  assert.throws(()=>defineSpicaBlock({...sample,permissions:['fs.root']}),/Unknown SPICA permission/);
  assert.throws(()=>defineSpicaBlock({...sample,ports:{inputs:[],outputs:[]}}),/Invalid schema-1 port/);
  assert.throws(()=>defineSpicaBlock({...sample,implementation:{kind:'program-v1-adapter',ref:'program:wrong'}}),/implementation/);
});

test('generated registry matches deterministic generator output byte-for-byte', () => {
  const result=execFileSync(process.execPath,['scripts/generate-spica-registry.cjs','--check'],{cwd:root,encoding:'utf8'});
  assert.match(result,/26 source modules/);
});
