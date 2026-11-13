import type { SpicaBlockAdapter, SpicaRuntimePermission, SpicaRuntimeTarget } from './adapter';

export class SpicaRuntimePermissionError extends Error {
  readonly code = 'SPICA_PERMISSION_DENIED';
  constructor(message: string) { super(message); this.name = 'SpicaRuntimePermissionError'; }
}
export interface SpicaRuntimeGrantBroker {
  /** The outer Ask/Auto/YOLO project tool gate and this inner host broker are independent. */
  authorize(permission: SpicaRuntimePermission, blockId: string): boolean;
}
export function checkRuntimeBlockPermission(adapter: SpicaBlockAdapter, target: SpicaRuntimeTarget,
  grants: ReadonlySet<SpicaRuntimePermission>, broker?: SpicaRuntimeGrantBroker): void {
  if (adapter.trust !== 'built-in') throw new SpicaRuntimePermissionError('Untrusted/community blocks cannot execute in the in-process runtime.');
  if (!adapter.targets.includes(target)) throw new SpicaRuntimePermissionError(`Block ${adapter.id} does not support ${target}.`);
  for (const permission of adapter.permissions) {
    if (!grants.has(permission) || (broker && !broker.authorize(permission, adapter.id))) {
      throw new SpicaRuntimePermissionError(`${adapter.id} requires approved ${permission} permission; execution denied.`);
    }
  }
}
