# Shared product catalog

The shared catalog lets one verified packaged product become searchable for every
signed-in user without exposing the account that submitted it.

## User flow

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
9. Accounts with 5 rejected shared-product submissions in 30 days are paused from
   sharing products for 30 days.

Barcode autofill and publication use two category layers: raw category values from the
source APIs remain on the food payload for provenance, while `category_option_id` points
to the clean DB-backed category shown in the app. Publication is blocked if a canonical
category cannot be resolved.

Submitting is optional. A failed catalog submission never rolls back the user's private
ingredient. Submission pauses only affect shared catalog submissions. Users can still
save private custom foods, use their fridge, and build mixes.

## Source policy

- **blendCalc shared catalog:** the active `shared_products` row plus its normalized
  nutrient, serving, image, category, provenance, and revision records is the canonical
  source of truth for published product reads. External providers do not bypass or
  overwrite accepted nonmissing canonical fields.
- **USDA FoodData Central:** exact barcode matches may auto-publish. USDA data is
  CC0/public domain. Exact USDA fields may fill missing canonical fields when the
  observation, selected provenance, and revision are saved together.
- **Open Food Facts:** used for live barcode lookup with attribution. Its ODbL records
  are not copied into this independently managed shared catalog. Package image metadata
  may be stored in `food_image_assets` with source, license, attribution, and confidence
  so the UI can render source-backed images without treating the full record as shared
  catalog data.
- **User-entered labels:** may be published only after moderator review.

Whether a provider may populate the future public blendCalc dataset is stored in
`product_data_sources` through `canonical_storage_allowed`, license, review date, and
policy notes. Application code must not infer redistribution permission from a provider
name.

## Provenance and merging

Every published field records the observation that supplied it. Source observations,
selected field provenance, and disagreements are stored separately from the canonical
product row.

When a canonical product is incomplete, the server may consult source caches and
external APIs only for the missing fields. A legally reusable exact-source value can be
promoted into the canonical row through the server-only enrichment transaction, which
rechecks that the field is still missing before writing it. Existing canonical values
are not silently replaced. Provider data whose terms do not allow inclusion in the
future blendCalc public dataset remains in its isolated licensed cache or image-asset
path and is never disguised as blendCalc-owned canonical data.

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
- Canonical categories are resolved through database options and mappings; they are not
  replaced with a generic packaged-food label during publication.
- Raw USDA and Open Food Facts category values remain attached to the food payload so
  mappings can improve without losing source information.
- Material serving, brand, unit, or nutrient disagreements are recorded as conflicts for
  review.
- Moderator-reviewed labels remain identified as community-reviewed rather than
  source-verified.

This structure allows another source to be added later without losing which source
supplied each value or silently replacing a trusted value.

## Existing barcodes and label changes

An existing barcode does not make the catalog permanent or make a new label
automatically correct. Packaging, serving sizes, ingredients, allergens, and nutrition
can change over time.

1. The server compares the submitted label with the active blendCalc product first.
2. An unchanged match returns the existing product and creates no duplicate submission.
3. A clearly incompatible identity is blocked before normal moderation.
4. A credible difference becomes a `product_update` submission linked to the active
   product and the exact revision reviewed by the comparison.
5. USDA and Open Food Facts are checked for exact-barcode support. Their results are
   stored as research context; neither provider silently replaces the canonical row.
6. Moderation shows the old and proposed values, source-check results, and private label
   evidence before approval.
7. Approval succeeds only if the base revision is still current. It updates the active
   product, appends an immutable revision, and stores each changed field in
   `shared_product_revision_changes`.
8. If another update was approved while the submission waited, approval stops as stale
   and the change must be compared again.

`label_observed_at` records when blendCalc saw the submitted label. It is not presented
as the date the manufacturer changed the product unless a separate source provides that
date. Revision history is retained for the future public API, while private evidence
paths remain moderator-only.

## Serving data

Reported serving sizes are normalized into `food_servings` when products are saved,
submitted, approved, revised, or observed. Each row keeps the readable label, gram
weight, optional amount/unit pair, primary flag, source reference, and confidence. The
product JSON remains a compatibility snapshot, but the normalized rows are what
nutrition views load and what future mix conversions should consume.

