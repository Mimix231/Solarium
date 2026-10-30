/** Strict diagram-data parser. This does NOT execute Mermaid or inject generated HTML. */
export interface WorkflowNode { id: string; label: string }
export interface WorkflowEdge { from: string; to: string; label?: string }
export interface WorkflowDiagram { direction: 'LR'|'TB'; nodes: WorkflowNode[]; edges: WorkflowEdge[] }
export function parseWorkflow(source: string): WorkflowDiagram | null {
  if (source.length > 8000) return null;
  const lines = source.trim().split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('%%'));
  const first = /^(?:flowchart|graph)\s+(LR|TB|TD)\s*;?$/i.exec(lines.shift() ?? '');
  if (!first) return null;
  const nodes = new Map<string,string>();
  const edges: WorkflowEdge[] = [];
  const parseNode = (value: string): string | null => {
    const match = /^(\w{1,35})(?:\[([^\]\n]{1,120})\]|\(([^)\n]{1,120})\)|\{([^}\n]{1,120})\})?$/.exec(value.trim());
    if (!match) return null;
    const id = match[1]!;
    nodes.set(id, (match[2] ?? match[3] ?? match[4] ?? nodes.get(id) ?? id).replace(/^['"]|['"]$/g, ''));
    return id;
  };
  for (const line of lines) {
    if (line.length > 600 || edges.length >= 32 || nodes.size >= 36) break;
    const chunks = line.split(/\s*(?:-->|==>)\s*/);
    if (chunks.length === 1) { parseNode(line.replace(/;$/, '')); continue; }
    if (chunks.length > 12) continue;
    let last: string | null = null;
    for (const chunk of chunks) {
      const node = parseNode(chunk.replace(/;$/, ''));
      if (!node) break;
      if (last) edges.push({ from: last, to: node });
      last = node;
    }
  }
  return nodes.size && edges.length ? { direction: first[1]?.toUpperCase() === 'LR' ? 'LR' : 'TB', nodes: [...nodes].map(([id,label]) => ({id,label})), edges:edges.slice(0,32) } : null;
}
