# Solarium 0.1 — Blank Window / Activity Panel Fix

## Symptoms

After clicking **Allow once** for a local tool, Solarium may display an entirely blank dark window. Re-entering that conversation or restarting Solarium can reproduce it.

## Root cause

`src/views/Chat.tsx` rendered `ActivityPanel` whenever `workspace.preferences.showActivity` was true. A successful tool operation sets `showActivity = true` while persisting an activity event.

`ActivityPanel` then subscribed with a Zustand selector that called `.filter(...)` directly:

`useSolarium((s) => (s.workspace.workEvents ?? []).filter(...))`

`filter()` always produces a fresh array, even when the store has not changed. With Zustand 5 and React `useSyncExternalStore`, that unstable snapshot identity can produce an endless rerender and crash the React view. Because the `showActivity` setting is saved, re-opening a conversation also mounts the faulty panel.

## Changes

- `src/views/Chat.tsx`: Subscribe to the stable stored array and the active session ID separately, then filter the results with `useMemo()`.
- `src/components/RenderErrorBoundary.tsx`: Add a view-level render error boundary so future uncaught render errors display an actionable diagnostic instead of an empty app window.
- `src/main.tsx`: Wrap the existing Shell with the error boundary. **Close activity and retry** sets `showActivity` to false without deleting saved conversation messages or tool history; **Return Home** navigates back to the launcher.
- `tests/blank-screen-regression.test.cjs`: Verify the selector is no longer creating arrays in the subscription, the persisted Activity setting/history remain intact, and the recovery UI is wired.

## Installation

1. Close Solarium.
2. Back up the existing project.
3. Extract the patch ZIP into the Solarium project root, replacing existing files and preserving the `src/` and `tests/` paths.
4. Run `npm test`, `npm run check`, `npm run lint`, and `npm run build` using your existing dependencies, followed by `npm run desktop:dev`.
5. Reopen the same conversation and toggle **Activity**, then use an action requiring **Allow once** to verify the panel remains responsive.

No database reset or conversation deletion is necessary.

## Verification in this environment

- Automated tests: 130/130 passed.
- TS/TSX syntax parsing: passed (as part of npm test).
- Full typecheck/build: unavailable because npm dependencies are missing in the current environment.
- ESLint: unavailable (`eslint` not installed).
- Native Windows/Tauri GUI verification: not performed. The regression pinpoints the faulty subscription, but the patch should be validated in your running Windows application.
