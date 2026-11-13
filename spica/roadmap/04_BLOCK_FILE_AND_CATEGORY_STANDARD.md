# 04 — Mandatory One-Block-One-File and Category Standard

This is the source contract for Phase 01 and every subsequent phase. It is a design specification, **not currently implemented** in the reviewed archive.

## Physical hierarchy

```text
src/spica/
  blocks/
    contracts.ts                    # shared interfaces, NO block definitions
    defineBlock.ts                 # typed helper, NO block definitions
    registry.ts                    # public lookup/facade
    registry.generated.ts          # generated ID -> lazy module locator
    styling/
      themes/semantic-palette.ts
      typography/type-scale.ts
    variables/
      state/set-variable.ts
      persistence/observe-storage.ts
    functions/
      collections/map-values.ts
      control/when.ts
    layout/
      responsive/split-pane.tsx
      containers/grid-layout.tsx
    visual-appearance/
      surfaces/glass-surface.tsx
      materials/elevation.tsx
    interface/
      navigation/app-shell.tsx
      dialogs/modal-router.tsx
    ui/
      inputs/material-text-field.tsx
      actions/material-button.tsx
      data/material-data-grid.tsx
    professionalism/
      audits/keyboard-audit.ts
      audits/contrast-audit.ts
    web-research/
      search/search-query.ts
      evidence/follow-reference.ts
    game-2d/
      scenes/tile-scene.ts
      sprites/sprite-renderer.ts
      physics/collision-shape.ts
      input/game-input-action.ts
    game-3d/
      scenes/scene-graph.ts
      camera/orbit-camera.ts
  runtime/
    ...                             # shared algorithms, sandbox, adapters
  catalog/
    ...                             # searchable metadata/drafts, NOT runtime modules
```

The example filenames above are **proposed**, not claims that these blocks exist. Each leaf source file must export **exactly one** canonical `SpicaBlockDefinition`, although it may import shared helpers or expose internal utilities. Tests may be adjacent as `<block>.test.ts`; JSON/Markdown docs may be adjacent but are not additional implementations.

## Category discipline

- Stable, machine-readable canonical category ID and subfamily ID in every definition; folders mirror the assigned category. Keep previously published 35-category IDs stable.
- A block that can be reused by multiple categories has **one home category** and multiple searchable facets/tags. Do not fork 14 slightly different source files to simulate more capabilities.
- Application UI `ui/material-button` and game HUD `game-2d/ui/game-button` are **different registered targets**, with different input/action/rendering contracts and theme expectations.
- `game-2d` and `game-3d` modules are never auto-mapped into `web-app` or `desktop-form` UI without a declared and tested adapter.
- A block cannot register under two IDs except with an explicit alias/deprecation record that resolves to one implementation.

## Proposed TypeScript contract (illustrative)

```ts
export type SpicaTarget = 'desktop-app' | 'web-app' | 'game-2d' | 'game-3d';
export type SpicaBlockKind = 'value' | 'action' | 'ui' | 'layout' | 'style' | 'quality' | 'game';

export interface SpicaBlockDefinition<TConfig = unknown> {
  id: string;                   // e.g. 'ui.material.text-field'
  version: string;              // semantic version
  categoryId: string;           // stable published category ID
  subcategory: string;
  kind: SpicaBlockKind;
  targets: readonly SpicaTarget[];
  ports: {
    inputs: readonly SpicaTypedPort[];
    outputs: readonly SpicaTypedPort[];
  };
  configSchema: unknown;        // validation schema reference, not arbitrary model prose
  permissions: readonly string[];
  dependencies: readonly string[];
  maturity: 'prototype' | 'beta' | 'stable';
  runtime: SpicaBlockRuntime<TConfig> | SpicaBlockRenderer<TConfig>;
}
```

`SpicaTypedPort`, `SpicaBlockRuntime` and `SpicaBlockRenderer` are **Phase 03/04 proposed types**, not existing exported interfaces. The precise contracts can evolve with migration tests. For existing schema-1 blocks, use a compatibility definition with the old ID and version `1` where appropriate; do **not** silently rename to dot IDs.

## Registry generation workflow

1. Developer or Spark adds one file to the correct category folder, declaring a single definition.
2. Dev-time generator scans filenames and **statically imports only minimal metadata where safe**, validates folder/category/ID matches, and writes a deterministic `registry.generated.ts` containing `id@version -> () => import('./category/subfolder/block')` entries.
3. Checker refuses duplicate ID/version, missing targets, invalid permission, unsigned community module, incomplete contract or mismatched category.
4. `warehouse.search` searches SQLite/indexed **metadata**, without loading modules.
5. `warehouse.inspect` returns a short typed descriptor and permission/target/test status.
6. `runtime.loadBlock` lazily imports **only the chosen registered implementation** after target/permission checks.
7. Before `verifiedExecutable`, run the block-specific contract tests and, where relevant, export/build/render verification. Registry presence alone means `registered`, not `verified`.

**Scaling safeguard:** A catalog of 350,000 *descriptors* does not imply 350,000 TS imports or JS modules. Store descriptors in SQLite/JSONL/FTS; generate runtime entrypoints only for actual installed executable blocks. Do not force Vite/Rust to parse every catalog entry on startup.

## One-file rule examples

**Good:** `src/spica/blocks/layout/responsive/split-pane.tsx` exports one tested `split-pane` block; shared split-panel math comes from an imported helper.

**Bad:** `src/spica/program.ts` contains a hand-maintained 5,000-element `blockRegistry` with strings and duplicate command bodies.

**Bad:** `src/spica/blocks/ui/all-buttons.tsx` declares 85 visually distinct buttons as separate block objects in one file. Shared generic buttons are a single configured block or several genuinely different per-file components.

**Bad:** a `glass-panel` block returns a generic unstyled `<div>` and claims to be a professional Material UI component. Its runtime should use the target's real visual component/theme renderer.

## Portability and exports

Block metadata is target-neutral; block implementation/rendering is target-specific when needed. `emitTauri` or the future web emitter selects only the used implementations and the corresponding UI/graphics packages. Versioned lockfiles include the actual dependency versions; unknown or unsupported targets fail validation, not silent fallback.

## Metrics to publish separately

`categoryCapacity`, `catalogDraftsIndexed`, `registeredModules`, `verifiedExecutableBlocks`, `registeredRecipes`, `targetCompatibleBlocks`, `deprecatedBlocks`.

**Never** call 10,000 generated configuration descriptors “10,000 working functions.”
