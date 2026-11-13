# Phase 15 — Glitch/Code Studio Hybrid Editing & Custom Block SDK

**Goal:** Carry forward the original roadmap's Phase 10 here. Allow Dona and developers to move between visual composition and real source editing, while preserving source ownership and acknowledging that arbitrary code cannot be perfectly reconstructed as blocks.

## Feature scope

- **Bidirectional navigation**, not arbitrary bidirectional conversion: select a graph block → open owning file and line in Code Studio; click supported generated-source marker → inspect associated block and graph revision.
- Developer may write a custom TypeScript/JS/Python/Rust extension with a stable manifest, input/output contracts, permissions, execution target and tests. Only validated blocks enter the registry.
- Offer an editor action `Create reusable SPICA block from selected code` that generates a reviewable proposal, never silently registers untrusted code.
- Expose source diagnostics directly on the corresponding node/port in Dream Workbench when mappings are available.
- Preserve generated source vs custom source ownership; edits to user-owned files survive regeneration; conflict requires explicit review.
- Implement a template/extension SDK for known supported patterns. Unsupported imports/patterns receive clear feedback rather than an invented graph mapping.

## Implementation anchors

Existing `src/coding/`, Monaco integration, `src/engine/intelligence/coding-tools.ts`, `src/spica/emit.ts`, `src/spica/export.ts`, native `src-tauri/src/glitch.rs`, and backend project operations. Inspect the real exports/signatures before editing. One executable block source per file under `src/spica/runtime/blocks/`.

## Build order

1. Design `GeneratedSourceOwnership` receipts with graph/node IDs, file hashes, generated regions and user-editable extension points.
2. Implement graph-to-code navigation and code-to-known-block lookup in Code Studio.
3. Build `SpicaCustomBlockManifest` schema, template generator, compiler and test harness; require unique ID/version and target declaration.
4. Add reviewable block publishing action with permission prompts, sandbox constraints and explicit trust level.
5. Allow Sparks to propose a missing implementation, run tests, then ask for user approval before accepting it into the local warehouse.
6. Add rollback, provenance, diff review and dependency-lock diagnostics for extension upgrades.

## Acceptance gate

- Open generated source for a specific block, make a user-owned extension and re-export without overwriting the extension.
- Build and test a simple custom function, register it as a single block file, discover/inspect/execute it via canonical tools.
- Malicious or unexpected capability requests are rejected by explicit permissions.
- Original Code Studio/Glitch editor remains usable outside SPICA; blockless manual coding remains available.
- At least one real end-to-end locally verified hybrid project passes export and regression tests.
