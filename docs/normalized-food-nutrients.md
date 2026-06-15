# Normalized food nutrients

Food records continue to store their full `food` JSON payload. That JSON is the
lossless source snapshot used by the current application. The normalized tables
added in `20260615010000_normalized_food_nutrients.sql` make nutrient data
queryable without discarding or rewriting the source payload.

## Tables

### `nutrient_definitions`

One row per FoodData Central nutrient ID:

- nutrient name and number
- default unit
- timestamps

USDA-backed records may refresh the canonical label and unit. User-entered data
cannot overwrite an existing canonical definition.

### `food_nutrients`

One row per nutrient and parent food snapshot. A row belongs to exactly one of:

- fridge or shopping-list item
- custom food
- pending shared-product submission
- active shared product
- shared-product revision
- source observation

Each row records:

- amount per 100 grams
- unit
- whether the value was reported or derived
- source and source reference
- confidence
- the selected source observation, when canonical catalog provenance identifies one

The parent JSON remains authoritative for reconstruction and auditing. The
normalized row is the query model.

## Synchronization

Database triggers rebuild a parent's normalized rows whenever its nutrition JSON
or relevant provenance metadata changes. This covers browser writes, moderation
approval, catalog revisions, and future server-side imports. Deleting a parent
deletes its nutrient rows through foreign-key cascades.

The migration also backfills all existing food snapshots.

## Application reads

The application hydrates the existing `FdcFood.foodNutrients` contract from the
normalized tables for:

- fridge and shopping-list items
- saved custom foods
- active shared catalog products returned by barcode lookup or search

Reads are batched by parent ID and nutrient definitions are fetched once per
batch. Existing graph, nutrition-total, warning, and nutrient-detail code then
uses the hydrated values without needing a second data model.

The embedded `food` JSON remains the automatic fallback when normalized rows are
empty or unavailable. This permits a safe deployment order: application code can
ship before the migration, and older or incomplete records remain readable.

Saved drinks intentionally retain their embedded recipe snapshots. Loading a
saved drink continues to reproduce what the user saved rather than silently
changing historical recipe nutrition when catalog data changes.

## Access control

- Users can read normalized rows owned by their account.
- Authenticated users can read nutrients for active shared products.
- Pending submissions, source observations, and revisions remain server-only
  unless the row belongs to the submitting user.
- Browser roles cannot directly insert, update, or delete normalized rows.

The trigger functions use `security definer`, an empty `search_path`, and revoked
execute privileges so clients cannot invoke the synchronization path directly.

## Example queries

Find the current user's custom foods with the most protein per 100 grams:

```sql
select
  custom_foods.food ->> 'description' as food_name,
  food_nutrients.amount_per_100g,
  food_nutrients.unit_name
from public.food_nutrients
join public.custom_foods
  on custom_foods.id = food_nutrients.custom_food_id
where food_nutrients.owner_user_id = auth.uid()
  and food_nutrients.nutrient_id = 1003
order by food_nutrients.amount_per_100g desc;
```

Find active shared products high in fiber:

```sql
select
  shared_products.product_name,
  food_nutrients.amount_per_100g,
  food_nutrients.unit_name,
  food_nutrients.source,
  food_nutrients.confidence
from public.food_nutrients
join public.shared_products
  on shared_products.id = food_nutrients.shared_product_id
where shared_products.status = 'active'
  and food_nutrients.nutrient_id = 1079
order by food_nutrients.amount_per_100g desc;
```

## Deploying

Review and apply the migration, then regenerate database types:

```bash
npm run db:push:dry
npm run db:push
npm run db:types
```

Run `db:types` after `db:push`; the checked-in database types include the new
tables so this branch can compile before the remote migration is applied.
