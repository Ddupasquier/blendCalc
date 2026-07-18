# Supabase Schema

This document is the plain-language map of the app-owned Supabase schema. The
source of truth remains the migrations in `supabase/migrations/` and the
generated types in `src/lib/types/database.types.ts`; update this file whenever
tables, relationships, policies, or core data ownership changes.

## Schema Rules

- Auth accounts live in Supabase Auth (`auth.users`). App data lives in `public`.
- User-owned tables reference `auth.users(id)` and use RLS so users only read or
  mutate their own rows.
- Shared/reference tables are readable by authenticated users when the data is
  safe to expose, but writes should go through server-only scripts, migrations,
  moderation tools, or service-role code.
- API-observed reference data keeps provenance (`source`, `sources`,
  `source_count`, timestamps, raw payloads, or observations) so we know where it
  came from and how trustworthy it is.
- Nutrition, compatibility, and category UI should render from DB-backed
  definition/catalog tables, not hardcoded component constants.

## Core User Data

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `profiles` | `user_id` | One row per auth user | Display/profile data, avatar metadata, and avatar policy state | `user_id → auth.users.id` |
| `user_tutorial_preferences` | `user_id` | One row per auth user | Tracks tutorial seen/completed/remind-later state | `user_id → auth.users.id` |
| `user_food_preferences` | `user_id` | One row per auth user | Optional unit system, allergens, dietary restrictions, nutrient priorities, and default serving preference | `user_id → auth.users.id` |
| `user_compatibility_rules` | `id` | Many rows per auth user | Normalized active warnings/downrank rules derived from user food preferences | `user_id → auth.users.id`, optional `tag_id → compatibility_tags.id` |
| `mix_preferences` | `user_id` | One row per auth user | Persisted smoothie goals and mix state | `user_id → auth.users.id` |

### `profiles`

Stores app-facing profile information. Email should not be copied here.

Columns: `user_id`, `display_name`, `bio`, `avatar_path`, `avatar_alt_text`,
`avatar_moderation_status`, `avatar_policy_acknowledged_at`, `created_at`,
`updated_at`.

Notes:
- `display_name` is required and auto-filled with a safe `User##########`
  style value if the user has not chosen one.
- Avatar files live in the private `profile-avatars` storage bucket under the
  user id folder.

### `user_food_preferences`

Stores optional, potentially sensitive preference inputs. These are user-owned
and should not be required to use the app.

Columns: `user_id`, `unit_system`, `allergens`, `dietary_restrictions`,
`prioritized_nutrient_ids`, `default_smoothie_serving_grams`,
`sensitive_acknowledged_at`, `created_at`, `updated_at`.

Notes:
- Older broad preference fields were removed from the UI direction; keep the app
  focused on actionable allergens, dietary restrictions, and prioritized
  nutrients.
- `sync_user_compatibility_rules` keeps preference choices aligned with
  normalized compatibility rules.

## Ingredient Lists and Saved Mixes

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `user_food_list_items` | `id` | Many rows per auth user | User fridge and shopping-list items | `user_id → auth.users.id` |
| `custom_foods` | `id` | Many rows per auth user | User-created custom foods and barcode/manual-entry payloads | `user_id → auth.users.id` |
| `saved_drinks` | `id` | Many rows per auth user | Saved smoothie recipes/mixes | `user_id → auth.users.id` |
| `ingredient_source_options` | `value` | Shared reference | DB-backed source filter and badge labels for ingredient list/search UI | No direct user ownership |

### `user_food_list_items`

Stores the user's active ingredient lists.

Columns: `id`, `user_id`, `list_type`, `fdc_id`, `food`,
`food_identity_key`, `created_at`, `updated_at`.

Notes:
- `list_type` is `fridge` or `shopping`.
- `food` is the normalized ingredient payload used by app UI.
- `food_identity_key` is generated from the normalized barcode when available,
  otherwise from the FDC id.
- `(user_id, food_identity_key)` is unique, so one ingredient cannot exist in
  both Fridge and Shopping List for the same user.
- `place_user_food_list_item` performs an atomic add or confirmed move and
  reports when a move needs user confirmation.
- Indexed for user/list sorting, pagination, source filtering, and text search.

