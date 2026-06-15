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

Submitting is optional. A failed catalog submission never rolls back the user's private ingredient.

## Source policy

- **USDA FoodData Central:** exact barcode matches may auto-publish. USDA data is CC0/public domain.
- **Open Food Facts:** used for live barcode lookup with attribution. Its ODbL records are not copied into this independently managed shared catalog. If a barcode already exists there, no duplicate catalog submission is created.
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
Its ODbL database terms require a deliberate share-alike and attribution decision before
building a derived database from its records.

Keep source handling explicit. Do not merge Open Food Facts payloads into `shared_products` unless the entire downstream database licensing and attribution model is intentionally changed.

## Database security

Migrations:

- `supabase/migrations/20260614190000_shared_product_catalog.sql`
- `supabase/migrations/20260614200000_catalog_provenance_cache_and_evidence.sql`

- Authenticated users can read only active `shared_products` and their own submissions.
- Browser clients cannot insert, update, approve, reject, or delete shared catalog rows.
- Server routes authenticate the user, then use the server-only Supabase admin client.
- Publication happens through one transactional, service-role-only database function.
- Product revisions are append-only and serialized per barcode.
- Only one pending moderation submission can exist for a barcode at a time.
- Public product rows do not contain submitter IDs or email addresses.
- Evidence images are private, short-lived signed URLs are created only for moderators,
  and evidence paths never appear in public product rows.
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
- **Reject:** retains the private user ingredient, records the review note, and does not publish a shared product.

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
