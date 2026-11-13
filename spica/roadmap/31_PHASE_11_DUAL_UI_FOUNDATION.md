# Phase 11 — Dual UI Shell, Eye Button, Safe Theme Switching

**Goal:** Preserve the current Solarium visual identity as **Classic** (the default 3DS/Wii U-inspired UI), while introducing an opt-in **Cosmic** interface skeleton driven by the five concept images. Theme switching must not restart Dona, lose work or alter theme colors.

## User experience

- Add the **eye icon** to `src/components/Shell.tsx` beside the existing palette picker (`ThemePicker.tsx`); tooltip `UI Themes`.
- Click opens `UiThemeSwitcher` showing **Classic — 3DS/Wii U** and **Cosmic — Concept** with previews and selected state.
- Keep existing color themes/`ThemePicker` and `workspaceMode` (`companion`/`workspace`) independent. The new property `Preferences.uiLayoutTheme: 'classic' | 'cosmic'` is strictly for the shell/layout family.
- Default to Classic when new or old workspace data has no preference; Cosmic requires explicit user selection.
- Support switching back immediately with the same eye menu. Optional Settings entry may expose the same choice, never a second preference source.

## Code-level work order

1. Inspect persisted preference schema in `src/domain/types.ts`, `src/domain/defaults.ts`, `src/data/repository.ts`, and `src/state/useSolarium.ts`. Introduce version-safe defaulting; do not force-clear old saved workspaces.
2. Implement `src/components/UiThemeSwitcher.tsx` using MUI `IconButton`, `Menu`/`Popover`, preview card, radio semantics, `VisibilityOutlined` and `Tooltip`.
3. Thread `uiLayoutTheme` through `src/main.tsx`, set a distinct root dataset, and create layout-specific CSS modules. Avoid key-based remounting of the Chat tree or destructive Shell replacement.
4. Factor common rail, project sidebar, title bar, window controls and active-session content into shared components as needed; the two themes are **compositions**, not disconnected app implementations.
5. In Cosmic, first ship a restrained shell: contextual right panel placeholder with real state only, wider content column and panel boundaries; more demanding effects arrive in Phase 12.
6. Preserve native title bar dragging, close/minimize/maximize controls, keyboard shortcuts, focus and responsive sidebar interactions.

## Migration and safety

- Add no new top-level `spica` route. Every existing route continues working.
- Keep the same Zustand store and Tauri repository; only the layout DOM/CSS changes.
- Store `uiLayoutTheme` as a user preference, not in graph metadata or Spark persona.
- If a Cosmic-only panel fails to render, retain the task state and let user switch to Classic; report the error rather than silently resetting preferences.

## Acceptance tests

- Existing workspace starts Classic, with existing palette selected.
- Cosmic selected, app restarted: Cosmic returns; project, chat history and task plan preserved.
- Change palette or `workspaceMode` independently in both layouts.
- Toggle during active streaming model output, a running SPICA build and open project; task remains uninterrupted.
- Eye menu keyboard/ARIA, reduced motion and window geometry pass UI tests.
- Take screenshots in both layouts at short desktop heights and narrow widths; Classic must look materially unchanged.

## Packages

Use existing MUI, Emotion and Zustand; no mandatory new dependency to implement the switcher. Phase 12 introduces selected optional visualization libraries. Do not install 25 libraries just to render a two-choice menu.
