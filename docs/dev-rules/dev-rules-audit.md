# Development Rules Audit

Last audited: 2026-08-06

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

### Hosted Security Controls Need Production Policy

**Status:** Open

**Evidence:** Database SSL enforcement is enabled and verified for the linked Supabase
project. Direct Postgres network restrictions still allow `0.0.0.0/0` and `::/0`
because no stable developer/CI CIDR allowlist is documented. Physical backup status
reports WAL-G support but no listed backups and no point-in-time recovery. Repository
configuration cannot prove the linked project's email-confirmation, leaked-password,
CAPTCHA, MFA, log-retention, or hosted abuse-protection settings.

**Affected areas:** Linked Supabase database access, authentication, privileged
moderator/admin/developer accounts, recovery readiness, and deployment operations.

**Complete when:** Trusted developer and CI database CIDRs are documented and enforced
without breaking migrations; backup restore behavior and retention are verified;
production Auth requires the approved email-confirmation and leaked-password controls;
CAPTCHA thresholds are defined for public signup/recovery abuse; privileged accounts
use an approved MFA policy; and the decisions are checked in a repeatable prelaunch
security runbook without storing secrets in the repository.

### Remote Release Verification Is Not Enforced

**Status:** High

**Evidence:** The repository has no GitHub Actions workflow or equivalent checked-in
remote verification gate. `package.json` runs only the version consistency check before
production builds, while the full tests, Svelte check, security audit, authentication
check, and database verification remain separate opt-in commands. `vercel.json` defines
the analytics cron but no build-time quality gate. A branch can therefore reach a
deployment target without the canonical change lifecycle being independently proven.

**Affected areas:** Pull requests, parent-branch merges, Vercel deployments, database
migrations, and release confidence.

**Complete when:** A Node.js 24 remote workflow performs a clean dependency install,
version consistency check, dependency security audit, Svelte check, full test suite,
and production build; migration changes additionally run the maintained database
verification workflow; and the required checks protect the branches that feed staging
and production.

### General Source Linting And Formatting Are Not Enforced

**Status:** Open

**Evidence:** `package.json` has no general lint or format command, and the repository
has no maintained ESLint, Prettier, or Stylelint configuration. Svelte check and the
source-text architecture guards enforce important project-specific contracts, but they
do not provide general TypeScript/Svelte diagnostics, deterministic formatting, or
SCSS linting across the working tree.

**Affected areas:** Svelte and TypeScript consistency, SCSS maintainability, review
noise, dead or suspicious constructs not covered by project-specific tests, and remote
release verification.

**Complete when:** The repository adopts a Svelte/TypeScript-aware linter and a
deterministic formatter with SCSS support; existing files are normalized deliberately;
necessary exceptions are narrow and documented; and lint plus formatting checks run in
the local verification commands and required remote workflow.

### Cross-View Browser, Mobile, And Accessibility Coverage

**Status:** Open

**Evidence:** Ingredients has a detailed browser/device matrix and accessibility QA, but
the unfinished Mix, Saved Recipes, Profile, Authentication, and Moderation experiences
have not completed equivalent real-device and cross-browser passes.

**Affected areas:** `src/routes/mix`, `src/routes/saved`,
`src/routes/profile`, `src/routes/auth`, and `src/routes/moderation`.

**Complete when:** Each finished view passes the required iOS Safari, Android Chrome,
desktop Chrome, desktop Safari, Firefox, Edge, keyboard, screen-reader, text-zoom,
reduced-motion, safe-area, background/resume, and device-permission checks defined by
the browser and mobile QA matrices.

### Remaining Visual-System Migration

**Status:** Open

**Evidence:** Ingredients defines the approved visual system, Mix has received a
focused token pass, and Saved Recipes now uses the shared app shell and component-owned
card/empty-state styles. App typography now uses one guarded semantic scale across
Root, Authentication, Profile, Moderation, Mix, Saved Recipes, and Ingredients. Those
older routes still contain one-off spacing and layout values that require deliberate
view-level migration rather than a mechanical typography pass. Current examples include
`src/routes/page.scss`, `src/routes/auth/page.scss`, `src/routes/profile/page.scss`, and
`src/routes/moderation/page.scss`. Repository guards currently reject raw application
typography, box shadows, numeric media-query breakpoints, and unexplained raw colors;
the remaining gap is deliberate view migration and direct-token spacing, not a missing
global scale.

