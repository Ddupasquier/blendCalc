# Browser Testing

Playwright owns deterministic browser behavior and visual regression coverage. It runs
the application against the disposable local Supabase test database so authenticated
tests never depend on production data or external food providers. The
[Testing Strategy](testing.md) decides which layer owns a test; this guide covers
Playwright setup and authoring.

## Ownership

Use Playwright when correctness depends on a real browser rendering and interaction
model, including:

- client-side route changes and URL-backed overlays;
- focus, keyboard, pointer, and touch behavior across rendered components;
- browser-window focus changes and draft persistence;
- compact responsive layout and horizontal-overflow checks;
- cross-engine behavior in Chromium, Firefox, and WebKit;
- automated WCAG structure checks through `@axe-core/playwright`;
- approved, deterministic visual snapshots.

Do not keep a source-string or jsdom interaction assertion after Playwright covers the
same rendered behavior unless the source boundary is itself a contract. Keep
non-browser behavior in the layer assigned by the [Testing Strategy](testing.md).

Playwright does not replace physical-device camera and permission checks, VoiceOver,
TalkBack, named installed-browser sign-off, or subjective visual approval. Those remain
in the manual QA queue until directly observed in the required environment.

The automated accessibility gate currently owns structural WCAG A/AA rules. Existing
shared-token color-contrast debt remains explicit in QA and is not hidden by presenting
the structural scan as complete accessibility certification.

## Local Test Environment

Every public Playwright command first runs the shared E2E preparation command, which
frees the dedicated test-app port `5174`, starts the isolated local Supabase stack, and
repairs deterministic QA personas and fixtures. Playwright then builds the application
in test mode and serves that fixed build at `http://localhost:5174`. Release browser
checks never use the hot-reloading development server, so a long cross-browser run
cannot invalidate modules underneath active tests. The normal development app remains
available on `http://localhost:5173`; Playwright never reuses or stops that server.

Three populated `qa-browser-*` personas isolate local browser workers. Each worker signs
in once and writes its own browser state beneath ignored `test-results/`. Two workers
run by default; set `PLAYWRIGHT_WORKERS=3` for an intentional local comparison. Override
the local accounts only when a deliberate hosted test run requires it:

```bash
PLAYWRIGHT_QA_EMAILS="first@example.test,second@example.test" \
PLAYWRIGHT_QA_PASSWORD="..." PLAYWRIGHT_WORKERS=2 npm run test:e2e
```

Set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_SKIP_WEB_SERVER=1` only for an explicitly
prepared hosted test environment. Never point destructive or mutating browser tests at
production.

Workers never share an account or browser state. Tests that mutate durable data must
still restore it before finishing because later files may reuse that worker's account.
The complete remote matrix runs each browser project in a separate job with its own
local Supabase stack. See [Testing Strategy: Parallelism](testing.md#parallelism).

## Commands

```bash
npm run test:e2e:install
npm run test:e2e
npm run test:e2e:chromium
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:update
```

- `test:e2e` runs desktop Chromium, Firefox, WebKit, mobile Chromium, and mobile WebKit.
- `test:e2e:chromium` is the focused local pass for desktop and 360×740 phone layouts.
- `test:e2e:headed` shows the desktop Chromium run.
- `test:e2e:ui` opens Playwright's test explorer.
- `test:e2e:update` deliberately refreshes tracked Chromium visual baselines.

Reviewed image snapshots are macOS baselines and run locally. Remote Linux jobs own
structural layout, responsive bounds, accessibility, and interaction checks; they skip
platform-specific pixel comparisons rather than approving unreviewed Linux images.

Tracked visual baselines currently cover the approved Ingredients composition plus the
current Mix and Saved Recipes compositions at desktop Chromium and the shared 360×740
phone viewport. Profile and Moderation remain outside snapshot approval until their
planned visual rebuilds are complete.

After `npm run db:test:start` prepares the database, use direct commands for focused
iteration without repeating database setup:

```bash
npx playwright test tests/e2e/affectedInteractions.spec.ts --project=desktop-chromium
npx playwright test --last-failed
```

Install browser binaries after a fresh dependency install or Playwright upgrade.
Generated reports, traces, videos, authentication state, and failure screenshots remain
under ignored `playwright-report/` and `test-results/`. Approved snapshot baselines live
beside their test files and are tracked.

## Writing Tests

- Prefer role, label, and visible-name locators over internal selectors.
- Before adding a jsdom interaction test, confirm the behavior cannot be exercised more
  honestly through a routed Playwright scenario. Before adding a Playwright scenario,
  remove any component interaction assertion it fully supersedes.
- Use a component selector only when measuring a visual boundary that has no user-facing
  semantic equivalent.
- Fail on unexpected browser console errors and uncaught page errors.
- Treat same-origin `5xx` responses as browser-test failures even when the page catches
  them; expected domain outcomes such as a handled product-not-found `404` need an
  explicit behavioral assertion instead of a blanket network exception.
- Keep database mutations serial and deterministic; restore the local baseline when a
  scenario changes durable state.
- Test representative positive, negative, and boundary cases rather than one example.
- Limit screenshot baselines to stable content and mask externally sourced image pixels
  when the image itself is not the contract.
- Do not approve a snapshot for a view whose visual rebuild is knowingly incomplete;
  doing so preserves debt instead of protecting an accepted design.
- Update snapshots only after reviewing the rendered diff.
- Use compact output for unattended successful runs. Open the retained HTML report,
  trace, screenshot, or video only when a failure needs investigation.

## QA Evidence

When a Playwright test proves part or all of an existing QA task, update that task in the
same change. Evidence must identify the project or engine, viewport, route, and complete
representative input corpus. Archive the task immediately only when automation proves
every stated repro step and expected outcome. Keep any installed-browser, physical
device, operating-system permission, assistive-technology, or subjective visual portion
active and state exactly what remains.

Do not add a manual QA task for deterministic browser behavior that Playwright can own
reliably. Add or extend the browser suite instead, then leave manual QA only for the
observable boundary automation cannot honestly prove.
