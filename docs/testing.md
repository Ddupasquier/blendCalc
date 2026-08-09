# Testing Strategy

blendCalc uses the narrowest test layer that can prove a behavior honestly. Tests
should fail close to the defect, run only the infrastructure they need, and have one
clear owner. Browser coverage is essential, but it does not replace fast logic tests,
database enforcement tests, compiler checks, or direct human verification.

## Ownership

| Layer | Use it for | Do not use it for |
| --- | --- | --- |
| TypeScript and Svelte checks | Type contracts, Svelte diagnostics, and compile-time integration | Runtime or visual behavior |
| Vitest | Calculations, normalization, validation, serializers, server handlers, provider adapters, isolated callbacks, synthetic failures, architecture, and migration-source guards | Routed browser interactions already covered by Playwright |
| Local Supabase and pgTAP | Migrations, constraints, indexes, triggers, functions, grants, RLS, Auth hooks, Storage policies, and transactions | Browser presentation |
| Playwright | Rendered flows, client routing, overlays, forms, focus, keyboard, pointer/touch behavior, responsive bounds, browser engines, structural accessibility, hydration, and approved snapshots | Exhaustive calculation matrices or direct schema proof |
| Manual QA | Physical-device permissions, installed-browser sign-off, VoiceOver, TalkBack, camera behavior, OS integration, and subjective visual approval | Repeatable behavior repository automation can prove |

One assertion gets one primary owner. Different layers may cover the same feature at
different boundaries:

- Vitest proves nutrient normalization across a large value and unit corpus.
  Playwright proves one representative normalized value through the real form.
- pgTAP proves an RLS policy. Playwright proves the resulting user flow.
- Vitest proves every goal-evaluation branch. Playwright proves that changing a goal
  updates the rendered result.

## Ownership Problems To Avoid

| Problem | Why it hurts | Correct owner |
| --- | --- | --- |
| The same click flow exists in jsdom and Playwright | Both tests break for one UI change without adding confidence | Keep the routed Playwright flow; retain only an isolated callback or failure branch in Vitest |
| A browser test checks source text or migration SQL | It starts the slowest layer without proving browser behavior | Use a focused Vitest architecture guard or the local database suite |
| A component test tries to prove layout, focus clipping, or responsive behavior | jsdom does not perform real layout or browser focus painting | Use Playwright at the required viewport |
| Playwright creates impossible provider or database failures through UI hacks | The setup becomes brittle and less honest than the contract | Inject the failure in a server/unit test; keep one real user-facing failure flow in Playwright when deterministic |
| Several browser workers share one mutable account | Tests race persisted state and become flaky | Keep one worker until every worker has isolated users, storage state, and durable fixtures |
| Manual QA repeats a deterministic browser flow | Regressions rely on memory and consume repeated human effort | Move the reproducible flow to Playwright and keep manual QA for hardware or judgment |

When adding Playwright coverage, inspect the older component and route tests for the
same observable behavior. Delete only the replaced assertion; keep calculations,
policy branches, callback contracts, synthetic failures, and source-architecture guards
in their faster layer.

A focused component test may confirm that a reusable primitive is composed correctly,
that callbacks receive the right value, or that ARIA and data-state attributes express
the intended contract. It cannot prove pixel alignment, clipping, animation quality,
responsive fit, painted focus, or final visual hierarchy; those belong to Playwright or
direct visual review.

## Choosing A Layer

1. If PostgreSQL, Auth, Storage, an RPC, or RLS enforces the contract, test it against
   the disposable local database.
2. If correctness depends on a browser, routed application, layout, focus model, or
   browser API, use Playwright.
3. If a function, module, server boundary, injected failure, or data-policy test can
   prove it directly, use Vitest.
4. If it requires physical hardware, installed assistive technology, a named browser
   installation, or human judgment, keep it in manual QA.

Do not move pure calculations, migrations, provider mappers, or server error branches
into Playwright because their results eventually appear in the UI. Do not leave
browser-observable behavior in jsdom because a component test already exists. When a
routed Playwright scenario fully replaces a jsdom interaction test, delete the duplicate
assertion in the same change.

