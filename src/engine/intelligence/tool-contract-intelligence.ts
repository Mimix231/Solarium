import { validateToolArguments, type ToolValidation, type ToolValidationDefinition } from './tool-validation';

/** The exact declarations sent to the model are the contracts checked at dispatch.
 * No shadow argument schemas or permissive unknown-key normalization. */
export class ToolContractRegistry {
  private readonly byName = new Map<string, ToolValidationDefinition>();
  constructor(definitions: readonly ToolValidationDefinition[]) {
    for (const definition of definitions) {
      const { name, parameters } = definition.function;
      if (this.byName.has(name)) throw Error(`Duplicate tool contract: ${name}`);
      if (!name || parameters.type !== 'object' || !parameters.properties || parameters.additionalProperties !== false)
        throw Error(`Invalid top-level tool contract: ${name}`);
      for (const field of parameters.required ?? []) {
        if (!Object.hasOwn(parameters.properties, field))
          throw Error(`Tool ${name} declares unknown required parameter ${field}`);
      }
      this.byName.set(name, definition);
    }
  }
  get(name: string): ToolValidationDefinition | undefined { return this.byName.get(name); }
  names(): string[] { return [...this.byName.keys()]; }
  inspect(name: string) {
    const item = this.get(name);
    return item ? { ok: true as const, callable: true, name, description: item.function.description,
      parameters: item.function.parameters, required: item.function.parameters.required ?? [],
      acceptedKeys: Object.keys(item.function.parameters.properties) }
      : { ok: false as const, callable: false, name, code: 'UNKNOWN_TOOL' as const,
        registeredTools: this.names() };
  }
  validate(name: string, args: unknown): ToolValidation {
    const item = this.get(name);
    return validateToolArguments(name, args, item ? [item] : []);
  }
  /** Model, inspector, preflight and dispatch must use the same schema object. */
  assertMatches(name: string, definition: ToolValidationDefinition): void {
    const source = this.get(name);
    if (!source || JSON.stringify(source.function.parameters) !== JSON.stringify(definition.function.parameters))
      throw Error(`Tool contract drift: ${name}`);
  }
}

/** Return exactly the validated contracts, in their supplied stage order. */
export class ToolSchemaProvider {
  constructor(private readonly registry: ToolContractRegistry) {}
  expose(names?: readonly string[]): ToolValidationDefinition[] {
    if (!names) return this.registry.names().map(name => this.registry.get(name)!);
    return names.map(name => {
      const tool = this.registry.get(name);
      if (!tool) throw Error(`Cannot advertise an unregistered tool: ${name}`);
      return tool;
    });
  }
}

export class ToolCallValidator {
  constructor(private readonly registry: ToolContractRegistry) {}
  check(name: string, candidate: unknown): ToolValidation {
    return this.registry.validate(name,candidate);
  }
}

/** A contract-only execution gateway; existing permission and scope checks remain
 * in runAgent/executeAgentTool. This never authorizes or invokes any operation. */
export class ToolExecutionCoordinator {
  constructor(private readonly validator: ToolCallValidator) {}
  prepare(name: string, candidate: unknown): Record<string,unknown> {
    const reviewed = this.validator.check(name,candidate);
    if (!reviewed.ok) throw Error(reviewed.error.message);
    return reviewed.value;
  }
}

export type ToolStage = 'discover'|'inspect'|'validate'|'edit'|'execute'|'export'|'verify';
export interface ToolPrerequisite { tool: string; requires: string[]; stage: ToolStage }
/** This describes relationships; it never executes calls or grants permission. */
export class ToolDependencyGraph {
  private readonly dependencies = new Map<string, ToolPrerequisite>();
  constructor(edges: readonly ToolPrerequisite[], contracts: ToolContractRegistry) {
    for (const edge of edges) {
      if (!contracts.get(edge.tool)) throw Error(`Unknown dependent tool ${edge.tool}`);
      for (const name of edge.requires) if (!contracts.get(name)) throw Error(`Unknown prerequisite ${name} for ${edge.tool}`);
      if (this.dependencies.has(edge.tool)) throw Error(`Duplicate dependency declaration ${edge.tool}`);
      this.dependencies.set(edge.tool, edge);
    }
  }
  inspect(name: string): ToolPrerequisite | null { return this.dependencies.get(name) ?? null; }
}

export interface FailureAssessment { repeated: boolean; count: number; blockedTool: string | null; guidance: string }
/** Tool outputs only count as task progress when they supply new verified evidence.
 * Repeated invalid arguments do not become productive work just because a list or
 * search call succeeded in between. No tool is retried automatically. */
export class AgentProgressTracker {
  private readonly failures = new Map<string, number>();
  private readonly reads = new Map<string,number>();
  private blocked: string | null = null;
  get suppressedTool(): string | null { return this.blocked; }
  recordFailure(tool: string, args: unknown, diagnostic: string): FailureAssessment {
    const structural = /(?:Unexpected property|is required|Expected (?:object|array|string|integer|number|boolean)|Malformed JSON)/i.test(diagnostic);
    const key = `${tool}\u0000${stableDiagnostic(diagnostic)}\u0000${structural ? '<contract-error>' : stableArguments(args)}`;
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    if (count >= 2) this.blocked = tool;
    return { repeated: count >= 2, count, blockedTool: this.blocked,
      guidance: count >= 2
        ? `Identical invalid ${tool} call has failed ${count} times. It is withheld until its contract is explicitly inspected or verified project state changes. Choose a different registered inspection or prerequisite tool. No automatic retry.`
        : `Invalid ${tool} call. Inspect its exact registered schema before proposing new arguments. No operation was performed.` };
  }
  /** Valid inspector for the failed tool changes available contract evidence. */
  recordContractInspection(target: string): void {
    if (this.blocked === target) this.blocked = null;
  }
  /** Only a confirmed edit, graph migration, execution, or real export advances source state. */
  recordStateChange(): void { this.failures.clear(); this.reads.clear(); this.blocked = null; }
  /** Exact repeated discovery is real tool activity but not verified implementation progress.
   * Do not count arbitrary distinct searches as duplicates. */
  recordRead(tool?:string, args?:unknown): {repeated:boolean;count:number;guidance:string} {
    if (!tool) return {repeated:false,count:0,guidance:''};
    const key=`${tool}\u0000${stableArguments(args)}`;
    const count=(this.reads.get(key)??0)+1;
    this.reads.set(key,count);
    if(count>=3)this.blocked=tool;
    return {repeated:count>=3,count,
      guidance:count>=3?`Repeated identical read ${tool} ${count} times with no verified change. Inspect the next prerequisite or submit a validated write. No automatic tool call was made.`:''};
  }
}

function stableDiagnostic(text: string): string {
  return text.replace(/\d{1,2}:\d{2}:\d{2}/g, '<time>').slice(0, 600);
}
function stableArguments(input: unknown): string {
  if (typeof input === 'string') {
    try { return stableArguments(JSON.parse(input)); } catch { return input.slice(0, 800); }
  }
  if (!input || typeof input !== 'object') return String(input);
  const normalized = (value: unknown, depth = 0): unknown => {
    if (depth > 12) return '<depth-limit>';
    if (Array.isArray(value)) return value.map(v => normalized(v,depth+1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,val])=>[key,normalized(val,depth+1)]));
    return value;
  };
  return JSON.stringify(normalized(input)).slice(0, 6000);
}
