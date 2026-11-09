# SPICA

## The Internal Application Studio for Solarium
### A comprehensive product vision, architecture specification, block atlas, interaction design, development roadmap, and long-term idea book

**Status:** Concept specification and design proposal — not a claim that these features are already implemented.  
**Document edition:** 0.1 — 3 November 2026  
**Primary environment:** Solarium, including the recently merged Glitch coding capabilities and customizable Sparks.  
**Guiding promise:** *Describe it, assemble it, inspect it, own it, improve it.*

> **The core idea:** Instead of requiring every Spark to write an application line by line, provide a real, deterministic software-construction environment. A Spark can build programs by composing tested internal blocks, configuring their properties, connecting their behavior, previewing the results, and exporting real applications. Traditional coding remains available for custom behavior, optimizations, and polish. Spica belongs inside Solarium, not as a separate mandatory cloud service.

---

## Reading guide

This is an expansive **idea inventory plus an implementation-oriented engineering blueprint**. Some proposals are realistic for an initial release; others are advanced research directions. They are intentionally separated into **Core**, **Expansion**, and **Experimental** ideas. Nothing in this document should be interpreted as a promise that every proposed block is trivial to implement, that an arbitrary existing codebase can be perfectly imported, or that a small language model can reliably invent every kind of software.

- **Core:** Foundational capabilities required for a functioning, useful studio.
- **Expansion:** Capabilities to add once the core architecture is stable.
- **Experimental:** Valuable concepts with uncertain feasibility, cost, safety, or complexity.
- **Manual / Spark / Hybrid:** Three ways of controlling the **same** underlying project graph.
- **Design-time block:** A component used to define an application before the application runs.
- **Runtime block:** A component whose behavior becomes part of the generated application.
- **Recipe:** A reproducible template for connecting blocks and producing a common feature.
- **Target:** The intended execution environment, such as desktop, browser, or command-line.
- **IR:** Intermediate representation: a stable, typed representation of an application independent of the eventual programming-language output.

### Document at a glance

- **578** proposed capability blocks across **26** categories.
- **172** proposed application and feature recipes across **12** families.
- **200** studio-level ideas, principles, anti-features, and research possibilities.
- **90** explicit research questions and experiments, and **90** named test scenarios.
- **38** numbered chapters, plus appendices, code interfaces, sample schemas, a release roadmap, and reference architecture.

### Clickable chapter navigation

