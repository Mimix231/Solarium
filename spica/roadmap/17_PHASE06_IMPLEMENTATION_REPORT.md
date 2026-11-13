# Phase 06 — Professional SPICA Application UI, Live Preview and Design Blocks

**Integration date:** 12 November 2026  
**Source input:** `Solarium_SPICA_Phase05_Rust_E0505_Fixed.zip` (including the `spica_catalog.rs` ownership fix).  
**Scope:** Completed focused Phase 06 implementation. Full frontend/Tauri release build **not verified** in this environment.

## Problem this round addressed

The centered SPICA Workbench already had a glass dialog, code differences, and a build timeline. However, the app at the right still used an older form renderer with unstyled/native controls. Spark graph changes could also reinitialize preview adapters, and the Workbench would show “Not started” for a verified app when verification had been performed through Spark tools rather than the Workbench button.

## Delivered

1. **One application design system across preview and standalone builds**
   - `src/spica/target/SpicaUiTheme.tsx`: MUI `ThemeProvider` with graph appearance tokens, system dark/light resolution, and optional Emotion nonce cache for generated standalone apps.
   - `src/spica/target/ui/buttons/SpicaAction.tsx` and `src/spica/target/ui/fields/{SpicaTextInput,SpicaOptionSelect,SpicaToggle}.tsx`: one separately authored reusable component per file, imported through `ui/SpicaControls.tsx`. The actual `<button>`, `<input>`, `<textarea>`, `<select>`, and checkbox semantics remain testable.
   - `src/spica/target/{SettingsApp,CollectionApp,WorkflowApp,SpicaApp}.tsx` now use the shared Material controls for primary user-facing settings, CRUD, form, navigation, search and sorting workflows. A number of auxiliary CSV-import mapping controls intentionally retain their existing native DOM for compatibility with specialized scenarios; games remain on their separate rendering target.
   - `src/spica/target/settings.css` removes competing generic styles from the new Material buttons/inputs and adopts a responsive dark-glass design. Both light and dark system preferences are resolved to explicit `data-theme` attributes for consistent Material/CSS tokens.
2. **Actual same-source export**
   - `src/spica/emit.ts` includes the same UI implementation source when generating standalone apps. Generated `package.json` includes MUI, Emotion React/Styled/Cache. The Solarium root manifest and lockfile now declare `@emotion/cache` directly.
   - `src/main.tsx` and `src/settings.css` emitted at the established, receipt-owned paths (no user-managed source file overwrite). A style nonce is embedded in generated `index.html` and the CSP so Emotion can inject Material styles without `unsafe-inline` script/style allowances. No native dependency installation is implied or hidden.
3. **Live graph changes without a preview data reset**
   - `SpicaPreview` retains its sample storage per `appId` while graph revisions change. `memoryAdapters` and `createAppAdapters` safely upgrade compatible collection schemas by adding defaults without discarding existing notes. New fields are hydrated in the mounted editor without destroying unsaved data for surviving keys.
   - A new `SpicaLivePreviewPane` retains the centered Workbench layout and visually frames the actual interactive graph renderer as an app window, distinct from a real native process. The preview includes the current project title/revision and design-quality findings.
4. **Recorded build evidence is visible even when Dona initiated verification**
   - `SpicaBuildStream` and `SpicaBuildTimeline` show actual, saved `BuildEvidence.checks` (command ID, run ID, exit code, duration) when there is no live Workbench journal. The footer reflects only verified persisted command outcomes; unrecorded export/preview stages remain unclaimed. Old/stale revisions and live runs do not masquerade as current evidence. Full stdout/stderr remains available through Build Logs, not invented or reconstructed from the model response.
5. **Eight new individual V2 blocks** under `src/spica/runtime/blocks/<category>/<block-id>.ts`:
   - `styling/theme-palette`
   - `variables/derived-value`
   - `functions/format-label`
   - `layout/responsive-split`
   - `appearance/glass-surface`
   - `interface/app-navigation`
   - `ui/material-button`
   - `professionalism/field-audit`
   The generated, checked registry now contains **14 V2 executable adapters** (previously 6). The older 26 schema-1 adapters and three recipes are preserved. UI descriptor blocks are executable in the V2 evaluator but **V2-native standalone rendering/export is not implemented**; do not confuse descriptors with independently rendered MUI widgets.
