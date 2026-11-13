import type { CreatorProject } from '../domain/types';
import type { CommandResult } from '../engine/intelligence/commands';
import type { Recipe } from './graph';
import { executeSpicaTool } from './tools';

export interface SpicaDirectBuildStep {
  tool: string;
  state: 'passed' | 'failed' | 'denied';
  evidence: Record<string, unknown>;
}
export interface SpicaDirectBuildResult {
  completed: boolean;
  steps: SpicaDirectBuildStep[];
  revision?: number;
  diagnostic?: string;
}

/**
 * Deterministic fallback ONLY for supported schema-1 starter apps.
 * Useful when a GGUF backend cannot emit structured calls. No guessed model
 * actions, no authority to write without the same action-mode permission gate.
 */
export async function buildSupportedSpicaTemplate(request: {
  project: CreatorProject;
  name: string;
  recipe: Exclude<Recipe, 'blank'>;
  signal: AbortSignal;
  webEnabled: boolean;
  authorize: (name: string, args: Record<string, unknown>) => Promise<'allow' | 'deny'>;
  onStep?: (step: SpicaDirectBuildStep) => void;
  onTool?: (name: string) => Promise<void>;
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void;
  onCommandResult?: (result: CommandResult) => void;
}): Promise<SpicaDirectBuildResult> {
  const steps: SpicaDirectBuildStep[] = [];
  let currentRevision: number | undefined;
  async function run(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (request.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const consent = await request.authorize(name, args);
    if (consent !== 'allow') throw Error(`Permission denied for ${name}.`);
    await request.onTool?.(name);
    const raw = await executeSpicaTool(name, args, request.project, {
      signal: request.signal, webEnabled: request.webEnabled, onCommandResult: request.onCommandResult,
    }, request.onOutput);
    const result = JSON.parse(raw) as Record<string, unknown>;
    if (result.revision !== undefined && Number.isSafeInteger(result.revision)) currentRevision = result.revision as number;
    const ok = result.ok !== false && result.saved !== false && result.state !== 'failed';
    const entry: SpicaDirectBuildStep = { tool: name, state: ok ? 'passed' : 'failed', evidence: result };
    steps.push(entry);
    request.onStep?.(entry);
    if (!ok) throw Error(String(result.diagnostic ?? `${name} returned a failed result.`));
    return result;
  }
  try {
    const created = await run('create_spica_app', { name: request.name, recipe: request.recipe });
    const revision = Number(created.revision);
    const exported = await run('export_spica_app', { revision });
    if (exported.next === 'prepare_spica_app') await run('prepare_spica_app', { revision });
    const verified = await run('verify_spica_app', { revision });
    return { completed: verified.ok === true, steps, revision: currentRevision,
      ...(verified.ok === true ? {} : { diagnostic: 'Verification returned no passing evidence.' }) };
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    if (!steps.length || steps.at(-1)?.state !== 'failed') {
      const step = { tool: steps.at(-1)?.tool ?? 'spica_build', state: (/denied/i.test(diagnostic) ? 'denied' : 'failed') as 'denied' | 'failed', evidence: { diagnostic } };
      steps.push(step); request.onStep?.(step);
    }
    return { completed: false, steps, revision: currentRevision, diagnostic };
  }
}
