# blendCalc Notes And Backlog

This file is for ideas and future work. It is not the rules file and it is not the QA tracker.

- Development rules live in [`docs/development-rules-audit.md`](./development-rules-audit.md).
- Active manual QA tasks live in [`docs/QA/qa-tasks.md`](./QA/qa-tasks.md).
- Supabase schema notes live in [`docs/supabase-schema.md`](./supabase-schema.md).

## Standing Direction

- Before building new data features, check the current schema, rules, and existing data flow.
- Keep the app API → DB → UI driven.
- If useful data is available from legal API sources, store it in Supabase with source/provenance metadata before rendering it in the UI.
- Avoid hardcoded reference data. If the app needs reusable data, seed it into the database.
- Keep licensing in mind for all external data and images.
- Prefer new focused UI components during UI rebuild work. Build the target UI first, then wire existing behavior into it.
- Use reusable components and shared SCSS variables for spacing, colors, radii, typography, buttons, icons, inputs, sheets, and cards.

## High Priority

### API And Data Audit

**Goal:** Make sure we are not missing useful source data.

- [x] Run a deeper audit across all available food/product APIs.
- [x] Sample a broad set of examples, roughly 200 when practical.
- [ ] List every useful data point we can legally store.
- [ ] Add schema/migrations for useful missing data.
- [ ] Seed lawful, useful data into Supabase with source, timestamp, confidence, and provenance.
- [ ] Update [`docs/api-structures`](./api-structures) and [`docs/supabase-schema.md`](./supabase-schema.md) after the audit.

**Plain reason:** if APIs already know something useful, blendCalc should learn it once, save it, and reuse it instead of asking APIs repeatedly.

### Ingredient Image Quality

**Goal:** Product images should look good and stay source-backed.

- [ ] Keep DB/API product images as the first choice.
- [ ] Only ask users for product photos when no trusted DB/API image exists.
- [ ] Keep user-uploaded photos private until moderation approves them.
- [ ] Continue using shared crop/zoom/placement tools for user, moderator, and admin image placement.
- [ ] Explore whether a subtle image treatment can make package images feel less harsh while staying recognizable.
- [ ] Add more legal, source-backed image providers only if their license terms fit the app.

**Needs design decision:** decide whether product/package images should look fully realistic or slightly softened/stylized.

### Ingredient List Loading

**Goal:** Fridge and Shopping should scroll cleanly without fake or broken loading behavior.

- [ ] Confirm whether list data is currently fetched all at once or in pages.
- [ ] If everything is fetched up front, remove misleading “load more” behavior.
- [ ] If paging is actually needed, make infinite scroll work reliably and keep filtering across the full user list.
- [ ] Keep Fridge and Shopping spacing identical by using shared list components.

### Manual Entry Inputs

**Goal:** Inputs should be easy to use and should never submit fake defaults.

- [ ] Create or confirm a reusable input pattern where empty numeric values show placeholders instead of fake `0` values.
- [ ] Audit appwide number inputs and replace one-off behavior where needed.
- [ ] Keep required fields blank until the user enters a real value or real saved data exists.

## Product Ideas

### Export Or Share Recipe

**Goal:** Let users quickly share a recipe outside the app.

- [ ] Add a recipe export action.
- [ ] Generate plain text with ingredient amounts and nutrient totals.
- [ ] Consider a copy-to-clipboard option first.
- [ ] Later: add share-sheet support on mobile.

### Nutrition Facts Photo Capture

**Goal:** Make custom ingredient entry faster.

- [ ] Evaluate taking a photo of a nutrition label during manual entry.
- [ ] Decide whether to use OCR now or later.
- [ ] If implemented, store original evidence privately when tied to shared submissions.
- [ ] Require user confirmation before using extracted values.

### Community Recipe Feed

**Goal:** Let users discover and save shared mixes.

