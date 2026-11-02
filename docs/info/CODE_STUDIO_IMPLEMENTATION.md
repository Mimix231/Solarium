# Code Studio implementation and verification

Implemented on 2 November 2026 in the existing Solarium application. Coding remains the priority; existing writing documents and character data were preserved.

Ordinary assistant code fences now become durable generated-source artifacts. They keep their chat, message, Spark, language, suggested filename and immutable model original. Code Studio edits create separate revisions; reopening the original chat shows the current saved source without overwriting an edit. Interrupted streams remain incomplete and recoverable. Source readers page complete saved bodies within the existing chat/project permissions.

Generated source opens in Monaco without a project folder. Export and isolated web preview remain available. Applying source requires reviewing the actual project destination, then uses native compare-and-swap writes and backups. New nested folders are supported; changed disk contents invalidate an old review. A receipt records confirmed file application only. Editing the artifact clears that receipt. Project commands, output logs and current-revision checks remain separate evidence.

The editor now has local Cascadia/Consolas source fonts, a navy/violet/mint palette, rounded surfaces, hover/pressed/focus states, restrained ambient animation, focus mode, resizable source/output panels and an optional ordinary conversation pane. Reduced-motion settings stop the animation and transitions. The output panel starts collapsed for a new layout.

Active Glitch editor modules were consolidated into `src/coding`. Unused standalone frontends, duplicate inference paths and training/runtime experiments were archived after a verified source/database checkpoint. Only the scoped project service remains active in `backend`. [The consolidation manifest](CODING_CONSOLIDATION_MANIFEST.json) records the exact archive and original paths. Its source ZIP was rehashed successfully after implementation.

The inference stream, Spark identity, Ask/Auto/YOLO permissions, explicit denies, project scoping and Web OFF behaviour remain in the existing architecture. This implementation adds no synthetic continuation chat, reasoning quota or model-output token loop.

## Verification

| Check | Result |
| --- | --- |
| Frontend suite | 261 passed; one existing Linux Bash test skipped on Windows |
| Native Rust suite | 23 passed, including nested generated-file review/apply, CAS and backups |
| Scoped Python project service | 9 passed, including real TypeScript language-server checks |
| TypeScript and production build | Passed with `npm run build` |
| ESLint | No errors; three existing warnings in BlockWorkbench/LivePreview |
| Normal native application | Started with `npm run tauri dev`, identifier `org.solarium.desktop`, default user profile |
| Model generation | Actual Dona / Gemma 4 26B GGUF, one natural-EOS stream, exact source artifact persisted |
| Source workflow | Open, edit, preserve original, close/reopen, restart readback, review, native apply and stale-base rejection verified |
| Current generated fixture | All eight independent Unicode/boundary cases and all three declared check/test/build commands passed after an actual functional edit |
| UI inspection | Real native WebView, Monaco virtual URI/font, chat action, edited source, receipt, no page-width overflow, reduced motion and foreign-scope rejection verified |
| Existing writing | All three previously recorded immutable revision hashes unchanged |

The initial native apply attempt exposed a missing-parent-folder defect. It was repaired in the shared native writer, covered by a regression and rerun successfully. The failed attempt remains in the evidence. Five initial sample tests also missed a distinction between grapheme clusters and Unicode code points in Gemma's output. Three additional independent cases reproduced it; a functional edit through the real document store corrected the saved source, retained the model original, cleared the stale receipt and passed all eight cases after reapplication. This correction was authored during verification; it is not represented as an autonomous model repair. The original model-quality record remains `needs_review`.

This verifies the generated-source/editor workflow and the recorded fixture, rather than certifying every coding task or model. No separate Solarium application, QA profile or replacement renderer was used. Native application modules were exercised through the existing WebView's developer protocol; pointer interaction was not automated. A packaged installer and the complete model-quality corpus were not tested in this round. The production build still reports its existing large editor/document chunks.

## Evidence

- [Model generation and its original source/build fingerprints](../../output/quality/code-studio-model.json)
- [Initial failing native apply attempt](../../output/quality/code-studio-native-apply-initial.json)
- [Successful native apply, command logs and preserved reference tests](../../output/quality/code-studio-native-apply.json)
- [Functional edit, reproduced edge-case failures and final passing commands](../../output/quality/code-studio-semantic-edit.json)
- [Reduced motion and actual native storage scope](../../output/quality/code-studio-motion-and-scope.json)
- [Monaco inspection](../../output/quality/code-studio-monaco-final.json)
- [Chat artifact inspection](../../output/quality/code-studio-chat-surface.json)
- [Final verification summary](../../output/quality/code-studio-summary.json)
- [Normal native Code Studio screenshot](../../output/quality/code-studio-native-source-final.png)

Quality fingerprints now include actual source bytes, including helper and test changes, plus the SHA-256 of the running native executable. The source digest for this snapshot is `0be7ed06f4f1d6426b83237cbc29a30f51c4c7711cc3fa2b7aa73dbb1dcdbf2e`; the verified native binary is `110c111ea4b80e0497df816ebd3ccf03bfa71d59d5ab6033bb84eba6248530eb`. Older model results retain their original fingerprints and are not relabelled as results from the later native repair.
