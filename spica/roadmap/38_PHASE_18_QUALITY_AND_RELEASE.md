# Phase 18 — Solarium Platform Quality, Cross-Target Release & Long-Term Support

**Goal:** Deliver a professional, maintainable and trustworthy Solarium with both UI shells, persistent Dona tasks, SPICA apps, Glitch/Code Studio and LeonisMaker integration. Do not ship the next big block count at the expense of reliability.

## Workstreams

### Reliability

- Real GGUF tool selection and multi-cycle test runs for supported 8 GB/12 GB VRAM setups, including context truncation/rolling budgets and task resume after app restart.
- Deterministic integration fixtures for contract inspection → block choice → V2 composition → validation → commit → web/desktop build.
- Trace repeated inspections/no progress, true blockers, permission denial and user cancellation; no fabricated success or silent model answer fallback.
- Backups, migrations, corrupt-state recovery, graph revision safety and source-ownership conflicts.

### UX and accessibility

- Classic remains the default 3DS/Wii U-inspired shell; Cosmic remains opt-in. Both pass keyboard, screen reader, contrast, resizable-window, low-height and reduced-motion tests.
- Eye-switcher and palette picker remain independent. Visual snapshots reviewed against old Classic screenshots and concept-image targets.
- Dream Workbench stays centered inside conversation with correct preview/diff/terminal evidence. UI animations never interfere with editing and testing.

### Security and ecosystem

- Enforce read/write/network/tool permissions, public-web SSRF protections, untrusted extension restrictions, dependency provenance, safe build commands, content-security policy and sandbox boundaries.
- Package signing/checksums, build artifacts with reproducible fingerprints, versioned schema migrations and rollback guides.
- Community publishing remains user-approved; never treat draft descriptions as executable modules.

### Performance

- Measure first launch, switching themes, chat responsiveness during native build, graph rendering at realistic node counts, warehouse search on 350K synthetic entries, web app bundle size and 8/12 GB GGUF memory use.
- Heavy Cosmic effects are opt-in/lazy-loaded and disabled automatically only by explicit performance policy, not randomly.
- Add model inference and task state telemetry locally with clear retention controls; do not exfiltrate workspace content.

### Documentation and distribution

- Update `README.md`, `AGENTS.md`, `spica/roadmap/`, extension developer docs, native Windows installer docs and export guides.
- Define stable user-facing project files, compatible runtime/library versions, UI settings and task checkpoint formats.
- Produce real demos: Notes Organizer (Recents/Markdown), dashboard app, research utility, one 2D LeonisMaker game and one custom Code Studio block.

## Release gate

| Gate | Evidence |
|---|---|
| Full TypeScript/Vite | `npm run check` + `npm run build` succeed in clean install |
| Full tests | All phase suites, unit, integration and UI tests pass |
| Windows desktop | Native Tauri release build, install, run and scenario tests |
| Browser | Independent exported web target passes Playwright flow |
| GGUF | Dona completes a genuinely new app feature with persistent plans and verified code/graph changes |
| Data migration | Old canon project/session/graph/settings fixtures load and persist |
| Dual UI | Classic visual fidelity and Cosmic target references pass manual QA and automated accessibility |
| SPICA export | Supported Graph V2 program runs independently; unsupported block yields explicit error |
| Security | Permission, extension, web-research and source-ownership audits pass |
| Performance | Measured baseline and explicit thresholds on representative target hardware |

A phase or release with blocked native tooling or missing dependencies is **not fully verified**. Document the exact environment limitation and leave it incomplete until the target-specific evidence exists.