### `custom_foods`

Private custom ingredients are written through `save_custom_food` (or the bulk
`save_custom_foods` recovery path), not through direct browser inserts or updates.
The database derives the owner from the signed-in session, validates the food name,
serving weight, canonical category, GTIN check digit, required nutrients, nutrient
catalog membership, duplicate nutrients, nonnegative values, and active nutrient
relationship rules in one transaction. A `category_option_id` foreign key records
the canonical category separately from the preserved source/category strings in the
food JSON. Direct authenticated inserts and updates are revoked so browser code
cannot bypass this validation path.

Stores private user custom foods. Shared/public review happens through
`shared_product_submissions`, not by making every custom food public.

Columns: `id`, `user_id`, `fdc_id`, `barcode`, `name_key`,
`category_option_id`, `search_text`, `food`, `created_at`, `updated_at`.

Notes:
- Unique safeguards prevent duplicate custom names and duplicate user barcodes.
- `search_text` is trigger-maintained and trigram-indexed for partial server search.
- Normalized nutrients for a custom food live in `food_nutrients`.

### `saved_drinks`

Stores a saved mix snapshot.

Columns: `id`, `user_id`, `name`, `drink`, `created_at`, `updated_at`.

Notes:
- Drink names are unique per user.
- `drink` is JSON because saved mix composition has app-specific structure.

### `ingredient_source_options`

Stores app-ready source labels for ingredient filtering and badges.

Columns: `value`, `filter_label`, `badge_label`, `display_order`,
`filter_enabled`, `badge_enabled`, `description`, `created_at`, `updated_at`.

Notes:
- This is UI configuration for app source states such as USDA, shared
  catalog, and custom foods.
- Components render filter labels and source badges from this table instead of
  hardcoded component constants.
- Indexed by display order, filter-enabled rows, and badge-enabled rows.

## Nutrient Definitions, Values, and Validation

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `nutrient_definitions` | `nutrient_id` | Shared reference | Canonical nutrient names, numbers, and default units | Referenced by every nutrient table |
| `food_nutrients` | `id` | Shared or user-owned depending on parent | Normalized nutrient values per 100g for list items, custom foods, shared products, submissions, revisions, and observations | Exactly one parent id; `nutrient_id → nutrient_definitions.nutrient_id` |
| `nutrient_manual_entry_groups` | `id` | Shared reference | DB-backed manual-entry UI groups such as macros, vitamins, minerals, amino acids | Fed by observations |
| `nutrient_manual_entry_fields` | `dedupe_key` | Shared reference | DB-backed manual-entry fields for nutrients, including whether a field is required | `nutrient_id → nutrient_definitions`, `group_id → nutrient_manual_entry_groups` |
| `nutrient_manual_entry_required_nutrients` | `nutrient_id` | Shared validation reference | DB-backed list of required manual-entry nutrients such as calories, macros, and sodium | `nutrient_id → nutrient_definitions`, `group_id → nutrient_manual_entry_groups` |
| `nutrient_manual_entry_observations` | `id` | Shared reference/provenance | Source API observations used to build manual-entry groups and fields | `nutrient_id → nutrient_definitions` |
| `nutrient_relationship_rules` | `id` | Shared validation reference | DB-backed nutrient math/relationship rules, such as child nutrients not exceeding parent nutrients | `parent_nutrient_id` and `child_nutrient_id → nutrient_definitions` |

### `nutrient_definitions`

Canonical nutrient lookup table.

Columns: `nutrient_id`, `nutrient_name`, `nutrient_number`,
`default_unit_name`, `created_at`, `updated_at`.

Notes:
- This table is the anchor for manual entry, normalized nutrients, nutrient goal
  selection, and nutrient relationship validation.

### `food_nutrients`

Stores normalized nutrient facts for any supported food parent.

Columns: `id`, `owner_user_id`, `user_food_list_item_id`, `custom_food_id`,
`shared_product_submission_id`, `shared_product_id`,
`shared_product_revision_id`, `shared_product_observation_id`, `nutrient_id`,
`amount_per_100g`, `unit_name`, `value_origin`, `source`,
`source_reference`, `source_observation_id`, `confidence`, `created_at`,
`updated_at`.

