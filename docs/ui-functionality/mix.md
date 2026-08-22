# Mix

Route: `/mix`

Mix combines selected foods, amount and serving controls, explicit nutrient goals, the
nutrient shape, warnings, practical adjustments, contribution details, and recipe
saving.

## Routes And Page State

Meaningful overlays and modes use child routes with shallow history so the Mix stays
mounted:

- `/mix/save`
- `/mix/options`
- `/mix/reorganize`
- `/mix/reset-goals`
- `/mix/clear-ingredients`
- `/mix/reset-all`
- `/mix/warnings/{warningId}`
- `/mix/ingredients/{foodId}/conversion-details`
- `/mix/ingredients/filters`
- `/mix/goals/presets/save`
- `/mix/goals/presets/{templateId}/delete`

An unfinished, account-scoped Mix draft may survive navigation through the approved
temporary-state boundary. Durable goals, section preferences, and saved recipes remain
database-owned.

## Header

- Show `Mix`, friendly supporting copy, unsaved/loaded state, one circular options
  action, and one circular save action.
- On compact phones and short screens, only the main Mix scroll surface controls header
  retraction. Downward scrolling hides it; a short upward scroll reveals it before the
  page reaches the top.
- Scrolling inside Add Ingredients or Selected Ingredients never changes header
  visibility.
- Wider layouts keep the header visible. Reduced motion removes the transition without
  changing the visibility state.

## Section Organization

Every visible top-level section uses the shared animated collapse. The normal order is
stored with stable section identifiers, never visible labels.

- `Warnings`, `Suggested adjustments`, and `What is driving this shape` default closed.
- Other established sections default open unless the account has saved another state.
- Later open/closed choices persist across sessions.
- Empty conditional warning, suggestion, and contribution sections stay absent from the
  normal view.
- A closed section occupies only the shared summary height and boundary. Body padding
  appears only while expanded.
- Warning severity belongs to the complete Warnings section boundary: yellow for low
  severity and red when any high-severity warning exists. The summary still carries
  non-color urgency text.

`Reorganize` in the options sheet opens the route-backed organizer:

- Replace each body with one compact header row and show every supported section.
- Pointer and touch users drag from a dedicated handle. The active row follows the
  pointer freely and keeps capture during fast movement; sibling rows move aside only
  when the active row's center crosses them.
- Keyboard users reorder with Arrow Up, Arrow Down, Home, and End. Visible move-up and
  move-down controls remain available.
- Announce the new position in one polite live region.
- Save only a complete validated set. Failed saves keep the user in organize mode with
  useful feedback.
- Append newly introduced sections to older saved orders.
- Reduced motion keeps all reordering controls functional without sibling animation.

## Loaded Recipe State

When a Saved Recipe is loaded:

- show its name;
- disable Save until something changes;
- never mutate the stored recipe until the user explicitly saves;
- support Save as new and Overwrite existing;
- enforce recipe-name uniqueness per account;
- clear or reset actions detach the loaded recipe before starting over.

If a loaded recipe contains foods no longer in Fridge, route missing items to Shopping
List when possible and explain any item that cannot be restored.

## Shared Quantity Formatting

Every Mix section uses one unit-aware formatter:

- retain reported zero;
- show nonzero values below `0.001` as `<0.001` rather than zero;
- use one precision rule for the same nutrient and unit everywhere;
- display the canonical unit with the value;
- keep calculation precision separate from display rounding.

## Nutrient Goals

- Start with the reviewed default vital nutrients.
- Let users search the complete DB-backed nutrient catalog without rendering one giant
  raw list.
- A nutrient joins the active goal set only when a reviewed default supplies its target
  or the user enters an explicit target. A unit-wide or invented generic target is not
  valid.
- Removing or adding a nutrient updates goals, the nutrient shape, warnings,
  suggestions, contributions, and Saved Recipe state together.
- Each goal has one meaning: exact target, at least, at most, or range. Every evaluation
  uses that same meaning.
- Show the nutrient name, current amount, goal rule, editable target and unit, one
  synchronized range control, and one circular remove action without repeating the same
  value in multiple controls.
- Slider changes provide quick adjustment; the numeric input preserves exact entry.
- Keep labels and controls readable at compact widths and 200% text zoom.

### Goal Presets

Goal presets are DB-backed, versioned, and immutable after review.

- System presets include the current reviewed Balanced, High Protein, Low Sugar,
  Calorie Dense, and Fiber Focused templates.
- Selecting a preset shows its plain-language description and target preview, including
  units.
- Applying a preset copies a snapshot into the user's active goals. Later template
  revisions do not silently change that Mix.
- Applying replaces the active set by default. `Keep my other goals` retains nutrients
  not defined by the selected preset.
- Successful Apply closes the preview while keeping the selected preset name visible.
  Failure leaves the preview open with actionable feedback.
- Users may save and delete private reusable presets. Deleting a preset does not remove
  goals already copied into a Mix.
- Direct goal changes and preset application use authoritative authenticated RPCs;
  browser storage is not a fallback.

## Nutrient Shape

The nutrient shape remains a prominent summary, not a health score.

Render three layers:

1. the containing boundary;
2. one dotted goal outline;
3. the current Mix shape.

The containing boundary stays visually distinct from the interior grid. The dotted goal
outline is a unit-safe target silhouette: each configured nutrient target is divided by
that same nutrient's reviewed target in the active default template, then all resulting
values are normalized by the largest configured-goal ratio. The highest relative goal
therefore touches the containing boundary and the remaining points preserve the shape
of the user's goals. If a tracked nutrient has no reviewed default, its own configured
target is its reference rather than borrowing a value from another nutrient or unit.
The goal outline is equilateral only when every configured target is proportionally
identical to its same-nutrient reviewed reference.

