# Shared product catalog

The shared catalog lets one verified packaged product become searchable for every signed-in user without exposing the account that submitted it.

## User flow

1. A user scans or enters a valid UPC/EAN barcode.
2. The ingredient is always saved to that user's private custom-food list first.
3. For eligible labels, the user can explicitly opt in to catalog review.
4. The server validates the barcode, serving weight, nutrient values, and basic macro relationships.
5. An exact USDA FoodData Central barcode match is published automatically, with USDA selected as the canonical source.
6. Unknown labels require front-package, nutrition-label, and barcode photos.
7. Unknown labels stay pending until a moderator approves or rejects them.
8. Approved products appear in ingredient text search and are checked before outside barcode services.
9. Accounts with 5 rejected shared-product submissions in 30 days are paused from sharing products for 30 days.

Submitting is optional. A failed catalog submission never rolls back the user's private ingredient.
Submission pauses only affect shared catalog submissions. Users can still save private
custom foods, use their fridge, and build mixes.

## Source policy

- **USDA FoodData Central:** exact barcode matches may auto-publish. USDA data is CC0/public domain.
- **Open Food Facts:** used for live barcode lookup with attribution. Its ODbL records are not copied into this independently managed shared catalog. Package image metadata may be stored in `food_image_assets` with source, license, attribution, and confidence so the UI can render source-backed images without treating the full record as shared catalog data.
- **User-entered labels:** may be published only after moderator review.

## Provenance and merging

Every published field records the observation that supplied it. Source observations,
selected field provenance, and disagreements are stored separately from the canonical
product row.

- Exact USDA barcode matches outrank user-entered values.
- Values from different sources are never averaged.
- A secondary source may fill a nutrient only when the canonical source did not report it.
- A reported zero is kept as zero. A missing nutrient remains unknown.
- Material serving, brand, unit, or nutrient disagreements are recorded as conflicts for review.
- Moderator-reviewed labels remain identified as community-reviewed rather than source-verified.

This structure allows another source to be added later without losing which source supplied
each value or silently replacing a trusted value.

## API caching

USDA search, barcode search, and detail responses are cached server-side in Supabase with
expiration timestamps. The browser never receives the USDA API key. Cached USDA data reduces
rate-limit pressure but is not treated as permanently current.

Open Food Facts is queried live and is not copied into `shared_products` or the API cache.
Allowed package image metadata is stored separately in `food_image_assets` with attribution.
Trusted DB/API product images are used first. User-uploaded product photos stay in
private evidence storage until a moderator approves them, then a public
`community-reviewed` image asset is created with the moderator's crop values.
Its ODbL database terms still require a deliberate share-alike and attribution decision before
building a broader derived database from its records.

Keep source handling explicit. Do not merge Open Food Facts payloads into `shared_products` unless the entire downstream database licensing and attribution model is intentionally changed.

## Database security

Migrations:

- `supabase/migrations/20260614190000_shared_product_catalog.sql`
- `supabase/migrations/20260614200000_catalog_provenance_cache_and_evidence.sql`
- `supabase/migrations/20260615230000_product_submission_rejection_blocks.sql`

- Authenticated users can read only active `shared_products` and their own submissions.
- Browser clients cannot insert, update, approve, reject, or delete shared catalog rows.
- Server routes authenticate the user, then use the server-only Supabase admin client.
- Publication happens through one transactional, service-role-only database function.
- Product revisions are append-only and serialized per barcode.
- Only one pending moderation submission can exist for a barcode at a time.
- Public product rows do not contain submitter IDs or email addresses.
- Evidence images are private, short-lived signed URLs are created only for moderators,
  and evidence paths never appear in public product rows.
- Approved public product images live in `food-image-assets`; private evidence
  paths are never exposed through public ingredient data.
- API cache, source observations, provenance, and conflict tables are service-role only.

Apply and regenerate types:

```sh
npm run db:push:dry
npm run db:push
npm run db:types
```

## Moderation

