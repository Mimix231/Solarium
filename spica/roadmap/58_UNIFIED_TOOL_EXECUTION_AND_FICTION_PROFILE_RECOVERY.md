# Solarium — unified tool execution and fiction-profile recovery

**Source checkpoint:** Solarium[Bak](3).zip, supplied 22 November 2026.  This is a
source-code repair, not a report of a successful live GGUF/Tauri run.

## Failures addressed

Kestrel's fanfiction workflow forced a single `save_fiction_profiles` invocation
with a potentially large cast. The advertised schema did not require a `story`
when no Story World existed even though the executor needed enough information
to create one. Successful saves consumed the same three-attempt allowance used
for failures; an unsuccessful batch could silently let the run move into chapter
authoring with unsaved requested profiles. Separately, non-SPICA agent dispatch
could validate proposed calls against the entire registry rather than the
actual per-turn advertised tool set. These problems make malformed model calls
especially costly for constrained local models.

## Changes

- `src/engine/intelligence/fiction-profile-contract.ts`: project the canonical
  save contract to the current stage, requiring user-grounded `story.title`
  and `story.franchise` only for an unselected Story World and limiting each
  model-generated batch to **one or two character profiles**. The canonical
  underlying repository and permission checks are not replaced.
- `src/engine/agent.ts`: persist remaining cast across successful batches;
  reset the consecutive failure count only when one of the **requested**
  characters is confirmed. A repository response with no matching saved cast
  entry counts as a no-progress attempt, and three such attempts block the task. After three rejected/unsuccessful profile proposals, or an explicit
  denial, leave a requested chapter **blocked and resumable** with its actual
  diagnostic instead of silently claiming that preparation succeeded.
- `src/engine/intelligence/tool-arguments.ts`: decode unambiguous argument
  transport wrappers (a complete JSON fence, a JSON-encoded string, or a single
  `arguments` envelope), and omit `null` for known optional, non-nullable fields.
  Required facts, unknown keys, nested values, user text, and explicitly
  nullable fields are not inferred or silently modified.
- `src/engine/intelligence/tool-contract-intelligence.ts`: use one
  `ToolArgumentResolver` / `ToolCallValidator` /
  `ToolExecutionCoordinator.review()` path. The **exact contracts offered to
  the model on this turn** are those used for dispatch validation. A recently
  rejected, actually offered tool may be re-advertised for one corrected
  proposal only while it remains registered and permitted. Its exact originally
  advertised scoped schema is retained rather than broadened to the registry; no call is retried
  automatically.
- `src/engine/intelligence/tool-recovery.ts`: return contract-specific and
  categorized execution diagnostics. Permission denials are never retried,
  and unrelated schema changes cannot bypass a missing permission.
- `src/engine/agent.ts`: streaming preview and final proposed-file previews
  use the already validated execution arguments, not a potentially wrapped
  raw tool argument string.
- `src/components/WorkLog.tsx` and `src/themes/foundation.css`: display a
  condensed last failure reason for failed operations while preserving the
  full recorded tool result under details.
- `tests/tool-execution-reliability.test.cjs`: exercises contract staging,
  transport parsing, strict rejection, permission-preserving correction,
  failure recovery, and source dispatch invariants.

## Required invariants

1. A model may **request** an action; it never grants its own authorization.
2. The native handler and actual repository outputs alone establish whether
   an operation succeeded; no preflight or UI preview may claim it did.
3. No normalization invents character identity, canon facts, world IDs,
   franchise names, file paths, graph revisions, source evidence, or text.
4. Tool call proposals are validated against the offered declaration, not a
   larger shadow registry or a looser union.
5. Consecutive errors must preserve their actual diagnostic; a denied or
   blocked operation must not be described as a successful chapter save.
6. Do not restart llama.cpp after fixed token windows, add inference models,
   bypass Ask/Auto/YOLO, or overwrite existing Story World records.

## Checks

**Passed in this environment:**

- `npm run test:tool:reliability` (16 tests, 0 failures).
- `node scripts/check-syntax.cjs` (534 TS/TSX files parsed).
- SPICA registries: 26 metadata modules, 35 categories, 176 executable V2
  runtime blocks; cleanup manifest checks passed.
- Standalone SPICA phase 01, 02, 08 checks passed.

**Not verified, and therefore not described as passed:**

- Full `npm run check`, `npm run lint`, frontend Vite build and full
  `npm test`: npm package installation cannot complete because external
  registry requests fail in this environment, leaving missing modules and
  typings. The partial type-check failures are not proof of code regressions.
- Native Tauri build and interactive end-to-end run against a real local GGUF
  and Windows Story World storage.
- Python project LSP suite's three errors: its Windows `typescript-language-server.cmd`
  fixture is absent because `node_modules` could not be installed. Seven
  Python tests pass and one is skipped; these three are not repaired by
  changing Windows runtime paths on a Linux host.

## Release acceptance on a Windows project checkout

1. Run `npm ci` with network/package registry access.
2. Run `npm run test:tool:reliability`, `npm run check`, `npm run lint`,
   `npm run test`, and `npm run build`; fix any new source-level diagnostics.
3. With a real GGUF, request a chapter with a **new** recognizable franchise
   and a large requested cast. Confirm that the first profile save requires
   actual `story.title` and `story.franchise`, and each profile batch saves at
   most two characters. Confirm no profile names remain pending before draft.
4. Repeat with an existing Story World; its current identity must be preserved
   and a new story object must not be required.
5. Simulate malformed but unambiguous JSON transport, missing `story`, unknown
   tool names, schema violations, permission denial, server errors, and resumed
   saves. Confirm that no prohibited operation executes and the Work Log
   records accurate causes.
6. Verify chapter document revision, target length, completion status, user
   character claims and citations, and normal source permissions.

The existing `dist/` in the ZIP is the **original pre-repair build**. It is
included for source fidelity but must be rebuilt on a machine with the full
dependencies before treating it as updated release output. Literary style,
character voice and scene pacing are separate planned fiction-layer work and
were not rewritten in this tool reliability repair.