The nutrition view defaults to the primary reported serving when one exists and also
offers a 100g standard view. Missing source serving data stays missing; a 100g nutrition
basis is not treated as proof that the package reports a 100g serving. Database triggers
synchronize future writes, and the serving migration backfills valid serving data from
existing catalog and user food records.

## API caching

USDA search, barcode search, and detail responses are cached server-side in Supabase
with expiration timestamps. Open Food Facts barcode responses use the same server-only
cache in a separate provider namespace. Open Food Facts cache rows remain raw ODbL
provider data: they are not blended into USDA data or treated as independently owned
canonical records. Cache expiration, attribution, and source identity remain explicit so
broader reuse can continue to meet the provider's license and refresh requirements.

The browser never receives provider credentials. Cached data reduces rate-limit pressure
but is not treated as permanently current. A recent expired row may be used only as a
temporary outage fallback. ETags refresh unchanged records without downloading the body
again. Cache failures do not block a successful live lookup. Barcode providers try the
normal package code before padded equivalents, stop after the first exact usable match,
and share an identical request that is already running instead of starting a duplicate
call. Allowed package image metadata is stored separately in `food_image_assets` with
attribution. Trusted DB/API product images are used first. User-uploaded product photos
stay in private evidence storage until a moderator approves them, then a public
`community-reviewed` image asset is created with the moderator's crop values. Its ODbL
database terms still require attribution, provider separation, refresh planning, and a
deliberate share-alike decision before building a broader derived database from its
records.

Keep source handling explicit. Do not merge Open Food Facts payloads into
`shared_products` unless the entire downstream database licensing and attribution model
is intentionally changed.

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

## Source quality monitoring

External source usage is measured in privacy-safe daily aggregates. Runtime metrics
separate logical lookups from real outbound requests and USDA cache hits, then track
source errors, exact matches, nutrient depth, useful product metadata, and response
time. They do not retain barcodes, search terms, users, or raw API responses.

Use `npm run report:source-quality` to inspect normal traffic. Because later providers
normally receive harder or incomplete records, runtime match rates are not a fair
head-to-head ranking. Run `npm run benchmark:source-quality -- --limit=10` and then
`npm run report:source-quality -- --origin=benchmark` to send the same saved barcodes to
both sources. Treat that coverage report as evidence about availability and fullness,
not permission to assign one provider a blanket whole-product trust level.

Use `--reset-today` when validating a code-level request optimization. It clears only
today's synthetic `benchmark` rows before the run, leaving runtime metrics untouched, so
old benchmark behavior does not distort the new calls-per-lookup result.

Both reports show `Calls / lookup`. The controlled benchmark warns when a source
averages more than 2.5 outbound calls per logical lookup so equivalent barcode fan-out,
unnecessary detail requests, and excessive retries are caught before a new source is
trusted at production scale.

## Database security

Migrations:

- `supabase/migrations/20260614190000_shared_product_catalog.sql`
- `supabase/migrations/20260614200000_catalog_provenance_cache_and_evidence.sql`
- `supabase/migrations/20260615230000_product_submission_rejection_blocks.sql`
- `supabase/migrations/20260715120000_shared_product_canonical_categories.sql`
- `supabase/migrations/20260719210000_canonical_product_external_enrichment.sql`
- `supabase/migrations/20260719213000_versioned_product_label_updates.sql`
- `supabase/migrations/20260719214000_canonical_category_display.sql`
- `supabase/migrations/20260718000000_server_request_efficiency.sql`
- `supabase/migrations/20260718130000_user_food_list_catalog_links.sql`
- `supabase/migrations/20260718131000_user_food_list_catalog_link_defaults.sql`
- `supabase/migrations/20260718132000_strict_user_food_list_catalog_state.sql`

- Authenticated users can read only active `shared_products` and their own submissions.
- Browser clients cannot insert, update, approve, reject, or delete shared catalog rows.
- Server routes authenticate the user, then use the server-only Supabase admin client.
- Publication happens through one transactional, service-role-only database function.
- Product revisions are append-only and serialized per barcode. Existing-product
  submissions identify their base revision, and stale approvals cannot overwrite a
  newer revision.
