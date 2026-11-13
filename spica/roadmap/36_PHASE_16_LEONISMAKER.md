# Phase 16 — LeonisMaker/ShadowiumUI Game Authoring Bridge

**Goal:** Bring the original roadmap's game-authoring phase into the new ecosystem. Game creation uses **game blocks** and a game renderer—not a MUI settings-form renderer.

## Constraints and source landscape

`src/varmover/` includes a separate 2D creation/editor codebase. SPICA already has game-related adapters/target files, but that is not proof of full multi-scene game export. Preserve existing LeonisMaker project assets and formats and inspect their actual scene/runtime contracts before changing them.

## Proposed integration

- Dedicated registered capability targets: `game-2d` initially; do not claim `game-3d` until there is a real runtime.
- Blocks for `GameScene`, `Entity`, `Sprite`, `Tilemap`, `Collider`, `Camera`, `InputAction`, `AnimationState`, `PhysicsStep`, `AudioSource`, `GameHUD`, `SceneTransition`, `SaveState`.
- All executable block implementations live in `src/spica/runtime/blocks/game-2d/<family>/<block>.ts`, one file per block, using the same canonical registry and typed port contracts.
- Shared data/logic/state blocks can be target-neutral, but UI/game rendering targets must be explicit.
- Add `SpicaGameBridge` adapters to import/export supported scene constructs between LeonisMaker and SPICA graphs without promising arbitrary lossless sync.
- Save files, asset formats and build target environments have explicit versioning and migration tests.

## Implementation steps

1. Inventory LeonisMaker scenes, sprites, collisions, input, animation, tilemaps and runtime preview; identify existing tests and project serializer.
2. Introduce the game bridge contract and a minimal scene graph mapping with ownership markers.
3. Register game-specific blocks with dedicated tests, target permissions and validator contracts.
4. Build live game preview/scene inspector in the centered Workbench (as a game target), but preserve LeonisMaker's own editing workflow.
5. Add reproducible scenario replay for input, collision, scene transition and save/load; verify exports independently.
6. Permit Dona to assemble a small playable 2D game by selecting compatible game blocks; if a capability is missing, generate an explicit extension proposal rather than substituting generic app UI.

## Acceptance gate

- Create a scene with player movement, collision, animation, HUD and a menu using registered blocks.
- Preview and game export agree on input handling and state transitions.
- Existing LeonisMaker/ShadowiumUI projects still open without asset loss.
- One real standalone game runs and passes input/collision/save-load scenario tests.
