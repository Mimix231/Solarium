# 02 — Canonical TypeScript contracts (additive to the Spica master blueprint)

**Implementation status:** illustrative, intended to guide implementation. Preserve existing `SpicaBlockDefinition`, `SpicaGraph`, `SpicaChangeSet`, `SpicaService` if present. The new symbols below should live in a **warehouse extension module**, importing existing types rather than redefining them.

## 1. Registry record and execution eligibility

```ts
// Proposed: src/lib/spica/warehouse/contracts.ts
export type SpicaBlockKind = 'primitive' | 'composition' | 'profile' | 'recipe';
export type SpicaMaturity = 'draft' | 'prototype' | 'beta' | 'stable' | 'deprecated' | 'blocked';
export type SpicaPermission =
  | 'project.read' | 'project.write' | 'files.user-selected'
  | 'network.request' | 'process.spawn' | 'secrets.read'
  | 'clipboard.write' | 'device.control';

export interface SpicaBlockRef {
  id: string;                 // stable namespaced ID
  version: string;            // exact semver in project locks
}
export interface SpicaPort {
  id: string;
  direction: 'input' | 'output';
  typeId: string;             // e.g. spica.type.string, spica.type.action
  required: boolean;
  multiple?: boolean;
}
export interface SpicaWarehouseEntry {
  id: string;
  version: string;
  primaryCategoryId: number; // 01-35, only one
  facets: string[];
  kind: SpicaBlockKind;
  maturity: SpicaMaturity;
  title: string;
  summary: string;
  family: string;
  tags: string[];
  ports: SpicaPort[];
  propertySchemaRef: string; // schema loaded & validated separately
  targets: string[];
  permissions: SpicaPermission[];
  dependencies: SpicaBlockRef[];
  implementationRef?: string; // installed local adapter ID, never URL code
  compositionRef?: string;    // installed validated graph/recipe ref
  documentationRef: string;
  license: string;
  publisher: string;
  testEvidenceRefs: string[];
  contentHash?: string;
}
export interface SpicaResolutionContext {
  target: string;
  allowedPermissions: ReadonlySet<SpicaPermission>;
  installedAdapters: ReadonlySet<string>;
  pinnedVersions: ReadonlyMap<string, string>;
}
export interface SpicaEligibility {
  executableNow: boolean;
  reasons: string[];
}
```

**Important:** `maturity: 'stable'` alone is *not* permission to execute. Eligibility requires a resolvable implementation/composition, declared target, matched dependency locks, granted permissions, and verifiable tests. A profile resolves to an underlying primitive/composition; it never gets an automatic implementation by possessing a JSON descriptor.

## 2. Search request and safe result

```ts
export interface SpicaWarehouseSearchRequest {
  query: string;
  categoryIds?: number[];
  facets?: string[];
  target?: string;
  requiredInputTypeIds?: string[];
  requiredOutputTypeIds?: string[];
  allowedPermissions?: SpicaPermission[];
  executableOnly?: boolean;
  limit?: number; // service clamps to 1..20; default 8
  offset?: number; // human UI pagination; Spark typically uses first page
}
export interface SpicaWarehouseCandidate {
  ref: SpicaBlockRef;
  title: string;
  summary: string;
  kind: SpicaBlockKind;
  maturity: SpicaMaturity;
  primaryCategoryId: number;
  executableNow: boolean;
  blockedReasons: string[];
  relevanceReason: string;
}
export interface SpicaWarehouseSearchResult {
  candidates: SpicaWarehouseCandidate[];
  totalMatches: number;
  registryRevision: string;
}
```

## 3. Graph model extension (do not replace existing types)

```ts
export type SpicaNodePortId = string;
export interface SpicaGraphCompatibilityIssue {
  code:
    | 'UNKNOWN_BLOCK' | 'UNSUPPORTED_TARGET' | 'INCOMPATIBLE_TYPES'
    | 'MISSING_REQUIRED_INPUT' | 'CONNECTION_LIMIT'
    | 'UNGRANTED_CAPABILITY' | 'CYCLE_NOT_ALLOWED' | 'SCHEMA_INVALID';
  graphId: string;
  nodeId?: string;
  portId?: SpicaNodePortId;
  explanation: string;
  suggestedBlockRefs?: SpicaBlockRef[];
}
export interface SpicaGraphValidationReport {
  graphRevision: string;
  errors: SpicaGraphCompatibilityIssue[];
  warnings: SpicaGraphCompatibilityIssue[];
  executable: boolean;
}
```

