# Cosmic interface — reference design contract (Phase 10 Round C)

These are the **five actual earlier Cosmic concept image references** (concept-1.png through concept-5.png), preserved unchanged alongside this document. They are *not* the old 3DS/Wii U-style Classic design, nor a theme for the Classic channel screen.

Implementation entry points:

- `src/ui-themes/cosmic/cosmic.css` — independent, strictly opt-in CSS skin and responsive SPICA Workbench styling
- `src/ui-themes/cosmic/CosmicTaskTelemetry.tsx` — real task, revision, checkpoint, token, and verification rail (nothing simulated)
- `src/ui-themes/cosmic/assets/nebula-floor.webp` — decorative scenery adapted from the concept color field
- `src/components/Shell.tsx` — the eye toggle, separate from color palette/theme preferences
- `src/views/Chat.tsx` — collapsible left SPICA plan rail, center real conversation/workspace, right read-only evidence rail
- `src/components/SpicaTaskPlanView.tsx` — actual action batch, thought history, failure and saved checkpoint records
- `src/components/SpicaWorkbench.tsx` — unchanged functional Workbench (Cosmic-specific styles override its appearance)

## Visual language

Use a dark midnight-navy and violet starfield, bright cyan illuminated controls, semi-transparent luminous panels, horizontal status rails, purple crystalline scenery, and distinct plan/graph/verification panes. The Classic theme remains the default. Cosmic should never reuse the 3DS-style channel UI as its construction layout.

## Verification boundary

Source and static style rules can be tested here; visual pixel equivalence to the concepts requires running the actual frontend and comparing screenshots at desktop breakpoints. Do not claim a screenshot-matched UI before that comparison.
