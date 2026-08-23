# Supabase Schema

This document is the plain-language map of the app-owned Supabase schema. The source of
truth remains the migrations in `supabase/migrations/` and the generated types in
`src/lib/types/database.types.ts`; update this file whenever tables, relationships,
policies, or core data ownership changes.

## Schema Navigation

| Domain | Tables and registries |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Core User Data](#core-user-data) | `profiles`, `user_tutorial_preferences`, `user_food_preferences`, `user_compatibility_rules`, `mix_preferences` |
| [Mix Goals](#mix-goal-presets-and-active-goals)                                               | Stable system presets, immutable versions, private user presets, and normalized active nutrient goals           |
| [Ingredient Lists and Saved Mixes](#ingredient-lists-and-saved-mixes) | `user_food_list_items`, `custom_foods`, `saved_drinks`, `ingredient_provenance_options`, `app_issue_codes` |
| [Nutrients and Validation](#nutrient-definitions-values-and-validation) | `nutrient_definitions`, `food_nutrients`, `nutrient_manual_entry_*`, `nutrient_relationship_rules` |
| [Product Sources and Servings](#product-reference-data-and-serving-measures) | `product_data_sources`, source metrics/mappings/conversions, serving measures, `food_servings` |
| [Shared Product Catalog](#shared-product-catalog-and-barcode-flow) | submissions, products, revisions, observations, provenance, conflicts, images, caches, and submission blocks |
| [Compatibility and Allergens](#compatibility-allergens-and-dietary-restrictions) | tags, conflict rules, product facts, preference options, and API observations |
| [Food Categories](#custom-food-category-reference) | category options, source observations, canonical mappings, and reusable food-symbol fallbacks |
| [Catalog Monitoring and Food Safety](#catalog-monitoring-and-food-safety) | Product revalidation, immutable provider snapshots, official recall evidence, conservative product matches, and delivery history |
| [Moderation](#moderation-and-access-control) | roles, account moderation, action logs, email delivery, blocked signups, and image-policy acceptance |
| [Operational Analytics](#operational-analytics) | Private daily Vercel page-view, visitor, login, logout, and reload aggregates |
| [Request Security](#request-security-and-least-privilege) | Private request quotas, deny-by-default grants, and protected maintenance functions |
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
- Browser-facing roles receive only the table and function privileges required by an
  intentional RLS or RPC access path. New public objects are deny-by-default.
- Security-definer functions use a controlled search path, derive user ownership from
  `auth.uid()` when user-scoped, and receive explicit role grants rather than inheriting
  PostgreSQL's default public execution privilege.

## Core User Data

| Table                       | Primary Key | Owner Scope             | Purpose                                                                                                    | Key Relationships                                                    |
| --------------------------- | ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `profiles`                  | `user_id`   | One row per auth user   | Display/profile data, appearance and delight preferences, avatar metadata, and avatar policy state           | `user_id → auth.users.id`                                            |
| `user_tutorial_preferences` | `user_id`   | One row per auth user   | Tracks tutorial version and completion state; the legacy reminder field is retained only for backward compatibility and no longer schedules onboarding | `user_id → auth.users.id`                                            |
| `user_food_preferences`     | `user_id`   | One row per auth user   | Optional unit system, allergens, dietary restrictions, nutrient priorities, and default serving preference | `user_id → auth.users.id`                                            |
| `user_compatibility_rules`  | `id`        | Many rows per auth user | Server-derived exact resolution state for saved allergen and dietary preferences                            | User, active policy version, optional canonical tag/term/alias/mapping |
| `mix_preferences`           | `user_id`   | One row per auth user   | Versioned Mix draft state, goal-configuration source, goal basis, and validated section presentation       | User, optional system preset version, optional private user preset     |

### `profiles`

Stores app-facing profile information. Email should not be copied here.

| Table | Documented columns |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles` | `user_id`, `display_name`, `bio`, `appearance_theme`, `cheeky_messages_enabled`, `avatar_path`, `avatar_alt_text`, `avatar_moderation_status`, `avatar_policy_acknowledged_at`, `created_at`, `updated_at` |

Notes:

- `MFA_REQUIRED` is the stable authentication code returned when an elevated action
  requires an AAL2 session. Friendly wording remains in the application message
  catalog.

- `display_name` is required and auto-filled with a safe `User##########` style value if
  the user has not chosen one.
- `bio` is optional and constrained to 150 characters. The tightening migration trims
  any older out-of-contract value once before applying the new constraint.
- `appearance_theme` is constrained to `system`, `light`, or `dark` and defaults to
  `system`.
- `cheeky_messages_enabled` backs the user-facing `Playful messages` preference for
  occasional secondary copy, defaults to `true`, and remains user-disableable.
- Avatar files live in the private `profile-avatars` storage bucket under the user id
  folder.
- Profile and avatar-policy writes are server-owned so browser clients cannot bypass
  field validation, image normalization, or moderation-state assignment. Users retain
  RLS-scoped reads of their own profile and private avatar.

### `user_food_preferences`

Stores optional, potentially sensitive preference inputs. These are user-owned and
should not be required to use the app.

| Table | Documented columns |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user_food_preferences` | `user_id`, `unit_system`, `allergens`, `dietary_restrictions`, `prioritized_nutrient_ids`, `default_smoothie_serving_grams`, `regulatory_region_code`, `regulatory_region_source`, `sensitive_acknowledged_at`, `created_at`, `updated_at` |

Notes:

- Older broad preference fields were removed from the UI direction; keep the app focused
  on actionable allergens, dietary restrictions, and prioritized nutrients.
- `sync_user_compatibility_rules` keeps preference choices aligned with normalized
  compatibility rules.
- `regulatory_region_code` is optional and resolves only against an active,
  version-bound `food_allergen_regulatory_profiles.region_code`. The paired
  `regulatory_region_source` records whether the saved account value began as an
  accepted device suggestion or an explicit account choice.
- `validate_user_food_preference_regulatory_region()` rejects unsupported region codes
  at the database boundary. Regional context can explain labeling rules but cannot
  suppress a warning created by a user's allergen or dietary settings.
- `validate_user_food_preference_inputs()` rejects empty, oversized, or duplicate
  preference wording; duplicate or unsupported priority nutrients; serving defaults
  above 5,000 grams; and preference values saved without acknowledgement. Priority
  nutrients must belong to the enabled database-owned `mix_default` display profile.

### `mix_preferences`

Stores durable account-level Mix configuration separately from saved recipes.

| Table | Documented columns |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mix_preferences` | `user_id`, `mix_state`, `goal_basis`, `source_goal_template_version_id`, `source_user_goal_template_id`, `goal_configuration_initialized`, `goal_template_customized`, `section_order`, `section_disclosure_state`, `created_at`, `updated_at` |

Notes:

- `mix_state` remains an independently versioned nutrition-builder snapshot.
- `goal_configuration_initialized` distinguishes an intentionally empty tracked-goal
  set from an account that has never chosen goals, so the UI never invents defaults
  after a user removes every goal.
- `section_order` stores every supported stable Mix section identifier exactly once.
  Its database constraint and `save_mix_section_order(text[])` reject unknown,
  duplicate, or incomplete layouts.
- `section_disclosure_state` stores one boolean open/closed preference for every stable
  Mix section identifier. Its database constraint and
  `save_mix_section_disclosure_state(jsonb)` reject missing, unknown, or non-boolean
  entries so new sessions can restore the user's complete disclosure layout. Warnings,
  suggested adjustments, and nutrient contributions begin closed; a user's later choices
  remain authoritative across sessions.
- Browser clients retain scoped reads but cannot bypass the authoritative preference
  write functions.

## Mix Goal Presets And Active Goals

System presets are reviewed reference data; personal presets and active goals are
private user data. Applying any preset copies its current targets into the user's active
goal rows, so a later system-version change never silently changes an in-progress Mix.

| Table                            | Primary key                        | Owner scope               | Purpose                                                                                                           | Key relationships                                         |
| -------------------------------- | ---------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `mix_goal_templates`             | `key`                              | Shared stable identity    | Stable key, ordering, enabled/default state, and pointer to the current reviewed version                          | Current version → `mix_goal_template_versions.id`         |
| `mix_goal_template_versions`     | `id`                               | Shared reviewed reference | Immutable display copy, goal basis, publication state, review history, and source evidence for one preset version | Template key, product data source, optional reviewer      |
| `mix_goal_template_targets`      | `template_version_id, nutrient_id` | Shared reviewed reference | Per-nutrient direction, target/range, tolerance, importance, order, rationale, and source evidence                | Version, nutrient definition, product data source         |
| `user_mix_goal_templates`        | `id`                               | One user per preset       | Private reusable goal-preset identity, description, basis, and optional originating system version                | User, optional system preset version                      |
| `user_mix_goal_template_targets` | `template_id, nutrient_id`         | Private preset targets    | Immutable-at-application snapshot values for a personal reusable preset                                           | Personal preset, nutrient definition                      |
| `user_mix_nutrient_goals`        | `user_id, nutrient_id`             | Active goals for one user | Normalized goal rules currently driving Mix calculations, warnings, chart status, and scoring                     | User, nutrient, optional system or personal preset source |
| `mix_runtime_configuration`      | `key`                              | Shared runtime policy     | Versioned chart thresholds, point tolerance, and default Mix serving amount                                       | Product data source                                       |

Goal rows use one explicit `goal_type`: `exact`, `minimum`, `maximum`, or `range`.
`target_amount` is the point, lower bound, or upper ceiling according to that type;
`upper_amount` is populated only for a range. `tolerance_ratio` defines the accepted
boundary around the configured target, while `importance_weight` affects aggregate goal
scores without altering nutrient math. Numeric zero remains a real target value and is
never a missing-value sentinel.

A nutrient receives an automatic goal only from an explicit target in the active,
versioned default template. Runtime configuration does not contain unit-wide or generic
goal values. A nutrient without a reviewed default must receive a target entered by the
user before it can join the chart, warnings, scoring, or adjustment calculations.

The schema reserves both `per_mix` and `per_serving` bases so reviewed versions can
evolve without another structural rewrite. Current authoritative save/apply functions
accept only `per_mix`: Mix does not yet store a serving count, so evaluating a
per-serving preset would be incorrect rather than merely incomplete.

Published system versions and their targets are protected from in-place edits. A
reviewed update creates another version and deliberately advances the stable template's
`current_version_id`. Personal templates remain owner-readable and can be written only
through authenticated functions. Active goal rows are also read-only to browser roles;
`save_mix_goal_configuration`, `apply_mix_goal_template`,
`apply_user_mix_goal_template`, `save_user_mix_goal_template`, and
`delete_user_mix_goal_template` enforce ownership, validation, and atomic replacement.
Only the apply functions may mark a configuration as an unmodified preset copy;
ordinary goal saves are always recorded as customized so clients cannot fabricate
canonical preset provenance.

## Ingredient Lists And Saved Mixes

The product UI calls these **Saved Recipes**. The `saved_drinks` table name is a legacy
database contract and remains unchanged until a deliberate migration updates every
reader, writer, policy, generated type, and persisted reference.

| Table                           | Primary Key          | Owner Scope             | Purpose                                                                             | Key Relationships                                                                |
| ------------------------------- | -------------------- | ----------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `user_food_list_items`          | `id`                 | Many rows per auth user | User fridge and shopping-list items                                                 | `user_id → auth.users.id`, optional active shared product and pending submission |
| `custom_foods`                  | `id`                 | Many rows per auth user | User-created custom foods and barcode/manual-entry payloads                         | `user_id → auth.users.id`                                                        |
| `saved_drinks`                  | `id`                 | Many rows per auth user | Saved recipe snapshots; table name retained for deployed compatibility              | `user_id → auth.users.id`                                                        |
| `ingredient_provenance_options` | `(dimension, value)` | Shared reference        | DB-backed source/trust filters and badge presentation for ingredient list/search UI | No direct user ownership                                                         |

### `user_food_list_items`

Stores the user's active ingredient lists.

| Table | Documented columns |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom_foods` | `id`, `user_id`, `fdc_id`, `barcode`, `name_key`, `category_option_id`, `search_text`, `source_key`, `trust_status`, `food`, `created_at`, `updated_at` |

Notes:

- Unique safeguards prevent duplicate custom names and duplicate user barcodes.
- `search_text` is trigger-maintained and trigram-indexed for partial server search.
  It includes the private food's canonical and alternate names, brand, categories,
  package and household-serving descriptions, structured and list ingredients,
  ingredient-analysis tags, additives, explicit allergen disclosures, precautionary
  statements, labels, market/language metadata, barcode, and retained source identifier
  values. Internal JSON property names, nutrient values, provenance internals, URLs,
  and quality diagnostics are deliberately excluded.
- Normalized nutrients for a custom food live in `food_nutrients`.
- The `food` JSON stores `nameProvenance`. Valid-barcode and autofilled names are
  normalized before saving, including standalone `and` → `&`; barcode-free private names
  and later personal renames preserve the user's exact wording.

### `saved_drinks`

Stores a saved recipe snapshot. The table and JSON-column names are legacy deployed
identifiers retained until a deliberate forward migration changes the database contract.

| Table | Documented columns |
| -------------- | ------------------------------------------------------------ |
| `saved_drinks` | `id`, `user_id`, `name`, `drink`, `created_at`, `updated_at` |

Notes:

- Recipe names are unique per user.
- `drink` stores the recipe composition as JSON; the legacy column name is isolated to
  the database adapter and does not define application terminology.

### `ingredient_provenance_options`

Stores app-ready origin and verification metadata. Provider rows remain available for
internal attribution; only actionable verification rows are enabled for compact badges.

| Table | Documented columns |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
| ----------------- | ------------------------------------------------------------------------------ |
| `app_issue_codes` | `code`, `kind`, `domain`, `description`, `operational_severity`, `responsible_group`, `resolution_action`, `automated_repair_key`, `automated_repair_allowed`, `enabled`, `created_at`, `updated_at` |

Notes:

- `description` is developer-facing contract documentation and must never be rendered as
  user-interface copy.
- The database owns rule evidence, operational severity, work ownership, resolution
  routing, reviewed repair capability, thresholds, and issue-code references. A
  responsible group never grants permission by itself.
- Server boundaries return approved codes with bounded, non-sensitive parameters.
- Friendly wording belongs to the versioned application message catalog so it remains
  available during database outages and can be tested, revised, and translated.
- `automated_repair_allowed` can be true only with a named reviewed handler. It never
  authorizes a write without the repair-run workflow, dry-run evidence, and an
  independently authorized server action.
- Direct table access is restricted to the service role.

## Nutrient Definitions, Values, And Validation

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
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `nutrient_definitions` | `nutrient_id`, `nutrient_name`, `nutrient_number`, `default_unit_name`, `created_at`, `updated_at` |

Notes:

- This table is the anchor for manual entry, normalized nutrients, nutrient goal
  selection, and nutrient relationship validation.

### `food_nutrients`

Stores normalized nutrient facts for any supported food parent.

| Table | Documented columns |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_nutrients` | `id`, food-parent and ownership ids, `nutrient_id`, `amount_per_100g`, `unit_name`, `value_origin`, `value_status`, `value_qualifier`, `standard_error`, `source`, `source_reference`, `source_observation_id`, `source_nutrient_key`, `source_nutrient_code`, `mapping_status`, `mapping_method`, `mapping_review_reference`, `derivation_method`, `confidence`, timestamps |

Notes:

- A row must point to exactly one parent food record.
- Private user nutrients use `owner_user_id`; shared/catalog nutrients should not be
  user-owned.
- Unique indexes prevent duplicate nutrient rows for the same parent.
- `amount_per_100g` contains only accepted numeric values used by nutrition and Mix
  math. `value_status` keeps reported, reported-zero, estimated, and derived values distinct;
  missing, trace, present-but-unquantified, invalid, and unmapped source facts never
  become numeric rows. `value_qualifier` preserves an exact provider qualifier such as
  `source-estimate` instead of presenting an estimate as reported data.
- `standard_error` is source-reported review metadata. It never changes
  `amount_per_100g`. Source nutrient keys/codes and mapping/derivation metadata retain
  the exact normalization decision; `mapping_review_reference` is internal moderation
  evidence and is not serialized by the public API.
- `apply_food_nutrient_uncertainty` populates these columns only from the exact parent
  food snapshot. It does not infer uncertainty from provider identity or a similar
  nutrient.

### `nutrient_manual_entry_*`

These tables make manual-entry UI DB-driven.

| Table | Documented columns |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nutrient_manual_entry_groups` | `id`, `entry_step`, `title`, `sort_order`, `enabled`, `group_role`, `source_count`, `observation_count`, `verification_status`, `sources`, `last_observed_at`, timestamps |
| `nutrient_manual_entry_fields` | `dedupe_key`, `nutrient_id`, `group_id`, `nutrient_type`, `display_label`, `required_for_manual_entry`, `sort_order`, `enabled`, `source_count`, `observation_count`, `verification_status`, `sources`, `last_observed_at`, `classification_status`, `classification_source_key`, `classification_reference`, `classification_version`, `classification_notes`, `replacement_nutrient_id`, `reviewed_at`, timestamps |
| `nutrient_manual_entry_required_nutrients` | `nutrient_id`, `requirement_key`, `group_id`, `field_sort_order`, `reason`, `source`, `source_count`, `observation_count`, `sources`, `provenance`, `enabled`, timestamps |
| `nutrient_manual_entry_observations` | Source/query/reference fields, raw `nutrient_id`, approved `canonical_nutrient_id`, observed group/field metadata, source payload, and timestamps |

Notes:

- Seeded by `scripts/seeds/nutrition/seed_manual_entry_nutrients.mjs` through the current approved DB
  catalog. The script records new source nutrients but does not invent their UI group.
- Groups/fields render from enabled, approved DB rows only. Macros contains common
  nutrition-label fields; specialized carbohydrates, fats, carotenoids, vitamins,
  minerals, amino acids, and other composition data remain in Extended.
- The reviewed baseline Extended catalog is installed independently of provider
  observations so valid fields do not disappear when an optional source is unavailable.
  Source observations add evidence counts and review candidates; they do not decide
  whether an approved field exists in the UI.
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
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nutrient_relationship_rules` | `id`, `parent_nutrient_id`, `child_nutrient_id`, `relationship`, `severity`, `issue_code`, `requires_parent`, `tolerance`, `enabled`, `sort_order`, `source`, `source_count`, `observation_count`, `sources`, `provenance`, `created_at`, `updated_at` |

Notes:

- Used by client and server paths so canonical nutrient validation is not browser-only.
- Current rule type is `child_must_not_exceed_parent`.
- `issue_code → app_issue_codes.code`; the client message catalog combines that code
  with the joined nutrient labels to produce friendly wording.

## Product Reference Data And Serving Measures

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
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
- `cola-cloud` is an enabled server-key trial for exact U.S. alcohol-label lookup, but
  both canonical storage and API redistribution remain disabled pending a separate
  rights review and representative benchmark.
- Source rows are maintained by the reference-data seed script, with API-observed
  provenance.
- `api_redistribution_allowed` is the separate API-publication decision. API v1 never
  infers it from the provider name or from canonical storage alone.
- `blendcalc_api_v1_source_attribution_is_complete` additionally requires every
  represented field, nutrient, and serving source to retain complete reviewed source
  attribution. A source such as USDA may retain a direct provider record identifier even
  when the same provider also owns imported composition datasets. Dataset-derived rows
  must instead reference an exact active, approved, imported release with complete
  release metadata.

### `product_source_daily_metrics`

| Table | Documented columns |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
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
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nutrient_source_mappings` | `source_key`, `source_nutrient_key`, `source_unit_name`, `source_nutrient_name`, `nutrient_id`, `priority`, `mapping_method`, `review_status`, `review_reference`, `confidence`, `enabled`, observation counts/timestamps, `provenance`, and timestamps |

Notes:

- `nutrient_definitions` remains the canonical owner of nutrient names, numbers, and
  default units. This table only explains how a source API field maps to that canonical
  row.
- Runtime barcode mapping resolves enabled `nutrient_equivalences` before form
  autofill, so source aliases such as USDA `1085` cannot bypass the canonical Total Fat
  field. Exact canonical rows take precedence if a response contains both forms.
- Enabled mappings are reviewed identity decisions, not name-similarity decisions.
  Exact provider nutrient IDs, reviewed source keys, and approved dataset identities
  retain review evidence. Taxonomy/name similarity remains disabled and pending until
  reviewed into an identity-bearing method; seed runs may refresh only its observation
  metadata and cannot replace an approved or rejected identity.
- Runtime lookup requires the exact normalized `(source key, nutrient key, source unit)`
  row. Equivalent unit spellings normalize to the same unit, while a genuinely different
  unit requires its own approved mapping plus a nutrient-specific reviewed conversion.
- Database constraints prevent pending mappings from being enabled, require evidence on
  approved rows, preserve reviewed semantic rejections, and prevent legacy semantic
  metadata from becoming canonical `food_nutrients` lineage.
- The lookup index starts with source and source nutrient key so barcode mapping does
  not scan the full table.
- `20260727120000_canonical_barcode_nutrient_mappings.sql` restores the reviewed Open
  Food Facts label mappings, including Total Fat and gram-to-milligram Sodium, and
  rewrites applicable existing food snapshots through the enabled equivalence catalog.

### `nutrient_unit_conversions`

| Table | Documented columns |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nutrient_unit_conversions` | `source_key`, `nutrient_id`, `from_unit_name`, `to_unit_name`, `multiplier`, `conversion_method`, `confidence`, `observation_count`, `provenance`, and timestamps |

Notes:

- Conversion rows are source- and nutrient-specific because conversions such as vitamin
  IU values cannot be safely treated as universal unit math.
- The seed script stores `reviewed_standard`, moderator-reviewed, or paired
  API-observation provenance with each multiplier. `reviewed_standard` rows reference
  the official UCUM specification and licence rather than a live conversion service.
- A source mapping with a different unit cannot rely on same-family mass or energy
  assumptions. It remains unusable until this table contains the exact reviewed
  source/nutrient/from-unit/to-unit conversion.

### `serving_measure_units` and `serving_measure_aliases`

| Table | Documented columns |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serving_measure_units` | `key`, `display_label`, `short_label`, `dimension`, `base_unit_key`, `conversion_to_base`, `standards_code`, `display_order`, `is_default`, `enabled`, `source_key`, `source_reference`, `observed_at`, and timestamps |
| `serving_measure_aliases` | `unit_key`, `alias`, `normalized_alias`, `source_key`, observation counts/timestamps, and timestamps |

Notes:

- `serving_measure_units` has one enabled default per dimension and indexed display
  ordering.
- Basic multiplication remains application code; available units, aliases, labels,
  enabled state, and conversion factors are database-owned.
- Authenticated users can read all five reference tables. Only service-role scripts can
  write them.
- Run `npm run seed:product-reference-data -- --sample-size=200` to sample USDA FoodData
  Central and Open Food Facts, then refresh mappings and serving observations against
  the reviewed local UCUM reference catalog. The workflow makes no NLM UCUM request.

`product_data_sources.ucum-standard` is the active reviewed unit-standard identity.
`product_data_sources.ucum-nlm` remains disabled as historical provenance. Existing
serving units and aliases reference `ucum-standard`; prior NLM conversion URLs remain
only in nutrient-conversion provenance as `previousServiceReference`.

### `food_servings`

Stores source-reported and user-entered serving sizes separately from each food's JSON
snapshot.

| Table | Documented columns |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_servings` | `id`, `owner_user_id`, `user_food_list_item_id`, `custom_food_id`, `shared_product_submission_id`, `shared_product_id`, `shared_product_revision_id`, `shared_product_observation_id`, `source_observation_id`, `serving_order`, `label`, `gram_weight`, optional `amount` and `unit_key`, `is_primary`, `measure_type`, `is_household_measure`, `source_measure_key`, `origin`, `gram_weight_method`, `calculation_basis`, `source`, `source_reference`, `confidence`, and timestamps |

Notes:

- A row points to exactly one food parent. Partial unique indexes enforce stable order
  and no more than one primary serving per parent.
- Parent-table triggers rebuild serving rows whenever food/source data changes. This
  keeps list items, custom foods, submissions, products, revisions, and observations
  synchronized without relying on browser writes.
- `source_observation_id` identifies the exact observation supporting the serving.
  A provider name, FDC ID, or product-level source is not sufficient field evidence;
  rows without an observation remain explicitly `unknown`.
- `origin` distinguishes a package-label serving, source household measure, direct
  source weight, user-entered serving, calculated conversion, or unknown lineage.
  `gram_weight_method` separately records whether the gram value was reported,
  converted exactly from a weight unit, entered by the user, calculated from a measured
  weight-to-volume pair, or is unknown.
- `measure_type`, `is_household_measure`, and `source_measure_key` retain source measure
  semantics without using an internal key as display copy. `calculation_basis` records
  the measured relationship behind a calculated conversion when one exists.
- The serving-semantics trigger backfills only from an exact matching serving in the
  parent snapshot or linked source observation. It never infers lineage from a provider
  name, barcode, FDC identifier, food name, or category.
- The initial migration checks every existing parent row and backfills all valid serving
  data already present. Foods without a trustworthy serving stay empty; the migration
  does not invent a 100g package serving.
- The nutrition view loads these rows, defaults to the primary source serving, and still
  offers the normalized 100g basis. Mix may calculate another unit only from an exact
  weight conversion or a measured serving pair and preserves that calculation basis.
- Authenticated users may read their own serving rows and servings attached to active
  shared products. Only server/service-role paths may write them.

## Shared Product Catalog And Barcode Flow

### API Publication Concerns And Holds

`api_publication_concerns` stores private evidence-backed reports from users,
providers, brands, rights holders, or other reporters. Each row targets exactly one
`shared_products`, `food_image_assets`, `generic_food_datasets`, or
`product_data_sources` row and retains normalized reporter contact, concern type,
bounded HTTPS evidence references, urgency, status, and reviewed resolution. A partial
unique fingerprint makes repeated unresolved submissions idempotent.

`api_publication_holds` stores reversible public-API holds for one exact product,
image, dataset release, or source. Partial unique indexes permit only one active hold
per subject. Each row records a reason code, safe public message, private note,
optional concern, placing actor/time, and release actor/time/note. Releasing updates
rather than deletes the row.

Product holds are mirrored into a high-severity `shared_product_conflicts` row by
`sync_product_publication_hold_conflict`, so the established readiness gate withholds
the product. `blendcalc_api_v1_source_has_active_hold` makes source/dataset attribution
fail closed. The trusted API image reader filters active image holds independently.
Both tables force RLS and grant table access only to `service_role`.

| Table                             | Primary Key             | Owner Scope                   | Purpose                                                                   | Key Relationships                                                   |
| ---------------------------------- | ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `shared_product_submissions`      | `id`                    | Submitted by one auth user    | Community product submissions awaiting review or already reviewed         | `submitted_by → auth.users.id`, optional reviewer                   |
| `shared_products`                 | `id`                    | Shared catalog                | Approved active shared products searchable by all authenticated users     | Optional approved submission/reviewer                               |
| `shared_product_revisions`        | `id`                    | Shared catalog                | Historical revisions for approved products                                | `shared_product_id → shared_products.id`                            |
| `shared_product_revision_changes` | `id`                    | Shared catalog history        | Queryable old/new field values attached to an approved product revision    | `revision_id → shared_product_revisions.id`                         |
| `shared_product_observations`     | `id`                    | Shared evidence/provenance    | API, user-label, manufacturer, or GS1 observations for a barcode          | Optional submission/user links                                      |
| `shared_product_field_provenance` | `id`                    | Shared evidence/provenance    | Which observation supplied each canonical shared product field            | `shared_product_id`, `observation_id`                               |
| `product_ingredient_statements`   | `id`                    | Shared evidence projection    | Exact reported ingredient statement/list/tree selected for a product, observation, or submission | Exactly one owner; optional source observation                       |
| `product_ingredient_components`   | `id`                    | Shared evidence projection    | Ordered relational ingredient tree preserving source text, nesting, reported percentages, and source payload | `statement_id`, optional parent component and reviewed ingredient term |
| `product_precautionary_statements` | `id`                   | Shared evidence projection    | Exact package precautionary wording plus normalized statement type and allergens | Exactly one owner; optional observation and revision links           |
| `shared_product_conflicts`        | `id`                    | Shared moderation/provenance  | Open/resolved conflicts between observed values                           | `shared_product_id → shared_products.id`                            |
| `catalog_correction_origins`      | `id`                    | Private correction workflow   | Evidence-backed provider changes, field conflicts, and warning reports waiting on or linked to one real catalog correction | Product, base revision, exactly one origin, optional submission and resolved revision |
| `api_publication_concerns`        | `id`                    | Private API review            | Evidence-backed correction, rights, attribution, privacy, and source concerns | Exactly one product, image, dataset release, or source target       |
| `api_publication_holds`           | `id`                    | Private API operations        | Reversible public-output holds with placing and release audit history      | Exactly one product, image, dataset release, or source target       |
| `food_image_assets`               | `id`                    | Shared image reference        | Source-backed product/ingredient image metadata rendered by ingredient UI | Optional `shared_product_id → shared_products.id`, optional barcode |
| `product_api_cache`               | `(provider, cache_key)` | Server cache                  | External API response cache for searches, barcode lookup, and food detail | No user ownership                                                   |
| `user_catalog_submission_enforcement` | `user_id`              | One current row per auth user | Cumulative moderator rejection count and current public-sharing suspension | `user_id → auth.users.id`, optional latest submission/reviewer      |
| `product_submission_blocks`       | `id`                    | One auth user per block event | Immutable history of public catalog submission suspensions                  | `user_id → auth.users.id`, optional source submission               |

### `shared_product_submissions`

Stores user-submitted products before/after moderation.

| Table | Documented columns |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared_product_submissions` | `id`, `submitted_by`, `barcode`, `product_name`, `brand_owner`, `category_option_id`, `food`, `consent_to_share`, `status`, `verification_status`, `matched_source`, `matched_reference`, `validation_report`, `evidence_paths`, `evidence_complete`, `submission_intent`, `submission_kind`, `target_shared_product_id`, `base_revision_id`, `change_summary`, `label_observed_at`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`, `updated_at` |

Notes:

- Public sharing requires `consent_to_share = true`.
- `status` can be `pending`, `approved`, `rejected`, or `auto_declined`.
- `verification_status` is workflow metadata, not field trust. `exact_identity` means
  an external source matched the exact barcode; `manual_review` means a human reviewed
  the submission. Neither state verifies every product field. Selected field evidence
  remains authoritative in `shared_product_field_provenance`.
- `auto_declined` is retained for historical machine-block audit rows and does not count
  as a human rejection. Current same-GTIN differences use the evidence-backed correction
  workflow instead of receiving this status based on value magnitude.
- `validation_report` carries barcode/source comparison and nutrient validation results
  for moderation.
- `category_option_id` points to the canonical DB-backed app category selected or
  resolved before submission. Raw API categories remain inside `food` for source proof
  and future remapping.
- `submission_kind` is `new_product` or `product_update`. Product updates must point to
  both the active shared product and the exact base revision used for comparison.
- `submission_intent` distinguishes ordinary catalog sharing from an explicit
  `catalog_correction`. A correction may reach moderation even when its differences
  would be too large for an ordinary same-barcode submission.
- `change_summary` stores structured before/after values and exact-source research
  results. `label_observed_at` records when blendCalc received the label; it does not
  claim to be the manufacturer's effective date.
- A user may have only one pending correction against a specific base revision.
  Different users may independently submit supporting or conflicting package evidence;
  approving one correction makes the others stale through the existing revision guard.

### `user_catalog_submission_enforcement`

Stores the current public-catalog sharing enforcement state for each user with at least
one moderator-rejected submission.

| Table | Documented columns |
| --- | --- |
| `user_catalog_submission_enforcement` | `user_id`, `moderator_rejection_count`, `sharing_suspended_until`, `latest_rejected_submission_id`, `latest_rejected_by`, `latest_rejected_at`, `created_at`, `updated_at` |

Notes:

- `moderator_rejection_count` is cumulative and increases only when a moderator changes
  a submission from another state to `rejected`. `auto_declined` submissions do not
  count.
- The 51st moderator rejection starts a six-calendar-month public-sharing suspension.
  A later rejection after an expired suspension starts another six-month suspension;
  private food saving and every non-public catalog feature remain available.
- `latest_rejected_submission_id`, `latest_rejected_by`, and `latest_rejected_at` retain
  the latest review evidence without duplicating the complete submission or moderator
  note.
- `private.record_moderator_catalog_submission_rejection` updates the count and any new
  suspension atomically in the same transaction as the review status change. Each new
  suspension also appends a `product_submission_blocks` audit event.
- Authenticated users may read only their own row and cannot alter it. Moderator account
  review reads all current rows through the server-only service-role boundary.

### `product_submission_blocks`

Stores one audit event for every public catalog sharing suspension. Current submission
eligibility comes from `user_catalog_submission_enforcement`; this table preserves the
threshold count, first and latest rejection timestamps, suspension end, triggering
submission, reviewer, and policy note used at that moment.

### `shared_products`

Approved canonical blendCalc catalog product. This table and its normalized child rows
are the source of truth for published app reads and the planned public product API;
external API rows are evidence or missing-field candidates, not competing public
product authorities.

| Table | Documented columns |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared_products` | `id`, `barcode`, `product_name`, `brand_owner`, `search_text`, `category_option_id`, `food`, `source`, `source_reference`, `confidence`, `status`, `approved_submission_id`, `approved_by`, `last_verified_at`, `canonical_provenance`, `compatibility_summary`, `created_at`, `updated_at` |

Notes:

- Search uses indexed `search_text` assembled from the product name, canonical
  brand/owner value, barcode, canonical and alternate identity, categories, package and
  household-serving descriptions, source identifier values, structured and list
  ingredients, ingredient-analysis tags, additives, explicit allergen disclosures,
  precautionary statements, labels, and market/language metadata. It supports partial
  fragments across those fields without indexing arbitrary JSON or nutrition values.
  Server and API ranking keep direct names ahead of brand or responsible organization,
  then category and supporting metadata. Active official safety-alert relationships are
  searched separately so a recalling supplier can find affected products without
  becoming the product's canonical brand.
- Barcode lookup reads the active canonical row before source caches or external APIs.
  Complete rows make no external product request. A legally reusable exact-source value
  may fill only a field that is still missing through
  `apply_shared_product_external_enrichment` or the identity-and-precautionary companion
  `apply_shared_product_supplemental_enrichment`. Both write the source observation,
  selected provenance, normalized projections, and a revision through a service-only
  transaction.
- Existing nonmissing canonical values are never replaced by automatic provider
  enrichment. Data with incompatible storage or redistribution terms remains in its
  isolated cache or source-backed asset table and is not copied into the future public
  dataset.
- The `food` JSON preserves source identity separately from catalog status. For
  USDA-backed products this includes `sourceKey`, the DB-provided `sourceLabel`,
  `sourceDataType` (`Branded`, `Foundation`, `SR Legacy`, or `Survey (FNDDS)`), and
  available source publication/modification dates.
- Canonical food snapshots distinguish `foodIdentityType` as `packaged`, `generic`,
  `private-custom`, or `unknown`. Existing shared products/submissions are backfilled as
  packaged. Provider adapters assign source-specific identity; exact GTIN or brand
  evidence can identify a package, and all other unclassified snapshots remain unknown
  instead of interpreting provider datatype strings in shared application code.
- When a source supplies them and source policy permits canonical storage, `food`
  preserves the raw ingredient statement, normalized `ingredientList`, recursive
  `structuredIngredients`, `ingredientAnalysis`, `additives`, explicit `allergens`,
  explicit `traces`, `dietaryTags`, `labels`, `packageQuantity`, and
  `sourceMetadata`. `sourceMetadata` includes source language, revision/schema version,
  market countries, created/published/available/modified/updated/discontinued
  timestamps, completeness, quality tags, obsolete state, and tag-source evidence.
  Each independently accepted field keeps its source in `fieldProvenance`.
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
- Trusted API v1 server code reads this table through `get_blendcalc_product_v1` and
  `search_blendcalc_products_v1`. These raw RPCs are executable only by `service_role`;
  browser `anon` and `authenticated` roles must use the versioned HTTP routes and cannot
  bypass their public-safe serializer. Both RPCs require an empty result from
  `blendcalc_api_v1_product_readiness_reasons`; therefore an active catalog row is not
  automatically an API-publishable row.
- `blendcalc_api_v1_product_readiness` is a service-role-only diagnostic view over every
  active shared product. It reports the profile key, `verified`, `under_review`, or
  `incomplete` publication status, exact block reasons, and separate quality dimensions
  for identity, required nutrition, servings, ingredient/allergen evidence, provenance,
  conflicts, recency, and redistribution without exposing private evidence to API
  consumers.
- `catalog_product_readiness` is the service-only reusable status record for canonical
  products. It reports `Active`, `Waiting for review`, or `Blocked` for the shared
  catalog; `Ready` or `Withheld` for API v1; and explicit
  `searchable_in_blendcalc`/`usable_in_blendcalc` booleans. An API-withheld product can
  remain available inside blendCalc because catalog usefulness and public
  redistribution are separate decisions.
- `catalog_health_issue_occurrences` normalizes current API-publication reasons,
  material catalog conflicts, nutrient-mapping gaps, enabled source-policy gaps,
  active/import-enabled dataset gaps, and warning-policy coverage gaps. Every row uses
  an `app_issue_codes` contract for urgency, work ownership, supported action, and
  reviewed repair capability. Disabled unused datasets do not create failures.
- `blendcalc_api_publication_profiles` stores versioned fail-closed hard gates separately
  from the broader canonical catalog. The default API v1 packaged-product profile links
  to `api-v1-packaged-core-v1`, requires evidence-backed core identity and serving
  fields, accepts only reported/reported-zero/exactly derived nutrient states, blocks
  unreviewed nutrient mappings and medium/high open conflicts, and expires stale
  verification. A failed row remains canonical but is omitted from API reads.
- `product_regulatory_disclosure_profiles` stores reviewed label contexts separately
  from product observations. Standard Nutrition Facts, regulated alcohol, permitted
  sparse, case-specific kombucha, and unknown contexts each retain authority, region,
  policy source, review date, and whether moderator review is required. Product JSON may
  reference only a known profile; no trigger infers one from a product name or category.
- `food.alcoholByVolume` is optional and valid only as an explicit `volume-percent`
  observation between 0 and 100. A reported zero uses `reported-zero`; an omitted ABV
  remains absent and unknown. The same validation protects submissions, canonical rows,
  and revisions.

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

`catalog_change_summary_is_valid` requires each new product-update submission to carry
at least one uniquely named, typed change with both previous and submitted values.
The revision trigger rejects malformed update summaries and writes the complete
structured set in the same publication transaction. Trusted server code calls
`get_blendcalc_product_revision_history_v1`, which is a bounded service-role-only raw
reader over publication-ready products. The versioned HTTP serializer further allowlists
field paths, replaces stored labels with API-owned wording, and reduces values to bounded
public shapes. Browser roles cannot execute the RPC directly. Revision snapshots,
private evidence, arbitrary JSON, and reviewer identities are never returned. Historical
rows are left with empty changes when no retained evidence can prove the difference.

Product updates merge only the fields named in the reviewed `change_summary`.
Unsubmitted nutrients and metadata remain canonical, unchanged selected provenance is
retained, and the shared row keeps its existing whole-product source identity. New
label-review provenance replaces only the approved field paths.

### Product Evidence And Cache Tables

`shared_product_observations`, `shared_product_field_provenance`, and
`shared_product_conflicts` hold the evidence trail behind shared catalog data.
Observations retain the neutral provider key/reference, source licence, observed time,
content hash, normalized value, raw source payload, and optional private
submission/user links. The public API reads only the observation ID, source, reference,
and observed time from the selected row; raw payloads and private links remain
service-role only. Trusted server-side catalog hydration has explicit read access to
observations so authenticated app routes can return selected provenance without
granting browsers direct access to the evidence tables.

`shared_product_field_provenance` stores the canonical field path, selected observation,
source and normalized values, confidence, evidence method, and selected state. Evidence
methods in storage are `exact-barcode`, `label-review`, and `cross-source`; API v1 maps
them to the bounded public vocabulary `exact-barcode`, `package-label`, and
`corroborated-sources`, while explicit moderator-reviewed confidence maps to
`moderator-reviewed`. Exact barcode identifies the provider product record but does not
blanket-verify all provider fields, so uncorroborated provider values remain
`imported`. Missing selected provenance stays unknown.

### Relational ingredient evidence

Ingredient normalization is a lossless projection of reported source evidence, not a
replacement for the canonical food snapshot or raw observation. Parent-table triggers
run `sync_product_ingredient_evidence` whenever a shared product, observation, or
submission changes.

| Table | Documented columns |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product_ingredient_statements` | `id`, exactly one owner id, `source_observation_id`, `source_field`, `extraction_method`, `language_code`, `source_key`, `raw_statement`, `source_value`, `content_hash`, `created_at`, `updated_at` |
| `product_ingredient_components` | `id`, `statement_id`, `parent_component_id`, `ingredient_term_id`, `source_path`, `source_order`, `depth`, `source_component_id`, `source_text`, `normalized_text`, `language_code`, `percent_exact`, `percent_estimate`, `percent_min`, `percent_max`, `processing_state`, `vegan_status`, `vegetarian_status`, `source_payload`, `created_at`, `updated_at` |

Notes:

- The projection prefers a provider-reported structured ingredient tree, then a
  provider-reported ordered ingredient list, then the raw ingredient statement.
- Structured trees retain exact parent-child relationships, array order, source paths,
  source component IDs, source wording, language, and the source payload. Reported
  exact, estimated, minimum, and maximum percentages remain separate columns.
- A raw ingredient statement is retained as one explicitly unparsed statement. The
  database does not guess ingredient boundaries from commas, parentheses, or other
  punctuation.
- `source_observation_id` links canonical product evidence to the selected ingredients
  observation when field provenance exists. Observation-owned projections point back
  to that same observation.
- Synchronization never invents percentages, processing states, canonical terms, or
  parent relationships. Missing information remains null.
- Compatibility facts produced by an ingredient-statement rule link both the exact
  `product_ingredient_components` row and the reviewed
  `food_compatibility_match_rules` row that generated the fact.
- These evidence tables are service-role-only. Browser roles receive bounded server
  disclosures rather than unrestricted access to source evidence.

### Precautionary statement evidence

Precautionary-label storage preserves what the package or permitted source actually
reported. Normalized fields support filtering and policy evaluation without replacing
the exact source wording.

| Table | Documented columns |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product_precautionary_statements` | `id`, exactly one owner id, `source_observation_id`, `shared_product_revision_id`, `statement_type`, `statement_text`, `normalized_allergens`, `language_code`, `source_field`, `source_key`, `source_reference`, `label_observed_at`, `source_payload`, `content_hash`, `created_at`, `updated_at` |

Notes:

- `statement_type` is `may_contain`, `shared_equipment`, `shared_facility`, or
  `other_precautionary`. It describes source wording and does not assign a relative
  level of risk.
- `statement_text` retains exact package/source wording. Distinct statements remain
  distinct even when they normalize to the same allergen.
- `normalized_allergens` supports reviewed compatibility matching. Ordinary ingredient
  text and provider hypotheses do not become package precautionary statements.
- Canonical rows link the selected source observation and current product revision when
  available. Observation and submission rows retain their own evidence independently.
- `sync_product_precautionary_statements` rebuilds the projection when source food JSON
  changes. Existing compatibility facts link the exact statement and active immutable
  match rule rather than flattening all cross-contact evidence into one trace list.
- When an exact statement-linked precautionary fact and a flat `label_trace_field` fact
  identify the same owner, tag, and fact type, extraction retains the exact
  statement-linked fact and removes only the duplicate flat fact.
- Authenticated and anonymous reads are limited by RLS to statements attached to active
  shared products. Service-role paths manage observation and submission evidence.

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
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
- New uploads may carry a high-confidence on-device OCR placement proposal through
  private submission evidence. Existing-image backfills update only active front-image
  rows whose placement remains the untouched default, including legacy centered source
  imports that were never approved or adjusted; manual, moderator-approved, and
  previously accepted smart placements remain unchanged. When OCR is ambiguous, an
  untouched legacy import may move only to the version 2 full-image default.
- `placement_method = automatic-ocr` distinguishes a confident automated backfill from
  a suggestion accepted during upload or moderation. It retains algorithm version and
  confidence while leaving `placement_suggestion_accepted_at` null because no person
  accepted that draft individually.
- Community images stay private until a moderator approves them. Approval writes a
  `community-reviewed` image row with `moderator-reviewed` confidence and approval
  metadata.
- API v1 emits an image only when its active row retains a licence name and URL,
  attribution text, and retrieval date and its source registry row supplies the public
  source name and URL. Missing asset attribution omits the image without withholding an
  otherwise eligible product.

| Storage bucket | Visibility | Purpose |
| ----------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `product-submission-evidence` | Private | Product evidence images scoped under the submitting user id |
| `food-image-assets` | Public | Approved/source-backed product image files; private evidence must not move here before moderation approval |

## Compatibility, Allergens, And Dietary Restrictions

| Table                              | Primary Key | Owner Scope                 | Purpose                                                                                            | Key Relationships                                                                   |
| ---------------------------------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `compatibility_tags`               | `id`        | Shared reference            | Canonical compatibility tags for allergens, dietary claims, ingredients, and avoidance concepts    | Referenced by user rules and product facts                                          |
| `ingredient_terms`                 | `id`        | Shared reviewed taxonomy    | Canonical ingredient terms created only through reviewed evidence                                  | Optional source and reviewer                                                        |
| `food_compatibility_policy_ingredient_aliases` | `id` | Versioned reviewed policy | Language-, region-, and source-specific aliases for a canonical ingredient term | Policy version and ingredient term |
| `food_compatibility_policy_ingredient_relationships` | `id` | Versioned reviewed policy | Reviewed parent, derivative, and processing relationships with explicit jurisdiction and inheritance policy | Policy version; child and parent ingredient terms |
| `food_compatibility_policy_conflicts` | Composite | Versioned reviewed policy | DB-owned mapping from a user preference tag to a conflicting product fact and warning severity | Policy version and both compatibility tags |
| `food_compatibility_policy_match_rules` | `id` | Versioned reviewed policy | Reviewed source-field extraction policy that converts exact evidence into normalized compatibility facts | Policy version and compatibility tag |
| `food_compatibility_policy_exemptions` | `id` | Versioned reviewed policy | Jurisdiction-specific labeling, threshold, and processing context that cannot suppress a personal warning | Policy version, reviewed evidence subject, and source reference |
| `food_compatibility_policy_preference_term_mappings` | `id` | Versioned reviewed policy | Exact reviewed mapping from canonical ingredient terminology to an allergen or dietary preference tag | Policy version, ingredient term, and compatibility tag |
| `food_compatibility_policy_versions` | `id`      | Shared policy history       | Immutable, content-hashed bundles containing every activated extraction, conflict, terminology, exemption, and regional-profile rule | Referenced by facts, regional profiles, and feedback |
| `food_allergen_regulatory_profiles` | `id`       | Shared regulatory reference | Reviewed jurisdiction-specific allergen declaration profiles                                       | `policy_version_id → food_compatibility_policy_versions.id`                          |
| `food_allergen_regulatory_profile_tags` | Composite | Shared regulatory reference | Normalized compatibility tags covered by a regional allergen profile                               | Profile and tag foreign keys                                                         |
| `product_compatibility_facts`      | `id`        | Shared product metadata     | Facts extracted from shared products/submissions/observations                                      | `tag_id → compatibility_tags.id`; exactly one product/submission/observation parent |
| `food_compatibility_feedback`      | `id`        | User report/moderation queue | Versioned incorrect- and missing-warning reports with preserved product, preference, policy, revision, and private evidence context | User, policy version, preference tag, optional product/revision, and reviewer foreign keys |
| `food_warning_policy_review_cases` | `id`       | Private warning follow-up    | Confirmed warning reports requiring versioned rule review or source-data correction | One feedback row, optional product/source, opening and resolving actors |
| `food_preference_mapping_requests` | `id` | Shared review queue | Privacy-safe normalized requests for saved preference text that has no single exact reviewed mapping | Optional resolved mapping, term, tag, and reviewer |
| `food_preference_option_catalog`   | `id`        | Shared reference            | App-ready allergen/dietary/ingredient options built from product compatibility and ingredient data | Optional `tag_id → compatibility_tags.id`                                           |
| `food_preference_api_observations` | `id`        | Shared reference/provenance | Raw observed allergen/dietary/ingredient metadata from external APIs                               | No direct user ownership                                                            |

### `compatibility_tags`

| Table | Documented columns |
| -------------------- | ------------------------------------------------------------- |
| `compatibility_tags` | `id`, `slug`, `label`, `category`, `created_at`, `updated_at` |

Notes:

- `category` is `allergen`, `dietary`, `ingredient`, or `avoidance`.

### Reviewed Ingredient Taxonomy And Terminology Policy

| Table | Documented columns |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingredient_terms` | `id`, `canonical_key`, `display_name`, `default_language_code`, `review_status`, `source_key`, `source_reference`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at` |
| `food_compatibility_policy_ingredient_aliases` | `id`, `policy_version_id`, `ingredient_term_id`, `alias`, `normalized_alias`, `language_code`, `alias_type`, `review_status`, `source_key`, `source_reference`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at` |
| `food_compatibility_policy_ingredient_relationships` | `id`, `policy_version_id`, `child_term_id`, `parent_term_id`, `relationship_type`, `processing_state`, `jurisdiction_code`, `conflict_inheritance`, `review_status`, `source_key`, `source_reference`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at` |
| `food_compatibility_policy_preference_term_mappings` | `id`, `policy_version_id`, `ingredient_term_id`, `preference_tag_id`, `preference_rule_type`, `source_reference`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at` |

Notes:

- Product ingestion does not automatically create taxonomy terms or aliases from
  provider text. Canonical terms and aliases require retained source evidence and a
  reviewed state.
- Relationship types are `is-a`, `derived-from`, and `processed-from`.
- A derivative or processed ingredient does not inherit every parent conflict.
  `conflict_inheritance` defaults to `none`; reviewed inheritance must be explicit and
  may be scoped by jurisdiction and processing state.
- Review metadata and source references make taxonomy changes auditable rather than
  inferred from application wording.
- The compatibility terminology rows belong to one policy version. The active-only
  `ingredient_term_aliases` and `ingredient_term_relationships` views preserve the
  stable runtime read names without exposing draft or retired rules.
- A custom saved preference becomes eligible for automated checking only when its
  normalized wording has one exact reviewed canonical term or reviewed alias and that
  term has an active version-bound preference mapping. No fuzzy match or hard-coded
  synonym is accepted.
- Policy version 2 activates reviewed English, French, and Spanish ingredient and
  allergen-declaration aliases. Accent and provider language prefixes are normalized,
  but the original source wording and language remain evidence. An explicitly reported
  unsupported language remains incomplete rather than being treated as checked.

### Version-Bound Extraction And Conflict Policy

| Table | Documented columns |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_compatibility_policy_conflicts` | `policy_version_id`, `preference_tag_id`, `fact_tag_id`, `severity`, `warning_code`, `priority`, `created_at`, `updated_at` |
| `food_compatibility_policy_match_rules` | `id`, `policy_version_id`, `tag_id`, `source_key`, `field_name`, `match_pattern`, `exclude_pattern`, `fact_type`, `source_type`, `confidence`, `priority`, `enabled`, `created_at`, `updated_at` |
| `food_compatibility_policy_exemptions` | `id`, `policy_version_id`, `jurisdiction_code`, `ingredient_term_id`, `parent_term_id`, `fact_tag_id`, `processing_state`, `exemption_type`, `threshold_value`, `threshold_unit`, `product_context`, `warning_behavior`, `source_reference`, `reviewed_at`, `created_at`, `updated_at` |

Notes:

- The active bundle is the authority for extracting structured facts and matching
  active user preferences to those facts. Activated and retired rows are immutable.
- `compatibility_rule_conflicts` and `food_compatibility_match_rules` are active-only
  runtime views over the version-bound physical tables. Server loaders additionally
  constrain physical-table reads to the selected active version.
- App utilities must not recreate allergen or dietary vocabularies with name/category
  guesses.
- Conflict and extraction rows remain server-only policy. They are
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
- Rules are ordered by `priority` and loaded through the server-only food-safety policy
  cache for exactly one active version.
- Packaged-product rules may inspect source-provided allergen, trace, ingredient, and
  ingredient-analysis fields. They do not inspect a packaged name, brand, category, or
  description.
- An authoritative generic food may use its typed taxonomy as intrinsic food evidence.
  That rule path remains unavailable to packaged and private custom foods.
- Positive dietary claims are accepted only when source labels normalize to an enabled
  dietary compatibility tag. Marketing labels do not become dietary evidence.
- Exemptions retain reviewed jurisdiction context only. Their enforced
  `warning_behavior` is `context-only`, so an exemption cannot suppress a conflict for
  a preference the user explicitly selected.
- Exemption snapshots preserve the derivative or parent term, processing state,
  threshold amount/unit, product context, jurisdiction, and reviewed source. Current EU
  and Australia/New Zealand rows record reviewed labeling context such as fully refined
  soybean oil and threshold-qualified wheat glucose syrup without converting those
  labeling rules into personal safety claims.

### `food_compatibility_policy_versions`

| Table | Documented columns |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_compatibility_policy_versions` | `id`, `version_number`, `status`, `change_summary`, `match_rule_snapshot`, `conflict_rule_snapshot`, `alias_snapshot`, `relationship_snapshot`, `exemption_snapshot`, `regional_profile_snapshot`, `preference_mapping_snapshot`, `bundle_content_hash`, `source_references`, `effective_at`, `reviewed_at`, `created_at`, `updated_at` |

Notes:

- A policy begins as `draft`; exactly one version is `active`, while prior activated
  versions remain `retired` and available for rollback. Product facts and feedback use
  the active version through `active_food_compatibility_policy_version_id()`.
- Every extraction, conflict, terminology, preference mapping, exemption,
  regional-profile, and profile-tag row is cloned into a draft and bound to that
  version before review.
- Activation snapshots the complete bundle, records its deterministic SHA-256 content
  hash, retires the prior version, activates the target, re-extracts all product,
  observation, and submission facts, rebuilds the option catalog, and re-resolves every
  saved user preference in one transaction. The same function can reactivate a retired
  bundle for rollback.
- Activated versions and child rows cannot be edited in place. Updating policy requires
  a new draft and activation rather than rewriting history.
- `source_references` records the official regulatory material reviewed for the policy.

### Regional allergen profiles

| Table | Documented columns |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_allergen_regulatory_profiles` | `id`, `policy_version_id`, `profile_key`, `region_code`, `display_name`, `authority`, `policy_reference`, `source_url`, `reviewed_at`, `active`, `created_at`, `updated_at` |
| `food_allergen_regulatory_profile_tags` | `profile_id`, `tag_id`, `classification`, `source_label`, `created_at` |

Notes:

- The initial policy records reviewed profiles for the United States, Canada, United
  Kingdom, European Union, and Australia/New Zealand.
- Regional profiles preserve each authority's source label and classification while
  mapping it to a normalized compatibility tag.
- Profiles add jurisdiction context and policy coverage. They never suppress a warning
  for a preference the user explicitly selected.
- A signed-in account may store one profile `region_code` in
  `user_food_preferences`. Evaluation resolves that stable code against the same active
  policy version used for extraction and conflict rules, records whether the profile was
  applied, and identifies selected allergen settings that the regional profile does or
  does not cover. Unknown or retired codes remain explicitly unsupported.
- Authenticated reads are limited by RLS to active profiles belonging to the active
  policy version.

### `product_compatibility_facts`

| Table | Documented columns |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product_compatibility_facts` | `id`, `shared_product_id`, `shared_product_observation_id`, `shared_product_submission_id`, `tag_id`, `policy_version_id`, `ingredient_component_id`, `precautionary_statement_id`, `match_rule_id`, `fact_type`, `source_type`, `source_text`, `confidence`, `created_at`, `updated_at` |

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
- Ingredient-derived facts also record the exact normalized ingredient component and
  either its extraction rule or its active reviewed terminology mapping through the
  component term and immutable policy bundle. This preserves the source wording, tree
  position, selected observation, and policy decision used for the warning without
  rerunning mutable client logic.
- Precautionary facts record the exact normalized statement and match rule. Repeated
  allergens de-duplicate within one statement without discarding distinct package
  statements, wording, statement types, observations, or revisions.

### `food_compatibility_feedback`

| Table | Documented columns |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_compatibility_feedback` | `id`, `reported_by`, `policy_version_id`, `feedback_type`, `shared_product_id`, `shared_product_revision_id`, `source_key`, `source_id`, `barcode`, `food_description`, `warning_id`, `issue_code`, `issue_params`, `fact_snapshot`, `preference_type`, `preference_value`, `preference_tag_id`, `observed_label_date`, `evidence_path`, `evidence_sha256`, `report_reason`, `report_details`, `report_fingerprint`, `status`, `resolution_action`, `follow_up_status`, `reviewed_by`, `reviewed_at`, `review_note`, `created_at`, `updated_at` |

Notes:

- A signed-in user can report an existing warning as an incorrect match, outdated
  source record, wrong evidence type, or another evidence-specific problem. They can
  also report a missing warning against one exact currently resolved food preference.
- The report stores the warning parameters and exact matching fact snapshot from the
  active policy version. It does not rely on mutable client wording.
- A unique pending fingerprint makes repeated submissions idempotent.
- Missing-warning reports retain the catalog revision current at submission, an
  optional package-observation date, and an optional normalized private label image.
  Evidence paths remain in the private product-evidence bucket and are exposed only as
  short-lived signed URLs inside privileged moderation reads.
- `review_food_compatibility_feedback` is the AAL2, permission-checked decision
  boundary. It records the report outcome and creates required policy, source, or
  product-correction follow-up atomically. Dismissed reports cannot create follow-up
  work.

### `food_warning_policy_review_cases`

| Table | Documented columns |
| --- | --- |
| `food_warning_policy_review_cases` | `id`, `feedback_id`, `case_type`, `responsible_group`, `shared_product_id`, `source_key`, `status`, `opened_by`, `resolved_by`, `resolution_note`, `created_at`, `resolved_at`, `updated_at` |

Rule and source cases remain private operational work. They retain the originating
feedback and explicit responsible group instead of flattening a confirmed report into
an ambiguous resolved status.

### `catalog_correction_origins`

| Table | Documented columns |
| --- | --- |
| `catalog_correction_origins` | `id`, `shared_product_id`, `base_revision_id`, `origin_type`, `provider_change_review_id`, `shared_product_conflict_id`, `food_compatibility_feedback_id`, `affected_field_paths`, `prefilled_food`, `submission_id`, `status`, `resolved_revision_id`, `resolution_note`, `created_at`, `resolved_at`, `updated_at` |

Each row references exactly one provider change, product conflict, or warning report.
The database validates product and revision identity before linking a real
`catalog_correction` submission. Matching uses the correction's actual changed fields;
the prefilled product snapshot is only a safe starting point and never counts as proof
of a change. Approval requires and records the immutable revision that resolved the
origin, while rejection returns the origin to the waiting state.
- Users may read only their own reports. Inserts and moderation updates use authenticated
  server boundaries; the service role owns privileged writes.
- Moderators resolve reports as `confirmed` or `dismissed` and record the next action as
  rule review, source correction, product correction, or duplicate.
- Confirming a report records an investigation decision only. Product corrections and
  policy changes continue through their existing revisioned workflows and compatibility
  refresh triggers.

### `food_compatibility_policy_coverage`

Service-only view reporting whether each allergen or dietary tag is selectable, how
many conflict mappings it owns, and how many enabled evidence rules are reachable
either directly or through those conflict mappings. It is revoked from browser roles
and is intended for deployment checks and policy audits.

### `food_preference_option_catalog`

| Table | Documented columns |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `food_preference_option_catalog` | `id`, `category`, `label`, `normalized_value`, `source_type`, `tag_id`, `source_values`, `usage_count`, `created_at`, `updated_at` |

Notes:

- Built by `rebuild_food_preference_option_catalog`.
- UI should query this table for allergen and dietary dropdown options.
- `source_type` is `compatibility_tag`, `compatibility_fact`, `api_observation`, or
  `ingredient_list`. Canonical tags keep required selectable safety preferences
  available before any product happens to report them.

### Saved Preference Resolution And Review Requests

| Table | Documented columns |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_compatibility_rules` | `id`, `user_id`, `tag_id`, `rule_type`, `severity`, `raw_value`, `normalized_value`, `active`, `resolution_status`, `resolution_method`, `resolution_policy_version_id`, `resolution_language_code`, `ingredient_term_id`, `ingredient_alias_id`, `preference_term_mapping_id`, `created_at`, `updated_at` |
| `food_preference_mapping_requests` | `id`, `preference_rule_type`, `normalized_value`, `language_code`, `status`, `occurrence_count`, `resolved_mapping_id`, `resolved_ingredient_term_id`, `resolved_preference_tag_id`, `reviewed_by`, `reviewed_at`, `review_note`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- `user_food_preferences` retains the user's exact saved wording. The server-owned
  `user_compatibility_rules` projection records whether each value is resolved by a
  direct canonical tag, reviewed ingredient term, reviewed alias, or remains
  unresolved under the active policy version.
- Unresolved values are saved but do not participate in warning evaluation. They place
  only their normalized value, rule type, and language in the shared review queue; user
  identity and raw account wording are not copied there.
- Mapping review happens on a draft policy. Activating that policy re-resolves existing
  preferences without rewriting user-owned values.
- Authenticated users may read only their own resolution rows. Mapping, queue, and
  resolution writes remain service-only.

### `food_preference_api_observations`

| Table | Documented columns |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
| `food_symbol_definitions`           | `key`                     | Shared presentation reference | Reusable emoji fallbacks with reviewed family membership for foods without an image                    | Referenced by categories and scoped symbol rules       |
| `food_symbol_category_rules`        | `id`                      | Shared presentation policy | Ordered, scoped category, name-refinement, prepared-form, and uncategorized-name patterns              | Symbol definition and product-data source              |
| `app_delight_messages`              | `key`                     | Shared presentation reference | Optional broad-audience secondary copy selected by reviewed semantic triggers                          | Loaded through the application reference catalog       |

### `custom_food_category_options`

| Table | Documented columns |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom_food_category_options` | `id`, `label`, `normalized_value`, `sources`, `source_count`, `observation_count`, `verification_status`, `symbol_key`, `enabled`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- UI category dropdowns should sort by `label`.
- Seeded by `scripts/seeds/catalog/seed_custom_food_categories.mjs`.
- The dropdown renders these app-ready options, not raw source payload strings.
- Trusted server-side catalog hydration has read access to these labels; authenticated
  browser access remains governed independently by RLS.
- `shared_product_submissions`, `shared_products`, and `shared_product_revisions`
  reference this table through `category_option_id`.

### Food-symbol fallbacks

| Table | Documented columns |
| --- | --- |
| `food_symbol_definitions` | `key`, `display_name`, `emoji`, `family_key`, `sort_order`, `enabled`, `created_at`, `updated_at` |
| `food_symbol_category_rules` | `id`, `symbol_key`, `match_pattern`, `match_scopes`, `priority`, `enabled`, `source_key`, `source_reference`, `created_at`, `updated_at` |

Notes:

- One database-owned catalog supplies fallback media to Ingredients, search, Mix, and
  Saved. Components do not maintain their own keyword or emoji lists.
- Every symbol belongs to a reviewed `family_key`. A trusted canonical category selects
  that family first, and the food name can choose a more specific child symbol only
  within it. For example, `tuna steak` can resolve to tuna in a seafood category but
  cannot jump to beef because its name contains `steak`.
- `match_scopes` separates prepared-form overrides, broad category classifiers,
  within-family name refinements, and bounded name-only fallbacks. Name-only fallback
  runs only when no reviewed category matches; unknown foods retain the generic bowl.
- The curated catalog contains at least 150 enabled choices spanning alcoholic and
  nonalcoholic beverages, soups, produce, meat species and preparations, seafood,
  dairy, grains, pantry staples, desserts, and prepared-food forms. It remains a
  reusable taxonomy rather than attempting to assign a unique symbol to every product.
- Prepared forms take precedence when that is what users recognize at a glance: a
  turkey sandwich uses the sandwich symbol, beer bread uses bread, chocolate milk uses
  milk, and chicken curry uses curry. Inside a reviewed family, specific raw foods still
  beat broad groups, so salmon, duck, mango, spinach, and potatoes do not collapse into
  generic seafood, poultry, fruit, greens, or vegetables.
- Whole-word boundaries protect short mappings from accidental substring matches. For
  example, the intentionally playful feces-synonym fallback never matches `shiitake`
  or `cacao`.
- The compatibility name resolver remains available for uncategorized records, while
  the category resolver and full-food resolver own new durable writes. Category-sync
  triggers use the category resolver. The category-led migration also refreshes existing
  custom foods, catalog submissions, canonical products, revisions, and user-list
  snapshots so older items receive the same rules.

### Application delight copy

| Table | Documented columns |
| --- | --- |
| `app_delight_messages` | `key`, `context_key`, `trigger_key`, `match_key`, `message`, `minimum_value`, `maximum_value`, `priority`, `tone`, `enabled`, `created_at`, `updated_at` |

Notes:

- The catalog contains optional, concise food, workout, and widely recognizable gamer
  humor. Niche developer references are deliberately excluded from the initial set.
- Application code supplies reviewed context, trigger, semantic match, and optional
  numeric values. The lowest-priority matching enabled row supplies at most one line.
- `tone` is `standard` or the retained internal key `cheeky`. The user-facing name for
  the latter is `Playful messages`. These rows are limited by database constraint to
  eligible food-add, goal-success, and recipe-save triggers and are excluded when the
  account turns playful messages off.
- Delight copy is secondary presentation only. It never replaces or appears inside
  allergen, recall, alcohol-safety, medical, authentication, validation, warning, or
  failure instructions.
- Authenticated users may read enabled rows. Writes remain service-only so ordinary
  clients cannot change copy or trigger behavior.

### `custom_food_category_observations`

| Table | Documented columns |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom_food_category_observations` | `id`, `category_id`, `label`, `normalized_value`, `source`, `query`, `source_field`, `source_value`, `source_reference`, `source_payload`, `observation_count`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- Source values come from `fdc-search`, `fdc-branded-detail`, and `open-food-facts`.
- Observations preserve raw API source category data, including Open Food Facts
  categories, category tags, category hierarchy, and food groups when available.

### `custom_food_category_mappings`

| Table | Documented columns |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom_food_category_mappings` | `source_normalized_value`, `source_value`, `source_values`, `source_fields`, `sources`, `category_option_id`, `category_option_label`, `confidence`, `match_reason`, `source_count`, `observation_count`, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at` |

Notes:

- Barcode/manual-entry autofill should use this table to pick the visible app category.
- Raw API category values remain stored in `custom_food_category_observations` and on
  product payloads for proof and moderation.
- Seeded by `scripts/seeds/catalog/seed_custom_food_categories.mjs`; use
  `npm run seed:food-categories:deep` for a broader API sample.
- Use `npm run seed:food-categories:rebuild` when observations already exist and only
  mappings need to be refreshed.
- Do not map category autofill by taking the first raw API category value.
- `resolve_custom_food_category_option(text[])` performs reusable DB-side category
  resolution using enabled options and observed mappings.
- `npm run backfill:shared-product-categories` checks USDA FoodData Central and Open
  Food Facts, records category provenance, and repairs legacy catalog rows.

## Catalog Monitoring And Food Safety

The catalog monitor is a bounded, server-only maintenance pipeline. Supabase Cron asks
one Edge Function to process due work; the function claims small database-owned batches,
records immutable evidence, and schedules the next attempt. The monitor is disabled by
default so applying the migration cannot make outbound requests before its function and
secrets are configured and verified.

| Table | Primary key | Purpose |
| --- | --- | --- |
| `catalog_monitor_settings` | Singleton boolean `id` | Enables the worker and bounds product batches, recall pages, retry claims, and recall intervals |
| `catalog_monitor_runs` | `id` | Records each cron, manual, or test run with bounded result counts and safe error codes |
| `catalog_revalidation_queue` | `id` | Schedules one product/provider check with priority, reason, interval, claim token, attempts, and result |
| `catalog_provider_product_snapshots` | `id` | Immutable normalized provider snapshots linked to the exact stored source observation |
| `catalog_provider_change_reviews` | `id` | Holds material provider changes without changing the canonical product |
| `catalog_safety_alert_ingestion_cursors` | `provider_key` | Schedules and retries each official recall source independently |
| `official_food_safety_alerts` | `id` | Stores the current normalized official recall or public-health-alert record |
| `official_food_safety_alert_revisions` | `id` | Preserves immutable raw and normalized evidence for every changed alert payload |
| `official_food_safety_alert_identifiers` | Composite | Preserves exact GTIN, UPC, lot, use-by, and package identifiers stated by the source |
| `official_food_safety_alert_matches` | `id` | Links an alert to a canonical product through exact, probable, or reviewed evidence |
| `product_safety_alert_notifications` | `id` | Records per-user in-app, email, or push delivery state without exposing another user's alerts |

Important behavior:

- `20260814233000_fix_catalog_monitor_summary_ordering.sql` corrects the projected
  recent-run ordering used by the moderator summary without changing its response
  contract or any stored data.
- Active catalog products receive Open Food Facts checks and receive USDA checks only
  when an exact USDA source identifier is known. Recent Fridge and Shopping List use
  raises priority; inactive products pause instead of consuming provider traffic.
- Open Food Facts metadata is checked before a full record is downloaded. USDA detail
  checks use the known FDC id. Normalized SHA-256 hashes make unchanged responses cheap
  and deterministic.
- A new provider snapshot creates a source observation. A material change creates a
  pending review; it never overwrites `shared_products`. Accepting that review requires
  the id of a real approved `shared_product_revisions` row.
- Official alert revisions and provider snapshots are immutable. Current alert rows may
  advance as an official source corrects or closes a record without deleting history.
- An exact normalized GTIN match becomes visible immediately. A strong identity match
  without an exact identifier remains `needs_review`; title-only similarity never
  creates a match. Package, lot, and use-by evidence can require the user to check the
  current package rather than implying every package is affected.
- Closing an official alert supersedes active and pending matches. Exact or confirmed
  active matches enqueue one notification per affected user and remain visible on the
  user's current catalog-backed food.
- Direct browser reads of monitor, raw alert, identifier, match, revision, and snapshot
  tables are denied. Users may read only their own notification rows and may mark one
  as read through the owner-scoped function. Worker writes remain service-role-only;
  moderator review functions require AAL2 and a current database permission.

The hourly cron call requires Vault secrets named `blendcalc_project_url` and
`blendcalc_catalog_monitor_cron_secret`. The Edge Function separately requires
`CATALOG_MONITOR_CRON_SECRET`, `USDA_API_KEY`, and the platform-provided Supabase URL and
service key; `OPENFDA_API_KEY` is optional but recommended for regular use. Enable
`catalog_monitor_settings.enabled` only after the deployed function and matching secret
have passed an authenticated dry run.

## Moderation And Access Control

| Table                              | Primary Key  | Owner Scope                | Purpose                                                   | Key Relationships                                  |
| ---------------------------------- | ------------ | -------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `app_role_assignments`             | `user_id`    | One row per elevated user  | Grants `moderator`, `admin`, or `developer` role          | `user_id → auth.users.id`, optional `granted_by`   |
| `app_role_permissions`             | Composite    | Global role policy         | Maps application roles to moderation capabilities        | `role + permission`                                |
| `account_moderation`               | `user_id`    | One row per moderated user | Tracks active/suspended/banned state                      | `user_id → auth.users.id`, optional `moderated_by` |
| `moderation_actions`               | `id`         | Audit log                  | Records moderation actions and reason codes               | `target_user_id`, optional `actor_user_id`         |
| `moderation_email_deliveries`      | `id`         | Audit log                  | Tracks moderation email delivery status                   | `moderation_action_id → moderation_actions.id`     |
| `blocked_signup_emails`            | `email_hash` | Blocklist                  | Prevents signup by hashed email                           | Optional source/blocking users                     |
| `profile_image_policy_acceptances` | `id`         | Many rows per auth user    | Records profile image policy acceptance per avatar upload | `user_id → auth.users.id`                          |
| `profile_image_reports`            | `id`         | Private moderation history | Tracks reports and review outcomes for exact profile images | Target profile and reporting/reviewing auth users |

Notes:

- Moderation/admin writes are intentionally not available to normal authenticated
  clients.
- `profile_image_reports` is forced-RLS and service-role-only. Each row retains the
  exact current private avatar path, bounded reason/details, reporter, lifecycle, and
  review evidence. Ordinary uploads create no row. Replacing an image supersedes its
  pending reports; a moderator decision dismisses or removes all pending reports for
  the exact reviewed path without affecting a replacement image.
- `get_pending_profile_image_review_count()` returns the number of distinct exact images
  requiring action rather than loading private report rows or counting duplicate reports
  as separate moderator tasks. Only the service role can execute it.
- `app_role_assignments` is the authority for application roles. The `app_role` enum
  contains `user`, `moderator`, `admin`, and `developer`, while assignments store only
  elevated roles. `app_role_permissions` maps those roles to database-owned
  capabilities. Developer permissions are explicit rows matching the current admin
  capability set; they are not inferred through a role hierarchy.
- Catalog review and catalog data operations are separate capabilities. Moderators,
  admins, and developers receive `moderation.catalog.review`. Only admins and developers
  receive `data_operations.catalog_health.read`,
  `data_operations.catalog_health.repair`, and
  `data_operations.nutrient_mappings.manage`. All protected operations also require
  AAL2. `moderation.data_health.read` remains temporarily defined for compatibility but
  is not used by the focused application routes.
- `custom_access_token_hook` copies the current assignment into a newly issued JWT as
  `app_role`, defaults normal or malformed subjects to `user`, replaces stale or
  caller-supplied claims, and is executable only by `supabase_auth_admin`.
- JWT role claims are not the sole authorization boundary. Privileged server routes and
  security-definer functions independently query `app_role_assignments` so role
  revocation does not wait for token expiry.
- The server-only `service_role` has explicit least-privilege table grants for the
  moderation dashboard and reviewed catalog workflows. Those grants cover only the
  reads and writes performed by trusted server modules; they do not change browser
  access or bypass the route's independent moderator/admin/developer role check. Catalog intake
  includes `insert` on `shared_product_submissions` because the trusted server creates
  pending submissions before moderator review; ordinary authenticated clients still
  cannot insert, update, or delete those rows directly.
- `get_catalog_data_operations_health(p_days, p_issue_limit)` is an authenticated,
  MFA-verified admin/developer security-definer aggregate. It clamps the
  metric window to
  1–90 days and each issue queue to 1–50 rows. It returns catalog/publication counts,
  source metrics and safe latest-evaluation summaries, dataset import/licence/checksum
  state, active compatibility-policy coverage, and bounded conflict, publication,
  mapping, and revision gaps. It deliberately excludes raw provider payloads, private
  evidence, user identities, secrets, source-evaluation `details`, dataset `metadata`,
  and dataset download URLs.
- `get_catalog_data_operations_monitor_summary(p_limit)` returns bounded monitor
  configuration, queue counts, and recent runs only to an AAL2 admin/developer with
  explicit data-operations permission.
- `get_catalog_review_work_summary(p_limit)` returns only material conflicts, provider
  changes, and possible recall matches to an AAL2 catalog reviewer.
- `get_catalog_product_readiness_passport(p_shared_product_id)` returns one bounded
  product contract to an AAL2 catalog reviewer or data-operations reader. It separates
  shared-catalog and API v1 status, includes the current revision and source-evidence
  counts, and maps open normalized issues to ownership and supported action metadata.
  It excludes raw provider payloads, private evidence paths, and contributor identity.
- `private.build_moderator_data_health_summary(p_days, p_issue_limit)` and
  `private.build_catalog_monitor_summary(p_limit)` assemble bounded payloads without
  granting access. Direct execution is revoked from client and service roles. Every
  public wrapper independently enforces its exact role permission and AAL2 before
  calling a private builder.
- `get_moderator_data_health` and `get_catalog_monitor_moderation_summary` remain
  temporary compatibility wrappers for the previous interface. New application code
  does not call them.
- `blocked_signup_emails` stores hashes, not raw email addresses.
- `reject_blocked_signup` is the auth hook function for blocking signups.
- `set_app_user_role` is the only service-role write path for role assignments; it
  updates the assignment and appends the moderation ledger in one transaction.
- Application requests fail closed when account-moderation state cannot be verified;
  logout remains available so a user is never trapped in a session.

## Operational Analytics

### `app_interaction_daily_metrics`

Stores private, daily aggregate interaction counts synchronized from Vercel Web
Analytics. It is an operational measurement table, not a user activity log.

| Table | Documented columns |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_interaction_daily_metrics` | `metric_date`, `metric_key`, `dimension_key`, `dimension_value`, `metric_source`, `environment`, `event_count`, `visitor_count`, `source_query_version`, `created_at`, `synced_at` |

Notes:

- Initial metric keys are `page_view`, `auth_login_success`,
  `auth_logout_success`, and `page_reload`. Future interactions must be deliberately
  registered rather than copied from arbitrary event payloads.
- `page_view` is stored both as a daily total and, where Vercel provides a framework
  route pattern, by `dimension_key = route`. Exact request paths, query strings, and
  URL hashes are not persisted.
- Successful Vercel responses that omit an event for a synchronized day produce an
  explicit aggregate zero. Missing or invalid provider values are rejected rather than
  guessed.
- The table never stores user ids, email addresses, IP addresses, cookies, raw URLs,
  event properties, or Vercel's temporary visitor hashes.
- Browser roles cannot read or write this table. The service-role-only
  `replace_app_interaction_daily_metrics` function atomically replaces at most 32 days
  and 500 aggregate rows per run.

## Request Security And Least Privilege

### `request_rate_limits`

Private fixed-window counters protect bounded application API scopes from abusive or
accidental request volume. The table is not exposed through the browser Data API.

| Table | Documented columns |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `request_rate_limits` | `scope`, `subject_hash`, `window_started_at`, `expires_at`, `request_count`, `updated_at` |

Notes:

- `(scope, subject_hash)` is the primary key, so concurrent requests update one atomic
  quota row rather than creating duplicate counters.
- Subjects use a keyed SHA-256 HMAC derived inside the server boundary from the
  authenticated user identity or trusted client address. Raw user ids and network
  addresses are not stored, and stored hashes cannot be reproduced without the
  server-only key.
- `consume_request_rate_limit` validates all quota configuration, resets expired
  windows atomically, opportunistically prunes counters expired for more than one day,
  and is executable only by the service role.
- All application JSON and form endpoints parse through bounded request readers.
  Declared and streamed bodies that exceed the route limit are rejected before domain
  logic runs; compressed request bodies are rejected to prevent decompression abuse.
- Authentication, password, Profile, and Moderation form actions use persistent quotas
  in addition to the API, external lookup, upload, and catalog-submission scopes.
- Current and future Data API roles do not receive `TRUNCATE`, `REFERENCES`, `TRIGGER`,
  or `MAINTAIN` table privileges. Public function execution is revoked by default and
  each browser-callable RPC must be granted intentionally.
- Reference rebuild and internal synchronization functions, including
  `sync_nutrient_manual_entry_fields` and
  `sync_user_compatibility_rules(uuid, text[], text[])`, are service-only.

## Nutrition Completeness And National Datasets

These tables keep completeness policy and imported generic-food data separate from
packaged barcode products. Imports are source-versioned, license-gated, and searchable
without calling the source again.

| Table                                      | Primary Key                                         | Purpose                                                       | Important Columns / Rules                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nutrition_completeness_profiles`          | `key`                                               | Defines what complete nutrition means for a food scope/region | `food_scope` (`generic`, `manual`, or `packaged`), `region_code`, DB-owned labels, source reference, one enabled default per scope/region |
| `nutrition_completeness_profile_nutrients` | `profile_key, nutrient_id`                          | Orders required and recommended nutrients for one profile     | `requirement_level`, `display_order`, `reason`; nutrient FK prevents invented definitions                                                 |
| `blendcalc_api_publication_profiles`       | `key`                                               | Versions the hard gates for one API major and resource scope   | Linked nutrition profile, required/recommended fields, accepted nutrient states, conflict severities, verification age, reviewed policy source, and one enabled default per scope |
| `product_regulatory_disclosure_profiles`  | `key`                                               | Defines reviewed package-label contexts without product-name inference | Disclosure kind, nutrition evaluation mode, optional completeness profile, region, authority, ABV requirement, review gate, source reference, and enabled/default state |
| `generic_food_datasets`                    | `key`                                               | Records each national release and its legal/import state      | Source/license URLs, attribution, file SHA-256, review status, import/active gates, imported row counts                                   |
| `generic_food_records`                     | `dataset_key, source_food_key`                      | Stores one source-owned generic food/preparation              | Raw description, group, preparation, searchable text, source reference and dates                                                          |
| `generic_food_source_identifiers`          | Dataset food plus source, type, and value           | Stores exact source-declared cross-dataset identifiers        | Supports exact joins such as CNF `USDA_NDB_Code` to USDA NDB without fuzzy name matching; includes source field and verification method   |
| `generic_food_nutrients`                   | `dataset_key, source_food_key, source_nutrient_key` | Stores source nutrient amounts and canonical mappings         | Explicit basis, amount, unit, standard error, source code, mapping status, and `value_status` (`measured`, `trace`, `present-unquantified`, `missing`) |
| `generic_food_measures`                    | `dataset_key, source_food_key, source_measure_key`  | Stores source household measures                              | Amount/unit, gram weight, source label and metadata; never inferred from names                                                            |
| `generic_food_dataset_reference_rows`      | `dataset_key, reference_type, source_key`           | Stores source dictionaries used to interpret imports          | Reference labels and metadata remain tied to the dataset release                                                                          |

Runtime generic search reads only active, import-enabled datasets through an indexed
prefix-search RPC. A result must have at least one canonical measured nutrient, so
identity-only shells cannot consume result slots. Results retain alternate descriptions,
scientific names, preparation metadata, and exact source-declared identifiers. Those
identifiers may connect the same source food across datasets, but similar names are never
treated as an identity match.

The public `search_generic_food_records` wrapper returns every source nutrient fact for
each bounded result, including trace, present-but-unquantified, missing, and unmapped
rows. The application splits canonical measured values into `foodNutrients` and keeps
all source rows in the review-only `nutrientSourceReview` contract. The prior ranked
search implementation is private so browser roles cannot bypass the wrapper or query
raw generic tables directly.

The current provider capability and intake-state inventory belongs in
[`api-structures/source-data-inventory.md`](api-structures/source-data-inventory.md);
source-specific legal and activation decisions belong in
[`data-source-licensing.md`](data-source-licensing.md).

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
| `product_data_sources.ucum-standard`       | Reviewed unit-standard identity                  | Active bounded UCUM codes/conversions with official licence metadata; no network request                       |
| `product_data_sources.ucum-nlm`            | Historical standards-service identity            | Disabled; prior service references remain only as immutable provenance                                        |
| `product_data_sources.nutrition-label-ocr` | Label-reading helper identity                    | Nutrient aliases/conversions are DB-backed; values require explicit user confirmation and remain `user-label` |
| `product_data_sources.gs1-digital-link`    | GS1 product QR identifier standard               | GTIN is extracted locally; arbitrary scanned URLs are never fetched; lot/serial/query data is not persisted   |

OCR aliases live in `nutrient_source_mappings` and safe unit conversions live in
`nutrient_unit_conversions`, so label parsing does not own a second nutrient catalog.
GS1 links identify a product but do not claim ownership of its nutrition, image,
category, or serving fields.

## RPC / Database Functions

| Function                                       | Purpose                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `set_updated_at`                               | Shared updated-at trigger helper                                                                                                               |
| `default_profile_display_name`                 | Builds a safe default display/profile name                                                                                                     |
| `set_default_profile_display_name`             | Trigger helper that fills missing profile display names                                                                                        |
| `create_profile_for_new_auth_user`             | Auth trigger helper that creates a profile row for new users                                                                                   |
| `replace_food_nutrients`                       | Replaces normalized nutrient rows for exactly one food parent                                                                                  |
| `apply_food_nutrient_uncertainty`              | Trigger helper that retains exact source status, standard error, mapping, and derivation metadata without changing the accepted amount          |
| `replace_food_servings`                        | Replaces normalized serving rows for exactly one food parent; parent triggers call it after relevant writes                                    |
| `normalize_food_nutrient_lineage`              | Links normalized nutrients to exact selected observations and leaves unsupported provider-derived lineage unknown                              |
| `normalize_food_serving_lineage`               | Links normalized servings to exact selected observations and leaves unsupported provider-derived lineage unknown                              |
| `food_list_item_identity_key`                  | Produces the canonical barcode-or-FDC identity used to prevent cross-list duplicates                                                           |
| `place_user_food_list_item`                    | Atomically adds an ingredient, reports a required cross-list move, or completes a confirmed move                                               |
| `move_user_food_list_items`                    | Atomically moves a checked ingredient set between Fridge and Shopping List, rejecting stale or partial sets                                    |
| `save_mix_preferences`                                 | Saves only the versioned active Mix draft; normalized goals use their dedicated functions                                                                                                              |
| `save_mix_goal_configuration`                          | Atomically validates and replaces one user's normalized active goals and copied preset provenance                                                                                                      |
| `apply_mix_goal_template`                              | Copies one enabled current reviewed system-preset version into the user's active goals, optionally retaining extra goals                                                                               |
| `save_user_mix_goal_template`                          | Creates or updates one private reusable user preset after validating every goal rule                                                                                                                   |
| `apply_user_mix_goal_template`                         | Copies one owner-scoped personal preset into active goals, optionally retaining extra goals                                                                                                            |
| `delete_user_mix_goal_template`                        | Deletes one owner-scoped personal preset without deleting the already copied active goal values                                                                                                        |
| `publish_shared_product_submission`            | Publishes an approved submission into the shared catalog and revisions/evidence tables                                                         |
| `compatibility_normalize_text`                 | Normalizes compatibility labels/values for matching                                                                                            |
| `active_food_compatibility_policy_version_id`  | Returns the sole active compatibility policy version used by active-only policy views and new facts                                            |
| `create_food_compatibility_policy_draft`       | Creates a reviewed draft shell and clones the complete active extraction, conflict, terminology, exemption, and regional-profile bundle        |
| `activate_food_compatibility_policy_version`   | Atomically snapshots and activates or rolls back an immutable policy bundle, then refreshes every compatibility fact and preference option      |
| `sync_product_ingredient_evidence`             | Rebuilds the lossless relational ingredient statement/tree projection for one product, observation, or submission without parsing unstructured text or inventing percentages |
| `sync_product_precautionary_statements`         | Rebuilds exact package precautionary statements and normalized statement metadata for one product, observation, or submission                   |
| `extract_product_compatibility_facts`          | Extracts active policy-versioned compatibility facts from food/product JSON and relational evidence, preferring exact precautionary statements over duplicate flat trace facts |
| `rebuild_shared_product_compatibility_summary` | Rebuilds denormalized compatibility summary JSON on shared products                                                                            |
| `refresh_shared_product_compatibility_match_facts` | Re-extracts one canonical shared product with the current reviewed compatibility policy                                                    |
| `sync_shared_product_compatibility_summary`    | Trigger helper that refreshes a canonical summary after fact changes, with a bulk-backfill guard                                               |
| `sync_user_compatibility_rules`                | Resolves exact saved preferences against the active reviewed policy and keeps unmatched text explicitly unresolved                           |
| `refresh_food_compatibility_preference_mapping_bundle` | Snapshots and hashes reviewed preference-term mappings into one policy version                                                       |
| `rebuild_food_preference_option_catalog`       | Rebuilds allergen/dietary/ingredient option catalog from product facts                                                                         |
| `sync_nutrient_manual_entry_fields`            | Rebuilds manual-entry nutrient groups/fields from observations                                                                                 |
| `rebuild_custom_food_category_options`         | Rebuilds manual custom-food category options from observations                                                                                 |
| `normalize_food_category_value`                | Normalizes category text for option and mapping lookup                                                                                         |
| `resolve_custom_food_category_option`          | Resolves raw API category values to one enabled canonical category option                                                                      |
| `search_generic_food_records`                  | Security-definer wrapper around the private indexed search; excludes nutrient-empty shells while returning exact identifiers plus lossless measured, trace, missing, and mapping-review nutrient facts |
| `apply_shared_product_external_enrichment`     | Atomically fills legally reusable missing canonical fields, including structured package metadata, while recording observations, provenance, normalized projections, and a revision |
| `apply_shared_product_supplemental_enrichment` | Atomically fills a missing product identity field or exact package precautionary statement from a legally reusable exact source while recording observations, provenance, projections, and a revision |
| `blendcalc_api_v1_source_is_eligible`           | Tests a stored source against the DB-owned API redistribution, licence, attribution, and policy-review gate |
| `blendcalc_api_v1_source_attribution_is_complete` | Tests a represented source/reference pair for complete provider attribution and, when applicable, an exact active imported dataset release; service role only |
| `blendcalc_api_v1_source_has_active_hold`         | Tests whether an exact provider or imported dataset release has an unreleased public-API hold; service role only |
| `blendcalc_api_v1_product_readiness_reasons`    | Applies the enabled DB-backed profile and returns the service-only reasons an active shared product is withheld from API v1 |
| `get_blendcalc_product_v1`                      | Service-role-only raw reader for one active, publication-ready shared product and its latest revision by GTIN-14 |
| `get_blendcalc_product_revision_history_v1`     | Service-role-only raw reader for bounded immutable revision metadata and evidence-backed field changes for one publication-ready GTIN-14 |
| `search_blendcalc_products_v1`                  | Service-role-only partial metadata search for active, publication-ready shared products with bounded pagination and name → brand → category → supporting-metadata relevance |
| `get_catalog_data_operations_health`            | Returns bounded admin/developer catalog, source, dataset, policy, mapping, revision, and publication-readiness summaries after exact AAL2 data-operations authorization |
| `get_catalog_data_operations_monitor_summary`   | Returns bounded admin/developer monitor configuration, queue counts, and recent run state after exact AAL2 data-operations authorization |
| `get_catalog_review_work_summary`               | Returns bounded material conflicts, provider changes, and possible recall matches after exact AAL2 catalog-review authorization |
| `get_catalog_product_readiness_passport`         | Returns one bounded catalog/API status, revision, evidence-coverage, and normalized-issue passport after exact AAL2 catalog-review or data-operations authorization |
| `get_moderator_data_health`                     | Temporary compatibility wrapper for the previous combined data-health interface |
| `get_pending_profile_image_review_count`        | Service-role-only count of distinct exact profile images with one or more pending reports |
| `claim_catalog_revalidation_jobs`               | Service-only bounded claim of due product/provider jobs using expiring claim tokens |
| `complete_catalog_revalidation_job`             | Service-only completion and retry scheduling for one claimed product check |
| `record_catalog_provider_snapshot`              | Service-only immutable observation/snapshot write that creates a review for material changes |
| `confirm_catalog_provider_metadata_unchanged`   | Service-only metadata short-circuit that reschedules an unchanged provider record without downloading its full payload |
| `claim_safety_alert_ingestion_sources`          | Service-only bounded claim of due official recall feeds |
| `complete_safety_alert_ingestion_source`        | Service-only independent success or retry scheduling for one recall source |
| `record_official_food_safety_alert`             | Service-only versioned alert upsert, identifier refresh, and conservative product matching |
| `request_catalog_monitor_run`                   | Requests the secret-authenticated monitor Edge Function through the configured Vault values |
| `get_catalog_monitor_moderation_summary`        | Temporary compatibility wrapper for the previous combined monitor/review interface |
| `review_official_food_safety_alert_match`        | Confirms or dismisses one probable recall match after an AAL2 permission check |
| `review_catalog_provider_change`                | Rejects/supersedes a provider change or links acceptance to an existing approved catalog revision after an AAL2 permission check |
| `mark_product_safety_alert_notification_read`   | Lets an authenticated owner mark exactly one of their alert notifications as read |
| `catalog_change_summary_is_valid`               | Validates unique structured old/new field changes before a catalog product update can be accepted |
| `consume_request_rate_limit`                    | Atomically consumes one private server-side request quota unit; service role only |
| `replace_app_interaction_daily_metrics`         | Atomically replaces a bounded production date range of private Vercel interaction aggregates; service role only |
| `reject_blocked_signup`                        | Supabase Auth hook for hashed email signup blocks                                                                                              |
| `custom_access_token_hook`                     | Supabase Auth hook that adds the current database-owned `user`, `moderator`, `admin`, or `developer` role to newly issued JWTs as `app_role`     |
| `authorize_app_permission`                     | Requires an AAL2 session, then checks the signed `app_role` claim against database-owned role permissions for protected RLS policies             |
| `set_app_user_role`                            | Service-only atomic role assignment/revocation with a matching moderation audit action                                                         |

## Storage Buckets

| Bucket                        | Public | Purpose                                                     | Access Pattern                                                     |
| ----------------------------- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `profile-avatars`             | No     | User avatar files                                           | Owner-scoped read; verified server actions write and delete         |
| `product-submission-evidence` | No     | Product label/evidence images for shared catalog moderation | Owner-scoped read; verified server submission flow writes and deletes |
| `food-image-assets`           | Yes    | Moderator-approved public product images                    | Public read; service-role publication and metadata persistence     |

Uploaded profile and product-evidence images are byte-bounded, signature-checked,
decoded, orientation-normalized, dimension-bounded, metadata-stripped, and re-encoded
as WebP before storage. Moderator publication repeats normalization so older evidence
cannot bypass the public-image boundary.

## Update Checklist

When schema changes:

1. Add a migration in `supabase/migrations/`.
2. Add RLS and grants intentionally.
3. Add indexes for expected filtering, sorting, joins, and lookup paths.
4. Verify the complete migration chain against the resettable local database.
5. Prove the currently deployed `main` application remains compatible with the expanded
   schema, then promote the exact additive migration source, this schema map, generated
   types, and database tests to remote `main` without dependent application code.
6. Inspect `npm run db:push:dry`, apply the promoted migration with the guarded
   `npm run db:push` or `npm run db:push:auto`, and confirm the local/linked migration
   lists match. Never bypass the promotion guard with a direct linked CLI push.
7. Regenerate `src/lib/types/database.types.ts` after migration is applied and verify it
   matches the promoted contract.
8. Backfill applicable existing rows whenever a new accepted field can be recovered
   from canonical data, normalized child rows, or legally reusable exact-source
   observations.
9. Update this document with table purpose, owner scope, key columns, and relationships.
10. Add or update focused tests for migration expectations when practical.
11. Promote application code that requires the new schema only after the production
    migration and current `main` application are verified. Delay destructive contract
    cleanup to a later release.
12. Add a local-only QA item to the appropriate priority tracker linked from
   `docs/QA/qa-tasks.md` if the change affects user-visible data, moderation behavior,
   or data-entry flow.