Notes:
- A row must point to exactly one parent food record.
- Private user nutrients use `owner_user_id`; shared/catalog nutrients should not
  be user-owned.
- Unique indexes prevent duplicate nutrient rows for the same parent.

### `nutrient_manual_entry_*`

These tables make manual-entry UI DB-driven.

Columns:
- `nutrient_manual_entry_groups`: `id`, `entry_step`, `title`, `sort_order`,
  `enabled`, `source_count`, `observation_count`, `verification_status`,
  `sources`, `last_observed_at`, timestamps.
- `nutrient_manual_entry_fields`: `dedupe_key`, `nutrient_id`, `group_id`,
  `nutrient_type`, `display_label`, `required_for_manual_entry`, `sort_order`,
  `enabled`, `source_count`, `observation_count`, `verification_status`,
  `sources`, `last_observed_at`, timestamps.
- `nutrient_manual_entry_required_nutrients`: `nutrient_id`,
  `requirement_key`, `group_id`, `field_sort_order`, `reason`, `source`,
  `source_count`, `observation_count`, `sources`, `provenance`, `enabled`,
  timestamps.
- `nutrient_manual_entry_observations`: source/query/reference fields,
  nutrient/group/field classification, source payload, and timestamps.

Notes:
- Seeded by `scripts/seed_manual_entry_nutrients.mjs`.
- Groups/fields should render from these tables only.
- Required status should render from `nutrient_manual_entry_required_nutrients`
  via `nutrient_manual_entry_fields.required_for_manual_entry`; do not maintain
  a separate UI-only required nutrient list.
- Observations preserve API provenance; groups/fields are the app-ready lookup.

### `nutrient_relationship_rules`

Stores validation rules for nutrient math.

Columns: `id`, `parent_nutrient_id`, `child_nutrient_id`, `relationship`,
`severity`, `message`, `requires_parent`, `tolerance`, `enabled`,
`sort_order`, `source`, `source_count`, `observation_count`, `sources`,
`provenance`, `created_at`, `updated_at`.

Notes:
- Used by client and server paths so canonical nutrient validation is not
  browser-only.
- Current rule type is `child_must_not_exceed_parent`.

## Product Reference Data and Serving Measures

These tables replace runtime nutrient, source, serving-unit, alias, and unit-conversion
constants. The app loads them from Supabase and uses them when it interprets USDA FoodData
Central and Open Food Facts products.

| Table | Primary Key | Purpose | Key Relationships |
| --- | --- | --- | --- |
| `product_data_sources` | `key` | Canonical identity, display name, URLs, terms, and observation history for each external API, standards API, or internal catalog | Referenced by all source-specific mapping and serving tables |
| `product_source_daily_metrics` | `(metric_date, source_key, source_data_type, lookup_kind, lookup_origin)` | Privacy-safe daily API usage, reliability, match, nutrient-depth, metadata-coverage, cache, and timing counters | `source_key → product_data_sources.key` |
| `nutrient_source_mappings` | `(source_key, source_nutrient_key, source_unit_name)` | Maps a source API nutrient key and unit to the app's canonical nutrient | `source_key → product_data_sources.key`, `nutrient_id → nutrient_definitions.nutrient_id` |
| `nutrient_unit_conversions` | `(source_key, nutrient_id, from_unit_name, to_unit_name)` | Stores source- and nutrient-specific conversion multipliers | `source_key → product_data_sources.key`, `nutrient_id → nutrient_definitions.nutrient_id` |
| `serving_measure_units` | `key` | App-ready serving units, labels, dimensions, order, defaults, and conversion to grams or milliliters | `source_key → product_data_sources.key` |
| `serving_measure_aliases` | `(unit_key, normalized_alias)` | Recognizes API and label spellings such as `tbsp`, `tablespoon`, and `tablespoons` | `unit_key → serving_measure_units.key`, `source_key → product_data_sources.key` |

### `product_data_sources`

Columns: `key`, `display_name`, `source_type`, `homepage_url`, `api_base_url`,
`terms_url`, `attribution_text`, `enabled`, observation counts/timestamps,
`provenance`, and timestamps.

Notes:
- Source names shown by barcode lookup come from this table. Runtime lookup code does not
  invent vendor labels.
