# Phase 09 hotfix — Registry startup with stale V2 block copies

## Symptom

`SPICA registry: Exactly one default defineSpicaBlock({...}) required: data-records/storage/record-read.ts`

The schema-1 registry expects `defineSpicaBlock`; the reported `record-read.ts` is
actually an executable Graph V2 block (`defineRuntimeBlock`). The Phase 09 canonical
file is located at `src/spica/runtime/blocks/data-records/runtime/storage/record-read.ts`.
An old copy under `data-records/storage` can remain when users extract a new
source archive over an earlier phase without deleting removed files.

## Fix

1. `scripts/clean-spica-misplaced-runtime-blocks.cjs` checks misplaced V2 block
   files and compares their semantic TypeScript AST **and resolved imports** with
   their canonical copies. Byte-identical content is not required because the
   relative imports change when the directory depth changes.
2. It removes only proven duplicates. Unique or divergent implementations cause
   a clear error without deletion. A `--check` mode makes no modifications.
3. `package.json` automatically executes this migration before `npm run dev`,
   `npm run build`, and `npm run check` (and therefore before Tauri's normal dev
   command if that command uses `npm run dev`).
4. The schema-1 registry reports a misplaced V2 block with an explicit
   remediation command instead of the confusing generic `defineSpicaBlock` error.
5. `tests/spica-stale-runtime-cleanup.test.cjs` covers automatic safe removal,
   non-destructive check, divergent sources, missing canonical source, and
   legitimate schema-1 blocks.

## Useful commands

- `npm run spica:runtime:cleanup` — verify and remove only matching old copies.
- `npm run spica:runtime:cleanup:check` — verify no old copies remain, no changes.
- `npm run spica:registry:check` — validate 26 legacy metadata modules.
- `npm run spica:runtime:registry:check` — validate 103 executable V2 modules.
- `node --test tests/spica-stale-runtime-cleanup.test.cjs` — run focused tests.

This fix does not change SPICA runtime block IDs, existing graph data, generated
registry metadata, nor the standalone emitters. It is a source migration and
startup-check repair.


**Follow-up:** The first cleanup missed flat category files such as `data-records/save-note.ts`. See [25_PHASE09_FLAT_BLOCK_STARTUP_FIX.md](25_PHASE09_FLAT_BLOCK_STARTUP_FIX.md) for the corrected scanner and archive-overlay verification.
