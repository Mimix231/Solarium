# 01 — SPICA Canon Mega-Phase Roadmap

**Operating model:** One large, end-to-end phase **per development round**. A round can contain multiple implementation batches, but it ends only after its intended deliverable passes the agreed acceptance tests or is explicitly marked incomplete. This plan does **not** authorize changing the active Solarium source during planning.

**Current base:** Existing `Graph` schema 1, 26 runtime block adapters + 3 recipes, 35 catalog categories × 10,000 **planned** entries, existing Tauri source emitter/build verification, integrated Solarium Chat Spica dialog, project research, Glitch/Code Studio, and separate game editor modules.

**North-star behavior:** A user asks Dona to build an application. Dona discovers a small shortlist of verified blocks, inspects contracts, creates and validates a typed graph, shows a **centered Solarium overlay** with an intelligible code diff and a visible app preview, executes genuine tests, explains any failures, and exports independently runnable source. Manual editing uses the **same graph and test pipeline**. All steps work with local models without injecting hundreds of thousands of tool schemas into context.

## Non-negotiable invariants — enforced in EVERY phase

1. **Preserve canon and user data.** Existing Spica projects, SQLite records, Sources, chat history, generated code, receipts, and game projects must remain readable and recoverable.
2. **No phantom capabilities.** Report four distinct metrics: planned capacity, indexed drafts, registered adapters/recipes, and independently tested runnable capabilities. Never label a description as executable.
3. **One orchestration architecture.** Extend `src/engine/agent.ts` and staged tools; do not clone a second model runner or introduce prompt/reasoning resumption hacks.
4. **Local-first and permissioned.** Network, shell, filesystem, process launch and sensitive-data access remain gated, scoped and auditable. Respect Web Search OFF.
5. **Real source provenance.** Generated files have ownership receipts and CAS writes; user files are not silently replaced. Builds must be tied to graph revision, source fingerprint and executable fingerprint.
6. **Visually integrated.** Build and test affordances remain in the existing Solarium conversation workflow. Workbench overlay is centered and dismissible, with reduced-motion support and accessible keyboard/focus behavior.
7. **Small-model usability.** Search returns at most a useful shortlist, contracts on demand, short results with stable IDs; avoid a full-library tool prompt. Support the user's 8/12 GB VRAM target without assuming all models perform equally.
8. **Evidence, not theatre.** Tests show actual progress/results/errors, not invented percentages or success banners.
9. **No forced sync.** Generated code and user-owned custom code have explicitly defined ownership. Bidirectional arbitrary code-to-graph conversion must never be implied if not implemented.
10. **One-round checkpoint.** Record modified paths, schema changes, migrations, actual test results and unresolved faults before starting the next phase.

11. **Exactly one implementation file per block.** Every executable block lives in a descriptive category/subcategory folder and exports a versioned, typed definition. No monolithic block registry arrays, giant case statements, or ambiguous duplicates; catalog metadata never masquerades as executable source.
12. **Professional application UI.** UI, layout and appearance blocks render through real component libraries (MUI is already installed) with Solarium-compatible tokens. JavaScript/TypeScript remain implementation languages, not visual substitutes. The standalone emitter must package the actual chosen UI library and its dependencies.
13. **Separate game block targets.** Game scenes, input, sprites, physics and renderers live in dedicated game categories and runtime targets. Do not force gameplay through MUI form components.
14. **Terminal-like glass workbench.** SpicaBuild events, actual terminal output, source diffs and interactive preview remain together inside the single centered overlay over the active conversation; the user-supplied screenshots define the visual direction.

---

## PHASE 01 — Canon hardening and one truthful capability registry

**Purpose:** Make existing implemented blocks, recipes and draft metadata discoverable through one **truthful, versioned** interface, while preserving the old graph and all existing behavior. This is the safest first major implementation phase.

**Non-negotiable source refactor:** Move each of the 26 existing `src/spica/program.ts::blockRegistry` definitions into **its own file** under `src/spica/blocks/<category>/<subfamily>/<block-id>.ts[x]`, retaining the old ID/version and behavior. Keep `program.ts` exports as compatibility facades backed by a generated verified registry. Each file must own precisely one block definition and refer to shared implementations by imports where appropriate. Category index metadata is separate from executable modules. Add deterministic registration generation/checks and per-block test fixtures. A per-file block cannot enter the executable registry until its type contract, unique identity, implementation locator, permissions and tests validate. **Do not delete the 26-entry legacy list until parity passes.**

**Build:**