## Development Workflow

### Fast Change Loop

Run the smallest relevant test while editing:

```bash
npm test -- tests/path/to/affected.test.ts
npm run test:watch -- tests/path/to/affected.test.ts
```

For browser work, prepare the disposable database once, then run the affected spec in
the primary browser:

```bash
npm run db:test:start
npx playwright test tests/e2e/affectedInteractions.spec.ts --project=desktop-chromium
```

Rerun only browser failures with:

```bash
npx playwright test --last-failed
```

### Feature Confidence

Before handing off browser-facing work, run the focused desktop and phone Chromium pass:

```bash
npm run test:e2e:chromium
```

Also run the affected Vitest domain, `npm run check`, and any database test required by
the change. Do not rerun the complete browser matrix after documentation, comments, or
unrelated source-only edits.

### Release Confidence

Before promoting browser-facing work to a release branch, run:

```bash
npm test
npm run check
npm run build
npm run test:e2e
```

Run `npm run db:test:verify` when migrations, policies, functions, grants, Auth hooks,
Storage behavior, or database-owned reference data changed. Run the maintained
dependency audit after dependency or lockfile changes. Documentation-only work needs
only the focused architecture and documentation checks that govern the changed text.

## Parallelism

Vitest already runs files in parallel. Increase its worker count only after recording a
wall-clock benchmark and checking memory use and repeated stability. More workers can be
slower when each worker initializes Svelte and jsdom.

Playwright currently uses one worker because all projects share a QA account and local
database state. Raising the count now could race theme, Mix, tutorial, selection, and
Saved Recipe persistence.

Playwright can run concurrently only after:

1. each worker has its own user and browser storage state;
2. durable mutations are isolated or restored deterministically;
3. shared catalog and reference fixtures stay read-only;
4. no test depends on execution order;
5. repeated parallel runs show no state leakage or intermittent failures.

For remote verification, prefer one isolated job per browser project, each with its own
local Supabase stack. Use Playwright sharding only when each shard has an independent
test environment. Several workers sharing one mutable database are not a useful speedup.

## Quiet Output

Keep successful runs compact and preserve full diagnostics for failures:

```bash
npm test -- --reporter=dot
npx playwright test --reporter=dot
```

Reports, traces, screenshots, videos, and logs belong in ignored test-output folders.
Routine evidence needs the command, exit status, pass/fail/skip counts, and relevant
failure block—not a complete successful log. Never truncate the diagnostic that explains
a failure.

## Browser Matrix

The complete Playwright suite includes desktop Chromium, Firefox, WebKit, mobile
Chromium, and mobile WebKit. Not every scenario must run in every project:

- run deep state-changing workflows once when shared controls already have
  cross-engine coverage;
- run route health, browser errors, shared controls, and engine-sensitive behavior in
  every applicable engine;
- run compact layout, touch, overflow, and responsive-header behavior in mobile
  projects;
- give every intentional project skip a clear reason.

See [Browser Testing](browser-testing.md) for Playwright setup, authenticated state,
artifacts, snapshots, and authoring rules.

## Database And QA Boundaries

All destructive database verification uses the disposable local Supabase stack. It
must not copy production records, call external food providers during routine tests, or
reset a linked project. See [Database Testing](database-testing.md).

Automation can complete a QA task only when it proves every step and expected outcome
with the required corpus, project, route, and viewport. Physical devices, named
installed browsers, OS permissions, assistive technology, and subjective visual
approval remain manual. See [QA Tasks](QA/qa-tasks.md).

## Avoid

- Migrating every test into Playwright.
- Testing the same interaction in jsdom and Playwright.
- Using a browser to prove a formula or database constraint.
- Raising worker counts while tests share mutable state.
- Running the complete browser matrix after every edit.
- Treating emulation as proof of physical-device behavior.
- Leaving deterministic browser checks in manual QA.
- Treating one example as proof of calculation, mapping, search, barcode, or validation
  behavior.