Pending product submissions appear on `/moderation` for moderators and admins. Review all
three evidence photos against the entered serving and nutrient values before approval.

- **Approve:** publishes the submitted label as `community-reviewed` and appends a revision.
- **Approve image:** if the submission has a front-package image, the moderator can
  adjust the card crop. Approval copies that image into public product image
  storage and records it in `food_image_assets`.
- **Reject:** retains the private user ingredient, records the review note, and does not publish a shared product.
- **Submission pause:** 5 rejected submissions in 30 days blocks new shared-catalog
  submissions for 30 days. This prevents repeated bad catalog entries without blocking
  private food tracking.

## Submit and moderation improvement plan

The current schema already gives us useful pieces: private custom foods, shared
product submissions, approved shared products, observations, field provenance,
conflicts, validation reports, evidence photos, and rejection blocks. New
catalog features should use those pieces first.

### Intake outcomes

When a user tries to share a barcoded manual entry, route it into one of these
clear outcomes:

1. **Private save only:** no valid barcode, no consent, or the user chooses not to share.
2. **Already in catalog:** barcode exists and submitted data matches the active shared product. Tell the user it already exists; do not create a duplicate submission.
3. **Catalog update request:** barcode exists, but the user’s data has meaningful differences. Let the user submit evidence, send it to moderation, and keep their private ingredient unchanged.
4. **Trusted source auto-accept:** barcode has a trusted source match and submitted data matches closely enough. Publish without human review and keep source provenance.
5. **Human review:** unknown label, source disagreement, missing confidence, or user chose to keep their own data over a source match. Require package, nutrition label, and barcode evidence.
6. **Silent machine block:** barcode/source match is wildly different from the submitted data. Save the private ingredient if valid, but do not create a normal moderation item.

### Suggested checks

- **Barcode:** valid GTIN format, duplicate active product, duplicate pending submission, trusted-source match, and source mismatch.
- **Identity:** product name similarity, brand similarity, category similarity, and ingredient list similarity.
- **Serving:** positive serving weight, unit consistency, and volume/weight consistency when both are present.
- **Nutrients:** required nutrients present, typed `0` accepted as real data, no negative values, child nutrients not greater than parent nutrients, and extreme values flagged.
- **Evidence:** front package, nutrition label, and barcode photos required for unknown labels, catalog update requests, and source disagreement.
- **User history:** repeated human rejections pause sharing, but silent machine blocks should be tracked separately unless we explicitly decide they should count.

### Auto-accept candidates

- Exact trusted barcode source match with no material conflicts.
- Existing shared product match with no changes.
- Missing optional nutrients filled from a trusted source without changing user-entered required label data.

### Auto-block candidates

These should not show as normal moderation rows unless we intentionally want
moderators to audit them:

- Barcode belongs to an existing catalog product, but the submitted name/brand/category is clearly unrelated.
- Barcode has a trusted source match, but the submitted nutrients are wildly outside the source range.
- Submission appears to reuse a barcode for a different product.
- Required evidence is absent after the flow already told the user it is required.

### Schema note

Normal `rejected` submissions count toward the 5-rejection sharing pause.
Silent machine blocks use `shared_product_submissions.status = 'auto_declined'`
and do not count as normal moderator rejections. That keeps spam protection
useful without punishing honest users who hit a machine guardrail while saving a
private ingredient.

Current server behavior compares new barcoded submissions against an active
shared product before deciding the outcome:

- matching catalog data returns `already-available` and does not create a new
  submission;
- meaningful differences become a pending catalog update request with evidence;
- wildly unrelated data is stored as `auto_declined` for audit and never appears
  in the normal moderation queue.

## Verification rules

Current automatic checks reject:

- invalid or missing barcodes
- blank product names
- missing nutrient data
- negative or non-finite nutrient values
- non-positive serving weights
- fiber or sugar values greater than total carbohydrates

These checks identify malformed data; they do not prove that a manually entered label is
truthful. Human review and complete image evidence remain required when USDA cannot verify
the barcode.

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