- Establish baseline source identity and tests; capture current data/exports as migration fixtures.
- Introduce a canonical `SpicaCapabilityDescriptor` with stable `id@version`, category/facets, kind (`primitive|composition|profile|recipe`), maturity, **source** (`runtime|catalog|user`), I/O schema references, target support, permissions, dependencies, implementation reference, and test evidence.
- Bridge `blockRegistry` and `recipeCatalog` into `src/spica/warehouse.ts`; ingest canonical metadata into native SQLite FTS (`src-tauri/src/spica_catalog.rs`) without executing catalog-only descriptions.
- Build one discovery facade with `search`, `inspect`, `explainAvailability`, source/status filters and paginated results. Preserve old `searchSpicaWarehouse`/`inspectSpicaComponent` APIs temporarily as compatibility wrappers.
- Display actual counts in `SpicaWarehouse`: registered, runnable-for-target, drafts, profiles, planned capacity, each clearly differentiated.
- Validate IDs, versions, permissions, source identity, duplicate resolution, and non-executable behavior at Rust and TypeScript boundaries.

**Source anchors:** `src/spica/program.ts`, `warehouse.ts`, `catalog/{categories,client,manifests}.ts`, `src-tauri/src/spica_catalog.rs`, `src/components/SpicaWarehouse.tsx`, `src/spica/tools.ts`, `tests/spica.test.cjs`.

**DONE when:** Existing app graphs and workflows still work; exact ID/version discovery works for both registered and draft metadata; no draft can be installed/executed by accident; results are paged; counts reconcile to actual source; no new model loop; existing tests remain green and migration tests pass.

---

## PHASE 02 — The dream experience: centered overlay, professional diff and live app testing

**Purpose:** Turn the existing Spica-in-Chat dialog into the polished, responsive, inspectable workflow shown in the user's concept, **without** adding a separate top-level Spica tab.

**Immediate design direction:** One centered **glass** MUI Dialog over the existing conversation. Show a genuine terminal-like **Build Stream** (xterm.js already installed) for discover→register→wire→generate→compile→test→preview events; beside it, the actual application preview. Provide an integrated Monaco side-by-side diff that presents accurate `−` red / `+` green lines. No separate Spica tab, no fake stage output, no unreadable purple-on-purple redesign. Treat the two supplied reference images and the actual Solarium screenshot as UI acceptance references.

**Build:**

- Keep the project conversation visible and softly dimmed in the background. Center an accessible modal/dialog with controlled open/close, remembered focus, adaptive size and reduced motion.
- In the overlay, offer synchronized **before vs after** source diff: proper hunks, line numbers, `−` red deletions, `+` green additions, changed-file navigation, search, context controls and conflicts.
- Show a real **working app preview** in the overlay's right-side pane or adaptive split; allow inspecting click, keyboard, interaction state, layout and styling directly.
- Add live, versioned `SpicaBuildEvent` streams (event ID, run ID, timestamp, stage, severity, block ID, command/output reference and graph revision) with bounded retention and reconnection; the existing terminal output must be read directly, not emulated from model text.
- Add real pipeline stages: export, dependency preparation, build, native tests, scenario tests, preview/launch; display actual progress events and logs without fake percentages.
- Preserve the current `SpicaWorkbench` tabs (Changes/Build Logs/Test Results/Inspect) as coherent panels within **the same dialog**. Integrate warehouse and flow controls as subpanels, not separate application screens.
- Support drag/resize only where accessible; handle small monitors, zoom, short height, screen readers, high contrast, animations OFF and abort/close behavior.
- Compare UI snapshots to the **user-provided existing Solarium screenshot** rather than replacing Solarium's visual identity with a new purple app shell.

**Source anchors:** `src/views/Chat.tsx`, `src/components/SpicaWorkbench.tsx`, `SpicaPreview.tsx`, `ChangesetReview.tsx`, `src/views/spica.css`, `src/components/spica-preview.css`, `src/spica/export.ts`.

**DONE when:** Clicking Test & Preview opens one centered overlay over the active conversation; the app remains visible inside the overlay; full code diff is correct; cancelling works; results reflect real build/test state; no route change or new global tab. UI interaction and keyboard tests pass.

---

## PHASE 03 — Universal graph v2 and typed connection system

**Purpose:** Evolve the current application-specific schema into a general composable graph, **without destroying schema 1 or its standalone exporters**.

**Build:**

