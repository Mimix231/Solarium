const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..');
const { describePreviewSource, createPreviewDocument, composeWebPreview } = require('../.test-dist/blocks/preview-source.js');
const { documentHeadings, documentWordCount } = require('../.test-dist/blocks/document.js');
const { buildSearchIntent, rankResearchResults } = require('../.test-dist/engine/search-intent.js');
const { INLINE_FORMAT_KINDS, EDITABLE_BLOCK_KINDS, BLOCK_FORMAT_GUIDE } = require('../.test-dist/blocks/protocol.js');

test('plain CSS gets a useful preview sample instead of a blank iframe', () => {
  const value = describePreviewSource('body { background: tomato; }');
  assert.equal(value.kind, 'css'); assert.match(value.html, /Sample button/);
  assert.equal(describePreviewSource('<style>button {color: red}</style>').kind, 'css');
});
test('HTML + script preview supports interactivity only in opaque-origin network-disabled iframe', () => {
  const source = describePreviewSource('<button id="go">Run</button><script>document.getElementById("go").onclick=()=>alert("clicked")</script>');
  assert.equal(source.kind,'html');
  const doc = createPreviewDocument(source,'nonce-test');
  assert.match(doc, /default-src 'none'/);
  assert.match(doc, /connect-src 'none'/);
  assert.match(doc, /script-src 'unsafe-inline'/);
  assert.match(doc, /nonce-test/);
  const frame = fs.readFileSync(path.join(base,'src/blocks/LivePreview.tsx'),'utf8');
  assert.match(frame,/sandbox="allow-scripts"/);
  assert.doesNotMatch(frame, /allow-same-origin/);
  assert.match(frame,/event.source !== frame.current\?\.contentWindow/);
});
test('React/TSX and plain English preview content show an actionable error', () => {
  assert.equal(describePreviewSource('import React from "react"; export default function App(){return <div/>}').kind,'unsupported');
  assert.match(describePreviewSource('Plain text no HTML').description,/No runnable HTML/);
  assert.equal(describePreviewSource('<div',false).kind,'incomplete');
});
test('multiple HTML CSS JS files compose into one isolated preview', () => {
  const result = composeWebPreview([{language:'html',content:'<h1>Hello</h1>'},{language:'css',content:'h1 { color: red; }'},{language:'js',content:'document.body.dataset.ready="yes"'}]);
  assert.match(result,/<h1>Hello<\/h1>/);
  assert.match(result,/<style>h1/);
  assert.match(result,/<script>document/);
});
test('presentational elements use inline formatting, not block toolbars', () => {
  for (const kind of ['table','chart','equation','image','research']) assert.ok(INLINE_FORMAT_KINDS.has(kind));
  for (const kind of ['writing','code','preview']) assert.ok(EDITABLE_BLOCK_KINDS.has(kind));
  assert.match(BLOCK_FORMAT_GUIDE,/ordinary Markdown tables/);
  assert.doesNotMatch(BLOCK_FORMAT_GUIDE,/solarium-table/);
  const view = fs.readFileSync(path.join(base,'src/components/RichMessage.tsx'),'utf8');
  assert.match(view,/INLINE_FORMAT_KINDS\.has/);
});
test('writing document outlines and word counts are deterministic', () => {
  const input = '# Chapter One\nOnce upon a time\n## The forest\nTwo words';
  assert.deepEqual(documentHeadings(input),[{line:1,level:1,label:'Chapter One'},{line:3,level:2,label:'The forest'}]);
  assert.equal(documentWordCount(' one  two\nthree '),3);
});
test('glass UI research refuses generic software download results', () => {
  const intent=buildSearchIntent('Build a liquid glass translucent CSS UI with animated gradients');
  assert.equal(intent.topic,'interface');
  const selected=rankResearchResults([
    {title:'Software - Wikipedia',url:'https://en.wikipedia.org/wiki/Software',excerpt:'General software article'},
    {title:'Free Software Download',url:'https://example.com/download',excerpt:'Install the best free software download'},
    {title:'CSS backdrop-filter for translucent glass interface',url:'https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter',excerpt:'CSS blur and backdrop filter implementation'},
  ],intent);
  assert.equal(selected.length,1);
  assert.match(selected[0].title,/backdrop-filter/);
});
