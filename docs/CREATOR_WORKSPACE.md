# Solarium 0.1 — Creator Workspace

This release extends the existing Solarium 0.1 UI and does not change the Spark personality system or installed inference-runtime paths.

## Projects

Open **Projects** in the navigation rail, create a project, optionally link a local source folder, and configure its instructions, preferred Spark, and preferred model. Use **New project chat** to create a conversation belonging to that project. The sidebar filters conversation history by project; **All conversations** returns to your non-project chats. Conversation branches retain their original project's association. Project metadata and chat attachments are persisted through the existing SQLite-backed workspace repository. Removing a project removes its Solarium conversations, not the underlying files.

## Chat formatting and attachments

Messages now render standard Markdown with GFM tables and task lists, fenced code blocks with highlighting and copy controls, and LaTeX via KaTeX. HTML from the model is not executed and remotely linked images are not automatically fetched. Click attached images for a larger preview.

Use **Attach files**, or drag files into chat. Supported: PNG/JPEG/WebP (up to 1.5 MB each), text/source files (450 KB each), PDF and DOCX (8 MB each). A maximum of eight files can be attached per message. PDF extraction reads up to 80 pages; image-only/scanned PDFs require OCR, which this release does not provide. PDF, DOCX, and text contents are included as *untrusted attached data*. To avoid exceeding small GGUF context windows, the model receives only a bounded portion of each attachment; the stored extracted text may be longer. Attachments are local and saved in the workspace database; large batches can increase its size.

**Vision:** To send an image to an LLM, its endpoint must report supported vision in model properties, or the user must enable **Try vision messages** for that model under **Local Models**. Enabling the override does not create vision support. For llama.cpp, a compatible vision-capable GGUF and any required projector are still necessary. Text-only models will not be allowed to silently ignore images.

## Web research

Enable **Web search** in the chat composer for that message. Solarium uses a native Rust HTTPS client to query public Bing RSS search results, then opens the first two readable HTML/text pages when possible. URLs found in your message are opened directly instead of being searched. A source list is displayed beneath the response. External material is labeled as untrusted data. On provider failures or unsupported pages, Solarium reports an error rather than creating fictional search results. Web access requires an internet connection, and search provider availability can vary by country and network. Web browsing is **off by default**.

Models with valid tool-calling support can also request `search_web`, `open_web_page`, `list_project_files`, and `read_project_file`. All four use the existing **ask/allow/deny** tool-permission system; the defaults are **ask**. They do not run shell commands. Web URLs are restricted to HTTPS on port 443, public DNS addresses, no redirects, with time and response-size limits.

## Code Workspace

Open a project, link a local folder, then choose **Browse project code**. Solarium shows up to 500 supported source/text files while skipping `.git`, `node_modules`, `target`, `dist`, build outputs and symbolic links. View and edit text files (up to 1 MB). Saves require explicit confirmation, check for external modifications, and create a `.solarium.bak` copy. Neither chat nor tool calls are allowed to write project files directly; this release is intentionally read-first. This is a lightweight editor, not yet a full IDE or automatic coding agent.

## Anime Studio updates

The embedded Appearance Studio now includes additional hair silhouettes, eye shapes, iris patterns, mouth designs, outfit designs, cosmetic overlays, hats, headphones, masks and other accessories. These are locally-rendered and editable SVG parts; they are not image-generation or full-body rigging assets. Expressions, import/export and presets from earlier releases remain available.

## Build and run

From the `solarium-0.1` directory:

```powershell
npm install
npm test
npm run check
npm run lint
npm run build
npm run desktop:dev
```

For a Rust-only check run `cargo check --manifest-path src-tauri/Cargo.toml`. On a Windows system with Tauri prerequisites installed this can validate the native commands. Please report the **first actual error** from each command with the filename and line; most errors following a missing dependency are cascading failures.

## Explicitly deferred

Do not interpret this as an autonomous programmer, complete project indexing/search, automatic long-term-memory reconstruction, multi-step planning/verification agent, OCR service, headless browser automation, or guaranteed multimodal compatibility across all local models. Those are outside the current stability-first milestone.
