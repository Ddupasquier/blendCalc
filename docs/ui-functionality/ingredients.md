# Ingredients

Routes: `/ingredients/fridge` and `/ingredients/shopping`

Ingredients owns food discovery, barcode scanning, manual food entry, nutrition details,
and Fridge/Shopping List management. Its completed interaction and visual patterns are
the baseline for other views.

## Page Controls

- Keep the page title, short helper text, search, barcode action, filter action, and
  manual-entry action easy to find.
- Barcode scanning is the fastest packaged-food path and must not look secondary.
- On compact phones and short screens, deliberate downward list scrolling retracts the
  title and search/entry controls. A short upward scroll reveals them before the list
  reaches the top.
- At the compact tier, manual entry is a pencil-only rounded icon control in the same
  row as Search, Barcode, and Filters. Its accessible name remains complete.
- The toolbar manual-entry control is the only page-level manual-entry action. Do not
  duplicate it with a floating add button.
- Keep Fridge/Shopping List tabs available. Compact visual pills still provide at least
  a `44px` combined target.
- Wider layouts keep the complete page controls visible.

## Barcode Scanning

- Open the shared scanner dialog and show a clear camera, loading, cancel, and close
  path.
- Use the browser-native detector when available and the supported scanner fallback
  otherwise.
- Look up the normalized identifier immediately after a valid scan.
- While a scanned identifier is being resolved, replace the pre-share summary,
  validation, and source result area with one announced shared-spinner status. Keep
  `Share with community` visible but disabled until the check finishes so the form
  never appears frozen or prematurely shareable.
- On success, fill the review form and move focus to the next required decision.
- On failure or incomplete data, preserve the user's work and offer manual completion.
- Never leave the user in an error-only state.

Preserve every source-supported field that the application can legally retain:

- barcode/GTIN and format;
- product name, brand, category, package amount, labels, market, and language;
- serving label, gram weight, and evidence-backed volume equivalent;
- all reported nutrients and their units, basis, status, and provenance;
- ingredient text, structured ingredients, additives, explicit allergens, traces, and
  dietary metadata;
- product image source, licence, attribution, role, and approved placement;
- source record identifiers, dates, quality metadata, confidence, and field lineage;
- private package, nutrition-label, and barcode evidence when moderation requires it.

Sparse labels remain honest. A nutrient omitted from an alcohol, kombucha, exempt, or
otherwise limited package disclosure stays unknown; it never becomes reported zero or
an estimated value. Users may save the available facts and complete only fields the
package actually reports. Reviewed database-backed disclosure profiles select the
applicable completeness behavior instead of assuming every packaged product follows the
same label requirements. Regulated alcohol labels require an explicit package ABV;
case-specific and unknown contexts remain reviewable rather than being declared
complete.

A moderator-approved rotation corrects both detailed and card images. Card crop, zoom,
and position remain card-only placement.

## Manual Entry

Manual entry stays closed until the user chooses it. Its route-backed form preserves
unfinished state until the user closes or completes it.

Required behavior:

- collect food name, optional brand, category, DB-reviewed package-label context,
  source-backed serving data, reported nutrition, optional extended nutrients, and
  available ingredient/allergen metadata;
- select package-label context on Servings before nutrition validation. Standard labels
  retain required serving and nutrient fields. Reviewed alcohol, kombucha, exempt, and
  case-specific profiles allow legal omissions to remain unknown; regulated alcohol
  still requires the explicit package ABV;
- keep a provider's technical per-100g normalization basis internal when no package
  serving was reported. Never display it as a package serving, and require an exact gram
  serving before normalizing any new user-entered nutrient value;
- keep volume conversion off unless an exact source or the user supplies both weight
  and volume;
- validate the current step only after a forward attempt through Continue or the step
  progress control;
- accept explicit reported zero without treating an empty field as zero;
- use the searchable DB-backed category picker when no canonical category is known;
- show the shared spinner inside the barcode input as soon as a complete valid barcode
  queues a lookup, keep it visible through the request, and block forward navigation
  until that lookup settles;
