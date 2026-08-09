# Browser Testing

Playwright owns deterministic browser behavior and visual regression coverage. It runs
the application against the disposable local Supabase test database so authenticated
tests never depend on production data or external food providers.

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

Keep pure functions, isolated component state, server handlers, database contracts,
source-code architecture, and migration assertions in Vitest or the database test
suite. Do not preserve a source-string assertion after equivalent rendered behavior is
covered by Playwright unless the source boundary itself is an intentional contract.

Playwright does not replace physical-device camera and permission checks, VoiceOver,
TalkBack, named installed-browser sign-off, or subjective visual approval. Those remain
in the manual QA queue until directly observed in the required environment.

The automated accessibility gate currently owns structural WCAG A/AA rules. Existing
shared-token color-contrast debt remains explicit in QA and is not hidden by presenting
the structural scan as complete accessibility certification.

## Local Test Environment

Every public Playwright command first runs the shared E2E preparation command, which
stops stale Vite processes, frees port `5173`, starts the isolated local Supabase stack,
and repairs deterministic QA personas and fixtures. Playwright then starts the test-mode
app through the internal `dev:test:server` command. Existing production-linked
development servers are never reused.

The authentication setup signs in the disposable `qa-user@blendcalc.local` persona and
writes browser state beneath ignored `test-results/`. Override the local account only
when a deliberate hosted test run requires it:

```bash
PLAYWRIGHT_QA_EMAIL="..." PLAYWRIGHT_QA_PASSWORD="..." npm run test:e2e
```

Set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_SKIP_WEB_SERVER=1` only for an explicitly
prepared hosted test environment. Never point destructive or mutating browser tests at
production.

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

Install browser binaries after a fresh dependency install or Playwright upgrade.
Generated reports, traces, videos, authentication state, and failure screenshots remain
under ignored `playwright-report/` and `test-results/`. Approved snapshot baselines live
beside their test files and are tracked.

## Writing Tests

- Prefer role, label, and visible-name locators over internal selectors.
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
- Update snapshots only after reviewing the rendered diff.

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
