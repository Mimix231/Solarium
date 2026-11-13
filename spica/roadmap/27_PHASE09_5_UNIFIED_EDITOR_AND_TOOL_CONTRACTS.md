# SPICA Phase 9.5 — Unified Graph Editor and Exact Tool Contracts

**Status:** Implemented and focused tests passing; **not** certified as a Windows/Tauri release.

## Canonical source and scope

- Source baseline: `Solarium_SPICA_Phase09_Tool_Contract_Intelligence.zip` (Phase 9 source).
- This checkpoint remains **Phase 9.5**. No Phase 10 implementation was started.
- Every executable block remains in its own TypeScript source file under `src/spica/runtime/blocks/<category>/...`. No alternate `src/spica/blocks` source folder was created.

## The decision

There is **one** Spark-facing graph editor: `edit_spica_graph`.

The obsolete name `edit_spica_v2_graph` is not a registered tool, is not offered to Dona and has no executable dispatch branch. V1 schema edits and V2 node/port edits are routed through `edit_spica_graph` with the explicit `view` property:

- `view: "schema1"`: existing application schema; `view` may be omitted for existing V1 tool calls.
- `view: "v2"`: universal typed graph; **view is required** for V2 edits.

Both modes require `revision` (current saved graph revision) and an array of `edits` (1–12). Each edit is a discriminated `op` object. No unrecognized edit keys are allowed. The schema, preflight and save paths derive from `src/spica/edit-schemas.ts`.

## V1 operations

`install_recipe`, `add_collection`, `add_record_field`, `put_screen`, `put_flow`, `put_scenario`, `set_start_screen`, `grant_capability`, `revoke_capability`, `set_style`, `add_page`, `add_setting`, `label_setting`, `remove_setting`, `add_record_toggle`, `rename`.

Each operation has its own typed fields, required parameters, and nested structures; `screen.fields` remains a list of field **IDs**. Existing V1 save and standalone export behavior is preserved.

## V2 operations

`rename`, `add_scope`, `remove_scope`, `add_node`, `add_block`, `remove_node`, `set_node_config`, `move_node`, `connect`, `disconnect`.

`add_block` accepts an executable block ID and uses **the actual runtime registry** to derive its typed ports. It checks the block's configuration using `validateConfig` and does not guess node ports. All V2 edits are validated through an atomic graph transaction, with type and connection checks performed by the existing V2 validator. Schema-1 source is not overwritten. A successful V2 save returns `exported:false`; this does **not** claim the standalone native compiler supports arbitrary V2 compositions.

## Spark tools and parameter discovery

- `read_spica_graph` — one graph reader; select `view: "schema1"`, `"v2"`, or `"both"`.
- `inspect_params({view, operation})` — see the precise current operation contract, revision, available IDs, and an example when prerequisites permit it.
- `inspect_spica_tool({name:"edit_spica_graph", view, operation})` — see a narrow callable declaration and optional proposed-arguments validation.
- `validate_spica_edit({revision,view,edits})` — perform the **same** validation without saving.
- `edit_spica_graph({revision,view,edits})` — permissioned save of validated changes.
- `inspect_spica_runtime_blocks({blocks:[{id,version?},...]})` — new read-only batch inspector, for 1–12 executable block IDs. Exact typed ports, description, config examples, targets and permissions are returned. Block IDs are **data**, never callable tool names.
- `check_spica_tool_call` — inspection of a proposed exact tool call through the canonical registered schema.

Graph edit declarations can be **narrowed to inspected operations** for small GGUF models, but validation accepts no broader arguments than the central contract. `selectSpicaTools` now offers preflight after a V2 edit inspection and offers the editor after successful preflight instead of endlessly returning to block discovery.

Other registered tools keep their existing explicit parameter schemas. An operation genuinely requiring no arguments retains `{}`; artificial parameters would introduce rather than prevent errors. This checkpoint does not invent additional capabilities for tools that the runtime cannot execute.

## Safety and permission boundaries

The existing Ask/Auto/YOLO authorization and project revision checks are unchanged. No hidden retry or hardcoded feature generator was introduced. A stale revision is rejected. A V2 edit requires a migrated V2 graph and does not silently create it.

## Validation performed in this environment

- SPICA schema-1 registry: **26** registered source modules; 35 category definitions.
- SPICA V2 runtime registry: **103** executable source modules.
- `node scripts/check-spica-phase95.cjs`: six focused integration tests, including actual V1 and V2 edit operations, `add_block` port preservation, dry-run, stale-revision rejection, narrow schemas, V2 stage selection, and batch inspection.
- Phase 1–9 regression checks: passing.
- Existing tool-contract and block-unification regression suites: passing.
- `node scripts/check-syntax.cjs`: 433 source files parsed.
- `npm run check` **cannot reach TypeScript**: missing installed frontend packages (`react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `highlight.js`, `katex`, `pdfjs-dist`, `mammoth`). Targeted strict TypeScript compilation of the new schema, edit adapter, transaction and inspection modules passed.
- Native Windows Tauri and actual GGUF interaction tests were **not** run. They remain a required release gate before Phase 10.

## Local validation commands

1. `npm install` (on the actual Windows project environment with the configured network/npm cache).
2. `npm run check`.
3. `npm run build`.
4. `npm run test:spica:phase95`.
5. `npm run tauri dev` and perform a real Dona request that inspects, validates, saves and previews a V2 node/connection change.

**Acceptance criteria:** Dona must use the registered blocks instead of fabricating feature installers, perform at least one real saved graph revision, and not misreport a V2 authoring operation as a successful standalone application export.
