# Solarium 0.1 — Universal Content Blocks

This update extends the existing Tauri/React/MUI Solarium without changing Spark DNA, the selected LLM, themes or the 2048-token continuous-generation controller.

## Using blocks

Solarium renders standard Markdown and fenced code as before. Fenced code now has line numbers, syntax colors, copy, export, a project-safe editing panel and a multi-file tab strip for consecutive files. A Spark can also use `solarium-*` fenced blocks. Examples:

~~~markdown
```solarium-writing title="Chapter One"
# Chapter One
Once upon a time...
```

```tsx title="Avatar.tsx"
export function Avatar() { return <main>Hi!</main>; }
```

```solarium-table title="Benchmarks"
Model,Tokens per second
Example A,25
Example B,40
```

```solarium-chart title="Speeds"
{"type":"bar","data":[{"label":"A","value":25},{"label":"B","value":40}]}
```

```solarium-equation
E=mc^2
```

```solarium-preview title="Preview"
<!doctype html><style>body{font-family:sans-serif}</style><h1>Hello</h1>
```
~~~

Other supported block kinds: `solarium-research`, `solarium-image`, `solarium-file`, and `solarium-terminal`. **The latter two are proposals unless backed by a real saved file or tool execution.** The model cannot claim a file was written or a terminal command succeeded simply by emitting text.

## Streaming and continuation

`BlockStreamAssembler` is incremental. It does not close code or writing blocks when the model hits a 2,048-token continuation boundary. A code fence is closed only by a real closing delimiter. IDs use the opening fence's character offset. Standard Markdown remains compatible with less capable GGUF models. The content protocol is a rendering convention, not a new inference backend or separate agent.

## Editing and saving

Select **Open editor** on a block to open the right-hand Block Workspace. It offers preview/edit, find-and-replace, copy/export, version history for saved assets, and **Save asset**. Saved assets persist with the Solarium workspace in SQLite (or the existing browser fallback); the original chat message remains unchanged. Asset lists are accessible via **Assets** in Chat or in the selected Project.

For project conversations with a linked source folder, supported blocks offer **Review to project**. Enter a project-relative filename, examine side-by-side current/proposed content, then explicitly apply. Native Rust restricts path traversal and symlinks, enforces allowed extensions and a 1 MB size cap, uses exclusive creation for new files, refuses to overwrite changed files, and creates backups for updates. Solarium will never auto-apply source changes from model text.

## Writing exports

Writing blocks support Markdown, basic HTML, genuine minimal DOCX (OOXML ZIP-store; valid package), and Print/PDF using the platform's print dialog. They are functional document exports, not a full word processor. Formatting in DOCX is basic and print-to-PDF behavior depends on the operating system's print support.

## Other blocks

- **Code:** streaming syntax highlighting via the existing `highlight.js` dependency, line numbers, editable source, grouped files, explicit review-before-save.
- **Tables:** CSV or JSON, click column headers to sort, edit raw CSV/JSON in the Workbench, export CSV.
- **Charts:** bar, line, area and pie from actual model-supplied numerical data; never invent benchmark results.
- **Research:** clickable public HTTPS source cards; remote content is not silently executed.
- **Images:** embedded PNG/JPEG/WebP only; external image URLs are links, not auto-fetched content.
- **Equations:** KaTeX using the existing Markdown pipeline.
- **Terminal:** real project check results can be attached to the assistant message. The Spark must request the `run_project_check` tool, the user must approve each execution, and Rust runs only `npm_check`, `npm_test`, `npm_build`, `cargo_check` or `git_diff` inside a linked project. A 180-second timeout and output limits apply. Output is collected on completion, **not yet a live pseudo-terminal**. Model-written terminal blocks remain clearly labeled *not executed*.
- **Preview:** static HTML/CSS rendered in a sandboxed iframe with restrictive CSP, without scripts or network access. Arbitrary generated React/JS is not executed.

## Build and test

From the Solarium project directory on Windows:

1. `npm install` — required if dependencies from earlier Creator Workspace updates aren't installed.
2. `npm run check`
3. `npm run lint`
4. `npm run build`
5. `npm test`
6. `npm run desktop:dev`

The source includes regression tests for streaming boundaries, asset persistence, table/chart parsing, CSV escaping, document exports and tool-permission wiring.

## Limitations and follow-ups

The headless build environment for this release cannot reach the npm registry and lacks the Rust toolchain. Source syntax, core test TypeScript and the full available automated tests passed, but this is **not** a verified native Windows build. On your machine, run the above commands and report any compiler errors. Chrome/Tauri sandboxed preview and Windows source-file writes still require manual integration checks. WYSIWYG document editing, actual file bundles/ZIPs, fully isolated JS/React execution, and live terminal streaming are deferred rather than advertised as finished.
