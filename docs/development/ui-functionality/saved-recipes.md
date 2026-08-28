# Saved Recipes

Routes: `/saved` and `/saved/sort`

Saved Recipes lets users find, inspect, load, share, and remove reusable food
combinations.

## Collection Controls

- Search by recipe name or ingredient name.
- Filter recipes by current ingredient warnings or active recalls, then sort by Newest
  first, Oldest first, or Name A–Z through the shared route-backed filter-and-sort
  sheet. A recipe matches when at least one ingredient matches the selected safety
  filter. Do not use a native select in the toolbar.
- Use progressive `Load more` and `Return to top`; do not use numbered pagination.
- On compact screens, downward list scrolling retracts the title and search/sort
  controls. A short upward scroll reveals them before the list reaches the top.
- Reduced motion removes the movement without changing visibility behavior.

## Recipe Cards

Each recipe uses the shared animated collapse and starts closed.

The closed header shows:

- recipe name;
- total calories when supported by the saved data;
- one neutral overall goal-match percentage built from every goal with nutrient
  evidence. Deficits and overages both lower the result instead of cancelling out.

The expanded body shows:

- creation date and ingredient count;
- up to eight compact ingredient pills using category symbols rather than product
  photos;
- pills packed into bounded rows so no label leaves the card;
- a disclosure for the remaining ingredients instead of an inner scrolling list;
- every supported goal percentage, omitting nutrients with no reported or derived
  evidence rather than displaying zero;
- one dominant Load action plus compact Share and confirmed Delete actions.

Loading a recipe restores its selected nutrients, goals, foods, serving amounts, and
units, routes missing Fridge items to Shopping List when possible, and then navigates to
Mix. Loading or deleting shows focused pending and error states. Delete uses the shared
two-step confirmation.

## Empty And Loading States

Use the quiet open-page presentation and shared circular icon framing established by
Ingredients. Do not wrap simple loading, no-results, or empty-library copy in an extra
bordered card. A filtered empty state clears the search; an empty library routes to Mix.