**Complete when:** Each view is deliberately rebuilt against the Ingredients-derived
style guide; app-wide decisions use direct global tokens, component-only decisions stay
local, and raw values are retained only when they are genuine measured or standards
constants rather than undocumented design choices.

### Shared Control Primitive Migration

**Status:** Open

**Evidence:** Ingredients, Mix, and Saved Recipes largely compose actions through the
shared button and input primitives. Authentication, Profile, and Moderation still render
route-local submit buttons and action classes instead of delegating their loading,
disabled, focus, sizing, and responsive behavior to the same primitives. No feature
route still owns a native `<select>`, but 11 route-local submit buttons remain across
Authentication, Profile, and Moderation. Current examples include `src/routes/auth/+page.svelte`,
`src/routes/auth/update-password/+page.svelte`, `src/routes/profile/+page.svelte`, and
`src/routes/moderation/+page.svelte`.

**Complete when:** Each remaining route-local action is migrated to the applicable
shared button, icon-button, two-step confirmation, input, or status primitive; native
form submission semantics and route actions remain intact; and focused interaction,
loading, responsive, and accessibility tests cover each migrated flow.

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
and saved-recipe reuse still crosses several views and state transitions.

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

### Nutrient Mapping Seed Can Auto-Approve Semantic Guesses

**Status:** Critical

**Evidence:** `scripts/lib/reference-data/nutrientMatching.mjs` removes identity-bearing
tokens such as `acid`, `d2`, and `d3`, accepts a semantic score of `0.7`, and marks a
mapping automatically approved when the remaining tokens match. Unit compatibility
contributes to ranking but is not required for automatic approval.
`scripts/seeds/seed_product_reference_data.mjs` enables those approved Open Food Facts
mappings. Reviewed mapping rows are now protected from observation-seed overwrites, but
new semantic candidates can still be automatically approved and can therefore collapse
distinct nutrients or enable a mapping whose units are incompatible.

**Affected areas:** `nutrient_source_mappings`, imported product nutrients, normalized
catalog nutrients, nutrition facts, Mix totals, and the public API.

**Complete when:** Automatic approval requires a reviewed exact source key or an
identity-preserving exact mapping with compatible units; semantic candidates always
remain pending; dangerous ignored tokens are restored; and regression fixtures cover
vitamin forms, fatty acids, parent/sub-nutrients, and incompatible units.

### Exact-Identity Search Dedupe Replaces Whole Records

**Status:** High

**Evidence:** `src/lib/utils/ingredients/ingredientSearchResults.ts` correctly links
records only by explicit IDs, but chooses one entire record using counts of nutrients,
servings, and generic metadata. A richer nutrient record can replace a record with
better category, serving, attribution, preparation, or other field evidence.

**Affected areas:** Search results, list placement, generic-food enrichment, food-safety
evaluation, and the data a user saves.

**Complete when:** Exact-linked records are merged per field with provenance and
dataset metadata preserved; no whole-record richness score can discard independently
better evidence.

### Exact-Source List Enrichment Overwrites Whole Fields

**Status:** High

**Evidence:** `src/lib/utils/food/records/sourceFoodEnrichment.ts` replaces nutrients by
ID, prefers source arrays and text wholesale, and spreads the source record over the
saved record. It preserves selected user-owned identity fields, but it does not compare
field provenance, observation date, value origin, or review state before overwriting
other values.

**Affected areas:** Adding search results to Fridge or Shopping List and refreshing
USDA or barcode-backed foods before persistence.

**Complete when:** Exact-source enrichment uses the same field resolver as catalog
enrichment, preserves explicit user edits and stronger evidence, and records why each
field changed.

### Generic Identity Defaults Unknown Foods To Packaged

**Status:** High

**Evidence:** `src/lib/utils/food/identity/foodIdentity.ts` classifies any unbranded,
barcode-free record whose data type is not in a short hardcoded generic set as
`packaged`. New national datasets or future source types can therefore be
misclassified when explicit identity metadata is absent.

**Affected areas:** Generic food-safety rules, custom/private classification, search
behavior, and source enrichment.

**Complete when:** Imported adapters provide explicit identity; unknown identity stays
unknown or is rejected from identity-dependent rules; and source expansion does not
require editing a hidden datatype allowlist.

### Remaining Heuristic Product Policies

**Status:** Open

**Evidence:** Several workflow decisions remain fixed in code:

