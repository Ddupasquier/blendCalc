# blendCalc Documentation

This directory contains the maintained rules, contracts, architecture, operations, and
testing references for blendCalc. Each subject has one owner. Supporting documents should
link to that owner instead of repeating its content.

The root [README](../README.md) owns repository setup and the stable command guide.
[Repository Scripts](../scripts/README.md) owns script organization and script-specific
execution guidance.

## Start Here

| If you are...                            | Read first                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting any change                      | Create or enter its dedicated [feature branch](project-structure.md#feature-branches), read [Development Rules](dev-rules/dev-rules.md), then read the matching subject documents below |
| Adding or moving files                   | [Project Structure](project-structure.md)                                                                                                                                               |
| Changing UI or behavior                  | [Style Guide](style-guide.md), [UI Functionality](ui-functionality.md), and the matching view contract                                                                                  |
| Changing durable data                    | [Data Architecture](data-architecture.md), [Supabase Schema](supabase-schema.md), and [Database Testing](database-testing.md)                                                           |
| Changing food, catalog, or provider data | [Shared Product Catalog](shared-product-catalog.md), [Source Data Inventory](api-structures/source-data-inventory.md), and [Data Source Licensing](data-source-licensing.md)            |
| Changing API v1                          | [API Structures](api-structures/README.md), [Catalog Field Lineage](api-structures/catalog-field-lineage.md), OpenAPI, and versioned TypeScript contracts                               |
| Adding or changing tests                 | [Testing Strategy](testing.md) plus the browser or database guide when applicable                                                                                                       |
| Adding or running automated QA           | [Testing Strategy](testing.md), plus the browser or database guide when applicable                                                                                                      |

## Authority

Use the most direct source of truth for the question being answered:

1. **Executable contracts** own what the application can actually run: migrations and
   generated database types, route and API types, OpenAPI, `package.json`, and source
   code.
2. **Development Rules** own mandatory engineering requirements and the change
   lifecycle.
3. **The subject document** owns the maintained explanation of one domain.
4. **The Development Rules Audit** owns the repeatable audit procedure, but not an
   active findings list.

If implementation and documentation disagree, do not invent a compromise. Verify the
intended contract, then update the owning source and its maintained explanation together.

## Development And Product Contracts

| Document                                                                            | Responsibility                                                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Development Rules](dev-rules/dev-rules.md)                                         | Mandatory workflow, safety, quality, naming, styling, database, API, testing, documentation, and handoff rules |
| [Development Rules Audit](dev-rules/dev-rules-audit.md)                             | Repeatable audit method; not a second backlog                                                                  |
| [Project Structure](project-structure.md)                                           | File, folder, component, route, test, script, and documentation ownership                                      |
| [Style Guide](style-guide.md)                                                       | Ingredients-derived visual language, semantic tokens, responsive behavior, motion, and component presentation  |
| [UI Functionality](ui-functionality.md)                                             | Short index for view and shared-flow behavior contracts                                                        |
| [App Shell And Authentication UI](ui-functionality/app-shell-and-authentication.md) | Navigation shell, authentication screens, error pages, and guided-tour behavior                                |
| [Ingredients UI](ui-functionality/ingredients.md)                                   | Fridge, Shopping List, search, manual entry, barcode, nutrition details, and ingredient overlays               |
| [Mix UI](ui-functionality/mix.md)                                                   | Mix composition, goals, selected foods, warnings, suggestions, and reorganization                              |
| [Saved Recipes UI](ui-functionality/saved-recipes.md)                               | Recipe search, sort, disclosure, load, share, and delete behavior                                              |
| [Profile UI](ui-functionality/profile.md)                                           | Profile overview, appearance, details, food preferences, tutorial, and elevated actions                        |
| [Moderation UI](ui-functionality/moderation.md)                                     | Moderator routes, review surfaces, and privileged interaction behavior                                         |

## Data, Catalog, And API

| Document                                                         | Responsibility                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Data Architecture](data-architecture.md)                        | Runtime reads, writes, caching, browser state, server boundaries, source intake, analytics, and durable-data rules |
| [Supabase Schema](supabase-schema.md)                            | Navigable map of tables, columns, relationships, functions, policies, and Storage                                  |
| [Shared Product Catalog](shared-product-catalog.md)              | Product intake, observations, canonical fields, revisions, verification, moderation, and publication lifecycle     |
| [Normalized Food Nutrients](normalized-food-nutrients.md)        | Nutrient normalization, synchronization, read semantics, and query examples                                        |
| [Barcode Scanning](barcode-scanning.md)                          | Supported codes, scanner behavior, scan privacy, and native-scanner direction                                      |
| [Data Source Licensing](data-source-licensing.md)                | Source-specific licence, attribution, storage, rendering, and redistribution requirements                          |
| [Source Data Inventory](api-structures/source-data-inventory.md) | Provider capabilities, preserved fields, and intake ownership                                                      |
| [Catalog Field Lineage](api-structures/catalog-field-lineage.md) | API v1 field population, publication readiness, and public lineage                                                 |
| [API Structures](api-structures/README.md)                       | API v1 status and endpoints plus generated provider-reference guidance                                             |
| [Public API Release](public-api-release.md)                      | Terms-review packet, approval evidence, release requirements, and public-access procedure                          |

## Accounts, Security, And Operations

| Document                              | Responsibility                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Authentication](authentication.md)   | Origins, callbacks, OAuth, password policy, MFA, Auth configuration, and verification                |
| [Hosted Security](hosted-security.md) | Production network controls, backups, recovery drills, hosted Auth baseline, and incident procedures |
| [User Profiles](user-profiles.md)     | Profile identity, appearance, avatars, privacy, and food-preference persistence                      |
| [Moderation](moderation.md)           | Roles, account controls, review workflows, notifications, and privileged boundaries                  |
| [Versioning](versioning.md)           | Independent app, API, build, schema, catalog, image-placement, and browser-state versions            |

## Testing

| Document                                | Responsibility                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Testing Strategy](testing.md)          | Test ownership, execution stages, parallelism, and efficient verification                |
| [Browser Testing](browser-testing.md)   | Playwright projects, authenticated setup, visual snapshots, and browser-test conventions |
| [Database Testing](database-testing.md) | Disposable local Supabase, seeded personas, safety boundaries, and pgTAP workflows       |

## Documentation Maintenance

When a subject changes:

1. Update the implementation or executable contract that owns the behavior.
2. Update the one document that explains that subject.
3. Replace duplicate explanations elsewhere with a link and only the local context
   needed by that file.
4. Keep schema, API, provider, command, QA, and policy details out of unrelated docs.
5. Remove superseded instructions instead of keeping contradictory history in active
   documentation.
6. Keep private credentials, private user data, temporary output, and personal workflow
   material out of tracked documentation.

Long documents should split only when their sections have genuinely independent owners.
An established parent path should remain as the short index for any child documents.

## Readability Standard

- Start every document with a plain-language purpose and ownership boundary.
- Give maintained documents of roughly 150 lines or more a compact navigation table
  near the top. Link to meaningful sections, not every heading.
- Use real Markdown headings for independently searchable topics so editor outlines and
  rendered page navigation remain useful.
- Use tables for directories, commands, comparisons, status summaries, and long sets of
  related links. Keep procedural steps as ordered lists and requirements as short
  bullets.
- Prefer direct, human wording. Define an acronym at first use when its meaning is not
  obvious from the surrounding domain.
- Keep dynamic counts, temporary status, private workflow, and completion history out
  of tracked subject guides unless that exact state is part of the durable contract.
- Remove stale instructions instead of labeling them as legacy unless compatibility
  still exists and readers must understand it.
