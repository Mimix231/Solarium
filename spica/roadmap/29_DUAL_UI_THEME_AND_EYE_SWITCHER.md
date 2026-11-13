# Dual UI Themes — Eye Switcher Architecture

## User requirement

The current Solarium UI is intentionally familiar, compact and reminiscent of a Nintendo 3DS/Wii U system UI. It remains **Classic** and **default**. A second opt-in layout, **Cosmic**, applies the five new concept images' visual direction. The **eye button** is the entry point for switching between these **interface layouts**, not replacing the existing color palette picker.

## Existing implementation confirmed from Phase 9.5

- `src/components/ThemePicker.tsx` currently uses `PaletteRounded` to choose color theme IDs from `src/themes/registry.ts`.
- `src/components/Shell.tsx` already renders `ThemePicker` in the title bar and exposes a distinct `workspaceMode` (Companion/Workspace) toggle.
- `src/main.tsx` constructs MUI themes via `createSolariumTheme(theme, density)` and writes datasets for `theme`, `density`, `motion`, `workspace`.
- `src/domain/types.ts::Preferences` has `theme`, `density`, `reducedMotion`, `workspaceMode` and other persisted fields; `src/domain/defaults.ts` defines default preferences; `useSolarium.updatePreferences()` is already the normal update path.

## Proposed data contract

Do NOT overload `theme` or `workspaceMode`.

```ts
export type UiLayoutTheme = 'classic' | 'cosmic';

export interface Preferences {
  // Existing properties retained unchanged.
  uiLayoutTheme?: UiLayoutTheme;
}
```

`defaultWorkspace().preferences.uiLayoutTheme = 'classic'`. When loading older saved data, a missing or invalid `uiLayoutTheme` resolves to `'classic'` in a version-aware parser/migration. Do **not** change the existing `Workspace.schemaVersion` without a real migration plan. Never reset `theme`, `density`, `workspaceMode`, `sidebarOpen`, session selection or project state just to switch layouts.

## UI implementation contracts

- New `src/components/UiThemeSwitcher.tsx`: `VisibilityOutlined` / `VisibilityRounded` (`@mui/icons-material`) triggers an accessible MUI `Menu` or `Popover` with two layout previews and radio-like selection. Label: `UI Themes`.
- Add alongside, **not instead of**, `<ThemePicker />` in `src/components/Shell.tsx` title bar.
- `src/main.tsx`: set `document.documentElement.dataset.uiLayoutTheme = uiLayoutTheme ?? 'classic'` and provide an effective layout preference to shell composition. Avoid adding a `key` that remounts `Chat` or ongoing work.
- `src/themes/ui-layout/classic.css` and `cosmic.css` (or dedicated styles modules) control layout structure; `src/themes/registry.ts` stays the palette registry. Use CSS variables/MUI theme values for colors and typography; don't hardcode a purple-only scheme across all palette choices.
- `Shell` may render `ClassicShellLayout` and `CosmicShellLayout` with shared subcomponents, but must keep the active Chat and agent state outside remount-prone layout boundaries. More conservative first step: one shared Shell DOM with layout-driven CSS before doing component extraction.
- Keep title bar native drag targets (`data-tauri-drag-region`), Windows controls, app close behavior and keyboard focus intact.

## Behavioral specification

| Behavior | Classic | Cosmic |
|---|---|---|
| Default on first launch | Yes | No |
| Current nav rail & chat | Preserve | Same destinations, rearranged visually |
| Palette themes | Existing palette menu | Same palette menu |
| Companion/Workspace mode | Existing toggle | Same toggle |
| Current chat or project | Unchanged | Unchanged |
| In-flight build plan & model execution | Persist | Persist |
| SPICA Workbench | Centered overlay | Centered overlay |
| Accessibility | Full keyboard/screen reader/reduced motion | Same standards |
| Narrow window | Existing compact layout | Collapse optional context panels first |

## Eye-switcher interaction

1. User clicks or keyboard-opens the **eye icon** at top right, beside the palette picker.
2. A small popover shows `Classic — 3DS / Wii U` and `Cosmic — Concept` with preview thumbnails, descriptions, and selection marker.
3. Selection immediately persists to existing preference repository; provide an `aria-live` confirmation if appropriate.
4. The chat text, active Spark, project, selected graph, build plan, context checkpoint and in-flight verification state remain unchanged.
5. Reloading Solarium restores the last explicitly chosen layout; if config is old or malformed, fall back to Classic with a logged migration.
6. Optional: a user-controlled `Reset UI layout to Classic` action in Settings (no hard reset of data).

## Acceptance tests

- Fresh workspace and old persisted workspace both render Classic by default.
- Switch Classic → Cosmic → Classic during chat and during an active SPICA task; no lost messages, graph revision changes, duplicate model calls or reset plan.
- Changing palette while Cosmic is selected does not change the layout; selecting Classic does not overwrite the chosen palette.
- `workspaceMode`, density and reduced-motion continue to work in both layouts.
- Check accessibility: tooltip, keyboard focus, Escape closing menu, visible selected state, MUI `aria` labels, contrast, high DPI and short-height windows.
- Test at 320, 768, 1280 and 1920px as applicable to supported desktop window sizes; no horizontal overflow or unusable controls.
- Run `npm run check`, UI tests and Tauri smoke checks when dependencies/toolchain are installed.

## Scope boundary

This is a **layout theme**, not a new app builder and not a block-warehouse visual theme. Application-generated UI themes continue through SPICA's target renderer contracts and remain separate from the Solarium host layout preference.