- allow destination choice between Fridge and Shopping List;
- offer shared-catalog submission only for eligible, explicitly shared product data;
- automatically orient and frame each newly chosen product image when OCR confidently
  matches its product or brand text, while keeping the exact card preview, manual
  controls, retry, and restore available before submission;
- close the form after a successful add instead of opening another blank form;
- after a successful add, an applicable reviewed food-symbol trigger may add one quiet
  broad-audience line beneath the factual outcome; unknown foods simply omit it;
- reuse an existing matching private food rather than ending in a duplicate-name error;
- keep private saving available after detaching a barcode that belongs to a different
  product.

## Search

Search combines the user's foods, the blendCalc catalog, and eligible external or
imported generic-food sources through the server-owned search flow.

- Search and manual entry do not compete for attention; starting search closes the
  manual-entry launcher state.
- Exact linked noncatalog records resolve useful fields and nutrients independently;
  similarly named foods remain separate, and a canonical catalog match remains the
  untouched result until accepted evidence creates a revision. A deliberately private,
  unmatched user food also remains separate even if a retained identifier resembles a
  provider record.
- Rank with current food-preference conflicts, data completeness, and name relevance
  without turning a provider name into blanket trust.
- Keep saved/private results available when an external provider fails.
- Support keyboard result navigation and a separate Add action whose priority is higher
  than the card's nutrition/details action.
- Use progressive `Load more` and `Return to top`; never auto-load merely because the
  user reached the end.
- Show names, useful category or brand context, image or category symbol, actionable
  verification state, completeness state, and warning edge when available.
- Keep provider hierarchy badges off compact cards. Private custom classification may
  support filtering and details but does not create a resting-card badge or border.
- Product details preserve all complete source and licence attributions represented by
  merged search data instead of showing only one provider notice.
- Long text reserves the trailing action column and never overlaps its control.

## Nutrition Details

The nutrition view is the food deep dive. Keep the first reading path focused on:

1. canonical food identity and image;
2. a current exact or confirmed official recall notice when present;
3. current personalized warnings;
4. Nutrition Facts and serving selection;
5. ingredient text;
6. explicit `Contains` and `May contain` statements;
7. source-backed dietary labels and considerations;
8. Fridge/Shopping actions when applicable.

Display all useful accepted data without guessing or showing empty sections:

- canonical product name rather than a personal rename;
- brand, barcode, format, category, package quantity, labels, market, and food type;
- every normalized serving and its origin, source measure, gram-weight method,
  calculation basis, and confidence;
- ingredients, structured ingredient percentages only when reported, nested paths,
  additives, source analysis, explicit allergens, and precautionary statements;
- vitamins, minerals, fatty acids, and every other available normalized nutrient;
- field-level sources, source dates and versions, attribution, and licence links;
- bounded completeness, uncertainty, mapping, multi-source, and obsolescence notes.

Serving behavior:

- Default to a primary reported serving when one exists; always keep the honest 100g
  basis available.
- When a serving has a household label and weight, display the household label first
  and grams in trailing parentheses.
- Never present 100g as a package serving unless the source reports it.
- Never infer density from food name, category, provider, or a water-like default.

Nutrition Facts behavior:

- Keep the main label readable on compact screens.
- Preserve primary calories, fat, carbohydrate, fiber, sugars, and protein rows.
- Hide zero-valued secondary nutrients while retaining meaningful primary zeroes.
- Scale values from normalized per-100g data with the selected gram amount; presentation
  rounding never changes the calculation.
- Keep source and basis visible without exposing provider errors or internal mapping
  terminology.

Official safety-notice behavior:

- An exact or moderator-confirmed active FDA/FSIS match takes visual priority over a
  preference warning without replacing it.
- Show the official classification, reason, source attribution, source link, and
  package-check instruction. Keep lot, package, and date wording exact when available.
- Never describe an absent match as safe, expose a probable match before moderation,
  or present the notice as medical advice.
- Put the compact danger summary in the primary reading path and the complete official
  notice in the bottom disclosure area.

Supporting disclosures appear together at the bottom, in this order when present:

1. official safety-notice details;
2. `Review these warnings`;
3. `Ingredient details`;
4. food-check details;
5. `More about this food`, containing `Product details`, Data quality, correction, and
   missing-warning tools;
