# Construction continuity and functional composition — November 17, 2026

## Problem and implementation plan

The Spark repeatedly inspected unchanged contracts or selected source tools
without keeping enough observed data to construct the next operation. Successful
preflights could be displaced by another read, and a source read sent the next
turn back through graph discovery. An app domain also implicitly selected an
existing starter. These behaviors encouraged repeating a recipe instead of
implementing the user's actual feature request.

This increment implements the following connected work:

1. Carry exact successful preflight arguments and current inspected data into
   the next natural inference turn; retain original results in the scoped archive.
2. Keep permissioned source construction and repair available after the Spark
   chooses it. Offer the existing feature/file planner for full applications.
   Keep graph construction and source construction as real model choices.
3. Make starter recipes explicit opt-ins. Remove the obsolete, unreferenced
   `agent-build.ts` direct-template fallback left by older overlay installations.
4. Add generic functional blocks and reusable style wrappers, each with one
   canonical implementation and registry-derived discovery contracts.
5. Verify transactions, continuation evidence, permissions and task recovery,
   then exercise the ordinary native chat with the local model. The acceptance
   harness must not supply the requested app implementation or a construction
   recipe to the model.

## New executable blocks

All identifiers below have the `spica.runtime.` prefix. There are now **176**
registered executable implementations; registry entries are not a claim that
every authored graph has a standalone compiler.

| Block | Function |
| --- | --- |
| `record_patch_on_event` | Merge changed fields into an existing record in the permissioned transaction; preserve other fields. |
| `record_delete_on_event` | Delete the selected record only on an explicitly delivered event. |
| `array_sort` | Stable ascending/descending sorting of primitives or a record field, with numeric order and missing values last. |
| `array_group_by` | Scalar-key grouping with original items and counts. |
| `date_localize` | Explicit locale/timezone date presentation. |
| `ui_number_input` | Labelled numeric editing with minimum, maximum and step. |
| `ui_date_input` | Calendar date input with a bounded host event. |
| `ui_typed_form` | Labelled text, multiline, numeric, boolean, choice and date fields with typed JSON submission. |
| `styled_surface` | Validated colors, spacing, radius, font family and elevation around an actual UI subtree. |
| `interactive_surface` | Reusable hover/press presentation with reduced-motion support. |

Existing checkbox, select and tabs blocks now support validated event bindings.
Their existing port contracts remain compatible. The shared block preview
renders the controls and surface wrappers and routes real interactions through
the existing event bridge. Its default execution has no storage grants.
Event-gated patch/delete require the already-authorized transactional store and
`records.read`/`records.write` grants. Unconditional effects remain excluded
from automatic preview.

## Execution and memory contract

`selectSpicaTools` retains the exact approved operation across intervening
read-only calls. The coordinator prioritizes it before source paging. Actual
execution still requires matching arguments, current revision, graph validation
and permission. Unrelated successful reads do not erase a failed diagnostic.

The source route uses actual registered Solarium tools; it does not implement a
new shell, tool alias or hidden repair loop. The model chooses the files and
feature plan, performs each edit, reads diagnostics and requests the next check.
Native source results determine progress. The existing AppBuilder checks remain
responsible for unfinished source work packages, hashes, checks and duplication.

The onion-skin handoff contains observed action evidence and the saved goal,
not previous private reasoning. The native stream remains uncapped, with a
4,096 soft input target between genuine tool turns. It does not provide infinite
context or guarantee a particular GGUF model's competence.

Live checking also found that `withLocalWork` dropped the original Pause reason.
It now forwards that reason, and Resume cannot revive an older unfinished task
behind the most recent cancelled or completed request.

## Compatibility and validation

Canonical block root: `src/spica/runtime/blocks/`. Both checked manifests and
stale-source cleanup checks are required. Older phase runners now resolve the
installed TypeScript executable through Node on Windows. Legacy tests were
updated for the existing explicit-preflight and explicit-web-fallback contracts;
neither authorization nor failed-result validation was weakened.

Focused tests cover exact proposal carryover, source-route continuity, diagnostic
retention, sorting/grouping, record patch/delete gates and rollback, form/style
validation, Pause reason propagation and latest-goal Resume selection. Run the
full `npm test`, Phase 01–10 suites, contract audit, registry/cleanup checks,
`npm run check`, `npm run lint` and `npm run build` before delivery.

Native acceptance uses `npm run tauri dev` with the normal profile and existing
Notes Organizer conversation. Its source was backed up before testing. Real
model outcomes and incomplete acceptance must be reported separately from
source-level tests.

Arbitrary V2 standalone export remains an explicit compiler gap. The target
lowerer still rejects unsupported authored V2 graphs; a passed runtime preview
does not claim native deployment. Native source construction provides an actual
alternative for functionality that the current graph exporter cannot express.
