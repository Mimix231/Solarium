# Solarium development rules

**MANDATORY FIRST READ for inference, agent, tools, model context, and runtime edits:**
[`docs/info/INFERENCE_ARCHITECTURE.md`](docs/info/INFERENCE_ARCHITECTURE.md)

The documented single-stream reasoning/answer path, model-memory reuse, input-vs-output distinction, and staged project-tool registration are compatibility requirements. Do not add 2,048-token HTTP generation loops, extra reasoning quotas, synthetic continuation chats, or tool-schema blockers that prevent an existing project from being edited. Do not alter the inference architecture without a focused regression test and a corresponding update to the architecture contract.

Keep Spark personas, real filesystem verification, Ask/Auto/YOLO permissions, project-folder scoping, and Web Search OFF behavior intact. Every claimed filesystem or terminal success requires an actual executed result. Run and report available tests; distinguish skipped checks from successful ones.

**Read for Sources, task execution, project tools, storage and imports:** [Sources and Action Architecture](docs/info/SOURCE_AND_ACTION_ARCHITECTURE.md). Preserve scoped originals, per-command verification, actual output logs and durable task recovery. Failed checks remain work to repair; a different pass is not overall completion.

**Read for authoring, long chapters, characters, canon and web research:** [Writing, Canon and Research Architecture](docs/info/WRITING_CANON_RESEARCH_ARCHITECTURE.md). Preserve stable rich documents/revisions, explicit length targets, planned scene boundaries, per-field evidence and locked AU facts. Characters never become the Spark persona. A finished fence or model EOS alone is not proof that a requested chapter length was reached.
