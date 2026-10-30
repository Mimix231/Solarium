# Solarium 0.1 — frontend dependency repair

## Root cause
The Creator Workspace introduced `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `highlight.js`, `katex`, `pdfjs-dist`, and `mammoth`. They are declared in `package.json`, but copying a source patch does **not** download them into `node_modules`.

The TypeScript `TS2307` and Vite import errors in `RichMessage.tsx` / `creator.ts` stem from absent dependencies. The associated TS7031/TS7006 messages were compounded by unavailable inferred types. The updated source also explicitly types the ReactMarkdown renderer properties and narrows PDF text items.

## Apply on Windows (PowerShell)

1. Close Solarium and stop its Vite process.
2. Extract the **patch ZIP directly** into `E:\ChatGPTProjects\Solarium` and replace the listed files. The patch is root-relative (`src/`, `scripts/`, `package.json`) so it will not create a nested project directory. The **full-source ZIP**, unlike the patch, contains a `solarium-0.1/` top-level folder.
3. In the project root, run:

   `npm install`

   `npm run check`

   `npm run build`

   `npm run desktop:dev`

**Do not** replace the `runtime/`, `node_modules/`, or any private application-data folders with the ZIP contents.

## What was changed
- `src/components/RichMessage.tsx`: explicit React HTML property types on Markdown component renderers.
- `src/engine/creator.ts`: use the typed `pdfjs-dist` package entry point, keep the worker via Vite's `?url` loader, safely narrow extracted PDF text content.
- `src/types/mammoth-browser.d.ts`: align the worker asset declaration to the updated import.
- `package.json`: add early dependency checks before dev, check, and build scripts.
- `scripts/check-frontend-dependencies.cjs`: display actionable instructions if required frontend packages are missing.

Rust warnings about incremental hard links on your E: drive are **warnings**, not the cause of the frontend failure.

## Verification limits
Code syntax and core tests can be verified without the npm registry. A complete frontend build requires installing npm dependencies. Native Tauri testing requires Rust and Windows.
