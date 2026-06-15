# Shared product catalog

The shared catalog lets one verified packaged product become searchable for every signed-in user without exposing the account that submitted it.

## User flow

1. A user scans or enters a valid UPC/EAN barcode.
2. The ingredient is always saved to that user's private custom-food list first.
3. For eligible labels, the user can explicitly opt in to catalog review.
4. The server validates the barcode, serving weight, nutrient values, and basic macro relationships.
5. An exact USDA FoodData Central barcode match is published automatically.
6. Unknown labels stay pending until a moderator approves or rejects them.
7. Approved products appear in ingredient text search and are checked before outside barcode services.

Submitting is optional. A failed catalog submission never rolls back the user's private ingredient.

## Source policy

- **USDA FoodData Central:** exact barcode matches may auto-publish. USDA data is CC0/public domain.
- **Open Food Facts:** used for live barcode lookup with attribution. Its ODbL records are not copied into this independently managed shared catalog. If a barcode already exists there, no duplicate catalog submission is created.
- **User-entered labels:** may be published only after moderator review.

Keep source handling explicit. Do not merge Open Food Facts payloads into `shared_products` unless the entire downstream database licensing and attribution model is intentionally changed.

## Database security

Migration: `supabase/migrations/20260614190000_shared_product_catalog.sql`

- Authenticated users can read only active `shared_products` and their own submissions.
- Browser clients cannot insert, update, approve, reject, or delete shared catalog rows.
- Server routes authenticate the user, then use the server-only Supabase admin client.
- Publication happens through one transactional, service-role-only database function.
- Product revisions are append-only and serialized per barcode.
- Only one pending moderation submission can exist for a barcode at a time.
- Public product rows do not contain submitter IDs or email addresses.

Apply and regenerate types:

```sh
npm run db:push:dry
npm run db:push
npm run db:types
```

## Moderation

Pending product submissions appear on `/moderation` for moderators and admins. Review the barcode, source match, and all submitted nutrient values before approval.

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

These checks identify malformed data; they do not prove that a manually entered label is truthful. Human review remains required when USDA cannot verify the barcode.