6. moderator image placement.

All supporting disclosures start closed. They must not interrupt Ingredients,
`Contains`, `May contain`, dietary labels, or dietary considerations. Privileged
controls stay last and are absent for ordinary users. Opening or closing a disclosure
must preserve the current scroll position.

## Food-Preference Results

The server returns one result for the current account and food:

- `conflict`: reviewed evidence conflicts with at least one active preference;
- `checked`: the active policy covers every active setting and required evidence is
  available, with no conflict found in that information;
- `incomplete`: settings were applied but evidence or policy coverage is missing;
- `not_checked`: no active settings were applied.

No state is a safety guarantee. A card warning edge means `conflict`; no edge does not
mean `checked`. Product names, brands, and categories never provide packaged-food
allergen evidence.

When a DB-backed regulated-alcohol disclosure profile applies, including when an
explicit positive ABV resolves that profile for an older record, and ingredient,
allergen, or cross-contact evidence is missing, Nutrition details show one explicit
alcohol-label gap warning even when the account has no saved food preferences. The
warning explains that federal alcohol-label rules may omit major-allergen disclosure,
identifies the unverified safety details, and directs the user to the current package
and manufacturer. Missing evidence remains `unknown`; it never creates a false
allergen-free claim or a compact-card conflict edge. Explicit package declarations
continue through the normal personalized warning path.

When warnings exist, show short plain-language reasons near the main content. Put exact
source text, policy context, and reporting actions in `Review these warnings`. Do not
repeat a generic conflict message when specific reasons are already present.

When an applicable saved preference has an exact reviewed mapping, `More about this
food` may offer `Missing a food warning?`. The report accepts one resolved setting, a
short explanation, optional package date, and optional current-label photo. It stays
private, is idempotent while pending, and does not change product data immediately.

Products with a barcode may offer `Report incorrect information`. The routed correction
sheet starts from the current canonical record, requires current package evidence, and
creates no duplicate private food or list item. The active catalog record remains
unchanged until review.

## Fridge And Shopping List

Both lists share the same card and list behavior:

- Search, filtering, DB-backed sorting, visible result count, progressive loading, and
  return-to-top controls.
- The full card performs its primary open/select action. Trailing move, options, and
  delete controls remain separate and take priority.
- Long-press enters selection mode and selects the held card. Selection remains visible
  without permanent checkboxes in ordinary mode.
- Bulk moves are atomic. Selected cards leave together with the established staggered
  direction animation, then remaining cards close the gaps smoothly.
- Fridge and Shopping List membership is exclusive; a move cannot leave duplicate
  copies in both lists.
- Cards show the accepted image or centered category symbol with the shared media lane,
  warning edge, title, category, and actionable status without exposing provider rank.
- Missing-image symbols come from the shared database catalog. A reviewed category
  selects the broad symbol family, then the canonical food name may select a more
  specific symbol only inside that family. Recognizable prepared forms such as pizza,
  curry, or a sandwich may override the family because the prepared form is what users
  recognize. Missing or untrusted categories use bounded food-name rules before the
  honest generic fallback; Ingredients, search, Mix, and Saved do not maintain separate
  symbol guesses.
- The shared fallback catalog covers common ingredients and recognizable prepared-food
  forms across produce, proteins, seafood, drinks, pantry foods, meals, and desserts.
  Compound foods use the recognizable final form rather than an incidental ingredient.
- User renames remain personal. Nutrition details continue to show the canonical food
  name.
- Remove uses the shared two-step confirmation. Rename and item actions use the shared
  routed overlays.
- A truly empty Fridge may show one optional DB-backed meal-prep line beneath the normal
  empty-state guidance. Shopping, filtered-empty, error, and safety states retain only
  their factual copy.

## Responsive And Accessibility Checks

- No nutrient column, image, name, badge, or action may leave the card or page bounds.
- Compact controls remain readable and operable at the shared minimum target size.
- Focus outlines remain visible inside nested scrollers and sheet chrome.
- Scanner, picker, dialog, and sheet focus enters, stays contained, and returns to the
  opener.
- Reduced motion keeps every state change and action functional without relying on the
  animation.