- Source rows are maintained by the reference-data seed script, with API-observed provenance.

### `product_source_daily_metrics`

Columns: `metric_date`, `source_key`, `source_data_type`, `lookup_kind`,
`lookup_origin`, lookup/API/cache/error/match counters, evaluated product and
reported nutrient totals, brand/category/serving/ingredient/image coverage
counters, response milliseconds, and timestamps.

Notes:
- Runtime lookups record daily counters through the service-role-only
  `record_product_source_daily_metric` function, using one atomic upsert per
  completed source attempt.
- The table deliberately stores no barcode, search text, user id, or vendor
  payload.
- `runtime` rows explain real traffic and API/cache load. `benchmark` rows send
  the same saved barcodes to each source for a fair coverage comparison.
- Run `npm run report:source-quality` for runtime activity, or run `npm run
  benchmark:source-quality -- --limit=10` followed by `npm run
  report:source-quality -- --origin=benchmark` for a direct comparison.
- The report's coverage index measures observed completeness and reliability;
  it does not replace the source-authority policy.

### `nutrient_source_mappings`

Columns: `source_key`, `source_nutrient_key`, `source_unit_name`,
`source_nutrient_name`, `nutrient_id`, `priority`, `mapping_method`, `confidence`,
`enabled`, observation counts/timestamps, `provenance`, and timestamps.

Notes:
- `nutrient_definitions` remains the canonical owner of nutrient names, numbers, and default
  units. This table only explains how a source API field maps to that canonical row.
- The lookup index starts with source and source nutrient key so barcode mapping does not scan
  the full table.

### `nutrient_unit_conversions`

Columns: `source_key`, `nutrient_id`, `from_unit_name`, `to_unit_name`,
`multiplier`, `conversion_method`, `confidence`, `observation_count`, `provenance`,
and timestamps.

Notes:
- Conversion rows are source- and nutrient-specific because conversions such as vitamin IU
  values cannot be safely treated as universal unit math.
- The seed script stores standards-API or paired API-observation provenance with each multiplier.

### `serving_measure_units` and `serving_measure_aliases`

Unit columns: `key`, `display_label`, `short_label`, `dimension`, `base_unit_key`,
`conversion_to_base`, `standards_code`, `display_order`, `is_default`, `enabled`,
`source_key`, `source_reference`, `observed_at`, and timestamps.

Alias columns: `unit_key`, `alias`, `normalized_alias`, `source_key`, observation
counts/timestamps, and timestamps.

Notes:
- `serving_measure_units` has one enabled default per dimension and indexed display ordering.
- Basic multiplication remains application code; available units, aliases, labels, enabled
  state, and conversion factors are database-owned.
- Authenticated users can read all five reference tables. Only service-role scripts can write
  them.
- Run `npm run seed:product-reference-data -- --sample-size=200` after the migration to sample
  USDA FoodData Central, Open Food Facts, and the UCUM standards service and refresh these rows.

## Shared Product Catalog and Barcode Flow

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `shared_product_submissions` | `id` | Submitted by one auth user | Community product submissions awaiting review or already reviewed | `submitted_by → auth.users.id`, optional reviewer |
| `shared_products` | `id` | Shared catalog | Approved active shared products searchable by all authenticated users | Optional approved submission/reviewer |
| `shared_product_revisions` | `id` | Shared catalog | Historical revisions for approved products | `shared_product_id → shared_products.id` |
| `shared_product_observations` | `id` | Shared evidence/provenance | API, user-label, manufacturer, or GS1 observations for a barcode | Optional submission/user links |
| `shared_product_field_provenance` | `id` | Shared evidence/provenance | Which observation supplied each canonical shared product field | `shared_product_id`, `observation_id` |
| `shared_product_conflicts` | `id` | Shared moderation/provenance | Open/resolved conflicts between observed values | `shared_product_id → shared_products.id` |
| `food_image_assets` | `id` | Shared image reference | Source-backed product/ingredient image metadata rendered by ingredient UI | Optional `shared_product_id → shared_products.id`, optional barcode |
| `product_api_cache` | `(provider, cache_key)` | Server cache | External API response cache for searches, barcode lookup, and food detail | No user ownership |
| `product_submission_blocks` | `id` | One auth user per block event | Temporary submission block after repeated rejected submissions | `user_id → auth.users.id`, optional source submission |

