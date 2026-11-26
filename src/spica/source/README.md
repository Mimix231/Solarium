# Dream Construction Engine — Source Warehouse (Mega-Phase 02)

This is the new **source-code** capability library. It does not replace the existing
`src/spica/runtime/` graph executor or the 26 schema-1 SPICA adapters.

## Separate contracts, separate claims

| `SourceBlockDefinition.kind` | Can produce files? | Meaning |
| --- | --- | --- |
| `portable-source` | **Yes**, through a verified source provider | Independently usable, versioned TypeScript source and exact SHA-256 |
| `source-generator` | **Yes**, through a bounded deterministic generator | Produces code from validated configuration; never writes to disk itself |
| `host-runtime` | **No** | Requires the SPICA host, renderer, authorization or transaction context |
| `knowledge-descriptor` | **No** | Searchable concept only, with no source/compile claim |

`SourceBlockRegistry` validates and deep-freezes manifests; `SourceBlockLoader` loads
pre-bundled source through an injected provider and checks its SHA-256; `SourceBlockEmitter`
returns a **pure, in-memory** bundle after validating exact dependencies and paths.
No operation in this library makes an LLM call, executes generated code, writes to a
project folder, or grants additional permissions.

The shipped `provider-vite.ts` uses Vite's `?raw` imports so the desktop renderer
can load reviewed source files without Node filesystem APIs. The build executor in
later phases must use its own trusted, permissioned project host.

## Reviewed source capabilities

The completed Phase 02 checkpoint contains 24 portable TypeScript modules:

- Nine direct pure-logic adaptations from existing executable runtime adapters:
  `number-add`, `number-clamp`, `number-round`, `array-unique`, `array-sort-field`,
  `text-slug`, `text-contains`, `record-get`, `record-set`.
- Four adaptations of host UI/session behavior into **new standalone implementations**:
  `state-store`, `ui-button`, `ui-heading`, `layout-row`. Their portable DOM/state
  semantics are not identical to SPICA's host UI descriptors or transaction context.
- Five new, explicitly labeled portable gameplay primitives: `game-vector2`,
  `game-movement`, `game-aabb-collision`, `game-input`, `game-canvas-renderer`.
  They are source foundations, **not** a finished platformer or game engine.

The continuation adds six dependency-declared gameplay primitives:
`game-gravity`, `game-jump`, `game-camera`, `game-collectibles`,
`game-platform-landing`, and `game-animation`. They compose into a **compiled
standalone game-core example** during tests; they are not a complete game or
an interactive preview. Platform landing uses a y-down coordinate system;
all gameplay modules reject non-finite physics state where appropriate.

A real deterministic `source.theme-tokens` generator emits a typed TS theme module.
The separate host-runtime entries for transactional record read/write and the Markdown
editor cannot be compiled as standalone implementations without target-specific adapters.

`src/spica/source/builtins.ts` is the version-locked manifest; source asset SHA-256
verification protects against accidental source drift. Review any intentional code edits,
then run `node scripts/check-dce-source-warehouse.cjs --write` to update the hashes.
This command only updates reviewed hashes; it is not an autonomous agent operation.

## Usage from a trusted construction planner (Phase 03+)

```ts
import { createSourceBlockRegistry, SourceBlockLoader, SourceBlockEmitter } from './src/spica/source';
import { viteSourceBlockProvider } from './src/spica/source/provider-vite';

const registry = createSourceBlockRegistry();
const loader = new SourceBlockLoader(registry, viteSourceBlockProvider);
const emitter = new SourceBlockEmitter(registry, loader);
const bundle = await emitter.emit([
  { id: 'source.game-vector2' },
  { id: 'source.game-movement' },
  { id: 'source.game-aabb-collision' },
], 'typescript-web');
// bundle.files is in-memory; an authorized Phase 05 transaction applies it.
```

`source.game-movement` explicitly requires `source.game-vector2`; omitting it fails.
Source imports must use the exact case of emitted file paths, must name exported
symbols declared in the requiring block's contract, and cannot import arbitrary
packages or use dynamic imports. The emitted snapshot contains frozen `files`,
`blocks` and SHA-256 `receipts`. A future Phase 05 writer **must still verify**
that its committed bytes match these receipts. Source generation itself never writes files.
For transported snapshots, call `verifySourceFileBundle(bundle, registry)` to
validate receipts and confirm registered portable modules still match their exact
reviewed source hashes and output paths. This is an integrity check, **not** an
authorization to write or execute. Generator output has transport integrity but
cannot be independently authenticated to a configuration from a receipt alone.

The current emitter does not implicitly select dependencies or install packages.
Phase 03 will provide capability search, scalable indexing and a dependency planner.
Phase 05 will provide authorized project writes, build verification, and rollback.

## Checks

- `npm run dce:source:manifest:check`: all checked-in source hashes and registrations
- `npm run dce:source:types`: isolated strict TypeScript across all source files,
  browser raw-loader typing, and discovery APIs (no npm dependency installation required)
- `npm run test:construction:phase02`: registration, integrity, config, dependency,
  Windows path and output safety, runtime parity, generator, SHA-256 receipts,
  and **actual strict compilation of emitted web and desktop-webview modules plus a game-core consumer**
- `npm run test:construction:phase01`: existing construction routing and checkpointing
- Existing SPICA phase suites and both registry checks ensure legacy compatibility

A passing Phase 02 test does **not** mean the whole frontend, Tauri native app,
GGUF model or a playable preview has been verified. Those require separate tests.
