import type { SpicaBlockDefinition, SpicaLegacyCapability, SpicaLegacyTarget } from './contracts';

const allowedTargets: ReadonlySet<string> = new Set<SpicaLegacyTarget>(['desktop', 'web']);
const allowedPermissions: ReadonlySet<string> = new Set<SpicaLegacyCapability>([
  'records.write', 'files.open', 'files.export', 'custom.transform',
]);

/** Validate block contracts at module load, with an additional static generator check at build time. */
export function defineSpicaBlock<T extends SpicaBlockDefinition>(definition: T): T {
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(definition.id) || definition.version !== 1) {
    throw Error(`Invalid SPICA block ID or schema-1 version: ${definition.id}@${definition.version}`);
  }
  if (!Number.isInteger(definition.categoryId) || definition.categoryId < 1 || definition.categoryId > 35 ||
      !/^[a-z][a-z0-9-]*$/.test(definition.subcategory)) {
    throw Error(`Invalid SPICA category/subcategory: ${definition.id}`);
  }
  if (!['screen', 'action'].includes(definition.kind) || !definition.label.trim() ||
      !definition.inputs.trim() || !definition.outputs.trim()) {
    throw Error(`Incomplete SPICA block contract: ${definition.id}`);
  }
  if (!definition.targets.length || new Set(definition.targets).size !== definition.targets.length ||
      definition.targets.some(target => !allowedTargets.has(target))) {
    throw Error(`Unsupported SPICA target: ${definition.id}`);
  }
  if (new Set(definition.permissions).size !== definition.permissions.length ||
      definition.permissions.some(permission => !allowedPermissions.has(permission))) {
    throw Error(`Unknown SPICA permission: ${definition.id}`);
  }
  if (definition.maturity !== 'prototype' && definition.maturity !== 'beta' &&
      definition.maturity !== 'stable' && definition.maturity !== 'deprecated') {
    throw Error(`Invalid executable block maturity: ${definition.id}`);
  }
  if (definition.implementation.kind !== 'program-v1-adapter' ||
      definition.implementation.ref !== `program:${definition.id}`) {
    throw Error(`Missing or mismatched schema-1 implementation: ${definition.id}`);
  }
  if (!definition.ports.inputs.length || !definition.ports.outputs.length ||
      [...definition.ports.inputs, ...definition.ports.outputs].some(port =>
        !port.id || port.type !== 'legacy-descriptor' || !port.description.trim()) ||
      definition.ports.inputs[0]?.description !== definition.inputs ||
      definition.ports.outputs[0]?.description !== definition.outputs) {
    throw Error(`Invalid schema-1 port descriptions: ${definition.id}`);
  }
  if (definition.dependencies.some(dependency => !dependency.id || !dependency.version)) {
    throw Error(`Invalid SPICA block dependency: ${definition.id}`);
  }
  return Object.freeze(definition);
}
