# Project Structure

## Purpose

This is the canonical ownership map for blendCalc. Put a file with the code that owns
it, not in a generic folder that merely describes what kind of file it is.

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
├── routes/                  URL routes, loading, and high-level orchestration
└── styles/
    └── _variables.scss      App-wide design tokens only
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

## Domain Logic

- `src/lib/utils/<domain>` owns pure calculations, formatting, validation, and state
  helpers that can run without server secrets.
- `src/lib/server/<domain>` owns database access, external API calls, privileged policy,
  and server-only orchestration.
- `src/lib/config` is for stable shared configuration. Domain defaults, constants, and
  storage keys stay with their domain owner.
- `src/lib/types` is not a prop-type folder. Generated database types and truly
  cross-domain contracts belong there.

Do not create generic dumping folders such as `defaults`, `helpers`, `misc`, or
`shared`. Name the domain and responsibility instead.

## Tests

```text
tests/
├── config/                  Architecture, generated-contract, and migration guards
├── fixtures/                Shared deterministic test data
├── lib/                     Unit/component tests grouped by source domain
├── routes/                  Route contract tests
└── supabase/                Database policy tests
```

Tests should follow the same domain vocabulary as `src`. A component test may remain in
its domain test folder; it does not need a second namesake folder unless that component
needs multiple test/support files.

## Scripts

- Executable maintenance commands live at `scripts/` and use an operation prefix such
  as `audit_`, `backfill_`, `import_`, `seed_`, or `generate_`.
- Reusable script code lives in `scripts/lib`.
- Shared import/reference catalogs live in `scripts/reference-data`.
- Generated artifacts used by scripts live in `scripts/output` and must have a known
  consumer.
- Remove obsolete scripts instead of keeping undocumented alternatives.

## Ownership Check

Before creating a file, ask:

1. Which route, component, or domain owns it?
2. Is the file local to one owner or genuinely shared?
3. Does an existing component or utility already provide this behavior?
4. Would the proposed folder name still explain the file six months from now?

If ownership is unclear, the boundary needs to be clarified before adding the file.
