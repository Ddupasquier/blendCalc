# Project Structure

## Purpose

This is the canonical ownership map for blendCalc. Put a file with the code that owns
it, not in a generic folder that merely describes what kind of file it is.

Visual implementation and token selection follow the Ingredients-derived system in
[`style-guide.md`](style-guide.md).

## Application Source

```text
src/
├── app.scss                 Global base styles only
├── hooks.server.ts          App-wide server hooks
├── lib/
│   ├── api/                 Versioned API contracts and client-safe request helpers
│   ├── assets/icons/        Reusable icon components in namesake folders
│   ├── components/          Reusable and feature UI
│   ├── config/              Small, stable app configuration shared across domains
│   ├── server/              Server-only domain services and persistence
│   ├── supabase/            Supabase client construction
│   ├── types/               Generated or genuinely cross-domain types
│   └── utils/               Pure domain logic grouped by feature
│       └── animation/       Shared motion timing, accessibility, and reusable behaviors
├── routes/                  URL routes, loading, and high-level orchestration
└── styles/
    ├── _themes.scss         Runtime light/dark semantic color values
    └── _variables.scss      App-wide SCSS design-token roles only
```

## Components

Every component owns a namesake folder:

```text
components/<domain>/<Component>/
├── <Component>.svelte
├── <Component>.scss        Only when the component has styles
└── types.ts                Only when the component owns named types
```

Rules:

- Component prop contracts belong in that component's local `types.ts`, or in the
  nearest parent `types.ts` only when the exact contract is shared by multiple siblings.
- Do not declare inline object-shaped prop types in `.svelte` files.
- A parent-level `types.ts` may contain only contracts genuinely shared by multiple
  sibling components. It must not become a collection of sibling prop types.
- A local `types.ts` must be imported by its namesake component.
- Repeated presentation becomes a reusable component; it does not become a
  feature-global stylesheet.
- Components render focused UI. They do not own database access or server policy.

## Routes

SvelteKit keeps reserved route names, so route ownership uses this shape:

```text
routes/<route>/
├── +page.svelte             Route state and high-level composition
├── +page.server.ts          Server loading/actions when needed
├── page.scss                Only when the page has route-owned styles
└── types.ts                 Only for route-owned named types
```

Layouts use the equivalent `+layout.svelte`, `+layout.server.ts`, `layout.scss`, and
`types.ts` structure. A route without styles does not need an empty `page.scss`.
Related base views and URL-backed overlays must share server data through their nearest
common `+layout.server.ts`; do not duplicate the same loader in every child route.
Prefer explicit route folders over broad catch-all parsers so unknown paths return a
real `404` and generated route types remain useful.

## Domain Logic

- `src/lib/utils/<domain>` owns pure calculations, formatting, validation, and state
  helpers that can run without server secrets.
- `src/lib/utils/animation` is the one cross-feature motion catalog. It owns shared
  JavaScript timing, reduced-motion helpers, disclosure animation, reusable transition
  builders, and SCSS timing/easing values. A component keeps only a genuinely unique
  animation sequence or geometry in its paired stylesheet.
- `src/lib/server/<domain>` owns database access, external API calls, privileged policy,
  and server-only orchestration.
- `src/lib/config` is for stable shared configuration. Domain defaults, constants, and
  storage keys stay with their domain owner.
- `src/lib/types` is not a prop-type folder. Generated database types and truly
  cross-domain contracts belong there.

Do not create generic dumping folders such as `defaults`, `helpers`, `misc`, or
`shared`. Name the domain and responsibility instead.

## Naming

Application-owned names must explain their domain responsibility without requiring the
reader to inspect the implementation. Prefer a longer exact name over an abbreviation,
generic label, stale provider term, or arbitrary character limit.
Use the new-contributor test: a junior developer should understand the name's domain,
responsibility, and relevant unit or basis from the name and nearby types without a
comment that only exists to explain an unclear identifier.

- Use `camelCase` for functions, methods, variables, and ordinary TypeScript
  properties.
- Use `PascalCase` for components, classes, types, interfaces, and enums.
- Keep immutable module constants in the established `UPPER_SNAKE_CASE` convention.
- Keep SCSS selectors in the established kebab/BEM-style convention.
- Name booleans as predicates when they represent domain decisions; conventional UI
  state names such as `open`, `disabled`, `selected`, and `busy` remain valid.
- Include units and calculation bases in numeric names when the type does not make them
  unambiguous.
- Use plural names for collections and identify `Map` or `Set` structures when that
  distinction explains behavior.
- Match a file or component folder to its primary export or owned responsibility.
- Keep provider terminology inside genuine provider adapters. Cross-source application
  models use source-neutral domain names.

Database identifiers, generated types, external payload keys, persisted storage keys,
public API fields, route contracts, and framework-reserved exports retain their
contracted names until their owning contract is deliberately versioned or migrated.
Translate them at focused boundaries instead of spreading legacy vocabulary through
the application.

## Tests

```text
tests/
├── config/                  Architecture, generated-contract, and migration guards
├── e2e/                     Playwright browser behavior and visual regression tests
├── fixtures/                Shared deterministic test data
├── lib/                     Unit/component tests grouped by source domain
├── routes/                  Route contract tests
└── supabase/                Database policy tests
```

Tests should follow the same domain vocabulary as `src`. A component test may remain in
its domain test folder; it does not need a second namesake folder unless that component
needs multiple test/support files.

The [Testing Strategy](testing.md) owns the boundary between Vitest, database tests,
Playwright, and manual QA. Keep each test in the folder for its assigned layer and do
not duplicate the same assertion across runners.

## Scripts

- Executable maintenance commands live in purpose directories under `scripts/`, such
  as `audits`, `backfills`, `generators`, `imports`, `operations`, `qa`, and `seeds`.
- Reusable script code and shared reference catalogs live under `scripts/lib`.
- Runtime/reference data belongs in canonical database tables rather than generated
  repository-local output or cache directories.
- Remove obsolete scripts instead of keeping undocumented alternatives.
- Keep the directory map and maintenance requirements in `scripts/README.md` current.

## Documentation

[`README.md`](README.md) is the canonical documentation ownership map. Add detail to the
document that owns the subject and link to it from supporting documents; do not create a
second rule set, schema map, provider ledger, API field map, command guide, or QA
checklist.

Repository setup and the stable developer command surface remain in the root
[`README.md`](../README.md). Script execution and organization remain in
[`scripts/README.md`](../scripts/README.md). Recovery context under
`docs/local-context/` and active verification under `docs/QA/` are local workflow state,
not product documentation. Verified unresolved implementation findings remain in the
maintained development audit instead of a parallel task folder.

Keep a focused document as one file. When a long document contains independently owned
domains, preserve its established path as a short index and move each domain into a
clearly named child file. Do not split one rule set, one visual token system, one legal
ledger, or one cross-table schema map merely to reduce line count. Every child file must
have one subject, be reachable from the parent index, and avoid repeating parent text.

## Ownership Check

Before creating a file, ask:

1. Which route, component, or domain owns it?
2. Is the file local to one owner or genuinely shared?
3. Does an existing component or utility already provide this behavior?
4. Would the proposed folder name still explain the file six months from now?

If ownership is unclear, the boundary needs to be clarified before adding the file.
