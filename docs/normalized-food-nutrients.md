# Normalized food nutrients

This document owns nutrient normalization, synchronization, and application-read
semantics. The complete table and column reference remains in
[`supabase-schema.md`](supabase-schema.md).

Food records retain their source snapshot for reconstruction and audit, while
`food_nutrients` is the authoritative application query model for normalized nutrient
values. A missing normalized row remains missing; readers do not silently recover it
from legacy embedded JSON.

## Data Ownership

- `nutrient_definitions` owns canonical nutrient identity, number, name, unit, and
  display/reference metadata.
- `food_nutrients` owns one normalized per-100g value for exactly one parent:
  fridge or shopping-list item, custom food, pending shared-product submission, active
  shared product, shared-product revision, or source observation.

Each value retains reported-versus-derived status, source/reference, confidence, and an
exact selected source observation when canonical provenance supports one. The schema
map owns the column list and relationships; this document owns how those rows are
created and consumed.

## Synchronization

Database triggers rebuild a parent's normalized rows whenever its nutrition JSON or
relevant provenance metadata changes. This covers browser writes, moderation approval,
catalog revisions, and future server-side imports. Deleting a parent deletes its
nutrient rows through foreign-key cascades.

The migration also backfills all existing food snapshots.

Barcode imports canonicalize enabled nutrient aliases before persistence. The
`20260727120000_canonical_barcode_nutrient_mappings.sql` corrective migration applies
the same database-reviewed equivalences to existing list items, custom foods, catalog
submissions, catalog products, revisions, and source observations. Reported values and
units are preserved; duplicate aliases yield to an already-present canonical nutrient.

## Application reads

The application hydrates the existing `FdcFood.foodNutrients` contract from the
normalized tables for:

- fridge and shopping-list items
- saved custom foods
- active shared catalog products returned by barcode lookup or search

Reads are batched by parent ID and nutrient definitions are fetched once per batch.
Existing graph, nutrition-total, warning, and nutrient-detail code then uses the
hydrated values without needing a second data model.

An empty normalized result is an empty nutrient set, not permission to substitute an
embedded snapshot, invent zeroes, or copy values from a similar food. Migration and
backfill work must populate applicable rows before readers depend on a new normalized
field.

Saved drinks intentionally retain their embedded recipe snapshots. Loading a saved drink
continues to reproduce what the user saved rather than silently changing historical
recipe nutrition when catalog data changes.

## Access control

- Users can read normalized rows owned by their account.
- Authenticated users can read nutrients for active shared products.
- Pending submissions, source observations, and revisions remain server-only unless the
  row belongs to the submitting user.
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

## Change Workflow

Nutrient schema changes follow the migration, verification, deployment, type-generation,
backfill, documentation, and QA workflow in
[`database-testing.md`](database-testing.md),
[`supabase-schema.md`](supabase-schema.md#update-checklist), and the authoritative
database rules in [`dev-rules/dev-rules.md`](dev-rules/dev-rules.md). Do not maintain a
second command sequence here.