- Introduce a versioned `SpicaGraphV2` or additive graph extension with nodes, typed input/output ports, edges, scopes, stable block locks and subgraphs.
- Specify `SpicaValueType` and safe type-checking for primitives, records, arrays, events, references, UI nodes, async results and capability handles. Coercion is explicit, never silently lossy.
- Add `validateSpicaGraphV2`, `applySpicaGraphTransaction`, connection diagnostics, edge-cycle policies, fan-in/out constraints, read-only metadata, and deterministic serialization.
- Migrate schema-1 projects **non-destructively** with a view of the original graph and rollback; preserve `SpicaRepository` revision checks, undo/redo and history.
- Keep `compileGraph`, `changeGraph`, `validateGraph`, `SpicaRecord` and existing note/settings app exports functioning while enabling v2-native graph projects.
- Define graph and workspace limits based on performance/virtualization metrics, not the schema-1 512 KB assumption.

**Source anchors:** `src/spica/graph.ts`, `program.ts`, `repository.ts`, `appearance.ts`, `src/spica/emit.ts`, `src/spica/target/`, tests. **New proposed modules:** `src/spica/graph-v2/{types,validation,transactions,migration,serialization}.ts`.

**DONE when:** A saved v1 Notes Organizer graph opens/round-trips/exports unchanged; v2 handles real typed connections, cycles/errors, undo/redo and stale edits; corrupt graphs fail safely; deterministic graph hashing and migration/rollback tests pass.

---

## PHASE 04 — Block execution runtime, adapter SDK and permissioned sandbox

**Purpose:** Make blocks executable units, not just visual names and strings.

**Build:**

- Define `SpicaBlockAdapter<Input,Output>` contracts: descriptor, configuration schema, validate, prepare, execute, cancel/cleanup, target constraints, dependency locks and test fixtures.
- Separate pure functions from stateful commands, effects, UI renderers, native operations and long-lived subscriptions.
- Build deterministic scheduler/evaluator: topological execution for pure nodes, explicit event/action routing, cancellation and error propagation for effects, loop budgets, trace IDs and output caching where safe.
- Permission broker for network/file/process/records; deny unknown grants. Restrict user/community blocks by trust level, origin and target capabilities.
- Provide real contract tests and a block-authoring CLI or dev script. Make existing 26 adapters accessible through compatibility adapters rather than rewriting all target code at once.
- Introduce block runtime telemetry and test evidence; a descriptor only becomes `runnable` after successful validation and registration.

**Source anchors:** `src/spica/program.ts`, `warehouse.ts`, `graph.ts`, `src/engine/action-permissions.ts`, `src/engine/intelligence/tool-validation.ts`, `src-tauri/src/registered_commands.rs`. **New proposed:** `src/spica/runtime/{adapter,executor,permissions,trace,registry}.ts`.

**DONE when:** A typed graph executes a nontrivial data → conditional → storage → UI flow with predictable results; invalid types/capabilities are blocked; cancellation and undo boundaries are documented; runtime tests and existing scenarios pass.

---

## PHASE 05 — Massive 10K-per-category warehouse and scalable discovery

**Purpose:** Scale discoverability across 35 categories and future categories, without creating 350,000 fake executable functions.

**Catalog-to-runtime discipline:** One source file per real block; 350K synthetic/catalog records live in indexed metadata, NOT 350K eager TS/JS imports or components. Split manifests by category and subcategory; generated registry maps block IDs to lazy module entrypoints. Keep games in `games-2d` / `games-3d` or equivalent scoped categories with target-specific contracts.

**Build:**

- Stable category registry with 35 current IDs and room for dynamically registered user categories; preserve existing IDs and category 05 Variables, 27 Web Research, 29 Styling, 30 Functions, 31 Layout, 32 Visual Appearance, 33 Interface, 34 UI, 35 Professionalism.
- Hierarchical family taxonomy, multi-category facets, reusable composition templates and generated configuration variants with honest provenance.
- Versioned manifest compiler, semantic validation, dependency closure checker, deterministic IDs, diffable migration and deprecation/replacement rules.
- SQLite FTS5 / indexed structured filters and optional local embeddings only when demonstrably useful. Do not load all descriptors into an LLM prompt or React state.
- Stress tests with **synthetic non-executable descriptors** at 10K/category (350K total) to exercise indexing, query latency, memory, pagination and category facets. Clearly tag these as synthetic test data, not shipped features.
- Warehouse metrics dashboard with actual `plannedCapacity`, `indexedDraftCount`, `registeredCount`, `verifiedExecutableCount`.

