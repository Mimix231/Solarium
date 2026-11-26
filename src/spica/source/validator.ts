import type { SourceBlockDefinition, PortableSourceBlock, SourceGeneratorBlock, SourceSymbol } from './types';

const BLOCK_ID = /^source\.[a-z][a-z0-9-]*$/;
const VERSION = /^[1-9]\d*\.\d+\.\d+$/;
const SYMBOL = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SHA = /^[0-9a-f]{64}$/;
const TARGETS = new Set(['typescript-web','typescript-desktop']);
const BAD_PARTS = new Set(['.','..','__proto__','constructor','prototype']);
const RESERVED_WINDOWS_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const EXPORT_KINDS = new Set(['function', 'type', 'interface', 'value']);
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;


/** All authored paths are scoped, relative and contain no ambiguous or absolute components. */
export function assertSourcePath(path: string): void {
  if (typeof path !== 'string' || !path || path.length > 240 || path.includes('\\') || path.startsWith('/') ||
      /^[A-Za-z]:/.test(path) || !path.endsWith('.ts') || path.split('/').some(s=> !s || BAD_PARTS.has(s) || RESERVED_WINDOWS_NAMES.test(s) || !/^[A-Za-z0-9._-]+$/.test(s))) {
    throw Error(`Unsafe source file path: ${String(path)}`);
  }
}
function checkSymbols(symbols: readonly SourceSymbol[], id: string): void {
  if (!Array.isArray(symbols) || !symbols.length || symbols.some(s=>!s || !SYMBOL.test(s.name) || !EXPORT_KINDS.has(s.kind)) || new Set(symbols.map(s=>s.name)).size !== symbols.length) {
    throw Error(`Invalid source exports for ${id}`);
  }
}
function checkDependencies(definition: PortableSourceBlock | SourceGeneratorBlock): void {
  const keys = new Set<string>();
  for (const dependency of definition.requires) {
    if (!dependency || !BLOCK_ID.test(dependency.id) || !VERSION.test(dependency.version) || !SYMBOL.test(dependency.symbol)) throw Error(`Invalid source requirement for ${definition.id}`);
    const key = `${dependency.id}@${dependency.version}:${dependency.symbol}`;
    if (keys.has(key) || dependency.id === definition.id) throw Error(`Duplicate or self dependency: ${definition.id}`);
    keys.add(key);
  }
}
export function validateSourceBlockDefinition(definition: SourceBlockDefinition): void {
  if (!BLOCK_ID.test(definition.id) || !VERSION.test(definition.version) || !definition.description.trim() ||
    !/^[a-z][a-z0-9-]*$/.test(definition.category) || definition.language !== 'typescript' ||
    !definition.targets.length || definition.targets.some(t=>!TARGETS.has(t)) ||
    new Set(definition.targets).size !== definition.targets.length || !definition.provenance ||
    !['runtime-adaptation','new-implementation','documentation'].includes(definition.provenance.kind)) {
    throw Error(`Invalid source block manifest: ${definition.id}`);
  }
  if (definition.provenance.sourcePath) assertSourcePath(definition.provenance.sourcePath);
  if (definition.kind === 'portable-source') {
    assertSourcePath(definition.sourcePath);assertSourcePath(definition.outputPath);
    if (!SHA.test(definition.sha256) || !definition.exports.length || !definition.validation.tests.length ||
      definition.validation.compilation !== 'typescript-strict') throw Error(`Unverified source contract: ${definition.id}`);
    checkSymbols(definition.exports,definition.id);checkDependencies(definition);
  } else if (definition.kind === 'source-generator') {
    if (!definition.validation.tests.length || definition.validation.compilation !== 'typescript-strict' ||
      typeof definition.generate !== 'function' || !definition.configSchema ||
      !Array.isArray(definition.configSchema.allowed) || !Array.isArray(definition.configSchema.required) ||
      definition.configSchema.allowed.some(name=>!IDENTIFIER.test(name) || BAD_PARTS.has(name)) ||
      new Set(definition.configSchema.allowed).size !== definition.configSchema.allowed.length ||
      new Set(definition.configSchema.required).size !== definition.configSchema.required.length ||
      definition.configSchema.required.some(name=>!definition.configSchema.allowed.includes(name))) throw Error(`Invalid source generator: ${definition.id}`);
    checkSymbols(definition.exports,definition.id);checkDependencies(definition);
  } else if (definition.kind === 'host-runtime') {
    if (!/^spica\.runtime\.[a-z][a-z0-9_]*$/.test(definition.runtimeId) || !definition.reason.trim()) throw Error(`Invalid host-only block: ${definition.id}`);
  } else if (definition.kind === 'knowledge-descriptor') {
    if (!definition.notes.trim()) throw Error(`Invalid knowledge descriptor: ${definition.id}`);
  } else {
    throw Error(`Unknown source block kind: ${(definition as {kind:string}).kind}`);
  }
}
/** Lightweight lexical preflight that masks comments and replaces string literals
 * with opaque tokens. It avoids false exports/imports inside quoted source text.
 * Strict `tsc` validation remains the authority; this is not a full TypeScript AST. */
