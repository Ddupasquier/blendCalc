# Testing Strategy

blendCalc uses the narrowest test layer that can prove a behavior honestly. Tests
should fail close to the defect, run only the infrastructure they need, and have one
clear owner. Browser coverage is essential, but it does not replace fast logic tests,
database enforcement tests, compiler checks, or direct human verification.

## Quick Navigation

| Need                          | Sections                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose the correct test owner | [Ownership](#ownership), [ownership problems](#ownership-problems-to-avoid), and [choosing a layer](#choosing-a-layer)                        |
| Run an efficient test pass    | [Development workflow](#development-workflow), [parallelism](#parallelism), and [quiet output](#quiet-output)                                 |
| Verify a release boundary     | [Remote verification](#remote-verification), [browser matrix](#browser-matrix), and [database and QA boundaries](#database-and-qa-boundaries) |
| Avoid fragile coverage        | [Avoid](#avoid)                                                                                                                               |

## Ownership

| Layer                        | Use it for                                                                                                                                                                                | Do not use it for                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| TypeScript and Svelte checks | Type contracts, Svelte diagnostics, and compile-time integration                                                                                                                          | Runtime or visual behavior                                |
| Vitest                       | Calculations, normalization, validation, serializers, server handlers, provider adapters, isolated callbacks, synthetic failures, architecture, and migration-source guards               | Routed browser interactions already covered by Playwright |
| Local Supabase and pgTAP     | Migrations, constraints, indexes, triggers, functions, grants, RLS, Auth hooks, Storage policies, and transactions                                                                        | Browser presentation                                      |
| Playwright                   | Rendered flows, client routing, overlays, forms, focus, keyboard, pointer/touch behavior, responsive bounds, browser engines, structural accessibility, hydration, and approved snapshots | Exhaustive calculation matrices or direct schema proof    |
| Manual QA                    | Physical-device permissions, installed-browser sign-off, VoiceOver, TalkBack, camera behavior, OS integration, and subjective visual approval                                             | Repeatable behavior repository automation can prove       |

One assertion gets one primary owner. Different layers may cover the same feature at
different boundaries:

- Vitest proves nutrient normalization across a large value and unit corpus.
  Playwright proves one representative normalized value through the real form.
- pgTAP proves an RLS policy. Playwright proves the resulting user flow.
- Vitest proves every goal-evaluation branch. Playwright proves that changing a goal
  updates the rendered result.

## Lint And Formatting Ownership

`npm run lint` is the blocking TypeScript, JavaScript, Svelte, and SCSS correctness
check. `npm run lint:code:all` also prints explicitly nonblocking migration warnings for
older unkeyed Svelte collections, route resolution, and legacy reactive collections.

Prettier is adopted without a repository-wide churn-only rewrite. New supported files
must pass `npm run format:check` locally and in CI. Use
`npm run format -- <paths...>` when deliberately normalizing an existing file, and use
`npm run format:check:all` only to measure the remaining historical formatting debt.
Once an existing file is intentionally normalized, keep it formatted in later changes.

## Ownership Problems To Avoid

| Problem                                                                        | Why it hurts                                                 | Correct owner                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| The same click flow exists in jsdom and Playwright                             | Both tests break for one UI change without adding confidence | Keep the routed Playwright flow; retain only an isolated callback or failure branch in Vitest                     |
| A browser test checks source text or migration SQL                             | It starts the slowest layer without proving browser behavior | Use a focused Vitest architecture guard or the local database suite                                               |
| A component test tries to prove layout, focus clipping, or responsive behavior | jsdom does not perform real layout or browser focus painting | Use Playwright at the required viewport                                                                           |
| Playwright creates impossible provider or database failures through UI hacks   | The setup becomes brittle and less honest than the contract  | Inject the failure in a server/unit test; keep one real user-facing failure flow in Playwright when deterministic |
| Several browser workers share one mutable account                              | Tests race persisted state and become flaky                  | Give every worker an isolated user and storage state; isolate each remote job's database                          |
| Manual QA repeats a deterministic browser flow                                 | Regressions rely on memory and consume repeated human effort | Move the reproducible flow to Playwright and keep manual QA for hardware or judgment                              |

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
npm run test:focused -- tests/path/to/affected.test.ts
npm run test:watch -- tests/path/to/affected.test.ts
```

For browser work, prepare the disposable database once, then run the affected spec in
the primary browser:

```bash
npm run test:e2e:session:start
# In another terminal while the prepared server remains open:
npm run test:e2e:affected:run
npx playwright test tests/e2e/affectedInteractions.spec.ts --project=desktop-chromium
```

`npm run test:affected` selects related Vitest files from the current diff.
`npm run test:e2e:affected` prepares the browser environment and selects routed specs
from the same ownership map. Use the `:run` variant during an existing browser-test
session so Supabase and the production build are not prepared again.

Rerun only browser failures with:

```bash
npx playwright test --last-failed
```

Use the visible terminal dashboard when a complete progress view is more useful than
compact output:

| Profile         | Command                    | Target       | Ownership                                                                                             |
| --------------- | -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Quick Check     | `npm run verify:quick`     | Under 4 min  | Formatting, lint, Svelte/TypeScript, and Vitest selected from changed ownership                       |
| Feature Check   | `npm run verify:feature`   | Under 6 min  | Source gates plus Vitest and browser specs selected from changed ownership                            |
| Release Check   | `npm run verify:release`   | Under 15 min | Dependency audit, source gates, disposable database, build, and the bounded blocking browser tiers    |
| Promotion Check | `npm run verify:promotion` | Under 1 min  | Proves a clean promoted tree matches its tested candidate, using a local receipt when no ref is given |
| Nightly Check   | `npm run verify:nightly`   | Nonblocking  | Release confidence plus every scenario in every maintained browser and device-emulation project       |

VS Code exposes the same checks through **Terminal → Run Task**. Each task opens
one dedicated terminal and shows stage progress, elapsed time, an estimate based on
ignored local duration history, the current test when the runner reports it, and the
failure-log path when a stage fails. This is a presentation layer over the maintained
commands; it does not replace focused iteration, GitHub's isolated browser jobs, or
manual physical-device verification.

### Feature Confidence

Use changed-file ownership for normal feature work:

```bash
npm run test:affected
npm run test:e2e:affected
```

The selector maps Mix, Ingredients, Profile, Saved, and Auth ownership to their routed
browser specs. Shared unit-test configuration expands Quick Check to every Vitest
project. Shared shell, style, browser support, or Playwright configuration changes
expand browser verification to the bounded blocking matrix. Do not rerun browser tests
after documentation, comments, or unrelated source-only edits.

### Release Confidence

Run `npm run verify:feature` on child branches. After approved children are merged into
their parent feature branch, run the combined affected checks and complete the feature's
visual or manual review there. For a multi-ticket feature, promote that exact tree to
`mock-staging` as the release candidate and let GitHub run the complete source and
bounded browser confidence once. The source job and independent browser jobs start
together; desktop Chromium is split into two shards. For an ordinary single-branch
change that does not need `mock-staging`, `staging` itself is the release candidate.

Use `npm run verify:release` locally only when the hosted candidate run is unavailable,
the candidate includes uncommitted work that cannot yet be published, or a fresh local
full run is explicitly requested. A successful local run records an ignored,
content-addressed receipt in the shared Git directory. `npm run verify:promotion`
validates that receipt; `npm run verify:promotion -- --against <candidate-ref>` validates
an exact Git-tree promotion without rerunning the suite. Both paths fail closed on a
dirty or changed tree. `--force-full` deliberately bypasses local reuse.

GitHub runs affected Vitest and browser coverage on ordinary feature branches. The
selected candidate runs the complete Vitest and bounded browser tiers once. An unchanged
promotion reuses that result: `staging` must match `mock-staging` when the disposable
checkpoint was used, and `main` must match `staging`. Database verification runs only
when database-owned files changed. Hosted Auth health runs only when Auth-owned files
changed, plus its daily drift check and manual runs.

#### Work-Quota Closeout

An explicit work-queue quota is one review batch, not permission to combine unrelated
source responsibilities. For a large feature, use one parent ticket and parent feature
branch, with focused child branches for independently reviewable work. Run Feature Check
on each child. After the user approves a child, merge it into the parent branch and
rerun only checks affected by the combined change. Complete visual and manual feature
review on the assembled parent, then promote its exact tree to `mock-staging` for one
complete hosted candidate run. If that run fails, reopen or repair the child that owns
the failure and create a new candidate result.

Use an auxiliary worktree only when unrelated uncommitted work makes a normal branch
switch unsafe. The quota handoff must include every branch, focused evidence, the exact
parent candidate, its hosted result, and any remaining direct user-verification steps.
A green candidate does not authorize commits, changed-content pushes, merges, database
deployment, or promotion. `npm run verify:nightly` remains a separate scheduled or
explicitly requested matrix.

During browser-facing feature work, run:

```bash
npm run verify:feature
```

The exact candidate's hosted full run supplies the broader release proof. Run
`npm run db:test:verify` when migrations, policies, functions, grants, Auth hooks,
Storage behavior, or database-owned reference data changed. Run the maintained
dependency audit after dependency or lockfile changes. Documentation-only work needs
only the focused architecture and documentation checks that govern the changed text.

## Parallelism

Vitest separates work by runtime instead of paying for jsdom in every file:

- 389 source, server, architecture, and pure-utility files run in Node threads;
- 121 rendered component and browser-utility files run in isolated VM threads;
- one OCR component test uses a standard isolated thread because Svelte runes cannot be
  evaluated safely in the VM pool.

On the current development machine after removing the former editor-memory bottleneck,
the complete 2,553-assertion Vitest pass completed in 64.6 seconds with four workers in
one process, versus 90.8 seconds with two workers across three sequential processes.
Vitest therefore uses four workers locally and in CI inside the maintained 4 GiB Node
heap and resource preflight limits.

Playwright defaults to two workers. A clean bounded-matrix benchmark completed in 3.7
minutes with two workers and 4.2 minutes with three, so the extra worker increased local
contention instead of improving throughput. The maintained QA database still seeds three
equivalent browser-worker personas for future remeasurement. Override
`PLAYWRIGHT_WORKERS` only to select one or two workers while benchmarking; values above
two are rejected. A hosted test run must provide one comma-separated
`PLAYWRIGHT_QA_EMAILS` value per worker; one shared account is not parallel-safe.

Feature Check now runs only affected Vitest and Playwright ownership after source gates;
it no longer repeats every Vitest project. A browser-owning change still pays for the
isolated browser database and production test build. Further cold-start optimization
must not weaken database isolation, browser ownership,
production-build confidence, or failure diagnostics.

`fullyParallel` lets Playwright schedule independent tests from large responsibility
specs across those isolated workers. Splitting a spec is still appropriate when its
feature ownership becomes unclear, but splitting files solely to manufacture parallelism
is unnecessary and creates churn without reducing execution time.

Remote browser verification uses one job per Playwright project. Every job creates its
own local Supabase stack, so Chromium, Firefox, WebKit, and compact projects cannot race
one another. The jobs may use their isolated worker accounts internally, but sharding
still requires one independent database environment per shard.

## Quiet Output

Keep successful runs compact and preserve full diagnostics for failures:

```bash
npm test
npx playwright test
```

Reports, traces, screenshots, videos, and logs belong in ignored test-output folders.
Routine evidence needs the command, exit status, pass/fail/skip counts, and relevant
failure block—not a complete successful log. Never truncate the diagnostic that explains
a failure.

Route performance uses two distinct gates. Deterministic tests require the maintained
instrumentation, lazy boundaries, and explicit budgets to remain present. A repeatable
Playwright diagnostic records server phases, hydration, and important interaction
durations as an attachment, but one local sample is not a production request blocker.
Release acceptance compares p75 production field metrics to the maintained Fridge
budgets: FCP and LCP at 2.5 seconds, INP at 200 milliseconds, and TTFB at 800
milliseconds. Diagnose failures with the fixed server phase budgets before changing a
user-visible or safety contract.

The maintained Vitest and Playwright configurations use compact dot output by default.
Redirect a long unattended run to `test-results/` when only its summary is needed; that
directory is ignored. Open retained HTML reports, traces, screenshots, videos, or logs
only when a failure needs investigation.

## Remote Verification

The checked-in workflows use Node.js 24 and a clean dependency install:

- `.github/workflows/verify.yml` chooses feature, full-candidate, or exact-promotion
  scope before expensive setup. Feature branches run affected unit and browser work.
  On a full candidate, source checks and browser jobs run concurrently, and desktop
  Chromium is split across two isolated shards. Desktop Chromium owns every routed interaction, mobile Chromium owns
  compact/touch contracts, and Firefox/WebKit own tagged compatibility smoke coverage. Its
  source job supplies compile-only local public Supabase placeholders so Svelte can
  generate `$env/static/public` types without production credentials or database
  access;
- `.github/workflows/nightly-browser-matrix.yml` runs every Playwright scenario in all
  five projects on a schedule and on manual request. It reports exhaustive regressions
  without making that redundant matrix part of every blocking push;
- `.github/workflows/database-verification.yml` rebuilds the local Supabase stack and
  runs pgTAP whenever migrations or database-test ownership files change. Its stable
  `Database Verification` conclusion still reports success when those files are
  unchanged, so GitHub can safely require the check without leaving a pull request
  pending;
- `.github/workflows/hosted-auth-verification.yml` checks the public production site and
  Supabase Auth health endpoint after Auth-owned changes, on a daily schedule, and when
  manually requested. Unrelated pushes retain the stable required conclusion without
  installing dependencies. The publishable browser key is public configuration; the
  workflow receives no database password, service-role key, management token, or other
  protected credential.

The stable required conclusions are `Source, Tests, And Build`, `Browser Matrix`,
`Database Verification`, and `Hosted Auth Health`. Every pushed branch reports the
maintained gates, while expensive domain checks run only when their ownership changed.
Repository protection
must require all four on `staging` and `main`; pull requests target `staging` for normal
work and `main` only for an explicitly approved release.

## Browser Matrix

The blocking Playwright suite uses explicit tiers:

- desktop Chromium runs every routed interaction;
- mobile Chromium adds tests tagged `@mobile` and `@compatibility`;
- desktop Firefox, desktop WebKit, and mobile WebKit run tests tagged
  `@compatibility`;
- `PLAYWRIGHT_EXHAUSTIVE_MATRIX=true` removes those filters for the nightly and
  pre-release exhaustive matrix.

This keeps deep business flows in one primary engine while preserving targeted engine,
touch, responsive, route, focus, and hydration confidence. Give every project-specific
skip a clear reason.

See [Browser Testing](browser-testing.md) for Playwright setup, authenticated state,
artifacts, snapshots, and authoring rules.

## Database And QA Boundaries

All destructive database verification uses the disposable local Supabase stack. It
must not copy production records, call external food providers during routine tests, or
reset a linked project. See [Database Testing](database-testing.md).

Automation can complete a QA task only when it proves every step and expected outcome
with the required corpus, project, route, and viewport. Physical devices, named
installed browsers, OS permissions, assistive technology, and subjective visual
approval remain manual.

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