**Source anchors:** `src/spica/catalog/{categories,manifests,client}.ts`, `src-tauri/src/spica_catalog.rs`, `src/spica/warehouse.ts`, `src/components/SpicaWarehouse.tsx`.

**DONE when:** Large synthetic catalogs remain searchable within measured budgets on supported PCs, results rank sensibly, data stays on disk, category ID migration is stable, and no synthetic descriptor appears runnable.

---

## PHASE 06 — Full visual application design system across eight priority warehouses

**Purpose:** Deliver the practical primitives that make the user's 10K Styling, Variables, Functions, Layout, Visual Appearance, Interface, UI and Professionalism categories useful for actual app generation.

**Visual implementation contract:** App UI and interface blocks MUST use MUI/Emotion or an approved package (e.g. purpose-built diagram/table editors) with a shared `SpicaUiTheme` token provider, proper accessibility and professional defaults. Never output unstyled browser `<input>`, `<button>` and `<select>` as the default visual implementation. Native HTML wrappers remain acceptable for semantic structure, file inputs and platform primitives when styled and justified. Games use dedicated renderers, not the Material UI component tree.

**Build:**

- **Styling:** tokens, semantic palettes, typography, borders, radius, shadows, state variants, responsive tokens, constraints.
- **Variables:** typed local/derived/persistent/reactive state, scoped bindings, immutable snapshots, defaults, validation and migrations.
- **Functions:** transforms, formatters, predicates, branching, mapping/filtering, async invocation with explicit capability contracts, testable pure operations.
- **Layout:** grids, stacks, splits, docking rules, constraints, breakpoints, virtualized lists, overflow and keyboard resizing.
- **Visual Appearance:** controlled surface effects, glass/matte/material themes, gradients, state transitions, reduced motion, renderer fallbacks.
- **Interface Architecture:** navigation stacks, app shells, menus, screen ownership, modal focus and route guards.
- **UI Components:** editable buttons, tables, forms, trees, media views, selectors, inspectors, status areas, accessible controls.
- **Professionalism:** real focus/contrast/overflow/label/keyboard/responsiveness/consistency audits with actionable findings.
- Upgrade `src/spica/target/SettingsApp.tsx`, which currently renders raw HTML input/select/textarea controls, and the `src/spica/emit.ts` standalone dependency list (React/Tauri only today) to package the selected actual UI library with sensible CSP/Emotion handling. Protect existing saved settings and exported app behavior in regression tests.
- Add typed connection compatibility, block visual inspector, and reusable design tokens matching Solarium's active themes.

**Source anchors:** `src/spica/appearance.ts`, `src/spica/target/{SettingsApp,CollectionApp,WorkflowApp}.tsx`, `src/themes/`, `src/components/SpicaPreview.tsx`, `src/quality/`, plus runtime/graph v2 from previous phases.

**DONE when:** Dona or a human can build a realistic multi-screen settings-and-records app using composed blocks, responsive styles, state, validation, persistence and measurable professional QA. Multiple templates are testable, not just pretty screenshots. This phase does **not** require writing 80,000 unrelated implementations.

---

## PHASE 07 — Spark as a safe architect: discover → inspect → propose → build → verify

**Purpose:** Make Dona and other Sparks genuinely useful at creating arbitrary graph applications with limited local model context, while respecting existing AI/runtime contracts.

**Build:**

- Reuse `runAgent`, `selectActionTools`, `selectSpicaTools`, `ToolPermission`/approval and `TaskExecution`, rather than making a second agent.
- Extend staged search to the unified warehouse with target, maturity, required ports, capability, dependency and relevance filters; return 5–12 concise candidates and inspect exact versions on demand.
- Introduce bounded `SpicaBuildIntent`, `SpicaGraphProposal`, `SpicaChangeSet`, typed graph transaction and deterministic preflight validation before any Ask/Auto/YOLO approval.
- Split planning into real tool turns: discover → inspect → draft graph → validate → review → apply → export → verify → inspect failing log → repair. No invented success, no non-tool fake continuations, no silent file writes.
- Persist decisions and evidence through existing `WorkMemory`, `TaskExecution` and Sources mechanisms. Record which blocks were selected and why.
- Support progress, cancellations and user edits while the Spark works; reject stale revisions instead of overwriting changes.
- Regression-test small GGUF context budgets and ensure no additional simultaneous model weight copy.

**Source anchors:** `src/engine/{agent,tools,continuous-generation,context-window}.ts`, `src/engine/intelligence/{task,work-memory,tool-validation}.ts`, `src/spica/tools.ts`, `warehouse.ts`, graph v2/runtime modules.

