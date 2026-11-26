import type {
  GeneratedSourceFile,
  SourceBlockDefinition,
  SourceFileBundle,
  SourceGeneratorBlock,
  SourceTarget,
} from './types';
import { SourceBlockLoader, sha256Source } from './loader';
import { SourceBlockRegistry } from './registry';
import {
  assertSourcePath,
  collectNamedSourceImports,
  collectSourceImports,
  validateGeneratorConfig,
  validateLoadedSource,
} from './validator';

const MAX_SELECTIONS = 128;
const MAX_FILES = 256;
const MAX_FILE_BYTES = 1_000_000;
const MAX_BUNDLE_BYTES = 8_000_000;

export interface SourceSelection {
  readonly id: string;
  readonly version?: string;
  readonly config?: Readonly<Record<string, unknown>>;
}

interface SelectedSource {
  readonly definition: SourceBlockDefinition;
  readonly config: Readonly<Record<string, unknown>> | undefined;
}

interface OwnedSourceFile {
  readonly file: GeneratedSourceFile;
  readonly definition: SourceBlockDefinition;
}

function sourceKey(id: string, version: string): string {
  return `${id}@${version}`;
}

function resolveImportPath(sourceFilePath: string, importPath: string): string {
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    throw Error(`External source import is not declared: ${importPath}`);
  }

  const pathSegments = sourceFilePath.split('/').slice(0, -1);
  for (const segment of importPath.split('/')) {
    if (segment === '.') continue;
    if (segment === '..') {
      if (!pathSegments.length) throw Error(`Source import escapes output: ${importPath}`);
      pathSegments.pop();
    } else {
      pathSegments.push(segment);
    }
  }
  const resolvedPath = pathSegments.join('/');
  return resolvedPath.endsWith('.ts') ? resolvedPath : `${resolvedPath}.ts`;
}

/**
 * Phase 02 emission only returns a verified, immutable source snapshot.
 * The Phase 05 project writer must independently authorize writes and verify
 * the SHA-256 receipt against the bytes committed to disk.
 */
export class SourceBlockEmitter {
  constructor(
    private readonly registry: SourceBlockRegistry,
    private readonly loader: SourceBlockLoader,
  ) {}

  private select(
    selections: readonly SourceSelection[],
    target: SourceTarget,
  ): Map<string, SelectedSource> {
    if (!Array.isArray(selections) || selections.length < 1 || selections.length > MAX_SELECTIONS) {
      throw Error(`Select 1–${MAX_SELECTIONS} source capabilities`);
    }
    const selected = new Map<string, SelectedSource>();

    for (const selection of selections) {
      if (!selection || typeof selection.id !== 'string') throw Error('Invalid source selection');
      const version = selection.version ?? '1.0.0';
      const key = sourceKey(selection.id, version);
      if (selected.has(key)) throw Error(`Duplicate source selection: ${key}`);

      const definition = this.registry.get(selection.id, version);
      if (!definition) throw Error(`Unknown source capability: ${key}`);
      if (definition.kind !== 'portable-source' && definition.kind !== 'source-generator') {
        throw Error(`Non-executable source capability: ${key}`);
      }
      if (!definition.targets.includes(target)) throw Error(`Unsupported target ${target}: ${key}`);
      selected.set(key, { definition, config: selection.config });
    }

    for (const { definition } of selected.values()) {
      if (definition.kind !== 'portable-source' && definition.kind !== 'source-generator') continue;
      for (const requirement of definition.requires) {
        const dependency = selected.get(sourceKey(requirement.id, requirement.version))?.definition;
        if (!dependency || (dependency.kind !== 'portable-source' && dependency.kind !== 'source-generator') ||
            !dependency.exports.some(item => item.name === requirement.symbol)) {
          throw Error(`Missing source dependency ${requirement.id}@${requirement.version}:${requirement.symbol} required by ${definition.id}`);
        }
      }
    }
    return selected;
  }

