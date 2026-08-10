# UI Behavior

This is the index for blendCalc's user-facing behavior contracts. Each child document
owns one view or shared flow. Styling belongs in the [Style Guide](style-guide.md), data
ownership in [Data Architecture](data-architecture.md), and executable acceptance
criteria in the local QA queues.

## Product Flow

1. Find or create food records.
2. Place foods in Fridge or Shopping List.
3. Build a Mix from selected foods and amounts.
4. Compare the Mix with explicit nutrient goals.
5. Review warnings, contributions, and adjustment suggestions.
6. Save useful combinations as reusable recipes.
7. Maintain optional profile and food-preference settings.

Supabase owns durable account data. Browser storage is limited to safe, disposable
draft or device state described in [Data Architecture](data-architecture.md).

## View Contracts

| Area | Contract |
| --- | --- |
| App shell, authentication, and tutorial | [`ui-functionality/app-shell-and-authentication.md`](ui-functionality/app-shell-and-authentication.md) |
| Ingredients, search, barcode scanning, lists, and nutrition details | [`ui-functionality/ingredients.md`](ui-functionality/ingredients.md) |
| Mix goals, ingredients, nutrient shape, warnings, suggestions, and saving | [`ui-functionality/mix.md`](ui-functionality/mix.md) |
| Saved Recipes | [`ui-functionality/saved-recipes.md`](ui-functionality/saved-recipes.md) |
| Profile and food preferences | [`ui-functionality/profile.md`](ui-functionality/profile.md) |
| Moderation and catalog review | [`ui-functionality/moderation.md`](ui-functionality/moderation.md) |

## Shared Requirements

- Every route and overlay works on compact phones, short landscapes, tablets, desktop,
  keyboard input, reduced motion, and 200% text zoom.
- No content creates horizontal page overflow. Long names and metadata wrap or truncate
  before they overlap controls.
- Dialogs, sheets, scanners, popovers, and tutorials keep required actions inside the
  safe viewport and preserve focus correctly.
- Important actions and warnings remain easy to find without overcrowding the resting
  view.
- Health-related preferences are optional, private, and never presented as a safety
  guarantee.
- Provider, browser, database, and validation exceptions are translated into helpful
  user-facing messages.
- Food-preference conflicts warn and explain; they do not block an ordinary action
  unless a separate security or moderation rule requires it.
- The closest approved Ingredients pattern supplies the shared interaction and visual
  language. A view differs only when its purpose requires a deliberate exception.

## Verification Boundary

These files define intended behavior. The local QA queues own current manual acceptance
steps, while [Testing Strategy](testing.md) decides whether Vitest, the local database,
Playwright, or manual QA proves each contract.