function lexSource(source: string): { text: string; literals: readonly string[] } {
  const literals: string[] = [];
  let text = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index++;
      text += '\n';
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++;
      index++;
      text += ' ';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      const quote = character;
      let literal = '';
      index++;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\' && source[index + 1] !== undefined) {
          literal += (source[index] ?? '') + (source[index + 1] ?? '');
          index += 2;
        } else {
          literal += source[index];
          index++;
        }
      }
      const token = `__SOLARIUM_STRING_${literals.length}__`;
      literals.push(literal);
      text += `"${token}"`;
      continue;
    }
    text += character;
  }
  return { text, literals };
}

function importLiteral(token: string, literals: readonly string[]): string {
  const match = /^__SOLARIUM_STRING_(\d+)__$/.exec(token);
  const index = match ? Number(match[1]) : NaN;
  const value = literals[index];
  if (typeof value !== 'string') throw Error('Unrecognized source import literal');
  return value;
}

/** Source discovery and TypeScript compilation are separate. These guards detect transport errors early. */
export function validateLoadedSource(definition: PortableSourceBlock | SourceGeneratorBlock, source: string): void {
  const maxSourceLength = definition.kind === 'source-generator' ? 8_000_000 : 1_000_000;
  if (typeof source !== 'string' || !source.trim() || source.length > maxSourceLength ||
      /\b(?:require\s*\(|import\s*\(|eval\s*\()/.test(lexSource(source).text) ||
      collectSourceImports(source).some(path=>/^(?:node:|fs(?:\/|$)|child_process(?:\/|$))/.test(path))) {
    throw Error(`Source is missing or contains unsupported host-only imports: ${definition.id}`);
  }
  const declarationText = lexSource(source).text;
  for (const symbol of definition.exports) {
    const escaped = symbol.name.replace(/[$]/g,'\\$&');
    const declarationKind = symbol.kind === 'value' ? '(?:const|let)' : symbol.kind;
    const declaration = new RegExp(`\\bexport\\s+(?:(?:declare|async)\\s+)*${declarationKind}\\s+${escaped}\\b`);
    if (!declaration.test(declarationText)) throw Error(`Missing exported ${symbol.kind} ${symbol.name} for ${definition.id}`);
  }
  // A textual guard is not a compiler. Strict TypeScript compilation remains mandatory.
}

/** Source modules are deliberately self-contained. Every static import must resolve to
 * another selected, declared source-block dependency. Bare packages and dynamic imports
 * are not supported until a separately authorized package-dependency contract exists. */
export function collectSourceImports(source: string): readonly string[] {
  const lexed = lexSource(source);
  if (/\b(?:import|require)\s*\(/.test(lexed.text)) {
    throw Error('Dynamic imports and require calls are not allowed in source blocks');
  }
  const matches: string[] = [];
  const pattern = /\b(?:import|export)\s+(?:(?:type\s+)?[^;'"`]*?\s+from\s*)?["'](__SOLARIUM_STRING_\d+__)["']/g;
  for (const match of lexed.text.matchAll(pattern)) {
    if (match[1]) matches.push(importLiteral(match[1], lexed.literals));
  }
  return matches;
}

/** Named imports are the only cross-block imports supported in Phase 02.
 * A dependency must declare each referenced public symbol, not just its module ID. */
export function collectNamedSourceImports(source: string): readonly {path: string; symbols: readonly string[]}[] {
  const lexed = lexSource(source);
  const result: {path: string; symbols: string[]}[] = [];
  const pattern = /\b(?:import|export)\s+(?:type\s+)?\{([^}]+)\}\s+from\s*["'](__SOLARIUM_STRING_\d+__)["']/g;
  for (const match of lexed.text.matchAll(pattern)) {
    if (!match[1] || !match[2]) continue;
    const path = importLiteral(match[2], lexed.literals);
    const symbols = match[1].split(',').map(item=>(item.trim().split(/\s+as\s+/)[0] ?? '').trim());
    if (symbols.some(symbol=>!SYMBOL.test(symbol))) throw Error(`Invalid named source import from ${path}`);
    result.push({path,symbols});
  }
  return result;
}

export function validateGeneratorConfig(definition: SourceGeneratorBlock, config: Readonly<Record<string,unknown>>): void {
  if (!config || Array.isArray(config) || typeof config !== 'object') throw Error(`Invalid generator config: ${definition.id}`);
  for (const key of Object.keys(config)) {
    if (!definition.configSchema.allowed.includes(key)) throw Error(`Unknown generator config key ${key} for ${definition.id}`);
  }
  for (const key of definition.configSchema.required) {
    if (!Object.hasOwn(config,key)) throw Error(`Missing generator config key ${key} for ${definition.id}`);
  }
}
