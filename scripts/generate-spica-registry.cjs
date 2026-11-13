#!/usr/bin/env node
'use strict';
/** Checked-in, deterministic, AST-parsed SPICA registry. Runtime never walks the filesystem. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); }

const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'src', 'spica', 'runtime', 'blocks');
const output = path.join(folder, 'registry.generated.ts');
const check = process.argv.includes('--check');
const knownPermissions = new Set(['records.write', 'files.open', 'files.export', 'custom.transform']);
const knownTargets = new Set(['desktop', 'web']);
const folderMap = JSON.parse(fs.readFileSync(path.join(folder, 'category-folders.json'), 'utf8'));
const legacyFixture = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'spica-phase01-legacy.json'), 'utf8'));

function fail(message) { throw new Error(`SPICA registry: ${message}`); }
function parseLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(parseLiteral);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !(
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) fail('Block metadata must be literal property assignments.');
    return [property.name.text, parseLiteral(property.initializer)];
  }));
  fail(`Dynamic block definition is forbidden (${ts.SyntaxKind[node.kind]}).`);
}
function scan(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'runtime' && dir !== folder ? [] : scan(absolute);
    if (dir === folder) return []; // Root files are infrastructure, not block definitions.
    return entry.isFile() && /\.(tsx?|mts)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) &&
      !['contracts.ts','categories.ts','registry.ts','defineBlock.ts','registry.generated.ts'].includes(entry.name)
      ? [absolute] : [];
  });
}
function parseBlock(filename) {
  const relative = path.relative(folder, filename).replaceAll(path.sep, '/');
  const parts = relative.split('/');
  if (parts.length < 3) fail(`Expected category/subcategory/file: ${relative}`);
  const categoryId = folderMap[parts[0]];
  if (!Number.isInteger(categoryId)) fail(`Unknown category folder: ${relative}`);
  const contents = fs.readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(filename, contents, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) fail(`Cannot parse ${relative}: ${source.parseDiagnostics[0].messageText}`);
  const assignments = source.statements.filter(ts.isExportAssignment);
  if (assignments.some(statement => ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text === 'defineRuntimeBlock')) {
    fail(`Misplaced V2 runtime block: ${relative}. Expected it under its category/runtime/ subfolder. ` +
      'Run npm run spica:runtime:cleanup to remove a verified old duplicate, or manually move a unique implementation.');
  }
  if (assignments.length !== 1 || !ts.isCallExpression(assignments[0].expression) ||
    !ts.isIdentifier(assignments[0].expression.expression) ||
    assignments[0].expression.expression.text !== 'defineSpicaBlock' ||
    assignments[0].expression.arguments.length !== 1) fail(`Exactly one default defineSpicaBlock({...}) required: ${relative}`);
  if (source.statements.some(statement => ts.isVariableStatement(statement) &&
      statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword))) {
    fail(`Only one exported block allowed: ${relative}`);
  }
  // Per-file canonical definitions may use common infrastructure, but never import another
  // block definition (or the graph/registry) directly. Composition uses typed dependency IDs.
  for (const statement of source.statements.filter(ts.isImportDeclaration)) {
    const imported = statement.moduleSpecifier.text;
    if (!imported.startsWith('.')) continue;
    const target = path.resolve(path.dirname(filename), imported);
    const relTarget = path.relative(folder, target).replaceAll(path.sep, '/');
    if (/(^|\/)(?:program|warehouse|registry|registry\.generated)(?:$|\.)/.test(relTarget) ||
        (relTarget && !relTarget.startsWith('..') &&
          !['defineBlock', 'contracts', 'categories'].includes(path.basename(relTarget).replace(/\.tsx?$/, '')) &&
          !['shared/', 'runtime/'].some(prefix => relTarget.startsWith(prefix)))) {
      fail(`Circular/undeclared block-module import is forbidden: ${relative} -> ${imported}`);
    }
  }
  const block = parseLiteral(assignments[0].expression.arguments[0]);
  block.sourcePath = `src/spica/runtime/blocks/${relative}`;
  if (categoryId !== block.categoryId || parts[1] !== block.subcategory) fail(`Category path/metadata mismatch: ${relative}`);
  if (!['ts', 'tsx'].some(extension => parts[2] === `${block.id.replaceAll('_', '-')}.${extension}`)) fail(`ID and filename mismatch: ${relative}`);
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(block.id) || block.version !== 1 ||
      !['screen','action'].includes(block.kind) || !['prototype','beta','stable','deprecated'].includes(block.maturity) ||
      ![block.label,block.inputs,block.outputs].every(value => typeof value === 'string' && value.trim())) {
    fail(`Incomplete block identity or schema-1 contract: ${relative}`);
  }
  if (!Array.isArray(block.targets) || !block.targets.length ||
      new Set(block.targets).size !== block.targets.length || block.targets.some(target => !knownTargets.has(target))) {
    fail(`Invalid block targets: ${relative}`);
  }
  if (!Array.isArray(block.permissions) || new Set(block.permissions).size !== block.permissions.length ||
      block.permissions.some(permission => !knownPermissions.has(permission))) fail(`Unknown block permission: ${relative}`);
  if (!block.ports || !Array.isArray(block.ports.inputs) || !Array.isArray(block.ports.outputs) ||
      block.ports.inputs[0]?.description !== block.inputs || block.ports.outputs[0]?.description !== block.outputs ||
      [...block.ports.inputs, ...block.ports.outputs].some(port => port.type !== 'legacy-descriptor' || !port.id || !port.description)) {
    fail(`Invalid legacy port contracts: ${relative}`);
  }
  if (!Array.isArray(block.tags) || !Array.isArray(block.dependencies) ||
      block.dependencies.some(dependency => !dependency.id || !dependency.version)) fail(`Invalid tags/dependencies: ${relative}`);
  if (block.implementation?.kind !== 'program-v1-adapter' || block.implementation.ref !== `program:${block.id}`) {
    fail(`Missing or incorrect program implementation locator: ${relative}`);
  }
  return block;
}
function validateLegacy(blocks) {
  const known = new Set(legacyFixture.blocks.map(block => block.id));
  for (const block of blocks) if (!known.has(block.id)) fail(`Unimplemented schema-1 adapter: ${block.id}. Extend the runtime in a later phase before registering new block IDs.`);
  const byId = new Map(blocks.map(block => [block.id, block]));
  for (const legacy of legacyFixture.blocks) {
    const current = byId.get(legacy.id);
    if (!current) fail(`Legacy block missing: ${legacy.id}`);
    for (const key of ['version', 'kind', 'label', 'inputs', 'outputs']) {
      if (current[key] !== legacy[key]) fail(`Legacy schema-1 contract changed: ${legacy.id}.${key}`);
    }
    if (current.categoryId !== legacy.categoryId || JSON.stringify(current.tags) !== JSON.stringify(legacy.tags)) {
      fail(`Legacy warehouse category/tags changed: ${legacy.id}`);
    }
    if (JSON.stringify(current.targets) !== JSON.stringify(legacy.targets) ||
        JSON.stringify(current.permissions) !== JSON.stringify(legacy.capability ? [legacy.capability] : [])) {
      fail(`Legacy targets/permissions changed: ${legacy.id}`);
    }
  }
  const entries = new Map();
  for (const block of blocks) {
    const key = `${block.id}@${block.version}`;
    if (entries.has(key)) fail(`Duplicate block ${key}: ${entries.get(key)} vs ${block.sourcePath}`);
    entries.set(key, block.sourcePath);
  }
  // Typed dependency edges must point to installed versions and form an acyclic DAG.
  const byKey = new Map(blocks.map(block => [`${block.id}@${block.version}`, block]));
  const visiting = new Set(), visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    if (visiting.has(key)) fail(`Circular block dependency at ${key}`);
    visiting.add(key);
    const block = byKey.get(key);
    for (const dependency of block.dependencies) {
      const target = `${dependency.id}@${dependency.version}`;
      if (!byKey.has(target)) fail(`Missing block dependency ${target} from ${key}`);
      visit(target);
    }
    visiting.delete(key); visited.add(key);
  }
  for (const key of byKey.keys()) visit(key);
}
function render(blocks) {
  const original = legacyFixture.blocks.map(block => block.id);
  const order = new Map(original.map((id,index) => [id,index]));
  blocks.sort((a,b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
  const metadata = JSON.stringify(blocks, null, 2);
  const folders = JSON.stringify(folderMap, null, 2);
  const loaders = blocks.map(block => {
    const modulePath = './' + block.sourcePath.slice('src/spica/runtime/blocks/'.length).replace(/\.tsx?$/, '');
    return `  ${JSON.stringify(`${block.id}@${block.version}`)}: () => import(${JSON.stringify(modulePath)}),`;
  }).join('\n');
  return `/** AUTO-GENERATED by scripts/generate-spica-registry.cjs. DO NOT EDIT.\n * npm run spica:registry updates it; npm run spica:registry:check verifies it.\n * Metadata does not import executable modules; loaders are intentionally lazy.\n */\nimport type { SpicaBlockDefinition, SpicaBlockMetadata } from './contracts';\n\nexport const generatedSpicaCategoryFolders: Readonly<Record<string, number>> = ${folders};\n\nexport const generatedSpicaBlockMetadata: readonly SpicaBlockMetadata[] = ${metadata};\n\nexport const generatedSpicaBlockLoaders: Readonly<Record<string, () => Promise<{ default: SpicaBlockDefinition }>>> = {\n${loaders}\n};\n`;
}
function main() {
  const blocks = scan(folder).map(parseBlock);
  validateLegacy(blocks);
  // Prevent generated folder indices from diverging from the 35-category catalog.
  const catalog = fs.readFileSync(path.join(root, 'src/spica/catalog/categories.ts'), 'utf8');
  const categories = catalog.match(/const titles = \[([\s\S]*?)\] as const;/)?.[1]?.match(/'[^']+'/g) ?? [];
  if (categories.length !== 35 || Object.keys(folderMap).length !== 35 ||
      new Set(Object.values(folderMap)).size !== 35 || Object.values(folderMap).some(id => id < 1 || id > 35)) {
    fail('Category map must match the 35 published catalog category IDs.');
  }
  const contents = render(blocks);
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== contents) fail('Generated registry is stale. Run npm run spica:registry.');
    console.log(`SPICA registry verified: ${blocks.length} source modules, 35 categories, deterministic metadata.`);
  } else {
    if (!fs.existsSync(output) || fs.readFileSync(output,'utf8') !== contents) fs.writeFileSync(output, contents);
    console.log(`SPICA registry generated: ${blocks.length} source modules, 35 categories.`);
  }
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { main, parseBlock, validateLegacy };