- catalog verification uses 3%, 10%, and 25% numeric conflict bands in
  `src/lib/server/products/catalogVerification.server.ts`;
- catalog submission comparison uses separate 10%, 35%, and 75% relative bands,
  absolute minimums, serving tolerance, and auto-decline counts in
  `src/lib/utils/products/catalogSubmissionComparison.ts`;
- product-name identity calls records unrelated below 20% token overlap in
  `src/lib/utils/products/productIdentity.ts`;
- nutrition completeness weights required fields four times, scores source-resolution
  modes as 3/2/1/0, and uses a 60% partial threshold in
  `src/lib/utils/food/quality/nutritionCompletenessAssessment.ts`;
- category suggestions and source/search ranking use hardcoded scoring systems.

These policies do not directly rewrite measured nutrient amounts, and category/search
suggestions still require user action. They nevertheless affect moderation,
verification, warnings, recommendations, and perceived quality.

**Complete when:** Canonical and moderation decisions use versioned, validated policy
rows with regression coverage; recommendation/search-only scores are clearly scoped as
UX ranking rather than source authority; and duplicate thresholds are consolidated.

### Allergen Declaration Parsing Is Language-Specific Evidence Extraction

**Status:** Open

**Evidence:** `src/lib/server/products/allergenDeclarations.server.js` uses English
phrase and punctuation heuristics to extract `contains`, `may contain`, and facility
statements. It correctly avoids treating ordinary product titles as allergen evidence,
but parsed text can be mistaken for a structured provider declaration if the extraction
method and confidence are not retained.

**Complete when:** Raw declarations are preserved, parser method/language/confidence are
stored, unsupported languages remain unparsed, multilingual and nested-statement
fixtures are covered, and parsed declarations never claim stronger evidence than their
source text.

### Coordinator And Domain Boundary Watchlist

**Status:** Review during related changes; do not split by line count alone

**Evidence:** Several files remain large coordinators, including
`src/routes/ingredients/fridge/+page.svelte`, `src/routes/mix/+page.svelte`,
`src/routes/profile/+page.svelte`, `src/routes/moderation/+page.svelte`,
`src/lib/server/products/catalog.server.ts`,
`src/lib/utils/barcode/barcodeProductMappers.ts`,
`src/lib/components/ingredients/manual-entry/CustomIngredientForm/manualEntryBarcodeController.svelte.ts`,
and `src/lib/components/app/TutorialOverlay/TutorialOverlay.svelte`. The current route
sizes are approximately 1,345 lines for Ingredients, 1,121 for Mix, 817 for Profile,
and 550 for Moderation. `TutorialOverlay` is approximately 522 lines. Their size is
acceptable only while they continue to coordinate focused modules instead of absorbing
reusable UI, persistence, validation, normalization, or source policy.

**Complete when:** Related feature work confirms each file remains orchestration-only,
or extracts a focused owner with tests when a reusable behavior or business policy has
actually accumulated. Pure food models, shared product policy, barcode adapters, and
Supabase persistence must keep the ownership boundaries documented in
[the project structure](../project-structure.md).

## Audit Commands

These commands are evidence helpers, not substitutes for reviewing behavior:

```bash
git status --short --branch
find .github/workflows -maxdepth 1 -type f -print
find src/lib/components -maxdepth 4 -type f | sort
find src/lib/utils src/lib/server -maxdepth 4 -type f | sort
rg -n '"(lint|format)(:[^"]+)?"' package.json
rg -n "box-shadow" src
rg -n "<button(?:\\s|>)" src/routes --glob '*.svelte'
rg -n "@media[^\\n]*[0-9]+(px|rem|em)" src --glob '*.scss'
rg -n "localStorage|sessionStorage" src/lib src/routes --glob '!src/lib/types/database.types.ts'
rg -n "\\.email|email" src/lib/components src/routes --glob '*.svelte' --glob '*.ts'
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(" src --glob '*.svelte' --glob '*.ts' --glob '*.scss' --glob '!src/styles/_variables.scss'
rg -n "(padding|margin|gap|font-size|font-weight|border-radius): [0-9]" src --glob '*.svelte' --glob '*.scss' --glob '!src/styles/_variables.scss'
find src -type f \\( -name '*.svelte' -o -name '*.ts' -o -name '*.scss' \\) -print0 | xargs -0 wc -l | sort -nr
npm audit
npm run check:auth
npm run db:lint
```
