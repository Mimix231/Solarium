# Visual Reference Mapping — Five Generated Solarium Concepts

The user's five generated concepts from 2026-11-12 are **design targets**, not screenshots of implemented code. Keep the current Solarium screenshot as the canonical **Classic** reference.

## Reference A — Compact SPICA Build Plan

- **Visible:** glowing glass plan card with completed/current/pending stages, progress line, composer beneath.
- **Implement in:** Phase 10 task model and plan chip; Phase 12 visual styling.
- **Modules:** `TaskPlanView`, `PlanStepItem`, `PlanProgress`, composer insertion in `src/views/Chat.tsx`.
- **Evidence rule:** stage status comes from validated task state; estimated time may be omitted unless derived from real measurements.

## Reference B — Conversation + Context Dashboard

- **Visible:** left navigation, Dona chat, build plan, right context/model card, compact task progress and composer.
- **Implement in:** Phase 11 shell switch; Phase 12 Cosmic layout; Phase 10 data providers.
- **Modules:** `UiThemeSwitcher`, `CosmicContextRail`, `ContextBudgetBar`, `TaskProgressCard`, shared title bar/navigation.
- **Layout rule:** right column collapses on smaller windows; no separate SPICA top-level tab.

## Reference C — Agent Console and Verified Work

- **Visible:** chat, multi-stage build, execution log, graph revision, files changed, task status, token budget.
- **Implement in:** Phase 10 orchestration; Phase 12 panels; Phase 13 build stream.
- **Evidence rule:** graph revisions/files/tests must come from real repositories/commands, not Dona's chat explanation.

## Reference D — Rolling LLM Context Orchestration

- **Visible:** cycle cards, checkpoint, 4,096-token example budget, plan state, task continuation and orchestration settings.
- **Implement in:** Phase 10 infrastructure and Phase 12 Cosmic presentation.
- **Architectural caveat:** a cycle is a new context assembly, not unlimited model memory. Model context and reserved output tokens impose hard limits.

## Reference E — Dream Workbench with Graph & App Preview

- **Visible:** graph canvas with connected nodes, build-plan sidebar, live preview, verification and log panels, budget state.
- **Implement in:** Phase 13 centered dialog; Phase 14 independent executable Graph V2 target.
- **Layout rule:** **overlay in the conversation workflow**, not a mandatory new standalone Workbench page. Support Classic styling as well as Cosmic.

## Visual acceptance

- Compare screenshots at supported desktop sizes to these five references; accept deliberate content differences but preserve hierarchy, spacing, glass layering, distinct status and focus.
- Enforce accessibility, contrast and reduced motion; don't chase decorative fidelity at the expense of lag, readability or tool execution.
- Keep the color `ThemePicker` separate from the eye-button `UI Themes` selector. Classic remains default.