  private async generate(selected: SelectedSource, target: SourceTarget): Promise<readonly GeneratedSourceFile[]> {
    const { definition, config } = selected;
    if (definition.kind === 'portable-source') {
      if (config && Object.keys(config).length) {
        throw Error(`Portable block ${definition.id}@${definition.version} has no generator parameters`);
      }
      const loaded = await this.loader.load(definition.id, definition.version, target);
      return [{ path: definition.outputPath, source: loaded.source }];
    }
    if (definition.kind !== 'source-generator') throw Error(`Non-executable source block ${definition.id}`);

    validateGeneratorConfig(definition, config ?? {});
    const generated = definition.generate(config ?? {});
    if (!Array.isArray(generated) || !generated.length) {
      throw Error(`Generator emitted no source files: ${definition.id}@${definition.version}`);
    }
    if (generated.length > MAX_FILES) throw Error(`Generator exceeded file count: ${definition.id}`);
    return generated;
  }

  private validateImports(files: readonly OwnedSourceFile[]): void {
    const byPath = new Map(files.map(({ file, definition }) => [
      file.path.toLowerCase(), { file, definition },
    ]));

    for (const { file, definition: owner } of files) {
      const namedImports = collectNamedSourceImports(file.source);
      for (const importPath of collectSourceImports(file.source)) {
        const resolvedPath = resolveImportPath(file.path, importPath);
        const dependency = byPath.get(resolvedPath.toLowerCase());
        if (!dependency) throw Error(`Unresolved source import ${importPath} from ${file.path}`);
        if (dependency.file.path !== resolvedPath) {
          throw Error(`Source import casing differs from emitted path: ${importPath} from ${file.path}`);
        }
        if (dependency.definition.id === owner.id && dependency.definition.version === owner.version) continue;
        if (owner.kind !== 'portable-source' && owner.kind !== 'source-generator') {
          throw Error(`Undeclared source import ${importPath} from ${owner.id}`);
        }
        const required = owner.requires.filter(item =>
          item.id === dependency.definition.id && item.version === dependency.definition.version);
        if (!required.length) throw Error(`Undeclared source import ${importPath} from ${owner.id}`);

        const importedSymbols = namedImports.filter(item => item.path === importPath)
          .flatMap(item => item.symbols);
        if (!importedSymbols.length) {
          throw Error(`Unsupported source import syntax from ${file.path}: ${importPath}`);
        }
        for (const symbol of importedSymbols) {
          if (!required.some(item => item.symbol === symbol)) {
            throw Error(`Undeclared imported symbol ${symbol} from ${importPath} in ${owner.id}`);
          }
        }
      }
    }
  }

  async emit(selections: readonly SourceSelection[], target: SourceTarget): Promise<SourceFileBundle> {
    const selected = this.select(selections, target);
    const files: OwnedSourceFile[] = [];
    const seenPaths = new Set<string>();
    let totalBytes = 0;
    const encoder = new TextEncoder();

    for (const { definition, config } of selected.values()) {
      const generated = await this.generate({ definition, config }, target);
      for (const file of generated) {
        if (!file || typeof file.path !== 'string' || typeof file.source !== 'string') {
          throw Error(`Invalid generated source file for ${definition.id}`);
        }
        assertSourcePath(file.path);
        const key = file.path.toLowerCase();
        const bytes = encoder.encode(file.source).byteLength;
        totalBytes += bytes;
        if (seenPaths.has(key) || !file.source.trim() || bytes > MAX_FILE_BYTES ||
            totalBytes > MAX_BUNDLE_BYTES || files.length >= MAX_FILES) {
          throw Error(`Duplicate, empty or oversized emitted file: ${file.path}`);
        }
        seenPaths.add(key);
        files.push({ file: { path: file.path, source: file.source }, definition });
      }
      if (definition.kind === 'source-generator') {
        // Validate the contract only after safe paths and collisions are established.
        const source = generated.map(file => file.source).join('\n');
        validateLoadedSource(definition as SourceGeneratorBlock, source);
      }
    }

    this.validateImports(files);
    const receipts = await Promise.all(files.map(async ({ file, definition }) => Object.freeze({
      path: file.path,
      sha256: await sha256Source(file.source),
      sizeBytes: encoder.encode(file.source).byteLength,
      owner: Object.freeze({ id: definition.id, version: definition.version }),
    })));

    return Object.freeze({
      files: Object.freeze(files.map(({ file }) => Object.freeze(file))),
      receipts: Object.freeze(receipts),
      blocks: Object.freeze([...selected.values()].map(({ definition }) => Object.freeze({
        id: definition.id, version: definition.version, provenance: definition.provenance,
      }))),
    });
  }
}
