import type { SpicaLegacyBlockContract } from './contracts';

/** Source emitter boundary: standalone schema-1 apps inline the locked block contracts.
 * They must NEVER import Solarium's internal registry/loader or depend on its app shell.
 */
export function inlineLegacyBlockRegistry(programSource: string, registry: readonly SpicaLegacyBlockContract[]): string {
  const start = 'export const blockRegistry: readonly SpicaLegacyBlockContract[] = Object.freeze(listBlocks().map(block => ({';
  const end = '\n})));';
  const offset = programSource.indexOf(start);
  const finish = offset >= 0 ? programSource.indexOf(end, offset + start.length) : -1;
  if (offset < 0 || finish < 0 || programSource.indexOf(start, offset + 1) >= 0) {
    throw Error('SPICA standalone program template is incompatible with the current registry projection.');
  }
  const replacement = `export const blockRegistry: readonly {
    id: string; version: 1; kind: 'screen' | 'action'; label: string;
    inputs: string; outputs: string; targets: readonly ('desktop' | 'web')[];
    capability?: Capability;
  }[] = ${JSON.stringify(registry, null, 2)};`;
  return programSource.slice(0, offset) + replacement + programSource.slice(finish + end.length);
}
