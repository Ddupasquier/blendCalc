# Supabase Schema

This document is the plain-language map of the app-owned Supabase schema. The source of
truth remains the migrations in `supabase/migrations/` and the generated types in
`src/lib/types/database.types.ts`; update this file whenever tables, relationships,
policies, or core data ownership changes.

## Schema Navigation

| Domain | Tables and registries |
| --- | --- |
| [Core User Data](#core-user-data) | `profiles`, `user_tutorial_preferences`, `user_food_preferences`, `user_compatibility_rules`, `mix_preferences` |
| [Ingredient Lists and Saved Mixes](#ingredient-lists-and-saved-mixes) | `user_food_list_items`, `custom_foods`, `saved_drinks`, `ingredient_provenance_options`, `app_issue_codes` |
| [Nutrients and Validation](#nutrient-definitions-values-and-validation) | `nutrient_definitions`, `food_nutrients`, `nutrient_manual_entry_*`, `nutrient_relationship_rules` |
| [Product Sources and Servings](#product-reference-data-and-serving-measures) | `product_data_sources`, source metrics/mappings/conversions, serving measures, `food_servings` |
| [Shared Product Catalog](#shared-product-catalog-and-barcode-flow) | submissions, products, revisions, observations, provenance, conflicts, images, caches, and submission blocks |
| [Compatibility and Allergens](#compatibility-allergens-and-dietary-restrictions) | tags, conflict rules, product facts, preference options, and API observations |
| [Food Categories](#custom-food-category-reference) | category options, source observations, and canonical mappings |
| [Moderation](#moderation-and-access-control) | roles, account moderation, action logs, email delivery, blocked signups, and image-policy acceptance |
| [Nutrition Completeness and National Datasets](#nutrition-completeness-and-national-datasets) | completeness profiles, generic foods, exact source identifiers, CNF, CoFID, and future national food datasets |
| [Product Source Policies](#product-source-policies) | source evaluations and source-specific lifecycle policy |
| [Database Functions](#rpc--database-functions) | Shared trigger helpers, validation, search, publication, and API read functions |
| [Storage](#storage-buckets) | Private avatar and product-submission evidence buckets |
| [Schema Update Checklist](#update-checklist) | Required migration, documentation, type, backfill, and test work |

## Schema Rules

- Auth accounts live in Supabase Auth (`auth.users`). App data lives in `public`.
- User-owned tables reference `auth.users(id)` and use RLS so users only read or mutate
  their own rows.
- Shared/reference tables are readable by authenticated users when the data is safe to
  expose, but writes should go through server-only scripts, migrations, moderation
  tools, or service-role code.
- API-observed reference data keeps provenance (`source`, `sources`, `source_count`,
  timestamps, raw payloads, or observations) so we know where it came from and how
  trustworthy it is.
- Nutrition, compatibility, and category UI should render from DB-backed
  definition/catalog tables, not hardcoded component constants.

## Core User Data

| Table                       | Primary Key | Owner Scope             | Purpose                                                                                                    | Key Relationships                                                    |
| --------------------------- | ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `profiles`                  | `user_id`   | One row per auth user   | Display/profile data, appearance preference, avatar metadata, and avatar policy state                       | `user_id → auth.users.id`                                            |
| `user_tutorial_preferences` | `user_id`   | One row per auth user   | Tracks tutorial seen/completed/remind-later state                                                          | `user_id → auth.users.id`                                            |
| `user_food_preferences`     | `user_id`   | One row per auth user   | Optional unit system, allergens, dietary restrictions, nutrient priorities, and default serving preference | `user_id → auth.users.id`                                            |
| `user_compatibility_rules`  | `id`        | Many rows per auth user | Normalized active warnings/downrank rules derived from user food preferences                               | `user_id → auth.users.id`, optional `tag_id → compatibility_tags.id` |
| `mix_preferences`           | `user_id`   | One row per auth user   | Persisted smoothie goals and versioned Mix state                                                           | `user_id → auth.users.id`                                            |

### `profiles`

Stores app-facing profile information. Email should not be copied here.

| Table | Documented columns |
| --- | --- |
| `profiles` | `user_id`, `display_name`, `bio`, `appearance_theme`, `avatar_path`, `avatar_alt_text`, `avatar_moderation_status`, `avatar_policy_acknowledged_at`, `created_at`, `updated_at` |

Notes:

- `display_name` is required and auto-filled with a safe `User##########` style value if
  the user has not chosen one.
- `appearance_theme` is constrained to `system`, `light`, or `dark` and defaults to
  `system`.
- Avatar files live in the private `profile-avatars` storage bucket under the user id
  folder.

### `user_food_preferences`

Stores optional, potentially sensitive preference inputs. These are user-owned and
should not be required to use the app.

| Table | Documented columns |
| --- | --- |
| `user_food_preferences` | `user_id`, `unit_system`, `allergens`, `dietary_restrictions`, `prioritized_nutrient_ids`, `default_smoothie_serving_grams`, `sensitive_acknowledged_at`, `created_at`, `updated_at` |

Notes:

- Older broad preference fields were removed from the UI direction; keep the app focused
  on actionable allergens, dietary restrictions, and prioritized nutrients.
- `sync_user_compatibility_rules` keeps preference choices aligned with normalized
  compatibility rules.

## Ingredient Lists and Saved Mixes

| Table                           | Primary Key          | Owner Scope             | Purpose                                                                             | Key Relationships                                                                |
| ------------------------------- | -------------------- | ----------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `user_food_list_items`          | `id`                 | Many rows per auth user | User fridge and shopping-list items                                                 | `user_id → auth.users.id`, optional active shared product and pending submission |
| `custom_foods`                  | `id`                 | Many rows per auth user | User-created custom foods and barcode/manual-entry payloads                         | `user_id → auth.users.id`                                                        |
| `saved_drinks`                  | `id`                 | Many rows per auth user | Saved smoothie recipes/mixes                                                        | `user_id → auth.users.id`                                                        |
| `ingredient_provenance_options` | `(dimension, value)` | Shared reference        | DB-backed source/trust filters and badge presentation for ingredient list/search UI | No direct user ownership                                                         |

### `user_food_list_items`

Stores the user's active ingredient lists.

| Table | Documented columns |
| --- | --- |
| `user_food_list_items` | `id`, `user_id`, `list_type`, `fdc_id`, `food`, `food_identity_key`, `shared_product_id`, `shared_product_submission_id`, `source_key`, `trust_status`, `created_at`, `updated_at` |

Notes:

- `list_type` is `fridge` or `shopping`.
- `food` is the normalized ingredient payload used by app UI.
- `food.nameProvenance` records whether the display name is source-managed,
  barcode-assisted, or explicitly user-owned. Source and barcode names use the shared
  title-style formatter and replace standalone `and` with `&`; personal renames keep the
  user's exact wording and casing.
- `food.canonicalDescription` retains the source, shared-catalog, generic-dataset, or
  original private-food name when `food.description` is replaced by a personal list
  name. Ingredient cards use the personal name; nutrition details use the canonical
  name. Existing rows are backfilled from exact shared-product, generic-food, or
  private-food identity links when available.
- `food_identity_key` is generated from the normalized barcode when available, otherwise
  from the FDC id.
- `shared_product_id` links the saved item to the active approved catalog product for
  its normalized barcode. `shared_product_submission_id` links the current user's
  pending catalog submission for that barcode.
- A database trigger resolves both links and derives `source_key` and `trust_status`
  from current catalog evidence. Product publication, retirement, moderation approval,
  rejection, and new pending submissions refresh matching list rows automatically.
- `trust_status` can be `source-verified`, `imported`, `corroborated`,
  `moderator-reviewed`, `pending-review`, `unverified`, or `user-private`. `Imported` is
  retained only as a legacy/internal ingestion method; provider-only rows project to
  `unverified`. A pending update takes priority for the submitting user, while accepted
  exact-match, corroboration, or moderator evidence uses a verified evidence state.
- `source_key` records `unknown` rather than falsely defaulting an unattributed row to
  USDA. `source_key` and `trust_status` support indexed internal queries. Consumer filters do
  not expose provider or ingestion-method hierarchy. The `food` JSON remains a UI
  compatibility snapshot and is not the authority for pending or approved state.
- `(user_id, food_identity_key)` is unique, so one ingredient cannot exist in both
  Fridge and Shopping List for the same user.
- `place_user_food_list_item` performs an atomic add or confirmed move and reports when
  a move needs user confirmation.
- `move_user_food_list_items` moves a checked set in one transaction. It rejects stale
  or partial selections instead of moving only part of the requested set.
- Indexed for user/list sorting, pagination, source filtering, and text search.

### `custom_foods`

Private custom ingredients are written through `save_custom_food` (or the bulk
`save_custom_foods` recovery path), not through direct browser inserts or updates. The
database derives the owner from the signed-in session, validates the food name, serving
weight, canonical category, GTIN check digit, required nutrients, nutrient catalog
membership, duplicate nutrients, nonnegative values, and active nutrient relationship
rules in one transaction. A `category_option_id` foreign key records the canonical
category separately from the preserved source/category strings in the food JSON. Direct
authenticated inserts and updates are revoked so browser code cannot bypass this
validation path. Database triggers mirror that canonical label into the compatibility
`food.foodCategory` field; `Custom Ingredient` is never used as a category substitute.

Stores private user custom foods. Shared/public review happens through
`shared_product_submissions`, not by making every custom food public.

| Table | Documented columns |
| --- | --- |
| `custom_foods` | `id`, `user_id`, `fdc_id`, `barcode`, `name_key`, `category_option_id`, `search_text`, `source_key`, `trust_status`, `food`, `created_at`, `updated_at` |

Notes:

- Unique safeguards prevent duplicate custom names and duplicate user barcodes.
- `search_text` is trigger-maintained and trigram-indexed for partial server search.
- Normalized nutrients for a custom food live in `food_nutrients`.
- The `food` JSON stores `nameProvenance`. Valid-barcode and autofilled names are
  normalized before saving, including standalone `and` → `&`; barcode-free private names
  and later personal renames preserve the user's exact wording.

### `saved_drinks`

Stores a saved mix snapshot.

| Table | Documented columns |
| --- | --- |
| `saved_drinks` | `id`, `user_id`, `name`, `drink`, `created_at`, `updated_at` |

Notes:

- Drink names are unique per user.
- `drink` is JSON because saved mix composition has app-specific structure.

### `ingredient_provenance_options`

Stores app-ready origin and verification metadata. Provider rows remain available for
internal attribution; only actionable verification rows are enabled for compact badges.

| Table | Documented columns |
| --- | --- |
| `ingredient_provenance_options` | `dimension`, `value`, `filter_label`, `badge_label`, `badge_tone`, `display_order`, `filter_enabled`, `badge_enabled`, `description`, `created_at`, `updated_at` |

Notes:

- `dimension` separates record origin (`source`) from verification evidence (`trust`).
- Supporting APIs used only for images or unit conversion do not become a food's primary
  source attribution.
- Compact components render only enabled actionable verification badges from the shared
  reference read. Detailed nutrition renders provider attribution separately.

### `app_issue_codes`

Stores stable machine-readable codes used by database-backed validation and business
rules.

| Table | Documented columns |
| --- | --- |
| `app_issue_codes` | `code`, `kind`, `domain`, `description`, `enabled`, `created_at`, `updated_at` |

Notes:

- `description` is developer-facing contract documentation and must never be rendered as
  user-interface copy.
- The database owns rule evidence, severity, thresholds, and issue-code references.
- Server boundaries return approved codes with bounded, non-sensitive parameters.
- Friendly wording belongs to the versioned application message catalog so it remains
  available during database outages and can be tested, revised, and translated.
- Direct table access is restricted to the service role.

## Nutrient Definitions, Values, and Validation

| Table                                      | Primary Key   | Owner Scope                              | Purpose                                                                                                                     | Key Relationships                                                               |
| ------------------------------------------ | ------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `nutrient_definitions`                     | `nutrient_id` | Shared reference                         | Canonical nutrient names, numbers, and default units                                                                        | Referenced by every nutrient table                                              |
| `food_nutrients`                           | `id`          | Shared or user-owned depending on parent | Normalized nutrient values per 100g for list items, custom foods, shared products, submissions, revisions, and observations | Exactly one parent id; `nutrient_id → nutrient_definitions.nutrient_id`         |
| `nutrient_manual_entry_groups`             | `id`          | Shared reference                         | Versioned DB-owned manual-entry UI groups and hidden review queues                                                           | Summarizes observation evidence without surrendering UI policy                  |
| `nutrient_manual_entry_fields`             | `nutrient_id` | Shared reference                         | Versioned DB-owned nutrient placement, labels, order, visibility, aliases, and review state                                  | `nutrient_id → nutrient_definitions`, `group_id → nutrient_manual_entry_groups` |
| `nutrient_manual_entry_required_nutrients` | `nutrient_id` | Shared validation reference              | DB-backed list of required manual-entry nutrients such as calories, macros, and sodium                                      | `nutrient_id → nutrient_definitions`, `group_id → nutrient_manual_entry_groups` |
| `nutrient_manual_entry_observations`       | `id`          | Shared reference/provenance              | Raw source API nutrient observations retained separately from approved UI classification                                    | Raw and canonical nutrient ids → `nutrient_definitions`                         |
| `nutrient_relationship_rules`              | `id`          | Shared validation reference              | DB-backed nutrient math/relationship rules, such as child nutrients not exceeding parent nutrients                          | `parent_nutrient_id` and `child_nutrient_id → nutrient_definitions`             |

### `nutrient_definitions`

Canonical nutrient lookup table.

| Table | Documented columns |
| --- | --- |
| `nutrient_definitions` | `nutrient_id`, `nutrient_name`, `nutrient_number`, `default_unit_name`, `created_at`, `updated_at` |

Notes:

- This table is the anchor for manual entry, normalized nutrients, nutrient goal
  selection, and nutrient relationship validation.

### `food_nutrients`

Stores normalized nutrient facts for any supported food parent.

| Table | Documented columns |
| --- | --- |
| `food_nutrients` | `id`, `owner_user_id`, `user_food_list_item_id`, `custom_food_id`, `shared_product_submission_id`, `shared_product_id`, `shared_product_revision_id`, `shared_product_observation_id`, `nutrient_id`, `amount_per_100g`, `unit_name`, `value_origin`, `source`, `source_reference`, `source_observation_id`, `confidence`, `created_at`, `updated_at` |

Notes:

- A row must point to exactly one parent food record.
- Private user nutrients use `owner_user_id`; shared/catalog nutrients should not be
  user-owned.
- Unique indexes prevent duplicate nutrient rows for the same parent.

### `nutrient_manual_entry_*`

These tables make manual-entry UI DB-driven.

| Table | Documented columns |
| --- | --- |
| `nutrient_manual_entry_groups` | `id`, `entry_step`, `title`, `sort_order`, `enabled`, `group_role`, `source_count`, `observation_count`, `verification_status`, `sources`, `last_observed_at`, timestamps |
| `nutrient_manual_entry_fields` | `dedupe_key`, `nutrient_id`, `group_id`, `nutrient_type`, `display_label`, `required_for_manual_entry`, `sort_order`, `enabled`, `source_count`, `observation_count`, `verification_status`, `sources`, `last_observed_at`, `classification_status`, `classification_source_key`, `classification_reference`, `classification_version`, `classification_notes`, `replacement_nutrient_id`, `reviewed_at`, timestamps |
| `nutrient_manual_entry_required_nutrients` | `nutrient_id`, `requirement_key`, `group_id`, `field_sort_order`, `reason`, `source`, `source_count`, `observation_count`, `sources`, `provenance`, `enabled`, timestamps |
| `nutrient_manual_entry_observations` | Source/query/reference fields, raw `nutrient_id`, approved `canonical_nutrient_id`, observed group/field metadata, source payload, and timestamps |

Notes:

- Seeded by `scripts/seeds/seed_manual_entry_nutrients.mjs` through the current approved DB
  catalog. The script records new source nutrients but does not invent their UI group.
- Groups/fields render from enabled, approved DB rows only. Macros contains common
  nutrition-label fields; specialized carbohydrates, fats, carotenoids, vitamins,
  minerals, amino acids, and other composition data remain in Extended.
- Required status should render from `nutrient_manual_entry_required_nutrients` via
  `nutrient_manual_entry_fields.required_for_manual_entry`; do not maintain a separate
  UI-only required nutrient list.
- Observations preserve raw API provenance. Unknown nutrients go to the disabled
  unclassified review group until an approved DB classification is added. Retired
  aliases retain a canonical replacement rather than becoming duplicate inputs.
- Observation sync updates evidence counts only. It cannot overwrite approved DB
  grouping, labels, order, visibility, semantic type, or aliases.
- Observation seeds write in bounded idempotent batches and call
  `sync_nutrient_manual_entry_fields()` once after the import. The database does not
  rescan the full observation catalog after every batch.

### `nutrient_relationship_rules`

Stores validation rules for nutrient math.

| Table | Documented columns |
| --- | --- |
| `nutrient_relationship_rules` | `id`, `parent_nutrient_id`, `child_nutrient_id`, `relationship`, `severity`, `issue_code`, `requires_parent`, `tolerance`, `enabled`, `sort_order`, `source`, `source_count`, `observation_count`, `sources`, `provenance`, `created_at`, `updated_at` |

Notes:

- Used by client and server paths so canonical nutrient validation is not browser-only.
- Current rule type is `child_must_not_exceed_parent`.
- `issue_code → app_issue_codes.code`; the client message catalog combines that code
  with the joined nutrient labels to produce friendly wording.

## Product Reference Data and Serving Measures

The source responsibilities, useful field inventory, legal-storage boundary, and
provider-module map are documented in
[`api-structures/source-data-inventory.md`](./api-structures/source-data-inventory.md).
Source observations and caches remain separate from approved canonical catalog data.

These tables replace runtime nutrient, source, serving-unit, alias, and unit-conversion
constants. The app loads them from Supabase and uses them when it interprets USDA
FoodData Central and Open Food Facts products.

| Table                          | Primary Key                                                               | Purpose                                                                                                                          | Key Relationships                                                                         |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `product_data_sources`         | `key`                                                                     | Canonical identity, display name, URLs, terms, and observation history for each external API, standards API, or internal catalog | Referenced by all source-specific mapping and serving tables                              |
| `product_source_daily_metrics` | `(metric_date, source_key, source_data_type, lookup_kind, lookup_origin)` | Privacy-safe daily API usage, reliability, match, nutrient-depth, metadata-coverage, cache, and timing counters                  | `source_key → product_data_sources.key`                                                   |
| `nutrient_source_mappings`     | `(source_key, source_nutrient_key, source_unit_name)`                     | Maps a source API nutrient key and unit to the app's canonical nutrient                                                          | `source_key → product_data_sources.key`, `nutrient_id → nutrient_definitions.nutrient_id` |
| `nutrient_unit_conversions`    | `(source_key, nutrient_id, from_unit_name, to_unit_name)`                 | Stores source- and nutrient-specific conversion multipliers                                                                      | `source_key → product_data_sources.key`, `nutrient_id → nutrient_definitions.nutrient_id` |
| `serving_measure_units`        | `key`                                                                     | App-ready serving units, labels, dimensions, order, defaults, and conversion to grams or milliliters                             | `source_key → product_data_sources.key`                                                   |
| `serving_measure_aliases`      | `(unit_key, normalized_alias)`                                            | Recognizes API and label spellings such as `tbsp`, `tablespoon`, and `tablespoons`                                               | `unit_key → serving_measure_units.key`, `source_key → product_data_sources.key`           |
| `food_servings`                | `id`                                                                      | Normalized reported serving sizes used by nutrition views and future mix conversions                                             | Exactly one food parent; optional `unit_key → serving_measure_units.key`                  |

### `product_data_sources`

| Table | Documented columns |
| --- | --- |
| `product_data_sources` | `key`, `display_name`, `source_type`, `homepage_url`, `api_base_url`, `terms_url`, `attribution_text`, `enabled`, observation counts/timestamps, `provenance`, `canonical_storage_allowed`, `canonical_license_name`, `canonical_policy_reviewed_at`, `canonical_policy_notes`, `api_redistribution_allowed`, and timestamps |

Canonical storage and API redistribution stay disabled until the provider's downstream
storage and redistribution terms have been reviewed; server enrichment and API
publication read this policy instead of hardcoding a provider hierarchy.

See [`data-source-licensing.md`](data-source-licensing.md) for the tracked official
terms, attribution requirements, current implementation, and unresolved release
blockers behind these policy columns.

Notes:

- Source names shown by barcode lookup come from this table. Runtime lookup code does
  not invent vendor labels.
- Source rows are maintained by the reference-data seed script, with API-observed
  provenance.
- Health Canada CNF and UK CoFID have explicit canonical-storage decisions based on
  their published Open Government licences. Their rows retain the required attribution,
  licence URL, review date, permitted-use summary, and excluded-rights warning; public
  API output must preserve that attribution metadata.
- `api_redistribution_allowed` is the separate API-publication decision. API v1 never
  infers it from the provider name or from canonical storage alone.

### `product_source_daily_metrics`

| Table | Documented columns |
| --- | --- |
| `product_source_daily_metrics` | `metric_date`, `source_key`, `source_data_type`, `lookup_kind`, `lookup_origin`, lookup/API/cache/error/match counters, evaluated product and reported nutrient totals, brand/category/serving/ingredient/image coverage counters, response milliseconds, and timestamps |

Notes:

- Runtime lookups record daily counters through the service-role-only
  `record_product_source_daily_metric` function, using one atomic upsert per completed
  source attempt.
- The table deliberately stores no barcode, search text, user id, or vendor payload.
- `runtime` rows explain real traffic and API/cache load. `benchmark` rows send the same
  saved barcodes to each source for a fair coverage comparison.
- Cache hits also include reuse of an identical provider request that was already
  running in the same server process; this prevents concurrent requests from creating
  duplicate outbound traffic.
- Run `npm run report:source-quality` for runtime activity, or run
  `npm run benchmark:source-quality -- --limit=10` followed by
  `npm run report:source-quality -- --origin=benchmark` for a direct comparison.
- Add `--reset-today` to the benchmark command when comparing request-count code
  changes; it deletes only the current UTC day's synthetic benchmark rows and never
  deletes runtime source metrics.
- The report's coverage index measures observed completeness and reliability; it does
  not replace the source-authority policy.
- The report includes outbound calls per logical lookup and flags controlled benchmark
  averages above `2.5` for request-fan-out review.

### `nutrient_source_mappings`

| Table | Documented columns |
| --- | --- |
| `nutrient_source_mappings` | `source_key`, `source_nutrient_key`, `source_unit_name`, `source_nutrient_name`, `nutrient_id`, `priority`, `mapping_method`, `confidence`, `enabled`, observation counts/timestamps, `provenance`, and timestamps |

Notes:

- `nutrient_definitions` remains the canonical owner of nutrient names, numbers, and
  default units. This table only explains how a source API field maps to that canonical
  row.
- Runtime barcode mapping resolves enabled `nutrient_equivalences` before form
  autofill, so source aliases such as USDA `1085` cannot bypass the canonical Total Fat
  field. Exact canonical rows take precedence if a response contains both forms.
- Reviewed mappings are semantic decisions. API-observation seed runs may refresh
  observation metadata but cannot replace an approved or rejected nutrient identity.
- The lookup index starts with source and source nutrient key so barcode mapping does
  not scan the full table.
- `20260727120000_canonical_barcode_nutrient_mappings.sql` restores the reviewed Open
  Food Facts label mappings, including Total Fat and gram-to-milligram Sodium, and
  rewrites applicable existing food snapshots through the enabled equivalence catalog.

### `nutrient_unit_conversions`

| Table | Documented columns |
| --- | --- |
| `nutrient_unit_conversions` | `source_key`, `nutrient_id`, `from_unit_name`, `to_unit_name`, `multiplier`, `conversion_method`, `confidence`, `observation_count`, `provenance`, and timestamps |

Notes:

- Conversion rows are source- and nutrient-specific because conversions such as vitamin
  IU values cannot be safely treated as universal unit math.
- The seed script stores standards-API or paired API-observation provenance with each
  multiplier.

### `serving_measure_units` and `serving_measure_aliases`

| Table | Documented columns |
| --- | --- |
| `serving_measure_units` | `key`, `display_label`, `short_label`, `dimension`, `base_unit_key`, `conversion_to_base`, `standards_code`, `display_order`, `is_default`, `enabled`, `source_key`, `source_reference`, `observed_at`, and timestamps |
| `serving_measure_aliases` | `unit_key`, `alias`, `normalized_alias`, `source_key`, observation counts/timestamps, and timestamps |

Notes:

- `serving_measure_units` has one enabled default per dimension and indexed display
  ordering.
- Basic multiplication remains application code; available units, aliases, labels,
  enabled state, and conversion factors are database-owned.
- Authenticated users can read all five reference tables. Only service-role scripts can
  write them.
- Run `npm run seed:product-reference-data -- --sample-size=200` after the migration to
  sample USDA FoodData Central, Open Food Facts, and the UCUM standards service and
  refresh these rows.

### `food_servings`

Stores source-reported and user-entered serving sizes separately from each food's JSON
snapshot.

| Table | Documented columns |
| --- | --- |
| `food_servings` | `id`, `owner_user_id`, `user_food_list_item_id`, `custom_food_id`, `shared_product_submission_id`, `shared_product_id`, `shared_product_revision_id`, `shared_product_observation_id`, `serving_order`, `label`, `gram_weight`, optional `amount` and `unit_key`, `is_primary`, `source`, `source_reference`, `confidence`, and timestamps |

Notes:

- A row points to exactly one food parent. Partial unique indexes enforce stable order
  and no more than one primary serving per parent.
- Parent-table triggers rebuild serving rows whenever food/source data changes. This
  keeps list items, custom foods, submissions, products, revisions, and observations
  synchronized without relying on browser writes.
- The initial migration checks every existing parent row and backfills all valid serving
  data already present. Foods without a trustworthy serving stay empty; the migration
  does not invent a 100g package serving.
- The nutrition view loads these rows, defaults to the primary source serving, and still
  offers the normalized 100g basis. `gram_weight` and optional amount/unit fields are
  the future mix conversion input.
- Authenticated users may read their own serving rows and servings attached to active
  shared products. Only server/service-role paths may write them.

## Shared Product Catalog and Barcode Flow

| Table                             | Primary Key             | Owner Scope                   | Purpose                                                                   | Key Relationships                                                   |
| --------------------------------- | ----------------------- | ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `shared_product_submissions`      | `id`                    | Submitted by one auth user    | Community product submissions awaiting review or already reviewed         | `submitted_by → auth.users.id`, optional reviewer                   |
| `shared_products`                 | `id`                    | Shared catalog                | Approved active shared products searchable by all authenticated users     | Optional approved submission/reviewer                               |
| `shared_product_revisions`        | `id`                    | Shared catalog                | Historical revisions for approved products                                | `shared_product_id → shared_products.id`                            |
| `shared_product_revision_changes` | `id`                    | Shared catalog history        | Queryable old/new field values attached to an approved product revision    | `revision_id → shared_product_revisions.id`                         |
| `shared_product_observations`     | `id`                    | Shared evidence/provenance    | API, user-label, manufacturer, or GS1 observations for a barcode          | Optional submission/user links                                      |
| `shared_product_field_provenance` | `id`                    | Shared evidence/provenance    | Which observation supplied each canonical shared product field            | `shared_product_id`, `observation_id`                               |
| `shared_product_conflicts`        | `id`                    | Shared moderation/provenance  | Open/resolved conflicts between observed values                           | `shared_product_id → shared_products.id`                            |
| `food_image_assets`               | `id`                    | Shared image reference        | Source-backed product/ingredient image metadata rendered by ingredient UI | Optional `shared_product_id → shared_products.id`, optional barcode |
| `product_api_cache`               | `(provider, cache_key)` | Server cache                  | External API response cache for searches, barcode lookup, and food detail | No user ownership                                                   |
| `product_submission_blocks`       | `id`                    | One auth user per block event | Temporary submission block after repeated rejected submissions            | `user_id → auth.users.id`, optional source submission               |

### `shared_product_submissions`

Stores user-submitted products before/after moderation.

| Table | Documented columns |
| --- | --- |
| `shared_product_submissions` | `id`, `submitted_by`, `barcode`, `product_name`, `brand_owner`, `category_option_id`, `food`, `consent_to_share`, `status`, `verification_status`, `matched_source`, `matched_reference`, `validation_report`, `evidence_paths`, `evidence_complete`, `submission_kind`, `target_shared_product_id`, `base_revision_id`, `change_summary`, `label_observed_at`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`, `updated_at` |

Notes:

- Public sharing requires `consent_to_share = true`.
- `status` can be `pending`, `approved`, `rejected`, or `auto_declined`.
- `auto_declined` means server validation blocked a bad share attempt before it reached
  normal moderation; it should not count as a human rejection.
- `validation_report` carries barcode/source comparison and nutrient validation results
  for moderation.
- `category_option_id` points to the canonical DB-backed app category selected or
  resolved before submission. Raw API categories remain inside `food` for source proof
  and future remapping.
- `submission_kind` is `new_product` or `product_update`. Product updates must point to
  both the active shared product and the exact base revision used for comparison.
- `change_summary` stores structured before/after values and exact-source research
  results. `label_observed_at` records when blendCalc received the label; it does not
  claim to be the manufacturer's effective date.
- A partial unique index allows only one pending update for a shared product at a time.

### `shared_products`

Approved canonical blendCalc catalog product. This table and its normalized child rows
are the source of truth for published app reads and the planned public product API;
external API rows are evidence or missing-field candidates, not competing public
product authorities.

| Table | Documented columns |
| --- | --- |
| `shared_products` | `id`, `barcode`, `product_name`, `brand_owner`, `search_text`, `category_option_id`, `food`, `source`, `source_reference`, `confidence`, `status`, `approved_submission_id`, `approved_by`, `last_verified_at`, `canonical_provenance`, `compatibility_summary`, `created_at`, `updated_at` |

Notes:

- Search uses indexed `search_text`.
- Barcode lookup reads the active canonical row before source caches or external APIs.
  Complete rows make no external product request. A legally reusable exact-source value
  may fill only a field that is still missing through
  `apply_shared_product_external_enrichment`, which also writes the source observation,
  selected provenance, normalized projections, and a revision in one transaction.
- Existing nonmissing canonical values are never replaced by automatic provider
  enrichment. Data with incompatible storage or redistribution terms remains in its
  isolated cache or source-backed asset table and is not copied into the future public
  dataset.
- The `food` JSON preserves source identity separately from catalog status. For
  USDA-backed products this includes `sourceKey`, the DB-provided `sourceLabel`,
  `sourceDataType` (`Branded`, `Foundation`, `SR Legacy`, or `Survey (FNDDS)`), and
  available source publication/modification dates.
- Canonical food snapshots distinguish `foodIdentityType` as `packaged`, `generic`, or
  `private-custom`. Existing shared products/submissions are backfilled as packaged;
  existing custom/list snapshots use their explicit custom state and strict source data
  type to recover the applicable identity.
- When a source supplies them and source policy permits canonical storage, `food`
  preserves the raw ingredient statement, normalized `ingredientList`, recursive
  `structuredIngredients`, `ingredientAnalysis`, `additives`, explicit `allergens`,
  explicit `traces`, `dietaryTags`, `labels`, `packageQuantity`, and
  `sourceMetadata`. `sourceMetadata` includes source language, revision/schema version,
  source timestamps, completeness, quality tags, obsolete state, and tag-source
  evidence. Each independently accepted field keeps its source in `fieldProvenance`.
- `ingredientAnalysis.derivedTraceTags` records a provider-derived ingredient analysis
  only. It is not promoted into `food.traces` and therefore cannot become a package
  `May contain` disclosure.
- USDA barcode products use exact normalized GTIN matches and keep the newest active
  `Branded` record. Missing nutrient values remain missing; values from unrelated USDA
  records are not blended into the product.
- Compatibility summaries are rebuilt from compatibility facts.
- `category_option_id` is inherited from the approved submission. A database trigger
  blocks publication when no enabled canonical category can be resolved.
- `food.foodCategory` mirrors the canonical category label on custom foods, saved-list
  snapshots, submissions, active products, and revisions. Raw source category strings
  remain separately preserved in `food.categories`.
- `shared_product_revisions.category_option_id` copies the published product category so
  historical revisions retain the category used at publication.
- API v1 reads this table through `get_blendcalc_product_v1` and
  `search_blendcalc_products_v1`. Both RPCs require an empty result from
  `blendcalc_api_v1_product_readiness_reasons`; therefore an active catalog row is not
  automatically an API-publishable row.
- `blendcalc_api_v1_product_readiness` is a service-role-only diagnostic view over every
  active shared product. It reports missing provenance, normalized-data gaps, and
  source-policy failures without exposing private evidence to API consumers.

### `shared_product_revisions` and `shared_product_revision_changes`

Every approved publication appends a revision. New revision columns include
`submission_id`, `supersedes_revision_id`, `change_summary`, and `label_observed_at` in
addition to the canonical food snapshot, source, source reference, category, creator,
revision number, and timestamps.

For an approved product update, a database trigger verifies that the submission's
`base_revision_id` is still the latest revision before the active product can change.
Another trigger copies the submission and observed-label metadata onto the new revision.
`shared_product_revision_changes` then stores one row per changed field with
`field_path`, `field_label`, `change_type`, `previous_value`, `new_value`, and
`severity`. These service-role-only rows make future API history queryable without
parsing every historical food document. Older revisions keep their original snapshots;
the migration does not invent historical field differences.

### Product evidence and cache tables

`shared_product_observations`, `shared_product_field_provenance`, and
`shared_product_conflicts` hold the evidence trail behind shared catalog data.
`product_api_cache` reduces external API load and is readable/writable only through
server code using the `service_role`. Browser roles receive no table privileges. Its
`(provider, cache_key)` primary key keeps each source in a separate namespace.
`request_kind`, `status_code`, `response`, `fetched_at`, `expires_at`, and optional
`etag` support positive/negative caching, conditional refreshes, and short
stale-on-outage fallback without turning cached provider data into canonical blendCalc
data. Provider and request-kind names use normalized kebab-case so a new integration can
use the shared request boundary without a new provider-specific schema constraint.

`serving_measure_aliases` includes provider-observed unit spellings such as USDA
`GRM`, allowing source serving weights to normalize through the same database-backed
measure catalog as user-entered units.

### `food_image_assets`

Stores reusable image metadata for ingredients and packaged products. This table does
not replace private moderation evidence; it only stores source-backed or approved image
records that the app can safely render.

| Table | Documented columns |
| --- | --- |
| `food_image_assets` | `id`, `barcode`, `shared_product_id`, `source`, `source_reference`, `image_role`, `image_url`, `thumbnail_url`, `storage_path`, `license_name`, `license_url`, `attribution_text`, `confidence`, `crop_x`, `crop_y`, `crop_zoom`, `rotation_degrees`, `fit_mode`, `placement_version`, `crop_source`, `placement_method`, `placement_suggestion_version`, `placement_suggestion_confidence`, `placement_suggestion_accepted_at`, `approved_by`, `approved_at`, `status`, `fetched_at`, `created_at`, `updated_at` |

Notes:

- Open Food Facts package images are stored here with source, license, and attribution
  before UI cards render them.
- Existing barcode-backed foods can be backfilled with `npm run backfill:food-images`,
  which stores image metadata instead of repeatedly calling external APIs from the UI.
- Users can read active rows, but only service-role/server code can write rows.
- Indexed lookup paths cover active barcode images, shared-product images, generic
  images, and source/reference deduping.
- Card thumbnails use normalized `crop_x`, `crop_y`, `crop_zoom`, quarter-turn
  `rotation_degrees`, and `fit_mode`; nutrition detail views use the unchanged full
  image.
- Version 1 rows retain the original cover-based rendering until edited. Version 2 rows
  make `1×` mean the fully contained image and support `contain`, calculated `cover`,
  measured `custom` placement, and clockwise 90-degree rotation. New rows default to
  version 2 `contain` at `0` degrees; any user/moderator edit upgrades that row to
  version 2.
- Automatic API image metadata refreshes omit placement columns so they cannot overwrite
  a user- or moderator-selected position.
- Community images stay private until a moderator approves them. Approval writes a
  `community-reviewed` image row with `moderator-reviewed` confidence and approval
  metadata.

| Storage bucket | Visibility | Purpose |
| --- | --- | --- |
| `product-submission-evidence` | Private | Product evidence images scoped under the submitting user id |
| `food-image-assets` | Public | Approved/source-backed product image files; private evidence must not move here before moderation approval |

## Compatibility, Allergens, and Dietary Restrictions

| Table                              | Primary Key | Owner Scope                 | Purpose                                                                                            | Key Relationships                                                                   |
| ---------------------------------- | ----------- | --------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `compatibility_tags`               | `id`        | Shared reference            | Canonical compatibility tags for allergens, dietary claims, ingredients, and avoidance concepts    | Referenced by user rules and product facts                                          |
| `compatibility_rule_conflicts`     | Composite   | Shared validation reference | DB-owned mapping from a user preference tag to a conflicting product fact and warning severity      | Both tag ids → `compatibility_tags.id`                                                 |
| `food_compatibility_match_rules`   | `id`        | Shared validation reference | Reviewed source-field match policy that converts exact evidence into normalized compatibility facts | `tag_id → compatibility_tags.id`                                                     |
| `food_compatibility_policy_versions` | `id`      | Shared policy history       | Immutable snapshots of each deployed compatibility match/conflict policy and its official sources  | Referenced by product facts, regional profiles, and user feedback                    |
| `food_allergen_regulatory_profiles` | `id`       | Shared regulatory reference | Reviewed jurisdiction-specific allergen declaration profiles                                       | `policy_version_id → food_compatibility_policy_versions.id`                          |
| `food_allergen_regulatory_profile_tags` | Composite | Shared regulatory reference | Normalized compatibility tags covered by a regional allergen profile                               | Profile and tag foreign keys                                                         |
| `product_compatibility_facts`      | `id`        | Shared product metadata     | Facts extracted from shared products/submissions/observations                                      | `tag_id → compatibility_tags.id`; exactly one product/submission/observation parent |
| `food_compatibility_feedback`      | `id`        | User report/moderation queue | Versioned false-positive reports containing the exact warning and evidence shown to the user         | User, policy version, optional product, and reviewer foreign keys                    |
| `food_preference_option_catalog`   | `id`        | Shared reference            | App-ready allergen/dietary/ingredient options built from product compatibility and ingredient data | Optional `tag_id → compatibility_tags.id`                                           |
| `food_preference_api_observations` | `id`        | Shared reference/provenance | Raw observed allergen/dietary/ingredient metadata from external APIs                               | No direct user ownership                                                            |

### `compatibility_tags`

| Table | Documented columns |
| --- | --- |
| `compatibility_tags` | `id`, `slug`, `label`, `category`, `created_at`, `updated_at` |

Notes:

- `category` is `allergen`, `dietary`, `ingredient`, or `avoidance`.

### `compatibility_rule_conflicts`

| Table | Documented columns |
| --- | --- |
| `compatibility_rule_conflicts` | `preference_tag_id`, `fact_tag_id`, `severity`, `warning_code`, `priority`, `created_at`, `updated_at` |

Notes:

- This relation is the authority for matching active user preferences to structured
  product compatibility facts.
- App utilities must not recreate allergen or dietary vocabularies with name/category
  guesses.
- Conflict rows and `food_compatibility_match_rules` remain server-only policy. They are
  not serialized through the browser reference catalog. Authenticated page/API reads
  evaluate them before returning bounded `preferenceWarnings` and
  `allergenDisclosure`; client components only render those results.
- Packaged match rules operate only on source-provided ingredient statements. Product
  names, descriptions, categories, brands, and generic labels are not warning evidence.
  Separately, an explicitly typed authoritative generic-food record may match a
  `generic_food_identity` rule and create an intrinsic `contains` fact with
  `food_identity_taxonomy` provenance. This path is unavailable to packaged and
  private-custom foods.
- `warning_code → app_issue_codes.code`; ordinary warning sentences are not stored in
  this table.
- `prepare_custom_food_record` enforces the same nutrient relationship rules with their
  stable `issue_code`; the database no longer owns the user-facing warning sentence.

### `food_compatibility_match_rules`

| Table | Documented columns |
| --- | --- |
| `food_compatibility_match_rules` | `id`, `tag_id`, `source_key`, `field_name`, `match_pattern`, `exclude_pattern`, `fact_type`, `source_type`, `confidence`, `priority`, `enabled`, `created_at`, `updated_at` |

Notes:

- Rules are ordered by `priority` and loaded through the server-only food-safety policy
  cache.
- Packaged-product rules may inspect source-provided allergen, trace, ingredient, and
  ingredient-analysis fields. They do not inspect a packaged name, brand, category, or
  description.
- An authoritative generic food may use its typed taxonomy as intrinsic food evidence.
  That rule path remains unavailable to packaged and private custom foods.
- Positive dietary claims are accepted only when source labels normalize to an enabled
  dietary compatibility tag. Marketing labels do not become dietary evidence.

### `food_compatibility_policy_versions`

| Table | Documented columns |
| --- | --- |
| `food_compatibility_policy_versions` | `id`, `version_number`, `status`, `change_summary`, `match_rule_snapshot`, `conflict_rule_snapshot`, `source_references`, `effective_at`, `reviewed_at`, `created_at`, `updated_at` |

Notes:

- Exactly one policy version may be active. New product facts and user feedback default
  to that version through `active_food_compatibility_policy_version_id()`.
- Match and conflict snapshots preserve the exact deployed policy for later audits.
  Updating live rules requires a new version snapshot rather than rewriting history.
- `source_references` records the official regulatory material reviewed for the policy.

### Regional allergen profiles

| Table | Documented columns |
| --- | --- |
| `food_allergen_regulatory_profiles` | `id`, `policy_version_id`, `profile_key`, `region_code`, `display_name`, `authority`, `policy_reference`, `source_url`, `reviewed_at`, `active`, `created_at`, `updated_at` |
| `food_allergen_regulatory_profile_tags` | `profile_id`, `tag_id`, `classification`, `source_label`, `created_at` |

Notes:

- The initial policy records reviewed profiles for the United States, Canada, United
  Kingdom, European Union, and Australia/New Zealand.
- Regional profiles preserve each authority's source label and classification while
  mapping it to a normalized compatibility tag.
- Profiles add jurisdiction context and policy coverage. They never suppress a warning
  for a preference the user explicitly selected.
- Authenticated reads are limited by RLS to active profiles belonging to the active
  policy version.

### `product_compatibility_facts`

| Table | Documented columns |
| --- | --- |
| `product_compatibility_facts` | `id`, `shared_product_id`, `shared_product_observation_id`, `shared_product_submission_id`, `tag_id`, `policy_version_id`, `fact_type`, `source_type`, `source_text`, `confidence`, `created_at`, `updated_at` |

Notes:

- A fact points to exactly one product, observation, or submission parent.
- These facts drive profile warnings such as allergen and dietary conflicts.
- `contains` comes from explicit allergen metadata, `may_contain` comes only from
  explicit trace metadata, and `ingredient_present` comes from a reviewed match against
  a source-provided ingredient statement.
- `dietary_conflict` records reviewed ingredient, source-analysis, or authoritative
  generic-taxonomy evidence relevant to dietary restrictions. Its source and confidence
  determine whether the user receives a confirmed warning or a potential warning.
- `contains` may also represent the intrinsic taxonomy of an authoritative generic food
  such as shrimp or milk. The source type is `food_identity_taxonomy`, keeping it
  distinct from a packaged-label allergen declaration.
- `shared_products.compatibility_summary` denormalizes all current facts for bounded
  reads. The server evaluates those facts against the current profile and returns
  friendly warnings, `Contains`, `May contain`, dietary labels, and dietary
  considerations without exposing regex policy or private evidence.
- Each fact records the policy version that generated it. Denormalized summaries include
  `policyVersion` and contain only facts from the active policy version.

### `food_compatibility_feedback`

| Table | Documented columns |
| --- | --- |
| `food_compatibility_feedback` | `id`, `reported_by`, `policy_version_id`, `shared_product_id`, `source_key`, `source_id`, `barcode`, `food_description`, `warning_id`, `issue_code`, `issue_params`, `fact_snapshot`, `report_reason`, `report_details`, `report_fingerprint`, `status`, `resolution_action`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`, `updated_at` |

Notes:

- A signed-in user can report a warning as an incorrect match, outdated source record,
  wrong evidence type, or another evidence-specific problem.
- The report stores the warning parameters and exact matching fact snapshot from the
  active policy version. It does not rely on mutable client wording.
- A unique pending fingerprint makes repeated submissions idempotent.
- Users may read only their own reports. Inserts and moderation updates use authenticated
  server boundaries; the service role owns privileged writes.
- Moderators resolve reports as `confirmed` or `dismissed` and record the next action as
  rule review, source correction, product correction, or duplicate.

### `food_compatibility_policy_coverage`

Service-only view reporting whether each allergen or dietary tag is selectable, how
many conflict mappings it owns, and how many enabled evidence rules are reachable
either directly or through those conflict mappings. It is revoked from browser roles
and is intended for deployment checks and policy audits.

### `food_preference_option_catalog`

| Table | Documented columns |
| --- | --- |
| `food_preference_option_catalog` | `id`, `category`, `label`, `normalized_value`, `source_type`, `tag_id`, `source_values`, `usage_count`, `created_at`, `updated_at` |

Notes:

- Built by `rebuild_food_preference_option_catalog`.
- UI should query this table for allergen and dietary dropdown options.
- `source_type` is `compatibility_tag`, `compatibility_fact`, `api_observation`, or
  `ingredient_list`. Canonical tags keep required selectable safety preferences
  available before any product happens to report them.

### `food_preference_api_observations`

| Table | Documented columns |
| --- | --- |
| `food_preference_api_observations` | `id`, `category`, `fact_type`, `label`, `normalized_value`, `source`, `source_field`, `source_value`, `source_reference`, `source_payload`, `query`, `matched_name`, `brand_owner`, `observation_count`, `first_seen_at`, `last_seen_at` |

Notes:

- Seeded by food preference audit scripts.
- Used as provenance/reference data, not as direct user preference rows.

## Custom Food Category Reference

| Table                               | Primary Key               | Owner Scope                 | Purpose                                                                                                | Key Relationships                                      |
| ----------------------------------- | ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `custom_food_category_options`      | `id`                      | Shared reference            | DB-backed dropdown options for manual custom-food categories                                           | Built from observations                                |
| `custom_food_category_observations` | `id`                      | Shared reference/provenance | External API category observations used to build options                                               | No direct user ownership                               |
| `custom_food_category_mappings`     | `source_normalized_value` | Shared reference/provenance | Maps raw observed API category strings to clean app category options for barcode/manual-entry autofill | `category_option_id → custom_food_category_options.id` |

### `custom_food_category_options`

| Table | Documented columns |
| --- | --- |
| `custom_food_category_options` | `id`, `label`, `normalized_value`, `sources`, `source_count`, `observation_count`, `verification_status`, `enabled`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- UI category dropdowns should sort by `label`.
- Seeded by `scripts/seeds/seed_custom_food_categories.mjs`.
- The dropdown renders these app-ready options, not raw source payload strings.
- `shared_product_submissions`, `shared_products`, and `shared_product_revisions`
  reference this table through `category_option_id`.

### `custom_food_category_observations`

| Table | Documented columns |
| --- | --- |
| `custom_food_category_observations` | `id`, `category_id`, `label`, `normalized_value`, `source`, `query`, `source_field`, `source_value`, `source_reference`, `source_payload`, `observation_count`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- Source values come from `fdc-search`, `fdc-branded-detail`, and `open-food-facts`.
- Observations preserve raw API source category data, including Open Food Facts
  categories, category tags, category hierarchy, and food groups when available.

### `custom_food_category_mappings`

| Table | Documented columns |
| --- | --- |
| `custom_food_category_mappings` | `source_normalized_value`, `source_value`, `source_values`, `source_fields`, `sources`, `category_option_id`, `category_option_label`, `confidence`, `match_reason`, `source_count`, `observation_count`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- Barcode/manual-entry autofill should use this table to pick the visible app category.
- Raw API category values remain stored in `custom_food_category_observations` and on
  product payloads for proof and moderation.
- Seeded by `scripts/seeds/seed_custom_food_categories.mjs`; use
  `npm run seed:food-categories:deep` for a broader API sample.
- Use `npm run seed:food-categories:rebuild` when observations already exist and only
  mappings need to be refreshed.
- Do not map category autofill by taking the first raw API category value.
- `resolve_custom_food_category_option(text[])` performs reusable DB-side category
  resolution using enabled options and observed mappings.
- `npm run backfill:shared-product-categories` checks USDA FoodData Central and Open
  Food Facts, records category provenance, and repairs legacy catalog rows.

## Moderation and Access Control

| Table                              | Primary Key  | Owner Scope                | Purpose                                                   | Key Relationships                                  |
| ---------------------------------- | ------------ | -------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `app_role_assignments`             | `user_id`    | One row per elevated user  | Grants `moderator` or `admin` role                        | `user_id → auth.users.id`, optional `granted_by`   |
| `account_moderation`               | `user_id`    | One row per moderated user | Tracks active/suspended/banned state                      | `user_id → auth.users.id`, optional `moderated_by` |
| `moderation_actions`               | `id`         | Audit log                  | Records moderation actions and reason codes               | `target_user_id`, optional `actor_user_id`         |
| `moderation_email_deliveries`      | `id`         | Audit log                  | Tracks moderation email delivery status                   | `moderation_action_id → moderation_actions.id`     |
| `blocked_signup_emails`            | `email_hash` | Blocklist                  | Prevents signup by hashed email                           | Optional source/blocking users                     |
| `profile_image_policy_acceptances` | `id`         | Many rows per auth user    | Records profile image policy acceptance per avatar upload | `user_id → auth.users.id`                          |

Notes:

- Moderation/admin writes are intentionally not available to normal authenticated
  clients.
- `blocked_signup_emails` stores hashes, not raw email addresses.
- `reject_blocked_signup` is the auth hook function for blocking signups.

## Nutrition Completeness And National Datasets

These tables keep completeness policy and imported generic-food data separate from
packaged barcode products. Imports are source-versioned, license-gated, and searchable
without calling the source again.

| Table                                      | Primary Key                                         | Purpose                                                       | Important Columns / Rules                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `nutrition_completeness_profiles`          | `key`                                               | Defines what complete nutrition means for a food scope/region | `food_scope` (`generic`, `manual`, or `packaged`), `region_code`, DB-owned labels, source reference, one enabled default per scope/region |
| `nutrition_completeness_profile_nutrients` | `profile_key, nutrient_id`                          | Orders required and recommended nutrients for one profile     | `requirement_level`, `display_order`, `reason`; nutrient FK prevents invented definitions                                                 |
| `generic_food_datasets`                    | `key`                                               | Records each national release and its legal/import state      | Source/license URLs, attribution, file SHA-256, review status, import/active gates, imported row counts                                   |
| `generic_food_records`                     | `dataset_key, source_food_key`                      | Stores one source-owned generic food/preparation              | Raw description, group, preparation, searchable text, source reference and dates                                                          |
| `generic_food_source_identifiers`          | Dataset food plus source, type, and value           | Stores exact source-declared cross-dataset identifiers        | Supports exact joins such as CNF `USDA_NDB_Code` to USDA NDB without fuzzy name matching; includes source field and verification method   |
| `generic_food_nutrients`                   | `dataset_key, source_food_key, source_nutrient_key` | Stores source nutrient amounts and canonical mappings         | Explicit basis, amount, unit, mapping status, and `value_status` (`measured`, `trace`, `present-unquantified`)                            |
| `generic_food_measures`                    | `dataset_key, source_food_key, source_measure_key`  | Stores source household measures                              | Amount/unit, gram weight, source label and metadata; never inferred from names                                                            |
| `generic_food_dataset_reference_rows`      | `dataset_key, reference_type, source_key`           | Stores source dictionaries used to interpret imports          | Reference labels and metadata remain tied to the dataset release                                                                          |

Current release state:

- `cnf-2026` is active: 5,993 foods, 565,409 nutrient values, and 29,867 measures.
- `cofid-2021` is active: 2,887 foods and 199,415 nutrient values. Trace values remain
  `trace`; alcohol records reported per 100 ml are not presented as per 100g.
- AFCD remains disabled until its acceptance/share-alike obligations are explicitly
  approved.

Runtime generic search reads only active, import-enabled datasets through an indexed
prefix-search RPC. A result must have at least one canonical measured nutrient, so
identity-only shells cannot consume result slots. Results retain alternate descriptions,
scientific names, preparation metadata, and exact source-declared identifiers. Those
identifiers may connect the same source food across datasets, but similar names are never
treated as an identity match.

Private custom foods use `private-manual-core-v1`, whose required rows are copied from
the enabled manual-entry nutrient requirements. A typed barcode does not switch that
private record to the U.S. packaged-label profile. Source-imported, pending-review, and
shared packaged products continue to use `us-packaged-label-v1`. A database trigger
refreshes the private-manual profile whenever the manual-entry requirements change so
the two policies cannot drift.

## Product Source Policies

| Table / Registry Row                       | Purpose                                          | Current Behavior                                                                                              |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `product_source_evaluations`               | Auditable provider benchmark/lifecycle decisions | Records sample target, run state, legal/operational findings, result summary, and decision                    |
| `product_data_sources.foodrepo`            | Retired barcode provider record                  | Disabled; retirement and Open Food Facts replacement are documented; no benchmark traffic is sent             |
| `product_data_sources.nutrition-label-ocr` | Label-reading helper identity                    | Nutrient aliases/conversions are DB-backed; values require explicit user confirmation and remain `user-label` |
| `product_data_sources.gs1-digital-link`    | GS1 product QR identifier standard               | GTIN is extracted locally; arbitrary scanned URLs are never fetched; lot/serial/query data is not persisted   |

OCR aliases live in `nutrient_source_mappings` and safe unit conversions live in
`nutrient_unit_conversions`, so label parsing does not own a second nutrient catalog.
GS1 links identify a product but do not claim ownership of its nutrition, image,
category, or serving fields.

## RPC / Database Functions

| Function                                       | Purpose                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_updated_at`                               | Shared updated-at trigger helper                                                                                                               |
| `default_profile_display_name`                 | Builds a safe default display/profile name                                                                                                     |
| `set_default_profile_display_name`             | Trigger helper that fills missing profile display names                                                                                        |
| `create_profile_for_new_auth_user`             | Auth trigger helper that creates a profile row for new users                                                                                   |
| `replace_food_nutrients`                       | Replaces normalized nutrient rows for exactly one food parent                                                                                  |
| `replace_food_servings`                        | Replaces normalized serving rows for exactly one food parent; parent triggers call it after relevant writes                                    |
| `food_list_item_identity_key`                  | Produces the canonical barcode-or-FDC identity used to prevent cross-list duplicates                                                           |
| `place_user_food_list_item`                    | Atomically adds an ingredient, reports a required cross-list move, or completes a confirmed move                                               |
| `move_user_food_list_items`                    | Atomically moves a checked ingredient set between Fridge and Shopping List, rejecting stale or partial sets                                    |
| `publish_shared_product_submission`            | Publishes an approved submission into the shared catalog and revisions/evidence tables                                                         |
| `compatibility_normalize_text`                 | Normalizes compatibility labels/values for matching                                                                                            |
| `extract_product_compatibility_facts`          | Extracts product compatibility facts from food/product JSON                                                                                    |
| `rebuild_shared_product_compatibility_summary` | Rebuilds denormalized compatibility summary JSON on shared products                                                                            |
| `refresh_shared_product_compatibility_match_facts` | Re-extracts one canonical shared product with the current reviewed compatibility policy                                                    |
| `sync_shared_product_compatibility_summary`    | Trigger helper that refreshes a canonical summary after fact changes, with a bulk-backfill guard                                               |
| `sync_user_compatibility_rules`                | Syncs user food preferences into normalized compatibility rules                                                                                |
| `rebuild_food_preference_option_catalog`       | Rebuilds allergen/dietary/ingredient option catalog from product facts                                                                         |
| `sync_nutrient_manual_entry_fields`            | Rebuilds manual-entry nutrient groups/fields from observations                                                                                 |
| `rebuild_custom_food_category_options`         | Rebuilds manual custom-food category options from observations                                                                                 |
| `normalize_food_category_value`                | Normalizes category text for option and mapping lookup                                                                                         |
| `resolve_custom_food_category_option`          | Resolves raw API category values to one enabled canonical category option                                                                      |
| `search_generic_food_records`                  | Uses indexed prefix matching and stable relevance ordering across active national datasets; excludes nutrient-empty shells and returns normalized food JSON with exact source identifiers and provenance |
| `apply_shared_product_external_enrichment`     | Atomically fills legally reusable missing canonical fields, including structured package metadata, while recording observations, provenance, normalized projections, and a revision |
| `blendcalc_api_v1_source_is_eligible`           | Tests a stored source against the DB-owned API redistribution, licence, attribution, and policy-review gate |
| `blendcalc_api_v1_product_readiness_reasons`    | Returns the service-only reasons an active shared product is withheld from API v1 |
| `get_blendcalc_product_v1`                      | Reads one active, publication-ready shared product and its latest revision by GTIN-14 |
| `search_blendcalc_products_v1`                  | Searches only active, publication-ready shared products with bounded pagination and stable relevance |
| `reject_blocked_signup`                        | Supabase Auth hook for hashed email signup blocks                                                                                              |

## Storage Buckets

| Bucket                        | Public | Purpose                                                     | Access Pattern                                                     |
| ----------------------------- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `profile-avatars`             | No     | User avatar files                                           | Authenticated user can manage files under their own user id folder |
| `product-submission-evidence` | No     | Product label/evidence images for shared catalog moderation | Authenticated user can manage files under their own user id folder |

## Update Checklist

When schema changes:

1. Add a migration in `supabase/migrations/`.
2. Add RLS and grants intentionally.
3. Add indexes for expected filtering, sorting, joins, and lookup paths.
4. Verify the complete migration chain against the resettable local database.
5. Inspect `npm run db:push:dry`, apply the verified migration with
   `npm run db:push:auto`, and confirm the local/linked migration lists match.
6. Regenerate `src/lib/types/database.types.ts` after migration is applied.
7. Backfill applicable existing rows whenever a new accepted field can be recovered
   from canonical data, normalized child rows, or legally reusable exact-source
   observations.
8. Update this document with table purpose, owner scope, key columns, and relationships.
9. Add or update focused tests for migration expectations when practical.
10. Add a local-only QA item to the appropriate priority tracker linked from
   `docs/QA/qa-tasks.md` if the change affects user-visible data, moderation behavior,
   or data-entry flow.