### `shared_product_submissions`

Stores user-submitted products before/after moderation.

Columns: `id`, `submitted_by`, `barcode`, `product_name`, `brand_owner`,
`category_option_id`, `food`, `consent_to_share`, `status`, `verification_status`,
`matched_source`, `matched_reference`, `validation_report`, `evidence_paths`,
`evidence_complete`, `reviewed_by`, `reviewed_at`, `review_note`,
`created_at`, `updated_at`.

Notes:
- Public sharing requires `consent_to_share = true`.
- `status` can be `pending`, `approved`, `rejected`, or `auto_declined`.
- `auto_declined` means server validation blocked a bad share attempt before it
  reached normal moderation; it should not count as a human rejection.
- `validation_report` carries barcode/source comparison and nutrient validation
  results for moderation.
- `category_option_id` points to the canonical DB-backed app category selected
  or resolved before submission. Raw API categories remain inside `food` for
  source proof and future remapping.

### `shared_products`

Approved catalog product.

Columns: `id`, `barcode`, `product_name`, `brand_owner`, `search_text`,
`category_option_id`, `food`, `source`, `source_reference`, `confidence`, `status`,
`approved_submission_id`, `approved_by`, `last_verified_at`,
`canonical_provenance`, `compatibility_summary`, `created_at`, `updated_at`.

Notes:
- Search uses indexed `search_text`.
- The `food` JSON preserves source identity separately from catalog status. For
  USDA-backed products this includes `sourceKey`, the DB-provided `sourceLabel`,
  `sourceDataType` (`Branded`, `Foundation`, `SR Legacy`, or `Survey (FNDDS)`),
  and available source publication/modification dates.
- USDA barcode products use exact normalized GTIN matches and keep the newest
  active `Branded` record. Missing nutrient values remain missing; values from
  unrelated USDA records are not blended into the product.
- Compatibility summaries are rebuilt from compatibility facts.
- `category_option_id` is inherited from the approved submission. A database
  trigger blocks publication when no enabled canonical category can be resolved.
- `shared_product_revisions.category_option_id` copies the published product
  category so historical revisions retain the category used at publication.

### Product evidence and cache tables

`shared_product_observations`, `shared_product_field_provenance`, and
`shared_product_conflicts` hold the evidence trail behind shared catalog data.
`product_api_cache` reduces external API load and should be written/read by
server code only.

### `food_image_assets`

Stores reusable image metadata for ingredients and packaged products. This table
does not replace private moderation evidence; it only stores source-backed or
approved image records that the app can safely render.

Columns: `id`, `barcode`, `shared_product_id`, `source`, `source_reference`,
`image_role`, `image_url`, `thumbnail_url`, `storage_path`, `license_name`,
`license_url`, `attribution_text`, `confidence`, `crop_x`, `crop_y`,
`crop_zoom`, `crop_source`, `approved_by`, `approved_at`, `status`,
`fetched_at`, `created_at`, `updated_at`.

Notes:
- Open Food Facts package images are stored here with source, license, and
  attribution before UI cards render them.
- Existing barcode-backed foods can be backfilled with `npm run
  backfill:food-images`, which stores image metadata instead of repeatedly
  calling external APIs from the UI.
- Users can read active rows, but only service-role/server code can write rows.
- Indexed lookup paths cover active barcode images, shared-product images,
  generic images, and source/reference deduping.
- Card thumbnails use `crop_x`, `crop_y`, and `crop_zoom`; nutrition detail
  views use the full image.
- Community images stay private until a moderator approves them. Approval writes
  a `community-reviewed` image row with `moderator-reviewed` confidence and
  approval metadata.

Storage bucket:
- `product-submission-evidence`: private product evidence images, scoped under
  the submitting user id.
- `food-image-assets`: public approved/source-backed product image files. Do not
  store private evidence here until moderation approves it.

