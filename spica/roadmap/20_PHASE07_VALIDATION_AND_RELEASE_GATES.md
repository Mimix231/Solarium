# Phase 07 — Validation Evidence and Unverified Gates

Run date: 2026-11-12.

| Test | Verified output |
|---|---|
| Phase 01 focused regression | 12/12 passed |
| Phase 02 focused regression | 9/9 passed |
| Phase 03 focused regression | 12/12 passed |
| Phase 04 focused regression | 14/14 passed |
| Phase 05 focused regression | 10/10 passed |
| Phase 06 focused regression | 7/7 passed |
| Phase 07 focused regression | 12/12 passed (includes 5 direct Spark tool-handler tests) |
| **Total focused cases** | **77/77 passed** |
| Legacy registry reproducibility | 26 source modules across 35 categories |
| Executable V2 registry reproducibility | 103 source-defined adapters |
| TypeScript/TSX syntax parsing | 427 source files parsed |
| Targeted Phase 07 strict TypeScript | Passed for V2 runtime, schema, composition, intent, and tool-intelligence modules |

## Not verified here

- **Full frontend TypeScript:** `npx --no-install tsc --noEmit` is blocked by missing `vite/client` type definitions (the frontend `node_modules` installation is absent). Thus, syntax passing is not proof that every new React/MUI import type-checks.
- **Vite production build:** Not run successfully because frontend packages are missing.
- **Native Tauri/Rust compilation and Windows launch:** No successful evidence from this environment.
- **Live GGUF Spark tool choice:** Unit/integration tests confirm tool definitions and read-only preflight work; not evidence that any chosen model always follows them.
- **Arbitrary V2 native target export:** Not implemented by this phase; the V2 viewer displays isolated block descriptors and Graph V1 has the existing standalone export.

A passing preflight does not count as a successful file write, graph save, native build, or application acceptance test. Re-run all release gates with the actual Windows toolchain before calling the build release-ready.