**DONE when:** A Spark creates and verifies a complete small app by selecting blocks and processing real tool feedback; user can inspect and reject every sensitive change; small-context test passes; existing inference and permissions regressions remain green.

---

## PHASE 08 — Adaptive Web Research and evidence-driven follow-up blocks

**Purpose:** Allow a Spark to inspect search results and choose the **next research operation based on observed evidence**, not a fixed series of preset searches.

**Build:**

- Extend existing `SpicaResearchRun` and `ConversationResearch` with typed observation records, claim IDs, source references, content hashes and source freshness.
- Add real operations for query narrowing, provider fallback, page selection/reading, link tracing, citation/reference following, comparing contradictions, version checking and citing supporting passages.
- Keep the 10K `research.profile` descriptors as candidate strategies; only invoke registered real research operations after contract/permission checks.
- Add an explicit next-action ranking/explanation algorithm: `observation → missing evidence → candidate operation → permission/budget check → action → new observation`.
- Enforce Web Search OFF, public HTTPS constraints and network-side SSRF/redirect defenses; treat retrieved text as untrusted data, never instructions.
- Add termination rules: user goal met with sufficient evidence, budget exhausted, repeated result, contradictory/insufficient evidence, user cancel.
- Save evidence to the existing scoped `SourceRepository`, and hand grounded findings back to Spica build proposals/Glitch implementation tasks.

**Source anchors:** `src/spica/research-run.ts`, `src/research/{conversation,research}.ts`, `src/components/SpicaResearch.tsx`, `src/sources/repository.ts`, `src/engine/agent.ts`.

**DONE when:** On a controlled fixture, a Spark searches, reads a result, follows a cited source, finds a version mismatch, selects another operation, verifies a claim, saves evidence and stops; denied/offline cases perform **zero** unexpected network requests.

---

## PHASE 09 — Real standalone builds: source emitters, preview and target interoperability

**Purpose:** Expand reliable exports beyond the current Tauri app subset, maintaining independent runnable deliverables.

**Build:**

- Make standalone UI library choices explicit in the emitted package manifest; verify MUI/Emotion styles in the target WebView with an appropriate CSP and generated theme. A Solarium-only MUI preview does not prove the exported app includes those dependencies.
- Define target-lowering interfaces and a graph-to-target intermediate representation, keeping existing `emitTauri` as a proven compatibility backend.
- Add an independently runnable **web app target** (when supported by graph capabilities) with deterministic React/Vite or compatible source; retain native Tauri desktop output.
- Preserve `spica-export.json` ownership, `src/custom.js`/user-controlled hooks, source drift detection, file compare-and-swap, version locks and source fingerprints.
- Introduce target compatibility diagnostics before export, explaining unsupported native-only blocks without making up fallbacks.
- Track run/test/packaging evidence per graph revision, target, lockfiles and executable or artifact fingerprints.
- Build a multi-target acceptance corpus (settings app, notes app, structured form, custom UI app) and test independent execution without Solarium installed.

**Source anchors:** `src/spica/{emit,export,graph}.ts`, `src/spica/target/`, `src-tauri/src/spica_preview.rs`, `src/engine/intelligence/commands.ts`.

**DONE when:** A supported graph exports to both web and desktop and passes real tests; unsupported blocks fail explicitly; custom source remains intact; modification after verification correctly invalidates launch evidence.

---

## PHASE 10 — Glitch/Code Studio hybrid editing and safe custom blocks

**Purpose:** Blend manual programming and block-based construction without pretending that arbitrary source code can always map back into blocks.

**Build:**

- Connect `SpicaBuildIntent`, graph revisions and generated artifacts to existing Monaco workspaces and reviewed project file operations.
- Show generated vs user-owned files and registered extension points; allow custom code adapters through an explicit SDK/manifest, with type, version, permission and tests.
- Enable jump-to-generated-code, navigate-from-block-to-source, source diagnostics-to-block trace mapping, and verified fixes.
- Optional import of **known and annotated patterns only**; reject unknown constructs with an explanation rather than inventing block mappings.
- Maintain backend Python/Rust/TypeScript process boundaries and source-scoped safety.
- Add safe snapshot/restore on conflicts and after generated-code regeneration; never quietly rewrite user code.

**Source anchors:** `src/coding/`, `src/engine/intelligence/coding-tools.ts`, `src/spica/{emit,export}.ts`, `src-tauri/src/glitch.rs`, `backend/project/`.