## Compatibility, Allergens, and Dietary Restrictions

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `compatibility_tags` | `id` | Shared reference | Canonical compatibility tags for allergens, dietary claims, ingredients, and avoidance concepts | Referenced by user rules and product facts |
| `product_compatibility_facts` | `id` | Shared product metadata | Facts extracted from shared products/submissions/observations | `tag_id → compatibility_tags.id`; exactly one product/submission/observation parent |
| `food_preference_option_catalog` | `id` | Shared reference | App-ready allergen/dietary/ingredient options built from product compatibility and ingredient data | Optional `tag_id → compatibility_tags.id` |
| `food_preference_api_observations` | `id` | Shared reference/provenance | Raw observed allergen/dietary/ingredient metadata from external APIs | No direct user ownership |

### `compatibility_tags`

Columns: `id`, `slug`, `label`, `category`, `created_at`, `updated_at`.

Notes:
- `category` is `allergen`, `dietary`, `ingredient`, or `avoidance`.

### `product_compatibility_facts`

Columns: `id`, `shared_product_id`, `shared_product_observation_id`,
`shared_product_submission_id`, `tag_id`, `fact_type`, `source_type`,
`source_text`, `confidence`, `created_at`, `updated_at`.

Notes:
- A fact points to exactly one product, observation, or submission parent.
- These facts drive profile warnings such as allergen and dietary conflicts.

### `food_preference_option_catalog`

Columns: `id`, `category`, `label`, `normalized_value`, `source_type`,
`tag_id`, `source_values`, `usage_count`, `created_at`, `updated_at`.

Notes:
- Built by `rebuild_food_preference_option_catalog`.
- UI should query this table for allergen and dietary dropdown options.

### `food_preference_api_observations`

Columns: `id`, `category`, `fact_type`, `label`, `normalized_value`,
`source`, `source_field`, `source_value`, `source_reference`, `source_payload`,
`query`, `matched_name`, `brand_owner`, `observation_count`, `first_seen_at`,
`last_seen_at`.

Notes:
- Seeded by food preference audit scripts.
- Used as provenance/reference data, not as direct user preference rows.

## Custom Food Category Reference

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `custom_food_category_options` | `id` | Shared reference | DB-backed dropdown options for manual custom-food categories | Built from observations |
| `custom_food_category_observations` | `id` | Shared reference/provenance | External API category observations used to build options | No direct user ownership |
| `custom_food_category_mappings` | `source_normalized_value` | Shared reference/provenance | Maps raw observed API category strings to clean app category options for barcode/manual-entry autofill | `category_option_id → custom_food_category_options.id` |

### `custom_food_category_options`

Columns: `id`, `label`, `normalized_value`, `sources`, `source_count`,
`observation_count`, `verification_status`, `enabled`, `first_seen_at`,
`last_seen_at`, `created_at`, `updated_at`.

Notes:
- UI category dropdowns should sort by `label`.
- Seeded by `scripts/seed_custom_food_categories.mjs`.
- The dropdown renders these app-ready options, not raw source payload strings.
- `shared_product_submissions`, `shared_products`, and
  `shared_product_revisions` reference this table through `category_option_id`.

### `custom_food_category_observations`

Columns: `id`, `category_id`, `label`, `normalized_value`, `source`, `query`,
`source_field`, `source_value`, `source_reference`, `source_payload`,
`observation_count`, `first_seen_at`, `last_seen_at`, `created_at`,
`updated_at`.

Notes:
- Source values come from `fdc-search`, `fdc-branded-detail`, and
  `open-food-facts`.
- Observations preserve raw API source category data, including Open Food Facts
  categories, category tags, category hierarchy, and food groups when available.

### `custom_food_category_mappings`

Columns: `source_normalized_value`, `source_value`, `source_values`,
`source_fields`, `sources`, `category_option_id`, `category_option_label`,
`confidence`, `match_reason`, `source_count`, `observation_count`,
`first_seen_at`, `last_seen_at`, `created_at`, `updated_at`.

Notes:
- Barcode/manual-entry autofill should use this table to pick the visible app
  category.
- Raw API category values remain stored in `custom_food_category_observations`
  and on product payloads for proof and moderation.
- Seeded by `scripts/seed_custom_food_categories.mjs`; use
  `npm run seed:food-categories:deep` for a broader API sample.
- Use `npm run seed:food-categories:rebuild` when observations already exist
  and only mappings need to be refreshed.
