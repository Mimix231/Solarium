# DCE — source construction checkpointed decision context

This is a behavior change for the latest Phase 3 inference-continuity baseline.

## Why Dona stopped at 4,096

The observed server reported `n_ctx=4096`, `input≈3455`, `n_keep≈3455`,
`max_tokens=-1`, and **context shift unsupported**. A 4096-token cache with
roughly 3455 input tokens cannot hold an unbounded response. The old two-attempt
recovery prompt reused nearly the same crowded context. The resulting model
could spend the remaining capacity repeating reasoning rather than finishing
an action, then emit `finish_reason=length` again.

## Correct handling

1. A source-construction decision uses the original request, Spark persona,
   current linked project, actual project/check state, last executed tool
   result and **the exact tools offered this turn**. Previous reasoning is
   archived as original output, not summarized as a claim of completed work.
2. For <=8192-token models without context shift, offer the highest-priority
   registered tool for the current stage rather than four large schemas.
3. Reserve a substantial initial output runway (40% of loaded context) when
   the backend cannot shift, dropping optional history/snapshots if necessary.
4. On **unsupported** shifting backends, request the actual finite output
   capacity. On supported models, retain one `max_tokens=-1` native stream per
   action turn, with a bounded retained system prefix.
5. Continue after an actual tool result using the saved checkpoint. For an
   incomplete model turn, only the existing bounded independent decision
   recovery is permitted; do not execute partial JSON or claim progress.
6. Repeated failures after a compact decision must produce a truthful paused
   task. A compatible model with tool-aware template and enough context is
   still required. Larger `n_ctx` (e.g. 8K or 16K if hardware allows) can help;
   it is not a universal fix for unsupported tool calling.

## Compatibility / deliberate limitations

No new process, model weights, automatic filesystem-write bypass, hidden
continuation prompt, graph-editor route, or frontend dependency was added.
Source blocks, fiction layers, legacy SPICA, permissions and construction
persistence remain separate. A compact packet cannot safely infer a verified
plan solely from unfinished model reasoning. A task whose model never produces
valid tools may remain paused.
