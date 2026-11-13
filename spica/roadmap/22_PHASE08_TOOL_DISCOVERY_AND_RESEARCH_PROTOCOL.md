# Phase 08 — Spark Tool-Name, Block-ID, and Evidence Protocol

## 1. Tool identity is not block identity

A **callable tool** is a registered `AgentToolDefinition.function.name`, such as `inspect_spica_runtime_block`. A **block identifier** is data returned by the executable warehouse, such as `spica.runtime.ui_list`. Do not call `spica.runtime.ui_list` as a tool.

When unsure, use the exact registered tools:

```json
{"name":"inspect_spica_identifier","arguments":{"id":"spica.runtime.ui_list"}}
```

The returned `next` instruction will identify the correct function and required arguments. Use `list_solarium_tools` to page **every registered tool** and `inspect_solarium_tool` to retrieve the central registered schema for any named tool. The `callable` status depends on the active project and Web Search permission; absence of permission must not be disguised as a missing tool.

## 2. One graph reader

```json
{"name":"read_spica_graph","arguments":{"view":"v2"}}
```

`view:'schema1'` remains the small default response and `view:'both'` is available when a migration is being compared. `read_spica_v2_graph` was removed from the active tool registry; all Spark instructions should use `read_spica_graph`.

## 3. Exact inspection before a mutation

```json
{"name":"inspect_spica_tool","arguments":{"name":"compose_spica_v2_graph"}}
```

Then supply the exact intended call to `check_spica_tool_call`. A validated write becomes eligible for execution under normal user permissions. Invalid arguments must result in a clear diagnostic, not a hidden retry, name alias or coerced edit. A missing V2 block must be added as a new registered adapter, not claimed to exist.

## 4. Research example (illustrative tool-call sequence)

Use actual returned IDs in place of the example strings below:

```json
{"name":"spica_research_next","arguments":{"goal":"Compare documented application API revisions"}}
{"name":"spica_research_search","arguments":{"query":"official API revision release notes","provider":"primary"}}
{"name":"spica_research_read","arguments":{"sourceId":"<source ID returned by search>"}}
{"name":"spica_research_links","arguments":{"sourceId":"<source ID returned by search>"}}
{"name":"spica_research_follow","arguments":{"sourceId":"<parent source ID>","url":"<URL explicitly returned by links>"}}
{"name":"spica_research_compare","arguments":{"first":"<retrieved source ID>","second":"<retrieved second source ID>"}}
```

These are **examples of structure**, not executable calls without the real source IDs. For saved Sources, inspect/check `spica_research_save` and obey write permissions. End research explicitly with `spica_research_stop` when complete. Results must show actual evidence, contradictions, uncertainty and retrieved publication/retrieval details when available.

## 5. Security and operational guarantees

- No Web Search toggle override; no web access when OFF.
- Public HTTPS only; the existing Rust/native reader handles DNS/address checks and redirects safely.
- Only returned source IDs and page references are usable; no invented or private URL following.
- An explicit provider selection replaces concealed provider fallback for new Phase 08 research calls.
- Bounded searches, reads, passages, and follow links. A stopped run rejects further network actions.
- Source content is data, not instructions to the Spark.
- Failures stop the relevant action and must be reported accurately. Tool names and argument parameters are inspected before execution, not guessed from a warehouse ID.
- Read evidence is not proof; the Spark must not claim verification solely because terms overlap or two sources share wording.

## 6. Native acceptance checks after extracting the ZIP

From a correctly configured Solarium development environment:

1. Install the project dependencies using the repository's normal npm workflow.
2. Run `npm run test:spica:phase08` and the Phase 01–07 suites.
3. Run `npm run check`, `npm run build`, and the repository's lint/test commands.
4. Run the native Tauri/Rust checks on the supported system.
5. Manually test Dona with a local GGUF and the exact failing case (`spica.runtime.ui_list`) to confirm she selects the registered inspection function instead of invoking a block ID as a tool.
6. Confirm no `read_spica_v2_graph` is offered and `read_spica_graph({view:'v2'})` returns the current typed graph. Verify real web research only when the user's Web Search toggle is on.
