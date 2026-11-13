# SPICA Phase 09 — Independent Desktop and Browser Exports

**Checkpoint:** 12 November 2026. **Implementation round:** Phase 09 (after Phase 08 unified blocks and improved failed-tool continuation).

## Scope and completed work

1. **One canonical block folder**: every schema-1 and V2 block implementation is under `src/spica/runtime/blocks/<category>/`. No `src/spica/blocks/` remains. Both static registries are generated from the canonical tree, retaining 26 legacy and 103 V2 executable adapters (129 block modules total). Engine infrastructure stays in `src/spica/runtime/`.
2. **Safe removal script**: `npm run spica:blocks:cleanup` verifies both generated registries, checks every obsolete file has a byte-identical canonical copy, and removes the old directory only if nothing would be lost. `npm run spica:blocks:cleanup:check` is an idempotent read-only check. A conflict terminates the cleanup without deletion.
3. **Independent targets**: `src/spica/target-lowering.ts` provides `inspectSpicaTarget()` and `lowerSpicaTarget()` for `desktop` and `web`. `src/spica/emit.ts` retains `emitTauri()` and adds `emitWeb()`. The web target is a genuine Vite/React/MUI browser project using IndexedDB and browser downloads, **without Tauri APIs or native application dependencies**.
4. **Honest target restrictions**: lowering validates target support and stops unsupported schemas/blocks. Authored Graph V2 compositions are **not** automatically exported as working apps; no speculative lowering or silent node dropping is allowed. This stage supports the validated schema-1 application graph and independently verifiable generated files. Arbitrary V2 graph-to-app compilation remains future work.
5. **Target evidence**: native `spica_web_artifact_hash` and `spica_web_lock_fingerprints` are registered in Tauri; `src/spica/export.ts` scopes receipts and fingerprints to the selected build target. Browser verification checks the actual `dist-web/` output. Web builds cannot enable the native launch button.
6. **Workbench integration**: the existing centered glass `src/components/SpicaWorkbench.tsx` supports choosing Desktop or Web. `src/components/spica/SpicaBuildTimeline.tsx` uses real target-specific stages, never synthetic success.
7. **Dona's tool-loop diagnostics**: `spica_next_action` provides concrete next-tool guidance and required arguments from current graph state. `inspect_spica_tool` can describe runtime block IDs as **resources** without labeling them callable functions; `inspect_spica_runtime_block` remains the dedicated block contract inspector. Missing Graph V2 is reported as a required `migrate_spica_v2_graph` operation. A repeated identical failed tool call is restricted instead of being selected infinitely; diagnostic evidence stays visible. **No hidden fallback, implicit tool execution, provider switching, or permission bypass is added.**
8. **Existing app preserved**: chat-first Solarium, current Spark persona/permissions, existing graph revisions, sources and game renderer are untouched. New web support is target-specific, not a change to model inference.

## Repository entry points

| Concern | Source |
|---|---|
| Legacy + runtime block sources | `src/spica/runtime/blocks/` |
| Registry generators | `scripts/generate-spica-registry.cjs`, `scripts/generate-spica-runtime-registry.cjs` |
| Safe cleanup | `scripts/clean-spica-legacy-blocks.cjs` |
| Target compatibility | `src/spica/target-lowering.ts` |
| Standalone emitters | `src/spica/emit.ts` (`emitTauri`, `emitWeb`) |
| Export/verification orchestration | `src/spica/export.ts` |
| Runtime hash/lock evidence | `src-tauri/src/spica_preview.rs`, `src-tauri/src/lib.rs` |
| Spark tool contracts and selection | `src/spica/tools.ts`, `src/spica/tool-intelligence.ts`, `src/engine/agent.ts` |
| Workbench target and progress | `src/components/SpicaWorkbench.tsx`, `src/components/spica/SpicaBuildTimeline.tsx` |

## Test and build gates

Run from the repository root:

```sh
npm run spica:blocks:cleanup:check
npm run spica:registry:check
npm run spica:runtime:registry:check
npm run test:spica:phase09
```

Additionally run **all Phase 01–08 focused suites**, `node --test tests/spica-block-unification.test.cjs`, and `node scripts/check-syntax.cjs`. Phase 09 checks target-lowering refusal, generated browser files, artifact registration, target-scoped Workbench, exact migration guidance, block/tool differentiation, and repeat-failure diagnostics.

**Limitations:** A passing source syntax check is **not** a full TypeScript build. The provided environment lacks frontend npm dependencies required for the complete Vite/React build and a native Windows/Rust toolchain required for Tauri compilation. The user must still run the full project build and scenario tests locally. Actual GGUF model behavior needs testing within Solarium. Neither the 350K proposed catalog capacity nor a V2 runtime graph implies exportable standalone code.

## Notes for the next phase

Phase 10 can integrate custom Glitch code and graph-owned extension points through the target-lowering contract, but must not claim unsupported V2 graphs were emitted. A failure should remain visible and actionable; an identical inspection error must not be reported as progress. Implement target-specific preview and output tracking before claiming packaged applications are ready to ship.
