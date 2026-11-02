const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseMessageParts, groupCodeFiles, BLOCK_FORMAT_GUIDE } = require('../.test-dist/blocks/protocol.js');
const { parseDataTable, parseChart, parseCSV, toCSV } = require('../.test-dist/blocks/data.js');
const { makeDocx, suggestedFileName, exportedText } = require('../.test-dist/blocks/exports.js');
const { defaultWorkspace } = require('../.test-dist/domain/defaults.js');
const { validateWorkspace } = require('../.test-dist/domain/validation.js');
const base = path.join(__dirname, '..');
const parse = (s) => parseMessageParts(s).filter((p) => p.type === 'block').map((p) => p.block);

test('partial streaming blocks have stable IDs and only finish at closing fence', () => {
  const first = '# Files\n```typescript title="Player.tsx"\nexport function Player() {\n';
  const next = first + '  return <main>Hi</main>;\n';
  const final = next + '}\n```\nLooks good.';
  for (const piece of [first, next]) { const b = parse(piece)[0]; assert.equal(b.status, 'streaming'); assert.equal(b.title, 'Player.tsx'); }
  const b = parse(final)[0]; assert.equal(b.id, parse(first)[0].id); assert.equal(b.status, 'complete'); assert.match(b.content, /return <main>/);
  assert.equal(parseMessageParts(final).at(-1).text, '\nLooks good.');
});

test('all ten block kinds are parsed, including writing, chart, equation and preview', () => {
  const inputs = ['writing','code','table','chart','research','image','equation','terminal','file','preview'];
  for (const kind of inputs) {
    const header = kind === 'code' ? 'rust' : `solarium-${kind}`;
    const b = parse(`\`\`\`${header} title="Demo"\nvalue\n\`\`\``)[0];
    assert.equal(b.kind, kind); assert.equal(b.title, 'Demo'); assert.equal(b.provenance, 'model');
  }
  assert.match(BLOCK_FORMAT_GUIDE, /Do NOT pretend/);
});

test('adjoining fenced code creates a single file collection without losing unrelated prose', () => {
  const t = 'Files:\n```tsx title="App.tsx"\nexport default 1\n```\n\n```css title="App.css"\nbody{}\n```\nThe files are ready.';
  const result = groupCodeFiles(parseMessageParts(t));
  const group = result.find((r) => r.type === 'collection');
  assert.equal(group.blocks.length, 2);
  assert.equal(group.blocks[0].title, 'App.tsx');
  assert.match(result.at(-1).text, /The files are ready/);
});

test('CSV with quoted commas and escaped quotation marks is parsed and re-exported correctly', () => {
  const t = parseDataTable('title,note\r\n"First, chapter","He said ""hello"""\r\nTwo,Done');
  assert.deepEqual(t.columns, ['title', 'note']); assert.equal(t.rows[0][0], 'First, chapter');
  assert.equal(t.rows[0][1], 'He said "hello"');
  assert.deepEqual(parseCSV(toCSV(t)).slice(1), [['First, chapter','He said "hello"'],['Two','Done']]);
});

test('table JSON and chart JSON reject malformed or nonnumeric points', () => {
  const t = parseDataTable('[{"name":"A","score":4},{"name":"B","score":10}]');
  assert.equal(t.rows[1][1], 10);
  assert.equal(parseChart('{"type":"line","data":[{"label":"A","value":5},{"label":"bad","value":"oops"}]}').data.length, 1);
  assert.equal(parseChart('{"type":"line","data":[{"label":"bad","value":"oops"}]}'), null);
  assert.equal(parseChart('not json'), null);
});

test('suggested export names sanitize traversal and generated data is CSV', () => {
  const b = parse('```solarium-table title="../bad/file"\na,b\n1,2\n```')[0];
  assert.ok(!suggestedFileName(b).includes('/'));
  assert.match(exportedText(b), /a,b\r\n1,2/);
});

test('DOCX exporter produces a well-formed ZIP with escaped WordprocessingML', () => {
  const zipped = makeDocx('# First\nWhat <thing> & other text');
  assert.equal(zipped[0], 0x50); assert.equal(zipped[1], 0x4b);
  const buffer = Buffer.from(zipped);
  assert.ok(buffer.includes(Buffer.from('word/document.xml')));
  assert.ok(buffer.includes(Buffer.from('&lt;thing&gt; &amp; other text')));
});