- Do not map category autofill by taking the first raw API category value.
- `resolve_custom_food_category_option(text[])` performs reusable DB-side
  category resolution using enabled options and observed mappings.
- `npm run backfill:shared-product-categories` checks USDA FoodData Central and
  Open Food Facts, records category provenance, and repairs legacy catalog rows.

## Moderation and Access Control

| Table | Primary Key | Owner Scope | Purpose | Key Relationships |
| --- | --- | --- | --- | --- |
| `app_role_assignments` | `user_id` | One row per elevated user | Grants `moderator` or `admin` role | `user_id → auth.users.id`, optional `granted_by` |
| `account_moderation` | `user_id` | One row per moderated user | Tracks active/suspended/banned state | `user_id → auth.users.id`, optional `moderated_by` |
| `moderation_actions` | `id` | Audit log | Records moderation actions and reason codes | `target_user_id`, optional `actor_user_id` |
| `moderation_email_deliveries` | `id` | Audit log | Tracks moderation email delivery status | `moderation_action_id → moderation_actions.id` |
| `blocked_signup_emails` | `email_hash` | Blocklist | Prevents signup by hashed email | Optional source/blocking users |
| `profile_image_policy_acceptances` | `id` | Many rows per auth user | Records profile image policy acceptance per avatar upload | `user_id → auth.users.id` |

Notes:
- Moderation/admin writes are intentionally not available to normal
  authenticated clients.
- `blocked_signup_emails` stores hashes, not raw email addresses.
- `reject_blocked_signup` is the auth hook function for blocking signups.

## RPC / Database Functions

| Function | Purpose |
| --- | --- |
| `set_updated_at` | Shared updated-at trigger helper |
| `default_profile_display_name` | Builds a safe default display/profile name |
| `set_default_profile_display_name` | Trigger helper that fills missing profile display names |
| `create_profile_for_new_auth_user` | Auth trigger helper that creates a profile row for new users |
| `replace_food_nutrients` | Replaces normalized nutrient rows for exactly one food parent |
| `food_list_item_identity_key` | Produces the canonical barcode-or-FDC identity used to prevent cross-list duplicates |
| `place_user_food_list_item` | Atomically adds an ingredient, reports a required cross-list move, or completes a confirmed move |
| `publish_shared_product_submission` | Publishes an approved submission into the shared catalog and revisions/evidence tables |
| `compatibility_normalize_text` | Normalizes compatibility labels/values for matching |
| `extract_product_compatibility_facts` | Extracts product compatibility facts from food/product JSON |
| `rebuild_shared_product_compatibility_summary` | Rebuilds denormalized compatibility summary JSON on shared products |
| `sync_user_compatibility_rules` | Syncs user food preferences into normalized compatibility rules |
| `rebuild_food_preference_option_catalog` | Rebuilds allergen/dietary/ingredient option catalog from product facts |
| `sync_nutrient_manual_entry_fields` | Rebuilds manual-entry nutrient groups/fields from observations |
| `rebuild_custom_food_category_options` | Rebuilds manual custom-food category options from observations |
| `normalize_food_category_value` | Normalizes category text for option and mapping lookup |
| `resolve_custom_food_category_option` | Resolves raw API category values to one enabled canonical category option |
| `reject_blocked_signup` | Supabase Auth hook for hashed email signup blocks |

## Storage Buckets

| Bucket | Public | Purpose | Access Pattern |
| --- | --- | --- | --- |
| `profile-avatars` | No | User avatar files | Authenticated user can manage files under their own user id folder |
| `product-submission-evidence` | No | Product label/evidence images for shared catalog moderation | Authenticated user can manage files under their own user id folder |

## Update Checklist

When schema changes:

1. Add a migration in `supabase/migrations/`.
2. Add RLS and grants intentionally.
3. Add indexes for expected filtering, sorting, joins, and lookup paths.
4. Regenerate `src/lib/types/database.types.ts` after migration is applied.
5. Update this document with table purpose, owner scope, key columns, and
   relationships.
6. Add or update focused tests for migration expectations when practical.
7. Add a local-only QA item in `docs/QA/qa-tasks.md` if the change affects user-visible data,
   moderation behavior, or data-entry flow.
