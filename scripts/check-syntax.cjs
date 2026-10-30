const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); }
let count = 0;
const errors = [];
function traverse(folder) {
  for (const name of fs.readdirSync(folder)) {
    const full = path.join(folder, name);
    if (fs.statSync(full).isDirectory()) traverse(full);
    else if (/\.tsx?$/.test(name)) {
      const source = ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      for (const diagnostic of source.parseDiagnostics) {
        const location = source.getLineAndCharacterOfPosition(diagnostic.start || 0);
        errors.push(`${full}:${location.line + 1}:${location.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
      }
      count++;
    }
  }
}
traverse(path.join(__dirname, '..', 'src'));
traverse(path.join(__dirname, '..', 'src-tauri', 'src'));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Parsed ${count} source files without TypeScript/TSX syntax errors.`);
