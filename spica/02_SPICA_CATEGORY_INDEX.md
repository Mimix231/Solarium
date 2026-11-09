# SPICA — Block Category Index (10,000 Slots per Category)

**Status:** Proposal, not an inventory of already implemented blocks.  
**Basis:** First 26 category names are preserved from `SPICA_Master_Blueprint.md`, chapter 31. Two additions are proposed for web evidence and LeonisMaker game development.

## Category map

| No. | Category | Namespace | Catalog capacity | First implementation emphasis |
|---:|---|---|---:|---|
| 01 | App shells, windows, and layouts | `spica.category.01` | 10,000 | Window roots, app navigation, lifecycle, containers |
| 02 | Text, forms, and input controls | `spica.category.02` | 10,000 | Text inputs, validation, forms |
| 03 | Navigation, notifications, and feedback | `spica.category.03` | 10,000 | Transitions, dialogs, alerts, navigation |
| 04 | Events, branching, and orchestration | `spica.category.04` | 10,000 | Typed event routing, control flow, errors |
| 05 | Variables, collections, and state | `spica.category.05` | 10,000 | State stores, collections, computed values |
| 06 | Data modeling, databases, and search | `spica.category.06` | 10,000 | Typed data models, local databases, queries |
| 07 | Filesystem and archives | `spica.category.07` | 10,000 | File handles, safe writes, archives |
| 08 | Networking, APIs, and authentication | `spica.category.08` | 10,000 | HTTP, streaming, auth, permissions |
| 09 | Images, raster editing, and color | `spica.category.09` | 10,000 | Pixels, layers, transforms, export |
| 10 | Vector graphics, drawing, and geometry | `spica.category.10` | 10,000 | Paths, vector operations, geometry |
| 11 | Audio creation and processing | `spica.category.11` | 10,000 | Audio clips, processing, timelines |
| 12 | Video and timeline editing | `spica.category.12` | 10,000 | Video tracks, composition, encoding |
| 13 | Three-dimensional assets and scene tooling | `spica.category.13` | 10,000 | Scene graphs, meshes, transforms, assets |
| 14 | Documents, office tools, and publishing | `spica.category.14` | 10,000 | Text editing, structured docs, PDF exports |
| 15 | Charts, dashboards, and reporting | `spica.category.15` | 10,000 | Charts, datasets, filtering |
| 16 | System integration, desktop utilities, and processes | `spica.category.16` | 10,000 | OS capability adapters, processes |
| 17 | AI integrations and intelligent workflows | `spica.category.17` | 10,000 | Local model tools and inference transport |
| 18 | Automation, scheduling, and background work | `spica.category.18` | 10,000 | Schedulers, queues, persistent jobs |
| 19 | Code editing, debugging, and developer experience | `spica.category.19` | 10,000 | Editor, code generation, diagnostics |
| 20 | Build, packaging, publishing, and diagnostics | `spica.category.20` | 10,000 | Compilation and target packaging |
| 21 | Testing, validation, and benchmarks | `spica.category.21` | 10,000 | Unit, integration, contract and visual tests |
| 22 | Security, capabilities, and privacy | `spica.category.22` | 10,000 | Permissions, isolation, crypto boundaries |
| 23 | Accessibility, localization, and inclusive UX | `spica.category.23` | 10,000 | Keyboard, screen readers, i18n |
| 24 | Collaboration, version control, and content management | `spica.category.24` | 10,000 | Revisioning, conflict resolution, shared editing |
| 25 | Specialized advanced adapters | `spica.category.25` | 10,000 | High-cost domain-specific engines |
| 26 | Optional experimental building blocks | `spica.category.26` | 10,000 | Research prototypes with explicit uncertainty |
| 27 | Web research, retrieval, and evidence | `spica.category.27` | 10,000 | Research actions, evidence tracking, guided browsing |
| 28 | Game creation and gameplay | `spica.category.28` | 10,000 | LeonisMaker scene, sprite, input, collision and gameplay adapters |

## How each 10K category should be documented

For each category, maintain **one overview `README.md`** and **100 shards of up to 100 catalog entries** (`0000-0099.md`, `0100-0199.md`, …, `9900-9999.md`). Machine-readable manifests are authoritative; Markdown shards are generated for human inspection, versioned independently, and searchable offline. A row is only `stable` with a verified implementation and tests.

### Recommended shard entry fields

`ID | Label | Kind | Capability | Input type | Output type | Required permissions | Target support | Implementation reference | Maturity | Tests | Version`

### Why not produce 280,000 "blocks" by name today?

Without implementation contracts and real adapters, that would mostly generate an enormous list of aspirations. Instead, use the warehouse for **capacity**, start every category with meaningful primitives, and add documented compositions/profiles only when they correspond to valid graph structures. This preserves quality, VRAM, context budget, and maintainability.

### Required milestones before expanding a category

1. 20–40 validated primitive blocks for that category or reusable shared primitives.
2. At least two real end-to-end user scenarios.
3. Test suite and performance/compatibility constraints.
4. Repeatable composition generator with signature checks.
5. Index and compatibility querying that works without loading the full catalog.
6. Explicit metrics: installed executable count, proposed profiles, tested recipes, deprecated/blocked entries.

### Proposed storage tree

```text
categories/
  01-app-shells-windows-and-layouts/README.md
  ...
  27-web-research-retrieval-and-evidence/README.md
  28-game-creation-and-gameplay/README.md
```

The accompanying bundle already includes those 28 category README files as **starter design briefs**; no 10K catalog for the other 27 categories is represented as complete.
