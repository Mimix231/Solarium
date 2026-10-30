# Solarium development rules

**MANDATORY FIRST READ for inference, agent, tools, model context, and runtime edits:**
[`docs/info/INFERENCE_ARCHITECTURE.md`](docs/info/INFERENCE_ARCHITECTURE.md)

The documented single-stream reasoning/answer path, model-memory reuse, input-vs-output distinction, and staged project-tool registration are compatibility requirements. Do not add 2,048-token HTTP generation loops, extra reasoning quotas, synthetic continuation chats, or tool-schema blockers that prevent an existing project from being edited. Do not alter the inference architecture without a focused regression test and a corresponding update to the architecture contract.

Keep Spark personas, real filesystem verification, Ask/Auto/YOLO permissions, project-folder scoping, and Web Search OFF behavior intact. Every claimed filesystem or terminal success requires an actual executed result. Run and report available tests; distinguish skipped checks from successful ones.
