# Solarium 0.1 — Rendering Engine 2.0

This revision focuses on stability and meaningful editing surfaces rather than adding more separate block types.

## Changes

### Rich formatting

- Ordinary Markdown tables and LaTeX are rendered inline by `MarkdownBody`.
- Older `solarium-table` fences are interpreted as inline tables. Legacy `solarium-equation`, `solarium-chart`, `solarium-research` and `solarium-image` fences continue to render as in-message formatting without the document toolbar.
- Writing, code and previews remain expandable work products. Real project-check output is a compact expandable verified record; model-written fake terminal output is explicitly labeled as unexecuted text.
- Prompts no longer instruct Sparks to wrap routine tables/equations in Solarium-specific block protocols.

### Live previews

- New `preview-source.ts` classifies received HTML, CSS, and plain JavaScript; CSS-only responses receive a sample interface, avoiding blank canvases.
- New `LivePreview.tsx` provides desktop, tablet and mobile widths, reload, source inspection, load status, and actionable unsupported-format/errors.
- Executable HTML/JS is contained in a sandboxed iframe **without `allow-same-origin`**. Its CSP disallows connections, remote resources, forms and frames. Never run the generated JavaScript in Solarium's main React/Tauri context.
- Preview diagnostics arrive via `postMessage`, checked against the frame's `contentWindow`, opaque (`null`) origin and a per-instance token.
- Streaming preview updates are debounced (350 ms), reducing reloads as tokens arrive.
- **React/TSX build previews are not implemented.** They require a separately isolated local compiler, a controlled dependency resolver and a verified capability boundary. Such source now produces an explicit explanatory message rather than an empty iframe. Existing projects can still save and build their React files via approved project tools.

### Code and document editors

- Separate HTML, CSS and plain JS code files can be previewed together from their multi-file collection.
- Code blocks support direct Preview / Code switching for HTML, CSS and plain JavaScript and preserve highlighting, line numbers, export and project save/review actions.
- Writing workspace editing now shows a Markdown source editor, formatted live preview, heading outline, word/character count and optional selected-passage rewrite request placed in the chat composer (never automatically applied to the user's document).
- Document editing, assets/version history, DOCX/HTML export, and permission-based project file review retain their previous behavior.

### Continuous generation

- Consecutive output-length continuations that return duplicate/empty answer text are still bounded. When an earlier answer exists, Solarium **preserves it** and attaches a small “response may be incomplete” notice rather than raising a large fatal toast.
- Empty first replies still surface a clear failure. If the backend genuinely completes, no continuation is requested. There are no cycle labels or extra generation-mode buttons.
- The existing loaded model, per-request 2,048-token allowance, context guard and KV memory budget are unchanged; resetting an output allowance doesn't reset the model's context memory.
- Open model-generated blocks whose output was interrupted are marked **Incomplete output**, not permanently Streaming.

### Web research

- Queries about glassmorphism, liquid-glass UI or animation now target CSS and interface techniques, not generic “software” pages.
- Search-result ranking rejects unrelated download sites and penalizes movie listings for software tasks.
- Existing user-controlled web-search and tool-permission toggles remain in place.

## Security

Never grant sandboxed previews `allow-same-origin`, Tauri IPC permissions, network access or direct filesystem access. Real command execution remains subject to existing project-tool approval. External sources are untrusted data.

## Verification

Core TypeScript and source-parse checks and 92 Node regression tests pass in the supplied environment. A Chromium smoke test verified an isolated inline button script executes interactively inside `sandbox="allow-scripts"`.

Full `npm run check`, Vite production build and ESLint could not run because frontend packages cannot be fetched in this environment. Rust/Cargo and Windows GPU integration were not available. **Run all those checks on the user's own computer before declaring a fully clean native build.**

## Local setup

Apply the patch over your current Solarium project (do not remove the existing `runtime/` folder). In PowerShell:

```powershell
cd E:\ChatGPTProjects\Solarium
npm install
npm run check
npm run lint
npm run build
npm test
npm run desktop:dev
```

If installing dependencies is blocked, inspect the npm error before changing `package-lock.json` or deleting caches. The patch does not contain generated `node_modules` files or any model binaries.
