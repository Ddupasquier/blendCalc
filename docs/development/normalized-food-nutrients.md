# Normalized Food Nutrients

This document owns nutrient normalization, synchronization, and application-read
semantics. The complete table and column reference remains in
[`supabase-schema.md`](supabase-schema.md).

Food records retain their source snapshot for reconstruction and audit.
`food_nutrient_measurements` is the authoritative application query model for nutrient
values on their exact reported mass, volume, or serving basis. `food_nutrients` remains
the backward-compatible per-100g projection and contains only values that have an exact
mass basis. A missing normalized row remains missing; readers do not silently recover
it from legacy embedded JSON or invent a mass conversion.

## Quick Navigation

| Need                           | Sections                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Understand canonical ownership | [Data Ownership](#data-ownership) and [Synchronization](#synchronization)                                           |
| Read nutrient data             | [Application Reads](#application-reads), [Access Control](#access-control), and [Example Queries](#example-queries) |
| Change the model safely        | [Change Workflow](#change-workflow)                                                                                 |

## Data Ownership

- `nutrient_definitions` owns canonical nutrient identity, number, name, unit, and
  display/reference metadata.
- `food_nutrient_measurements` owns one exact-basis value for exactly one parent:
  fridge or shopping-list item, custom food, pending shared-product submission, active
  shared product, shared-product revision, or source observation.
- `food_nutrients` owns the compatible per-100g projection for those same parents when
  the source value is already per 100g or has an exact reported gram basis.
- `food_nutrient_qualitative_evidence` owns explicit source statements such as `<1 g`
  or `not a significant source`. These rows are evidence, not exact nutrient amounts,
  and never enter nutrition calculations.

An exact nutrient basis is one of:

- mass, such as `100 g`;
- volume, such as `100 mL` or `1 tbsp`;
- one source-defined serving, such as `2 cookies` or `1 bottle`.

Volume and source-defined servings are never projected into grams without an exact
serving weight or an active, reviewed, product-specific mass-volume conversion policy
linked to the same source observation. Product names, categories, and assumptions such
as “water equals 1 g/mL” are not conversion evidence.

Each value retains reported-versus-derived status, source/reference, confidence, and an
exact selected source observation when canonical provenance supports one. The schema
map owns the column list and relationships; this document owns how those rows are
created and consumed.

## Synchronization

Database triggers rebuild a parent's exact-basis rows whenever its nutrition JSON or
relevant provenance metadata changes. The per-100g synchronization keeps an
independently reported 100g value as reported. For any other native basis, it creates a
secondary projection only when an exact mass conversion exists: a mass unit, a verified
product-specific mass-volume policy, or the matching source serving's exact gram
weight. The projection is marked `derived` with `exact-native-basis-to-100g`; the
original package measurement remains unchanged and authoritative. This covers browser
writes, moderation approval, catalog revisions, and future server-side imports.
Deleting a parent deletes both forms through foreign-key cascades.

The migration also backfills all existing food snapshots.

Qualitative statements synchronize independently from numeric measurements. An exact
numeric value for a nutrient takes display and calculation priority. A bounded statement
retains its upper limit and native basis, while an unquantified statement retains only
the source wording. Removing the statement returns that nutrient to unknown; it does not
create a zero. Only attributed, canonically mapped, reviewed qualitative evidence may
satisfy blendCalcAPI publication completeness, and only while its source policy explicitly
permits API redistribution. Reviewed package-label evidence can complete the app's safety
and nutrition context while remaining withheld from blendCalcAPI.

blendCalcAPI v1 keeps its mass-normalized `amountPer100g` contract. When that value is
calculated from an exact native serving, the response marks the normalized value as
`derived`, retains the package observation's reported status under
`quality.sourceValueStatus`, scales any retained standard error by the same exact
factor, and exposes `exact-native-basis-to-100g` as the derivation method. A native
serving without exact mass evidence returns no per-100g amount.

blendCalcAPI exposes accepted qualitative evidence with `amountPer100g: null`, its
explicit value status, and `quality.reportedLimit`. This lets consumers distinguish
`<1 g`, present-but-unquantified, reported zero, and genuinely missing data without
using a bound as an exact value.

Barcode imports canonicalize enabled nutrient aliases before persistence. The
`20260727120000_canonical_barcode_nutrient_mappings.sql` corrective migration applies
the same database-reviewed equivalences to existing list items, custom foods, catalog
submissions, catalog products, revisions, and source observations. Reported values and
units are preserved; duplicate aliases yield to an already-present canonical nutrient.

Source nutrient mappings are active only after a source identifier or exact source key
and unit receive an explicit reviewed decision. Taxonomy and name similarity can suggest
a candidate for review, but cannot mark a nutrient canonical. Runtime mapping requires
the exact normalized source unit; a different unit requires a reviewed nutrient-specific
conversion. Legacy semantic mapping metadata remains noncanonical lineage rather than
being deleted or silently trusted.

Exact provider identifiers, reviewed keys, and dataset mappings continue through the
automated path and never become routine human work. A semantic candidate receives a
stable mapping UUID and remains disabled with `pending_review` status. An AAL2 admin or
developer may open its focused data-operations route, choose only a nutrient with a
compatible reviewed unit path, cite identity evidence, and approve it as
`moderator_verified`; or exclude it. The decision is immutable. Approval affects future
normalization and deliberate reprocessing, not historical values through an implicit
rewrite.

## Application Reads

The application fills the source-neutral `FoodItem.foodNutrients` contract from
`food_nutrient_measurements`, falling back to the legacy per-100g table only during a
rollout where the exact-basis table is not yet available. This applies to:

- fridge and shopping-list items
- saved custom foods
- active shared catalog products returned by barcode lookup or search

Reads are batched by parent ID and nutrient definitions are fetched once per batch.
Nutrition details and Mix scale each value only through a compatible exact basis:
grams for mass, milliliters for volume, or serving multipliers for source-defined
servings. Packaged foods open on their primary reported serving. A secondary 100g view
is available only when every displayed nutrient has an exact path to mass. A count such
as one cookie is not treated as one gram. An exact package volume may be the primary
serving without any gram value; Mix uses that native volume only when the nutrient basis
is compatible.

An empty normalized result is an empty nutrient set, not permission to substitute an
embedded snapshot, invent zeroes, or copy values from a similar food. Migration and
backfill work must populate applicable rows before readers depend on a new normalized
field.

Saved recipes intentionally retain their embedded composition snapshots. Loading a saved recipe
continues to reproduce what the user saved rather than silently changing historical
recipe nutrition when catalog data changes.

## Access Control

- Users can read normalized rows owned by their account.
- Authenticated users can read nutrients for active shared products.
- Pending submissions, source observations, and revisions remain server-only unless the
  row belongs to the submitting user.
- Browser roles cannot directly insert, update, or delete normalized rows.

The trigger functions use `security definer`, an empty `search_path`, and revoked
execute privileges so clients cannot invoke the synchronization path directly.

## Example Queries

Find the current user's custom-food protein measurements with their exact basis:

```sql
select
  custom_foods.food ->> 'description' as food_name,
  food_nutrient_measurements.amount,
  food_nutrient_measurements.unit_name,
  food_nutrient_measurements.basis_kind,
  food_nutrient_measurements.basis_quantity,
  food_nutrient_measurements.basis_unit_key,
  food_nutrient_measurements.basis_serving_label
from public.food_nutrient_measurements
join public.custom_foods
  on custom_foods.id = food_nutrient_measurements.custom_food_id
where food_nutrient_measurements.owner_user_id = auth.uid()
  and food_nutrient_measurements.nutrient_id = 1003
order by food_nutrient_measurements.amount desc;
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
