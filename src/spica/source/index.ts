export type * from './types';
export { SourceBlockRegistry } from './registry';
export { SourceBlockLoader, sha256Source } from './loader';
export type { SourceBlockSourceProvider } from './loader';
export { SourceBlockEmitter } from './emitter';
export { verifySourceFileBundle } from './receipts';
export type { SourceSelection } from './emitter';
export { validateSourceBlockDefinition, validateLoadedSource } from './validator';
export { builtInSourceBlocks, portableSourceBlockDefinitions } from './builtins';
export { themeTokensGenerator } from './generators';
import { SourceBlockRegistry } from './registry';
import { builtInSourceBlocks } from './builtins';
import { themeTokensGenerator } from './generators';
/** Lazy metadata registration; the registry never imports host executable adapters. */
export function createSourceBlockRegistry(): SourceBlockRegistry {
  return new SourceBlockRegistry([...builtInSourceBlocks,themeTokensGenerator]);
}
export * from './intelligence';
