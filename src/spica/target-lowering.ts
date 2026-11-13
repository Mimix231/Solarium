import { compileGraph, type AppPlan } from './graph';
import { getBlock } from './runtime/blocks/registry';
import { getRuntimeBlock } from './runtime/registry';
import type { SpicaProject } from './repository';

export type SpicaExportTarget = 'desktop' | 'web';
export const spicaTargetVersion: Readonly<Record<SpicaExportTarget, number>> = Object.freeze({ desktop: 1, web: 2 });

export interface SpicaTargetDiagnostic {
  code: 'UNSUPPORTED_BLOCK' | 'UNKNOWN_BLOCK' | 'V2_NOT_LOWERED' | 'PLACEHOLDER' | 'INVALID_V2_ORIGIN';
  path: string;
  message: string;
}
export interface SpicaTargetReview {
  target: SpicaExportTarget;
  targetVersion: number;
  supported: boolean;
  diagnostics: SpicaTargetDiagnostic[];
  /** Only the validated schema-1 representation is currently lowered for standalone output. */
  ir: {
    kind: 'spica-app-ir'; version: 1; appId: string; revision: number;
    plan: AppPlan; lockedBlocks: Readonly<Record<string, number>>;
  };
}

/** No implicit translation of V2 nodes to schema-1 source: unsupported nodes are an error. */
export function inspectSpicaTarget(project: SpicaProject, target: SpicaExportTarget): SpicaTargetReview {
  if (target !== 'desktop' && target !== 'web') throw Error(`Unsupported SPICA export target: ${String(target)}`);
  const plan = compileGraph(project.graph);
  const diagnostics: SpicaTargetDiagnostic[] = [];
  const lockedBlocks = plan.blocks ?? {};
  for (const [id, version] of Object.entries(lockedBlocks)) {
    const block = getBlock(id, version);
    if (!block) diagnostics.push({ code: 'UNKNOWN_BLOCK', path: `blocks.${id}`, message: `No registered schema-1 block ${id}@${version}.` });
    else if (!block.targets.includes(target)) diagnostics.push({ code: 'UNSUPPORTED_BLOCK', path: `blocks.${id}`,
      message: `${id}@${version} does not support the ${target} export target.` });
  }
  if (project.graphV2) {
    for (const node of project.graphV2.nodes) {
      if (node.block.availability === 'placeholder' && node.block.id.startsWith('spica.legacy.') && node.metadata?.readonly) continue;
      const block = getRuntimeBlock(node.block.id, node.block.version);
      diagnostics.push({ code: block ? 'V2_NOT_LOWERED' : node.block.availability === 'placeholder' ? 'PLACEHOLDER' : 'UNKNOWN_BLOCK',
        path: `graphV2.nodes.${node.id}`, message: block
          ? `${node.block.id}@${node.block.version} has no standalone ${target} code emitter. The executable runtime is not a target compiler.`
          : `Node ${node.id} is not a supported exportable block. Standalone source remains unchanged.` });
    }
    // A standalone emitter must never pretend to include authoring edits to a migrated V2 document.
    if (!project.graphV2.migration || project.graphV2.migration.strategy !== 'readonly-snapshot') diagnostics.push({
      code: 'INVALID_V2_ORIGIN', path: 'graphV2.migration', message: 'The V2 document is not a verified read-only schema-1 projection.',
    });
  }
  return { target, targetVersion: spicaTargetVersion[target], supported: diagnostics.length === 0, diagnostics,
    ir: { kind: 'spica-app-ir', version: 1, appId: project.appId, revision: project.revision, plan, lockedBlocks } };
}

export function lowerSpicaTarget(project: SpicaProject, target: SpicaExportTarget): SpicaTargetReview['ir'] {
  const review = inspectSpicaTarget(project, target);
  if (!review.supported) throw Error(`SPICA ${target} export is unavailable:\n` +
    review.diagnostics.map(d => `${d.code} ${d.path}: ${d.message}`).join('\n'));
  return review.ir;
}
