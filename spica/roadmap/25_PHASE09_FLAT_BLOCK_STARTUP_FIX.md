# SPICA Phase 09 — Flat executable block startup hotfix

## Why `data-records/save-note.ts` stopped Tauri startup

The canonical Phase 09 layout puts executable V2 blocks in
`src/spica/runtime/blocks/<category>/runtime/<family>/`. The older Phase 04–08
archives also contained executable V2 modules directly under a category (e.g.
`data-records/save-note.ts`) or one family beneath it (e.g.
`ui/components/ui-markdown-editor.ts`). Extracting a ZIP over an older source
folder does **not** remove files that the newer archive no longer includes.

The previous startup cleanup only scanned **subdirectories of each category**;
it silently missed files directly under a category. As a result it could print
`0 old runtime copies removed` while `generate-spica-registry.cjs` subsequently
failed with `Expected category/subcategory/file: data-records/save-note.ts`.

## Fix and safety contract

The existing predev/prebuild/precheck cleanup hook now:

1. Indexes all canonical `defineRuntimeBlock` implementations under the
   `category/runtime/` trees by their **static block ID**.
2. Scans both **direct files** and nested files beneath category folders,
   excluding the canonical `runtime/` subfolders.
3. Recognizes misplaced V2 blocks and matches each to a canonical ID, even if
   the category name changed during the merge.
4. Compares parsed executable statements and **resolved import targets** to
   ensure the old file is the same implementation with only path changes.
5. **Validates every candidate before deleting any file.** Unique or modified
   sources are preserved and reported for manual review, never silently lost.
6. Removes verified duplicates, prunes empty obsolete subfolders, and allows
   the existing 26-block legacy registry to continue.

All 103 stale executable source paths from the original Phase 08 layout were
reproduced on top of the Phase 09 source. Cleanup verified and removed all 103,
then both registries and the syntax checker passed. Additional tests used old
Phase 04 (6 copies), Phase 05 (6), Phase 06 (14), and Phase 07 (103) layouts.

## Validation performed

- 95/95 focused tests across phase suites 01–09 passed in this environment.
- 8/8 stale-runtime cleanup tests passed, including a direct-file `save-note.ts`
  regression, divergent-content protection, and category rename handling.
- 26 schema-1 legacy and 103 V2 executable blocks verified.
- 429 TypeScript/TSX files parsed without syntax errors.
- Existing `npm run predev` ran the repaired cleanup and the legacy registry
  successfully. It then stopped at the **frontend dependency precheck** because
  the archive does not bundle `node_modules`. Therefore a complete Vite/Tauri
  build is **not claimed** here.

## Use

After extracting the fixed ZIP over an existing source tree, run `npm run dev`
(or your usual Tauri dev command). The existing `predev` script invokes the
cleanup before the registry check.

For diagnostics, run:

- `npm run spica:runtime:cleanup` — remove only verified duplicates.
- `npm run spica:runtime:cleanup:check` — read-only validation of old paths.
- `npm run spica:registry:check` — legacy registry validation.
- `npm run spica:runtime:registry:check` — V2 registry validation.
- `node --test tests/spica-stale-runtime-cleanup.test.cjs` — cleanup tests.

If a source file was genuinely modified or unique, the script intentionally
stops with a specific comparison error rather than destroying changes. This
requires a manual merge of the affected file.
