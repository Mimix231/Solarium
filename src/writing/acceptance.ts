import { readableProse, repeatedPassages } from './prose';
export interface SceneProof { beatId: string; quote: string; endState: string }
export function sceneIssues(prose: string, previous: string, beatId?: string, proof?: SceneProof | null, requireOutcome = false): string[] {
  const issues: string[] = [];
  if (!prose.trim()) issues.push('The scene contained no prose.');
  if (readableProse(prose).issues.length) issues.push('The scene restarted a writing document instead of continuing its planned action.');
  if (repeatedPassages(prose, previous).length || prose.trim().length > 200 && previous.includes(prose.trim())) issues.push('The scene repeated previously written passages.');
  if (beatId && (!proof || proof.beatId !== beatId || typeof proof.quote !== 'string' || proof.quote.trim().length < 8 || proof.quote.length > 500 ||
    !prose.includes(proof.quote) || typeof proof.endState !== 'string' || !proof.endState.trim() || proof.endState.length > 1000)) {
    issues.push('This planned action needs its exact ID, an actual short passage and its reached end state in solarium-scene metadata.');
  } else if (requireOutcome && proof && prose.lastIndexOf(proof.quote) + proof.quote.length < prose.length * .55) {
    issues.push('The outcome quote comes from the setup. Finish the planned action and cite the passage near the end where its result occurs.');
  }
  return issues;
}
