# Phase 10 — Round F: distinct tools, verified aliases, executable blocks, Cosmic workbench

**Baseline:** `Solarium_Phase10_RoundE_Context_Overflow_Fixed.zip`.
**Scope:** SPICA tool aliases + genuinely distinct diagnostics, runtime-block expansion, live Work Log classifications, and code-based Cosmic controls. This is still Phase 10; no new `_v2` callable tools are introduced.

## Screenshot failure corrected

Repeated `check_spica_tool_call` calls referring to `discover_compatible_blocks` previously returned `UNKNOWN_CHECK_TARGET`. `discover_compatible_blocks` is now a **non-registered alias** for the existing `resolve_spica_capabilities` tool, with `query`/`requirements`/`keywords` converted to the canonical `queries` argument and `limit` converted to `limitPerQuery` **before** argument validation. It works in direct execution, tool inspection, preflight, and agent model-call normalization. The underlying handler and permission requirements are unchanged.

`src/spica/tool-aliases.ts` contains **73 curated alternate spellings** for existing callable SPICA tools. Unique kebab-case/PascalCase/camelCase variants are generated only from registered tools. Unknown tool names are still rejected; ambiguous aliases are not installed. Aliases do **not** become second callable tool declarations and do **not** bypass schema validation or permissions. Block ID aliases remain in a separate registry. Generic `list_tools`/`list_available_tools` target the global `list_solarium_tools`, rather than misleading users with a SPICA-only list.

## Three new original callable tools

- `inspect_spica_graph_impact(revision,nodeIds,direction?,maxDepth?)`: traverses the **actual saved Graph V2 edges**, returning bounded downstream/upstream dependencies, not hypothetical compatible wiring.
- `run_spica_behavior_checks(revision,checks,target?)`: executes the actual saved Graph V2 in an **isolated permissionless runtime** and asserts output-port behavior. It does not reimplement `verify_spica_app`, invoke OS commands, or claim native export success.
- `inspect_spica_registry_health(category?,limit?)`: validates registered adapter example configs, permission conventions, and block-alias integrity. It works even before a project graph exists and does not duplicate warehouse listing.

All declarations have exact type/required parameter schemas, distinct handlers, inspector/work-log classifications, and availability through appropriate SPICA workflow stages. The canonical `edit_spica_graph`, `read_spica_graph`, and `run_spica_graph` names are preserved. Older `_v2` compatibility code has not been duplicated or renamed.

## Eighteen executable blocks added

One source file per canonical adapter under `src/spica/runtime/blocks/<category>/runtime/...`:

- UI controls: `ui_tooltip`, `ui_context_menu`, `ui_breadcrumbs`, `ui_tree_view`, `ui_range_slider`, `ui_file_picker`, `ui_resizable_panel`, `ui_keyboard_shortcut`.
- Permissioned storage: `record_exists`, `record_lookup_many`, `record_bulk_upsert`.
- Functions / transforms: `array_zip`, `array_chunk`, `array_index_by`, `text_parse_json`, `text_format_json`, `validate_assertion`, `url_parse`.

These are executable registered blocks with typed ports, configuration validators, target declarations and, for effectful blocks, permissions and transactions. The eight new UI descriptors have real React/MUI rendering and event surfaces in `SpicaBlockPreview.tsx`. File selection provides **filename-only** UI events; no arbitrary filesystem contents are read. Record batch writes require `records.write`, verify all records, and use one rollback-capable transaction. The registry now contains **166 V2 executable blocks**; all 148 previous adapters remain present.

The registry-health tool also exposed eight older adapter example configs that were `{}` and failed their own validators. Added valid **metadata examples only** to `save_note`, `note_contains`, `app_navigation`, `responsive_split`, `theme_palette`, `material_button`, `note_record`, and `glass_surface` without changing their executable behavior.

## Real Cosmic UI work, not raster screenshots

`src/ui-themes/cosmic/CosmicBuildBanner.tsx` renders the actual SPICA Plan state (objective, stage progress, graph revision) and real `View Plan` / `Open Workbench` controls. `CosmicCastleAccent` is an original, partially transparent decorative SVG with a CSS gradient mask and glow **inside** the banner; no raster image replaces the controls. `cosmic.banner.css` adds real responsive glass/card/workbench styling; the previously forced full-background `nebula-floor.webp` reference is removed from the shell. Classic stays the default. The original Cosmic concept references in `docs/design/cosmic/` remain untouched. Pixel-accurate validation of the live frontend against the five concepts has not been possible here.

## Test and validation coverage

- `npm run test:spica:phase10:roundF`: 13/13 focused integration tests, including direct alias preflight/dispatch, registry/canonical validation, graph traversals, isolated behavior checks, UI descriptions, JSON execution, file-only example preservation, permission-denied storage reads, atomic batch writes and rollback, and Cosmic source components.
- Phase 07: 30/30 tests, with a new regression for the **exact** `discover_compatible_blocks` name used via inspector, preflight, and actual dispatcher.
- Phase 01–10, Phase 9.5, Rounds B–E, context-overflow regressions, tool-contract and block-unification suites: passed in the working tree. Phase 03/04/05/9.5 VM harnesses now compile and load the **real** newly imported modules rather than failing on missing test mocks.
- `scripts/audit-spica-phase10-roundA.cjs`: validates 38 SPICA callable declarations against dispatchers, Work Log, prerequisites, and permission registry.
- `scripts/generate-spica-registry.cjs --check`: 26 legacy modules, 35 categories.
- `scripts/generate-spica-runtime-registry.cjs --check`: 166 V2 executable adapters.
- `scripts/check-syntax.cjs`: 508 TypeScript/TSX source files parse.
- Strict standalone `tsc` for all new tool-alias, capability-intelligence, registry, runtime and composition dependencies: passed.

**Full-app limitation:** `npm run check` stops in the precheck before frontend compilation because these packages are not installed in this environment: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `highlight.js`, `katex`, `pdfjs-dist`, `mammoth`. Native Windows/Tauri, actual GGUF-driven workflows, and visual layout comparison therefore remain unverified. No output-token setting, llama.cpp streaming code, inference window setting, or synthetic fallback was changed in Round F.

## Design guarantees

Tool aliases are verified alternate names, not clones. New tool calls must deliver different executable behavior rather than wrapping existing tools. Registered graph edits and native project writes remain permissioned and preflighted. Tool inspection itself never constitutes a verified project modification. The existing onion-skin context and Codex-style activity grouping stay intact.
