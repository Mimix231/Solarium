import type { ToolValidationDefinition } from '../engine/intelligence/tool-validation';

/** The small-model hint is generated ONLY from the definitions actually offered
 * to this inference turn. It never grants access or executes a tool. */
export interface SpicaInvocationState {
  revision?: number | null;
  hasGraph?: boolean;
  hasV2?: boolean;
  lastInvalidTool?: string | null;
  lastInvalidDiagnostic?: string;
}

function requiredFields(tool: ToolValidationDefinition): string[] {
  return [...(tool.function.parameters.required ?? [])].filter(name =>
    Object.hasOwn(tool.function.parameters.properties, name));
}

/** Choose an example from registered tool contracts and authoritative graph
 * revision. Examples remain illustrative; actual proposed calls must pass the
 * very same offered contract and later authorization/preflight gates. */
export function spicaPreflightExample(
  registered: readonly ToolValidationDefinition[], state: SpicaInvocationState,
): {name:string;arguments:Record<string, unknown>} | null {
  const known = new Set(registered.map(tool => tool.function.name));
  if (known.has('edit_spica_graph') && state.hasGraph && state.hasV2===false &&
    typeof state.revision === 'number' && Number.isInteger(state.revision)) {
    return {name:'edit_spica_graph',arguments:{revision:state.revision,view:'v2',edits:[{op:'migrate_graph'}]}};
  }
  if (known.has('read_spica_graph') && state.hasGraph) {
    return {name:'read_spica_graph',arguments:{view:'both'}};
  }
  if (known.has('spica_next_action')) return {name:'spica_next_action',arguments:{stage:'compose'}};
  return null;
}

/** Compact, state-aware contract index: actual names and required parameters,
 * not a reprint of their potentially enormous JSON schemas. */
export function spicaOfferedToolGuide(
  offered: readonly ToolValidationDefinition[], registered: readonly ToolValidationDefinition[],
  state: SpicaInvocationState,
): string {
  if (!offered.length) return '';
  const lines = offered.slice(0,5).map(tool => `${tool.function.name}(${requiredFields(tool).join(', ') || 'no required arguments'})`);
  const preflight = offered.find(tool => tool.function.name === 'check_spica_tool_call');
  if (preflight) {
    lines.push('check_spica_tool_call MUST receive {"name":"<REGISTERED TARGET TOOL>","arguments":{...TARGET ARGUMENTS}}; name is a callable tool name, NOT a block ID, operation label, or stage.');
    const example = spicaPreflightExample(registered,state);
    if (example) {
      const exampleCall = {name:example.name,arguments:example.arguments};
      lines.push(`Example of argument SHAPE (check current task before using): ${JSON.stringify(exampleCall)}`);
    }
  }
  if (state.lastInvalidTool) {
    lines.push(`Last invalid proposal: ${state.lastInvalidTool}: ${(state.lastInvalidDiagnostic??'').slice(0,190)}. Do not resubmit the same invalid arguments; use the offered contract or a different registered prerequisite.`);
  }
  return `AVAILABLE CALLABLE TOOLS THIS TURN (only these names can execute): ${lines.join(' | ')}`.slice(0,1000);
}

export function spicaInvalidCallGuidance(
  name: string, diagnostic: string, registered: readonly ToolValidationDefinition[],
  state: SpicaInvocationState,
): string {
  const known = registered.some(tool => tool.function.name === name);
  const required = known ? requiredFields(registered.find(tool => tool.function.name===name)!) : [];
  const example = name === 'check_spica_tool_call' ? spicaPreflightExample(registered,state) : null;
  const missingName = name==='check_spica_tool_call' && /(?:check_spica_tool_call\.name|name.*is required)/i.test(diagnostic);
  return [
    known ? `Registered callable ${name}; required top-level arguments: ${required.join(', ') || 'none'}.` :
      `Unknown or unavailable callable ${name}. Use only the currently advertised tool definitions.`,
    missingName ? 'The name field is mandatory and must identify the ACTUAL registered target tool being preflighted.' : '',
    example ? `Shape example (not an automatic action): ${JSON.stringify({name:example.name,arguments:example.arguments})}.` : '',
    'No operation was executed. Do not repeat unchanged invalid arguments.',
  ].filter(Boolean).join(' ').slice(0,700);
}
