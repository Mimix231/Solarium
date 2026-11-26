import type { SourceFileBundle } from './types';
import { sha256Source } from './loader';
import { assertSourcePath } from './validator';
import type { SourceBlockRegistry } from './registry';

/**
 * Confirm that a transported source bundle still matches the exact in-memory
 * emission receipts. This validates integrity, not tool authorization or file writes.
 */
export async function verifySourceFileBundle(bundle: SourceFileBundle, registry?: SourceBlockRegistry): Promise<void> {
  if (!bundle || !Array.isArray(bundle.files) || !Array.isArray(bundle.receipts) ||
      !Array.isArray(bundle.blocks) || bundle.files.length < 1 || bundle.files.length > 256 ||
      bundle.files.length !== bundle.receipts.length) {
    throw Error('Malformed source bundle or incomplete receipt set');
  }

  const blockKeys = new Set<string>();
  const registeredPortable = new Map<string, { outputPath: string; sha256: string }>();
  for (const block of bundle.blocks) {
    if (!block || typeof block.id !== 'string' || typeof block.version !== 'string') {
      throw Error('Malformed source bundle block');
    }
    const key = `${block.id}@${block.version}`;
    if (blockKeys.has(key)) throw Error(`Duplicate source bundle block: ${key}`);
    if (registry) {
      const trusted = registry.get(block.id, block.version);
      if (!trusted || (trusted.kind !== 'portable-source' && trusted.kind !== 'source-generator')) {
        throw Error(`Source bundle block is not registered: ${key}`);
      }
      // A self-consistent receipt is not proof of trusted code. Portable files
      // must still match the source bytes and output path pinned in the registry.
      const claimed = block.provenance;
      const original = trusted.provenance;
      if (!claimed || claimed.kind !== original.kind ||
          claimed.sourcePath !== original.sourcePath ||
          claimed.runtimeId !== original.runtimeId ||
          claimed.adaptation !== original.adaptation) {
        throw Error(`Source bundle provenance differs from registry: ${key}`);
      }
      if (trusted.kind === 'portable-source') {
        registeredPortable.set(key, { outputPath: trusted.outputPath, sha256: trusted.sha256 });
      }
    }
    blockKeys.add(key);
  }
  const filesByPath = new Map<string, { path: string; source: string }>();
  let totalBytes = 0;
  for (const file of bundle.files) {
    if (!file || typeof file.path !== 'string' || typeof file.source !== 'string') {
      throw Error('Malformed source bundle file');
    }
    assertSourcePath(file.path);
    const byteLength = new TextEncoder().encode(file.source).byteLength;
    totalBytes += byteLength;
    if (!file.source.trim() || byteLength > 1_000_000 || totalBytes > 8_000_000) {
      throw Error(`Oversized or empty transported source: ${file.path}`);
    }
    const key = file.path.toLowerCase();
    if (filesByPath.has(key)) throw Error(`Duplicate source bundle path: ${file.path}`);
    filesByPath.set(key, file);
  }

  const seen = new Set<string>();
  const usedOwners = new Set<string>();
  const encoder = new TextEncoder();
  for (const receipt of bundle.receipts) {
    if (!receipt || typeof receipt.path !== 'string' || !receipt.owner ||
        typeof receipt.owner.id !== 'string' || typeof receipt.owner.version !== 'string') {
      throw Error('Malformed source bundle receipt');
    }
    assertSourcePath(receipt.path);
    const key = receipt.path.toLowerCase();
    const file = filesByPath.get(key);
    if (!file || file.path !== receipt.path || seen.has(key)) {
      throw Error(`Source bundle receipt path mismatch: ${receipt.path}`);
    }
    seen.add(key);
    const ownerKey = `${receipt.owner.id}@${receipt.owner.version}`;
    if (!blockKeys.has(ownerKey)) {
      throw Error(`Unknown source bundle owner: ${ownerKey}`);
    }
    usedOwners.add(ownerKey);
    const portable = registeredPortable.get(ownerKey);
    if (portable && (receipt.path !== portable.outputPath || receipt.sha256 !== portable.sha256)) {
      throw Error(`Source bundle diverges from registered portable source: ${receipt.path}`);
    }
    if (receipt.sizeBytes !== encoder.encode(file.source).byteLength ||
        receipt.sha256 !== await sha256Source(file.source)) {
      throw Error(`Source bundle integrity mismatch: ${file.path}`);
    }
  }
  for (const key of blockKeys) {
    if (!usedOwners.has(key)) throw Error(`Source bundle claims an un-emitted block: ${key}`);
  }
}