- [ ] Design a shared recipe page.
- [ ] Let users submit a mix with description, steps, and optional notes.
- [ ] Add save-to-my-list behavior.
- [ ] Consider upvotes/downvotes only after moderation and abuse controls exist.
- [ ] Possible feeds: trending, new, top picks, high protein, low calorie, low carb.

**Needs discussion:** moderation, spam prevention, and whether public recipes are an MVP feature or later feature.

### Tutorial And Help

**Goal:** Help should be available when users need it, not only during onboarding.

- [ ] Make tutorial available from Profile.
- [ ] Remove the “show again after 7 days” prompt if it creates annoyance.
- [ ] Add small info buttons where useful.
- [ ] Info buttons should open the relevant tutorial/help section, not a generic wall of text.

## UI And Layout Improvements

### Desktop And Wide Screens

**Goal:** Wide screens should not feel like a stretched phone.

- [ ] Define desktop breakpoints.
- [ ] Decide which views should become multi-column on desktop.
- [ ] Keep mobile-first behavior as the default.
- [ ] Start with Ingredients and Mix because they likely benefit most from wider layouts.

### Future UI Rebuild Process

**Goal:** Avoid fighting old components when the desired UI is different.

- [ ] For major future views, create the new UI components first.
- [ ] Audit whether current data and behavior fit the new UI.
- [ ] If required old behavior is missing from the new design, pause and decide whether to move, hide, or remove it.
- [ ] Wire existing data and actions into the new components.
- [ ] Test the new flow.
- [ ] Delete old components only after replacement behavior is verified.

### Ingredient Card Figma Match

**Goal:** Ingredient cards should stay aligned with the Figma direction.

- [ ] Keep card layout reusable across Fridge, Shopping, Search, and related ingredient views.
- [ ] Avoid local spacing overrides.
- [ ] Use shared buttons and icons for check, add, remove, overflow, and move actions.
- [ ] Keep source badges DB-backed.

## Technical Cleanup

### API Code Organization

**Goal:** Make source API code easy to find and reason about.

- [ ] Audit where API calls live today.
- [ ] Group source-specific API clients by API name.
- [ ] Keep server-only calls in server utilities.
- [ ] Document each API source, what it provides, and what gets cached in Supabase.
- [ ] Make it obvious which routes call USDA, Open Food Facts, and any other source.

### Route/Tab State Bug

**Problem:** Sometimes the visible tab label does not match the active tab until refresh.

- [ ] Reproduce the stale tab label.
- [ ] Identify whether route state, list state, or derived tab state is stale.
- [ ] Fix so tab labels update immediately without refresh.
- [ ] Add QA coverage for switching tabs and returning via browser back/forward.

### Supabase Schema Visibility In VS Code

**Goal:** Make schema inspection easier during development.

- [ ] Pick a VS Code workflow for viewing Supabase/Postgres schema.
- [ ] Document the recommended extension or CLI workflow in the README.
- [ ] Keep generated DB types and [`docs/supabase-schema.md`](./supabase-schema.md) as the app-owned schema references.

## Later Audits

### Accessibility Audit

- [ ] Run a full keyboard navigation pass.
- [ ] Check focus states on sheets, right sheets, dialogs, and action menus.
- [ ] Check labels for inputs, icon buttons, and image controls.
- [ ] Check color contrast on badges, warnings, and disabled controls.
- [ ] Check screen-reader text for major flows.

### README Cleanup

- [ ] Update README with current app name, setup, Supabase flow, scripts, and docs links.
- [ ] Remove over-explained or stale details.
- [ ] Link to schema, API structure docs, shared product catalog docs, and QA process.

## Possible GitHub Issue Migration

The current notes are useful for rough thinking, but bigger tasks should eventually become GitHub issues.

- [ ] Decide whether to move actionable backlog items into GitHub issues.
- [ ] If yes, create one issue per clear task area.
- [ ] Keep this file for rough notes only after issues exist.
