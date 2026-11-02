const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('all new chat rendering and document dependencies are in the package manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const dep of [
    'react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex',
    'rehype-highlight', 'highlight.js', 'katex', 'pdfjs-dist', 'mammoth',
  ]) assert.equal(typeof manifest.dependencies[dep], 'string', dep);
  for(const hook of ['predev','prebuild','precheck']) assert.match(manifest.scripts[hook], /^node scripts\/check-frontend-dependencies\.cjs(?: && |$)/, hook+' must check dependencies before starting');
});

test('PDF source uses the typed package import and matching worker asset', () => {
  const creator = fs.readFileSync(path.join(root, 'src/engine/creator.ts'), 'utf8');
  const declaration = fs.readFileSync(path.join(root, 'src/types/mammoth-browser.d.ts'), 'utf8');
  assert.match(creator, /await import\('pdfjs-dist'\)/);
  assert.match(creator, /pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url/);
  assert.match(declaration, /pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url/);
  assert.doesNotMatch(creator, /pdfjs-dist\/legacy\/build/);
});