6. **Quality checks and Spark tool**
   - `src/spica/professionalism.ts` checks common accessible label issues, duplicate navigation labels, and configured text contrast. `audit_spica_ui` exposes findings to the Spark, while existing mounted `auditLayout` still handles keyboard focus and overflow.
   - Preserved `data-spica-route`, `data-spica-submit`, `data-spica-sort`, `data-spica-sort-direction`, `data-spica-table-filter`, and other native selectors used by saved scenario automation.

## Tests executed in extracted working tree

| Verification | Result |
|---|---|
| Phase 01 focused suite | 12/12 pass |
| Phase 02 focused suite | 9/9 pass |
| Phase 03 focused suite | 12/12 pass |
| Phase 04 focused suite | 14/14 pass |
| Phase 05 focused suite | 10/10 pass |
| **Phase 06 focused suite** (`node scripts/check-spica-phase06.cjs`) | **7/7 pass** |
| **Combined focused regressions** | **64/64 pass** |
| Strict TypeScript compile of graph, data, professionalism, V2 runtime and 14 blocks | pass |
| Deterministic schema-1 and V2 registries | 26 and 14 verified |
| Syntax parser | 333 TypeScript/TSX source files pass |
| Real `emitTauri` output inspected and TSX syntax-transpiled | pass |
| `npm run check` / full frontend build | **blocked by missing dependencies** |
| Native Rust/Tauri build and real WebView screenshot | **not performed** |

The standalone emitter test asserts the real output includes Material components, Emotion dependencies and nonce-style CSP. This does **not** replace `npm ci`, full `tsc`, Vite packaging or a Windows/Tauri build. For the pending release gate, on a Windows development system with dependencies installed, execute `npm ci`, `npm run check`, `npm run build`, the SPICA suite and a real native export/build/scenario run. Inspect errors and correct them before shipping the app.

## Known boundaries and honest limitations

- The preview on the right is the actual interactive **graph preview**, not the verified native executable, even when the latest native build passed. The Launch Verified button starts the executable separately.
- A preview automatically reflects saved schema-1 graph, program, styles and fields; arbitrary custom JS not in the graph and V2-only UI descriptors cannot yet render as standalone exported applications. V2 lowering/export belongs to a later phase.
- Auxiliary CSV import/review and specialized game renderers are intentionally kept on proven existing paths. New MUI components do not magically restyle unrelated native user-authored code.
- No screenshots of the running full React/WebView application were captured here because frontend dependencies are absent. The provided UI references guide the layout/CSS, but visual perfection requires a real display-level comparison on the user's machine.
- This round makes no changes to llama.cpp inference, agent personalities, Solarium conversations, Sources, game runtime architecture or the users' existing project records.

## Files of note

`src/components/SpicaPreview.tsx`, `src/components/spica/{SpicaLivePreviewPane,SpicaBuildStream,SpicaBuildTimeline}.tsx`, `src/components/SpicaWorkbench.tsx`, `src/views/spica.css`, `src/spica/{data,emit,professionalism,tools}.ts`, `src/spica/target/{SettingsApp,CollectionApp,WorkflowApp,SpicaApp,SpicaUiTheme,settings.css}`, `src/spica/target/ui/`, `src/spica/runtime/blocks/{styling,variables,functions,layout,appearance,interface,ui,professionalism}`, `scripts/check-spica-phase06.cjs`, `tests/spica-phase06.test.cjs`, `package.json`, `package-lock.json`, and the prior phase test fixtures updated to recognize the additional registered modules.

**Next:** Phase 07 — Spark autonomous assembly and repair loop; preserve all Phase 01–06 verification contracts and keep `inspect_params`/preflight/save mandatory for unsafe changes.