- Shared submissions, products, and revisions retain an indexed foreign key to
  `custom_food_category_options`; database triggers prevent category loss while
  publishing or creating revisions. The canonical label is also synchronized into
  compatibility food payloads so UI and future API reads never mistake `Custom
  Ingredient` origin for a category.
- Only one pending moderation submission can exist for a barcode at a time.
- Saved list catalog links are database-resolved and cannot be forged by a
  browser-provided source, trust status, product id, or submission id.
- Public product rows do not contain submitter IDs or email addresses.
- Evidence images are private, short-lived signed URLs are created only for moderators,
  and evidence paths never appear in public product rows.
- Approved public product images live in `food-image-assets`; private evidence paths are
  never exposed through public ingredient data.
- API cache, source observations, provenance, and conflict tables are service-role only.

Apply and regenerate types:

```sh
npm run db:push:dry
npm run db:push
npm run db:types
```

Repair legacy shared products after category mappings change:

```sh
npm run backfill:shared-product-categories
```

The backfill checks both USDA FoodData Central and Open Food Facts, keeps raw
observations and source references, then stores the resolved canonical category on
submissions, products, and revisions.

## Moderation

Pending product submissions appear on `/moderation` for moderators and admins. Review
all three evidence photos against the entered serving and nutrient values before
approval.

- **Approve:** publishes the submitted label as `community-reviewed` and appends a
  revision. Existing-product updates also preserve the superseded revision and
  structured before/after fields.
- **Approve image:** if the submission has a front-package image, the moderator can
  adjust the card crop. Approval copies that image into public product image storage and
  records it in `food_image_assets`.
- **Reject:** retains the private user ingredient, records the review note, and does not
  publish a shared product.
- **Submission pause:** 5 rejected submissions in 30 days blocks new shared-catalog
  submissions for 30 days. This prevents repeated bad catalog entries without blocking
  private food tracking.

## Submit and moderation improvement plan

The current schema already gives us useful pieces: private custom foods, shared product
submissions, approved shared products, observations, field provenance, conflicts,
validation reports, evidence photos, and rejection blocks. New catalog features should
use those pieces first.

### Intake outcomes

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
6. **Silent machine block:** the submitted product identity is wildly different from the
   verified barcode match. Offer verified autofill or remove the barcode and save the
   user-authored item privately; do not create a normal moderation item.

### Suggested checks

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

### Auto-accept candidates

- Exact trusted barcode source match with no material conflicts.
- Existing shared product match with no changes.
- Missing optional nutrients filled from a trusted source without changing user-entered
  required label data.

### Auto-block candidates

These should not show as normal moderation rows unless we intentionally want moderators
to audit them:

- Barcode belongs to an existing catalog product, but the submitted name/brand/category
  is clearly unrelated.
- Barcode has a trusted source match, but the submitted nutrients are wildly outside the
  source range.
- Submission appears to reuse a barcode for a different product.
- Required evidence is absent after the flow already told the user it is required.

### Schema note

Normal `rejected` submissions count toward the 5-rejection sharing pause. Silent machine
blocks use `shared_product_submissions.status = 'auto_declined'` and do not count as
normal moderator rejections. That keeps spam protection useful without punishing honest
users who hit a machine guardrail while saving a private ingredient.

Current server behavior compares new barcoded submissions against an active shared
product before deciding the outcome:

- matching catalog data returns `already-available` and does not create a new
  submission;
- meaningful differences become a pending catalog update request with evidence;
- wildly unrelated data is stored as `auto_declined` for audit and never appears in the
  normal moderation queue.

## Verification rules

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
provenance separately records nutrition, image, category, and serving sources. A fuller
secondary record may supplement missing fields but cannot silently overwrite an
authoritative reported value or zero.

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

## QA moderation fixtures

Create clearly marked pending submissions without calling outside product APIs:

```sh
npm run catalog:qa-seed -- moderator@example.com
```

This creates one complete-but-questionable submission and one submission with missing
evidence. QA fixtures display review flags and cannot be approved, so use the Reject
action to exercise the moderation flow safely. Remove leftover fixtures with:

```sh
npm run catalog:qa-clean -- moderator@example.com
```

Create fake image-review submissions for the moderated product image flow:

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
