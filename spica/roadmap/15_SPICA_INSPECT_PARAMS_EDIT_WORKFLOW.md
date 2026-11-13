# SPICA Spark editing — inspect_params contract and recovery

## Mandatory sequence for graph changes

1. **Read:** call `read_spica_graph` and retain its `revision`, real collection IDs and screen/flow IDs.
2. **Inspect:** call `inspect_params` with the desired `operation` (e.g. `add_record_field`, `put_screen`, `add_page`, `add_setting`). If `available` is false, address `blockers` with appropriate prerequisite operations. Never invent a view or field type.
3. **Compose:** build a proposed `{revision,edits:[...]}` batch, using the exact typed nested payload and existing IDs returned by inspection.
4. **Dry run:** call `validate_spica_edit` with **exactly the same batch**. If `ok:false`, read the `message` and `guidance`, then return to `inspect_params` instead of saving or retrying the identical batch.
5. **Save:** only for `ok:true`, call `edit_spica_graph` using the validated batch at the current revision. User authorization still applies. Record the new revision returned on success.
6. **Export and verify** only when the graph change is saved: `export_spica_app`, `prepare_spica_app` if required, then `verify_spica_app`; do not substitute a simulated console log or conceptual answer for real tool evidence.

**Important:** validation is **read-only** and **not a transaction lock**. A revision may change between preflight and save; a stale graph must be read and revalidated.

## Actual supported record data types

`text`, `boolean`, `number`, `choice`, `reference`.

There is **no** `date` or `string_array` field type in schema 1. Dates can be stored as validated text for now; true date/list types need new explicit block contracts in a later phase. Never pretend implicit conversions exist.

## Actual supported screen views

`list`, `form`, `review`, `table`, `models`, `game`.

There is **no** `settings` view. Settings use the existing preferences graph via `add_page`, then `add_setting` (or the supported update/removal operations).

## Working example: add a record field

After an inspection finds collection `notes` with no `archived` field and revision 10:

```json
{"revision":10,"edits":[{"op":"add_record_field","collection":"notes","field":{"key":"archived","label":"Archived","type":"boolean","initial":false}}]}
```

Pass that object to `validate_spica_edit` before passing it to `edit_spica_graph`. Do not assume revision 10 or `notes` in other projects; use the actual inspection output. Creating a collection uses a full object in `collection`, whereas adding a field uses the existing collection ID string.

## Working example: notes list with initial query

```json
{"revision":10,"edits":[{"op":"put_screen","screen":{"id":"notes_search","label":"Search notes","view":"list","collection":"notes","query":""}}]}
```

A form uses `fields:["title","body"]` with exact **existing field keys**, and a `submit` referencing an existing flow. Never put definitions in a screen's field array.

## Working example: a settings page (one atomic batch)

```json
{"revision":10,"edits":[{"op":"add_page","id":"preferences","label":"Preferences"},{"op":"add_setting","page":"preferences","key":"show_tips","label":"Show tips","type":"boolean","initial":true}]}
```

The identifiers must be new; use the inspector's current page/setting list to avoid duplicates. Dry-run the complete batch together.

## Error handling and safe recovery

- `INVALID_ARGUMENTS`: the call does not meet the advertised tool schema. Inspect the specific operation, then fix the malformed keys/types.
- `INVALID_GRAPH_EDIT`: the arguments may be syntactically shaped but violate project rules (duplicates, bad references, broken flow, unsupported config). Inspect live IDs and preflight again.
- `STALE_GRAPH`: another operation changed the revision. Re-read and revalidate.
- `available:false`: a prerequisite is absent. Do not submit the example (which is `null`); create the missing prerequisite first.
- Repeated identical rejected edits are not progress. The Spark should change strategy or report an actual blocker with the failed operation and evidence.

## Source interfaces

`inspectSpicaParameters` (`src/spica/inspect-params.ts`); `spicaToolContract`, `normalizeSpicaProposal`, `reviewSpicaEdit`, `selectSpicaTools`, `executeSpicaTool` (`src/spica/tools.ts`); `validateToolArguments` (`src/engine/intelligence/tool-validation.ts`); `changeGraph` (`src/spica/graph.ts`).
