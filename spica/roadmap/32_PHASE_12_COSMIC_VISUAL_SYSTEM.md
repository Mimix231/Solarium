# Phase 12 — Cosmic UI Layout & Visual Design System

**Goal:** Translate the concept images into a polished **second Solarium layout**—not a separate product. Cosmetic changes must not undermine readable content, app performance, or Classic behavior.

## Design language

- Deep navy surfaces with teal/cyan highlights, subtle violet lighting; source all colors from palette-aware tokens rather than universal hardcoded purple.
- Semi-transparent glass cards with **subtle** blur and layered borders; constrain large blur surfaces and avoid excessive GPU work.
- Rounded but structured panels, soft shadows, fine-line separators, hover/focus states, precise typography; luminous accent sparingly for task status.
- Animated stage transitions via `motion` only where useful; honor `prefers-reduced-motion` and existing user preference.
- Lightweight optional particles/3D scene can be loaded only on Cosmic Home/Workbench with explicit performance setting; default UI does not require WebGL.

## Main screen mapping

1. **Top bar**: Solarium identity, current project, eye-button/palette, model, active build state, native window controls.
2. **Left rail**: current real navigation destinations (chat, projects, code, Sparks, etc.) unchanged semantically; only styled to match concepts.
3. **Primary conversation column**: Dona chat, inline evidence, compact build-plan banner above composer, persistent source/history affordances.
4. **Optional right context column**: model/cycle budget, checkpoints, task status, graph revision, verified progress—no fake progress; collapses at narrow widths.
5. **Bottom composer**: retains attachments, tool modes, project selection and keyboard behavior, with animated outer focus and progress indicators.
6. **Dream Workbench**: remains one **centered overlay** above conversation; detailed workbench redesign deferred to Phase 13.

## Components and proposed files

`src/components/cosmic/CosmicShell.tsx`, `CosmicContextRail.tsx`, `BuildPlanSummary.tsx`, `VerifiedProgressCard.tsx`, `AgentContextMeter.tsx`, `CosmicSurface.tsx`, `CosmicBackdrop.tsx` plus `src/themes/ui-layout/cosmic.css`. Components use the canonical project/task store, never second copies of state. Prefer extracting general-purpose `GlassPanel`, `AccentBorder`, `TaskStep`, `StatusChip` primitives shared by several pages.

## Implementation order

1. Tokenize existing Classic typography, spacing, radius, color, border, shadows, and status palette, then define Cosmic overrides.
2. Build responsive grid (`chat + context rail`, breakpoint-driven stacking, safe min widths), resize behavior and keyboard navigation.
3. Implement Plan and Context UI using Phase 10 task snapshots; do not animate values with fake sampling.
4. Add transitions and motion; check for reduced motion and low-power preference.
5. Add optional ambient layer or 3D effects **only after** the core layout passes functionality/performance tests.
6. Compare actual screenshots against the supplied images across multiple densities, palette modes and window sizes.

## Suggested packages (only after version compatibility checks)

- Main: `motion`, `react-resizable-panels`, `@tanstack/react-virtual`, `recharts`, `culori`.
- Optional atmospheric effects: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, or `@tsparticles/react`/engine/slim; keep them dynamically imported.
- Existing: MUI, Emotion, `lucide-react`, Zustand, xterm, Monaco.
- Do not install both multiple drag-and-drop systems or multiple motion frameworks without a specific use. Treat the earlier proposed 25-package shopping list as a menu, not a requirement.

## Acceptance tests

- Classic pixel layout remains effectively unchanged except intentional shared fixes.
- Cosmic layout visually matches concepts, shows real task data and correct model state, and does not replace chat with a separate app page.
- No horizontal overflow; keyboard-only navigation; color contrast; reduced motion.
- 60 fps target for ordinary interactions on supported desktop hardware; profile animated contexts and disable heavy effects in performance mode rather than promising a fixed frame rate everywhere.
- Toggling themes mid-build preserves task and editor state and does not duplicate model inference.