[1. Mission and original insight](#spica-chapter-01) · [2. Product principles and non-negotiables](#spica-chapter-02)
[3. Product boundaries: Solarium, Sparks, Spica, and Glitch](#spica-chapter-03) · [4. Personas and use cases](#spica-chapter-04)
[5. The fundamental mental model](#spica-chapter-05) · [6. Visual Studio UX](#spica-chapter-06)
[7. Design systems and interface editing](#spica-chapter-07) · [8. Graphs, flows, data, events, and state](#spica-chapter-08)
[9. Blocks as executable contracts](#spica-chapter-09) · [10. The block registry and standard library](#spica-chapter-10)
[11. Recipes, compositions, and templates](#spica-chapter-11) · [12. The Spark-to-Spica agent workflow](#spica-chapter-12)
[13. Sources and project knowledge](#spica-chapter-13) · [14. Studio project formats and persistence](#spica-chapter-14)
[15. Typed IR, compiler pipeline, and code generation](#spica-chapter-15) · [16. Runtime, previews, debugging, and testing](#spica-chapter-16)
[17. Glitch/code integration and escape hatches](#spica-chapter-17) · [18. Self-extending blocks and block authoring](#spica-chapter-18)
[19. Safety, permissions, privacy, and trust](#spica-chapter-19) · [20. Performance, caching, and resource management](#spica-chapter-20)
[21. Offline-first operation and ownership](#spica-chapter-21) · [22. Collaboration, history, and version control](#spica-chapter-22)
[23. Accessibility, learning, and internationalization](#spica-chapter-23) · [24. Product-specific opportunities](#spica-chapter-24)
[25. Example end-to-end builds](#spica-chapter-25) · [26. Engineering architecture and repository layout](#spica-chapter-26)
[27. Concrete TypeScript contracts](#spica-chapter-27) · [28. Build roadmap and acceptance gates](#spica-chapter-28)
[29. Risk register and design trade-offs](#spica-chapter-29) · [30. Open questions, research tasks, and experiments](#spica-chapter-30)
[31. The expanded Spica standard-library idea atlas](#spica-chapter-31) · [32. A library of feature recipes and complete starter applications](#spica-chapter-32)
[33. Additional ideas beyond the block atlas](#spica-chapter-33) · [34. Test scenarios and quality gates](#spica-chapter-34)
[35. Suggested documentation and contributor standards](#spica-chapter-35) · [36. A complete example: from one sentence to a trustworthy app](#spica-chapter-36)
[37. What to implement first — an unambiguous priority answer](#spica-chapter-37) · [38. What Spica changes over the long term](#spica-chapter-38)

**Appendices:** A. Source alignment · B. Development labels · C. Acceptance record · D. Product manifesto.

---

# Part I — The product

<a id="spica-chapter-01"></a>
## 1. Mission and original insight

Traditional AI coding agents are asked to solve many separate problems simultaneously: understand a request, choose a stack, create a project, remember its structure, write source code, keep imports synchronized, build it, debug it, and explain what happened. Repeating this process for a relatively standard button, list, settings panel, or file-save workflow wastes effort. A limited local model can fail not because the required feature is impossible, but because too many implementation details must be generated correctly from scratch.

Spica changes the **unit of creation**. The default unit is not the source-code token; it is a **capability with a checked contract**. A `Button` block has renderable behavior. A `Save File` block defines permissions, inputs, outputs, cancellation, errors, and test coverage. A `Document Editor` recipe can assemble several lower-level blocks into a coordinated feature. The Spark chooses, configures, connects, and verifies those pieces. Only genuinely new behavior requires custom code.

The metaphor should be understandable without implying that apps are just webpages. WordPress provides a useful example of composition, Scratch a useful example of flows, and classic IDEs a useful example of professional development. Spica should go beyond all three by generating **inspectable, locally owned, independently runnable programs**.

### The five promises

1. **Real output.** A successful action produces an actual artifact: a saved project, an application, a build, a verified test, or a concrete change.
2. **Reusability.** A solved problem can become a trusted block or recipe that future projects can reuse.
3. **Control.** A human can edit what a Spark creates and veto destructive or privileged operations.
4. **Honesty.** The UI reports actual work and real checks, never theatrical progress or fictional success.
5. **Freedom.** Projects remain editable and exportable without requiring a permanent Solarium account or subscription to run.

### What Spica is not

Spica is not a magical compiler that turns any natural-language instruction into perfectly functioning software. It is not a promise to reverse-engineer arbitrary applications. It is not a replacement for developer judgment in security-critical, performance-sensitive, or highly specialized systems. It must not hide the difference between an attractive preview and a real, verified executable.

<a id="spica-chapter-02"></a>
## 2. Product principles and non-negotiables

### Principle 1 — Determinism beneath AI

The same saved graph, block versions, target versions, settings, and toolchain should produce equivalent builds. AI may suggest graph changes; it does not decide whether an individual connection is type-safe or whether a generated file exists. Deterministic routines handle those decisions.

### Principle 2 — One truth, many editors

Manual mode, Spark mode, graph mode, and code mode are different views or operations on the same authoritative project model. There must not be four competing copies of an app whose state silently drifts apart.

### Principle 3 — Visual first, source always available

Users can create an app without writing code, but they must always be allowed to inspect generated code and add custom modules. Avoid trapping advanced users inside an overly simplified editor.

### Principle 4 — The studio works without AI

If the local model is unloaded, unavailable, slow, or incapable of tool calling, the user must still be able to open a project, drag blocks, edit properties, preview, test, and export. Spica is a development tool first and an AI-controlled tool second.

### Principle 5 — The generated app runs independently

A user who exports a Tauri program should not need Solarium running in the background for basic application logic. Runtime components included in the generated application must be explicit dependencies, not secret calls into Spica.

### Principle 6 — Capabilities before promises

Each block declares its supported operating systems, targets, permissions, inputs, outputs, and maturity. Unsupported capabilities are disabled or explained before assembly. A browser build cannot silently inherit unrestricted native filesystem access.

### Principle 7 — Validate early and at multiple levels

Check configuration, port types, target compatibility, permissions, graph invariants, generated syntax, dependency resolution, runtime behavior, and actual user acceptance criteria. A successful TypeScript build alone does not prove that a requested editor works.

### Principle 8 — No fake agency

The Spark can plan and operate tools. Spica itself owns execution and checks. Every Activity entry must map to an event that actually occurred. Do not invent internal thoughts or imply code was written if only a plan was created.

### Principle 9 — Preserve work

Use autosave, atomic writes, snapshots, undo/redo, migration backups, and reversible changes. A failed compile must not delete the working version of an app. A Spark must not rewrite an unrelated file without authorization.

### Principle 10 — Composability scales better than monoliths

A video editor should be assembled from reusable media, timeline, file, state, and UI capabilities rather than a single uninspectable `Make Video Editor` block. High-level recipe blocks may wrap these lower-level pieces, but users should be able to inspect or expand them.

### Principle 11 — Testable blocks are valuable blocks

Every official behavior block needs tests or a clear reason why an automated test is not meaningful. A polished icon without verified behavior does not qualify as production-ready functionality.

### Principle 12 — Keep generated and hand-written code separate

Regenerating a graph must not overwrite manual customizations. Prefer generated directories, defined extension points, adapters, and source maps. If a user edits generated code directly, warn that regeneration may replace it and offer to move the edit into a durable extension.

### Principle 13 — Explicit trust boundaries

A downloaded block is untrusted until verified. AI-proposed code is untrusted until reviewed or approved according to the user's policy. Native command execution, network calls, filesystem writes, credential access, and hardware control need separate capability grants.

### Principle 14 — Small models should succeed at small, bounded jobs

Tasks should be decomposed into choosing typed blocks and filling constrained properties rather than producing giant free-form patches. A smaller model can be useful when the surrounding runtime provides reliable building blocks.

### Principle 15 — Accessibility is foundational

Keyboard-only editing, screen-reader-readable graph descriptions, reduced-motion options, understandable error messages, configurable density, and non-drag alternatives must be present from the first usable version.

### Principle 16 — No forced cloud dependency

Local projects, local models, local block registries, local builds, and offline documentation should work without an account. Optional cloud syncing or remote build services may be offered later, but never be the only way to produce a normal app.

### Principle 17 — Respect existing architecture

Do not destabilize Solarium's inference loop merely to introduce Spica. The studio should use existing task and tool infrastructure through a clean integration boundary, not duplicate model runtimes or build another enormous chat route.

### Principle 18 — Prefer boring correctness over animated theater

A plain verified build is more valuable than a spectacular loading animation that conceals failure. Animation should help communicate real progress, not substitute for it.

<a id="spica-chapter-03"></a>
## 3. Product boundaries: Solarium, Sparks, Spica, and Glitch

**Solarium:** The host workspace. Owns identities, project selection, conversations, Sources, configured models, permissions, workspace navigation, and shared UI language. It may own the global event bus and task scheduler.

**Sparks:** Customizable AI companions. Their personalities change how they speak and collaborate, not the correctness of compiler checks or filesystem operations. A Spark may request Spica operations via typed tools, interpret errors, propose fixes, and explain the result.

**Spica:** The application design system and construction engine. Owns project graphs, block registry, layout representation, recipes, previews, target compatibility, code generation, compilation orchestration, and construction-specific diagnostics.

**Glitch-derived coding capabilities:** The code-oriented environment incorporated into Solarium. Owns conventional source editing, code diagnostics, language integrations, custom implementations, diff review, and advanced repairs, coordinated with Spica rather than competing with it.

**The output application:** A standalone project created by Spica. Owns its own generated sources, dependencies, runtime assets, app configuration, and licensing notices. It should remain functional if Spica is removed.

**Recommended boundary:** Solarium calls Spica through an internal service interface (`SpicaService`), whether Spica eventually runs in the same process or a separated worker. Avoid direct imports from chat presentation components into the compiler.

### Collaboration flow

`User goal → Spark understands → Spica proposes a graph → validation checks it → user reviews if needed → Spica builds → Glitch refines exceptions → Spica verifies → Solarium reports and stores artifacts.`

A Spark can optionally remain in a *co-pilot mode* that never changes the graph without an explicit Apply command. In an authorized *builder mode*, it can perform lower-risk graph edits automatically while still requiring approval for destructive or privileged actions.

<a id="spica-chapter-04"></a>
## 4. Personas and use cases

### Creator with no coding background

Builds a small inventory app, notes program, image utility, personal website, or desktop dashboard by using templates and visual components. Needs understandable properties, live previews, friendly errors, undo, and working export.

### Experienced developer

Wants to skip repetitive scaffolding, work within a transparent React/Tauri project, replace individual blocks with source modules, inspect generated code, run normal tooling, and integrate version control. Will reject Spica if it hides its runtime or breaks hand-written code.

### Local-model enthusiast

Runs a GGUF model with limited memory or imperfect tool calling. Benefits from narrow, typed tools and deterministic recipes. Needs offline operation and low-resource previews.

### Independent software creator

Creates reusable apps without paid hosting or proprietary runtime lock-in. Wants clear licensing and the right to sell software built with the tools.

### Student or beginner

Learns cause and effect through visible flows, inspectable generated code, guided explanations, and block-level troubleshooting. Should be able to graduate from blocks into conventional source development.

### Accessibility-focused user

Builds through keyboard commands, forms, and accessible tree views instead of relying solely on precision dragging. A Spark can translate natural-language descriptions into actions, but the user retains direct controls.

### Small organization

Creates internal forms, dashboards, asset catalogs, ticket systems, schedule utilities, and file-processing tools. Needs deployment, database migration, access control, backups, and repeatable builds.

### Content creator

Creates media exporters, automation utilities, thumbnails, video-processing helpers, and simple creative apps. Needs timelines, file import, progress reporting, background jobs, and export presets.

### Advanced engine experimenter

Assembles tool interfaces, editors, pipelines, and experimental algorithms, but accepts that specialized geometry or graphics kernels still require traditional code.

<a id="spica-chapter-05"></a>
## 5. The fundamental mental model

A **Workspace** contains one or more **Projects**. Each Project has one or more **Applications** or build targets. Each Application contains **Screens**, **Components**, **Flows**, **Data Models**, **Resources**, **Tests**, **Permissions**, and **Target Profiles**. Blocks are nodes in these collections, while recipes are parameterized reusable subgraphs.

Spica distinguishes five graph layers:

1. **Visual tree:** Spatial hierarchy: windows, screens, panels, containers, text, controls, accessibility semantics.
2. **Behavior graph:** User events, conditions, actions, effects, asynchronous operations, error paths.
3. **Data graph:** Models, stores, schemas, queries, transformations, persistence boundaries.
4. **Resource graph:** Assets, themes, fonts, images, locales, dependencies, generated and user-provided files.
5. **Build graph:** Targets, toolchains, permissions, platform bindings, validation, packaging, signing, release artifacts.

These layers must have explicit references to each other rather than one undifferentiated spaghetti canvas. A `Save` button lives in the visual tree; its click event triggers a flow in the behavior graph; that flow retrieves data from a store in the data graph; the result uses a filesystem capability in the target profile.

### Three complementary workspaces

**Design view:** Position and style interface components.  
**Logic view:** Connect events, actions, data, and error handling.  
**Code view:** Inspect generated code and edit custom modules.

Additional views: **Data**, **Assets**, **Preview**, **Tests**, **Builds**, **History**, **Permissions**, **Blocks**, and **Recipes**. These should be reachable through a consistent compact navigation model, not a dozen pop-up windows.

### Graph hierarchy and scale

A project with thousands of nodes cannot remain readable as one flat graph. Require named subgraphs, collapsible regions, zoom-independent labels, minimaps, search, bookmarks, jump-to-definition, and references. A high-level `ImageEditorWorkspace` recipe can open into its inner `Canvas`, `LayerStore`, `ToolManager`, and `ExportFlow` graphs. Users may replace a subgraph without rewriting the rest.

---

# Part II — The studio experience

<a id="spica-chapter-06"></a>
## 6. Visual Studio UX

### Main layout

A sensible default has a narrow navigation rail at the far left; a searchable block library and project explorer beside it; the central design canvas or graph; a right-hand properties and inspector panel; and a collapsible bottom panel for builds, diagnostics, logs, tests, and real Spark activity. Tabs can switch between screens or documents. Panels can be resized, collapsed, floated, or restored to a known-good layout.

### Main navigation

- **Home:** Recent projects, templates, tutorials, and current tasks.
- **Studio:** Visual editor, block canvas, app preview, and selected object inspector.
- **Flows:** Behavior graphs and execution paths.
- **Data:** Schemas, stores, migrations, fixtures, and queries.
- **Assets:** Images, fonts, sounds, icons, translations, and media.
- **Blocks:** Local registry, versions, ratings from local trust checks, and custom block authoring.
- **Recipes:** Reusable feature packages and project templates.
- **Code:** Generated files, custom modules, diff and search.
- **Test:** Unit, integration, UI, permissions, accessibility, and benchmark runs.
- **Build:** Targets, toolchains, bundling, distributions, and export history.
- **History:** Autosaves, semantic changes, checkpoints, branches, and rollbacks.
- **Settings:** Studio preferences, privacy, toolchain paths, permissions, cache size, and keybindings.

### Interaction details

Support drag/drop, keyboard insertion, command palette, bulk selection, alignment guides, snap grids, relative and absolute sizing, distribution tools, frame-based layout, duplicate, rename, group, extract recipe, swap block, replace connection, copy/paste, nested selections, zoom to fit, find references, and quick connector creation. A block can be inserted by typing its name, choosing a compatible port result, or asking the Spark to add it.

When a user drags from an output port, show only valid compatible inputs first. Invalid choices remain searchable but explain why they are incompatible. Provide a connector inspector that identifies type conversions, asynchronous boundaries, permission requirements, and cycle warnings.

### Graph readability ideas

Offer orthogonal or curved wires; selectable routing; wire labels and color independent of meaning; collapsed bus connectors; port search; link bundling; knot nodes; local neighborhoods; upstream/downstream trace; warnings for circular dependencies; a timeline view for event chains; a plain-English flow reader; and an automatically laid-out view that never destructively moves user-positioned nodes without consent.

### A clear activity surface

Activity entries should describe actual operations: `Block added`, `Graph validated`, `Preview started`, `Rust compile failed`, `Test passed`, `File exported`. Each entry should have an operation ID, a timestamp, a status, and a link to the corresponding artifact or error. A model's text generation is not a substitute for those events.

### Focus and beginner modes

Beginner mode shows only essentials, known-good recipes, contextual help, and a guided flow. Advanced mode exposes every port, schemas, target flags, file mappings, and verbose diagnostics. Focus mode hides side panels. Accessibility mode increases hit targets and enables keyboard-first controls. All modes edit the same project model.

<a id="spica-chapter-07"></a>
## 7. Design systems and interface editing

### Visual design should produce real layout rules

Avoid encoding a design solely as absolute pixel coordinates. Prefer flex, grid, stacks, anchors, constraints, responsive rules, and a measured layout engine. Absolute positioning remains available for deliberate creative scenes. Responsive previews should show different viewport widths, densities, text scales, and reduced-motion settings.

### Theme system

A project may define themes with tokenized colors, typography, spacing, radii, shadows, blur, elevations, motion, and density. Themes should support semantic tokens such as `surface`, `surfaceRaised`, `textPrimary`, `accent`, `danger`, `warning`, `success`, and `focusRing`. A Spark can offer theme proposals, but the tokens remain human editable.

### Component authoring

Turn any component or arrangement of components into a reusable UI component with named properties, events, slots, validation, documentation, and test fixtures. Examples include toolbar, settings row, resizable panel, property grid, file picker, side navigator, document tab, timeline lane, or modal wizard.

### Screen structure

Provide routes, nested navigation, breadcrumbs, workspaces, tabs, modal layers, toasts, side sheets, multi-window support where the target permits it, and explicit screen lifecycle events. The user should be able to inspect a route graph and know why a page can or cannot be reached.

### Visual states

Every visual component can define idle, hover, active, disabled, focus, loading, empty, error, success, and selected states. A preview toggles states without needing a live backend. Explicit state matrices prevent an app from looking complete while lacking crucial error or empty states.

### Assets and licensing

Imported media should retain its source, license if known, hash, author notes, scaling rules, compression settings, and export eligibility. Spica must not claim an imported image is safe for commercial use just because it can process it.

### Accessibility diagnostics

Flag missing labels, inaccessible contrasts, keyboard traps, missing focus states, non-semantic buttons, incomplete dialog focus management, and motion that ignores preferences. Some findings require manual review; report them honestly instead of promising full compliance from an automated checker.

<a id="spica-chapter-08"></a>
## 8. Graphs, flows, data, events, and state

### Distinguish dataflow from control flow

A `Transform Image` block takes data and returns data. A `On Click` block starts an event-driven sequence. A `Database Query` block is an asynchronous effect. Treating these as identical wires leads to race conditions and incomprehensible graphs.

Recommended port kinds:

- **Value:** Immutable data or typed references.
- **Signal:** Event notification with a defined payload.
- **Action:** Execution trigger that may have success/failure branches.
- **Stream:** A sequence of values with backpressure policy.
- **Resource:** A tracked handle whose lifetime must be managed.
- **Binding:** Reactive connection between UI state and data state.
- **Capability:** A permission-checked dependency such as filesystem or network access.

### Concurrency model

The graph engine should define whether multiple actions can run concurrently, whether the last request wins, whether operations queue, whether cancellation is supported, and what happens on errors. Each asynchronous block can expose policies: `drop`, `queue`, `restart`, `parallel(maxN)`, or `serialize`. Avoid implicit arbitrary concurrency.

### State scope

Support local component state, screen state, application state, persisted preferences, durable document state, session-only state, user profile state, and external synced state. Clearly distinguish ephemeral UI state from data that must survive a crash. The same `Variable` label must not hide six persistence semantics.

### Transactions and undo

For data-editing apps, changes may be grouped into atomic operations with inverse actions, checkpointing, and conflict detection. In an image editor, a brush stroke is one undo operation rather than thousands of individual pixel writes. Database transactions are not interchangeable with UI undo history; model the distinction.

### Error handling

Every effectful operation should have typed outcomes such as `success`, `validation_error`, `permission_denied`, `cancelled`, `timeout`, and `unexpected_failure`. Visual flows need catch/finally semantics, error boundaries, retry policies, and user-visible recovery paths. A Spark should never hide an actual failure behind a generic success label.

### Schema evolution

Data blocks declare versions and migrations. Projects with persisted documents need backward compatibility, validation of old files, and backups before risky migrations. Support migration preview and sample fixture testing.

<a id="spica-chapter-09"></a>
## 9. Blocks as executable contracts

Each block should be defined by metadata **and** a verified implementation. Metadata is not sufficient. An attractive JSON specification without an executable target binding is a *draft block*, not a production block.

### Suggested block anatomy

- `id`: Stable namespace and name (`spica.fs.save-file`).
- `version`: Semantic version of the block contract.
- `label`, `description`, `category`, `keywords`, `icon`.
- `kind`: UI, action, value, source, sink, flow, recipe, resource, or build.
- `inputs`, `outputs`, `events`, `slots`: Typed interfaces.
- `properties`: Schema, defaults, constraints, accessibility metadata.
- `capabilities`: Filesystem, process, network, hardware, secrets, etc.
- `targets`: Desktop, browser, CLI, service, plugin, and supported platform subsets.
- `codegen`: Supported backend adapters and required packages.
- `runtime`: Optional independent runtime component.
- `validation`: Fast static checks and deeper runtime tests.
- `documentation`: Examples, limits, errors, accessibility notes.
- `migration`: Rules for compatible upgrades.
- `provenance`: Origin, author, license, signature, checksums, audit state.

### Maturity levels

**Draft** → description exists; no executable guarantee.  
**Prototype** → executable in a restricted demo; incomplete testing.  
**Beta** → real target implementation with important test coverage.  
**Stable** → documented behavior, compatibility policy, tests, migration support.  
**Deprecated** → readable and buildable for old projects where feasible, but not recommended.  
**Blocked** → disabled because of a known vulnerability, revoked trust, or incompatible toolchain.

### Block contracts versus examples

A `Save File` example must specify whether it writes bytes or text, how paths are selected, which errors are emitted, whether it can overwrite files, whether the operation is atomic, and whether it can run in a browser. The editor should generate these details as structured configuration, not hope the model remembers them.

### Typed compatibility

Port compatibility should consider data type, nullability, ownership, sync/async semantics, target availability, permission, thread affinity, and lifetime. An `ImageBuffer` should not be silently confused with an image file path. A `FileHandle` with read permission cannot be plugged into an operation requiring write permission.

<a id="spica-chapter-10"></a>
## 10. The block registry and standard library

Spica needs a curated **official library** of essential blocks and a separate **custom library** that anyone can expand. The block registry should index contract signatures, semantic tags, supported target environments, dependency graphs, examples, permissions, migrations, and tests. The search UI should favor useful compatible blocks over blocks that merely share a keyword.

A tiny high-quality base library is better than 1,000 pretend blocks that generate placeholders. This blueprint includes an ambitious catalog later; treat it as a roadmap, not a claim of ready-to-ship implementations.

### Search behavior

Users can search for `save as`, `crop`, `database form`, `window tabs`, `zip`, or `offline`. The registry returns blocks and recipes with descriptions, examples, target badges, permission warnings, and whether the block is already installed. A Spark uses the same registry API and receives only compatible candidates when enough context is known.

### Registry operations

`searchBlocks`, `resolveBlock`, `installBlock`, `validateBlock`, `getCompatibleTargets`, `getMigrationPlan`, `listCapabilities`, `createBlockDraft`, `publishBlockLocally`, `deprecateBlock`, `auditBlock`.

### Dependency strategy

Resolve exact versions into a lockfile; detect conflicts; reuse shared runtimes rather than shipping duplicate heavy libraries; cache downloaded official dependencies with checksums; permit offline installs from local packages; provide deterministic removal; and show why each dependency is included.

<a id="spica-chapter-11"></a>
## 11. Recipes, compositions, and templates

A **block** implements one capability. A **recipe** builds a feature from multiple blocks. A **template** builds a starting project from recipes, design tokens, targets, and documentation. A **workflow** executes a reproducible sequence of actions, such as creating a Tauri project, generating files, running checks, and packaging a build.

### Recipes should be parameterized

A `SettingsPanel` recipe might accept `fields`, `theme`, `persistTo`, and `resetBehavior`; expose `onChanged`, `onSaved`, and `onError`; and generate nested controls and persistence flows. Users can open its internals, override slots, or fork a copy without modifying the official recipe.

### Provenance and updates

A project saves the recipe version and optionally stores the expanded graph. Upgrading can show semantic changes, generated file diffs, compatibility warnings, and test outcomes. Never silently mutate dozens of existing projects because a shared recipe was updated.

### Recipe discovery from use

When a Spark repeats the same successful composition across projects, Spica can suggest extracting a recipe. It must not automatically publish private project code or assets. Suggested recipes need named inputs, outputs, documentation, validation, and ownership metadata.

### Template gallery

Use offline templates for a notes app, image utility, desktop dashboard, document editor, library manager, inventory application, media organizer, timer, file converter, code editor, personal knowledge base, and simple games/tooling interfaces. Mark template quality and target coverage clearly.

<a id="spica-chapter-12"></a>
## 12. The Spark-to-Spica agent workflow

A Spark's job should be to express **intent as structured changes**, not to fabricate implementation success. The agent can carry personality through its dialogue while every tool call remains typed, logged, and independently verified.

### A reliable transaction

1. **Interpret:** Identify the user's requested outcome, constraints, and existing project.
2. **Inspect:** Read project metadata, relevant Sources, selected graph, and permitted filesystem facts.
3. **Plan:** Identify required blocks, recipes, targets, and any missing capabilities.
4. **Preview changes:** Produce a graph diff and permission summary.
5. **Authorize:** Obtain approval for dangerous changes according to user policy.
6. **Apply:** Make atomic graph operations with a journal and undo record.
7. **Validate:** Run static graph checks and repair only concrete failures.
8. **Generate:** Produce source using registered target adapters.
9. **Build/test:** Run available toolchain checks and collect real diagnostics.
10. **Observe:** Consume actual results, not guessed ones.
11. **Refine:** Make bounded changes when tests show a problem.
12. **Deliver:** Show changed graph components, files, checks, preview, limitations, and export path.

### Tool vocabulary for Sparks

Keep the first tool interface small: `spica.inspect_project`, `spica.search_blocks`, `spica.inspect_block`, `spica.propose_changes`, `spica.apply_changes`, `spica.validate_graph`, `spica.preview`, `spica.run_tests`, `spica.export_project`, and `spica.read_diagnostics`. Avoid exposing hundreds of low-level actions at once. The underlying engine can support many more operations without forcing the model to learn a gigantic tool schema.

### Proposal-based editing

A Spark can return a `SpicaChangeSet` containing operations such as add node, remove node, connect ports, modify property, add screen, import asset, insert recipe, set target, or update test. The engine validates all operations before committing. Apply the change set as one undoable transaction. For an incompatible operation, return a specific reason with possible valid alternatives.

### Permissions and operating modes

**Ask mode:** The Spark proposes changes but cannot apply them without approval.  
**Auto mode:** Safe graph and design changes may apply automatically; destructive and privileged operations need explicit approval.  
**YOLO / unrestricted local mode:** The user may relax approval for selected scopes, but operating-system boundaries and audit logs should still exist. Even in this mode, never misrepresent a failed action as successful.

A permission should be scoped to a project, operation, resource, and optional duration. `Allow saving within this project` is not the same as `Allow writing anywhere on the computer`.

### Handling limited model capability

If the local model cannot call tools reliably, offer a structured command form or staged plan extraction. If parsing fails, show a validation error and permit retry. Do not silently coerce arbitrary malformed JSON into an empty request. The simplest fallback is a human-readable recommendation plus a button that opens the correct block/recipe in the studio.

### Iterative planning with real stopping conditions

A bounded build loop may retry only when a real validation or test indicates a correctable problem. Use configurable limits on attempts, changes per cycle, resource use, and build time. If a loop stops, retain the partial project, identify unfinished tasks, and present the last passing checkpoint.

### Clarifying and non-clarifying behavior

The Spark should inspect facts it already has instead of asking whether an inspected folder is empty. For a genuinely consequential ambiguity—such as overwriting an existing database—it should ask the user rather than guess. A low-risk default such as a color choice can be applied provisionally and changed later.

<a id="spica-chapter-13"></a>
## 13. Sources and project knowledge

Spica should use Solarium's proposed **Chat Sources** and **Project Sources** instead of inventing another incompatible memory system. Chat Sources stay tied to a conversation. Project Sources are shared within the selected project. Both preserve origin and creation metadata; retrieved sources are reference material, not privileged instructions.

### Knowledge objects relevant to Spica

Product requirements, design references, target platform rules, repository conventions, dependency versions, test plans, accessibility requirements, architecture decisions, existing code explanations, user-defined recipes, licensing constraints, and outstanding bugs.

### Retrieval discipline

A Spark requesting `Create the export dialog` should retrieve relevant source slices for export formats, theme conventions, error handling, and the current project architecture. Do not inject hundreds of pages of unrelated notes into a small local model. Prefer exact project files and current graph state when they contradict stale notes, while flagging the conflict.

### Sources-to-block relationships

A saved design reference may be attached to a UI component. A saved API document may be attached to a network recipe. A performance requirement may be attached to a test. A block's inspector should show which Sources justified its configuration, especially when the Spark made the change.

### Staleness

Store source timestamps and versions. Saved external documentation can become outdated. If Web Search is disabled, Spica may use local saved references but must not quietly perform online refreshes.

<a id="spica-chapter-14"></a>
## 14. Studio project formats and persistence

Define a human-inspectable project format rather than relying on an opaque binary database. An example convention is a project directory containing `.spica/project.json`, a stable graph representation, a lockfile, assets, a generated source tree, custom code, tests, previews, and export configurations. These filenames are proposals, not statements about the current Solarium repository.

### Project metadata

Include format version, project ID, display name, creation/update times, target profiles, project root, block locks, recipe locks, allowed capabilities, design tokens, source references, resource identifiers, compiler version, and migration history.

### Graph storage

For modest projects, JSON is sufficient. For very large graphs, consider partitioned JSON modules or a compact database indexed by graph ID while preserving deterministic export to text. Use stable node IDs; do not rely on array positions as references. Normalize source paths and validate path traversal before reads/writes.

### Save safety

Autosave to a temporary file, verify checksum, atomically rename, and retain a recoverable journal. The frequency of autosave must not interrupt rendering or compilation. Recoverable backups should be pruned by retention policy with user controls.

### Export portability

An exported Spica project bundle should include graph files, lockfile, compatible block manifests, relevant custom code, assets, and project requirements. Secrets must not be included unless the user explicitly chooses a safe export mechanism. Standalone generated apps should include ordinary build instructions and license notices.

### Compatibility and migration

Changing project format versions should involve a versioned migration function, backup, dry run, and validation. Old projects can be opened in a read-only compatibility mode if migration is unsafe. Provide a migration report, not a silent rewrite.

<a id="spica-chapter-15"></a>
## 15. Typed IR, compiler pipeline, and code generation

The **most important engineering decision** may be to make the typed graph and its intermediate representation the source of truth. UI components, agent proposals, and recipes generate graph changes; compiler adapters translate the IR into target-specific code.

### Proposed compilation stages

`Read project → resolve dependencies → validate schema → validate graph → resolve permissions → normalize components → lower recipes → build typed IR → optimize IR → generate target source → format → install/resolve dependencies → compile → run tests → package → record provenance.`

### Why an IR matters

Without an IR, every block author would need to directly write React, Rust, Web, Electron, and other output variants, with inconsistent semantics. An IR standardizes navigation, events, data operations, effects, resource lifetime, errors, and UI composition. Target adapters still have to implement unsupported platform details honestly; the IR cannot erase real differences.

### Target plan

**First target: Tauri 2 + React + TypeScript + MUI + Rust.** This matches a common desired desktop stack and offers a realistic starting point for native functionality through explicit Rust commands and permissions. The code generator should verify actual installed dependency versions rather than blindly assuming package APIs remain unchanged.

**Second target: Web + React + TypeScript.** Useful for portable apps but subject to browser sandbox limitations. Some file and process blocks must become incompatible or use browser-approved alternatives.

**Third target: Electron + React + TypeScript.** Useful for scenarios requiring Electron APIs. Keep its permission model distinct from Tauri.

**Later:** CLI utilities, backend services, mobile wrappers, headless automation, plugin targets, and specialized game-tool targets. Do not promise write-once perfect parity across all targets.

### Code ownership policy

Generated files live in clearly marked directories or have machine-readable ownership metadata. Custom files are never overwritten during normal regeneration. Reusable custom behavior is invoked via stable adapters or extension points. Generated code should be reasonably idiomatic, formatted, type-checked, documented where useful, and free of hidden proprietary calls.

### Incremental generation

Hash graph modules and block implementations. Regenerate only affected modules when safe. Build a dependency DAG that distinguishes a theme token change from a new native filesystem permission. Cache build outputs by target and toolchain version. Never assume that a fast preview proves a production build will succeed.

### Build artifacts

Each build should record target, mode, runtime dependency versions, compiler version, build ID, source revision, warnings, tests executed, outputs, and checksums. Provide reproducibility metadata, not a fake `100% complete` label.

<a id="spica-chapter-16"></a>
## 16. Runtime, previews, debugging, and testing

### Live preview layers

**Static preview:** Render UI structure from the graph without running native capabilities.  
**Interactive preview:** Execute safe UI events and simulated/test data.  
**Integration preview:** Launch an actual local app sandbox with selected permissions.  
**Production build:** Compile the real target using the actual toolchain.

A preview must show which mode is active. An image editor that renders a canvas but has nonfunctional export must not be marked fully implemented.

### Inspectability

Click a component to inspect its graph node, generated source mapping, current state, subscribed events, timings, and relevant errors. Trace a user's click through event blocks to data writes and UI updates. A developer should be able to answer *what changed, why, and where*.

### Debugger ideas

Breakpoint on node entry or exit; step into recipes; inspect port values; observe streams; replay deterministic flows; record network mocks; watch state mutations; show blocked permissions; step backwards through a recorded, side-effect-free trace; capture logs; compare successful and failed runs; attach test fixtures; inspect memory and frame timing.

### Test pyramid

Block unit tests; recipe contract tests; graph validation tests; generated-code compile tests; integration tests; UI accessibility tests; platform-specific smoke tests; end-to-end user scenario tests; performance regressions. Prefer fixtures and deterministic fake services for quick tests; reserve real hardware and third-party services for controlled integration tests.

### No fabricated test output

If `cargo check` was not run, the report must say `Not run`, not `Passed`. If only a web preview ran, it must not say the Tauri build succeeded. The event log is the evidence source for these claims.

### Diagnostics hierarchy

A useful diagnostic includes severity, stable code, affected node/port, reason, expected/actual type, target, file location if known, suggested fix, and whether the error blocks export. Messages should be written for both beginners and technical users, with an expandable detailed view.

<a id="spica-chapter-17"></a>
## 17. Glitch/code integration and escape hatches

### Code is a first-class companion

A user can open generated code read-only by default and inspect how an individual block is implemented. A `CustomFunction` or `NativeExtension` block can call stable interfaces in hand-written files. Glitch-derived editing capabilities can author, test, and maintain these extensions.

### Three code relationships

**Generated:** Owned by Spica; can be regenerated safely.  
**Custom:** Owned by the user or Spark under explicit permissions; survives regeneration.  
**Vendor:** Versioned block runtime or third-party dependency; updated through dependency management.

### Code-first import limitations

An existing project may be recognized as React/Tauri/Electron and mapped into a partially editable Spica workspace. Existing source can be wrapped as `ExternalComponent` or `ExternalModule` blocks. Perfect conversion of arbitrary code to visual graphs is generally not feasible; report which portions are visualized, wrapped, or left as external code.

### Diffs and change review

Before a Spark edits code, show files affected, change summary, security implications, format/compile checks, and a reversible checkpoint. Code changes generated by a new recipe should be attributable to that recipe. A user can reject one proposed change without losing an unrelated accepted change, where atomic dependencies permit.

### Performance work

Spica should not insist that every optimized graphics kernel be built visually. Native Rust, GPU APIs, FFmpeg, image processing libraries, and specialized mathematics may require source modules. The graph provides stable calls into those implementations. The studio should surface profiler output so a Spark can focus its polish where it matters.

<a id="spica-chapter-18"></a>
## 18. Self-extending blocks and block authoring

### The block forge

Offer a block-authoring wizard that creates a draft manifest, property schema, typed ports, target adapters, test fixtures, icon, docs, and version. Developers can implement behavior in TypeScript or Rust initially, with Python used for optional auxiliary processes rather than assumed as a universally portable runtime.

### The suggested self-expansion loop

1. A Spark identifies a missing capability rather than pretending a near-match works.
2. It searches existing compatible blocks, recipes, and local custom modules.
3. It proposes a new block contract with inputs, outputs, failure cases, and permissions.
4. A human approves creation and target scope when required.
5. Glitch code tools implement the contract.
6. Spica executes contract tests, integration checks, and permission review.
7. The candidate enters the project-local registry as `Prototype` or `Beta`.
8. Once verified, it can be promoted to the user's reusable library.
9. Promotion to an official catalog requires a separate review process.

### Important distinction

**Learning** here means the studio accumulates reusable verified software components; it does not imply that the LLM's weights have changed. A smaller model can become more effective because the environment offers more high-quality actions.

### Package security

Third-party blocks should declare capabilities and dependencies, carry signatures/checksums when available, disclose native code, and run through static scanning plus runtime tests. Be especially cautious of arbitrary build scripts, post-install hooks, filesystem access, network exfiltration, and unsafe native bindings.

### Ownership and licensing

Each block has author and license metadata. An app generated using a block must obey the block's license and attribution requirements. Official blocks should favor permissive licensing for broad reuse. The creator's right to sell an app is subject to the actual licenses of included assets and dependencies.

<a id="spica-chapter-19"></a>
## 19. Safety, permissions, privacy, and trust

### Threat model

Consider malicious block packages; compromised dependencies; prompt injection in retrieved project documents; accidental deletion; secret exposure; network exfiltration; unsafe command execution; template supply-chain attacks; unsafe native APIs; untrusted generated code; and mistakes by the Spark.

### Permission scopes

Filesystem read within project; filesystem write within project; write outside project; network by host; subprocess execution; shell access; microphone; camera; notifications; clipboard; credential storage; global shortcuts; hardware connections; database access; native window control; background jobs; package installation; app deployment.

Permission grants should be visible, revocable, time-limited where possible, and documented in the project. Build-time capabilities and runtime app capabilities are distinct. For example, a builder may need network access to fetch dependencies, while the output app may require none.

### Safe defaults

No arbitrary shell commands from installed blocks without consent. No silent upload of user projects. No automatic publication of custom blocks. No credential values written to graph JSON. No destructive file operations without a backup or explicit authorization. No invisible network requests when the user has disabled networking.

### Sandboxing

Use process isolation, restricted working directories, capability-scoped IPC, resource quotas, network policies, and trust levels wherever the operating system permits. Sandboxing is not a universal guarantee, particularly for native code or privileged build tools; show residual risks honestly.

### Sensitive domains

Blocks for financial, medical, legal, physical hardware, security, or identity workflows should include explicit limitations, stronger permission boundaries, and domain-specific tests. Spica can assist development but cannot certify the safety or legal compliance of an app simply because it compiles.

### Hardware safety

For printer-control or firmware-related targets, distinguish UI simulations from physical commands. Never treat a visual preview of movement as verification that an actuator path is safe. Hardware actions need manual confirmation, real device-state checks, emergency-stop behavior, and device-specific protocols.

<a id="spica-chapter-20"></a>
## 20. Performance, caching, and resource management

### Editing performance

Virtualize large node lists; use incremental graph validation; batch updates; avoid recomputing layout on unrelated property changes; index graph connections; cache thumbnails; throttle preview restarts; and move expensive validation into workers. Aim for responsive interactions even with a large project, but establish measurable budgets on representative hardware before making guarantees.

### Build performance

Cache codegen outputs, package resolution, generated assets, target-specific compilation artifacts, and unchanged test results when safe. Invalidate caches by content hashes and relevant toolchain versions. Provide a `Clean Build` command to diagnose stale state.

### Model resource awareness

When a GGUF model consumes most available VRAM, Spica should avoid launching heavy GPU previews that exceed available resources. Show resource requirements, allow CPU fallback where reasonable, and serialize heavy operations. Python auxiliary services should not be assumed to accelerate llama.cpp token generation.

### Background work

Builds, tests, imports, and asset processing should be cancellable, resumable when possible, and visible through actual event streams. The application must remain usable while a compile runs. Respect user-imposed CPU/GPU/RAM limits and pause policies.

### Asset pipelines

Use content-addressable assets; deduplicate identical images; generate target-specific formats; keep source originals where desired; downscale previews; preserve metadata; and make destructive compression an explicit export operation.

<a id="spica-chapter-21"></a>
## 21. Offline-first operation and ownership

Spica should work for the core creation workflow with no account and no active internet connection, assuming required dependencies and target toolchains are installed. Provide an offline cache manager, explicit network toggle, deterministic local registry, local documentation, and export without watermark or mandatory telemetry.

The user owns their project graph and source output. Document what remains editable outside Spica. Avoid hidden proprietary runtime services. Optional online integrations should be opt-in and clearly separate from the offline base product.

### Portable installation ideas

Local block bundles, project templates, portable runtime manifests, dependency import/export, offline tutorial packs, and toolchain diagnostic checks. A standalone installer can check installed compilers and offer user-controlled setup, but should never hide a major download or security-sensitive installation.

<a id="spica-chapter-22"></a>
## 22. Collaboration, history, and version control

### Local history first

Every graph transaction becomes an undoable semantic change record: added node, changed property, connected port, replaced recipe, changed target, upgraded dependency. Store checkpoints with descriptions and build outcomes. Enable compare, cherry-pick, revert, and recovery.

### Git integration

Serialize graphs deterministically so diffs are meaningful. Provide graph-aware conflict visualization and safe merge assistance. Keep generated artifacts separate from authoritative graph files where practical. Never auto-commit or push without permission.

### Optional collaboration

Multiple local or remote users can co-edit graphs through an explicit sync service. Presence indicators, cursor locations, review comments, approval workflows, project roles, and conflict resolution are expansion ideas. Do not sacrifice offline operation for collaboration.

### Reproducibility as a collaboration tool

A collaborator should receive a project with exact block locks, toolchain requirements, checksums, and documented setup steps. If a dependency is unavailable, Spica should report the missing component instead of silently replacing it with an unrelated version.

<a id="spica-chapter-23"></a>
## 23. Accessibility, learning, and internationalization

### Nonvisual graph editing

Represent the graph as an accessible outline and connection table. Users can tab through nodes, edit properties in forms, connect ports with a searchable chooser, hear validation errors, and navigate to referenced nodes by label. A graph must not be unusable without a mouse.

### Teaching features

Explain what a block does, show its generated code mapping, provide interactive examples, compare two alternative patterns, teach input/output concepts, and offer a safe test playground. A Spark can explain a failure in plain language while leaving the compiler's exact error accessible.

### Memory-friendly features

Save named snippets and patterns; expose a searchable command palette; show last-used blocks; offer task checklists and stable shortcuts; document commonly used functions and interfaces in context. Do not require users to memorize programming syntax just to repeat an established workflow.

### Internationalization

Store localization keys instead of hard-coded strings; support pluralization, date/number formatting, RTL layouts, keyboard differences, and language-specific fonts. Localize the studio separately from generated apps. A Spark's conversational language should not silently rewrite the output app's chosen locale.

---

# Part III — What Spica could build

<a id="spica-chapter-24"></a>
## 24. Product-specific opportunities

### Huelith — image editing

Spica could supply the UI shell, tool palettes, layer panels, property inspectors, menus, shortcuts, file open/save, undo stacks, export dialogs, presets, and project format scaffolding. The pixel editing kernels, nondestructive effects, brush rasterization, GPU pipelines, and segmentation algorithms may remain custom Rust/TypeScript modules. A reusable `ImageDocument` graph can coordinate layer visibility, blend modes, history, and export. A background-removal feature should use an explicitly tested algorithm rather than falsely claiming perfect subject segmentation from any image.

### Typecase — documents, sheets, and presentations

Spica could build multi-document tabs, toolbars, inspectors, templates, settings, file dialogs, autosave, keyboard commands, table controls, pagination settings, theme tokens, and export workflows. Text layout, spreadsheet formulas, robust file format compatibility, and slide rendering deserve separate specialist engines. The graph orchestrates them; it should not pretend a generic rich-text widget is a full office suite.

### CubeMorrow and CubeTable — voxel game tooling

Spica could create editor tools: biome inspectors, asset browsers, texture catalogs, HUD designers, entity configuration panels, material editors, animation control surfaces, and structured export wizards. The real-time rendering loop, terrain generation, physics, streaming, and simulation engine remain optimized custom systems. A visual `BiomeRecipe` could compose settings and processing stages without hardcoding engine internals into a generic UI block.

### Stella — custom printer interface

Spica could generate dashboard layouts, theme systems, settings editors, printer-status visualizations, logging panels, and simulation interfaces. Actual printer commands need strict hardware contracts, state-machine checks, and device-specific safety behavior. An attractive nozzle movement preview is not proof that a physical command is safe.

### Solarium itself

Use Spica to construct internal Solarium panels and tools, but avoid circular dependencies where Spica is required to build the very runtime that starts Spica. Build a minimal bootstrap host outside the studio; then allow Spica to assemble noncritical panels, dashboards, utility dialogs, and visual features.

### Glitch coding environment

Use Spica for IDE layout, split panes, file explorer, terminal tabs, task panels, settings, project selection, diagnostics, and command palettes. Language servers, inference, sandboxed execution, and code analysis remain specialized subsystems exposed through blocks and adapters.

### Prism and geometry experiments

A future Prism-focused target could use graph blocks to configure geometry processing, mesh inspection, UV editing, transforms, validation, export, and tool UI. A new `.ps`/`.psx` language or custom runtime would need a separately specified parser, type system, runtime contract, and compiler integration. Spica can call such a toolchain, but its existence does not make single-image accurate 3D reconstruction solved.

### Smaller utility applications

Excellent early targets include a batch image converter, wallpaper manager, file renamer, local notes editor, inventory tracker, media organizer, data viewer, theme designer, markdown previewer, timer, soundboard, and local project launcher. These provide meaningful value while exercising reusable core building blocks.

<a id="spica-chapter-25"></a>
## 25. Example end-to-end builds

### Scenario A — A fully working settings application

**Goal:** Create a desktop app with a sidebar, three settings pages, theme selection, persistent preferences, and import/export.

**Graph:** `AppWindow → SidebarNavigation → ScreenRouter → SettingsForm → PreferencesStore → SaveSettings`, with a separate `ExportSettings` flow. Design tokens define light/dark themes. A `ResetToDefaults` action uses a transaction and confirmation dialog.

**Acceptance:** The application opens, navigates with keyboard and pointer, changes settings, persists changes across restart, exports a valid file, handles invalid imports, and passes target build checks. The final report identifies which checks ran.

### Scenario B — A basic image batch converter

**Goal:** Import several local images, resize them, choose an output format, and write results to an approved folder.

**Graph:** `FilePicker(multiple) → DecodeImage → ResizeImage → EncodeImage → SaveFile`, with `TaskQueue`, progress events, error collection, and cancellation. Requires the right filesystem permissions for the target.

**Acceptance:** File types are validated, aspect ratio policy is respected, source files remain unchanged unless explicitly permitted, cancelling stops remaining conversions, and exported outputs are verified by reopening sample files.

### Scenario C — A simple notes editor

**Goal:** Create, search, edit, and export notes locally.

**Graph:** `AppWindow → SplitLayout → NoteList + TextEditor → NoteRepository → SearchIndex`, with autosave, explicit empty-state UI, keyboard navigation, undo, and JSON/Markdown export.

**Acceptance:** Notes survive relaunch; deletion requires confirmation or a recoverable trash; search finds expected text; exported documents are readable without Solarium.

### Scenario D — Huelith-inspired image editor foundation

**Goal:** Create an image editor workspace, not pretend to finish every graphics feature.

**Graph:** `MainWindow → WorkspaceLayout → CanvasHost + LayerPanel + ToolPanel + HistoryPanel`, plus custom `ImageDocumentCore`, `RasterBrushCore`, and `ImageExportCore` adapters.

**Acceptance:** Open actual image, draw a brush stroke, create a layer, undo stroke, save project, reopen project, export image, and verify output pixels. Mark filters and selection tools not yet implemented as incomplete rather than faking controls.

### Scenario E — A local database inventory program

**Goal:** Track items, stock counts, tags, and CSV imports.

**Graph:** `DataSchema → LocalDatabase → CRUDRepository → TableView → FilterBar → EditDialog → ImportCSV/ExportCSV`.

**Acceptance:** Validate negative quantities, handle duplicate keys, migrate schema, preserve data after upgrade, import malformed files safely, and record a recoverable backup before destructive migration.

### Scenario F — A creative app with custom algorithm

**Goal:** Create a new `BackgroundRemoval` capability not included in the official registry.

**Process:** Define `ImageBuffer → Mask + ForegroundImage`; implement algorithm as custom extension; document non-guaranteed quality; test on silhouettes, fine hair, transparency, shadows, and unusual lighting; register as `Prototype`; compare real results; only promote it after verification.

### Scenario G — A UI shell around an existing Rust engine

**Goal:** Provide an editor UI for a preexisting Rust application.

**Process:** Inspect the codebase; expose stable Rust commands through typed adapters; build UI graph; generate React/Tauri binding code; run tests; avoid rewriting core Rust algorithms merely to make them visual.

### Scenario H — A Spark-assisted bug fix

**Goal:** A Save button looks correct but does nothing.

**Process:** Trace the button's event port; discover missing connection to `SaveFile`; propose change set; validate path/permission configuration; connect success/error feedback; run a real integration test; report the exact graph diff and test outcome.

---

# Part IV — Engineering specifications

<a id="spica-chapter-26"></a>
## 26. Engineering architecture and repository layout

The following is a **proposed** modular organization. Paths are examples for a TypeScript-heavy Solarium repo and should be adjusted to the actual repository structure after inspection.

```text
src/
  features/
    spica/
      ui/
        studio-shell/
        canvas/
        block-library/
        graph-editor/
        inspector/
        preview/
        diagnostics/
        build-center/
        history/
        permissions/
      application/
        commands/
        queries/
        transactions/
        project-service/
        spark-tools/
      domain/
        project/
        graph/
        nodes/
        ports/
        schemas/
        capabilities/
        recipes/
        targets/
        diagnostics/
      infrastructure/
        persistence/
        registry/
        cache/
        asset-store/
        filesystem/
        process-runner/
        event-stream/
      compiler/
        normalize/
        validate/
        ir/
        optimize/
        emitters/
          react/
          tauri/
          web/
          electron/
      runtime/
        ui-bindings/
        flow-engine/
        state-store/
        effect-adapters/
      testing/
        graph-tests/
        contract-tests/
        integration-tests/
      blocks/
        core/
        ui/
        forms/
        data/
        filesystem/
        graphics/
        multimedia/
        network/
        build/
      recipes/
        official/
        user/
      docs/
        architecture/
        blocks/
        targets/
        security/
        tutorials/
```

### Architectural responsibilities

- `SpicaProjectService`: open/create/save/migrate projects and manage project metadata.
- `SpicaGraphService`: apply typed graph transactions; provide referenced node and port queries.
- `SpicaRegistryService`: resolve compatible blocks and recipes; pin versions.
- `SpicaValidationService`: run schema, type, platform, permission, graph, and recipe validation.
- `SpicaCompilerService`: lower validated graphs into IR; emit target code.
- `SpicaPreviewService`: manage preview sessions and their resource limits.
- `SpicaBuildService`: invoke approved toolchains and report real output.
- `SpicaHistoryService`: checkpoints, journals, semantic diffs, undo/redo.
- `SpicaPermissionService`: trust tiers, user grants, and capability decisions.
- `SpicaAgentAdapter`: expose a small, typed set of operations to Sparks.
- `SpicaEventBus`: ordered durable events for plans, changes, builds, and tests.

### Process isolation

The editor renderer should not directly spawn compilers or run arbitrary code. Let a trusted backend or worker own filesystem access, package resolution, and builds. Narrow request/response APIs allow the UI to display results without inheriting privileged operating-system access.

### Event protocol alignment

Existing Solarium analysis points toward replacing competing activity streams with a single factual event protocol. Spica should integrate with that canonical event system or extend it, not create another UI-specific activity fiction. Add event families such as `spica.graph.changed`, `spica.validation.completed`, `spica.preview.started`, `spica.build.failed`, and `spica.export.completed`, carrying stable IDs, sequence numbers, timestamps, and artifact references.

### Project intelligence alignment

The earlier Sources/Action Recipes concept already emphasized actual directory inspection, validated tool inputs, and project-aware operation selection. Spica should reuse those principles and services rather than duplicate them in a monolithic `SpicaAgent` class.

<a id="spica-chapter-27"></a>
## 27. Concrete TypeScript contracts

The following interfaces illustrate a plausible stable boundary. They require adaptation and testing in the actual codebase before production use.

### 27.1 Typed values, ports, and node definitions

```ts
export type SpicaTarget = "tauri2-react" | "web-react" | "electron-react";
export type SpicaNodeKind =
  | "ui"
  | "value"
  | "action"
  | "event"
  | "resource"
  | "recipe"
  | "build";

export type SpicaPortKind =
  | "value"
  | "event"
  | "action"
  | "stream"
  | "resource"
  | "binding"
  | "capability";

export interface SpicaTypeRef {
  name: string;
  nullable?: boolean;
  genericArgs?: SpicaTypeRef[];
  representation?: "json" | "binary" | "native-handle";
}

export interface SpicaPortDefinition {
  id: string;
  label: string;
  direction: "input" | "output";
  kind: SpicaPortKind;
  type: SpicaTypeRef;
  required: boolean;
  acceptsMultiple?: boolean;
  documentation?: string;
}

export interface SpicaCapabilityRequest {
  capability: string;
  scope: "project" | "workspace" | "system" | "domain" | "device";
  reason: string;
  required: boolean;
}

export interface SpicaBlockDefinition {
  id: string;
  version: string;
  kind: SpicaNodeKind;
  label: string;
  description: string;
  categories: string[];
  ports: SpicaPortDefinition[];
  propertySchemaId: string;
  targetSupport: SpicaTarget[];
  capabilities: SpicaCapabilityRequest[];
  implementationIds: Partial<Record<SpicaTarget, string>>;
  maturity: "draft" | "prototype" | "beta" | "stable" | "deprecated" | "blocked";
  testSuiteIds: string[];
  license: string;
}
```

### 27.2 Graph nodes and connections

```ts
export interface SpicaNode {
  id: string;
  blockId: string;
  blockVersion: string;
  properties: Record<string, unknown>;
  editorPosition: { x: number; y: number };
  displayName?: string;
  subgraphId?: string;
}

export interface SpicaConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export interface SpicaGraph {
  id: string;
  name: string;
  graphKind: "ui" | "behavior" | "data" | "resources" | "build";
  nodes: SpicaNode[];
  connections: SpicaConnection[];
}

export interface SpicaProjectSnapshot {
  formatVersion: number;
  projectId: string;
  revisionId: string;
  name: string;
  graphs: SpicaGraph[];
  targets: SpicaTarget[];
  blockLock: Record<string, string>;
  recipeLock: Record<string, string>;
  assetManifestId: string;
  permissionManifestId: string;
}
```

### 27.3 Diagnostics and change transactions

```ts
export interface SpicaDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  graphId?: string;
  nodeId?: string;
  portId?: string;
  target?: SpicaTarget;
  suggestion?: string;
  blocksExport: boolean;
}

export type SpicaGraphOperation =
  | { type: "add_node"; graphId: string; node: SpicaNode }
  | { type: "remove_node"; graphId: string; nodeId: string }
  | { type: "set_property"; graphId: string; nodeId: string; key: string; value: unknown }
  | { type: "connect"; graphId: string; connection: SpicaConnection }
  | { type: "disconnect"; graphId: string; connectionId: string }
  | { type: "add_graph"; graph: SpicaGraph }
  | { type: "remove_graph"; graphId: string };

export interface SpicaChangeSet {
  id: string;
  projectId: string;
  expectedRevisionId: string;
  description: string;
  actor: "human" | "spark" | "recipe" | "migration";
  operations: SpicaGraphOperation[];
}

export interface SpicaApplyResult {
  applied: boolean;
  newRevisionId?: string;
  diagnostics: SpicaDiagnostic[];
  changeLogId?: string;
}
```

### 27.4 Service interface

```ts
export interface SpicaService {
  inspectProject(projectId: string): Promise<SpicaProjectSnapshot>;
  searchBlocks(query: string, target?: SpicaTarget): Promise<SpicaBlockDefinition[]>;
  validateGraph(projectId: string, revisionId: string): Promise<SpicaDiagnostic[]>;
  proposeChangeSet(change: SpicaChangeSet): Promise<SpicaDiagnostic[]>;
  applyChangeSet(change: SpicaChangeSet): Promise<SpicaApplyResult>;
  buildProject(
    projectId: string,
    target: SpicaTarget,
    signal?: AbortSignal,
  ): AsyncIterable<SpicaBuildEvent>;
}

export type SpicaBuildEvent =
  | { type: "started"; buildId: string; target: SpicaTarget }
  | { type: "progress"; buildId: string; stage: string; detail?: string }
  | { type: "diagnostic"; buildId: string; diagnostic: SpicaDiagnostic }
  | { type: "completed"; buildId: string; artifactPaths: string[] }
  | { type: "failed"; buildId: string; reason: string }
  | { type: "cancelled"; buildId: string };
```

### 27.5 Example graph validation procedure

```ts
export function validateConnection(
  from: SpicaPortDefinition,
  to: SpicaPortDefinition,
): SpicaDiagnostic[] {
  const issues: SpicaDiagnostic[] = [];
  if (from.direction !== "output" || to.direction !== "input") {
    issues.push({
      code: "SPICA_PORT_DIRECTION",
      severity: "error",
      message: "Connections must link an output port to an input port.",
      blocksExport: true,
    });
  }
  if (from.kind !== to.kind) {
    issues.push({
      code: "SPICA_PORT_KIND",
      severity: "error",
      message: `Cannot connect ${from.kind} to ${to.kind} directly.`,
      suggestion: "Choose a compatible port or insert a supported adapter.",
      blocksExport: true,
    });
  }
  if (from.type.name !== to.type.name) {
    issues.push({
      code: "SPICA_PORT_TYPE",
      severity: "error",
      message: `Type mismatch: ${from.type.name} → ${to.type.name}.",
      suggestion: "Insert an explicit conversion block if one is available.",
      blocksExport: true,
    });
  }
  return issues;
}
```

> **Important:** The example above intentionally checks only the simplest cases. Production validation additionally needs structural/generic type checks, nullability, assignability, port cardinality, cycle analysis, lifetime rules, permissions, target adapters, and asynchronous semantics. Do not replace mature type validation with a string comparison.

### 27.6 Compiler and runtime contracts

```ts
export interface SpicaCompilerContext {
  project: SpicaProjectSnapshot;
  target: SpicaTarget;
  resolvedBlocks: Map<string, SpicaBlockDefinition>;
  outputRoot: string;
  signal: AbortSignal;
}

export interface SpicaGeneratedFile {
  relativePath: string;
  content: string | Uint8Array;
  owner: "generated" | "vendor";
  sourceNodeIds: string[];
}

export interface SpicaCompileResult {
  success: boolean;
  files: SpicaGeneratedFile[];
  diagnostics: SpicaDiagnostic[];
  requiredDependencies: Record<string, string>;
  requiredCapabilities: SpicaCapabilityRequest[];
}

export interface SpicaTargetEmitter {
  target: SpicaTarget;
  generate(context: SpicaCompilerContext): Promise<SpicaCompileResult>;
}
```

### 27.7 Example project manifest

```json
{
  "formatVersion": 1,
  "projectId": "project-demo-settings",
  "name": "My Settings App",
  "targets": ["tauri2-react"],
  "defaultGraphId": "graph-main-ui",
  "blockLock": {
    "spica.ui.window": "1.0.0",
    "spica.ui.button": "1.0.0",
    "spica.storage.preferences": "1.0.0"
  },
  "recipeLock": {
    "spica.recipe.settings-shell": "1.0.0"
  },
  "permissions": {
    "filesystem": "project-only",
    "network": "disabled"
  }
}
```

### 27.8 Example agent instruction/result separation

```json
{
  "tool": "spica.propose_changes",
  "arguments": {
    "projectId": "project-demo-settings",
    "expectedRevisionId": "rev-0007",
    "description": "Connect the theme selector to persistent preferences",
    "operations": [
      {
        "type": "connect",
        "graphId": "graph-settings-flow",
        "connection": {
          "id": "conn-theme-persist",
          "fromNodeId": "node-theme-change",
          "fromPortId": "changed",
          "toNodeId": "node-theme-save-handler",
          "toPortId": "event"
        }
      },
      {
        "type": "connect",
        "graphId": "graph-settings-flow",
        "connection": {
          "id": "conn-handler-to-save",
          "fromNodeId": "node-theme-save-handler",
          "fromPortId": "trigger",
          "toNodeId": "node-save-preferences",
          "toPortId": "trigger"
        }
      }
    ]
  }
}
```

In this illustration, `node-theme-save-handler` is an existing typed event-to-action adapter in the graph; the engine must still verify that its `event` and `trigger` ports match the connected definitions. This is an **illustrative API payload**, not a declaration that Solarium currently exposes `spica.propose_changes`. The actual engine should check the graph revision and port contracts and reject stale or invalid edits.

---

# Part V — Development strategy and research agenda

<a id="spica-chapter-28"></a>
## 28. Build roadmap and acceptance gates

The roadmap should prioritize a **small complete application-building vertical slice** over a huge library of unfinished icons. Progress through clear gates; do not report a milestone complete simply because the UI exists.

### Milestone 0 — Inspect the merged Solarium/Glitch system

**Objective:** Establish reliable integration points without breaking existing work.

**Deliverables:** Repository topology map; current project model; inventory of chat/Spark/tool interfaces; source editor boundaries; build and filesystem APIs; model capability handling; unified event-stream status; security and storage policies; test baseline; dependency list. Record actual source paths and symbol names after inspecting the current repository instead of assuming historical draft paths remain accurate.

**Acceptance gate:** Existing Solarium chat, project browsing, source editing, local model loading, and build features pass their current checks. Any baseline failures are written down before Spica starts changing code.

### Milestone 1 — Spica domain core

**Objective:** Create and persist a valid visual project without a Spark.

**Deliverables:** Project schema, graph schema, stable IDs, serialization, version metadata, registry interfaces, operation transactions, undo journal, and static graph validator. Implement at least a handful of functional data/event/action blocks. All graph operations must have deterministic results.

**Acceptance gate:** A user can create, save, close, reopen, modify, and undo a small project; invalid connections are rejected with precise diagnostics; a corrupted project does not overwrite the latest good snapshot.

### Milestone 2 — UI editor vertical slice

**Objective:** Assemble a useful interface manually.

**Deliverables:** Window, container, label, input, button, toggle, list, simple navigation, layout constraints, design tokens, inspector, keyboard insertion, accessible object tree, and interactive preview. Ensure editor controls do not mutate the graph outside the command system.

**Acceptance gate:** Build a settings UI using only Spica. Keyboard-only editing can insert and configure the core controls. Save and reopen preserves the exact design and connections.

### Milestone 3 — Behavior and persistence

**Objective:** Give that UI real behavior.

**Deliverables:** Event start nodes, condition, typed values, state store, input validation, error handling, preferences storage, async operation policies, and preview execution. The user must be able to connect a button click to a persisted setting.

**Acceptance gate:** A setting changes, survives a restart of the preview, shows an error on invalid input, and can be reset or undone according to its design.

### Milestone 4 — First real target compiler

**Objective:** Export an independently runnable desktop application.

**Deliverables:** IR validation, initial React emitter, Tauri 2 scaffold adapter, Rust permission interface, dependency locks, generated/custom code split, build command integration, diagnostics, export metadata, and installer/toolchain checks.

**Acceptance gate:** On a configured build machine, the generated app compiles, launches without Solarium, persists settings, handles one real filesystem operation with proper permission, and can be rebuilt from a clean checkout using documented setup steps.

### Milestone 5 — Recipes and a proper block registry

**Objective:** Make common application patterns fast to reuse.

**Deliverables:** Registry search, stable manifest schema, block contracts, compatibility filters, recipe expansion, version locking, migration preview, docs, and real test fixtures. Prioritize 20–40 reliable blocks over hundreds of stubs.

**Acceptance gate:** A user creates a functioning notes app from a recipe, changes its layout, saves it, builds it, and later upgrades a compatible recipe version after reviewing changes.

### Milestone 6 — Spark operations

**Objective:** Allow Dona or another Spark to use the studio safely.

**Deliverables:** Tool adapters for inspection, block search, proposal, preview, validation, apply, build, and artifact reporting. Include graph-revision preconditions, permissions, activity events, and short, typed tool schemas. Provide safe fallback when the loaded model cannot use tools.

**Acceptance gate:** From a natural-language request, a Spark can assemble a small settings app by applying validated changes, build it, and report actual files and tests without fabricating results. A deliberately malformed tool call is rejected; it never becomes an empty dangerous command.

### Milestone 7 — Code collaboration

**Objective:** Make Spica useful to developers, not just beginners.

**Deliverables:** Source mappings, custom code blocks, stable extension interfaces, diff view, type-check integration, breakpoint-to-node navigation where feasible, and safe regeneration. Integrate Glitch's existing code editing rather than introducing a second disconnected editor.

**Acceptance gate:** Edit a custom Rust command, regenerate UI code, rebuild, and verify that the custom source remains unchanged unless explicitly edited.

### Milestone 8 — Custom block forge

**Objective:** Turn new functionality into reusable capabilities.

**Deliverables:** Manifest editor, typed port builder, target-specific implementation project, contract test templates, local registration, versioning, permission declarations, and trust-state display.

**Acceptance gate:** Build a small custom CSV transformation block, test it, add it to the project-local library, use it in two distinct applications, and verify that version upgrades are controlled.

### Milestone 9 — Import and interoperability

**Objective:** Work with existing software without false conversion promises.

**Deliverables:** Detect React/Tauri/Electron projects, import existing design tokens and dependencies where supported, wrap existing modules, show mapped/unmapped source, use stable API adapters, and provide a reversible migration plan.

**Acceptance gate:** Import a simple existing Tauri application, add one new Spica-managed settings panel, build it, and preserve unrelated source files exactly.

### Milestone 10 — Web output and ecosystem

**Objective:** Offer a second genuine target and broaden interoperability.

**Deliverables:** Web target adapter, explicit capability differences, portable project bundles, offline block packages, contributor docs, additional recipes, accessibility audits, localization, and a compatibility matrix.

**Acceptance gate:** The same supported UI/data graph compiles for both Tauri and Web, with incompatible native capabilities explicitly reported or replaced only after user selection.

### Milestone 11 — Mature debugging, collaboration, and scale

**Objective:** Make large projects maintainable.

**Deliverables:** Partitioned graphs, semantic diff/merge, build cache, contract verification matrix, test fixtures, profiler traces, recipe documentation generator, optional collaboration, and robust project migration tooling.

**Acceptance gate:** Representative large projects remain responsive, offline builds are reproducible within documented limits, and major failures can be localized to blocks, graph edges, or target adapters.

### Milestone 12 — Specialized studios and experimental targets

**Objective:** Add advanced editors for media, geometry, documents, 3D tooling, and custom languages only after the foundation is proven.

**Deliverables:** Domain-specific graph packages, asset processors, advanced runtime adapters, visual profiling, task-specific templates, richer native integration, and documented performance constraints.

**Acceptance gate:** Each specialist feature has a real demo application, meaningful tests, and known limitations. Do not mark speculative technology production-ready because the preview looks convincing.

### Release labels

Suggested labels: `Prototype` for editor experiments; `0.1` for the first real built settings app; `0.2` for recipes and Spark integration; `0.3` for code extension and custom block authoring; `0.4` for import and a second target; `0.5+` for robust scale and specialized studios; `1.0` only after usability, accessibility, migration, export, and security reviews meet documented gates. Exact version numbering can change; the evidence gates matter more.

### Measures worth recording

- Percentage of supported example apps that build successfully from a clean project.
- Percentage of block contracts covered by automated tests.
- Time from inserting a valid block to usable preview.
- Median graph-validation latency for projects of different sizes.
- Time to diagnose a failed build to a responsible block or generated file.
- Number of unrelated source files changed during a scoped operation (target: zero).
- Frequency of Spark-proposed invalid graph changes.
- Frequency of permission prompts and accidental denials.
- Number of projects that can be reopened after migration.
- Frequency of successful offline exports.
- Accessibility coverage of standard blocks.
- Reliability of cancellation and restoration after crashes.

<a id="spica-chapter-29"></a>
## 29. Risk register and design trade-offs

### Risk 01 — The block illusion

**Failure:** A block looks complete but only generates a placeholder or a shell UI.  
**Mitigation:** Maturity labels, executable-contract tests, clear `Not implemented` warnings, feature-level acceptance tests, and consistent use of real output artifacts.

### Risk 02 — Visual spaghetti

**Failure:** Complex programs become giant unreadable graphs.  
**Mitigation:** Separate graph layers, reusable recipes, named interfaces, collapsed subgraphs, graph search, scope navigation, automatic layout assistance, and alternative textual/outline editors.

### Risk 03 — Model hallucination

**Failure:** A Spark invents a block ID or a connection that cannot exist.  
**Mitigation:** Registry lookups, schema-constrained operations, revision checks, deterministic validation, and restricted candidate lists.

### Risk 04 — Overly broad target support

**Failure:** Every block promises Windows, Linux, macOS, Web, and Mobile despite platform differences.  
**Mitigation:** Start with one real target; maintain a capability matrix; fail visibly for unsupported targets; avoid imaginary cross-platform parity.

### Risk 05 — Monolithic runtime

**Failure:** All logic ends up in one compiler file or chat route.  
**Mitigation:** Domain/application/infrastructure separation, small interfaces, dependency inversion, target plugins, contract tests, and explicit process boundaries.

### Risk 06 — Generated code overwrite

**Failure:** Regeneration deletes user edits.  
**Mitigation:** Generated/custom/vendor ownership zones, change previews, safe write sets, atomic transactions, and snapshots.

### Risk 07 — Dependency traps

**Failure:** A block update breaks old projects.  
**Mitigation:** Lockfiles, semantic versioning, migrations, compatibility tests, project-local forks, and rollback.

### Risk 08 — Malicious blocks

**Failure:** A third-party block reads secrets or executes shell commands.  
**Mitigation:** Trust labels, capability-scoped sandboxing, code review, signature/hash checks, block transparency, and explicit permission grants.

### Risk 09 — Fake build confidence

**Failure:** Preview works but packaged app fails.  
**Mitigation:** Separate preview levels and real target build checks, record evidence per target, and test the standalone artifact.

### Risk 10 — AI dependence

**Failure:** App construction stops when inference is unavailable.  
**Mitigation:** Complete manual mode, direct property editing, local registry, recipes, and accessible keyboard interactions.

### Risk 11 — Poor debugging

**Failure:** Users cannot tell which block caused a problem.  
**Mitigation:** Stable IDs, source mappings, structured diagnostics, port-value traces, graph breakpoints, and real event logs.

### Risk 12 — Huge blocks that do too much

**Failure:** A `Create SaaS App` block conceals hundreds of uneditable decisions.  
**Mitigation:** Prefer inspectable recipes composed of smaller capability blocks and expose overrides through named parameters.

### Risk 13 — Too many microscopic blocks

**Failure:** Users need a hundred nodes to make a login form.  
**Mitigation:** High-level tested recipes, layout components, default adapters, context-aware insertion, and generated safe wiring.

### Risk 14 — Performance regressions

**Failure:** Live preview and graph validation freeze the interface.  
**Mitigation:** Incremental compilation, workers, caching, profiling, virtualized views, resource budgets, and representative benchmarks.

### Risk 15 — Language/model fragmentation

**Failure:** Each Spark model expects different tool formats, creating inconsistent behavior.  
**Mitigation:** One internal tool contract and adapters for model-specific outputs; capability detection; no assumptions that every GGUF supports reasoning/tool calls identically.

### Risk 16 — Unsafe autonomous maintenance

**Failure:** A Spark updates dozens of packages without asking or understanding consequences.  
**Mitigation:** Scoped maintenance policies, package diffs, test gates, permission checks, and staged rollout.

### Risk 17 — Source license surprises

**Failure:** Generated commercial apps embed incompatible libraries or copied third-party assets.  
**Mitigation:** Dependency license inventory, attribution reports, export warnings, and explicit owner review.

### Risk 18 — Unclear app ownership

**Failure:** Users cannot distribute their output without the studio or a special license.  
**Mitigation:** Independent app runtime, transparent source, documented usage rights, and minimal mandatory dependencies.

### Risk 19 — Premature self-expansion

**Failure:** AI creates insecure untested blocks and immediately treats them as trusted.  
**Mitigation:** Separate local draft/prototype/stable tiers; test evidence; manually approved promotion; no automatic official registry publication.

### Risk 20 — No verified acceptance criteria

**Failure:** The project accumulates features without actually solving user goals.  
**Mitigation:** Real sample apps, scenario-based tests, publicly visible capability maturity, defect triage, and release gates.

### Trade-off A — Flexibility versus reliability

Unrestricted source code can express almost anything but is difficult to reason about automatically. Narrow blocks are reliably composed but cannot express every algorithm. **Choose typed blocks as the default path and custom modules as an explicit escape hatch.**

### Trade-off B — Visual canvas versus forms

Graph canvases communicate relationships but can be intimidating and inaccessible. Property forms are easy to learn but obscure complex flow. **Offer both, sharing one authoritative model.**

### Trade-off C — Cross-platform IR versus native specialization

A universal IR increases reuse but may lose the best native behavior. Target-specific adapters preserve expressiveness at the cost of maintenance. **Keep a portable core and explicit native extensions.**

### Trade-off D — Autonomous Spark versus user control

Aggressive automation saves clicks but increases risk. Proposal-only mode is safer but slower. **Make authority adjustable by operation and resource, not a single vague switch.**

### Trade-off E — Dynamic runtime versus generated static code

A dynamic runtime can preview flexible graphs but adds dependencies and overhead. Generated code is distributable and optimizable but requires compilation. **Use a lightweight preview interpreter where helpful and emit normal source for final targets.**

<a id="spica-chapter-30"></a>
## 30. Open questions, research tasks, and experiments

Every open question should lead to a concrete prototype, test, or decision rather than remain a philosophical slogan.

### Architecture questions

1. Should the first graph format be one JSON document or partitioned subgraphs? Test save/reopen time for large projects.
2. How are graph revisions represented: monotonic counters, UUIDs, or content hashes? Measure merge/replay behavior.
3. Which interfaces are stable across target emitters? Implement one working app for two backends.
4. How much behavior belongs in a portable IR versus a native adapter? Prototype filesystem save and notifications.
5. How should typed generic ports be represented? Test collections, optional values, and async streams.
6. How should custom code be injected without regeneration collisions? Compare adapters, generated hooks, and user modules.
7. Can graph references remain stable when recipes are expanded? Test upgrades and diagnostics.
8. How should schema migrations be validated on large persisted document sets? Use synthetic fixtures and snapshots.
9. How do changes propagate through nested recipes? Test local overrides, forks, and upstream updates.
10. Should Spica host its own process or live inside a Solarium backend worker? Benchmark memory, isolation, and startup.

### Editor questions

11. Can the same flow be edited through canvas and form without losing context? Build both editors against one graph store.
12. What is the smallest readable graph component at 100% zoom? Conduct usability tests.
13. What happens when hundreds of connections cross a screen? Test collapsed regions and wire bundling.
14. How can a user see permission boundaries visually? Try capability badges on nodes and flows.
15. What is the fastest keyboard-only method to add and connect a block? Compare command palette patterns.
16. Does auto-layout disrupt experienced users? Test opt-in and non-destructive preview.
17. Which node attributes belong on the card versus the inspector? Compare dense and minimal layouts.
18. How should nonvisual users inspect a complex graph? Prototype hierarchical tree and connection table.
19. How can the UI show unsupported target behaviors before build? Test badges, filters, and compile diagnostics.
20. How should Spark activities relate to actual graph selection? Link each event to nodes, files, and preview states.

### Agent questions

21. How reliably can a small GGUF model choose from 20 compatible blocks? Run a repeatable evaluation set.
22. Does a graph diff format improve tool-call accuracy compared with arbitrary code generation? Measure failure rates.
23. What retry limit avoids runaway loop behavior? Benchmark bounded repair runs on representative errors.
24. How should the Spark ask for missing dangerous information without repeatedly questioning known facts? Build scenario tests.
25. What does capability detection actually report for each installed model/runtime combination? Run live compatibility tests.
26. Can a non-tool-calling model still produce useful structured proposals? Compare guided extraction and user review.
27. How does context length affect multi-step graph construction? Test chunked task state rather than long prompt replay.
28. Which data must the Spark retrieve from Sources and which from live project state? Evaluate contradictory source fixtures.
29. How do different Spark personalities preserve identical technical execution? Compare identical graph operations under multiple personas.
30. How can users distinguish model proposals from completed operations? Evaluate factual activity/event UI.

### Compiler questions

31. Which initial React design primitives are easiest to compile reproducibly? Build an actual settings app.
32. What exact Tauri 2 permissions are required for filesystem and notifications? Verify on supported platforms and toolchain versions.
33. How should event graph errors map back to the source node? Implement source-map metadata.
34. Can codegen produce stable diff-friendly files across identical runs? Snapshot tests.
35. Which generated modules cause unnecessary rebuilds? Profile incremental compilation.
36. How should MUI theme tokens map to Spica design tokens? Compare rendered outputs.
37. How should the runtime report UI event failures in a packaged app? Instrument production logging.
38. How are worker-based tasks cancelled across Rust and TypeScript? Prototype file conversion cancellation.
39. How do browser and native file operations differ semantically? Build explicit adapter tests.
40. Can export pass a fresh toolchain build with no cached dependencies? Test in a clean environment.

### Block ecosystem questions

41. What minimum test suite earns `Stable` status? Write formal promotion criteria.
42. How should project-local blocks be upgraded? Compare in-place migrations and side-by-side versions.
43. Can block authoring automatically generate accurate documentation from schemas? Test doc snapshots.
44. How can the registry rank compatibility before text similarity? Design and benchmark a resolver.
45. Which blocks should include native runtime libraries versus code-generated functions? Measure bundle size.
46. How are block permissions reviewed when dependencies update? Compare effective capability manifests.
47. How can a recipe expose a simple API without hiding important internals? Test settings and editor-shell recipes.
48. How should test fixtures be stored for reproducibility? Use content-addressed assets.
49. Can two different versions of a block coexist in one project? Test namespace/version resolution.
50. How can a block be revoked for security without making old projects irrecoverable? Develop read-only and quarantine modes.

### Reliability questions

51. What is the recovery behavior after a crash during autosave? Inject interruptions.
52. What is the recovery behavior after a crash during code generation? Verify atomic file transactions.
53. What is the safe fallback when a custom block's native code panics? Test process isolation.
54. Can generated apps run entirely offline? Monitor network calls and dependency requirements.
55. Does an exported project rebuild after a six-month dependency gap? Preserve lockfiles and toolchains where practical.
56. What exactly is included in a portable bundle? Audit secrets, caches, binaries, and licenses.
57. Are graph diffs understandable in Git? Test representative PR reviews.
58. Can a user revert one Spark transaction without breaking dependent changes? Implement dependency-aware undo diagnostics.
59. How do permission revocations affect running previews? Define cancellation and error semantics.
60. How do build logs map back to block versions and project snapshots? Implement provenance capture.

### Specialized research questions

61. What image features should use CPU, GPU, or worker processing? Benchmark realistic files.
62. Can the studio generate an image-editor shell while keeping raster algorithms in custom modules? Build an Huelith-like proof of concept.
63. Can text editing preserve cursor/selection through reactive graph updates? Test rich-text integration.
64. Can a timeline component display thousands of clips responsively? Measure virtualization and waveform caching.
65. What geometry metadata must a future Prism adapter expose? Define interfaces before designing visual blocks.
66. Can a voxel-tool generator safely edit data formats without embedding game engine internals? Prototype asset inspector.
67. How should printer simulation handle hardware-specific coordinate limits? Create safe virtual device fixtures.
68. How should a plugin target package native modules? Build one minimal plugin and distribution test.
69. Which app formats need strict compatibility testing? Inventory formats and codecs before implementing importers.
70. Can UI components be exported to a reusable design-system library? Test versioned component packages.

### Product questions

71. What is the first valuable app that can be built end to end by a beginner? Conduct task trials.
72. Which block categories give the highest leverage for Huelith and Typecase? Rank concrete feature paths.
73. Does a recipe-first home screen reduce abandonment? Compare with blank canvas.
74. Which project errors deserve beginner-friendly remediation buttons? Classify real failure logs.
75. Can developers trust generated code enough to modify it? Review outputs with experienced engineers.
76. What minimum documentation lets a user build without a Spark? Conduct offline trials.
77. How do users understand `Ask`, `Auto`, and broad-authorization modes? Test consent language.
78. How can the studio communicate the difference between prototype and production capability? Test badges and sample projects.
79. Which telemetry can remain local and opt-in? Design privacy-preserving metrics.
80. What is a fair open-source governance model for official block submissions? Draft contributor and review policies.

### Future-facing questions

81. Could a visual accessibility audit suggest actual graph edits? Prototype suggestions and human review.
82. Could Spica mine repeated successful graph patterns into recipe recommendations? Test privacy-preserving local analysis.
83. Could a Spark generate a safe migration plan from one target to another? Trial limited-app conversion.
84. Could local semantic search index block examples without always loading a second large model? Measure resource usage.
85. Could semantic code analysis infer block wrappers for existing TypeScript functions? Build a proof of concept.
86. Could a node profiler suggest moving hot paths to Rust? Validate recommendations against benchmarks.
87. Could project-level constraints prevent accidental UI inconsistencies? Prototype lint rules for design tokens.
88. Could generated apps include an optional visual bug-report mechanism linked to node IDs? Test privacy implications.
89. Could Spica offer a local block teaching mode that explains source code progressively? Trial with beginners.
90. Could exporting a recipe as a dependency package improve reuse across standalone projects? Prototype package generation.

---

# Part VI — Block atlas: a proposed catalog of capabilities

<a id="spica-chapter-31"></a>
## 31. The expanded Spica standard-library idea atlas

This is a **catalog of potential real blocks**, not a list of already implemented functions. Every item below needs a real implementation, contract, documentation, target compatibility declaration, and appropriate tests before it can be labeled stable. The block names are tentative. `Interface` denotes expected inputs/outputs in concise human-readable terms; it is not a full type signature.

The initial release should ship a carefully tested subset. Advanced algorithms should usually be wrapped by typed adapters rather than rebuilt from scratch in the graph engine.


### 01. App shells, windows, and layouts — 22 proposed blocks

Core. Implement a minimal composable layout hierarchy first. Separate responsive layout constraints from canvas editing coordinates.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Application Root** | Defines app identity, startup route, lifecycle, and global providers. | `App settings -> Root runtime` | Must not initialize privileged services without grants. |

| 2 | **Native Window** | Declares an independent desktop window with size and close behavior. | `Window props -> Window events` | Platform restrictions and minimum sizes vary. |

| 3 | **Window Manager** | Creates and tracks multiple named windows. | `Window requests -> Window handles` | Handle ownership and cleanup explicitly. |

| 4 | **Splash Screen** | Displays verified startup status and loading transitions. | `Startup state -> Visual splash` | Avoid artificial percentage progress. |

| 5 | **Stack Layout** | Arranges children vertically or horizontally with gaps. | `Child slots + direction -> Layout` | Respect text scaling and overflow. |

| 6 | **Grid Layout** | Places items in a responsive grid system. | `Tracks + child slots -> Grid` | Validate span and breakpoint rules. |

| 7 | **Split Pane** | Divides workspace with draggable persistent divider. | `Two slots + ratio -> Layout events` | Support keyboard resize and minimum widths. |

| 8 | **Docking Workspace** | Provides movable, tabbed, dockable tool panels. | `Panel definitions -> Dock layout` | Save and recover corrupt layouts. |

| 9 | **Card Container** | Frames a region with consistent theme tokens. | `Content slot -> Styled surface` | Use semantic heading hierarchy. |

| 10 | **Scrollable Region** | Adds bounded scrolling and virtualization hooks. | `Content + overflow policy -> Scroll state` | Avoid nested scroll traps. |

| 11 | **Overlay Layer** | Renders content above the primary screen. | `Overlay content + anchor -> Overlay` | Manage focus and escape behavior. |

| 12 | **Responsive Container** | Switches layout rules by viewport and density. | `Breakpoints -> Responsive slots` | Test small-screen and zoom layouts. |

| 13 | **Absolute Canvas** | Positions visual objects at exact coordinates. | `Positions + transforms -> Scene` | Not a substitute for responsive app UI. |

| 14 | **Resizable Frame** | Exposes width and height handles with constraints. | `Bounds -> Resize events` | Support precise keyboard editing. |

| 15 | **Collapsible Section** | Hides or reveals related controls. | `Heading + content -> Toggle event` | Persist state only when appropriate. |

| 16 | **Tabbed Workspace** | Manages documents or panels in tabs. | `Tab model -> Active tab` | Provide overflow and close confirmation. |

| 17 | **Status Bar** | Displays actual task, document, or device state. | `Status records -> Status view` | Never fabricate build or progress states. |

| 18 | **Toolbar Layout** | Hosts actions with priority and overflow behavior. | `Action items -> Toolbar` | Preserve keyboard order. |

| 19 | **Command Surface** | Places contextual actions near selection. | `Selection -> Visible commands` | Check permissions before showing execution. |

| 20 | **Safe-Area Container** | Respects OS window insets and device cutouts. | `Viewport metrics -> Inner bounds` | Requires platform-specific checks. |

| 21 | **Virtualized List Layout** | Renders only visible rows for huge collections. | `Item source -> Rendered viewport` | Stable keys and scroll restoration. |

| 22 | **Layout Inspector** | Exposes computed geometry and constraints. | `Layout node -> Diagnostic view` | Distinguish authored from computed values. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 02. Text, forms, and input controls — 27 proposed blocks

Core/Expansion. These blocks should share standardized focus, value-binding, validation, localization, and disabled-state contracts.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Text Label** | Displays semantic text with selectable typography. | `Text + style -> Rendered text` | Respect localization and line wrapping. |

| 2 | **Rich Text Label** | Renders sanitized inline formatting and links. | `Rich text -> Styled content` | Sanitize untrusted HTML. |

| 3 | **Text Input** | Edits a single-line string with validation events. | `Value + rules -> Changed and committed` | Handle IME and composition safely. |

| 4 | **Multiline Text** | Edits long text with optional line numbers. | `Text + options -> Edit events` | Avoid losing selection on rerender. |

| 5 | **Password Input** | Accepts masked credentials without exposing value to logs. | `Secret value -> Secure input` | Do not persist plaintext by default. |

| 6 | **Numeric Input** | Edits bounded integer or float values. | `Limits + step -> Numeric value` | Locale decimals and invalid intermediate text. |

| 7 | **Range Slider** | Selects value within a bounded range. | `Min/max/step -> Change events` | Keyboard and touch interaction required. |

| 8 | **Toggle Switch** | Represents boolean on/off choice. | `Boolean binding -> Change event` | Label and disabled explanation required. |

| 9 | **Checkbox** | Represents single or grouped boolean selections. | `Checked state -> Change event` | Model indeterminate state explicitly. |

| 10 | **Radio Group** | Selects one option from mutually exclusive choices. | `Options + value -> Selected value` | Label grouped choices accessibly. |

| 11 | **Dropdown Select** | Chooses from option records. | `Options -> Selected key` | Support keyboard search and large lists. |

| 12 | **Autocomplete** | Suggests matching entries as a user types. | `Query + source -> Selection` | Debounce and cancellation required. |

| 13 | **Tag Input** | Creates, validates, and removes tokenized values. | `Text + rules -> Tag collection` | Prevent duplicate normalized tags. |

| 14 | **Date Picker** | Selects a calendar date. | `Locale + constraints -> Date` | Avoid timezone drift on date-only values. |

| 15 | **Time Picker** | Selects time with locale and precision support. | `Time constraints -> Time` | Clearly distinguish local and absolute time. |

| 16 | **Date Range Picker** | Selects inclusive or exclusive date intervals. | `Bounds -> Interval` | Specify whether end boundary is included. |

| 17 | **Color Picker** | Selects color plus alpha where supported. | `Initial color -> Color value` | Preserve color space and alpha semantics. |

| 18 | **Gradient Editor** | Builds stops, opacity, and gradient direction. | `Stops + geometry -> Gradient` | Validate stop ordering. |

| 19 | **Icon Picker** | Selects an available icon with search and preview. | `Icon registry -> Icon ID` | Check licensing and missing assets. |

| 20 | **Font Picker** | Chooses installed or bundled fonts. | `Font registry -> Font selection` | Check embedding rights and fallback. |

| 21 | **File Path Input** | Represents a validated path or selected file handle. | `Picker policy -> Handle/path` | Never treat arbitrary text as safe path. |

| 22 | **Field Validation Hint** | Maps schema errors to accessible feedback. | `Validation state -> Hint` | Associate message with its field. |

| 23 | **Form Group** | Organizes labeled fields into a value object. | `Field schemas -> Form state` | Validate nested fields and submit order. |

| 24 | **Form Wizard** | Splits complex forms into recoverable steps. | `Steps + state -> Completion event` | Preserve draft state on navigation. |

| 25 | **Form Repeater** | Adds or removes multiple instances of a field group. | `Item schema -> Array` | Stable item IDs and minimum count. |

| 26 | **Signature Field** | Captures a drawn mark for a defined purpose. | `Pointer strokes -> Image/data` | Not automatically a legally valid signature. |

| 27 | **Shortcut Recorder** | Captures and validates keyboard combinations. | `Keystrokes -> Shortcut` | Avoid reserved OS key conflicts. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 03. Navigation, notifications, and feedback — 22 proposed blocks

Core. Feedback is driven by actual state and verified operations; no decorative success events.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Screen Router** | Resolves named application screens and nested routes. | `Route request -> Current screen` | Handle invalid routes with fallback. |

| 2 | **Sidebar Navigation** | Presents collapsible navigation sections. | `Menu schema -> Selection events` | Make active state accessible. |

| 3 | **Breadcrumb Trail** | Shows current hierarchy with parent navigation. | `Route ancestry -> Breadcrumbs` | Paths must reflect actual graph structure. |

| 4 | **Back Forward History** | Maintains navigation stack and redo semantics. | `Navigate/back/forward -> Route events` | Distinguish document undo from navigation. |

| 5 | **Action Menu** | Displays contextual commands. | `Actions + context -> Command selection` | Disable unauthorized actions visibly. |

| 6 | **Menu Bar** | Declares conventional desktop application menus. | `Menu schema -> Native/menu output` | Keyboard accelerators differ by OS. |

| 7 | **Context Menu** | Shows selection-scoped actions near pointer or focus. | `Context + actions -> Choice` | Provide keyboard invocation. |

| 8 | **Modal Dialog** | Requests choices and blocks underlying interaction. | `Dialog schema -> Result` | Restore focus and support cancellation. |

| 9 | **Confirmation Dialog** | Obtains explicit approval for consequential actions. | `Action summary -> Confirm/reject` | State exact destructive consequences. |

| 10 | **Toast Notification** | Displays transient outcome information. | `Severity + message -> Toast` | Do not use as sole record of failures. |

| 11 | **Notification Center** | Stores inspectable background events. | `Event log -> Notifications` | Filter secrets and deduplicate repeated alerts. |

| 12 | **Progress Indicator** | Renders real known progress or indeterminate work. | `Progress state -> UI` | Never guess percentage from elapsed time. |

| 13 | **Task Queue Panel** | Shows pending, running, and completed jobs. | `Task records -> Queue UI` | Cancellation and errors must be visible. |

| 14 | **Empty State** | Explains what to do when no items exist. | `Collection count -> Guidance` | Avoid false missing-data claims. |

| 15 | **Error Boundary View** | Recovers from a failed UI region. | `Error -> Fallback controls` | Keep error details available to developer. |

| 16 | **Success Banner** | Summarizes verified operation completion. | `Success record -> Banner` | Verify result before display. |

| 17 | **Tooltip** | Provides secondary contextual explanation. | `Help text -> Floating hint` | Not the only source of essential instructions. |

| 18 | **Onboarding Tour** | Guides first-time navigation through real controls. | `Step sequence -> Tour state` | Allow skip and replay. |

| 19 | **Help Drawer** | Shows relevant documentation for selected object. | `Block ID -> Help content` | Prefer version-matched local docs. |

| 20 | **Search Everywhere** | Searches projects, graph nodes, blocks, and files. | `Query + scopes -> Results` | Respect permissions and indexing status. |

| 21 | **Command Palette** | Executes named user-approved commands. | `Search text -> Command` | Filter unavailable commands by state. |

| 22 | **Activity Timeline** | Displays factual agent, build, and preview events. | `Canonical events -> History` | Do not synthesize reasoning theater. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 04. Events, branching, and orchestration — 27 proposed blocks

Core. Clearly separate control flow, values, reactive bindings, and asynchronous effects. Every loop needs safety semantics.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **On Click** | Converts an activation event into a typed trigger. | `UI activation -> Event` | Debounce repeated clicks where configured. |

| 2 | **On Change** | Emits updated values from bound controls. | `Change source -> Value event` | Define commit versus intermediate change. |

| 3 | **On Keyboard Shortcut** | Handles a scoped registered shortcut. | `Key combo -> Event` | Prevent collisions with text input. |

| 4 | **On Window Close** | Intercepts or observes requested closure. | `Window lifecycle -> Close event` | Respect OS shutdown semantics. |

| 5 | **On App Start** | Starts an initialization flow once per app instance. | `Lifecycle -> Start event` | Avoid duplicate initialization. |

| 6 | **On Timer** | Emits at a configured interval while active. | `Interval + lifetime -> Tick` | Clean up when inactive. |

| 7 | **On File Drop** | Receives dragged local files into a permitted region. | `Drop action -> File handles` | Validate paths, types, and permissions. |

| 8 | **On Route Enter** | Triggers when a screen becomes active. | `Router event -> Context` | Avoid unintended duplicate effects. |

| 9 | **If Else** | Branches on a typed boolean expression. | `Condition + action -> Two branches` | Avoid implicit truthy conversions. |

| 10 | **Switch Case** | Routes execution by enumerated value. | `Value + cases -> Selected branch` | Require default or exhaustive cases. |

| 11 | **Sequence** | Executes dependent actions in declared order. | `Start -> Ordered results` | Stop/continue policy must be explicit. |

| 12 | **Parallel Group** | Executes independent tasks concurrently. | `Tasks -> Combined outcomes` | Set maximum concurrency and cancellation. |

| 13 | **Retry Policy** | Retries idempotent operations under defined limits. | `Failed task -> Retry result` | Do not retry destructive actions blindly. |

| 14 | **Debounce** | Waits for quiet period before emitting a value. | `Event stream -> Reduced stream` | Flush/cancel behavior must be specified. |

| 15 | **Throttle** | Limits event frequency without silently reordering. | `Event stream -> Limited stream` | Leading/trailing semantics required. |

| 16 | **Delay** | Waits cancellably before continuing. | `Duration + signal -> Completion` | Never block renderer thread. |

| 17 | **Wait Until** | Awaits a condition or timeout. | `Predicate -> Completion/timeout` | Avoid unbounded busy polling. |

| 18 | **Guard** | Checks preconditions before executing action. | `Predicate + action -> Outcome` | Report why action was blocked. |

| 19 | **Map Values** | Applies deterministic transform over a collection. | `Items + mapper -> Items` | Bound expensive work on huge lists. |

| 20 | **Filter Values** | Keeps items satisfying a predicate. | `Items + predicate -> Items` | Document stable ordering. |

| 21 | **Reduce Values** | Aggregates items into a result. | `Items + reducer -> Result` | Validate initial accumulator. |

| 22 | **Try Catch Finally** | Routes errors and cleanup reliably. | `Action -> Success/error/finally` | Preserve original error details. |

| 23 | **Cancel Token** | Propagates cancellation into compatible operations. | `Cancel request -> Abort signal` | Guarantee cleanup of owned resources. |

| 24 | **Task Barrier** | Continues after required tasks settle. | `Task set -> Aggregate outcome` | Distinguish all vs any policy. |

| 25 | **Workflow State Machine** | Models named states and legal transitions. | `State + events -> New state` | Reject undefined transitions. |

| 26 | **Event Bus** | Publishes and subscribes to typed application events. | `Event payload -> Subscribers` | Detect loops and subscription leaks. |

| 27 | **Observable Stream** | Transforms a stream with backpressure controls. | `Stream -> Stream` | Require deterministic unsubscribe. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 05. Variables, collections, and state — 25 proposed blocks

Core. State scope, ownership, persistence, and transactions should be declared rather than implicit.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Constant** | Supplies immutable value of a declared type. | `Literal -> Value` | Validate on graph creation. |

| 2 | **Variable** | Holds ephemeral scoped mutable value. | `Initial + updates -> Current value` | Scope must be explicit. |

| 3 | **Computed Value** | Derives value from tracked dependencies. | `Inputs -> Reactive value` | Detect cycles. |

| 4 | **Boolean Operation** | Performs AND, OR, XOR, NOT on booleans. | `Booleans -> Boolean` | No implicit string coercion. |

| 5 | **Number Operation** | Adds, subtracts, multiplies, or divides. | `Numbers -> Number` | Handle zero division and precision. |

| 6 | **String Operation** | Joins, splits, trims, or normalizes text. | `Text -> Text/parts` | Consider locale and Unicode. |

| 7 | **Date Arithmetic** | Adds offsets or compares timestamps. | `Date/time + offset -> Result` | Specify timezone rules. |

| 8 | **Object Constructor** | Builds typed records from named fields. | `Fields -> Object` | Enforce required properties. |

| 9 | **Array Constructor** | Builds ordered typed collections. | `Values -> Array` | Preserve item types. |

| 10 | **Map Dictionary** | Stores key/value pairs. | `Key/value operations -> Map` | Choose key identity rules. |

| 11 | **Set Collection** | Stores unique typed values. | `Items -> Set` | Define equality semantics. |

| 12 | **Lookup by Key** | Finds a value in a keyed collection. | `Key + map -> Optional value` | Missing key must be explicit. |

| 13 | **Sort Collection** | Sorts records using declared comparison. | `Items + keys -> Sorted items` | Preserve stable order. |

| 14 | **Group By** | Groups records under derived keys. | `Items + selector -> Groups` | Avoid unbounded memory on streams. |

| 15 | **Distinct Values** | Removes duplicate values by rule. | `Items + key -> Unique items` | Explain normalization. |

| 16 | **Pagination State** | Tracks page size, cursor, and total. | `Query state -> Page request` | Cursor pagination differs from offsets. |

| 17 | **Selection State** | Tracks current selected IDs. | `Selection events -> Selected set` | Handle deleted items. |

| 18 | **Form State Store** | Keeps draft, dirty, touched, and validation state. | `Field events -> Form state` | Do not clear unsaved edits casually. |

| 19 | **Application Store** | Shares state across named components. | `State model + actions -> State` | Avoid global mutation without ownership. |

| 20 | **Persistent Preferences** | Stores small app settings across sessions. | `Key/value -> Stored setting` | Migrate old schemas. |

| 21 | **Document State** | Represents editable durable document contents. | `Commands -> Document revision` | Integrate undo and autosave. |

| 22 | **Cache State** | Holds disposable reusable computed values. | `Key + TTL -> Cached value` | Never treat cache as durable truth. |

| 23 | **Undo History** | Records reversible semantic operations. | `Commands -> Undo/redo actions` | Bound history and preserve grouping. |

| 24 | **Draft Snapshot** | Saves recoverable in-progress work. | `Document state -> Snapshot` | Atomic writes and retention limits. |

| 25 | **Optimistic Update** | Shows provisional UI state before remote confirmation. | `Action -> Pending/commit/revert` | Handle rollback conflict. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 06. Data modeling, databases, and search — 25 proposed blocks

Core/Expansion. Storage and data modeling need schema migrations, backup strategy, and predictable error handling.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Schema Definition** | Describes entities, types, constraints, and versions. | `Field definitions -> Schema` | Require migration policy for changes. |

| 2 | **Record Validator** | Checks incoming records against a schema. | `Record + schema -> Valid/errors` | Never silently drop failed fields. |

| 3 | **Local SQLite Database** | Creates a project-approved local relational store. | `Schema + connection -> Database` | Ensure migration and backup strategy. |

| 4 | **Key Value Store** | Persists small structured records by key. | `Key/value operations -> Data` | Define storage scope and limits. |

| 5 | **JSON Document Store** | Stores structured documents with identifiers. | `JSON + queries -> Records` | Validate nested data and size. |

| 6 | **Repository CRUD** | Exposes create/read/update/delete for typed entity. | `Entity schema -> Repository actions` | Handle conflicts and error outcomes. |

| 7 | **SQL Query** | Executes parameterized read queries. | `Query + parameters -> Rows` | No unsafe SQL concatenation. |

| 8 | **Database Transaction** | Groups operations atomically. | `Operations -> Commit/rollback` | No partial success on failed atomic group. |

| 9 | **Schema Migration** | Upgrades persisted data with version tracking. | `Old schema + migration -> New schema` | Backup and dry-run capability. |

| 10 | **Database Backup** | Creates recoverable consistent data snapshot. | `Database + target -> Backup` | Verify restore on fixtures. |

| 11 | **Database Restore** | Restores from a validated backup. | `Backup -> Restored data` | Explicit destructive confirmation. |

| 12 | **Full Text Search** | Indexes and searches local textual content. | `Documents + query -> Hits` | Surface indexing progress and staleness. |

| 13 | **Search Highlight** | Maps results to document ranges and snippets. | `Hits -> Highlight spans` | Respect Unicode offsets. |

| 14 | **Filter Builder** | Constructs user-configurable record predicates. | `Field schema -> Filter expression` | Validate operators per type. |

| 15 | **Query Pagination** | Fetches next or previous result segments. | `Cursor + query -> Page` | Distinguish empty from loading. |

| 16 | **Data Table** | Renders sortable, filterable records. | `Rows + columns -> UI` | Virtualize large tables. |

| 17 | **Detail Editor** | Edits one record with dirty-state tracking. | `Record + schema -> Change set` | Prevent silent overwrite of concurrent data. |

| 18 | **Relational Join** | Combines data sources by declared key. | `Two datasets -> Records` | Define cardinality and null behavior. |

| 19 | **Data Aggregation** | Computes sum, average, count, min, max. | `Records -> Metrics` | Handle empty or missing data. |

| 20 | **CSV Import** | Parses delimited tabular data into schema. | `File + mapping -> Records/errors` | Encoding, quoting, and malformed rows. |

| 21 | **CSV Export** | Writes selected records to CSV. | `Records -> File` | Escape dangerous spreadsheet formulas. |

| 22 | **JSON Import** | Validates and loads external JSON. | `JSON bytes -> Typed data` | Limit depth and file size. |

| 23 | **JSON Export** | Serializes structured data with schema version. | `Typed data -> JSON bytes` | Define dates and binary encoding. |

| 24 | **Spreadsheet Import** | Reads supported spreadsheet structures. | `File -> Tables` | Fidelity depends on implementation. |

| 25 | **Spreadsheet Export** | Writes supported tabular workbook data. | `Tables -> Workbook` | Do not promise full Excel feature parity. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 07. Filesystem and archives — 24 proposed blocks

Core for desktop. Native filesystem privileges must be explicit; browser targets use different approved APIs.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Open File Dialog** | Lets the user select files through OS-approved picker. | `Filters -> Selected handles` | Native and browser semantics differ. |

| 2 | **Save File Dialog** | Chooses safe output destination and name. | `Suggested name -> Destination` | Overwrite confirmation as appropriate. |

| 3 | **Choose Directory** | Requests explicit folder selection. | `Picker policy -> Directory handle` | Keep directory grants scoped. |

| 4 | **Read Text File** | Decodes selected file as text. | `Handle + encoding -> Text/errors` | Handle large files and invalid encodings. |

| 5 | **Write Text File** | Saves text via approved path and policy. | `Text + destination -> Save result` | Prefer atomic writes. |

| 6 | **Read Binary File** | Reads bounded bytes or stream. | `File handle -> Byte stream` | Avoid loading huge files into memory. |

| 7 | **Write Binary File** | Writes bytes using safe replacement policy. | `Byte stream + destination -> Result` | Validate resource cleanup. |

| 8 | **File Metadata** | Retrieves size, type, timestamps, and attributes. | `Handle -> Metadata` | Some attributes vary by platform. |

| 9 | **File Exists** | Checks availability of an authorized path. | `Scoped path -> Boolean/result` | Avoid time-of-check/use assumptions. |

| 10 | **Create Directory** | Creates directory under permitted root. | `Path -> Result` | Reject traversal and illegal names. |

| 11 | **Copy File** | Copies file with collision rules and progress. | `Source + destination -> Result` | Respect symlink and overwrite policy. |

| 12 | **Move File** | Moves or renames across approved locations. | `Source + destination -> Result` | Cross-volume behavior differs. |

| 13 | **Delete to Trash** | Moves supported files to recoverable trash. | `File -> Result` | Trash may not exist on every target. |

| 14 | **Permanent Delete** | Removes file irreversibly by explicit request. | `File -> Result` | Require stronger confirmation. |

| 15 | **Enumerate Directory** | Lists authorized directory entries. | `Directory -> Entries` | Use pagination and symlink controls. |

| 16 | **Watch Directory** | Emits authorized file changes. | `Directory -> Change stream` | Coalesce duplicates; clean watchers. |

| 17 | **Path Normalize** | Produces normalized target-safe path. | `Raw path -> Scoped path` | Normalization alone is not permission. |

| 18 | **Glob Match** | Matches files against constrained patterns. | `Scope + pattern -> Matches` | Prevent unbounded traversal. |

| 19 | **File Hash** | Computes checksum incrementally. | `File stream -> Digest` | Not an authenticity guarantee by itself. |

| 20 | **Archive ZIP** | Packages selected files into an archive. | `File set -> ZIP bytes` | Prevent leaking omitted private paths. |

| 21 | **Extract ZIP** | Extracts validated entries into a directory. | `ZIP + destination -> Files` | Prevent zip-slip and decompression bombs. |

| 22 | **Temporary Directory** | Allocates short-lived scratch workspace. | `Scope -> Temp handle` | Guarantee cleanup. |

| 23 | **Recent Files List** | Tracks recently opened approved resources. | `File opens -> Records` | Avoid exposing private paths in exports. |

| 24 | **File Type Detection** | Guesses type from signature and extension. | `Bytes + name -> Media type` | Treat detections as uncertain. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 08. Networking, APIs, and authentication — 23 proposed blocks

Expansion. Network requests need privacy policy, scoped hosts, retry handling, and offline behavior.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **HTTP GET** | Requests resource with timeout and policy. | `URL + headers -> Response` | Host allowlist and cancellation. |

| 2 | **HTTP POST** | Sends structured body to an approved endpoint. | `URL + body -> Response` | Never leak secrets in logs. |

| 3 | **HTTP Upload** | Streams multipart content with progress. | `File + endpoint -> Result` | Size and destination limits. |

| 4 | **HTTP Download** | Downloads content to approved storage. | `URL + destination -> File` | Validate size and checksums. |

| 5 | **WebSocket Client** | Establishes bidirectional event channel. | `Endpoint -> Message stream` | Reconnection and auth rules. |

| 6 | **Server Sent Events** | Subscribes to unidirectional event stream. | `Endpoint -> Events` | Handle reconnect IDs and backpressure. |

| 7 | **REST API Client** | Generates typed requests from API schema. | `Schema + operations -> Client` | Schema alone does not guarantee safety. |

| 8 | **GraphQL Client** | Executes typed document queries and mutations. | `Endpoint + query -> Data/errors` | Bound complexity and rate. |

| 9 | **API Pagination** | Navigates cursor/offset based endpoints. | `Page state -> Items` | Avoid duplicate records. |

| 10 | **Retry with Backoff** | Retries transient network failures. | `Request + policy -> Result` | Honor rate-limit headers. |

| 11 | **Offline Request Queue** | Stores permitted actions until connection resumes. | `Requests -> Pending queue` | Conflict resolution required. |

| 12 | **Connectivity Monitor** | Reports actual network reachability status. | `Probe configuration -> State` | Internet reachability differs from LAN. |

| 13 | **OAuth Browser Flow** | Coordinates standards-compliant sign-in flow. | `Provider config -> Tokens` | Never embed client secrets in desktop app. |

| 14 | **Token Vault Adapter** | Stores credentials in supported secure storage. | `Secret -> Handle` | Use OS secret store when available. |

| 15 | **Session Manager** | Tracks expiry and refresh of authenticated session. | `Token metadata -> State` | Handle revocation and sign-out. |

| 16 | **API Key Configuration** | Supplies secrets through approved vault. | `Secret handle -> Auth header` | Never commit keys into project graph. |

| 17 | **Webhook Receiver** | Receives signed server events in service target. | `Request -> Validated event` | Desktop apps cannot magically expose public endpoint. |

| 18 | **Webhook Sender** | Posts signed event to configured endpoint. | `Event + key -> Result` | Avoid duplicate delivery assumptions. |

| 19 | **Rate Limiter** | Applies client or service rate rules. | `Calls -> Allowed/blocked` | Define window and distributed semantics. |

| 20 | **Response Cache** | Stores responses with TTL and key policy. | `Request -> Cached/fresh result` | Respect sensitive data rules. |

| 21 | **HTML Fetch** | Retrieves and parses HTML from approved site. | `URL -> DOM/text` | Respect user web toggle and origin. |

| 22 | **URL Open** | Opens an external link through OS/browser. | `URL -> Result` | Require scheme validation. |

| 23 | **Local HTTP Service** | Starts scoped loopback API for local integrations. | `Routes -> Service handle` | Restrict binding and origin access. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 09. Images, raster editing, and color — 31 proposed blocks

Expansion. Image pipelines need actual algorithms, pixel-level tests, and explicit fidelity limitations.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Image Decode** | Converts supported image bytes to pixels. | `Encoded bytes -> ImageBuffer` | File/codec limits and decompression size. |

| 2 | **Image Encode** | Converts pixel buffer to supported format. | `ImageBuffer + options -> Bytes` | Report loss and alpha support. |

| 3 | **Image Preview** | Renders source image with pan and zoom. | `ImageBuffer -> View` | Preserve aspect ratio. |

| 4 | **Raster Canvas** | Hosts editable pixel-backed document. | `Document -> Canvas events` | Efficient tiling and undo necessary. |

| 5 | **Image Resize** | Changes dimensions with chosen resampling. | `Pixels + bounds -> Pixels` | Define aspect ratio and gamma behavior. |

| 6 | **Image Crop** | Extracts bounded region. | `Pixels + rectangle -> Pixels` | Out-of-bounds policy required. |

| 7 | **Image Rotate** | Rotates pixels with pivot and interpolation. | `Pixels + angle -> Pixels` | Transparent edge handling. |

| 8 | **Image Flip** | Mirrors image along chosen axis. | `Pixels + axis -> Pixels` | Update annotations if linked. |

| 9 | **Image Color Convert** | Converts between declared color spaces. | `Pixels + profile -> Pixels` | Do not silently discard ICC profiles. |

| 10 | **Brightness Contrast** | Adjusts tonal response. | `Pixels + controls -> Pixels` | Prefer nondestructive preview. |

| 11 | **Saturation Hue** | Modifies saturation and hue. | `Pixels + settings -> Pixels` | Handle grayscale and color space. |

| 12 | **Levels Curves** | Maps tonal channels through control points. | `Pixels + curves -> Pixels` | Avoid clamping artifacts unexpectedly. |

| 13 | **Convolution Filter** | Applies parameterized kernel to image. | `Pixels + kernel -> Pixels` | Bound kernel size and edge policy. |

| 14 | **Gaussian Blur** | Blurs pixels by configurable radius. | `Pixels + radius -> Pixels` | Benchmark large radii. |

| 15 | **Sharpen** | Increases edge contrast within defined limits. | `Pixels + amount -> Pixels` | Avoid severe ringing. |

| 16 | **Edge Detection** | Computes gradient or other edge map. | `Pixels + algorithm -> Map` | Distinguish diagnostic from true segmentation. |

| 17 | **Threshold** | Converts luminance or channel to mask. | `Image + cutoff -> Mask` | Antialiasing policy matters. |

| 18 | **Mask Combine** | Joins masks by set/alpha operations. | `Masks + mode -> Mask` | Use consistent coordinates. |

| 19 | **Paint Brush** | Emits pressure-aware strokes into document. | `Strokes + brush settings -> Document edits` | Group undo and handle latency. |

| 20 | **Eraser Brush** | Removes or masks pixels using strokes. | `Strokes + mode -> Document edits` | Respect layer alpha locking. |

| 21 | **Layer Stack** | Orders raster, vector, and adjustment layers. | `Layer model -> Composited image` | Blends and clipping semantics required. |

| 22 | **Blend Modes** | Composites layers with selected operation. | `Images + blend + opacity -> Image` | Color-space correctness matters. |

| 23 | **Selection Marquee** | Creates rectangular or elliptical selection. | `Pointer drag -> Selection mask` | Snap and coordinate conversion. |

| 24 | **Lasso Selection** | Creates freeform polygon selection. | `Points -> Mask` | Handle self-intersection policy. |

| 25 | **Magic Wand** | Selects contiguous pixels by tolerance. | `Image + seed -> Mask` | Performance and tolerance definitions. |

| 26 | **Transform Handles** | Applies translation, scale, skew, rotation. | `Selection + transform -> Updated geometry` | Matrix order and pivot critical. |

| 27 | **Image Histogram** | Computes channel distribution. | `Pixels -> Histogram` | Define sampling and alpha handling. |

| 28 | **Color Palette Extractor** | Finds representative colors in image. | `Image + count -> Palette` | Output is approximation, not semantics. |

| 29 | **Sprite Sheet Slicer** | Extracts tile regions from atlas. | `Image + grid -> Tiles` | Handle partial cells and transparency. |

| 30 | **Tileability Preview** | Renders tiled repetition and seam overlays. | `Image -> Tiled view` | Preview does not guarantee seamless texture. |

| 31 | **Background Removal Adapter** | Runs explicitly supplied segmentation pipeline. | `Image -> Mask + foreground` | Quality varies; measure failure cases. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 10. Vector graphics, drawing, and geometry — 20 proposed blocks

Expansion. Vector topology and SVG import/export have security and numerical robustness concerns.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Vector Canvas** | Renders editable shapes and paths. | `Shape graph -> Canvas` | Keep coordinate and selection fidelity. |

| 2 | **Rectangle Shape** | Creates rectangle with radius and stroke. | `Bounds + style -> Geometry` | Clamp radii and handle negative sizes. |

| 3 | **Ellipse Shape** | Creates ellipse or circle. | `Bounds + style -> Geometry` | Arc approximation depends on renderer. |

| 4 | **Polygon Shape** | Creates closed polygon with vertices. | `Points + fill -> Shape` | Self-intersection needs rule. |

| 5 | **Polyline Shape** | Creates open connected segments. | `Points + stroke -> Shape` | Joint and cap options. |

| 6 | **Bezier Path** | Creates editable cubic or quadratic curves. | `Control points -> Path` | Preserve tangent handles. |

| 7 | **Freehand Vector Stroke** | Converts pointer samples into path. | `Samples -> Path` | Simplification may change precision. |

| 8 | **Text on Path** | Places glyphs along a path. | `Text + path -> Layout` | Font metrics and RTL issues. |

| 9 | **Boolean Union** | Unions compatible planar shapes. | `Two shapes -> Shape` | Geometry robustness at small edges. |

| 10 | **Boolean Subtract** | Subtracts one shape from another. | `Two shapes -> Shape` | Winding and holes must be preserved. |

| 11 | **Boolean Intersect** | Keeps overlapping shape regions. | `Shapes -> Shape` | Tolerance policy required. |

| 12 | **Stroke Expand** | Converts outline stroke to filled geometry. | `Path + width -> Shape` | Join style affects output. |

| 13 | **Path Simplify** | Reduces points within tolerance. | `Path + tolerance -> Path` | Show possible fidelity loss. |

| 14 | **Shape Align** | Aligns and distributes selected objects. | `Shapes + axis -> Transforms` | Respect locked objects. |

| 15 | **Group Shapes** | Creates reusable transform group. | `Shape set -> Group` | Coordinate nesting semantics. |

| 16 | **SVG Import** | Parses supported vector graphics safely. | `SVG -> Shape graph` | Strip active scripts/external references. |

| 17 | **SVG Export** | Serializes supported vector graphics. | `Shape graph -> SVG` | Document unsupported filters. |

| 18 | **Gradient Fill** | Assigns radial/linear color interpolation. | `Stops + shape -> Fill` | Define interpolation color space. |

| 19 | **Pattern Fill** | Tiles a referenced pattern within shape. | `Asset + transform -> Fill` | Normalize pattern boundaries. |

| 20 | **Vector Export PDF** | Writes supported vector pages to PDF. | `Shapes + page -> PDF` | Text embedding and effects fidelity. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 11. Audio creation and processing — 21 proposed blocks

Expansion. Real-time and offline audio flows require separate latency, codec, and resource policies.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Audio File Decode** | Decodes supported compressed audio formats. | `Bytes -> Audio stream` | Codec licenses and supported formats. |

| 2 | **Audio Output** | Plays stream through selected output device. | `Audio stream -> Playback` | Device switching and latency. |

| 3 | **Audio Input** | Captures microphone with explicit consent. | `Mic device -> Samples` | Permission and privacy notice. |

| 4 | **Audio Recorder** | Writes captured samples to a file. | `Samples + format -> File` | Handle interruption and clipping. |

| 5 | **Waveform View** | Displays zoomable audio amplitude. | `Samples/peaks -> View` | Cache peak data for long files. |

| 6 | **Spectrogram View** | Displays time-frequency analysis. | `Samples + FFT settings -> View` | CPU/GPU trade-offs. |

| 7 | **Trim Audio** | Extracts bounded time interval. | `Audio + range -> Audio` | Preserve sample boundaries. |

| 8 | **Audio Fade** | Applies fade in/out curve. | `Audio + envelope -> Audio` | Prevent discontinuities. |

| 9 | **Gain Control** | Adjusts audio level. | `Samples + gain -> Samples` | Warn about clipping. |

| 10 | **Normalize Loudness** | Targets declared peak/loudness policy. | `Audio + target -> Audio` | Not a guarantee of perceptual equality. |

| 11 | **Audio Mixer** | Combines multiple synchronized tracks. | `Tracks -> Output audio` | Manage clipping and latency. |

| 12 | **Equalizer** | Processes frequency bands. | `Audio + EQ points -> Audio` | Phase and filter stability. |

| 13 | **Compressor** | Controls dynamic range with threshold/ratio. | `Audio + settings -> Audio` | Attack/release behavior. |

| 14 | **Noise Gate** | Attenuates quiet segments below threshold. | `Audio + threshold -> Audio` | May remove faint speech. |

| 15 | **Silence Detector** | Finds regions below level for duration. | `Audio -> Time ranges` | Threshold-dependent false detections. |

| 16 | **Audio Resampler** | Converts sample rate. | `Audio + target rate -> Samples` | Anti-aliasing quality. |

| 17 | **Channel Mapper** | Changes stereo/mono or channel routing. | `Audio + map -> Audio` | Avoid silent phase cancellation. |

| 18 | **Audio Device Selector** | Lists real available devices. | `OS devices -> Selected device` | Hotplug and permissions. |

| 19 | **Timeline Audio Clip** | Adds sample-accurate audio region to timeline. | `Audio + placement -> Clip` | Synchronization with video. |

| 20 | **Text to Speech Adapter** | Calls a configured local/remote speech engine. | `Text + engine -> Audio` | Capability, licensing, and privacy vary. |

| 21 | **Speech Transcript Adapter** | Transcribes via explicitly available model/backend. | `Audio -> Timed words` | Accuracy is not guaranteed. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 12. Video and timeline editing — 24 proposed blocks

Expansion. Timeline correctness depends on precise rational timebases, codecs, frame rates, and resource limits.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Video Decode** | Decodes configured supported video streams. | `Container bytes -> Frames` | Hardware/codec capabilities vary. |

| 2 | **Video Encode** | Encodes frames and audio into target container. | `Frames + audio -> File` | Test timing and codec profile. |

| 3 | **Video Preview** | Presents frames with accurate position display. | `Video source -> Player UI` | Preview may differ from export quality. |

| 4 | **Timeline Ruler** | Renders time ticks, zoom, and playhead. | `Timeline settings -> View` | Use stable timebase. |

| 5 | **Video Clip** | References interval of source footage. | `Media + in/out -> Clip` | Non-destructive source references. |

| 6 | **Clip Trim** | Changes clip boundaries without modifying source. | `Clip + edges -> Clip` | Maintain frame/time precision. |

| 7 | **Clip Split** | Divides a clip at playhead. | `Clip + time -> Two clips` | Avoid off-by-one frame. |

| 8 | **Track Manager** | Adds video/audio/overlay tracks. | `Track model -> Timeline state` | Stable z-order and mute/lock. |

| 9 | **Transition Block** | Applies configured overlap transition. | `Two clips + curve -> Frames` | Handle missing handle frames. |

| 10 | **Keyframe Curve** | Interpolates numeric properties over time. | `Keyframes -> Value by time` | Define extrapolation semantics. |

| 11 | **Frame Extract** | Produces still frame at requested time. | `Video + time -> Image` | Seek accuracy depends on codec. |

| 12 | **Video Thumbnailer** | Generates representative frame thumbnails. | `Clip -> Thumb sequence` | Cache and cancel background jobs. |

| 13 | **Audio Waveform Cache** | Computes audio preview peaks for video tracks. | `Audio stream -> Peaks` | Keep sample/time alignment. |

| 14 | **Color Correction** | Applies tonal transforms to video frames. | `Frames + grades -> Frames` | Performance and color management. |

| 15 | **Video Overlay** | Composites still/text layers over footage. | `Video + overlays -> Video` | Alpha and scaling rules. |

| 16 | **Text Subtitle Track** | Renders timed captions from structured cues. | `Cue list -> Overlay frames` | Fonts, wrapping, and accessibility. |

| 17 | **Subtitle Import** | Parses SRT or other supported cue formats. | `File -> Cue list` | Validate encoding and timestamps. |

| 18 | **Subtitle Export** | Serializes supported timed text formats. | `Cues -> File` | Respect overlapping cue policy. |

| 19 | **Render Queue** | Manages multiple export jobs. | `Jobs -> Status/results` | Persist jobs and failures. |

| 20 | **Render Presets** | Stores codec/quality/output combinations. | `Export options -> Preset` | Warn on unsupported options. |

| 21 | **Frame Rate Convert** | Converts timeline to output frame rate. | `Frame sequence -> New sequence` | Duplicate/drop/interpolate policy. |

| 22 | **Scene Markers** | Adds named timeline navigation landmarks. | `Time + label -> Marker` | Keep markers stable across edits. |

| 23 | **Proxy Media** | Generates lighter editing copies. | `Source -> Proxy + mapping` | Final export must use source when intended. |

| 24 | **Media Relink** | Repairs missing source references. | `Missing paths -> New handles` | Verify file identity or hash. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 13. Three-dimensional assets and scene tooling — 25 proposed blocks

Experimental/Expansion. 3D and voxel tooling should orchestrate tested geometry engines rather than fake reconstruction.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Scene Root** | Defines scene units, coordinate system, and hierarchy. | `Scene settings -> Scene` | Axis and scale must be explicit. |

| 2 | **Mesh Import** | Loads supported mesh data and metadata. | `3D file -> Mesh` | Format fidelity varies. |

| 3 | **Mesh Export** | Serializes supported geometry and materials. | `Mesh -> 3D file` | Validate geometry on reimport. |

| 4 | **Primitive Cube** | Generates parameterized box geometry. | `Dimensions -> Mesh` | Validate positive sizes. |

| 5 | **Primitive Sphere** | Generates sphere topology from parameters. | `Radius + segments -> Mesh` | Avoid degenerate poles where possible. |

| 6 | **Primitive Cylinder** | Generates cylindrical geometry. | `Radius/height -> Mesh` | Handle caps and normals. |

| 7 | **Transform Object** | Applies translation, rotation, scaling. | `Object + transform -> Object` | Distinguish local/world axes. |

| 8 | **Scene Hierarchy** | Displays parent-child object tree. | `Scene graph -> Outline` | Avoid cycles and orphaned handles. |

| 9 | **Material Editor** | Sets basic PBR and texture material fields. | `Material props -> Material` | Renderer differences matter. |

| 10 | **Texture Assignment** | Binds image assets to material channels. | `Images + channel -> Material` | Validate UV and color space. |

| 11 | **UV Viewer** | Visualizes mesh UV islands and texture mapping. | `Mesh + UV -> Editor` | UV data may be absent. |

| 12 | **Mesh Inspector** | Reports faces, vertices, edges, bounds, normals. | `Mesh -> Diagnostics` | Do not claim geometric quality from counts. |

| 13 | **Normals Recompute** | Recalculates surface normals by policy. | `Mesh -> Mesh` | Hard edges and winding preservation. |

| 14 | **Mesh Decimate** | Reduces polygon count by an algorithm. | `Mesh + tolerance -> Mesh` | Evaluate visual loss. |

| 15 | **Mesh Subdivide** | Adds mesh detail using selected method. | `Mesh + levels -> Mesh` | Memory growth can be rapid. |

| 16 | **Mesh Boolean** | Computes union/difference/intersection. | `Two meshes -> Mesh` | Robustness depends on geometry. |

| 17 | **Armature Viewer** | Displays bones and hierarchy. | `Skeleton -> View` | Maintain local rest poses. |

| 18 | **Animation Timeline** | Displays 3D object keyframes. | `Tracks -> Editor` | Time precision and interpolators. |

| 19 | **Keyframe Transform** | Animates position/rotation/scale values. | `Pose + time -> Keyframe` | Quaternions/euler consistency. |

| 20 | **Camera Controller** | Adds orbit, pan, fly, and focus behaviors. | `Inputs -> Camera transform` | Avoid unexpected camera resets. |

| 21 | **Viewport Gizmo** | Presents axis and transform manipulators. | `Selection -> Gizmo interactions` | Accurate picking and constraints. |

| 22 | **Physics Preview Adapter** | Delegates simulation to supported engine. | `Bodies + parameters -> Trace` | Not automatic real-world validation. |

| 23 | **Voxel Grid** | Stores discrete 3D cell data with metadata. | `Dimensions + voxels -> Volume` | Chunk large data sets. |

| 24 | **Voxel Brush** | Paints/erases voxels in selected volume. | `Pointer rays -> Voxel edits` | Group undo and batch updates. |

| 25 | **Biome Config Editor** | Edits named biome resources and generation rules. | `Biome schema -> Data` | Engine-specific runtime still required. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 14. Documents, office tools, and publishing — 23 proposed blocks

Expansion. Comprehensive office-file compatibility is a substantial independent engineering project.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Rich Text Editor** | Edits structured document runs and paragraphs. | `Document -> Edit commands` | Selection model must be stable. |

| 2 | **Text Formatting** | Applies character/paragraph styles to selection. | `Selection + style -> Document edit` | Preserve semantic structure. |

| 3 | **Document Page Layout** | Sets page size, margins, and pagination. | `Page config -> Layout` | Print fidelity is renderer-dependent. |

| 4 | **Headers Footers** | Defines repeated page content. | `Templates -> Page regions` | Page numbering and layout. |

| 5 | **Table Editor** | Adds rows, columns, merged cells, styling. | `Table model -> Commands` | Complex merge invariants. |

| 6 | **Find Replace** | Searches document spans and applies replacements. | `Query + document -> Edits` | Avoid infinite replacement loops. |

| 7 | **Spell Check Adapter** | Calls configured dictionary or checker. | `Text -> Suggestions` | Respect language and privacy. |

| 8 | **Markdown Editor** | Edits markdown text and optional preview. | `Markdown -> Rendered content` | Sanitize unsafe embedded HTML. |

| 9 | **Markdown Export** | Serializes supported document to markdown. | `Document -> Markdown` | Not all rich formatting maps. |

| 10 | **HTML Export** | Serializes document layout as HTML/CSS. | `Document -> Page bundle` | External assets and CSS support. |

| 11 | **PDF Export Adapter** | Renders supported document content to PDF. | `Pages -> PDF` | Verify font embedding and pagination. |

| 12 | **Print Preview** | Shows target printable page layout. | `Document + printer page -> Preview` | Preview can differ from final driver. |

| 13 | **Presentation Slide** | Represents a slide with layered objects. | `Slide model -> View` | Timing and animation support separate. |

| 14 | **Slide Navigator** | Lists slides with reorder and notes. | `Deck -> Selection` | Preserve stable slide IDs. |

| 15 | **Slide Theme** | Applies typography/color/background to deck. | `Theme -> Slides` | Do not override local style unexpectedly. |

| 16 | **Slide Transition** | Defines transition between slide states. | `Timing + effect -> Playback` | Accessibility/reduced motion. |

| 17 | **Presentation Mode** | Shows slides full-screen with navigation. | `Deck -> Playback` | Multiple monitors optional. |

| 18 | **Spreadsheet Grid** | Displays cells, rows, columns, formatting. | `Workbook -> Grid` | Virtualization necessary for large sheets. |

| 19 | **Formula Cell** | Stores expression and computed result. | `Formula + dependencies -> Value` | Dependency cycle handling. |

| 20 | **Formula Engine Adapter** | Delegates formulas to compatible engine. | `Workbook expressions -> Values` | Excel compatibility is a major scope. |

| 21 | **Chart Object** | Visualizes selected workbook or tabular data. | `Series + spec -> Chart` | Avoid misleading axes. |

| 22 | **Document Templates** | Instantiates structured page or deck templates. | `Template + data -> Document` | Respect user-authored content. |

| 23 | **Outline Navigator** | Shows heading or slide hierarchy. | `Structured document -> Outline` | Keep selection synchronized. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 15. Charts, dashboards, and reporting — 19 proposed blocks

Expansion. Charts should preserve source data, unit semantics, and truthful uncertainty and staleness indicators.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Line Chart** | Plots continuous or ordered series over axes. | `Series + axes -> Chart` | Label units and missing points. |

| 2 | **Bar Chart** | Compares categories with bars. | `Categories + values -> Chart` | Zero-baseline policy should be deliberate. |

| 3 | **Scatter Chart** | Plots numeric x/y pairs. | `Points -> Plot` | Handle dense points. |

| 4 | **Area Chart** | Visualizes filled ordered series. | `Series -> Chart` | Stacking changes interpretation. |

| 5 | **Histogram Chart** | Bins observed data into distribution. | `Values + bin rule -> Chart` | Bin choices affect conclusions. |

| 6 | **Pie Chart** | Shows part-to-whole proportions. | `Positive categories -> Chart` | Avoid too many tiny slices. |

| 7 | **Heatmap** | Displays matrix as color-coded cells. | `Matrix -> View` | Accessible legends and contrast. |

| 8 | **Gauge** | Shows value against range and thresholds. | `Value + scale -> Gauge` | Avoid hiding precise number. |

| 9 | **Metric Card** | Shows current KPI with context. | `Metric -> Card` | Include period and units. |

| 10 | **Table Pivot** | Aggregates grouped dimensions and measures. | `Table -> Pivot output` | Validate aggregation grain. |

| 11 | **Filter Panel** | Binds UI filters to report queries. | `Fields -> Filter state` | Distinguish applied and pending filters. |

| 12 | **Dashboard Grid** | Organizes resizable report widgets. | `Widget schema -> Layout` | Save per-user layout safely. |

| 13 | **Chart Tooltip** | Displays values and context on interaction. | `Datum -> Tooltip` | Keyboard accessibility. |

| 14 | **Legend Manager** | Provides series toggles and descriptions. | `Series -> Legend` | Hidden series should be obvious. |

| 15 | **Data Refresh Scheduler** | Triggers approved data source updates. | `Schedule -> Refresh event` | Rate limits and last-run status. |

| 16 | **Export Chart** | Saves visual to supported image/vector format. | `Chart -> File` | Check resolution and transparency. |

| 17 | **Export Report** | Packages selected views with metadata. | `Report sections -> Document` | Include source and refresh timestamps. |

| 18 | **Data Quality Badge** | Shows completeness/freshness warnings. | `Validation results -> Badge` | Avoid declaring unverified data accurate. |

| 19 | **Anomaly Flag** | Highlights values outside declared rule. | `Series + rule -> Flags` | Not causal evidence by itself. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 16. System integration, desktop utilities, and processes — 20 proposed blocks

Expansion. OS-specific privileges and lifecycle events require target-aware adapters and permissions.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Open External App** | Requests OS to open a registered application. | `Target + args -> Result` | User consent and platform differences. |

| 2 | **Shell Command Adapter** | Runs explicitly approved command under limits. | `Command + scope -> Exit/logs` | High risk; restrict environment and arguments. |

| 3 | **Process Monitor** | Observes approved child-process lifecycle. | `Process handle -> Events` | Respect permission and cleanup. |

| 4 | **System Tray Icon** | Adds menu/status presence to tray where supported. | `Icon + menu -> Events` | Availability differs by platform. |

| 5 | **Desktop Notification** | Delivers OS-level notification if permitted. | `Message -> Result` | Quiet hours and user settings. |

| 6 | **Clipboard Read** | Reads clipboard on user-approved action. | `Trigger -> Clipboard content` | Avoid passive secret collection. |

| 7 | **Clipboard Write** | Copies approved text or data. | `Data -> Result` | Preserve expected formats. |

| 8 | **Global Shortcut** | Registers system-wide keyboard combination. | `Shortcut -> Event` | Conflict and permission handling. |

| 9 | **Window Geometry Store** | Remembers last valid window position and size. | `Window events -> Preferences` | Recover offscreen coordinates. |

| 10 | **System Theme Monitor** | Detects dark/light preference changes. | `OS theme -> Event` | Provide manual override. |

| 11 | **System File Association** | Registers optional supported file types. | `Extension + handler -> Setup` | Platform installer integration. |

| 12 | **Protocol Handler** | Registers custom URI handling. | `Scheme -> Launch payload` | Validate untrusted URL content. |

| 13 | **Autostart Configuration** | Configures optional startup behavior. | `User choice -> OS setting` | Never enable without permission. |

| 14 | **Process Resource Stats** | Shows CPU/RAM stats for owned processes. | `Process -> Metrics` | Platform API differences. |

| 15 | **Keyboard Layout Info** | Exposes current input layout properties. | `OS events -> Layout` | Privacy and platform considerations. |

| 16 | **Display Metrics** | Reports resolution, scale, monitors. | `OS -> Display records` | Multi-monitor hotplug and scaling. |

| 17 | **Printer Dialog** | Opens OS printing controls. | `Document -> Print result` | Does not guarantee physical output. |

| 18 | **Font Enumeration** | Lists usable system fonts. | `OS font registry -> Font names` | Embed rights not inferred. |

| 19 | **Sandboxed File Opener** | Launches selected files using allowed system handler. | `File -> Result` | File type can be dangerous. |

| 20 | **Power State Monitor** | Observes suspend/resume and battery status. | `OS events -> State` | Cancel/restart work safely. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 17. AI integrations and intelligent workflows — 21 proposed blocks

Expansion. AI blocks are optional integrations, not dependencies of Spica core, and must report actual backend capabilities.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Local Model Selector** | Chooses among actually installed/available models. | `Model registry -> Model ID` | Capability detection per model required. |

| 2 | **Prompt Template** | Builds structured prompt from verified inputs. | `Template + fields -> Prompt` | Clearly separate data from instructions. |

| 3 | **LLM Text Generation** | Sends request to configured inference backend. | `Messages + config -> Text stream` | Respect cancellation and privacy. |

| 4 | **LLM Structured Output** | Requests typed output then validates it. | `Schema + prompt -> Validated data` | Retry or report parse failure. |

| 5 | **Embedding Adapter** | Creates vectors using configured model. | `Text/data -> Vector` | Dimensionality and licensing vary. |

| 6 | **Vector Search** | Retrieves nearest items from local index. | `Query vector -> Hits` | Similarity is not factual authority. |

| 7 | **Document Chunker** | Splits long documents for retrieval. | `Document -> Chunks` | Preserve provenance and spans. |

| 8 | **Source Retriever** | Fetches relevant saved project/chat sources. | `Query + scope -> Sources` | Ignore untrusted instructions inside sources. |

| 9 | **Tool Invocation Bridge** | Validates and executes allowed external tool. | `Structured call -> Result` | No unscoped arbitrary tool access. |

| 10 | **Agent Task Queue** | Tracks bounded independent AI construction tasks. | `Task descriptors -> Results` | Time/resource limits. |

| 11 | **Agent Change Proposal** | Produces editable graph or code change set. | `Goal + project -> Proposal` | Never auto-apply without policy. |

| 12 | **Agent Plan Inspector** | Displays task stages and explicit acceptance tests. | `Plan -> View` | Distinguish proposed from executed. |

| 13 | **Diff Explainer** | Summarizes confirmed source/graph changes. | `Actual diff -> Explanation` | Link to changes; no inventions. |

| 14 | **Error Explainer** | Maps known diagnostics to actionable guidance. | `Diagnostic -> Suggested repair` | Compiler error remains authoritative. |

| 15 | **Image Description Adapter** | Uses available vision backend when configured. | `Image -> Text description` | Do not invent model capability. |

| 16 | **Speech Input Adapter** | Converts captured speech via available backend. | `Audio -> Transcript` | Show confidence limitations. |

| 17 | **Translation Adapter** | Calls configured translation function/model. | `Text + locales -> Text` | Human review for sensitive content. |

| 18 | **Quality Evaluator** | Scores output using declared measurable criteria. | `Artifact + checks -> Report` | Avoid AI-only fake certainties. |

| 19 | **Agent Recipe Recommendation** | Suggests reusable graph patterns. | `Project history -> Recipe draft` | Keep project data private. |

| 20 | **Model Capability Inspector** | Reads live backend features and limitations. | `Backend info -> Capability manifest` | No assumption that toggles enable support. |

| 21 | **Conversation Memory Link** | References approved Sources in task context. | `Source IDs -> Context` | Respect project boundaries. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 18. Automation, scheduling, and background work — 18 proposed blocks

Expansion. Background scheduling requires real queues, cancellation, idempotence, and retained task state.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Periodic Scheduler** | Emits tasks on a local configured interval. | `Schedule -> Task event` | Power state and clock changes. |

| 2 | **Calendar Trigger Adapter** | Connects permitted calendar events to workflows. | `Event source -> Trigger` | Requires explicit external integration. |

| 3 | **Directory Automation** | Runs scoped flow when file changes are observed. | `Watcher events -> Actions` | Prevent recursive loops. |

| 4 | **Batch Processor** | Applies a flow to a collection with progress. | `Items + action -> Results` | Concurrency and retry policy. |

| 5 | **Job Dependency DAG** | Runs tasks when prerequisites complete. | `Task graph -> Execution states` | Detect cycles before scheduling. |

| 6 | **Task Retry Queue** | Retries failed jobs with bounded backoff. | `Failed job -> Queue` | Idempotence essential. |

| 7 | **Background Worker** | Runs CPU-bound operations away from UI thread. | `Work request -> Result` | Limit parallel workers. |

| 8 | **Cron Expression Parser** | Interprets schedule expressions. | `Cron + zone -> Occurrences` | DST semantics must be defined. |

| 9 | **Idle Time Trigger** | Starts permitted work after inactivity window. | `Idle state -> Event` | User control and privacy. |

| 10 | **Startup Task** | Registers selected work at app startup. | `Task -> Lifecycle execution` | Avoid startup freeze. |

| 11 | **Pause Resume Task** | Exposes stateful task interruption controls. | `Task handle -> State` | Resume only if implementation supports it. |

| 12 | **Task Checkpoint** | Stores resumable intermediate job state. | `State -> Checkpoint` | Validate version when loading. |

| 13 | **Pipeline Monitor** | Shows dependencies, active nodes, and failures. | `Job graph -> UI` | Trace to actual work events. |

| 14 | **Automation Log** | Stores compact structured task history. | `Events -> Records` | Redact secrets and rotate logs. |

| 15 | **Automation Dry Run** | Simulates reversible decisions without side effects. | `Workflow -> Preview outcome` | Clearly label simulation. |

| 16 | **Conditional Trigger** | Runs task only when typed predicate passes. | `Signal + predicate -> Trigger` | Avoid repeated evaluation loops. |

| 17 | **Notification Rule** | Sends updates on specific real task transitions. | `Events + policy -> Alerts` | Deduplicate and respect quiet mode. |

| 18 | **Resource Quota** | Limits CPU/RAM/concurrency by workflow. | `Limits -> Scheduler constraints` | Enforce server-side where possible. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 19. Code editing, debugging, and developer experience — 22 proposed blocks

Core integration with Glitch. Prefer existing code-editing infrastructure and keep generated files distinct from user-owned source.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Code Editor** | Edits source files with syntax service integration. | `File -> Edit operations` | Avoid mixing generated and custom ownership. |

| 2 | **Syntax Highlighting** | Colors known language grammar in editor. | `Source + language -> Tokens` | Not proof of valid syntax. |

| 3 | **Language Server Adapter** | Exposes diagnostics, completion, symbols. | `Workspace -> LSP messages` | Manage server lifecycle safely. |

| 4 | **Find in Files** | Searches allowed project tree. | `Query -> File matches` | Avoid scanning huge vendor dirs blindly. |

| 5 | **Replace in Files** | Applies reviewed source edits. | `Query + replacement -> Diff` | Scope and rollback required. |

| 6 | **Refactor Rename** | Renames symbol through language-aware tooling. | `Symbol + name -> Change set` | Do not use plain text replacement. |

| 7 | **Git Diff View** | Shows staged and unstaged modifications. | `Repository -> Diff` | Preserve user edits. |

| 8 | **Terminal Panel** | Hosts a scoped integrated terminal. | `Approved shell -> IO` | High-risk actions need guardrails. |

| 9 | **Build Log Viewer** | Streams actual compiler and package messages. | `Process output -> Log` | Keep exact exit codes. |

| 10 | **Diagnostic Navigator** | Jumps from error to node or source line. | `Diagnostic -> Location` | Source mappings required. |

| 11 | **Breakpoint** | Pauses compatible debugger at location. | `Location -> Pause event` | Target/runtime dependent. |

| 12 | **Watch Expression** | Evaluates safe debug expression in context. | `Expression -> Value` | Don't execute arbitrary code in production. |

| 13 | **Call Stack View** | Displays debug stack frame chain. | `Runtime state -> Frames` | Requires debugger support. |

| 14 | **Performance Profiler** | Captures actual CPU/frame task measurements. | `Runtime session -> Trace` | Profile overhead documented. |

| 15 | **Memory Inspector** | Shows tracked allocations and resource snapshots. | `Runtime -> Metrics` | Native integration required. |

| 16 | **Code Formatting** | Applies configured format rules. | `Source -> Formatted source` | Preserve meaningful comments. |

| 17 | **Type Check** | Invokes installed language type checker. | `Project -> Diagnostics` | Record exact command and version. |

| 18 | **Test Runner** | Invokes actual unit/integration suite. | `Test config -> Results` | `Not run` is distinct from pass. |

| 19 | **Dependency Inspector** | Displays direct and transitive packages. | `Lockfile -> Dependency graph` | Flag version conflicts. |

| 20 | **Package License Report** | Records dependencies and license metadata. | `Dependencies -> Report` | Confirm from real package data. |

| 21 | **Native Extension Editor** | Authors source for typed runtime adapter. | `Contract -> Custom code` | Needs target compiler and permissions. |

| 22 | **Source Map Navigator** | Links generated source to originating blocks. | `Node ID -> File spans` | Regeneration updates spans. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 20. Build, packaging, publishing, and diagnostics — 24 proposed blocks

Core for supported targets. Only declare build success after real toolchain execution completes successfully.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Target Selector** | Chooses available output platform and mode. | `Target profiles -> Selected target` | Check supported toolchains. |

| 2 | **Toolchain Probe** | Verifies installed compilers and required SDKs. | `Target -> Capability report` | Report exact version and path. |

| 3 | **Dependency Resolver** | Pins compatible packages from manifests. | `Constraints -> Lock plan` | Avoid blind upgrades. |

| 4 | **Graph Static Validator** | Checks ports, cycles, target, and capabilities. | `Graph -> Diagnostics` | Must run before codegen. |

| 5 | **IR Builder** | Converts validated graph to typed intermediate form. | `Graph -> IR` | Preserve node origin maps. |

| 6 | **IR Optimizer** | Removes dead or constant operations safely. | `IR -> Optimized IR` | Semantic equivalence tests. |

| 7 | **React Emitter** | Produces idiomatic React/TypeScript modules. | `UI IR -> Source files` | Version-specific component APIs. |

| 8 | **Tauri Adapter** | Produces frontend/native integration configuration. | `App IR -> Tauri project` | Correct permission scoping. |

| 9 | **Electron Adapter** | Produces preload/main/renderer boundaries. | `App IR -> Electron project` | Context isolation and IPC validation. |

| 10 | **Web Adapter** | Produces browser-bounded source bundle. | `App IR -> Web project` | No native API assumptions. |

| 11 | **CLI Target Adapter** | Produces a command-line application shell. | `Task IR -> CLI project` | UX differs from visual apps. |

| 12 | **Build Process** | Invokes actual compiler/bundler with logs. | `Generated project -> Artifacts` | Exit status is authoritative. |

| 13 | **Build Cache** | Reuses verified unchanged intermediate outputs. | `Content keys -> Cached artifacts` | Handle invalidation and clean option. |

| 14 | **Test Artifact Publisher** | Groups actual test reports with build ID. | `Test results -> Report bundle` | Preserve failure details. |

| 15 | **Application Icon Builder** | Generates target-specific icon sizes from asset. | `Source image -> Icon set` | Validate transparency and size. |

| 16 | **Manifest Editor** | Edits app metadata, permissions, and identifiers. | `Metadata -> Target manifest` | Keep identifiers legal per target. |

| 17 | **Package Builder** | Produces target-specific distribution package. | `Build output -> Installer/archive` | Platform signing requirements vary. |

| 18 | **Portable Bundle Export** | Packages source, manifests, and resources. | `Project -> Archive` | Scrub secrets. |

| 19 | **Build Reproducibility Check** | Compares outputs under controlled inputs. | `Build A/B -> Comparison` | Some timestamps vary. |

| 20 | **Release Notes Generator** | Summarizes verified version-to-version changes. | `Diffs + tests -> Notes` | No invented features. |

| 21 | **Version Bumper** | Updates semantic release metadata with checks. | `New version -> Manifests` | Check breaking changes. |

| 22 | **Dependency Audit** | Scans package metadata for known risk signals. | `Lockfile -> Findings` | Advisory data may be stale offline. |

| 23 | **Crash Report Bundle** | Collects redacted diagnostic artifacts locally. | `Error + logs -> Bundle` | User reviews before sharing. |

| 24 | **Export Integrity Verifier** | Reopens packaged output or checks checksum. | `Artifact -> Verification` | Check actual artifact, not only existence. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 21. Testing, validation, and benchmarks — 22 proposed blocks

Core. Verification should cover contracts, generated code, actual runtime behavior, data safety, and accessibility.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Unit Test Definition** | Defines block-level inputs and expected outputs. | `Fixture + expected -> Case` | Repeatable deterministic inputs. |

| 2 | **Contract Test** | Checks ports, errors, capabilities, and semantics. | `Block implementation -> Results` | Test every advertised target. |

| 3 | **Graph Fixture** | Stores sample valid/invalid graph cases. | `Project snapshot -> Test data` | Stable IDs and migrations. |

| 4 | **Integration Test** | Exercises connected real services. | `Scenario -> Assertions` | Isolate external effects. |

| 5 | **End to End UI Test** | Drives app through realistic interactions. | `Actions -> Observed UI state` | Requires actual target runtime. |

| 6 | **Snapshot Test** | Compares serialized graph or generated source. | `Actual -> Diff` | Review intentional updates. |

| 7 | **Accessibility Test** | Detects common keyboard/semantic defects. | `UI output -> Findings` | Manual checks still required. |

| 8 | **Permissions Test** | Verifies denied and granted capability behavior. | `Grant state -> Expected outcome` | Denied path must be robust. |

| 9 | **Cancellation Test** | Stops operation and verifies cleanup. | `Running task -> Cancel result` | Check orphan processes. |

| 10 | **Fault Injection** | Simulates IO, network, and runtime failures. | `Fault scenario -> Result` | Never destroy real user data. |

| 11 | **Boundary Value Test** | Tests min/max, empty, and invalid inputs. | `Inputs -> Assertions` | Include Unicode/large payloads. |

| 12 | **Load Test** | Exercises operations under sustained workload. | `Workload -> Metrics` | Reproducible environment. |

| 13 | **Memory Leak Check** | Measures resource growth across repeated actions. | `Scenario -> Usage series` | Set tolerances and duration. |

| 14 | **Performance Budget** | Flags regressions against defined thresholds. | `Metric + target -> Pass/fail` | Compare equivalent hardware. |

| 15 | **Golden Build Test** | Rebuilds known project and compares behavior. | `Fixture -> Build results` | Clean environment. |

| 16 | **Cross Target Matrix** | Runs same contract on supported targets. | `Block + targets -> Matrix` | Unsupported is not failure if declared. |

| 17 | **Migration Test** | Opens old project and upgrades data. | `Legacy fixture -> New project` | Verify backup/recovery. |

| 18 | **Property Based Test** | Generates input combinations within contract. | `Generator -> Cases` | Shrink failing cases. |

| 19 | **Fuzz Parser** | Exercises file/import parsers with malformed data. | `Bytes -> Crash/error` | Isolate resource usage. |

| 20 | **Visual Regression Test** | Compares UI renders across revisions. | `Screens -> Diffs` | Font/platform variation. |

| 21 | **Output File Reopen Test** | Reopens exported file using independent decoder. | `File -> Verification` | Detect malformed output. |

| 22 | **Manual Acceptance Checklist** | Captures human-reviewed scenario requirements. | `Checklist -> Evidence record` | Never auto-mark untested steps. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 22. Security, capabilities, and privacy — 18 proposed blocks

Core. Enforce capability decisions at privileged boundaries, not only by hiding UI buttons.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Capability Manifest** | Declares required project/app privileges. | `Blocks -> Permission set` | Distinguish build and runtime grants. |

| 2 | **Permission Request** | Requests approval for a scoped operation. | `Capability + scope -> Decision` | Exact intent and affected files. |

| 3 | **Permission Inspector** | Shows effective grants and why needed. | `Policy state -> Review UI` | Explain transitive dependencies. |

| 4 | **Secret Reference** | Holds opaque pointer to secure credential. | `Secret ID -> Scoped handle` | No plaintext in graph. |

| 5 | **Secure Storage Adapter** | Uses OS-supported secrets storage. | `Credential -> Handle` | Availability varies by platform. |

| 6 | **Content Sanitizer** | Removes unsupported unsafe content from input. | `Untrusted content -> Safe subset` | Must be context-specific. |

| 7 | **URL Validator** | Validates allowed schemes and destinations. | `URL -> Allowed/denied` | Protect custom protocol handling. |

| 8 | **Path Access Guard** | Confines writes/reads to approved roots. | `Scoped path -> Guarded path` | Follow symlinks carefully. |

| 9 | **Input Size Guard** | Caps uploaded/imported data size. | `Data stream -> Allowed/error` | Check decompression limits. |

| 10 | **Rate Limit Guard** | Caps repeated operations and requests. | `Operation -> Allowed/error` | Limit per user or app context. |

| 11 | **Audit Event Writer** | Records actual security-relevant decisions. | `Events -> Audit records` | Rotate and redact sensitive data. |

| 12 | **Dependency Trust View** | Displays signature/hash and source metadata. | `Package -> Trust report` | Unknown does not mean safe. |

| 13 | **Block Quarantine** | Disables suspicious extension until review. | `Block ID -> Disabled state` | Keep project recoverable. |

| 14 | **Network Allowlist** | Restricts outbound hosts for selected apps. | `Domains -> Policy` | Redirects and DNS implications. |

| 15 | **Data Redaction** | Removes configured secrets before logs/export. | `Text/data -> Redacted content` | Test patterns, avoid overconfidence. |

| 16 | **Privacy Mode** | Disables optional network features and telemetry. | `User choice -> Config` | Enforce in actual services. |

| 17 | **Consent Log** | Records approved privileged changes. | `Decisions -> Audit` | Revocable where feasible. |

| 18 | **Sandbox Launch** | Runs untrusted preview under resource constraints. | `Build -> Isolated process` | Isolation strengths vary by OS. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 23. Accessibility, localization, and inclusive UX — 19 proposed blocks

Core. Every essential operation should remain possible without mouse dragging or AI prompts.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Accessible Label** | Binds meaningful name to interactive control. | `UI node + text -> Semantics` | No placeholder-only labels. |

| 2 | **Focus Manager** | Controls deterministic keyboard focus behavior. | `Navigation events -> Focus target` | Restore focus after dialogs. |

| 3 | **Keyboard Navigation Map** | Defines tab and arrow-key order. | `UI hierarchy -> Navigation graph` | Avoid traps and hidden focus. |

| 4 | **Screen Reader Announcement** | Emits status through accessible region. | `Event -> Announcement` | Prevent repetitive noise. |

| 5 | **Contrast Checker** | Measures palette contrast against requirements. | `Colors -> Findings` | Actual compositing may change result. |

| 6 | **Reduced Motion Provider** | Adapts transitions to user preference. | `OS/app setting -> Motion config` | Do not rely solely on animation. |

| 7 | **Text Scaling Preview** | Simulates larger user font sizes. | `Scale factor -> Layout preview` | Detect clipping and overflow. |

| 8 | **High Contrast Theme** | Provides alternative semantic token set. | `Theme tokens -> Styled UI` | Test focus and disabled states. |

| 9 | **Locale Selector** | Chooses supported application language. | `Locales -> Active locale` | Persist explicit choice. |

| 10 | **Pluralization** | Formats counts using locale rules. | `Count + message -> Text` | Grammar varies across languages. |

| 11 | **Number Formatter** | Formats decimals, currency, percentages. | `Value + locale -> Text` | Keep internal numeric data separate. |

| 12 | **Date Time Formatter** | Formats temporal values appropriately. | `Timestamp + zone -> Text` | Avoid ambiguous stored dates. |

| 13 | **Right To Left Layout** | Mirrors directional UI when appropriate. | `Locale -> Layout rules` | Icons and code text need exceptions. |

| 14 | **Translation Catalog** | Stores keyed localized strings. | `Key + locale -> String` | Missing translation diagnostics. |

| 15 | **Locale Fallback** | Resolves absent messages deterministically. | `Locale chain -> Message` | Avoid blank buttons. |

| 16 | **Accessible Graph Outline** | Describes nodes and edges in hierarchical list. | `Graph -> Tree/table` | Editable without dragging. |

| 17 | **Voice Command Adapter** | Maps permitted speech inputs to studio commands. | `Transcript -> Command proposal` | Confirm destructive commands. |

| 18 | **Color Blindness Preview** | Simulates common color-perception differences. | `UI palette -> Preview` | Simulation is approximate. |

| 19 | **Hit Target Checker** | Flags undersized touch/pointer targets. | `UI geometry -> Warnings` | Platform guidelines differ. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 24. Collaboration, version control, and content management — 17 proposed blocks

Expansion. Preserve local-first workflow and deterministic graph files before adding collaborative services.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Project Snapshot** | Saves named revision with metadata. | `Current project -> Checkpoint` | Include lockfile state. |

| 2 | **Semantic Diff** | Compares graph nodes, properties, and edges. | `Two revisions -> Change list` | Distinguish move-only changes. |

| 3 | **Semantic Merge** | Merges compatible graph operations. | `Branches -> Merge proposal` | Conflict detection mandatory. |

| 4 | **Change Review** | Approves or rejects scoped proposed edits. | `Diff -> Decision` | Preserve unrelated decisions. |

| 5 | **Git Repository Adapter** | Reads status/branches and performs approved changes. | `Repo -> Operations` | No silent push or destructive reset. |

| 6 | **Git Commit Composer** | Creates reviewed commit with summary. | `Staged changes -> Commit` | User-controlled author data. |

| 7 | **Branch Switch Safety** | Protects uncommitted and autosaved changes. | `Branch target -> Safe switch` | Check conflicts first. |

| 8 | **Review Comment** | Attaches feedback to node or graph revision. | `Target + text -> Comment` | Preserve context if node moves. |

| 9 | **Contributor Role** | Defines read/edit/approve/build privileges. | `Users + roles -> Policy` | Avoid trusting client-only state. |

| 10 | **Presence Cursor** | Shows collaborators' editing locations. | `Session -> Presence UI` | Optional, privacy-respecting. |

| 11 | **Shared Recipe Library** | Publishes approved recipes in selected scope. | `Recipe -> Package` | Must not expose private assets. |

| 12 | **Project Package Import** | Loads bundle with integrity and trust checks. | `Archive -> Project` | Untrusted code remains restricted. |

| 13 | **Project Package Export** | Writes portable project bundle and manifest. | `Project -> Bundle` | Validate absence of secrets. |

| 14 | **Asset Provenance** | Records origin, license, and transform history. | `Asset -> Metadata` | Unknown license remains unknown. |

| 15 | **Conflict Resolver** | Presents competing edits with source context. | `Conflict -> Resolution` | Avoid blind auto-merge. |

| 16 | **Task Handoff** | Packages current goals and artifacts for another user. | `Task state -> Summary` | Respect project permissions. |

| 17 | **Change Attribution** | Records which actor changed a graph element. | `Transaction -> Audit link` | Avoid confusing AI suggestions with executed edits. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 25. Specialized advanced adapters — 20 proposed blocks

Expansion/Experimental. Typed adapters expose sophisticated external engines but cannot guarantee their performance or safety.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Python Worker Adapter** | Calls approved Python processing module. | `Typed payload -> Result` | Python runtime is not automatically bundled. |

| 2 | **Rust Native Adapter** | Invokes typed Rust command or library. | `Typed call -> Result` | Native privileges and panic isolation. |

| 3 | **FFmpeg Adapter** | Exposes configured multimedia operations. | `Media + flags -> Output` | Validate installed binary and codecs. |

| 4 | **GPU Compute Adapter** | Executes configured shader/compute kernel. | `Buffers + kernel -> Output` | Device compatibility and memory limits. |

| 5 | **WebAssembly Module** | Calls trusted WASM function with typed boundary. | `Inputs -> Outputs` | Resource limits and imports. |

| 6 | **OpenGL Renderer Adapter** | Hosts specific approved GL renderer. | `Scene -> Frame` | API/platform compatibility. |

| 7 | **WebGPU Renderer Adapter** | Hosts WebGPU-based scene and effects. | `Scene + pipeline -> Frame` | Feature availability varies. |

| 8 | **Local Server Bridge** | Connects UI to approved local backend. | `Endpoint + schema -> Typed calls` | Restrict origins and ports. |

| 9 | **Database Driver Bridge** | Wraps non-default supported database driver. | `Connection + query -> Rows` | Credentials and migration checks. |

| 10 | **Printer Device Bridge** | Connects to verified printer protocol adapter. | `Device commands -> Telemetry` | Physical actions require stronger controls. |

| 11 | **Serial Port Adapter** | Communicates with user-selected serial device. | `Port + bytes -> Stream` | Permission and framing checks. |

| 12 | **Bluetooth Adapter** | Connects to approved device when supported. | `Device ID -> Messages` | Platform permission differences. |

| 13 | **USB Device Adapter** | Uses validated device-specific protocol. | `Device handle -> IO` | Driver and access boundaries. |

| 14 | **Sensor Stream Adapter** | Normalizes supported sensor readings. | `Device -> Typed stream` | Calibration and sampling limits. |

| 15 | **Game Engine Bridge** | Maps editor data to explicit engine APIs. | `Asset/config -> Engine data` | No direct engine replacement. |

| 16 | **Prism Compiler Bridge** | Calls future custom Prism toolchain if present. | `Source -> Diagnostics/artifacts` | Requires independently implemented compiler. |

| 17 | **Native Dialog Bridge** | Adapts target-specific OS dialogs. | `Request -> User decision` | Do not mock native success in preview. |

| 18 | **Search Engine Adapter** | Invokes locally installed search/index tool. | `Query -> Ranked results` | Score is not correctness. |

| 19 | **Image Segmentation Adapter** | Calls user-configured segmentation implementation. | `Image -> Mask` | Quality and license depend on backend. |

| 20 | **OCR Adapter** | Uses explicit optical character recognition backend. | `Image -> Text spans` | Accuracy and supported languages vary. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


### 26. Optional experimental building blocks — 19 proposed blocks

Experimental. Each idea requires a measurable research prototype and honest capability labeling.

| # | Block | Purpose | Conceptual interface | Critical implementation note |
|---:|---|---|---|---|

| 1 | **Natural Language Flow Search** | Locates graph patterns from conversational query. | `Query -> Candidate subgraphs` | Requires evaluation for false matches. |

| 2 | **Automatic Recipe Miner** | Suggests common reusable graph clusters. | `Local history -> Recipe draft` | Never publish without approval. |

| 3 | **Screenshot to Layout Draft** | Estimates UI regions and properties from an image. | `Screenshot -> Proposed UI graph` | Not guaranteed exact or legally reusable. |

| 4 | **Design Drift Detector** | Flags UI inconsistencies against project tokens. | `Screens + tokens -> Findings` | Suggestions need human review. |

| 5 | **Generated Code Complexity Map** | Highlights costly or tangled graph modules. | `IR/source -> Hotspots` | Complexity scores are heuristics. |

| 6 | **Graph Auto Refactor** | Proposes subgraph extraction from repeated nodes. | `Graph -> Change proposal` | Needs tests for behavior preservation. |

| 7 | **Target Migration Advisor** | Suggests replacement blocks for incompatible target. | `Project + target -> Plan` | Cannot guarantee parity. |

| 8 | **Offline Docs Synthesizer** | Generates contextual help from local manifests/docs. | `Block + docs -> Explanation` | Distinguish summary from official docs. |

| 9 | **Voice Driven Construction** | Converts spoken directions into proposed graph changes. | `Speech -> Change proposal` | Confirmation and recognition limits. |

| 10 | **Interactive Tutorial Generator** | Builds walkthrough from actual recipe steps. | `Recipe -> Lesson` | Human QA for accuracy. |

| 11 | **Performance Repair Advisor** | Suggests optimizations based on profiler trace. | `Trace -> Recommendations` | Verify benefits with reruns. |

| 12 | **Graph Test Generator** | Proposes tests from block contracts and flows. | `Graph -> Test drafts` | Generated tests must not self-certify. |

| 13 | **Project Readiness Score** | Summarizes evidence-based completion criteria. | `Tests + warnings -> Score` | Scores never replace detailed evidence. |

| 14 | **Runtime Behavior Recorder** | Captures permitted UI actions for replay. | `Session -> Replay trace` | Privacy and nondeterminism. |

| 15 | **Visual Algorithm Playground** | Tests image/mesh/audio kernels in isolation. | `Module + fixtures -> Measured outputs` | No claims of universal quality. |

| 16 | **Local Knowledge Map** | Links Sources, blocks, recipes, and decisions. | `Project references -> Graph` | Avoid injecting all notes into prompts. |

| 17 | **Multi Spark Review** | Has separate Sparks propose/review graph diff. | `Draft diff -> Review comments` | Multiple AI opinions not a proof. |

| 18 | **App Self Diagnostic Panel** | Embeds optional real health checks in output app. | `Runtime probes -> Report` | Requires privacy-conscious design. |

| 19 | **Graph-to-Teaching-Course** | Converts verified tasks into educational lessons. | `Project milestones -> Lessons` | Educational content needs review. |


**Catalog gate:** For this category, at least one complete sample application or test fixture should demonstrate that featured blocks perform their advertised behavior rather than only render UI placeholders.


**Block atlas total: 578 distinct proposed capability blocks across 26 domains.**

# Part VII — Recipe atlas and ready-made construction patterns

<a id="spica-chapter-32"></a>
## 32. A library of feature recipes and complete starter applications

Recipes assemble actual blocks, configuration, flows, error handling, and tests. They are **design targets**, not claims of implementation. A recipe should have parameters, required capabilities, an editable expanded graph, version locks, and verification criteria.


### 01. Starter applications — 16 recipes


**1. Minimal Desktop Window.** A styled native window with safe exit behavior. **Composition:** App Root, Native Window, Text Label, Theme. **Definition of done:** Verify launch, resize, and close without Solarium.


**2. Settings Application.** A three-page preferences editor with persistence. **Composition:** Sidebar Navigation, Form Group, Preferences Store, Reset Flow. **Definition of done:** Verify saved settings after process restart.


**3. Notes Organizer.** Local note editing, searching, and export. **Composition:** List, Rich Text Editor, Search Index, Repository, Export. **Definition of done:** Verify notes survive close/reopen and missing file recovery.


**4. Task List.** Manage ordered tasks with categories and completed state. **Composition:** Record Schema, List, Form, Sorting, Local Store. **Definition of done:** Verify no duplicate IDs and persistent completion.


**5. Personal Journal.** Create dated journal entries with optional tags. **Composition:** Date Picker, Text Editor, Document Store, Search. **Definition of done:** Verify entry lookup and secure local storage.


**6. Contact Directory.** Add, search, sort, and export contact records. **Composition:** Form Schema, Database, Table, Search, CSV. **Definition of done:** Verify special characters survive round trip.


**7. Inventory Tracker.** Maintain item quantity, tags, and movement records. **Composition:** Entity Schema, SQLite, Table, History, Report. **Definition of done:** Reject invalid negative stock and restore backups.


**8. Bookmark Manager.** Store categorized local URL bookmarks. **Composition:** List, Tags, URL Validator, Export. **Definition of done:** Disallow unsafe URI schemes and preserve titles.


**9. Recipe Book.** Store ingredients, instructions, tags, and quantities. **Composition:** Form, Text Editor, Database, Search. **Definition of done:** Verify measurements and exports.


**10. Simple Calendar.** Manage personal dated events offline. **Composition:** Calendar Grid, Form, Local Store, Reminders. **Definition of done:** Verify date/time zone behavior.


**11. Workout Logger.** Track sessions, exercises, and progress charts. **Composition:** Forms, Database, Line Chart, Export. **Definition of done:** Confirm units and date ordering.


**12. Library Catalog.** Record books, media, and lending status. **Composition:** Table, Search, Repository, Detail Editor. **Definition of done:** Verify duplicate key and return workflows.


**13. Expense Notebook.** Keep manually entered expense records. **Composition:** Currency Inputs, Database, Summaries, CSV. **Definition of done:** Do not imply regulated finance compliance.


**14. Desktop Launcher.** Organize approved local apps and projects. **Composition:** Grid, Config Store, External App Adapter, Permissions. **Definition of done:** Verify the launcher cannot execute unapproved commands.


**15. Timer Utility.** Start, stop, pause, and reset multiple timers. **Composition:** Timer, State Machine, Notifications, UI. **Definition of done:** Check sleep/resume and cancellation.


**16. Markdown Notebook.** Manage markdown files with live preview. **Composition:** File Picker, Markdown Editor, HTML Preview, Save. **Definition of done:** Verify reversible file edits.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 02. Project and workspace shells — 15 recipes


**1. Editor Shell.** Standard multi-panel desktop editor layout. **Composition:** Docking Workspace, Tabs, Inspector, Status Bar. **Definition of done:** Verify panel persistence and keyboard resizing.


**2. Document Workspace.** Multiple documents with dirty-state protection. **Composition:** Document Tabs, Save Dialog, Undo, File Handling. **Definition of done:** Confirm close prompts for unsaved changes.


**3. Media Workspace.** Asset bin, preview, timeline, and export center. **Composition:** Docking, Media Viewer, Timeline, Render Queue. **Definition of done:** Verify relink and cancellation.


**4. 3D Editor Shell.** Scene viewport, object hierarchy, inspector. **Composition:** Scene View, Hierarchy, Property Inspector, Toolbar. **Definition of done:** Verify object selection/transform synchronization.


**5. Data Workbench.** Data sources, table preview, filters, chart area. **Composition:** Database, Table, Chart, Filters, Export. **Definition of done:** Verify datasets and column types.


**6. Image Editor Shell.** Canvas, layers, tools, history, export. **Composition:** Raster Canvas, Layer Stack, Toolbar, History, Export. **Definition of done:** Draw a stroke, undo, reopen, and export actual pixels.


**7. Code IDE Shell.** Project explorer, editor, terminal, diagnostics. **Composition:** File Tree, Code Editor, Terminal, LSP Adapter. **Definition of done:** Open and type-check real source.


**8. Dashboard Shell.** Resizable widgets and global filters. **Composition:** Dashboard Grid, Filters, Chart Blocks, Store. **Definition of done:** Verify filtered charts respond to data changes.


**9. Plugin Manager UI.** Browse, enable, disable, and audit installed plugins. **Composition:** Registry, Permissions, List, Detail Dialog. **Definition of done:** Disabled plugin must not execute.


**10. Asset Browser.** Search, tag, preview, and organize local assets. **Composition:** Directory Enumeration, Thumbnails, Tags, Search. **Definition of done:** Respect directory grants and symlinks.


**11. Template Browser.** Preview and instantiate starter projects. **Composition:** Recipe Registry, Gallery, Project Creator. **Definition of done:** Generated projects must open cleanly.


**12. Theme Studio.** Create, preview, export, and import design token sets. **Composition:** Token Editor, Color Picker, Preview, JSON. **Definition of done:** Preserve exact tokens across export/import.


**13. Test Center.** Browse test suites, run checks, inspect failures. **Composition:** Test Runner, Progress, Diagnostic Viewer. **Definition of done:** All results map to actually executed tests.


**14. Build Center.** Select target, compile, package, and review artifacts. **Composition:** Target Selector, Build Process, Export Integrity. **Definition of done:** No success without real artifact.


**15. Activity Center.** Show truthful agent and build actions with links. **Composition:** Event Stream, Timeline, Filters, Artifact Viewer. **Definition of done:** Every event has a real operation ID.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 03. UI and interaction recipes — 15 recipes


**1. Wizard Form.** Multi-stage input with validation and draft recovery. **Composition:** Form Wizard, Validation, Draft Store, Navigation. **Definition of done:** No lost inputs on back/forward.


**2. Searchable Master Detail.** List records, filter, edit selected details. **Composition:** Search, List, Detail Editor, Repository. **Definition of done:** Handle deleted selected item gracefully.


**3. Sidebar Settings Layout.** Named navigation and bounded settings forms. **Composition:** Sidebar, Router, Form, Persistence. **Definition of done:** Screen selection remains stable.


**4. Command Palette Actions.** Search and execute registered UI commands. **Composition:** Command Palette, Registry, Shortcut Recorder. **Definition of done:** Filter commands by permission/state.


**5. Tabbed Inspector.** Present multiple property groups for a selection. **Composition:** Tabbed Workspace, Property Editor, Selection State. **Definition of done:** Refresh on selection changes without data loss.


**6. Split File Preview.** File list on left, preview on right. **Composition:** File Tree, Split Pane, Preview, Metadata. **Definition of done:** Large files do not freeze layout.


**7. Bulk Selection Toolbar.** Show actions for several selected records. **Composition:** Selection State, Toolbar, Batch Actions. **Definition of done:** Reflect partial failures and permission requirements.


**8. List Drag Reorder.** Reorder named records with keyboard fallback. **Composition:** List, Drag Controls, Sequence Store. **Definition of done:** Stable ordering and undo.


**9. Modal Confirmation.** Scoped prompt for deletion or overwrite. **Composition:** Confirmation Dialog, Action Guard, Undo/Trash. **Definition of done:** No destructive write before approval.


**10. Context Sensitive Menu.** Match available actions to current selection. **Composition:** Context Menu, State Guards, Permission Inspector. **Definition of done:** Unauthorized actions not executable.


**11. Interactive Empty State.** Offer next valid action when no content exists. **Composition:** Empty State, Command Link, Project State. **Definition of done:** Guidance must reflect actual state.


**12. Theme Switcher.** Light/dark/custom themes with persistence. **Composition:** Theme Tokens, Switch, Preferences. **Definition of done:** Respect user override and OS preference.


**13. Undoable Property Editor.** Apply edits as semantic reversible transactions. **Composition:** Property Grid, Command Store, Undo History. **Definition of done:** Undo restores all affected properties.


**14. Shortcut Customizer.** Let users edit and resolve keyboard shortcuts. **Composition:** Shortcut Recorder, Conflict Checker, Preferences. **Definition of done:** Do not hijack OS shortcuts.


**15. Resizable Dock Panel.** Save named panel layouts, focus, and visibility. **Composition:** Docking Workspace, Layout Store, Key Commands. **Definition of done:** Recover offscreen or invalid layout.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 04. File and content workflows — 15 recipes


**1. Open Save Document.** Read, edit, and atomically save a single file. **Composition:** Open Dialog, Read File, Editor, Save Dialog. **Definition of done:** Existing file is never truncated on failure.


**2. Autosave and Recovery.** Periodic snapshots plus explicit save and restore. **Composition:** Document State, Checkpoint, Atomic File Write. **Definition of done:** Simulated crash retains latest good state.


**3. Import Export JSON.** Schema-aware import/export with version field. **Composition:** JSON Parser, Validator, Repository, File Picker. **Definition of done:** Malformed input leaves project intact.


**4. CSV Wizard.** Map external columns to typed schema before import. **Composition:** CSV Import, Column Map, Validator, Preview. **Definition of done:** Invalid rows reported accurately.


**5. Batch Rename.** Rename files by reviewed pattern with collision preview. **Composition:** Directory Reader, Pattern Builder, Move File. **Definition of done:** No collision or accidental overwrite.


**6. Image Resize Batch.** Resize imported images to chosen bounds and format. **Composition:** File Picker, Decode, Resize, Encode, Batch Queue. **Definition of done:** Preserve original files by default.


**7. Watermark Batch.** Apply selected text/image overlay to copies. **Composition:** Image Decode, Overlay, Encode, Save. **Definition of done:** Verify output dimensions and transparency.


**8. Archive Builder.** Compress approved files and verify archive. **Composition:** File Selection, ZIP Builder, Hash Check. **Definition of done:** Reopen archive and inspect paths.


**9. Archive Extractor.** Extract safely with path traversal protection. **Composition:** ZIP Extractor, Destination Dialog, Progress. **Definition of done:** Reject malicious archive paths.


**10. Duplicate File Finder.** Hash files and group duplicate content. **Composition:** Directory Read, Hash, Group By, Review UI. **Definition of done:** Never delete automatically.


**11. Folder Synchronizer.** Compare two approved trees and propose changes. **Composition:** File Metadata, Hash, Diff, Review, Copy. **Definition of done:** Clearly show direction and conflicts.


**12. Media Relinker.** Resolve missing project media after moving folders. **Composition:** Asset References, Hash Match, File Picker. **Definition of done:** Avoid wrong-source substitution.


**13. Data Backup Utility.** Copy versioned project data and verify restore. **Composition:** Snapshot, Archive, Integrity Check. **Definition of done:** Restore test on sample snapshot.


**14. Image Contact Sheet.** Generate a grid preview from selected files. **Composition:** Thumbnailer, Grid Renderer, Export. **Definition of done:** Manage huge collections incrementally.


**15. Manifest Generator.** Produce checksums and metadata for packaged assets. **Composition:** File Hash, JSON Export, Build Metadata. **Definition of done:** Recalculate values from real files.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 05. Image and creative workflows — 14 recipes


**1. Raster Painting Starter.** Basic brush, erase, layers, and image export. **Composition:** Raster Canvas, Brush, Eraser, Layers, Undo. **Definition of done:** Pixel changes must actually persist.


**2. Image Crop Tool.** Load, crop via handles, and save copy. **Composition:** Decode, Crop UI, Encoder, Save. **Definition of done:** Keep crop bounds valid.


**3. Palette Explorer.** Extract and edit colors from an image. **Composition:** Image Decode, Palette Extract, Color Picker. **Definition of done:** Palette extraction is approximate.


**4. Sprite Sheet Slicer.** Preview cell grid and export selected tiles. **Composition:** Image Decode, Slicer, Grid, Batch Export. **Definition of done:** Transparent edges and partial cells.


**5. Tile Texture Preview.** Show repeated material and seam warnings. **Composition:** Image Preview, Tiling, Color Adjustments. **Definition of done:** No promise to auto-remove every seam.


**6. Image Layer Composer.** Stack images with opacity and blends. **Composition:** Layer Store, Blend Modes, Transform. **Definition of done:** Verify alpha and order.


**7. Simple Vector Logo Editor.** Edit text and basic shapes, export SVG. **Composition:** Vector Canvas, Shapes, Text, SVG Export. **Definition of done:** Imported logos carry their own licenses.


**8. Image Comparison Viewer.** Compare original and modified images interactively. **Composition:** Two Previews, Slider, Histogram. **Definition of done:** Both views use consistent color handling.


**9. Gradient Maker.** Create editable gradient assets. **Composition:** Gradient Editor, Palette, Export. **Definition of done:** Export exact stops and alpha.


**10. Thumbnail Creator.** Arrange text, shapes, and media into layouts. **Composition:** Canvas, Image Assets, Text, Presets. **Definition of done:** Output resolution and font availability.


**11. Photo Metadata Viewer.** Inspect and optionally strip embedded metadata. **Composition:** Metadata Reader, Inspector, Export. **Definition of done:** Avoid accidental private metadata leaks.


**12. Animation Frame Composer.** Assemble ordered still frames into animation. **Composition:** Frame List, Timing, Image Encoder. **Definition of done:** Verify frame timing on playback.


**13. Brush Preset Maker.** Design and test reusable brush settings. **Composition:** Brush Engine, Preset Store, Canvas Preview. **Definition of done:** Verify pressure/stroke behavior.


**14. Background Removal Lab.** Compare candidate masks and correct errors manually. **Composition:** Segmentation Adapter, Mask Editor, Image Preview. **Definition of done:** Never imply guaranteed perfect masks.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 06. Audio and video workflows — 14 recipes


**1. Soundboard.** Play tagged sounds from an organized panel. **Composition:** Asset Browser, Audio Player, Buttons, Volume. **Definition of done:** Stop overlapping audio appropriately.


**2. Voice Recorder.** Capture, save, and review microphone recordings. **Composition:** Mic Input, Recorder, Waveform, File Save. **Definition of done:** Respect consent and device removal.


**3. Audio Trimmer.** Load audio, select range, and export clip. **Composition:** Decoder, Waveform, Trim, Encoder. **Definition of done:** Sample-boundary correctness.


**4. Audio Normalizer.** Adjust file loudness to selected target. **Composition:** Decoder, Loudness Processor, Encode. **Definition of done:** Confirm resulting levels.


**5. Audio Mixer Starter.** Combine several audio tracks. **Composition:** Track Manager, Mixer, Playback, Export. **Definition of done:** Avoid clipping and timing drift.


**6. Podcast Chapter Editor.** Mark segments and export timestamps. **Composition:** Waveform, Markers, Metadata, Export. **Definition of done:** Chapter timestamps match audio.


**7. Video Trim Utility.** Select frames and export shorter video. **Composition:** Video Decoder, Timeline, Trim, Encoder. **Definition of done:** Output timing and sync test.


**8. Video Subtitle Editor.** Import captions, retime, and export. **Composition:** Subtitle Parser, Timeline, Cue Editor, Export. **Definition of done:** Validate timing, overlap, and encoding.


**9. Video Thumbnail Browser.** Generate previews at representative times. **Composition:** Decoder, Thumbnailer, Grid. **Definition of done:** Avoid full decoding when unnecessary.


**10. Basic Video Editor Shell.** Import, organize, trim, and export one timeline. **Composition:** Asset Bin, Timeline, Codec Adapter, Render Queue. **Definition of done:** Do not claim complete NLE features.


**11. GIF Maker.** Convert still frames or short clip to GIF. **Composition:** Frame Extract, Palette Quantizer, Encoder. **Definition of done:** Image/color quality trade-offs.


**12. Media Converter.** Convert supported formats using real codec backend. **Composition:** File Picker, FFmpeg Adapter, Presets, Progress. **Definition of done:** Verify installed codec support.


**13. Video Contact Sheet.** Export tiled thumbnails with timestamps. **Composition:** Video Decoder, Frames, Grid, Image Export. **Definition of done:** Ensure time stamps reflect actual frames.


**14. Recording Catalog.** Organize local recordings and metadata. **Composition:** File Browser, Database, Search, Player. **Definition of done:** Honor privacy and retention settings.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 07. Data and business tools — 14 recipes


**1. Spreadsheet Import Inspector.** Preview workbook sheets and cell types. **Composition:** Import Adapter, Table, Type Detector. **Definition of done:** Report unsupported formulas honestly.


**2. CSV Data Cleaner.** Trim, cast, deduplicate, and export tabular rows. **Composition:** CSV, Transform, Validator, Export. **Definition of done:** Log rejected rows and transformations.


**3. Dashboard Builder.** Bind source tables to charts and filters. **Composition:** Data Connector, Charts, Filter Bar, Layout. **Definition of done:** Show last refresh and missing data.


**4. Local Sales Tracker.** Record sales and grouped totals. **Composition:** Form, Database, Table, Metrics. **Definition of done:** No automatic tax/legal conclusions.


**5. Inventory Reorder Alert.** Flag stock below user-defined threshold. **Composition:** Database, Conditional Trigger, Notification. **Definition of done:** Avoid duplicate alerts.


**6. Invoice Draft Tool.** Assemble local invoice document from form fields. **Composition:** Form, Template, PDF Export. **Definition of done:** Human validates jurisdiction-specific requirements.


**7. Project Time Tracker.** Record time spent per project/task. **Composition:** Timer, Session Store, Report. **Definition of done:** Handle sleep/resume.


**8. Asset Tagging System.** Classify local files with structured labels. **Composition:** Asset Browser, Tags, Search. **Definition of done:** Keep original assets intact.


**9. KPI Monitor.** Display user-supplied data with defined metrics. **Composition:** Query, Metric Cards, Charts, Refresh. **Definition of done:** Define each metric unambiguously.


**10. Calendar Schedule Viewer.** Show planned events from local data. **Composition:** Event Schema, Calendar, Filters. **Definition of done:** Correct time zone conversion.


**11. Data Export Wizard.** Choose formats and fields for structured output. **Composition:** Schema, Format Select, Export. **Definition of done:** Respect user-chosen private columns.


**12. Form-to-Database App.** Build CRUD form from entity schema. **Composition:** Form Generator, Repository, Table. **Definition of done:** Validate writes and migrations.


**13. Report Generator.** Create documented charts/tables with export. **Composition:** Data Sources, Charts, Document Output. **Definition of done:** Include source and freshness metadata.


**14. Query Console.** Run approved parameterized read queries. **Composition:** SQL Adapter, Editor, Data Table. **Definition of done:** Restrict writes unless authorized.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 08. Developer productivity — 14 recipes


**1. Project Scaffolder.** Create pinned Tauri/React or Web project structure. **Composition:** Target Recipe, Dependency Resolver, File Writer. **Definition of done:** Verify actual installed package APIs.


**2. Project Inspector.** Detect framework, languages, and tooling. **Composition:** Filesystem Read, Manifest Parsers, Report. **Definition of done:** Base output on inspected files.


**3. Dependency Review.** Inspect outdated/conflicting packages and propose changes. **Composition:** Lockfile Reader, Audit, Diff Review. **Definition of done:** No automatic blind upgrade.


**4. Build Fail Navigator.** Link compiler errors to generated nodes/source. **Composition:** Build Logs, Source Maps, Diagnostic Navigator. **Definition of done:** Preserve exact compiler output.


**5. Git Change Review.** Summarize graph and source modifications. **Composition:** Git Diff, Semantic Diff, Reviewer. **Definition of done:** Never auto-push.


**6. Template Extractor.** Save successful project feature as reusable recipe. **Composition:** Selection, Contract Builder, Registry. **Definition of done:** Strip private data.


**7. Native Function Bridge.** Add typed Rust native command to app graph. **Composition:** API Schema, Rust Module, Tauri Adapter. **Definition of done:** Validate permissions and serialization.


**8. API Wrapper Maker.** Build typed client around configured API contract. **Composition:** Schema Import, Client Generator, Test. **Definition of done:** No hidden hardcoded credentials.


**9. Custom Block Starter.** Create source skeleton and test harness. **Composition:** Block Forge, Schema, Test Fixture. **Definition of done:** Default to prototype status.


**10. Refactor Plan.** Identify source modules that need separation. **Composition:** Code Analysis, Dependency Graph, Proposal. **Definition of done:** Preserve behavior through tests.


**11. Source Search Assistant.** Locate relevant implementations across project. **Composition:** File Search, Symbols, Source Retriever. **Definition of done:** Favor actual code over stale notes.


**12. Project Health Report.** Run specified checks and summarize results. **Composition:** Type Check, Tests, Dependency Audit, Reports. **Definition of done:** Mark skipped checks honestly.


**13. Runtime Profiler Shell.** Profile selected app scenario and show traces. **Composition:** Process Launch, Profiler, Report. **Definition of done:** Measurement overhead disclosed.


**14. Multi-Target Audit.** Identify incompatible blocks before target switch. **Composition:** Graph Validator, Target Matrix, Proposal. **Definition of done:** No promise of universal portability.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 09. Educational and accessibility-oriented — 14 recipes


**1. Beginner Block Lesson.** Teach ports, events, and values using real demo. **Composition:** Tutorial, Graph, Preview, Validator. **Definition of done:** Learner controls execution.


**2. Build Your First App.** Guided settings app lesson with code reveal. **Composition:** Template, UI Editor, Flows, Export. **Definition of done:** A real executable is the goal.


**3. Debug a Broken Button.** Present disconnected event and guided repair. **Composition:** Graph Fixture, Diagnostic, Test. **Definition of done:** Explain failure without giving fake pass.


**4. Learn Data Binding.** Show form input affecting UI and persistence. **Composition:** Input, State, Label, Preferences. **Definition of done:** Display intermediate state.


**5. Learn API Calls.** Call safe local mock API and handle errors. **Composition:** HTTP Adapter, Mock, Error Handling. **Definition of done:** No secrets required.


**6. Learn Filesystems.** Demonstrate approved open/save actions. **Composition:** Picker, Reader, Writer, Permission Dialog. **Definition of done:** No arbitrary writes.


**7. Keyboard Graph Editing.** Tutorial on non-dragging methods. **Composition:** Accessible Outline, Command Palette. **Definition of done:** Complete lesson without mouse.


**8. Contrast Repair Guide.** Find weak color contrast and adjust tokens. **Composition:** Contrast Checker, Token Editor. **Definition of done:** Verify text/background combinations.


**9. Responsive Layout Exercise.** Adapt same screen across sizes. **Composition:** Layout Constraints, Preview Sizes. **Definition of done:** No clipped controls.


**10. Reusable Recipe Exercise.** Extract and parameterize repeated graph. **Composition:** Recipe Builder, Port Editor, Tests. **Definition of done:** Verify equivalence of expanded graph.


**11. Test Writing Tutorial.** Turn expected outcomes into executable checks. **Composition:** Test Builder, Assertions, Fixtures. **Definition of done:** Tests must fail on deliberate breakage.


**12. Source Code Bridge.** Trace one block through emitted React code. **Composition:** Source Maps, Code View, Graph. **Definition of done:** Teach actual runtime relationships.


**13. Internationalization Workshop.** Create translation keys and locale toggles. **Composition:** Catalog, Locale Provider, Preview. **Definition of done:** Verify pluralization.


**14. Undo and Recovery Exercise.** Simulate failed edit and recover checkpoint. **Composition:** History, Restore, Crash Simulation. **Definition of done:** No real project corruption.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 10. System and automation utilities — 13 recipes


**1. Batch File Processor.** Run repeated approved transforms over file set. **Composition:** File Picker, Batch Queue, Processor, Report. **Definition of done:** Explicit failure and cancellation handling.


**2. Automatic Backup.** Run consented periodic archive of a directory. **Composition:** Scheduler, Folder Grant, Archive, Verify. **Definition of done:** Retention and overwrite rules.


**3. Clipboard Formatter.** Transform clipboard text after explicit action. **Composition:** Clipboard, String Operations, Write. **Definition of done:** No passive clipboard surveillance.


**4. Window Layout Rememberer.** Persist app window geometry. **Composition:** Window Events, Preferences, Recovery. **Definition of done:** Recover after monitor unplug.


**5. Local Notification Scheduler.** Show reminders from local task data. **Composition:** Time Trigger, Task Store, Notification. **Definition of done:** Handle missed reminders on sleep.


**6. File Watch Dashboard.** Track selected folder changes and history. **Composition:** Directory Watcher, Event Table, Storage. **Definition of done:** Avoid excessive background scans.


**7. Portable Project Export.** Package complete project with lockfiles/assets. **Composition:** Bundle Export, Integrity, Manifest. **Definition of done:** Secrets excluded.


**8. App Self Check.** Provide optional diagnostics panel in generated app. **Composition:** Health Checks, Logs, Report. **Definition of done:** Disable automatic upload by default.


**9. Local Search Utility.** Index approved project directories and query text. **Composition:** Full Text Search, Indexer, UI. **Definition of done:** Respect file scopes and staleness.


**10. Theme Switch Automation.** Apply user-defined schedule for app theme. **Composition:** Scheduler, Theme Provider. **Definition of done:** Manual override wins.


**11. Safe Command Launcher.** Run user-approved named commands with parameters. **Composition:** Command Registry, Guard, Process. **Definition of done:** Never construct arbitrary shell command from untrusted text.


**12. Update Checker.** Optionally check approved release endpoint. **Composition:** HTTP, Version Compare, Consent. **Definition of done:** Offline mode does no requests.


**13. Task Progress Dashboard.** Present long-running job state from real events. **Composition:** Task Queue, Activity Timeline, Notifications. **Definition of done:** Cancel and error actions are real.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 11. Specialized creator tools — 14 recipes


**1. Huelith UI Foundation.** Assemble canvas, layers, tools, assets, and inspectors. **Composition:** Editor Shell, Canvas, Layer Store, Rust Adapter. **Definition of done:** Verified brush and export functions required.


**2. Typecase Document Shell.** Assemble document tabs, toolbar, autosave, exports. **Composition:** Editor Shell, Rich Text Engine, Export. **Definition of done:** Formatting and PDF fidelity separately tested.


**3. Typecase Sheets Shell.** Build spreadsheet workbook UI around real formula engine. **Composition:** Grid, Formula Adapter, File I/O. **Definition of done:** No unsupported spreadsheet parity claims.


**4. Typecase Slides Shell.** Build slide editor and presentation view. **Composition:** Slide Navigator, Vector Layers, Export. **Definition of done:** Page and font compatibility tested.


**5. CubeTable Asset Manager.** Browse, inspect, and export 3D assets. **Composition:** Asset Browser, Scene Viewer, Metadata, Export. **Definition of done:** Imported rigs/materials may be partial.


**6. CubeMorrow Biome Inspector.** Edit engine-specific biome definitions. **Composition:** Schema, Forms, Preview Adapter, Export. **Definition of done:** Must validate against engine format.


**7. CubeMorrow HUD Editor.** Position responsive game HUD components. **Composition:** Layout Canvas, Widget Blocks, Target Export. **Definition of done:** In-game runtime integration required.


**8. Stella UI Theme Editor.** Create and preview compatible printer dashboard themes. **Composition:** Token Editor, Preview, Export. **Definition of done:** Firmware integration remains device-specific.


**9. Stella Printer Simulator.** Exercise printer UI against simulated state. **Composition:** State Machine, Device Mock, UI. **Definition of done:** Not proof of real hardware safety.


**10. Prism Geometry Workbench.** Wrap selected experimental mesh tools. **Composition:** Mesh Import, Inspector, Native Adapter, Preview. **Definition of done:** Advanced reconstruction not assumed solved.


**11. Custom Operating System Panel.** Prototype interface for future OS settings tools. **Composition:** Window Shell, Forms, Mock Native APIs. **Definition of done:** UI prototype is not an operating system.


**12. Blocky3D Experiment Board.** Compare image-to-mesh algorithms with fixtures. **Composition:** Image Loader, Mesh Adapter, 3D Preview, Scoring. **Definition of done:** Evaluate front/side/back fidelity honestly.


**13. 3D Print File Organizer.** Categorize and preview supported printable model files. **Composition:** File Browser, Mesh Preview, Tags. **Definition of done:** Not a slicer or safety verifier.


**14. Shorts Asset Maker.** Prepare thumbnail/title overlays and render presets. **Composition:** Vector/Image Canvas, Templates, Export. **Definition of done:** Respect third-party IP and content rights.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


### 12. Advanced and experimental recipes — 14 recipes


**1. Visual Plugin Builder.** Package a Spica recipe as an app plugin. **Composition:** Contract, Compiler Adapter, Package Builder. **Definition of done:** Host version compatibility required.


**2. Graph Migration Assistant.** Propose upgrading old graph structure. **Composition:** Snapshot, Migrator, Diff, Tests. **Definition of done:** Always backup and allow cancel.


**3. Cross Target Converter.** Suggest target-compatible replacements for nodes. **Composition:** Target Validator, Recipe Search, Change Proposal. **Definition of done:** Conversion can be incomplete.


**4. Self Expanding Library.** Draft, implement, test, and register custom block. **Composition:** Block Forge, Code Adapter, Contract Tests. **Definition of done:** Never promote unverified code automatically.


**5. AI UI Draft from Sketch.** Propose interface graph from rough reference. **Composition:** Vision Adapter, Layout Builder, Review. **Definition of done:** Approximate interpretation, human approval.


**6. App Test Explorer.** Derive candidate user paths and run selected tests. **Composition:** Graph Analyzer, Test Generator, E2E Runner. **Definition of done:** Generated tests don't self-certify.


**7. Project Knowledge Graph.** Link requirements, Sources, blocks, and decisions. **Composition:** Source Retriever, Provenance, Graph View. **Definition of done:** Never let saved source override current state silently.


**8. AI Performance Review.** Suggest optimizations from measured traces. **Composition:** Profiler, Agent Proposal, Benchmark. **Definition of done:** Re-test after change.


**9. Offline Developer Kit.** Export docs, toolchain prerequisites, block bundles. **Composition:** Bundle, Registry, Docs, Integrity. **Definition of done:** Large platform toolchains may be external.


**10. App Marketplace Export.** Generate metadata and assets for user distribution. **Composition:** Packaging, Licensing Report, Assets. **Definition of done:** Not an automatic upload/store approval.


**11. Multi Spark Design Review.** Collect independent proposals for graph improvement. **Composition:** Review Agents, Diff Viewer, Human Vote. **Definition of done:** Consensus is not verification.


**12. Replayable Bug Report.** Package redacted event trace and sample fixture. **Composition:** Runtime Recorder, Privacy Filter, Export. **Definition of done:** Avoid private data leaks.


**13. Automated Accessibility Fix Proposals.** Draft changes addressing measured issues. **Composition:** Audit, Tokens, Change Proposal. **Definition of done:** Human should inspect visual side effects.


**14. Custom Language Integration.** Register parser/compiler adapter for future DSL. **Composition:** Extension API, Compiler Adapter, Test Suite. **Definition of done:** A language needs its own real toolchain.


Recipes in this family should also include an empty-data state, a cancellation or recovery path where applicable, and a real export or completion artifact.


**Recipe atlas total: 172 proposals across 12 families.**

# Part VIII — Feature backlog and exploratory idea bank

<a id="spica-chapter-33"></a>
## 33. Additional ideas beyond the block atlas

This section deliberately explores **studio-level features** that do not fit neatly into one block. These are ideas worth prototyping, not commitments. A label of **Core**, **Expansion**, or **Experimental** indicates suggested sequencing rather than intrinsic value.

### 33.1 The construction experience itself

1. **[Core] Blank-canvas alternative:** Start with `Describe an app`, `Choose a recipe`, `Import an existing project`, or `Start empty`. Never trap a beginner in an intimidating graph.
2. **[Core] Construction checklist:** Each project displays remaining requirements as concrete acceptance criteria, not vague percentages of completion.
3. **[Core] Feature shelf:** A shelf shows reusable features such as `Searchable list`, `Autosave`, or `Settings`, ready to place into a screen.
4. **[Core] Ready-to-wire suggestions:** Dragging from a compatible port displays valid targets and conversion options; users do not need to remember types.
5. **[Core] Project blueprint:** A navigable bird's-eye view shows screens, data models, critical flows, build targets, and permissions.
6. **[Core] Real progress breadcrumbs:** When Spica compiles, it highlights the exact stage executed and links to verified artifacts.
7. **[Core] Build from requirements:** Users can check off features after real evidence, independent of whether the request came from the Spark.
8. **[Expansion] Feature dependency navigator:** Clicking `Export` reveals the buttons, flows, codecs, permissions, and tests on which it depends.
9. **[Expansion] Multi-scale design:** Zoomed out, see screens and recipe clusters; zoomed in, see individual ports and data values.
10. **[Expansion] App skeleton analyzer:** From a rough request, propose the smallest useful set of screens and data entities before adding advanced features.
11. **[Expansion] Construction budget:** Show estimated codegen, build, and runtime resource costs before generating a heavy feature.
12. **[Expansion] Replace capability:** Swap a local database with another supported adapter through a guided migration plan, not manual rewiring.
13. **[Expansion] One-click recipe inspection:** Open a high-level recipe and trace its nested graph without destroying project context.
14. **[Expansion] Selection-driven search:** Selecting three blocks changes the library's recommendations to compatible neighbors.
15. **[Expansion] Design variants:** Save and compare layout proposals as branches rather than continually overwriting the same screen.
16. **[Experimental] Natural-language graph navigation:** Ask `Show what happens when I click Save` and reveal the actual event chain.
17. **[Experimental] Intent annotations:** Attach short natural-language goals to graph regions, then compare future changes against these commitments.
18. **[Experimental] Alternative construction search:** Generate two or three bounded valid graph proposals using different recipes and compare outcomes.
19. **[Experimental] Construction replay:** Review a change timeline as a sequence of graph transactions, tests, and outputs.
20. **[Experimental] Architecture fitness hints:** Suggest splitting a huge graph based on measurable coupling or validation costs.

### 33.2 A humane Spark collaboration model

21. **[Core] Spark as operator, not magic:** The Spark's power comes from real APIs and permissions; it cannot claim unsupported functionality exists.
22. **[Core] Separate speaking from building:** A Spark may converse casually, but `spica.apply_changes` must use precise machine-readable inputs.
23. **[Core] Preview proposed work:** Users see which blocks and connections would change before risky edits are applied.
24. **[Core] Explain a block choice:** A Spark can state why a particular recipe satisfies the requested behavior and what it lacks.
25. **[Core] Continue from checkpoint:** If a model crashes or unloads, the task can resume from durable project state without repeating already completed operations.
26. **[Core] Check reality before asking:** If the folder was inspected and is empty, the Spark should initialize it rather than ask whether it is empty.
27. **[Core] Human edit respect:** If the user changes a block while a Spark is planning, require a revision match before applying stale suggestions.
28. **[Expansion] Low-confidence review queue:** Proposals involving unknown packages or uncertain requirements are routed to explicit user review.
29. **[Expansion] Spark focus modes:** Separate `Architect`, `UI Builder`, `Logic Builder`, `Tester`, and `Code Polisher` roles as task prompts, not separate mandatory models.
30. **[Expansion] Controlled multi-step tasks:** A Spark can finish `Make a usable notes app` as a list of verified transactions without losing the initial objective.
31. **[Expansion] Reference-aware construction:** Before replacing a UI, the Spark can inspect saved project design sources and current theme tokens.
32. **[Expansion] Explain the compiler:** A Spark can turn a precise diagnostic into a beginner-friendly explanation while leaving exact errors visible.
33. **[Expansion] Ask only once:** Relevant user decisions can be stored in the current task record and applied consistently rather than re-requested.
34. **[Expansion] Human-first task interrupt:** Clicking on any builder action can pause new changes and open the graph for direct editing.
35. **[Expansion] Repair scopes:** `Fix only this broken flow` limits the Spark to a declared subgraph and associated tests.
36. **[Experimental] Pair-building gestures:** The Spark visually highlights suggested insertions one at a time as the user approves them.
37. **[Experimental] Explanation levels:** The same operation can be explained as beginner, intermediate, or code-level detail.
38. **[Experimental] Specialist critique without authority transfer:** A second Spark reviews a change, but only real checks can declare it passing.
39. **[Experimental] Agent simulation before apply:** Evaluate graph logic against fixtures, with all output clearly labeled as simulated.
40. **[Experimental] Repeated-work mining:** Suggest recipes when a user performs a successful repeated sequence several times.

### 33.3 Block ergonomics and type intelligence

41. **[Core] Search by purpose:** `Save my art` should find appropriate save/export recipes without exact API names.
42. **[Core] Type-first connectors:** Port menus show values and compatible conversions.
43. **[Core] Default error paths:** Effect blocks provide visible failure outcomes even when the user hasn't connected an error view.
44. **[Core] Block documentation cards:** Show purpose, target support, permission needs, examples, limitations, and version.
45. **[Core] Hide unstable blocks by default:** Draft blocks are opt-in for exploratory projects.
46. **[Core] Stable block IDs:** Renaming a label does not break saved projects.
47. **[Expansion] Block preview sandbox:** Run a sample UI block with fixture data before inserting it into an app.
48. **[Expansion] Compatibility explanation:** When two ports cannot connect, offer specific legal adapters rather than a generic red wire.
49. **[Expansion] Connection labels:** Show the meaning of a flow in plain English, such as `on save success → show confirmation`.
50. **[Expansion] Block facets:** Filter by runtime cost, code size, offline capability, permissions, and target support.
51. **[Expansion] Block health dashboard:** Display contract tests, known bugs, versions, and deprecations.
52. **[Expansion] Object handle lifetime inspector:** Show where file, database, and GPU resources are acquired and released.
53. **[Expansion] Graph static analysis:** Flag unused nodes, unreachable screens, redundant transformations, and unhandled errors.
54. **[Expansion] Recipe adapters:** Connect similar but not identical recipe interfaces through explicit mapping blocks.
55. **[Expansion] Auto-document selected flow:** Produce diagram text and port descriptions from graph metadata.
56. **[Experimental] Visual type inference:** Infer limited property schemas from sample data, with human review before persistence.
57. **[Experimental] Semantic block ranking:** Use optional local semantic search to find capabilities by behavior, never bypassing type validation.
58. **[Experimental] Block quality scorecard:** Track verified reliability, resource usage, and portability instead of popularity alone.
59. **[Experimental] Graph equivalence checker:** Compare two limited pure-dataflow subgraphs for equivalent behavior.
60. **[Experimental] Build-cost estimator:** Predict likely compile or runtime cost from known block metadata and prior local measurements.

### 33.4 Live preview and error comprehension

61. **[Core] Preview truth badge:** Clearly mark `Static mock`, `Interactive simulated`, or `Real app runtime`.
62. **[Core] Active failure overlay:** Clicking an error in preview reveals the responsible block or target adapter.
63. **[Core] Preview reset:** Reinitialize preview data without erasing the actual project.
64. **[Core] Defined sample fixtures:** UI components can be previewed with good, empty, invalid, and loading data.
65. **[Core] Actual build log access:** Every final build retains exact tool output and exit status.
66. **[Expansion] Event travel visualization:** Highlight a route through event and action blocks as a user interacts with preview.
67. **[Expansion] Port value peeking:** Inspect recent typed values at a connection without editing graph code.
68. **[Expansion] Replay last failure:** Re-run a captured test fixture while preserving a checkpoint.
69. **[Expansion] Diagnostic grouping:** Collapse duplicate compiler errors caused by one missing type or dependency while preserving raw logs.
70. **[Expansion] Recovery suggestions:** Offer targeted actions: restore snapshot, install missing toolchain, fix connection, or inspect implementation.
71. **[Expansion] Offline build test:** Explicitly run a build with network unavailable to detect hidden assumptions.
72. **[Expansion] Device-size preview matrix:** Inspect window sizes, screen densities, and typography scaling.
73. **[Expansion] Actual file output inspection:** Open created files and verify contents where possible rather than just displaying a save toast.
74. **[Expansion] Build comparison:** Show modified artifacts, warnings, and runtime resource changes between revisions.
75. **[Expansion] Permissions timeline:** Trace which operation requested a grant and how the decision affected execution.
76. **[Experimental] Hot path overlay:** Shade graph nodes according to measured execution time, not aesthetic guesses.
77. **[Experimental] Time-travel pure-flow debugger:** Step backward through deterministic replay for operations without unrecorded external effects.
78. **[Experimental] Automatic minimal reproducer:** Extract the smallest graph fixture that still triggers a confirmed failure.
79. **[Experimental] Visual regression locator:** Link changed pixels in screenshots back to likely theme or UI nodes.
80. **[Experimental] Multi-target behavior comparison:** Run the same scenario on Web and Desktop targets and report actual differences.

### 33.5 Source code openness and portability

81. **[Core] Generated source map:** Every generated source file links back to its source graph and recipe.
82. **[Core] No mandatory studio runtime:** Exported apps must stand independently within their documented dependencies.
83. **[Core] Source ownership rules:** Show clearly whether a file is generated, custom, or vendor-owned.
84. **[Core] Inspect generated code:** Expose output without requiring the user to learn the entire graph system.
85. **[Core] Native code extension points:** Let professional developers implement specialized algorithms in separate modules.
86. **[Expansion] Generated code style profiles:** Format output consistently with supported project conventions.
87. **[Expansion] Import existing components:** Wrap existing React components through an explicit schema rather than attempting magical conversion.
88. **[Expansion] Source mapping diff:** Compare regenerated source to the previous build and explain which graph change caused it.
89. **[Expansion] Project lockfile explorer:** Explain why each block package and dependency is present.
90. **[Expansion] External IDE handoff:** Open the generated/custom source workspace in another editor without losing ownership metadata.
91. **[Expansion] Target compatibility audit:** Check a project before adding a new platform, with specific block replacements.
92. **[Expansion] Build-from-clean command:** Recreate an app without relying on development cache.
93. **[Expansion] Reproducible artifact manifest:** Capture hashes, target, build logs, versions, and source revision.
94. **[Expansion] Source-only distribution:** Export a complete repository without a binary installer.
95. **[Expansion] Headless builder:** Support CLI generation and validation for automation or continuous integration.
96. **[Experimental] Source-assisted graph import:** Extract editable views for recognized code patterns and wrap the rest.
97. **[Experimental] Custom DSL target:** Allow a future Prism compiler to consume a narrow Spica-generated interface.
98. **[Experimental] Target-specific performance rewrite:** Suggest Rust replacements for measured bottlenecks, with user review.
99. **[Experimental] Build recipe exchange:** Share reproducible target pipelines without requiring a proprietary registry.
100. **[Experimental] Generated app introspection:** Optionally embed block-source IDs in debug builds so runtime bugs can map back to Spica.

### 33.6 Data durability and reliability

101. **[Core] Atomic project saves:** Protect the last valid project snapshot.
102. **[Core] Crash recovery:** On restart, offer to restore the latest recoverable revision without overwriting accepted changes.
103. **[Core] Graph migration backups:** Preserve a prior snapshot before changing format.
104. **[Core] Typed database migrations:** Require explicit transition logic for schema changes.
105. **[Core] First-class cancellation:** Cancel operations without abandoning the application in a locked state.
106. **[Expansion] Data contract browser:** Inspect entities and their relationship to UI forms and workflows.
107. **[Expansion] Stale data indicator:** Show when cached external data has not refreshed successfully.
108. **[Expansion] Save conflict resolution:** Detect when external files changed after opening.
109. **[Expansion] Undo grouping designer:** Let creators specify which user operations form one undo step.
110. **[Expansion] Fixture generator:** Create realistic but synthetic test records for preview, without copying private user data.
111. **[Expansion] Import staging:** Preview changes and invalid records before mutating the real database.
112. **[Expansion] Restore verification:** Test backups by reopening sample data in an isolated context.
113. **[Expansion] Durable task state:** Save job progress and pending operations through app restarts.
114. **[Expansion] Data retention controls:** Let users remove caches and historical snapshots deliberately.
115. **[Expansion] Schema documentation:** Generate descriptions of persistent app data for maintainers.
116. **[Experimental] Data lineage overlay:** Trace which imports, transformations, and events produced a displayed value.
117. **[Experimental] Graph-aware migration suggestions:** Propose safe schema migrations, but require real tests and user review.
118. **[Experimental] Conflict-free collaborative editing:** Explore CRDT/OT approaches for graph data with explicit constraints.
119. **[Experimental] Automatic migration fixture capture:** Record anonymized historical schema samples for regression testing.
120. **[Experimental] Validated disaster recovery rehearsal:** Simulate loss/rebuild and document exact recovery steps.

### 33.7 Creative and game tool ambitions

121. **[Core] Modular inspector builder:** Compose specialized property editors without coding every panel manually.
122. **[Expansion] Texture tools studio:** Slicing, resizing, tiling preview, palette editing, and export recipes.
123. **[Expansion] Animation timeline widgets:** Keyframe tracks, transform channels, selection, and inspector controls.
124. **[Expansion] Asset compatibility checks:** Before a file is imported into a project, validate type, size, and required metadata.
125. **[Expansion] Biome configuration workflows:** Expose engine-defined terrain parameters through type-checked forms.
126. **[Expansion] Creative pipeline board:** Chain source assets, processors, previews, and exports with caching.
127. **[Expansion] Thumbnail generation recipes:** Use real source assets and explicit layouts; preserve licenses.
128. **[Expansion] 3D model metadata inspector:** Display topology, material counts, sizes, and coordinates.
129. **[Expansion] Layered document template engine:** Build creative editors around an existing specialist document engine.
130. **[Expansion] Timeline clip interchange:** Define a narrow internal clip schema before attempting external project compatibility.
131. **[Expansion] Audio visualizer:** Render a waveform, spectrum, and device status using typed streams.
132. **[Expansion] Artboard gallery:** Work with multiple screen/page designs inside a project.
133. **[Expansion] Theme pack authoring:** Create branded token sets and reusable component variants.
134. **[Expansion] Smart export presets:** Save explicit output dimensions, codecs, and quality constraints.
135. **[Expansion] Headless asset converter:** Reuse processing graphs outside the visual app.
136. **[Experimental] Constraint-based procedural layout:** Generate editor panels from typed metadata and adapt to density.
137. **[Experimental] Graph-driven 3D tool recipes:** Compose proven mesh operations through a visual sequence.
138. **[Experimental] Visual algorithm comparison lab:** Measure multiple image-to-mesh attempts with consistent reference fixtures.
139. **[Experimental] Timeline auto-suggestion:** Recommend edits based on measurable patterns or user-approved rules; avoid pretending intent recognition is perfect.
140. **[Experimental] Safe hardware simulator:** Use virtual printer/sensor states to test tool interfaces separately from physical equipment.

### 33.8 Distribution, community, and creator economics

141. **[Core] Free local project creation:** No subscription required to use ordinary installed block libraries.
142. **[Core] Unrestricted commercial intent:** Users can build sellable software, subject to actual third-party licenses.
143. **[Core] Offline recipe sharing:** Distribute a package by file, not only through an account-bound marketplace.
144. **[Core] Readable licensing inventory:** Display external dependencies and asset obligations before release.
145. **[Expansion] Community block package format:** Signed/versioned manifests with source and tests.
146. **[Expansion] Creator credit field:** Preserve voluntary author attribution in shared recipes.
147. **[Expansion] Local template bookmarks:** Favorites, collections, and usage history without online tracking.
148. **[Expansion] Export demonstration package:** Bundle sample screenshots, tests, and setup notes for open-source release.
149. **[Expansion] Responsible contribution pipeline:** Proposed block → review → tests → documentation → optional official promotion.
150. **[Expansion] Block version changelog:** Explain behavior changes and migration requirements.
151. **[Expansion] Template quality badge:** Based on verified test coverage and compatibility, not paid placement.
152. **[Expansion] User-owned libraries:** Import/export custom block collections and recipes.
153. **[Expansion] Community reproducibility challenge:** Encourage contributors to publish clean-build proof for sample apps.
154. **[Expansion] Source repository export:** Create a conventional maintainable Git layout.
155. **[Expansion] Optional donation links:** Let maintainers accept support without blocking core features.
156. **[Experimental] Federated package discovery:** Search trusted independently hosted catalogs without central lock-in.
157. **[Experimental] Reusable workflow reputation:** Share reproducible test matrices, not opaque review scores.
158. **[Experimental] Contributor mentorship:** A successful stable block can become a tutorial and starter issue.
159. **[Experimental] Local cooperative libraries:** Share verified blocks among computers on a LAN under user control.
160. **[Experimental] Build provenance verification service:** Optional third-party reproducibility checks, never a mandatory gate to local export.

### 33.9 Long-horizon invention lab

161. **[Experimental] App capability map:** A visual overview of what the user can already build with installed blocks, grouped by functioning targets.
162. **[Experimental] Constraint solver for UI layout:** Find valid responsive arrangements subject to screen and accessibility requirements.
163. **[Experimental] Property-level AI assistance:** Let a small model modify only a few validated fields instead of entire files.
164. **[Experimental] Automatic fixture synthesis:** Generate edge-case sample input with rule-based or AI assistance for human verification.
165. **[Experimental] Visual state-space explorer:** Enumerate reachable UI states and identify missing error/empty/disabled representations.
166. **[Experimental] Graph dead-end checker:** Find event flows that start but never provide required output or completion.
167. **[Experimental] Capability dependency heatmap:** Show which privileged APIs each planned feature would activate.
168. **[Experimental] Energy-aware build planning:** Schedule compiles and previews according to device load and user policy.
169. **[Experimental] Codegen provenance explorer:** Explain why an emitted import or dependency appears in output.
170. **[Experimental] Template evolution:** Suggest changes to popular local templates based on actual verified fixes, without uploading private projects.
171. **[Experimental] Cross-language module interfaces:** Generate typed boundaries among TypeScript, Rust, Python, and future Prism modules.
172. **[Experimental] App testing through synthetic users:** Test bounded predefined interaction paths, clearly distinguishing simulation from real human feedback.
173. **[Experimental] Intelligent graph focus:** Temporarily hide unrelated modules while preserving full navigation and edge references.
174. **[Experimental] Data security walkthrough:** Show every path by which sensitive values might reach logs, exports, or the network.
175. **[Experimental] Self-documenting block bundles:** Generate docs and samples from verified contracts and tests.
176. **[Experimental] Visual compatibility bridge:** When changing a target, show side-by-side original and adapted flows.
177. **[Experimental] Learning recommendations:** Suggest the next useful concept based on the user's explicit task, not inferred personal traits.
178. **[Experimental] Architecture exploration mode:** Compare modular configurations with metrics rather than aesthetics alone.
179. **[Experimental] Task-to-recipe harvesting:** When a sequence succeeds repeatedly, suggest naming, parameterizing, and packaging it.
180. **[Experimental] Independent app lifecycle monitor:** Optionally help maintainers check startup errors and local test logs from generated apps.

### 33.10 Anti-features: things to resist

181. **Do not** create thousands of nonfunctional catalog entries simply to claim a large library.
182. **Do not** generate hidden network traffic while claiming offline operation.
183. **Do not** silently edit unrelated source files because a Spark thinks it is convenient.
184. **Do not** call a simulated preview a successful production build.
185. **Do not** make visual graph editing the only accessible interaction path.
186. **Do not** expose every available power tool to a small model in one oversized schema.
187. **Do not** assume native code is safely sandboxed just because it has a block wrapper.
188. **Do not** hide compiler errors behind generic motivational messaging.
189. **Do not** require users to subscribe to access their own generated source.
190. **Do not** promise fully automatic conversion of arbitrary codebases into editable graphs.
191. **Do not** let package updates silently break project lockfiles.
192. **Do not** publish a custom block before the user reviews licensing and private assets.
193. **Do not** turn the product into another giant chat route containing every engine.
194. **Do not** let a fabricated status card masquerade as model reasoning or tool execution.
195. **Do not** mistake visual similarity for implemented application behavior.
196. **Do not** force specialist media, 3D, or office algorithms to fit a simplistic generic block implementation.
197. **Do not** claim complete privacy while shipping undisclosed telemetry.
198. **Do not** treat an LLM's confident explanation as a substitute for reproducible tests.
199. **Do not** silently overwrite the user-owned custom code section during regeneration.
200. **Do not** let the scale of the vision prevent shipping one small, verified, genuinely useful app.

---

# Part IX — Quality assurance, contributor rules, and implementation discipline

<a id="spica-chapter-34"></a>
## 34. Test scenarios and quality gates

### 34.1 The release qualification matrix

A feature should not move from prototype to stable until the team can answer all of the following for each declared supported target:

| Dimension | Evidence required |
|---|---|
| Contract correctness | Required/optional ports, types, events, and errors behave as documented. |
| Platform support | The feature executes on its declared target, not merely in a static preview. |
| Access control | Denied permissions fail safely; granted scopes are enforced at the privileged boundary. |
| Persistence | Saved work, settings, and document data survive the relevant restarts. |
| Recovery | Cancellation and failures preserve a consistent project and recoverable user data. |
| Accessibility | Keyboard, labels, focus, and relevant screen-reader semantics have been tested. |
| Performance | Representative workloads fall within measured budgets, or limitations are documented. |
| Documentation | A user can understand configuration, dependencies, failures, and output. |
| Packaging | The generated app runs under its documented dependencies without Solarium. |
| Provenance | Output records the precise graph revision, block versions, target, and build status. |

### 34.2 Foundational graph test cases

1. Add a valid block and verify stable identity after save/reopen.
2. Add two identical-looking blocks and verify they remain distinct nodes.
3. Connect a valid output to a valid input and observe correct semantic graph change.
4. Reject connection from input to input with specific diagnostic.
5. Reject wrong-port type without corrupting graph.
6. Reject connection into missing node or deleted port.
7. Enforce one-connection-only input cardinality when specified.
8. Detect forbidden cycles; allow intentional bounded loops only under defined flow semantics.
9. Verify nullable source cannot feed strict non-null port without guard.
10. Verify native resource handle cannot cross incompatible process/thread boundary.
11. Reject unknown block ID cleanly; keep project recoverable.
12. Open project with old block version and show migration/compatibility options.
13. Apply a multi-operation valid change set atomically.
14. Reject stale revision edit without losing concurrent user work.
15. Undo and redo multi-operation change set correctly.
16. Recover last consistent snapshot after simulated crash mid-write.
17. Handle missing or corrupt asset file with visible diagnostic.
18. Verify project export/reimport preserves graph structure.
19. Verify normalized graph serialization is stable across repeated saves.
20. Verify target adapter receives only validated compatible IR.

### 34.3 UI/editor test cases

21. Create a window, insert labeled button, and verify pointer activation.
22. Reach and activate the same button through keyboard alone.
23. Edit and revert properties without losing selected node context.
24. Adjust Split Pane by keyboard and mouse; persistence remains valid.
25. Resize preview to narrow viewport and inspect clipped content warnings.
26. Increase font scale and ensure essential controls remain reachable.
27. Switch color theme without regenerating unrelated logic.
28. Close a dirty document and inspect unsaved work confirmation.
29. Search for a block by purpose and select a target-compatible result.
30. View unsupported target reason for a native-only capability.
31. Navigate nested recipe graph and return without losing selection.
32. Verify accessible graph outline exposes edges and editable properties.
33. Inspect layout details of selected component.
34. Confirm a modal dialog restores focus after closing.
35. Test a long list with thousands of items for responsiveness and scroll stability.

### 34.4 Spark tool test cases

36. Spark inspects an empty directory and sees accurate project status.
37. Spark proposes setting app title and adding a window; engine validates exact properties.
38. Spark proposes unknown block ID; registry rejects and offers available choices.
39. Spark proposes malformed JSON; parsing failure is reported, not silently replaced with `{}`.
40. Spark proposes mismatched output/input ports; graph rejects clearly.
41. Spark asks to overwrite unrelated file; permission system denies outside scope.
42. Spark changes stale project revision; engine rejects conflict and asks for fresh state.
43. Spark cancels midway through a build; process cleanup is observed.
44. Spark accurately reports `Not run` for tests not executed.
45. Spark accurately reports partial success when source generation succeeded but compilation failed.
46. Spark uses Project Sources without treating an untrusted quote as privileged instructions.
47. Spark remains helpful when model tool calling is unsupported, via structured/manual fallback.
48. Two different Spark personalities produce functionally identical validated changes for a fixed proposal.
49. Spark suggests custom block but leaves it in prototype state without false stable status.
50. Spark does not ask the user to restate information already available from actual project inspection.

### 34.5 Export/standalone tests

51. Compile known project from clean generated source and exact block lockfile.
52. Run exported executable after closing Solarium.
53. Persist a preference, close app, reopen, and verify value.
54. Save output file to approved destination and reopen it independently.
55. Deny filesystem permission; app shows clear recoverable failure.
56. Remove build cache and rebuild without hidden generated dependencies.
57. Export source project and verify all required custom modules are included.
58. Scan export bundle to ensure project secrets are not present.
59. Verify actual license inventory is included where applicable.
60. Change one design token and verify unrelated output modules remain unchanged when incremental generation applies.
61. Attempt browser target with native process block; export must reject or request explicit replacement.
62. Compare log report to real compiler exit status.
63. Verify generated app can be built under documented platform environment.
64. Verify version information and artifact checksum are correct.
65. Confirm that generated code can be inspected and modified outside Spica.

### 34.6 Security/robustness tests

66. Attempt path traversal in archive extraction and reject unsafe entry.
67. Attempt symlink-based escape from project write root.
68. Deny network grant and confirm no external request occurs.
69. Inject malicious content into retrieved documentation and verify it does not become a tool instruction.
70. Attempt to register custom block with undeclared privileged operation; reject or quarantine.
71. Revoke grant while preview runs and verify subsequent sensitive calls fail.
72. Test large binary import without freezing renderer.
73. Simulate partial disk full during atomic save.
74. Simulate build-process crash without leaving orphan subprocesses.
75. Use invalid Unicode, mixed line endings, and unusual file names.
76. Import corrupted SQLite backup and preserve existing database.
77. Verify output from shared/reused block does not leak another project's private data.
78. Test downloaded package checksum mismatch.
79. Test excessive event recursion; fail safely with diagnostic.
80. Test memory and CPU quota enforcement for sandboxed preview, where supported.

### 34.7 Creative and specialist test cases

81. Huelith-like demo opens image, creates layer, draws, undoes, saves, reopens, and exports valid pixels.
82. Typecase-like demo edits document, preserves selection, saves, reopens, and exports PDF with expected pagination.
83. Video demo trims segment and exports playable video with synchronized audio.
84. Audio demo records through permitted microphone, writes file, and plays it back.
85. 3D demo imports model, displays topology, applies transform, and reexports valid geometry.
86. Biome editor demo modifies engine-compatible configuration and fails validation on invalid range.
87. Stella UI demo shows simulated printer states without issuing physical hardware commands.
88. Custom Rust block demo returns typed result and handles native errors.
89. Image segmentation demo compares masks on difficult fixtures and reports measured failure cases.
90. Offline asset converter demo runs without access to external endpoints.

### 34.8 Faults that should block a release

- A project save can silently lose data.
- A generated app is marketed as complete when basic advertised interactions are placeholders.
- A permission denial is ignored by privileged code.
- A Spark can overwrite files outside its granted scope through graph-edit operations.
- Generated source overwrites custom files without disclosure.
- App export requires an undisclosed proprietary service.
- A failing build is reported as passing.
- An unstable block can be silently promoted to official stable status.
- An existing project can be migrated irreversibly without backup.
- Core editor actions cannot be completed without a pointer and there is no accessible alternative.

<a id="spica-chapter-35"></a>
## 35. Suggested documentation and contributor standards

### 35.1 Documentation set

Create a small, versioned documentation tree that is approachable to non-programmers but precise for developers. Recommended documents:

| File | Purpose |
|---|---|
| `docs/spica/README.md` | Product concept, quick start, supported targets, maturity badges. |
| `docs/spica/ARCHITECTURE.md` | Module boundaries, service ownership, process separation, extension APIs. |
| `docs/spica/PROJECT_FORMAT.md` | Schemas, versioning, migrations, file ownership, export layout. |
| `docs/spica/BLOCK_CONTRACT.md` | Manifest, typed ports, errors, permissions, tests. |
| `docs/spica/GRAPH_SEMANTICS.md` | Execution order, async behavior, cycles, resource lifetime, state. |
| `docs/spica/IR_SPEC.md` | Intermediate representation and target lowering rules. |
| `docs/spica/CODEGEN.md` | Target emitters, source maps, generated/custom separation. |
| `docs/spica/SECURITY.md` | Threat model, trust tiers, capability grants, sandbox limitations. |
| `docs/spica/AGENT_TOOLS.md` | Spark tool schemas, permissions, transactions, event evidence. |
| `docs/spica/RECIPES.md` | Recipe composition, parameterization, upgrade policy. |
| `docs/spica/TESTING.md` | Test pyramid, fixtures, release qualification. |
| `docs/spica/TARGETS.md` | Supported runtimes, platform capability matrix, toolchain versions. |
| `docs/spica/ACCESSIBILITY.md` | Keyboard graph editing, semantics, reduced motion, testing. |
| `docs/spica/BLOCK_AUTHORING.md` | How to create a custom block with verified behavior. |
| `docs/spica/CONTRIBUTING.md` | Code review, versioning, changelog, licenses. |
| `docs/spica/ADRs/` | Architecture decision records with options and consequences. |
| `docs/spica/TUTORIALS/` | First app, data binding, safe file I/O, recipes, custom code. |

### 35.2 Interface and function conventions

Prefer narrow service interfaces and pure validation functions. For example, `SpicaGraphService.applyChangeSet()` should own graph mutations, and `validateConnection()` should remain a pure reusable check. A code emitter should implement `SpicaTargetEmitter.generate()`, not mutate project state directly. A privileged native adapter must validate permissions at execution time, regardless of what the UI displayed. A `SpicaAgentAdapter` turns a model proposal into a verified change set rather than giving the model an unrestricted file-writing handle.

### 35.3 Naming conventions

Use semantic and stable IDs such as `spica.ui.button`, `spica.flow.if-else`, and `spica.fs.save-file`. Keep human-friendly display labels independent of internal IDs. A graph edge is identified by a stable connection ID, not by the displayed label or port position. Versioned ports can have aliases for migration but must not silently change meaning.

### 35.4 Code review requirements

Every block change should include its contract version, implementation change, at least one meaningful executable test, target compatibility update, permission review, migration notes if necessary, and documentation. New shell/process/native blocks deserve stronger scrutiny. A code review should verify generated code does not accidentally embed local development paths or secrets.

### 35.5 Contributor onboarding

Provide `hello-world`, `settings-app`, `file-converter`, and `custom-block` examples with known passing test output. Include direct commands for type checks, Rust checks, formatting, unit tests, and end-to-end builds, sourced from the actual repository rather than copied blindly from this concept document.

### 35.6 Definition of done for a new official block

A proposed block becomes eligible for stable status when its schema is validated, its target code is real, its inputs and errors are documented, its capabilities are declared, appropriate tests pass, its generated code builds, its resource behavior is measured, it survives project reopen, and a sample app demonstrates the advertised feature. If one condition is missing, keep the feature in a lower maturity tier and state why.

### 35.7 Good architecture decision records

Each decision should identify: problem, current constraints, options considered, selected approach, trade-offs, expected consequences, alternatives rejected, testing needed, and future revision conditions. Example decisions worth recording:

- `ADR-001`: Typed graph as authoritative source of truth.
- `ADR-002`: First target = Tauri 2 + React + TypeScript + MUI + Rust.
- `ADR-003`: Generated/custom/vendor source ownership separation.
- `ADR-004`: Change sets with revision preconditions and undo journal.
- `ADR-005`: Canonical Solarium event stream shared with Spica.
- `ADR-006`: Local-first registry and exact block locks.
- `ADR-007`: Permission-scoped native and network effects.
- `ADR-008`: Preview-mode truth labels.
- `ADR-009`: Explicit wrappers for imported existing code.
- `ADR-010`: Custom block maturity and trust promotion policy.

### 35.8 Stable public APIs and private implementation

Spica needs public interfaces for blocks, recipes, graph operations, target emitters, tests, and project files. Details of editor rendering, caching, and internal worker queues can remain private and change more frequently. A third-party block should not need to import a private React component from Solarium's chat interface just to define its capabilities.

### 35.9 Quality checklist for milestone pull requests

A milestone PR should include: scope summary; affected TypeScript interfaces/functions/classes; migration and compatibility notes; exact build/test commands executed; outcomes; before/after screenshots only where visual changes matter; known limitations; rollback path; sample project output; and an indication of user-owned files touched. If checks were skipped because a toolchain was unavailable, say so.

---

# Part X — Implementation doctrine and final north star

<a id="spica-chapter-36"></a>
## 36. A complete example: from one sentence to a trustworthy app

**Request:** “Dona, make a small desktop program that lets me organize and preview 3D models for printing.”

### 36.1 Understand the actual requested outcome

The Spark identifies a desired desktop organizer, not a full 3D modeling engine. It finds that the user wants folders, file previews, tags, and search. It checks whether a project already exists and whether the intended files are available locally. It also checks which target toolchain is installed. It does not assume importing every 3D file format will work perfectly.

### 36.2 Build an inspectable plan

Spica proposes a `ModelOrganizer` project with a `Native Window`, `Asset Browser`, `Mesh Import Adapter`, `3D Viewport`, `Metadata Inspector`, `Tag Store`, and `Search`. The plan notes which file formats the installed loader supports and which operations need directory read permission. It defines acceptance criteria: open a supported file, display geometry, inspect metadata, add a tag, reopen the project, and confirm that tag persists.

### 36.3 Assemble verified capabilities

The Spark selects tested blocks from the registry. For each connection, the graph engine checks direction, type, target support, and capability scope. A file picker returns a trusted handle, not an arbitrary path string. The mesh adapter returns either geometry or a typed import error. The viewport consumes geometry and displays a loading or error state when necessary. The tag store saves metadata with the selected file's stable identity.

### 36.4 Allow a custom module where needed

Suppose the requested 3D format lacks a compatible parser. Spica reports it as unsupported. The Spark may propose a new adapter, but it must implement and test one. A user can alternatively skip that format and complete the organizer with supported imports. The missing feature must not be hidden.

### 36.5 Prove the result

Spica generates a Tauri/React project, formats and type-checks source, compiles Rust integrations, and runs a real sample import. It opens the exported app independently of Solarium. The final report lists changed blocks, generated files, permissions, supported formats, tests executed, and remaining limitations.

### 36.6 Make the achievement reusable

The user can extract `TaggedAssetBrowser` as a recipe, share it in a local bundle, and reuse it later in CubeTable, Huelith, or another utility. If a better mesh adapter is added, the app can upgrade through a reviewed version change. This is the compounding effect Spica should create.

<a id="spica-chapter-37"></a>
## 37. What to implement first — an unambiguous priority answer

If development starts from a merged Solarium/Glitch codebase today, the best first outcome is not a gigantic block gallery. It is one narrow, fully verified route:

**Create a Tauri desktop settings app manually → save it → connect a button to real persistent state → preview it → compile it → run it without Solarium → ask a Spark to add a new setting through a typed change set → verify the new build.**

That route forces the team to solve the hardest foundational boundaries: project persistence, graph transactions, typed ports, real event logic, target-specific code generation, privileged file/state handling, source ownership, actual builds, and Spark tool execution. Once these work, the studio can grow by adding tested blocks and recipes rather than redesigning its fundamentals every week.

### Minimal initial block set

A deliberately small starter library might contain: `App Root`, `Native Window`, `Stack Layout`, `Grid Layout`, `Text Label`, `Button`, `Text Input`, `Toggle Switch`, `Sidebar Navigation`, `Form Group`, `On Click`, `On Change`, `If Else`, `Constant`, `Variable`, `Computed Value`, `Application Store`, `Persistent Preferences`, `Error Boundary`, `Toast Notification`, `Permission Request`, `File Picker`, `Read Text File`, `Write Text File`, `Graph Validator`, `Tauri Target`, `Build Process`, and `Test Runner`. These 28 examples cover enough surface area to build a real small utility while exposing integration problems early.

### First real recipe set

`Settings Application`, `Open Save Document`, `Simple Notes Organizer`, `Theme Switcher`, `Searchable Master Detail`, and `Autosave and Recovery` are enough to demonstrate reusability. Delay broad media/3D catalog implementation until the project graph and compiler have a proven foundation.

### First agent test

Give Dona a project with a working settings panel and ask her to add one new persistent toggle. Success requires **an actual new UI control, graph connection, persisted value, clean build, passing test, and truthful final report**. A charming explanation, a fake Activity timeline, or a code snippet without a running app does not count.

<a id="spica-chapter-38"></a>
## 38. What Spica changes over the long term

The long-term opportunity is not merely faster app generation. It is **accumulated engineering capability**. A solved filesystem workflow becomes a block; a reliable settings area becomes a recipe; a validated image export pipeline becomes a reusable feature; a specialist Rust function becomes a typed adapter; and an entire useful app becomes a project template. The local model doesn't need to re-learn the implementation each time because the environment now exposes the capability explicitly.

This also creates a more inclusive creation path. A beginner can work in visual design mode, a hobbyist can combine recipes, an advanced user can inspect source, and a professional can replace an algorithm with optimized native code. All are building from the same underlying model instead of abandoning their previous work when they advance.

The most important measure of success should be **what real applications users can finish and own**. It should not be the number of glowing nodes on a canvas, the apparent cleverness of a Spark, or the number of fictional status messages in an Activity panel.

> **Spica should make the reliable parts of programming reusable, the creative parts approachable, and the difficult parts transparent.**
>
> **Solarium provides the workspace. Sparks interpret the goal. Spica constructs the application. Glitch refines the exceptions. Verified tools prove the result. The user owns the output.**

---

# Appendix A — Concept-source alignment and historical context

This document expands ideas from the two supplied Solarium planning/review notes. It is not a source-code audit of the latest merged repository. Existing file paths, architectural descriptions, and historical issues should be verified against the current working tree before coding.

**`Solarium UI redesign.txt`** describes the intended split among Spark personality, model intelligence, and reliable execution; action recipes; Chat Sources and Project Sources; project inspection; validated tool arguments; project-aware tool selection; local-model constraints; and truthful work artifacts. Spica inherits those principles. In particular, the notes emphasize not exposing irrelevant tools to a model and not silently turning malformed parameters into an empty object.

**`Solarium Debugging and Fix.txt`** describes earlier problems with conflicting Activity narratives, duplicate event emissions, reasoning parsing, model capability assumptions, and overly centralized orchestration. Spica should honor the correction: operational events must be sourced from actual transitions and outcomes. That review also argues for keeping the chat orchestration layer thin and separating the responsibilities of UI, tool execution, auxiliary analysis, and model inference.

**Proposed, not already proven:** Every Spica service, block registry, compiler emitter, project manifest, recipe, catalog entry, maturity badge, and interface in this document is a design recommendation until the merged repository is inspected and the implementation is verified. A historical path mentioned in a source note may no longer exist following the merge.

# Appendix B — Candidate issue labels for development

`spica:core`, `spica:graph`, `spica:ui`, `spica:flow`, `spica:compiler`, `spica:target-tauri`, `spica:target-web`, `spica:target-electron`, `spica:rust`, `spica:registry`, `spica:recipe`, `spica:agent`, `spica:sources`, `spica:permissions`, `spica:privacy`, `spica:import`, `spica:testing`, `spica:documentation`, `spica:accessibility`, `spica:performance`, `spica:security`, `spica:migration`, `spica:experimental`, `needs-architecture-decision`, `needs-repro`, `blocked-by-toolchain`, `verified-in-standalone-app`.

# Appendix C — Suggested project-level acceptance record

```yaml
project: example-settings-app
revision: rev-0017
target: tauri2-react
project_saved: true
graph_validation:
  executed: true
  passed: true
source_generation:
  executed: true
  passed: true
  generated_files: 12
build:
  executed: true
  passed: true
  exit_code: 0
standalone_launch:
  executed: true
  passed: true
scenario_tests:
  - name: theme setting persists across relaunch
    executed: true
    passed: true
  - name: invalid import preserves saved preferences
    executed: true
    passed: true
permissions:
  - scope: project
    capability: filesystem-write
    approved: true
limitations:
  - no automatic system startup configured
artifacts:
  - path: dist/example-settings-app
    verified: true
```

The YAML above is **illustrative evidence structure**, not evidence of a real build. Production reports must be populated from actual operations and never from an LLM's prediction.

# Appendix D — A concise product manifesto

1. Build something real before advertising intelligence.
2. Use blocks to eliminate repetitive implementation work, not to conceal complexity.
3. Keep the user in control of permissions, source code, and distribution.
4. Let small models do bounded tasks inside reliable systems.
5. Prefer stable reusable components over repeated giant patches.
6. Make visual work editable by keyboard, forms, and code.
7. Never confuse a preview with a production artifact.
8. Make errors specific, factual, and recoverable.
9. Protect the last working version of every project.
10. Permit creativity without forcing dependence on the studio.
11. Require custom components to earn trust through tests.
12. Keep Solarium, Spica, Sparks, and Glitch modular.
13. Let verified functionality accumulate over time.
14. Treat licenses, privacy, and safety as engineering requirements.
15. Judge the product by useful software that people can independently run.

**End of the Spica Master Blueprint — Edition 0.1.**
