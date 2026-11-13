import type { SpicaValueType } from '../graph-v2/types';

const safeObject = (value: unknown): value is Record<string,unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Verify actual runtime outputs, not only the port signatures in the authoring graph. */
export function spicaRuntimeValueMatches(value: unknown, type: SpicaValueType, depth = 0): boolean {
  if (depth > 12) return false;
  switch (type.kind) {
    case 'unknown': return value !== undefined && (value === null || ['string','number','boolean','object'].includes(typeof value));
    case 'void': return value === undefined;
    case 'null': return value === null;
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'ui': return safeObject(value) && typeof value.renderer === 'string' && value.renderer.length <= 120;
    case 'reference': return safeObject(value) && value.collection === type.collection && typeof value.key === 'string';
    case 'capability': return safeObject(value) && value.permission === type.permission && value.granted === true;
    case 'event': return spicaRuntimeValueMatches(value, type.payload, depth + 1);
    case 'async': return spicaRuntimeValueMatches(value, type.result, depth + 1);
    case 'array': return Array.isArray(value) && value.length <= 10000 && value.every(v => spicaRuntimeValueMatches(v, type.element, depth + 1));
    case 'union': return type.options.some(item => spicaRuntimeValueMatches(value, item, depth + 1));
    case 'record': return safeObject(value) && Object.entries(type.fields).every(([key,member]) =>
      Object.hasOwn(value,key) && spicaRuntimeValueMatches(value[key],member,depth+1)) &&
      (type.open === true || Object.keys(value).every(key => Object.hasOwn(type.fields,key)));
  }
}

export function spicaRuntimeClone<T>(value: T): T {
  const encoded = JSON.stringify(value);
  if (encoded === undefined || encoded.length > 128_000) throw Error('Block result exceeds 128 KB or contains unsupported values.');
  const clone: T = JSON.parse(encoded);
  return clone;
}
