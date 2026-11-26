import { createSourceBlockRegistry } from '../source';
import type { SourceBlockKind, SourceTarget } from '../source';
const registry=createSourceBlockRegistry();
/** Separate source discovery surface. It never modifies the legacy SPICA graph tool registry. */
export function listSourceCapabilities(filter: {kind?: SourceBlockKind;target?:SourceTarget}={}) {
  return registry.list(filter.kind).filter(item=>!filter.target || item.targets.includes(filter.target))
    .map(({id,version,kind,category,description,targets,provenance})=>({id,version,kind,category,description,targets,provenance}));
}
export function inspectSourceCapability(id:string,version='1.0.0') {
  const definition=registry.get(id,version);
  if (!definition) return undefined;
  // Discovery never exposes a callable source generator or executable runtime adapter.
  if (definition.kind === 'source-generator') {
    const {generate: _privateGenerator, ...publicContract}=definition;
    void _privateGenerator;
    return publicContract;
  }
  return definition;
}