test('block assets persist through workspace validation and do not mutate original conversation text', () => {
  const w = defaultWorkspace(); const s = w.sparks[0];
  w.sessions = [{ id:'chat', title:'Blocks', sparkId:s.id, modelId:null, mode:'creative', createdAt:'now', updatedAt:'now', messages:[{id:'msg',role:'assistant',content:'```solarium-writing\nOriginal\n```',createdAt:'now'}]}];
  w.assets = [{ id:'chat:msg:block-0',sessionId:'chat',messageId:'msg',blockId:'block-0',projectId:null,kind:'writing',title:'Chapter 1',language:'writing',content:'Edited chapter',createdAt:'now',updatedAt:'now'}];
  const loaded = validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.equal(loaded.assets[0].content,'Edited chapter');
  assert.match(loaded.sessions[0].messages[0].content,/Original/);
});

test('integration wiring avoids executing model-supplied scripts in preview and isolates native file write commands', () => {
  const preview = fs.readFileSync(path.join(base, 'src/blocks/LivePreview.tsx'), 'utf8');
  const previewSource = fs.readFileSync(path.join(base, 'src/blocks/preview-source.ts'), 'utf8');
  const backend = fs.readFileSync(path.join(base, 'src-tauri/src/creator.rs'), 'utf8');
  const workbench = fs.readFileSync(path.join(base, 'src/blocks/BlockWorkbench.tsx'), 'utf8');
  assert.match(preview, /sandbox="allow-scripts"/);
  assert.doesNotMatch(preview, /allow-same-origin/);
  assert.match(previewSource, /default-src 'none'/);
  assert.match(previewSource, /connect-src 'none'/);
  assert.match(backend, /create_new\(true\)/);
  assert.match(backend, /File changed on disk/);
  assert.match(workbench, /Apply reviewed change/);
  assert.match(workbench, /reviewFile/);
});

test('incremental streaming assembler survives split fences and consecutive output requests', () => {
  const { BlockStreamAssembler } = require('../.test-dist/blocks/protocol.js');
  const text = 'Here is code:\n```typescript title="Editor.tsx"\nexport function Editor() {\n  return <div>ok</div>;\n}\n```\n\n```css title="Editor.css"\nbody { color: red }\n```\nDone.';
  for (const chunkSize of [1,2,3,7,2048]) {
    const scanner = new BlockStreamAssembler();
    for (let i = 0; i < text.length; i += chunkSize) scanner.push(text.slice(i, i + chunkSize));
    assert.deepEqual(scanner.snapshot(), parseMessageParts(text));
    assert.equal(groupCodeFiles(scanner.snapshot()).find((p) => p.type === 'collection').blocks.length, 2);
  }
});

test('assembler stays open through arbitrary 2048-token boundaries and reuses a single block id', () => {
  const { BlockStreamAssembler } = require('../.test-dist/blocks/protocol.js');
  const a = new BlockStreamAssembler();
  a.push('Start\n```solarium-writing title="Chapter"\nOnce upon a time, ');
  const b = a.snapshot().find((p) => p.type === 'block').block;
  assert.equal(b.status, 'streaming');
  a.push('far away.\n');
  assert.equal(a.snapshot().find((p) => p.type === 'block').block.id, b.id);
  a.push('```');
  const c = a.snapshot().find((p) => p.type === 'block').block;
  assert.equal(c.status, 'complete'); assert.match(c.content, /far away/);
});

test('native project checks follow composer mode and only allow fixed commands', () => {
  const rust = fs.readFileSync(path.join(base,'src-tauri/src/creator.rs'),'utf8');
  const runtime = fs.readFileSync(path.join(base,'src/engine/agent.ts'),'utf8');
  const tools = fs.readFileSync(path.join(base,'src/engine/tools.ts'),'utf8');
  assert.match(rust, /"npm_check" =>/);
  assert.match(rust, /"npm_test" =>/);
  assert.match(rust, /"cargo_check" =>/);
  assert.match(rust, /Unsupported check/);
  assert.match(rust, /Duration::from_secs\(180\)/);
  assert.match(runtime, /await authorize\(call\.function\.name, args\)/);
  assert.match(tools, /runProjectCommand\(project.folder,commandId,/);
  const commands=fs.readFileSync(path.join(base,'src-tauri/src/project_commands.rs'),'utf8');
  assert.match(commands,/Command is not declared by this project's current manifests/);
  assert.match(commands,/catalogue\(&base\)/);
});

test('writing document export supports DOCX and HTML without inserting remote resources', () => {
  const source=fs.readFileSync(path.join(base,'src/blocks/exports.ts'),'utf8');
  assert.match(source, /exportDocx/);
  assert.match(source, /renderDocumentHtml\(markdown\)/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /allow-same-origin allow-modals/);
});

test('HTML writing export escapes hostile model text and preserves basic formatting', () => {
  const { renderDocumentHtml } = require('../.test-dist/blocks/exports.js');
  const html = renderDocumentHtml('# Chapter One\nHello **world** <script>alert(1)</script>\n- Item');
  assert.match(html, /<h1>Chapter One<\/h1>/);
  assert.match(html, /<strong>world<\/strong>/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /<li>Item<\/li>/);
});
