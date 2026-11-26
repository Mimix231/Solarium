# Phase 10 — Round E input-context overflow repair

**Source baseline:** `Solarium_Phase10_RoundE_Onion_Skin_Work_Log_Cosmic_Migration.zip`.
**Reported failure:** Loaded context 8,192; constructed request around 12,052 tokens; one offered tool schema; no inference begun.

## Root cause

`src/spica/edit-schemas.ts` contains a canonical 32-operation graph-edit union.
Its **full model-facing** JSON payload is 18,407 characters (about 9,204 tokens
using the source's conservative `/2` schema cost). `selectSpicaTools()` used
`spicaToolContract()` without a verified `SpicaEditScope`, which returned the
**entire union** for `validate_spica_edit` or `edit_spica_graph`. During the
pre-migration SPICA stage, `validate_spica_edit` could be offered first.
`prepareGeneration()` removed secondary tools but *always kept the first*,
even if that one definition exceeded the loaded context. A 4,096-token soft
budget could borrow the actual model capacity, but even 8,192 was insufficient.
Large optional Spark examples/memory/World text compounded the problem because
they were embedded in the same system message as mandatory persona instructions.

## Changes

1. `initialSpicaEditScope` in `src/spica/edit-schemas.ts`: bounded, exact
   registered operation contracts for migration, active V2 composition, or
   schema-1 field/screen edits. Existing scope from a real inspected/preflighted
   request always takes precedence.
2. `selectSpicaTools` in `src/spica/tools.ts`: always supplies the above scoped
   contract to selected **edit and validate** tools; no model-facing unscoped
   18-KB editor schema. The canonical union and underlying executor are intact.
3. `prepareGeneration` in `src/engine/context-window.ts`: if even the first
   offered tool is larger than the available context, consider smaller
   **already-registered, already-offered** tool contracts before blocking.
   Otherwise preserve tool priority, all required output headroom and approvals.
4. `composeSparkInstructionParts` in `src/domain/persona.ts` and `runAgent()`
   in `src/engine/agent.ts`: separate user-written persona/core from optional
   remembered data, World snippets and voice examples. Input preparation can
   remove optional reference sections without modifying source memories, the
   user request or the Spark's authored personality. Full old persona
   composition stays text-equivalent for existing callers.
5. `tests/spica-phase07-tools.test.cjs` and
   `tests/spica-phase10-roundE.test.cjs`: replay the overlarge single-editor
   schema, verify exact scoped operations, an 8,192-token fitting path, an
   oversize-first-tool fallback from previously offered contracts and the
   4,096-soft / 8,192-real distinction.

## Preserved contracts

- One canonical `edit_spica_graph`; no duplicate `edit_spica_v2_graph`.
- Same exact graph operation validators, source-write permissions, revisions,
  immutable originals and real-tool-evidence requirements.
- Native llama.cpp single-stream `max_tokens: -1`; no synthetic generation
  continuation, forced output cap, model reload or changed n_ctx.
- Current Round E Work Log, compact Plan, 148 runtime blocks and Cosmic path.

## Verification

- `npm run test:spica:phase10:contextfix` (Phase 07 tool contracts and Round E
  context fitting + model-streaming checks).
- Phase 01–10, 9.5, and the Round B/C/D compatibility suites.
- Two runtime-registry checks and full TS/TSX syntax parsing.
- Full frontend typecheck, native Tauri build and live GGUF inference are
  separate validation gates when installed runtime dependencies are available.

## Boundary

No finite-context model can accept arbitrarily long *protected* instructions
or an arbitrarily long latest user request in one inference. This repair makes
normal SPICA tool selection and optional context fitting fit small models
without truncating valid tools or silently dropping explicit user constraints;
it does not claim to defeat the physical context capacity of the loaded model.