**DONE when:** A developer can build using blocks, open the exact generated file in Code Studio, add a supported custom function, register it as a block after tests, re-export without losing custom edits and inspect the resulting native verification.

---

## PHASE 11 — LeonisMaker/ShadowiumUI game-authoring integration

**Purpose:** Make the existing substantial 2D editor and Spica speak the same contracts, instead of copying one into the other.

**Separate games contract:** Register game blocks as dedicated executable categories with `game-2d` and, only when implemented, `game-3d` target IDs. Shared data/function blocks may be target-neutral; `GameScene`, `Sprite`, `CollisionShape`, `Camera`, `AnimationGraph`, `Tilemap`, `InputAction`, and `GameHUD` must resolve through a game renderer/runtime, not MUI.

**Build:**

- Inventory `src/varmover/editor/{types,project,projectFile,store,catalog,runtimeSystems}.ts` and its scene/animation/event UI; identify truly reusable code vs editor-only state.
- Define `SpicaGameBridge` contracts for scenes, entities, sprites, state, event outputs, physics/colliders, input, scene changes, UI menus and persistence.
- Adapt game building blocks into the universal registry with game-target capability/ownership requirements, deterministic runtime hooks and versioned serialization.
- Link the LeonisMaker visual editing workflow to Spica graphs through explicit import/export of supported constructs, not a fragile implicit two-way mirror.
- Support project-level game preview, scenario replay, collision/gameplay tests and source export; preserve legacy project formats and user assets.
- Make Sparks capable of constructing a small tested 2D game from registered scene/game/UI/logic blocks before expanding to larger games.

**Source anchors:** `src/varmover/`, `src/spica/game.ts`, `src/spica/target/GameApp.tsx`, graph v2/runtime, `src/spica/catalog/data/games.generated.ts`.

**DONE when:** The same small test game can be opened/edited via supported Spica/LeonisMaker interoperability, exported and played independently, and its save/load, colliders, input and UI state pass automated regression fixtures.

---

## PHASE 12 — Quality gates, community extension and sustainable warehouse evolution

**Purpose:** Stabilize Spica as an extensible ecosystem, not just a giant installed catalog.

**Build:**

- Full compatibility and performance matrix: Windows desktop, web target, responsive preview, keyboard accessibility, low-memory CPUs, 8/12 GB VRAM GGUF planning, native build/publish checks.
- Portable registry package format for third-party blocks: manifests, signatures/checksums, version/dependency locks, licensing, source provenance, declared targets, permissions, tests and deprecation metadata.
- Local block authoring/publishing workflow with review, sandbox execution, trust decisions, rollback and no unsolicited uploads.
- Warehouse evolution: a Spark may **propose** a new block when real functionality is missing, generate code/tests in a protected workspace, then submit it for review and registration. No automatic trusted promotion from a single model answer.
- Benchmark discovery at 350K synthetic candidates and realistic registered counts; monitor search latency, UI responsiveness and target compilation costs.
- Ship polished end-to-end demos: Notes Organizer, professional dashboard, researched utility app and small LeonisMaker game.

**Source anchors:** `src/quality/`, `tests/`, `scripts/`, `src/spica/`, `src-tauri/`, `AGENTS.md`, integration/packaging manifests.

**DONE when:** Independent exports, block permission isolation, migration/rollback, package dependency resolution, research provenance, project data retention and meaningful performance benchmarks are all demonstrably validated; user-extensible blocks have a safe promotion path.

---

## Recommended phase dependency sequence

`01 One-file-per-block Registry → 02 Terminal/Glass Workbench → 03 Graph v2 → 04 Runtime SDK → 05 10K Warehouse Scale → 06 Professional App Design System → 07 Spark Architecture → 08 Research → 09 Exports → 10 Glitch Hybrid → 11 Separate Game Blocks → 12 Ecosystem`

This order prioritizes the requested visible building experience early. Phase 02 can reuse existing build/export logs and the v1 app preview; universal graph changes begin in Phase 03. Do not claim Phase 02 supports every planned block type. Preserve strict phase boundaries while fixing urgent security/compatibility regressions as they appear.

## Round completion rule

A phase is *complete* only if its stated output works, migrations preserve existing artifacts, tests actually run and pass (or environment limitations are explicitly documented), remaining failures are visible, and there is an inspectable file-level change log. If source cannot be modified or a required test cannot be run, mark the phase **partial** instead of claiming success. Preserve a checkpoint ZIP or repository commit at the end of each successful round.
