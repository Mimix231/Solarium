# 06 — Professional UI and Separated Game Block Execution

**User decision:** Spica must assemble **professional, library-backed visual interfaces**, not generic default browser controls, and game construction must use **dedicated game blocks** in the same discoverable warehouse with distinct target rendering and runtime semantics.

**Primary implementation phases:** Phase 06 (professional app design system), Phase 09 (standalone exporters), Phase 11 (game integration). The registry/category split and metadata rules begin in Phase 01.

## Existing code that requires evolution

- `src/components/SpicaWorkbench.tsx` already imports MUI controls: preserve this; it is **the Solarium host UI**, not the whole exported app UI.
- `src/spica/target/SettingsApp.tsx::SettingsApp` renders default HTML inputs/selects/textarea, wrapped in a custom CSS surface. Improve this renderer **without losing settings data semantics**.
- `src/spica/emit.ts::emitTauri` currently emits a package with React, React DOM and Tauri API; MUI/Emotion are **not included** in that generated package. It concatenates raw target source bodies, so adding an import in only the Solarium host would not fix standalone exports.
- `src/spica/appearance.ts::{Appearance,appearanceCss}` already models stylistic choices; use typed theme tokens instead of arbitrary string CSS injection.
- `src/spica/target/{CollectionApp,WorkflowApp,SpicaApp}.tsx` and `src/components/SpicaPreview.tsx` must have matching preview/export style semantics.
- `src/spica/game.ts`, `src/spica/target/GameApp.tsx` and `src/varmover/` own the initial game code. They are **not** equivalent to ordinary MUI form pages.

## App UI renderer contract

For `web-app` and `desktop-app` targets:

- Default to **MUI Material UI + Emotion** components (`Button`, `TextField`, `Select`, `Switch`, `Card`, `Dialog`, `Table`, `Tabs`, `Drawer`, `Snackbar`, `Autocomplete`, `Grid`, `Stack`, `Box`, etc.) or a separately declared, packaged professional component library.
- Use one versioned `SpicaUiTheme` (typography, density, spacing, color roles, interaction states, dark/light schemes, reduced motion, shape radii and layering). Theme values are controlled through styling/appearance blocks, not raw concatenated CSS.
- `ui` blocks own actual widgets (e.g. material text field); `interface` blocks own screen/navigation/dialog flow; `layout` blocks own arrangement; `styling` blocks own tokens; `visual-appearance` blocks own special effects; `professionalism` blocks own measurable audits and constraints.
- Each category is independent and can compose with the others through typed ports. A `professionalism` block **cannot** silently change user data or invented app behavior; it reports findings or proposes a reviewed transformation.
- A block exposes the component implementation and target support through its one-file definition, with typed props/state, theme binding, and fixture-driven accessibility tests.
- Use semantic HTML under the library as necessary; “no generic UI” means **do not ship unstyled/default-looking controls**, not “ban JavaScript, TypeScript, DOM semantics, or React.”
- Allow opt-in custom component providers with pinned versions, licensing checks, known renderers, permissions and safe style tokens.

## Standalone export implications

1. `emitTauri()` must emit actual dependencies for the selected MUI/Emotion UI implementation, with compatible package versions and lockfile; no host-only dependency leakage.
2. Evaluate the generated Tauri Content Security Policy (`src/spica/emit.ts` currently sets `style-src 'self'`). Emotion runtime style injection may require a nonced style mechanism or another **tested and appropriately scoped** style strategy. Do not silently weaken all CSP to `unsafe-inline` without review.
3. Ensure deterministic theme hydration/initial state and identical preview vs executable target behavior.
4. Ensure only used UI blocks/dependencies are pulled into the exported bundle (tree-shaking/lazy composition); 10K catalog descriptors should not increase emitted app size.
5. Verify real production builds under supported targets. Browser preview success is not evidence of native correctness.
6. Existing schema-1 apps must preserve their values, saved records, file imports and accessibility even if native controls are replaced visually.

## UI quality gates

Measured keyboard navigation, focus order, contrast, `aria-*` labels, form error messaging, responsive breakpoints, density, overflow, resize, animations OFF, empty/loading/error states, dark/light palettes, copy readability, performance and visual consistency. Each audit points to a graph/block ID and a concrete measurable issue.

## Game blocks are distinct target families

Proposed families, all one module per block:

```text
src/spica/blocks/game-2d/
  scenes/tile-scene.ts
  entities/spawn-entity.ts
  sprites/animated-sprite.ts
  cameras/follow-camera.ts
  physics/collider.ts
  input/action-map.ts
  animation/clip-player.ts
  gameplay/inventory.ts
  ui/game-hud.ts
  rendering/pixi-stage.ts

src/spica/blocks/game-3d/
  scenes/scene-graph.ts
  meshes/mesh-component.ts
  lighting/scene-light.ts
  cameras/orbit-camera.ts
  physics/rigid-body.ts
  rendering/three-scene.ts
```

These names are **future examples**, not existing guaranteed implementations. Do not add PixiJS, Three.js, Rapier or other graphics/physics packages until the chosen existing game runtime is audited and a concrete bridge is designed. `src/varmover/` may already provide reusable systems; prefer adapters when maintainable.

Game blocks expose typed event ports, scene lifecycle, tick/update semantics, renderer IDs, deterministic seed/state behavior, asset references, collision/physics contracts, target support and permission budgets. Do not reuse ordinary MUI `Button` as a sprite; game HUD/buttons have their own target renderer (a DOM/MUI overlay is **optional**, explicit, and tested when the selected game engine supports it).

## Shared vs separated capabilities

| Reuse across app/game targets | Keep target-specific |
| --- | --- |
| Pure math, strings, collections, typed variables, safe storage, data validation | Game render loop, scene composition, sprite/camera, collision, physics, game input |
| Repository/registry, capability authorization, graph ports, metadata, logging | MUI/Emotion widgets, desktop dialogs, web DOM navigation, game HUD renderer |
| Generic event contracts and deterministic function blocks | Game-specific frame/tick timing and asset lifecycle |

## Implementation constraints

- Don't merge LeonisMaker/ShadowiumUI into a large MUI app page.
- Don't register a single generic `game` block as proof of an entire game category's implementation.
- Don't claim broad 3D support based on 2D graph adapters.
- Don't create thousands of style-only variants as separate executable modules when they are configurations of one verified component.

## End-to-end target example

Prompt: “Dona, build a polished Notes Organizer with a glassy dashboard, a two-column responsive editor, a keyboard-accessible Add Note dialog, and autosave.”

A valid planned composition selects:
- `ui` → true MUI TextField/Button/Dialog + record table blocks;
- `interface` → navigation/dialog state;
- `layout` → responsive split layout;
- `styling` → semantic tokens;
- `visual-appearance` → glass surfaces;
- `variables` → typed form state;
- `functions` → validation/formatting;
- `storage` → autosave/record persistence;
- `professionalism` → measurable focus/overflow/contrast audits;
- `target` → generated standalone desktop app with packaged MUI dependencies.

The source definition of **each** selected executable block lives in its own category file. Spica constructs the composition and exports only what the app uses. A later game request uses game-specific blocks and a game runtime, not the Notes Organizer renderer.
