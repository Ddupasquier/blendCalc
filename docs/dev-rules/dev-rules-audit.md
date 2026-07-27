# Development Rules Audit

Last audited: 2026-07-26

## Purpose

This is the maintained list of unresolved findings discovered while reviewing the
current working tree against [the development rules](dev-rules.md). It is intentionally
not a history of completed work.

The development rules are authoritative. This audit may be revised, reordered, expanded,
or removed as future audits and product decisions change the implementation. An audit
finding never overrides a rule.

## Maintenance Contract

- Read this audit with the rules before implementation work begins.
- Keep only findings that are still reproducible in the current tree.
- Remove resolved findings instead of retaining pass tables or completed cleanup plans.
- Add evidence, affected paths, and a clear completion condition to every new finding.
- Move a finding into the rules only after it becomes a settled, repeatable requirement.
- Do not duplicate ordinary QA steps here; link to the relevant QA group when validation
  is the remaining work.

## Active Findings

### Cross-View Browser, Mobile, And Accessibility Coverage

**Status:** Open

**Evidence:** Ingredients has a detailed browser/device matrix and accessibility QA, but
the unfinished Mix, Saved Drinks, Profile, Authentication, and Moderation experiences
have not completed equivalent real-device and cross-browser passes.

**Affected areas:** `src/routes/mix`, `src/routes/saved`,
`src/routes/profile`, `src/routes/auth`, and `src/routes/moderation`.

**Complete when:** Each finished view passes the required iOS Safari, Android Chrome,
desktop Chrome, desktop Safari, Firefox, Edge, keyboard, screen-reader, text-zoom,
reduced-motion, safe-area, background/resume, and device-permission checks defined by
the browser and mobile QA matrices.

### Remaining Visual-System Migration

**Status:** Open

**Evidence:** Ingredients defines the approved visual system and Mix has received a
focused token pass. Root, Authentication, Profile, Saved Drinks, and Moderation styles
still contain older one-off spacing, font-weight, sizing, and layout values. Current
examples include `src/routes/page.scss`, `src/routes/auth/page.scss`,
`src/routes/profile/page.scss`, `src/routes/saved/page.scss`, and
`src/routes/moderation/page.scss`.

**Complete when:** Each view is deliberately rebuilt against the Ingredients-derived
style guide; app-wide decisions use direct global tokens, component-only decisions stay
local, and raw values are retained only when they are genuine measured or standards
constants rather than undocumented design choices.

### Moderation View Rebuild

**Status:** Deferred until the Moderation UI pass

**Evidence:** `src/routes/moderation/+page.svelte`,
`src/routes/moderation/+page.server.ts`, and
`src/routes/moderation/page.scss` still combine the older moderation presentation with
substantial account, submission, and notification orchestration. The product decision is
to avoid polishing this temporary UI before its dedicated rebuild.

**Complete when:** The moderation route uses the shared view, sheet, form, status,
loading, badge, and privileged-action primitives; route actions remain server-owned;
moderation-only email access stays privileged; and the rebuilt flow receives focused
security, accessibility, and browser QA.

### End-To-End Flow Simplification

**Status:** Open

**Evidence:** Individual flows are stronger, but the full path from ingredient search or
barcode entry through nutrition review, list placement, Mix selection, result review,
and saved-drink reuse still crosses several views and state transitions.

**Complete when:** A prelaunch walkthrough confirms each successful action presents one
clear next step, preserves state across URL-backed views, avoids duplicate confirmation
or entry screens, and does not require users to rediscover an action in an unrelated
panel.

### Async Action And Validation Consistency

**Status:** Open

**Evidence:** Shared loading, status, and server-validation primitives exist, but
remaining unfinished views have not been audited together for duplicate submissions,
conflicting pending states, stale success/error messages, or client-only validation
that should be enforced by an authoritative server path.

**Complete when:** Every mutating action in the finished views has one authoritative
write path, disables only the relevant controls while pending, prevents duplicate
submissions, maps safe server issue codes to friendly copy, and clears stale status at a
predictable boundary.

### Remaining Heuristic Decision Thresholds

**Status:** Open

**Evidence:** Nutrition values and serving conversions no longer use name-based density
guesses or fabricated missing values, but several workflow classifications still use
code-owned thresholds. Catalog conflict severity uses fixed 3%, 10%, and 25% bands in
`src/lib/server/products/catalogVerification.server.ts`; catalog revision comparison
uses separate fixed absolute and relative bands in
`src/lib/utils/products/catalogSubmissionComparison.ts`; and nutrition completeness
labels use a fixed 60% boundary in `src/lib/utils/food/quality/foodQuality.ts`.
These values affect moderation and quality labels rather than the stored nutrient
amounts themselves, but they remain product policy that cannot currently evolve through
the database.

**Complete when:** The thresholds are represented by versioned, validated database
policy rows or an equivalent authoritative reference-data contract; server loaders fail
clearly when required policy is unavailable; and regression tests prove that changing a
policy row changes classification without changing nutrient values or provenance.

### Coordinator And Domain Boundary Watchlist

**Status:** Review during related changes; do not split by line count alone

**Evidence:** Several files remain large coordinators, including
`src/routes/fridge/+page.svelte`, `src/routes/mix/+page.svelte`,
`src/lib/server/products/catalog.server.ts`,
`src/lib/utils/barcode/barcodeProductMappers.ts`, and
`src/lib/components/ingredients/manual-entry/CustomIngredientForm/manualEntryBarcodeController.svelte.ts`.
Their size is acceptable only while they continue to coordinate focused modules instead
of absorbing reusable UI, persistence, validation, normalization, or source policy.

**Complete when:** Related feature work confirms each file remains orchestration-only,
or extracts a focused owner with tests when a reusable behavior or business policy has
actually accumulated. Pure food models, shared product policy, barcode adapters, and
Supabase persistence must keep the ownership boundaries documented in
[the project structure](../project-structure.md).

## Audit Commands

These commands are evidence helpers, not substitutes for reviewing behavior:

```bash
git status --short --branch
find src/lib/components -maxdepth 4 -type f | sort
find src/lib/utils src/lib/server -maxdepth 4 -type f | sort
rg -n "box-shadow" src
rg -n "localStorage|sessionStorage" src/lib src/routes --glob '!src/lib/types/database.types.ts'
rg -n "\\.email|email" src/lib/components src/routes --glob '*.svelte' --glob '*.ts'
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(" src --glob '*.svelte' --glob '*.ts' --glob '*.scss' --glob '!src/styles/_variables.scss'
rg -n "(padding|margin|gap|font-size|font-weight|border-radius): [0-9]" src --glob '*.svelte' --glob '*.scss' --glob '!src/styles/_variables.scss'
find src -type f \\( -name '*.svelte' -o -name '*.ts' -o -name '*.scss' \\) -print0 | xargs -0 wc -l | sort -nr
```
