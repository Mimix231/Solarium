#!/usr/bin/env node
'use strict';
/**
 * Remove verified obsolete V2 block files left when an older Solarium archive
 * was extracted in place. Older layouts placed V2 blocks directly under
 * <category>/ or <category>/<family>/; the canonical layout is now
 * <category>/runtime/<family>/.
 *
 * Never delete by filename alone: match the immutable block ID and compare the
 * parsed executable statements plus resolved import targets with the canonical
 * implementation. Validate every candidate before removing any files.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); }

const root = path.resolve(__dirname, '..');
const blocksRoot = path.join(root, 'src/spica/runtime/blocks');
const checkOnly = process.argv.includes('--check');
const rel = file => path.relative(root, file).replaceAll(path.sep, '/');
function fail(message) { throw new Error(`SPICA stale runtime cleanup: ${message}`); }
function parse(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest,
    true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) fail(`Cannot parse ${rel(file)}: ${source.parseDiagnostics[0].messageText}`);
  return source;
}
function runtimeId(source, filename) {
  const assignments = source.statements.filter(statement => ts.isExportAssignment(statement) &&
    !statement.isExportEquals && ts.isCallExpression(statement.expression) &&
    ts.isIdentifier(statement.expression.expression) &&
    statement.expression.expression.text === 'defineRuntimeBlock');
  if (!assignments.length) return null;
  if (assignments.length !== 1 || !ts.isObjectLiteralExpression(assignments[0].expression.arguments[0])) {
    fail(`Invalid V2 block definition at ${rel(filename)}; no files were removed.`);
  }
  const id = assignments[0].expression.arguments[0].properties.find(property =>
    ts.isPropertyAssignment(property) &&
    ((ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'id'));
  if (!id || !ts.isStringLiteral(id.initializer) || !/^spica\.runtime\.[a-z][a-z0-9_]*$/.test(id.initializer.text)) {
    fail(`Missing static V2 block ID at ${rel(filename)}; no files were removed.`);
  }
  return id.initializer.text;
}
function semanticSignature(file, source) {
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const imports = [];
  const statements = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!ts.isStringLiteral(statement.moduleSpecifier)) fail(`Dynamic import in ${rel(file)}`);
      const specifier = statement.moduleSpecifier.text;
      const target = specifier.startsWith('.')
        ? path.resolve(path.dirname(file), specifier)
        : `package:${specifier}`;
      imports.push({ target, clause: statement.importClause?.getText(source) ?? '' });
    } else {
      statements.push(printer.printNode(ts.EmitHint.Unspecified, statement, source));
    }
  }
  return JSON.stringify({ imports, statements });
}
function filesUnder(dir) {
  const result = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) fail(`Symbolic links cannot be processed: ${rel(full)}`);
    if (item.isDirectory()) result.push(...filesUnder(full));
    else if (item.isFile() && /\.tsx?$/.test(item.name) && !/\.test\.tsx?$/.test(item.name)) result.push(full);
  }
  return result;
}
function pruneEmpty(folder, stop) {
  while (folder !== stop && folder.startsWith(stop + path.sep) && fs.readdirSync(folder).length === 0) {
    fs.rmdirSync(folder);
    folder = path.dirname(folder);
  }
}
function main() {
  if (!fs.existsSync(blocksRoot)) fail(`Missing canonical block root ${rel(blocksRoot)}`);
  const categories = fs.readdirSync(blocksRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => path.join(blocksRoot, entry.name));
  const canonicalById = new Map();
  for (const categoryRoot of categories) {
    const runtimeRoot = path.join(categoryRoot, 'runtime');
    if (!fs.existsSync(runtimeRoot)) continue;
    for (const filename of filesUnder(runtimeRoot)) {
      const source = parse(filename);
      const id = runtimeId(source, filename);
      if (!id) fail(`Unexpected non-runtime source in canonical V2 folder: ${rel(filename)}`);
      if (canonicalById.has(id)) fail(`Duplicate canonical block ID ${id}; no files were removed.`);
      canonicalById.set(id, { filename, signature: semanticSignature(filename, source) });
    }
  }
  const stale = [];
  for (const categoryRoot of categories) {
    for (const entry of fs.readdirSync(categoryRoot, { withFileTypes: true })) {
      if (entry.name === 'runtime') continue;
      const filename = path.join(categoryRoot, entry.name);
      if (entry.isSymbolicLink()) fail(`Symbolic links cannot be processed: ${rel(filename)}`);
      // Both direct category files (old data-records/save-note.ts) and nested
      // category families (old ui/components/ui-button.ts) must be examined.
      const candidates = entry.isDirectory() ? filesUnder(filename)
        : entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
          ? [filename] : [];
      for (const candidate of candidates) {
        const source = parse(candidate);
        const id = runtimeId(source, candidate);
        if (!id) continue; // Keep schema-1 blocks and legitimate support files.
        const canonical = canonicalById.get(id);
        if (!canonical) fail(
          `Unregistered V2 block ${id} at ${rel(candidate)}; no canonical implementation exists. ` +
          'Preserved the source; move or register it explicitly. No files were removed.');
        if (semanticSignature(candidate, source) !== canonical.signature) fail(
          `Divergent V2 block ${id} at ${rel(candidate)} versus ${rel(canonical.filename)}. ` +
          'Preserved both sources for manual review. No files were removed.');
        stale.push({ filename: candidate, categoryRoot });
      }
    }
  }
  if (checkOnly && stale.length) fail(
    `${stale.length} verified old runtime copies remain, including ${rel(stale[0].filename)}. ` +
    'Run npm run spica:runtime:cleanup to remove only matching duplicates.');
  for (const { filename, categoryRoot } of stale) {
    fs.unlinkSync(filename);
    pruneEmpty(path.dirname(filename), categoryRoot);
    console.log(`Removed verified duplicate: ${rel(filename)}`);
  }
  console.log(`SPICA stale runtime cleanup verified: ${stale.length} old runtime copies ${checkOnly ? 'detected' : 'removed'}.`);
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
