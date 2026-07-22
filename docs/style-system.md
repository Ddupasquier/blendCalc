# Style System

## Purpose

The style system keeps app-wide decisions easy to find without turning the global
variables file into a catalog of one-off component details.

## File Ownership

The complete source ownership map lives in `docs/project-structure.md`.

- `src/styles/_variables.scss` contains only values reused across the app or by shared
  UI primitives.
- Every UI component lives in its own namesake folder. A styled component keeps
  `Component.svelte` and `Component.scss` together; shared behavior belongs in a real
  reusable component rather than a feature-global stylesheet.
- Add `types.ts` inside that component folder only when the types belong exclusively to
  that component.
- A prop contract used by one component lives in that component's local `types.ts`.
  Exact contracts and other types or styles genuinely shared by sibling components live
  at their nearest common parent.
- A route owns `+page.svelte` and `page.scss` in the same route folder. Add `types.ts`
  there only when route-specific types are needed.
- `src/styles` must not contain feature stylesheets. App-wide base rules belong in
  `src/app.scss`; app-wide values belong in `_variables.scss`.

## Global Token Test

Before adding a value to `_variables.scss`, ask:

1. Is this decision used by multiple independent components?
2. Would changing it intentionally change those components together?
3. Is its name stable and semantic rather than tied to a mockup, source, or migration?

If any answer is no, keep the value in the component's paired stylesheet.

## Naming

- Use `$app-gap-*` for the shared spacing scale.
- Use `$app-font-*` for shared typography.
- Use `$app-shell-*` for the current app shell and common rebuilt controls.
- Use `$app-status-*` for validation and feedback roles.
- Use `$app-*` for other intentional app-wide roles.
- Use BEM-style component selectors such as `.component`, `.component__part`, and
  `.component--state`.
- Do not use names such as `figma`, `rebuild`, `new`, `temporary`, or provider names for
  visual design roles.

## Maintainability

- Global token values are direct. Do not create alias chains.
- Do not add a global variable just to hide a one-off `rem`, color, radius, or timing
  value.
- Repeated values inside one component may use a component-local SCSS variable.
- Promote a local value to the global file only when it becomes a real app-wide design
  decision.
- Load private component SCSS from the component's `<style lang="scss">` block so
  Svelte scopes it.
- Do not use script-level stylesheet imports for components or pages. If styling must
  cross a component boundary, make the visual pattern a reusable component instead.
- Reuse an existing component, mixin, or token when the visual behavior is genuinely
  shared; do not duplicate it or create an abstraction before a second use exists.
