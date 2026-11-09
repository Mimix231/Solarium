import type { LocalModel } from '../domain/types';

export interface GGUFFile { name: string; path: string; sizeBytes: number }
const encodePath = (path: string): string => {
  // Stable deterministic key; avoids duplicating models when scanning again.
  let h = 2166136261;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `gguf:${(h >>> 0).toString(16)}:${path.length}`;
};
export function catalogToModels(files: GGUFFile[], port: number): LocalModel[] {
  return files.map((file) => ({
    id: encodePath(file.path.toLowerCase()), backend: 'llama.cpp',
    name: file.name.replace(/\.gguf$/i, ''), ggufPath: file.path,
    endpoint: `http://127.0.0.1:${port}`, modelId: file.name,
    contextSize: 4096, temperature: 0.7, maxTokens: 2048, createdAt: new Date().toISOString(),
  }));
}

export function mergeCatalog(existing: LocalModel[], found: LocalModel[], folder: string): LocalModel[] {
  void folder; // Folder switch removes stale discovered GGUF entries, but not manual registrations.
  const preserved = existing.filter((m) => !m.id.startsWith('gguf:'));
  const byId = new Map(existing.map((m) => [m.id, m]));
  return [...preserved, ...found.map((m) => ({ ...m, ...((byId.get(m.id) && { temperature: byId.get(m.id)!.temperature, contextSize: byId.get(m.id)!.contextSize, maxTokens: byId.get(m.id)!.maxTokens, toolCalling: byId.get(m.id)!.toolCalling, runtime: byId.get(m.id)!.runtime })) }))];
}