Keep the master blueprint's `SpicaGraphOperation`, `SpicaChangeSet`, `SpicaApplyResult` and expected-revision semantics. Don't invent a second non-transactional graph edit API for Sparks.

## 4. Function blocks

```ts
export interface SpicaFunctionSignature {
  name: string;
  typeParameters?: Array<{ name: string; constraintTypeId?: string }>;
  parameters: Array<{ name: string; typeId: string; optional?: boolean }>;
  returnTypeId: string;
  effect: 'pure' | 'read' | 'write' | 'external';
  asynchronous: boolean;
  deterministic: boolean;
  failureTypeIds: string[];
}
```

**Graph rule:** a pure function can be evaluated in a deterministic preview and cached by inputs; an external function must not be evaluated during visual layout. Enforce side-effect annotation and capability grants in execution service.

## 5. Styling/layout/appearance and professionalism contracts

```ts
export interface SpicaDesignToken<T> {
  id: string;
  value: T;
  scope: 'project' | 'theme' | 'component' | 'state';
  variants?: Record<string, T>;
  description?: string;
}
export interface SpicaLayoutConstraint {
  axis: 'horizontal' | 'vertical';
  mode: 'fixed' | 'content' | 'fill' | 'fraction' | 'minmax';
  minPx?: number;
  maxPx?: number;
  preferredPx?: number;
  fraction?: number;
}
export interface SpicaQualityFinding {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error';
  targetId: string;
  evidence: string;
  measurement?: number;
  suggestedFixRefs?: SpicaBlockRef[];
  reproducibleCheckId: string;
}
```

Quality findings require evidence and a named check. No magical `professionalismScore` derived from a text-only model opinion; if a score exists, document weights and make source findings inspectable.

## 6. Observation / verification contracts

```ts
export interface SpicaOperationObservation<T = unknown> {
  runId: string;
  stepId: string;
  executedBlock: SpicaBlockRef;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  output?: T;
  diagnostics: string[];
  sourceRefs?: string[];
}
export interface SpicaActionBudget {
  maxSteps: number;
  maxNetworkRequests: number;
  maxElapsedMs: number;
  maxBytesRead: number;
  maxCostUnits?: number;
}
```

## 7. Runtime validation boundaries

- Validate **every** parsed manifest against a JSON schema at ingestion; TypeScript interfaces do not validate external JSON.
- Validate **every** Spark action's block ID, version, and arguments at runtime.
- Reject unknown fields for privileged execution requests where feasible; log safe diagnostics rather than silently dropping security-sensitive properties.
- Redact credentials and sensitive output before sending observations to a model.
- Separate registry-scoped IDs from user-controlled titles/labels.
- Convert failures into typed errors with actionable messages.

## 8. Contract test examples

```ts
import { describe, expect, it } from 'vitest';
import { isExecutable } from './eligibility';

describe('warehouse eligibility', () => {
  it('never treats a draft descriptor as executable', () => {
    const candidate = makeTestEntry({ maturity: 'draft', implementationRef: undefined });
    expect(isExecutable(candidate, makeTestContext()).executableNow).toBe(false);
  });
  it('requires target and permissions', () => {
    const candidate = makeTestEntry({ targets: ['web-react'], permissions: ['network.request'] });
    const context = makeTestContext({ target: 'desktop-tauri', allowedPermissions: new Set() });
    expect(isExecutable(candidate, context).executableNow).toBe(false);
  });
});
```

`makeTestEntry`, `makeTestContext`, and `isExecutable` are **functions to implement**, not existing imports. Replace the placeholder test import paths with actual repository paths. Use the existing test runner if different from Vitest.
