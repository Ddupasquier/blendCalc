# Shared Product Catalog

The shared catalog lets one verified packaged product become searchable for every
signed-in user without exposing the account that submitted it.

## Guide Navigation

| Area | Sections |
| --- | --- |
| Intake and evidence | [User flow](#user-flow), [source policy](#source-policy), and [provenance and merging](#provenance-and-merging) |
| Product changes | [Existing barcodes and label changes](#existing-barcodes-and-label-changes), [serving data](#serving-data), and [source lifecycle](#source-lifecycle) |
| Runtime and quality | [Runtime source boundary](#runtime-source-boundary), [source quality monitoring](#source-quality-monitoring), and [verification rules](#verification-rules) |
| Safety and review | [Catalog security](#catalog-security-boundary), [moderation](#moderation), and the [submission improvement plan](#submission-and-moderation-improvement-plan) |
| Supporting features | [Nutrition completeness](#nutrition-completeness-flow), [product identifier QR codes](#product-identifier-qr-codes), and [QA fixtures](#qa-moderation-fixtures) |

## User Flow

1. A user scans or enters a valid UPC/EAN barcode.
2. The ingredient is always saved to that user's private custom-food list first.
3. For eligible labels, the user can explicitly opt in to catalog review.
4. The server validates the barcode, serving weight, nutrient values, and basic macro
   relationships.
5. An exact, legally reusable USDA FoodData Central barcode match may publish or improve
   the blendCalc canonical product; the stored blendCalc record becomes the source used
   by later app and public-API reads while USDA remains recorded as field evidence.
6. Unknown labels require front-package, nutrition-label, and barcode photos.
7. Unknown labels stay pending until a moderator approves or rejects them.
8. Approved products appear in ingredient text search and are checked before outside
   barcode services.
9. The 51st moderator-rejected shared-product submission pauses public product sharing
   for six calendar months. Automated declines do not increase that count.

Barcode autofill and publication use two category layers: raw category values from the
source APIs remain on the food payload for provenance, while `category_option_id` points
to the clean DB-backed category shown in the app. Publication is blocked if a canonical
category cannot be resolved. That reviewed category also bounds missing-image symbol
selection: a product name may refine its symbol only inside the category family, apart
from reviewed prepared-food overrides.

Submitting is optional. A failed catalog submission never rolls back the user's private
ingredient. Submission pauses only affect shared catalog submissions. Users can still
save private custom foods, use their fridge, and build mixes.

## Source Policy

- **blendCalc shared catalog:** the active `shared_products` row plus its normalized
  nutrient, serving, image, category, provenance, and revision records is the canonical
  source of truth for published product reads. External providers do not bypass or
  overwrite accepted nonmissing canonical fields. When search receives the same barcode
  from the catalog and an external provider, the canonical catalog record remains the
  result even if the transient provider payload contains more optional fields.
- **Exact identity versus field verification:** an exact barcode match confirms product
  identity only. Submission workflow records this as `exact_identity`; it does not
  assign provider-wide verification. Automatically published exact-source records
  remain `imported` at the whole-record level, while each selected field retains its
  own evidence and confidence.
- **External observations:** an exact, legally eligible value may fill a missing
  canonical field only when the observation, selected field provenance, and revision
  are persisted together. Provider-wide trust never substitutes for field evidence.
- **Generic datasets:** confidently linked generic foods remain separate from exact
  packaged-product identity.
- **User-entered labels:** publication requires moderator review.

Whether a provider may populate the future public blendCalc dataset is stored in
`product_data_sources` through `canonical_storage_allowed`, license, review date, and
policy notes. `api_redistribution_allowed` separately controls API publication.
Application code must not infer redistribution permission from a provider name.

Provider capabilities are maintained in the
[`source data inventory`](api-structures/source-data-inventory.md). Exact source
requirements, current handling, and compliance blockers are maintained only in
[`data-source-licensing.md`](data-source-licensing.md).

## Provenance And Merging

Every published field records the observation that supplied it. Source observations,
selected field provenance, and disagreements are stored separately from the canonical
product row.

An exact barcode proves that a provider record refers to the scanned product; it does
not independently verify every field in that record. Provider-reported fields therefore
remain `imported` unless separate evidence supports `corroborated` or
`moderator-reviewed`. The public field-source contract translates stored evidence into
the bounded methods `exact-barcode`, `package-label`, `corroborated-sources`, and
`moderator-reviewed`. It exposes the selected observation ID and observation date, but
never raw payloads, submission ownership, private label evidence, or reviewer identity.

When a canonical product is incomplete, the server may consult source caches and
external APIs only for the missing fields. A legally reusable exact-source value can be
promoted into the canonical row through the server-only enrichment transaction, which
rechecks that the field is still missing before writing it. Existing canonical values
are not silently replaced. Provider data whose terms do not allow inclusion in the
future blendCalc public dataset remains in its isolated licensed cache or image-asset
path and is never disguised as blendCalc-owned canonical data.

Field-resolution policy version 1 compares exact-barcode candidates independently by
field evidence, field completeness, observation recency, and a neutral deterministic
tie-break. It does not give a provider blanket priority. Nutrients are resolved by
canonical nutrient ID, and differently sourced nutrients retain their own lineage.

Fridge and Shopping List placement applies that policy through a user-owned boundary.
An exact source match may fill a missing snapshot field, but it does not authorize a
source record to replace the entire saved item. A populated field changes only when the
new candidate has stronger accepted review state or confidence, more complete evidence
at the same evidence level, or a newer observation after the other factors tie. User
names, user-label fields and nutrients, canonical categories, and fully private foods
remain untouched. Each accepted list enrichment stores the selected source and the
specific reason for the change so later audits do not have to infer why it happened.

Generic-food search uses the same evidence rules for records connected by exact source
identifiers. Category, household measures, scientific name, alternate description,
preparation, source-record metadata, and each canonical nutrient are selected
independently. Similar names never create an identity link. Complete source and licence
attributions from every represented dataset stay on the read model. This transient
search merge never changes an accepted shared-catalog product; catalog improvements
still require persisted observations, selected field provenance, and a new revision.

The missing-field plan covers nutrition, images, categories, servings, ingredient text
and lists, recursive structured ingredients, ingredient analysis, additives, explicit
allergens, explicit traces, dietary tags, labels, package quantity, and provider
record/version metadata, including source dates and market countries when reported.
One provider returning nutrition does not stop another provider from contributing a
missing field. Provider-derived trace hypotheses stay in ingredient analysis; only
explicit source trace/advisory fields populate `May contain`. Applicable existing
products are backfilled through the same canonical enrichment transaction so recovered
data, provenance, normalized rows, and revisions remain consistent with future writes.
Historical submissions remain immutable evidence of what was actually submitted.
User-linked list reads load the current accepted canonical record instead of
rewriting those historical submissions or duplicating canonical metadata into every
saved snapshot.

Reported ingredient evidence is also projected into relational statement and component
rows. A structured provider tree retains its exact order, source path, nesting, source
wording, language, source payload, and any explicitly reported percentage bounds. A
reported list retains its order. Raw statement text is stored as one unparsed statement
rather than being split on punctuation. The original canonical JSON and source
observation remain the evidence authority, so the reported statement can be
reconstructed without guessing.

Authenticated catalog reads project that evidence through one server-owned ingredient
presentation model. It formats nested source paths, explicit exact/estimated percentage
bounds, additives, source dietary classifications, analysis coverage, and reviewed
ingredient tags for the nutrition deep dive. Invalid or absent percentages remain
absent, source analysis stays visibly distinct from blendCalc verification, and warning
explanations link the exact compatibility fact, source wording, active policy version,
confidence, and matching structured path when available. Browser components do not
reconstruct those semantics or use product names, brands, or categories as safety
evidence.

Canonical ingredient terms, aliases, parent relationships, derivatives, and processing
relationships are review-gated database records. Ingestion never creates them merely
because a provider emitted a word. Derivatives and processed ingredients default to no
parent-conflict inheritance; any inheritance or jurisdiction-specific exemption needs
reviewed evidence. Ingredient-derived compatibility facts link the exact component,
match rule, active policy version, and source observation used to create them.

Compatibility policy is deployed as an immutable version-bound bundle rather than a
mutable set of global rules. A draft clones the current extraction rules, conflict
rules, reviewed ingredient aliases and relationships, jurisdiction exemptions, and
regional profiles, plus reviewed mappings from canonical ingredient terminology to
preference tags. Activation records complete snapshots plus a deterministic content
hash, switches the active version, re-extracts every product, observation, and
submission fact, rebuilds the preference option catalog, and re-resolves saved account
preferences in one transaction. A retired bundle can be reactivated through the same
transaction for rollback. Runtime views expose only the active bundle, and facts and
preference mappings remain bound to that version, preventing mixed-version evaluations.
Jurisdiction exemptions are retained as context and cannot suppress a warning for an
explicitly selected personal preference.

The active terminology bundle currently includes reviewed English, French, and Spanish
aliases for canonical allergen ingredients and declarations. Matching is accent-aware,
language-scoped when source language is known, and limited to exact declarations or
token-bounded structured/list ingredients. It does not inspect product names, brands,
categories, or raw unparsed ingredient prose. Explicitly unsupported source languages
leave policy coverage incomplete rather than producing an unchecked success. Regional
labeling exemptions retain reviewed derivative, processing, threshold, and product
context, but remain explanatory only and never remove a personal warning.

Package precautionary statements are stored separately from ordinary ingredients and
provider analysis. Each row preserves exact wording, statement type, normalized
allergens, language, source field/reference, observation, and label revision. Multiple
statements remain independently traceable even when they mention the same allergen.
Compatibility facts link the exact statement and immutable match rule; the user-facing
nutrition view can group statements with friendly headings while still showing the
source wording. Legacy trace arrays can remain compatibility evidence, but they do not
fabricate a package statement when exact wording was not reported.
If a flat trace field and an exact package statement identify the same allergen, the
statement-linked fact replaces the duplicate flat fact so one disclosure cannot create
two warnings.

Source/API product names are normalized to readable title-style capitalization and use
`&` instead of the standalone word `and` before publication so inconsistent vendor
naming does not become app display names. Canonical food JSON stores `nameProvenance` as
`source`, `barcode`, or `user`: source and barcode-assisted names use the shared
formatter, while fully manual and personally renamed user-owned capitalization is
preserved exactly. Raw API cache payloads, observations, revisions, and evidence remain
unchanged.

- Exact normalized barcode matches provide association evidence regardless of whether
  the match comes from USDA or Open Food Facts. When USDA returns duplicate records for
  one GTIN, select the newest active `Branded` record.
- Generic USDA food searches prefer `Foundation`, then `SR Legacy`, then
  `Survey (FNDDS)` only after description relevance has been compared.
- Values from different sources are never averaged.
- Do not fill a missing packaged-label nutrient from a different or generic food record.
  Select values independently by field and preserve the accepted provider, source
  reference, and evidence for every field.
- A reported zero is kept as zero. A missing nutrient remains unknown.
- Accepted nutrients retain reported, reported-zero, or derived status plus any exact
  source-reported standard error, source nutrient key/code, mapping decision, and
  derivation method. Trace, present-but-unquantified, missing, invalid, and unmapped
  source facts remain review evidence and never enter nutrition or Mix math.
- Canonical categories are resolved through database options and mappings; they are not
  replaced with a generic packaged-food label during publication.
- Raw USDA and Open Food Facts category values remain attached to the food payload so
  mappings can improve without losing source information.
- Authoritative generic-food identities are typed separately from packaged products.
  Their reviewed taxonomy may identify an intrinsic allergen such as shellfish for
  shrimp. Packaged names, brands, descriptions, and categories never supply that
  evidence and never create `May contain`.
- Material serving, brand, unit, or nutrient disagreements are recorded as conflicts for
  review.
- Moderator-reviewed labels remain identified as community-reviewed rather than
  source-verified.
- Normalized nutrient and serving rows retain an exact source observation when one
  exists. Provider identity, an FDC ID, or a product-level source cannot independently
  verify a nutrient or serving; unsupported lineage remains `unknown`.
- Moderators and admins can inspect full field candidates and observation metadata
  through the role-gated, non-cacheable provenance endpoint. Public reads never expose
  raw payloads, submitter identity, private evidence, or reviewer identity.

Generic-food search remains separate from the shared packaged-product catalog. National
dataset records must contain canonical measured nutrition before they are searchable,
and exact source-declared identifiers may connect equivalent source records without
using a title guess. For example, `Oil, Apricot Kernel` is USDA SR Legacy FDC `171032`
and CNF 2026 food `441`; CNF declares USDA NDB `04530`, so the app can retain CNF's 97
measured nutrients and five household measures while preserving both source identities.
Source-derived list records are enriched on the server from an exact barcode or positive
USDA FDC identifier before placement. Older list snapshots use the same exact-match
backfill. Records with no exact detail match keep their existing measured data and
remain explicitly incomplete instead of receiving a similar-food substitution.

This structure allows another source to be added later without losing which source
supplied each value or silently replacing a trusted value.

Catalog intake and API publication are intentionally separate tiers. Private user saves
never publish automatically. Shareable observations and review candidates may improve
future evidence. Accepted field-by-field facts form the canonical catalog, while API v1
returns only canonical revisions that pass the enabled DB-backed publication profile.
An incomplete row remains available for enrichment and moderation without polluting the
public read contract.

The packaged-product profile requires exact GTIN identity; name, brand, category,
ingredients, market, and source metadata with selected provenance; every required core
nutrient with explicit value state and approved mapping; an evidence-backed primary
serving; acceptable redistribution policy; current verification; revision history; and
no unresolved medium/high conflict. Reported zero is valid evidence, not a missing-value
fallback. Missing, trace, unquantified, invalid, and unmapped values stay nonnumeric.
Failed products are withheld rather than deleted, and the existing moderator data-health
view shows the exact block reasons. See
[`api-structures/catalog-field-lineage.md`](api-structures/catalog-field-lineage.md)
for the response-field map and row audit.

## Existing Barcodes And Label Changes

An existing barcode does not make the catalog permanent or make a new label
automatically correct. Packaging, serving sizes, ingredients, allergens, and nutrition
can change over time.

1. The server compares the submitted label with the active blendCalc product first.
2. An unchanged match returns the existing product and creates no duplicate submission.
3. A clearly incompatible identity is blocked before normal moderation unless the user
   explicitly reports the catalog information as incorrect and provides complete
   package evidence.
4. A credible difference or explicit correction becomes a `product_update` submission linked to the active
   product and the exact revision reviewed by the comparison.
5. USDA and Open Food Facts are checked for exact-barcode support. Their results are
   stored as research context; neither provider silently replaces the canonical row.
6. Moderation shows the old and proposed values, source-check results, and private label
   evidence before approval.
7. Approval succeeds only if the base revision is still current. It merges only the
   reviewed fields into the active product, retains untouched data and provenance,
   appends an immutable revision, and stores each changed field in
   `shared_product_revision_changes`.
8. If another update was approved while the submission waited, approval stops as stale
   and the change must be compared again.

Independent users may submit separate correction evidence against the same active
revision. The system never averages conflicting values or silently chooses a provider.
The first approved correction advances the revision; every other pending correction
must then be re-compared before it can change the catalog.

Provider changes, open field conflicts, and confirmed warning reports retain separate
`catalog_correction_origins`. Each origin preserves the exact product, base revision,
affected field families, and a prefilled current snapshot. A later evidence-backed
catalog-correction submission links automatically only when its real changed fields
overlap that origin. Approval atomically records the exact resolving revision and closes
the linked work; rejection releases it for a later correction. The origin snapshot does
not invent a submission or satisfy evidence requirements by itself, so ordinary exact
matches and safe automated acceptance remain unchanged.

`label_observed_at` records when blendCalc saw the submitted label. It is not presented
as the date the manufacturer changed the product unless a separate source provides that
date. Revision history is retained for the future public API, while private evidence
paths remain moderator-only.

Legacy structural gaps use the same evidence boundary as new changes. The audited
catalog repair can reconstruct a missing first revision only from an exact approved
matching submission or exact stored source observation. It can repopulate missing
field-change rows only from that revision's already-valid structured change summary.
The repair never compares nearby snapshots, infers a manufacturer date, or invents a
historical difference. If retained evidence is insufficient, the gap remains visibly
unresolved and the product stays subject to the normal readiness gate.

Public API removal is separate from canonical deletion. A credible rights,
attribution, privacy, accuracy, or source-retirement concern can place a reversible
publication hold on one product, image, dataset release, or provider. The affected
public output fails closed immediately while the shared product, accepted revisions,
observations, and private evidence remain available for review. Product data changes
still require the normal immutable correction/revision workflow; releasing a hold never
silently changes canonical fields.

### Catalog Date And Evidence Semantics

Run `node scripts/audits/catalog/audit_catalog_transparency.mjs` to measure current
population
across canonical products, selected source observations, normalized rows, API v1
publication, and the app read model. Add `--json` for machine-readable output. The
report classifies each field as populated, sparse, or empty and prints representative
non-private values.

Run `npm run audit:api-catalog -- --json` for a fresh product-by-product publication
reassessment. It reads the live readiness gate and DB-owned issue contracts, separates
safe automated repairs from catalog, data-operations, food-policy, external, and system
work, and reports any blocker whose operational contract is not yet deployed. The audit
is read-only: it never repairs, publishes, or removes a product merely to improve its
result.

| User concept | Semantic owner | Meaning | Missing-value behavior |
| --- | --- | --- | --- |
| Last verified | `shared_products.last_verified_at` | Latest evidence-backed verification event accepted by blendCalc | Unknown; never substitute `updated_at`, a provider fetch date, or the current time |
| Current label since | Explicit manufacturer effective date when supplied; otherwise `shared_product_revisions.label_observed_at` | Manufacturer effective date, or the date blendCalc explicitly observed the current label when no manufacturer date exists | Unknown; revision creation and product update timestamps are not manufacturer label dates |
| Revision history | `shared_product_revisions` and `shared_product_revision_changes` | Immutable accepted snapshots and evidence-backed field changes | Leave unrecoverable historical differences unknown |
| Field source | `shared_product_field_provenance` joined to `shared_product_observations` | Selected observation, method, confidence, source reference, and observation date for one accepted field | Unknown; never fall back to the whole-product provider |
| Source quality | `shared_products.food.sourceMetadata` | Source-reported completeness, schema version, quality tags, dates, languages, and obsolete state | Not reported; absence is not a low-quality verdict |
| Serving source | `food_servings` | Reported serving and its source, reference, confidence, observation, or revision | No reported serving; the 100g nutrition basis is not a serving claim |
| Nutrient uncertainty | `food_nutrients`, `generic_food_nutrients`, and parent `nutrientSourceReview` | Source-reported standard error, source key/code, value status, mapping decision, review reference, and derivation method | Unknown uncertainty; absence does not alter nutrient math and nonnumeric source facts never become zero |
| Compatibility policy | `food_compatibility_policy_versions` | Immutable reviewed match/conflict rules and references for one policy version | No reproducible policy version |
| Compatibility evidence | `product_compatibility_facts` | Policy-versioned evidence from ingredients, declarations, traces, source identity, or reviewed analysis | No conflict found in available evidence; never proof that a food is safe |
| Relational ingredient evidence | `product_ingredient_statements` and `product_ingredient_components` | Lossless ordered projection of reported ingredient text/list/tree, including nesting and reported percentages | Keep the source statement unparsed when structure was not reported; never guess boundaries or percentages |
| Precautionary statement evidence | `product_precautionary_statements` | Exact package statement, normalized statement type/allergens, language, source, observation, and revision | Keep legacy normalized traces as evidence only; never invent exact package wording |
| Compatibility evaluation | Server read model | `conflict`, `checked`, `incomplete`, or `not_checked`, with explicit evidence coverage and applied policy version | `not_checked` without a user profile; missing evidence never becomes `checked` |

API v1 exposes current revision metadata, selected field sources with observation IDs,
observation dates, bounded evidence methods, and honest review states, source-record
metadata, structured ingredient analysis, serving sources, compatibility warnings, and
the shared compatibility-evaluation contract. Because public API reads have no signed-in
profile context, their personalized result remains `not_checked`; authenticated app
reads use the same contract with current user preferences and policy coverage.
Its separate bounded revision-history endpoint exposes immutable revision dates and
evidence-backed field changes without exposing historical food snapshots or private
moderation evidence. API nutrients expose safe value-status, standard-error, source-key,
mapping, and derivation metadata; internal mapping review references remain
moderator-only. The app keeps ordinary nutrition concise and translates only useful
bounded uncertainty summaries into the closed Data quality disclosure. Policy snapshots
and broader history remain future presentations rather than inferred UI claims.

Authenticated Nutrition details present the accepted record as a closed Food passport.
Its concise summary may use `shared_products.last_verified_at`, the latest accepted
`shared_product_revisions` row, `label_observed_at`, selected field provenance, and the
information already present in the hydrated food read model. It never substitutes
`updated_at` for verification or label history, never treats absent package evidence as
safe, and never hides current recalls or personalized warnings. Product/source metadata,
quality context, and correction tools remain available as nested disclosures for users
who want the deeper record without making that detail part of the default reading path.

Canonical nutrient lineage cannot come from provider-name similarity alone. Exact
provider identifiers and explicitly reviewed source keys own nutrient identity, exact
normalized units own lookup, and any unit change requires a reviewed nutrient-specific
conversion. Semantic taxonomy candidates remain pending moderation evidence and are
excluded from catalog/API publication until reviewed.

Authenticated app reads may additionally resolve an account's optional regulatory
region against the regional profile in that same immutable policy version. The result
records the authority and policy reference plus which selected allergen settings use
regulated terminology in that profile. Region is explanation and coverage context only:
it never changes product facts or suppresses personal conflict warnings. Unsupported
regions remain explicitly unchecked. Public API v1 reads have no account preference
context and therefore do not serialize this personalized regional evaluation.

## Serving Data

Reported serving sizes are normalized into `food_servings` when products are saved,
submitted, approved, revised, or observed. Each row keeps the readable label, gram
weight, optional amount/unit pair, primary flag, source reference, confidence, exact
measure metadata, serving origin, gram-weight method, and any measured calculation
basis. The product JSON remains a compatibility snapshot, but normalized rows are what
nutrition and Mix consume.

The nutrition view defaults to the primary reported serving when one exists and also
offers a 100g standard view. Missing source serving data stays missing; a 100g nutrition
basis is not treated as proof that the package reports a 100g serving. Database triggers
synchronize future writes, and the serving migration backfills valid serving data from
existing catalog and user food records only when an exact serving or user-entered value
supports it. Provider identity, food identity, names, and categories do not establish a
serving origin or weight-to-volume relationship.

## Runtime Source Boundary

Provider requests and caches are server-only enrichment inputs. The catalog checks
canonical data first, requests only missing permitted fields, coalesces identical
requests, and may use an explicitly stale cache only during a provider outage.
Provider credentials and raw licensed caches never enter public catalog responses.
USDA exact-barcode lookup retains one bounded detail read because the detail record adds
source category and availability fields omitted by search results. Shared caching and
request coalescing prevent repeated outbound detail calls. Open Food Facts remains a
missing-field supplement rather than a whole-product winner.

The full read/write/cache boundary is maintained in
[`data-architecture.md`](data-architecture.md), provider behavior in the
[`source data inventory`](api-structures/source-data-inventory.md), and source-specific
cache or reuse restrictions in
[`data-source-licensing.md`](data-source-licensing.md).

The database keeps origin, field authority, and verification separate. Origin identifies
each provider, field authority records which source supplied an accepted nutrition,
image, category, or serving value, and verification records evidence such as an exact
barcode match, corroboration, or moderator review. Public catalog membership does not
erase provider provenance. Compact cards do not expose provider or `Imported` hierarchy
badges; detailed nutrition keeps neutral source attribution and actionable verification
states remain consistent across views.
The database's role as the canonical product source is an internal data-flow rule, not a
consumer badge. Users see actionable verification, review, conflict, and completeness
states rather than a ranking of blendCalc, USDA, Open Food Facts, or future providers.

Saved Fridge and Shopping List rows hold normalized links to the active
`shared_products` row and the current user's pending `shared_product_submissions` row.
Database triggers refresh those links after a list write, automatic publication,
moderator action, product retirement, or source/confidence change. The UI reads these
links and their indexed origin/verification projection instead of guessing from an
older JSON snapshot. This means an approved product cannot continue to display a stale
state, and a pending catalog update can display `Pending` without pretending the
underlying active product has disappeared.

## Source Quality Monitoring

External source usage is measured in privacy-safe daily aggregates. Runtime metrics
separate logical lookups from real outbound requests and USDA cache hits, then track
source errors, exact matches, nutrient depth, useful product metadata, and response
time. They do not retain barcodes, search terms, users, or raw API responses.

Because later providers normally receive harder or incomplete records, runtime match
rates are not a fair provider ranking. Controlled benchmarks send the same saved
barcodes to each source and treat availability, nutrient depth, useful metadata, latency,
and calls per lookup as operational evidence—not blanket trust.

The maintained report and benchmark commands, options, and interpretation notes belong
in [`../scripts/README.md`](../scripts/README.md#source-quality-audits).
The generic-dataset contribution audit uses exact identifiers for identity evidence and
a balanced search corpus only to measure CNF/CoFID usefulness. It cannot create an
identity link or source-priority decision from similar names.

### Scheduled Product Revalidation

Active canonical products are checked outside user requests through the bounded catalog
monitor. The database owns provider identity, due time, priority, retry state, and
result. Open Food Facts checks revision/update metadata before downloading a full
record; USDA checks only a known FDC id. Recently used products move forward in the
queue, while inactive products pause.

Every changed response becomes an immutable source observation and normalized snapshot.
Identity, serving, nutrient, ingredient, allergen, image, and ABV differences are
compared field by field. Material differences create a review record while the last
approved canonical revision remains active. A moderator may dismiss a provider change,
or complete the existing catalog correction workflow and link the resulting approved
revision; the monitor never overwrites `shared_products` directly.

### Readiness And Operational Issues

Canonical availability and public API publication are separate states. Every product
has one service-only `catalog_product_readiness` record with:

- shared-catalog state: `Active`, `Waiting for review`, or `Blocked`;
- API v1 state: `Ready` or `Withheld`;
- explicit blendCalc search and use availability; and
- current revision, correction, conflict, verification, and API-withholding context.

`Withheld` means that API v1 cannot legally or accurately publish the record yet. It
does not hide an otherwise active product from blendCalc. Current operational gaps are
projected through `catalog_health_issue_occurrences`. Stable issue metadata owns
urgency, responsible work group, supported resolution action, and whether a reviewed
evidence-only repair can be offered. Friendly UI wording remains application-owned.

The product-readiness passport is the bounded operational read for this state. It joins
the current canonical revision, independent blendCalc/API availability, evidence
coverage counts, and normalized open issues without exposing raw observations or user
evidence. Catalog review and data operations share the contract while retaining
separate route and database permissions.

### Official Recall Matching

FDA recall announcements, FDA enforcement records, and USDA FSIS recalls/public-health
alerts are ingested with immutable revisions and exact identifiers. The announcement
channel closes the gap where FDA has published a current notice that has not yet reached
openFDA enforcement data. Match policy is deliberately conservative:

- an exact normalized GTIN can become visible immediately;
- a strong brand, product, and package identity match requires moderation;
- title-only similarity creates no match;
- lot, use-by, and package evidence stays attached so the UI can ask the user to check
  the current package instead of claiming every package is affected; and
- a closed official notice supersedes current matches without deleting its history.

An official notice does not modify the product record or imply that products without a
match are safe. Active exact and confirmed matches are shown on catalog-backed foods and
exposed through the public product contract with source attribution and an official
link. Raw source payloads, private match evidence, moderator identity, and per-user
delivery state remain outside public reads.

## Catalog Security Boundary

Authenticated users may read active catalog products and their own submissions, but
browser clients cannot publish, review, reject, or mutate canonical catalog rows.
Publication and enrichment use transactional server-only database functions. Revisions
are append-only, stale approvals cannot overwrite a newer revision, and public reads
exclude submitters, private evidence, raw provider payloads, and reviewer identities.

The complete object, RLS, function, and Storage map is maintained in
[`supabase-schema.md`](supabase-schema.md). General server and credential boundaries are
maintained in [`data-architecture.md`](data-architecture.md), database operation
commands in [`database-testing.md`](database-testing.md), and privileged review behavior
in [`moderation.md`](moderation.md).

## Moderation

Pending product submissions appear on `/moderation` for moderators and admins. Review
all three evidence photos against the entered serving and nutrient values before
approval.

- **Approve:** publishes the submitted label as `community-reviewed` and appends a
  revision. Existing-product updates also preserve the superseded revision and
  structured before/after fields.
- **Approve image:** if the submission has a front-package image, the moderator can
  review the automatic card placement and adjust it when needed. Approval copies that
  image into public product image storage and records it in `food_image_assets`,
  including the accepted fit, crop, zoom, clockwise quarter-turn rotation, placement
  method, algorithm version, and confidence. Automatic placement never bypasses image
  approval. Once approved, the image can become canonical automatically only when the
  product does not already have an eligible canonical front image.
- **Trusted source image placement:** when an exact-barcode provider supplies a new
  licensed front image, the server caches it with the honest Full image default and
  schedules bounded OCR placement. A confident result may update only that untouched,
  unapproved placement metadata; it does not verify the product, approve a community
  image, or overwrite any user-adjusted or moderator-approved crop.
- **Canonical image admission:** every shared product may have one selected canonical
  front image. An eligible selected image remains stable; later imports stay available
  as candidates instead of silently replacing it. If the selected image is retired, the
  database promotes the next exact licensed or moderator-approved candidate. Public API
  reads expose only the selected canonical front image and still require complete asset
  redistribution metadata.
- **Reject:** retains the private user ingredient, records the review note, and does not
  publish a shared product.
- **Submission pause:** moderator-rejected submissions are counted cumulatively in
  `user_catalog_submission_enforcement`. Rejection 51 starts a six-calendar-month pause
  on new public catalog submissions. Automated validation declines do not count. A new
  rejection after an expired pause starts another six-month pause, while private food
  tracking remains available. `product_submission_blocks` preserves every suspension
  as audit history.

## Submission And Moderation Improvement Plan

The current schema already gives us useful pieces: private custom foods, shared product
submissions, approved shared products, observations, field provenance, conflicts,
validation reports, evidence photos, and rejection blocks. New catalog features should
use those pieces first.

### Intake Outcomes

When a user tries to share a barcoded manual entry, route it into one of these clear
outcomes:

1. **Private save only:** no valid barcode, no consent, or a conflicting barcode has
   been explicitly removed. A user-authored identity must never remain attached to a
   verified barcode for private saving.
2. **Already in catalog:** barcode exists and submitted data matches the active shared
   product. Tell the user it already exists; do not create a duplicate submission.
3. **Catalog update request:** barcode exists, but the user’s data has meaningful
   differences. Let the user submit evidence, send it to moderation, and keep their
   private ingredient unchanged.
4. **Trusted source auto-accept:** barcode has a trusted source match and submitted data
   matches closely enough. Publish without human review and keep source provenance.
5. **Human review:** unknown label, same-product source disagreement, or missing
   confidence. Require package, nutrition label, and barcode evidence.
6. **Evidence-aware divergence:** an exact-GTIN submission that materially differs from
   the current product becomes a correction when it includes the required current
   package evidence. A definite identity contradiction without that evidence remains
   private and does not create ordinary review work.

### Suggested Checks

- **Barcode:** valid GTIN format, duplicate active product, duplicate pending
  submission, trusted-source match, and source mismatch.
- **Identity:** product name similarity, brand similarity, category similarity, and
  ingredient list similarity.
- **Serving:** positive serving weight, unit consistency, and volume/weight consistency
  when both are present.
- **Nutrients:** required nutrients present, typed `0` accepted as real data, no
  negative values, child nutrients not greater than parent nutrients, and extreme values
  flagged.
- **Evidence:** front package, nutrition label, and barcode photos required for unknown
  labels, catalog update requests, and source disagreement.
- **User history:** repeated human rejections pause sharing, but silent machine blocks
  should be tracked separately unless we explicitly decide they should count.

### Auto-Accept Candidates

- Exact trusted barcode source match with no material conflicts.
- Existing shared product match with no changes.
- Missing optional nutrients filled from a trusted source without changing user-entered
  required label data.

### Auto-Block Candidates

These should not show as normal moderation rows unless we intentionally want moderators
to audit them:

- Barcode belongs to an existing catalog product, but the submitted name/brand/category
  is clearly unrelated.
- Barcode has a trusted source match, but the submitted nutrients differ materially;
  require current package evidence and route it as a correction rather than assuming
  the magnitude proves the submission is wrong.
- Submission appears to reuse a barcode for a different product.
- Required evidence is absent after the flow already told the user it is required.

### Schema Note

Normal `rejected` submissions count toward the 51st-rejection sharing suspension.
Historical `auto_declined` rows remain non-punitive audit records. New same-GTIN
differences are not assigned that status based on value magnitude; they either become
evidence-backed corrections or remain private when correction evidence is missing.

Current server behavior compares new barcoded submissions against an active shared
product before deciding the outcome:

- matching catalog data returns `already-available` and does not create a new
  submission;
- meaningful differences become a pending catalog update request with evidence;
- material same-GTIN changes with complete current-package evidence become pending
  catalog corrections; identity contradictions without that evidence stay private.

## Verification Rules

Current automatic checks reject:

- invalid or missing barcodes
- blank product names
- missing nutrient data
- negative or non-finite nutrient values
- non-positive serving weights
- fiber or sugar values greater than total carbohydrates

These checks identify malformed data; they do not prove that a manually entered label is
truthful. Human review and complete image evidence remain required when USDA cannot
verify the barcode.

## Nutrition Completeness Flow

Packaged products and generic foods use different evidence paths:

1. Exact barcode lookup checks the blendCalc catalog/cache first.
2. Missing packaged-product fields are filled independently from active legal sources.
   USDA nutrition stays authoritative when reported; another source may supply only an
   image, category, or serving.
3. Generic search can return active national dataset records. These keep their original
   food/preparation identity and are not automatically merged into a packaged barcode
   product.
4. A database-backed completeness profile checks whether required nutrients are
   reported. It does not change missing, trace, or unmapped values into zero.
5. Optional label recognition may suggest missing packaged-label values, but the user
   must review and confirm them. Confirmed values remain user-label observations and
   follow normal moderation rules if shared.

Every accepted nutrient keeps its own source and source reference. Product-level field
provenance separately records product name, brand, nutrition, image, category, serving,
ingredient, allergen, trace, precautionary-statement, label, additive, package, and
source-metadata fields. A fuller
secondary record may supplement missing fields but cannot silently overwrite an
authoritative reported value or zero.

Source adapters assign food identity from their own reviewed contracts. Exact GTIN or
brand evidence may independently identify a packaged product, but an unrecognized
provider datatype does not. Unclassified records remain explicitly unknown and are
excluded from packaged-label and authoritative-generic completeness conclusions until
their adapter or canonical review supplies an identity.

## Product Identifier QR Codes

The scanner supports uncompressed GS1 Digital Link product QR codes containing
application identifier `01` and a valid GTIN-14. The app extracts that GTIN locally and
then uses the normal DB-first barcode lookup. It does not request the scanned URL. Lot,
serial, expiration, query, and fragment data are removed before the safe product-level
reference is stored. GS1 is therefore identifier provenance, not nutrition-source
provenance.

## Source Lifecycle

Provider availability and legal status are checked before benchmarks or runtime
integration. FoodRepo retired on 2026-02-28, so its source row is disabled and the
planned benchmark is recorded as not run rather than misreported as poor coverage.
Active providers must be tested on the same representative barcode sample before source
priority changes.

## QA Moderation Fixtures

Create clearly marked pending submissions in the disposable local test database without
calling outside product APIs. Run `npm run db:test:start` first so the local credentials
and seeded moderator account exist:

```sh
npm run catalog:qa-seed -- moderator@example.com
```

This creates one complete-but-questionable submission and one submission with missing
evidence. QA fixtures display review flags and cannot be approved, so use the Reject
action to exercise the moderation flow safely. Remove leftover fixtures with:

```sh
npm run catalog:qa-clean -- moderator@example.com
```

Create fake image-review submissions for the moderated product image flow in the same
disposable local database:

```sh
npm run catalog:qa-image-seed -- moderator@example.com
```

This creates one image-addition fixture and one image-adjustment fixture with private
front-package, nutrition-label, and barcode evidence. These fixtures are approvable so
the public image-publish path can be tested; reject them if you only need to check the
moderation UI. Remove unapproved leftovers with:

```sh
npm run catalog:qa-image-clean -- moderator@example.com
```
