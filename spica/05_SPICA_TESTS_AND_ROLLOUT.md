# SPICA — 10K Warehouse Validation and Rollout Checklist

**This is a proposed acceptance/test specification, not evidence of executed tests against Solarium.**

## Catalog-level integrity

- [ ] Every canonical `id@version` is unique across all categories.
- [ ] IDs follow the declared namespace; aliases never shadow canonical IDs.
- [ ] All 10K web-search profiles resolve to known intent, domain and evidence policy values.
- [ ] The profile generator yields **exactly 10,000 unique rows**, not 9,999 or 10,001.
- [ ] Profiles are flagged `draft` and `executableNow=false` until dependencies are really implemented.
- [ ] `implementationRef` resolves to a trusted, installed adapter for all executable entries.
- [ ] Every stable entry has tests, version, documented failures, permissions, target support and license.
- [ ] Schema changes have migrations; project lockfiles preserve exact known-good versions.

## Model/tool interface

- [ ] The Spark initially sees only a compact fixed set of discovery, inspect, execute, evidence and verification tools.
- [ ] A catalog search returns 5–12 or a configured bounded number of candidates, not 10,000.
- [ ] Unknown or deprecated IDs are rejected clearly with compatible alternatives.
- [ ] An 8 GB VRAM setup can query metadata without requiring a second LLM resident in GPU memory.
- [ ] No fixed domain/intent/policy combination bypasses permission and capability checks.

## Research loops

- [ ] A result can be opened, parsed, compared, cited, or rejected in a follow-up step.
- [ ] Link extraction returns typed source references with preserved provenance.
- [ ] Independent corroboration distinguishes repeated copies of the same original article.
- [ ] Contradictions remain visible and affect verification status.
- [ ] Missing, stale, unsupported or paywalled sources are reported as such.
- [ ] Research stops after explicit completion criteria, user cancellation, or bounded budgets.
- [ ] Web-off/offline profiles never make outbound requests.
- [ ] Search snippets are not promoted to verified source passages.

## Security and privacy

- [ ] SSRF test cases include localhost, IPv4/IPv6 private networks, redirect-chain changes and DNS rebinding.
- [ ] Malicious webpage instructions cannot alter Spark tool permissions or system objectives.
- [ ] Browser/page code is not executed in a privileged process automatically.
- [ ] User/private Sources do not get sent to outside providers without approval.
- [ ] Host and provider rate limits, robots policies and terms are respected.
- [ ] Credentials and tokens are redacted in tool results and logs.
- [ ] Download sizes, parsed document sizes and nesting depths are bounded.

## User-visible result quality

- [ ] Actual source URL and retrieval timestamp available per claim.
- [ ] Clear distinction between verified findings, hypotheses, and missing evidence.
- [ ] Human can inspect and manually choose an alternative next step.
- [ ] Research graph remains usable from a text/outline accessible view.
- [ ] Search and block status messages reflect operations that actually occurred.

## Rollout recommendations

**R0 — Register:** Build schema validator, FTS5 store, initial test adapters.  
**R1 — Research:** Implement 10–20 web research primitives with evidence graph and 3 complete scenarios.  
**R2 — Agent loop:** Connect the existing Spark planner to shortlist/inspect/execute and real observations.  
**R3 — Profiles:** Generate and index the 10,000 draft configurations; activate only verified combinations.  
**R4 — Cross-domain:** Add UI/game/media categories, preserving shared types and deterministic graph semantics.  
**R5 — Ecosystem:** Support signed third-party packages, changelog/migrations, local forks, and reviewed custom blocks.

**Metrics to track:** `totalCatalogEntries`, `installedExecutableBlocks`, `stableBlocks`, `verifiedCompositions`, `draftProfiles`, `blockedEntries`, `avgDiscoveryLatency`, `modelContextTokensPerDiscovery`, `researchAnswerEvidenceCoverage`, `sourceCitationResolutionRate`, `webRequestsPreventedWhenDisabled`.
