/** Fail early with instructions when an update adds new frontend dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const projectDir = path.resolve(__dirname, '..');
const requireFromProject = createRequire(path.join(projectDir, 'package.json'));
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
const required = [
  'react-markdown', 'remark-gfm', 'remark-math',
  'rehype-katex', 'rehype-highlight', 'highlight.js',
  'katex', 'pdfjs-dist', 'mammoth',
];
const missing = required.filter((name) => {
  if (!packageJson.dependencies?.[name]) return true;
  // Check package presence without requiring import-only ESM packages.
  // Most installations are in node_modules; createRequire covers hoisted dependencies.
  if (fs.existsSync(path.join(projectDir, 'node_modules', name, 'package.json'))) return false;
  try { requireFromProject.resolve(name); return false; } catch { return true; }
});

if (missing.length) {
  console.error('\nSolarium is missing frontend packages: ' + missing.join(', '));
  console.error('The Creator Workspace update added packages that must be installed.');
  console.error('Run from the Solarium project folder: npm install');
  console.error('Then run: npm run build');
  console.error('If npm fails, check its error output; do not delete package-lock.json without a reason.\n');
  process.exitCode = 1;
} else {
  console.log('Creator Workspace frontend dependencies found.');
}
