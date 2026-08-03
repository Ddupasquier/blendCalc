# Documentation Map

This directory separates project rules, implementation contracts, operational
procedures, and QA so each subject has one maintained home. Follow links to the
authoritative document instead of copying its guidance into another file.

The root [`README.md`](../README.md) owns repository setup and the intentional
developer-facing command index. [`scripts/README.md`](../scripts/README.md) owns script
organization and script-specific execution guidance.

## Authority And Ownership

| Document | Owns | Does not own |
| --- | --- | --- |
| [`dev-rules/dev-rules.md`](dev-rules/dev-rules.md) | Mandatory development requirements and non-negotiable boundaries | Implementation inventories, open findings, or feature walkthroughs |
| [`dev-rules/dev-rules-audit.md`](dev-rules/dev-rules-audit.md) | Verified unresolved findings that still need implementation work | Settled rules or completed history |
| [`project-structure.md`](project-structure.md) | File, folder, route, test, and script ownership | Visual design or runtime data policy |
| [`style-guide.md`](style-guide.md) | Ingredients-derived visual system, tokens, component presentation, responsive behavior, and interaction styling | Feature business logic |
| [`ui-functionality.md`](ui-functionality.md) | User-visible behavior and interaction contracts by view | Schema inventories, legal terms, or styling token definitions |
| [`data-architecture.md`](data-architecture.md) | Runtime read/write boundaries, browser state, server ownership, external-source intake, and operational analytics architecture | Table-by-table schema reference |
| [`supabase-schema.md`](supabase-schema.md) | Navigable table, column, relationship, function, policy, and Storage map | Feature walkthroughs or provider licensing analysis |
| [`shared-product-catalog.md`](shared-product-catalog.md) | Catalog intake, canonicalization, revision, verification, moderation, and publication lifecycle | Complete API response fields or source licence terms |
| [`normalized-food-nutrients.md`](normalized-food-nutrients.md) | Nutrient normalization, synchronization, read semantics, and query examples | The complete nutrient table catalog |
| [`data-source-licensing.md`](data-source-licensing.md) | Source-specific licence, attribution, storage, rendering, and redistribution requirements | Provider payload inventory or catalog workflow |
| [`api-structures/source-data-inventory.md`](api-structures/source-data-inventory.md) | Active provider capabilities, preserved fields, and intake-module boundaries | Legal interpretation |
| [`api-structures/catalog-field-lineage.md`](api-structures/catalog-field-lineage.md) | API v1 field population, publication readiness, and public lineage | General catalog moderation workflow |
| [`api-structures/README.md`](api-structures/README.md) | API v1 endpoint overview, contract status, and generated provider-reference instructions | Field-level lineage details |
| [`versioning.md`](versioning.md) | App, API, build, schema, product, placement, and transient-state version streams | Deployment setup |
| [`authentication.md`](authentication.md) | Auth origins, callbacks, account-security configuration, and auth verification | General RLS/schema reference |
| [`database-testing.md`](database-testing.md) | Disposable local database setup, commands, safety, and QA mutation procedure | Production migration policy |
| [`moderation.md`](moderation.md) | Role boundaries, account controls, notification setup, and moderation workflows | Catalog field mapping |
| [`user-profiles.md`](user-profiles.md) | Profile identity, appearance, avatar storage, and profile privacy | General authentication setup |
| [`barcode-scanning.md`](barcode-scanning.md) | Supported codes, scanner behavior, scan privacy, and native-scanner direction | Provider enrichment or catalog publication policy |

## QA

[`QA/qa-tasks.md`](QA/qa-tasks.md) is the active QA index. Its priority files contain
only executable human checks; [`QA/completed-qa-tasks.md`](QA/completed-qa-tasks.md)
preserves completed verification history. Repeated local account and barcode fixtures
inside priority files are intentional so each queue remains usable on its own.

## TODO

[`TODO/todo-tasks.md`](TODO/todo-tasks.md) is the local-only general work index. Its
priority files own incomplete implementation, verification, decision, deployment, and
research work. During the transition away from standalone QA queues, TODO items link to
legacy QA groups without duplicating their detailed acceptance criteria.

## Maintenance

When documentation changes:

1. Update the document that owns the subject.
2. Replace supporting explanations elsewhere with a direct link and only the local
   context needed to understand that document.
3. Do not duplicate rules, schema columns, provider terms, API field maps, commands, or
   QA acceptance criteria.
4. Keep executable sources authoritative: migrations and generated database types for
   schema, route types and OpenAPI for API contracts, package files for versions, and
   application code for current behavior.
5. Remove superseded statements rather than preserving contradictory historical
   guidance in active documents.
