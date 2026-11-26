# Solarium — Dream Construction Engine Phase 02: Continuation & Hardening

**Date:** November 22, 2026  
**Input:** `Solarium_DCE_Phase02_2026-11-22.zip`  
**Scope:** Phase 02 only — source capability warehouse and verification; Phase 01 and legacy SPICA remain compatible.

## What changed after the first Phase 02 checkpoint

The first checkpoint registered 18 real portable TypeScript implementations and one
static theme generator. The continuation includes **24 portable implementations**,
that generator, three deliberately host-only descriptors and one knowledge descriptor.

The six additional reviewed source modules are:

| Capability | Actual export(s) | Dependencies | Responsibility |
| --- | --- | --- | --- |
| `source.game-gravity` | `applyGravity` | `game-movement:MovementBody` | y-down gravity with terminal speed |
| `source.game-jump` | `tryJump`, `JumpResult` | `game-movement:MovementBody` | validated grounded jumps |
| `source.game-camera` | `followCamera` | `game-vector2:Vector2` | clamped viewport tracking |
| `source.game-collectibles` | `collectOverlaps`, `Collectible`, `CollectibleResult` | `game-aabb-collision` | pure overlap-based item collection |
| `source.game-platform-landing` | `resolveDownwardLanding`, `LandingResult` | `game-aabb-collision`, `game-vector2` | downward platform sweep/crossing detection |
| `source.game-animation` | `advanceAnimationFrame`, `AnimationFrame` | none | deterministic fixed-duration frame advancement |

These are reusable source primitives, not fabricated graph nodes or a finished platformer.
Their source is under `src/spica/source/portable/`, and exact SHA-256 source hashes are
recorded in `src/spica/source/builtins.ts`. The original runtime block adapter
registry is unchanged.

## Correctness and safety improvements

- `SourceBlockValidator` now rejects Windows-reserved device filenames and invalid
  generator schemas, including duplicate keys and unsafe prototype property names.
- `SourceBlockEmitter.emit()` rejects output-path collisions case-insensitively,
  missing generator exports, undeclared or unresolved static imports, undeclared
  named symbols, case-mismatched import paths, dynamic imports, unsupported bare
  packages, empty generator output, and oversized output.
- The pure in-memory `SourceFileBundle` now returns immutable source snapshots plus
  per-file SHA-256 receipts with the owning capability/version and UTF-8 byte count.
  **Receipts are evidence, not permission.** A later authorized project writer must
  compare its committed bytes and preserve Ask/Auto/YOLO authorization.
- `verifySourceFileBundle(bundle, registry)` checks transport integrity, case-correct
  paths, owner membership, declared provenance, source usage, and for **portable**
  modules the exact pinned SHA-256 and output path from the registered manifest.
  A forged file with a recomputed, internally consistent hash therefore cannot
  impersonate a reviewed portable source. Generator output can only be checked
  against its transport receipt here; a later construction writer must independently
  authorize and verify generated source.
- Static import preflight now masks string and comment contents before inspecting
  imports and exports. It remains a lightweight lexical check, **not** a compiler,
  security sandbox or complete TypeScript parser.
- Movement and collision primitives now reject non-finite state, including overflow;
  zero-area axis-aligned boxes never register a collision.
- The jump and collectible helpers preserve their callers' state rather than
  mutating it; platform landing detects downward crossings.
- The catalog's `host-runtime` and `knowledge-descriptor` entries remain
  non-emittable. No hidden alias, native filesystem write or graph execution was added.

## Acceptance and independent verification

`tests/dream-construction-phase02.test.cjs` now contains **36 passing focused tests**, including negative tests for contract
and path violations, real source loading, runtime adapter parity, and a **strict
TypeScript compilation of all 24 portable files with the generated theme file**.
It additionally compiles and executes an emitted multi-module game-core consumer
using movement, gravity, jump, collision, collectibles, platform landing, camera,
input and animation source. A second emitted bundle compiles under the declared
`typescript-desktop` webview target and verifies receipts against the registry.

Run these from the project root:

- `npm run test:construction:phase02`
- `npm run dce:source:manifest:check`
- `npm run dce:source:types`
- `npm run test:construction:phase01`
- `npm run test:tool:reliability`
- `npm run spica:registry:check` and `npm run spica:runtime:registry:check`
- `node scripts/check-syntax.cjs`
- Relevant SPICA phase/regression scripts

The complete frontend TypeScript build and lint remain dependent on packages not
installed in this execution environment (`react-markdown`, `remark-gfm`,
`remark-math`, `rehype-katex`, `rehype-highlight`, `highlight.js`, `katex`,
`pdfjs-dist`, `mammoth`, and ESLint). The current source checkpoint does **not**
claim a successful full frontend build, Windows/Tauri build or live GGUF test.

## Boundary with later phases

This continuation **does not implement Phase 03**: no 350K manifest index,
semantic retriever, global dependency auto-selection, or version lock solver.
It **does not implement Phase 05**: no automatic file writes, package installs,
or running application preview. These remain separate, explicit milestones.

## Release audit — continuation checkpoint

- Portable source modules: **24**, generator definitions: **1**; host-runtime and
  knowledge descriptors remain explicitly non-emittable.
- The combined emitted bundle compiles under strict TypeScript and the gameplay
  consumer executes its compiled functions in the test harness. The static code
  output is **not** yet a playable game or a native application.
- The original Phase 02 ZIP has **995 files**. Release packaging retains all
  original paths and adds only reviewed source modules, the receipt verifier and
  this report. Temporary `.spica-*` test outputs, Python `__pycache__` files, and
  stale compiled build outputs are never intentionally shipped as added files.
- Full frontend type-checking and linting remain unverified in this environment
  due to missing npm dependencies. The optional backend LSP tests also cannot
  initialize `typescript-language-server.cmd` in this Linux environment.
- Generator evidence is not a cryptographic signature of arbitrary generator
  behavior; the runtime only executes registered, reviewed generators when emitting.
  Trusted writes and generated-project runtime isolation remain Phase 05/07 work.