The current Mix uses the same per-nutrient references and the same shared scale. A
current point meets the dotted point exactly when its measured amount reaches that
configured goal. Values above the visible boundary remain communicated through point
color, status summaries, warnings, and the accessible chart description rather than
rescaling the target silhouette. Changing ingredients or amounts must never reshape,
resize, or otherwise alter the goal outline; only a goal change may do that. Never
compare raw kcal, gram, milligram, or other incompatible goal amounts directly.

The shape uses one point as a circle, two as a thick line, three as a triangle, and more
as a polygon. Goal and current values respond immediately to goal, food, and amount
changes. Each point keeps its own under/near/over status color; lines and fill blend the
connected statuses.

The Nutrient Shape summary may show one quiet, DB-backed secondary line for a reviewed
non-safety state such as all tracked goals being met, a very small or large total
serving, or an intentionally simple water/ice recipe. Composition messages outrank goal
and serving messages, and the lowest-priority matching row wins. Any danger warning
suppresses the line completely; jokes never alter math or appear inside Warnings.
When the account allows Playful messages, an eligible reviewed goal-match row may
replace the standard line. Saving a recipe may likewise show one quiet reviewed line in
the Mix header until the next edit. Both remain absent when the preference is off, and
no texture or viscosity state is guessed from serving amounts.

Assign axes deterministically by label space so long names use the wider top and bottom
positions. Keep each nutrient's value, goal, status, and accessible summary attached
when its axis moves. Labels must remain readable at all supported point counts. At
compact width or height, keep nutrient names but hide the tiny value line; exact values
remain in status summaries and accessible text.

## Add Ingredients

- Switch between Fridge and Shopping List with the shared animated segmented control.
- Use one full-width search control and one adjacent filter/sort trigger. The routed
  filter sheet owns Show and Sort choices.
- Use progressive `Load more` and `Return to top`; keep earlier results mounted.
- At either inner-scroll boundary, continued wheel or touch scrolling passes to the
  main Mix page instead of trapping the user.
- Use compact selectable cards with food identity, media, warning edge, and selection
  state. Category and private-custom status remain searchable but are not repeated as
  resting-card metadata or badges.
- The full card selects. The selection control remains a separate accessible state
  indicator and long text reserves its column.
- Do not show an edit action in this chooser.
- If Fridge and Shopping List are both empty, put Add Ingredients first, keep it open,
  and offer a clear route back to Ingredients.

## Selected Ingredients

- Show one amount card per selected food with identity, normalized gram amount, amount
  input, unit selector, details action, remove action, and conflict edge when needed.
- Do not repeat a gram value under the name when that same gram value is already the
  editable amount.
- Weight is primary. Volume is available only with explicit, evidence-backed conversion
  data; estimated conversion must remain clearly identified.
- Exact household servings remain selectable when a source reports their gram weight
  without a reusable unit conversion. The selector represents one complete reported
  serving, such as one medium banana at 118 grams; it must not invent a generic item,
  density, or volume unit.
- Nutrition math uses normalized per-100g values scaled by the selected gram amount.
- Use one identity row followed by one amount-control row on compact and wider layouts.
  Names, actions, units, and inputs must not compete for the same space.
- Step controls use the shared accelerating circular buttons and the numeric input uses
  the shared focus treatment.
- Keep complete preference wording in expanded details rather than crowding resting
  cards.
- Search and progressively load long selected-food lists. Show the total selected count
  once; show a filtered result count only while search narrows the list.
- At either inner-scroll boundary, continued wheel or touch scrolling passes to the
  main page.

## Warnings

Warnings are concise, evidence-based, and practical. Cover tracked-goal overages and
shortfalls, incomplete or estimated conversion data, and food-preference conflicts.

- Start closed when present and expose visible severity on the complete section.
- Expanded cards use the normal panel background with their border carrying severity.
- Keep one clear reason in the card and route detailed `Why` or reporting information
  through the shared disclosure/overlay pattern.
- Do not present missing evidence as safe or turn one provider's text into an unchecked
  client warning.

## Suggested Adjustments

Suggestions start closed and operate only on foods already selected in the Mix until
versioned recipe context and reviewed pairing evidence support trustworthy additions.

- Evaluate every explicit goal, not one nutrient in isolation.
- Recommend only changes that improve the overall Mix without worsening another tracked
  goal.
- Reject foods with incomplete relevant nutrition or a known preference conflict.
- Prefer source-reported serving increments. Otherwise use the reviewed Mix default
  amount; do not invent a precise quantity merely to hit one target.
- Combine increase and reduce suggestions without repeating the same food.
- Show concise impact information, one Apply action, and immediate Undo.
- Keep unsafe, incomplete, or goal-regressing candidates absent rather than asking the
  user to judge a recommendation already known to be unsuitable.

New-food suggestions remain disabled until the database owns versioned recipe context,
ingredient roles, reviewed pairing evidence, and outcome measurement. Never hardcode
taste pairings from names or categories in the client.

## Contribution Details

`What is driving this shape` starts closed. For each active nutrient, show the leading
food contributors, their amount, and their share of the total. Keep this explanation
compact and do not repeat warning wording.

## Save Review

- Open the route-backed review dialog from Save.
- Compare each current nutrient total with its goal and label the result honestly.
- Let the user name the recipe, save as new, overwrite the loaded recipe, cancel, or
  confirm despite goal differences.
- Validate duplicate names per account.
- Disable duplicate submissions and show a clear pending state.
- Preserve the Mix and dialog input after a recoverable failure.
