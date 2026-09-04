# Ingredients

Routes: `/ingredients/fridge` and `/ingredients/shopping`

Ingredients owns food discovery, barcode scanning, manual food entry, nutrition details,
and Fridge/Shopping List management. Its completed interaction and visual patterns are
the baseline for other views.

## Quick Navigation

| Flow                  | Sections                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Discover food         | [Page Controls](#page-controls), [Food Search](#food-search), [Barcode Scanning](#barcode-scanning), and [Search](#search) |
| Enter food manually   | [Manual Entry](#manual-entry)                                                                                              |
| Understand food       | [Nutrition Details](#nutrition-details) and [Food-Preference Results](#food-preference-results)                            |
| Manage lists          | [Fridge And Shopping List](#fridge-and-shopping-list)                                                                      |
| Verify the experience | [Responsive And Accessibility Checks](#responsive-and-accessibility-checks)                                                |

## Page Controls

- Keep the page title, short helper text, search, barcode action, filter action, and
  manual-entry action easy to find.
- Barcode scanning is the fastest packaged-food path and must not look secondary.
- On compact phones and short screens, deliberate downward list scrolling retracts the
  title and search/entry controls. A short upward scroll reveals them before the list
  reaches the top.
- At the compact tier, manual entry is a pencil-only rounded icon control in the same
  row as Search, Barcode, and Filters. The visual and keyboard order is Search, Barcode,
  Manual Entry, then Filters, and its accessible name remains complete.
- Above the compact width tier, Filters remains beside the complete Manual Entry action
  and stretches to the same rendered height so the second toolbar row stays level.
- The toolbar manual-entry control is the only page-level manual-entry action. Do not
  duplicate it with a floating add button.
- Keep Fridge/Shopping List tabs available. Compact visual pills still provide at least
  a `44px` combined target.
- Wider layouts keep the complete page controls visible.

## Food Search

- Search inherits its destination from the route that opened it: Fridge search places
  food in Fridge, and Shopping List search places food in Shopping List.
- A result outside both lists offers an explicit Add action for the destination. A
  result in the other list offers an explicit Move action. A result already in the
  destination shows that membership and offers no duplicate placement action.
- Adding or moving a result keeps search open and updates list membership immediately.
  Opening the card remains the separate path to Nutrition Details.
- Fridge and Shopping List membership remains exclusive throughout search placement;
  never instruct users to open another view merely to complete a known list move.

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

An exact provider match does not remove the evidence step when that provider cannot
populate the canonical catalog. If the user opts to share that product, the Share step
requires front-package, nutrition-label, and barcode photos before submission.

Front-package evidence becomes usable as soon as the file is selected. Automatic card
placement is optional background assistance: it uses one bounded, downscaled recognition
pass, never enlarges the source photo, stops after a short time limit, and provides an
immediate Stop action. It must not disable Share-step scrolling, evidence inputs,
placement controls, navigation, or submission. Replacing the photo, editing placement,
leaving the surface, or completing the submission cancels unfinished recognition and
late results never replace the user's newer choice.

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
- after accepted barcode autofill, label nutrient groups with returned values `From
barcode` and source-empty groups `Not provided`. Keep source omissions blank and
  explain that users may enter only values the package actually reports; do not present
  every barcode-backed nutrient group as optional or imply that identity supplies
  nutrients the source omitted;
- use the searchable DB-backed category picker when no canonical category is known;
- show the shared spinner inside the barcode input as soon as a complete valid barcode
  queues a lookup, keep it visible through the request, and block forward navigation
  until that lookup settles;
- claim one submit lock before the final barcode confirmation begins, keep that lock
  through the authoritative save, and recover with editable input after failure;
- allow destination choice between Fridge and Shopping List;
- default shared-catalog submission on only for complete, valid, unchanged exact-source
  data whose represented sources all permit canonical storage. Keep an immediate
  opt-out, and turn sharing off whenever the user enters values, edits imported facts,
  or selects private evidence until they explicitly enable it again;
- prepare a bounded display copy of each newly chosen product image in a dedicated
  browser worker without mounting the full-resolution source or blocking another
  interaction; keep the source selection intact, show preparation status until the
  complete frame is ready, and do not
  start OCR until the user selects `Place automatically`; when requested, frame the
  image only when OCR confidently matches its product or brand text, while keeping the
  exact card preview, manual controls, retry, and restore available before submission;
  use the photo's stored orientation and a bounded analysis copy, with the visible
  Rotate control handling sideways package art without an expensive automatic
  orientation pass;
- before a catalog submission, prepare front-package, nutrition-label, and barcode
  upload copies one at a time in a worker so mobile image decoding cannot compete for
  memory; accept JPEG, PNG, and WebP sources only up to 20 MB and 40 megapixels, retain
  the largest detail budget for nutrition text, keep the combined multipart request
  below the deployment boundary, and let the server independently validate and
  normalize every result before private storage; show each selected input as
  `Preparing photo`, `Ready`, `Uploading`, `Uploaded`, or `Needs attention`, use real
  uploaded-byte progress when available, and never manufacture a percentage;
- keep expected OCR progress and engine chatter out of the error console; a genuine
  failure records one privacy-safe phase and reason code while leaving the complete
  image and manual controls usable;
- close the form after a successful add instead of opening another blank form;
- when an exact saved barcode matches a current shared product but meaningful entered
  package data differs, keep the existing list item and accepted catalog revision
  unchanged while offering one explicit `Update and share` correction with current
  front-package, nutrition-label, and barcode evidence; unchanged entries remain
  `Already saved`, cancellation changes nothing, and repeat submissions against the
  same revision remain deduplicated by the server;
- confirm cross-list moves inside the Share step rather than opening a nested dialog;
  name both the current and destination lists, focus Cancel first, keep Cancel and Move
  visible at compact heights, and change list membership exactly once only after Move;
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
- Search real stored metadata as well as names. Direct product-name matches rank first,
  followed by brand or responsible organization, category, and supporting package or
  ingredient metadata. Partial fragments follow the same field order across canonical
  and alternate names, brands, categories, package and serving descriptions, structured
  ingredients, explicit allergen and precautionary statements, labels, markets, and
  retained source identifiers. Linked active official safety notices may supply an
  organization match without rewriting the product's canonical brand.
- Require every query word for the first result set. If that set is empty, use a wider
  partial-word fallback and keep those weaker matches below complete matches; never
  maintain hardcoded company or spelling correction lists.
- Keep saved/private results available when an external provider fails.
- Support keyboard result navigation and a separate Add action whose priority is higher
  than the card's nutrition/details action.
- Use progressive `Load more` and `Return to top`; never auto-load merely because the
  user reached the end.
- After a completed nonempty query returns no matches, show a quiet informational
  notice that repeats the query and suggests other searchable food fields. Do not show
  the notice before the request completes, while loading, or in place of an error.
- Show names, useful category or brand context, image or category symbol, actionable
  verification state, completeness state, and warning frame when available.
- Search filters can show only results with current preference or public-health warnings,
  or only results in an active recall. Recall results remain separate from the broader
  warning set and filtering occurs before result pagination.
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

- Default to an exact household, count, or package measure when one can display every
  nutrient without guessing. A verified `2 cups (100g)` measure therefore appears as
  `2 cups (100g)`, while 100g alone never creates an invented cup conversion. Offer a
  100g basis only when exact mass data or a measured conversion supports it.
- When a serving has a household label and weight, display the household label first
  and grams in trailing parentheses. Preserve native volume and count labels such as
  `30mL`, `1 cookie`, `2 crackers`, or `1 bottle` when no gram weight is reported.
- Never present 100g as a package serving unless the source reports it.
- Never infer density from food name, category, provider, or a water-like default.

Nutrition Facts behavior:

- Keep the main label readable on compact screens.
- Preserve primary calories, fat, carbohydrate, fiber, sugars, and protein rows.
- Hide zero-valued secondary nutrients while retaining meaningful primary zeroes.
- Scale values from the exact nutrient basis that matches the selected weight, volume,
  or source serving. Cross-dimension scaling requires a measured relationship;
  presentation rounding never changes the calculation.
- Keep source and basis visible without exposing provider errors or internal mapping
  terminology.

Official safety-notice behavior:

- An exact or moderator-confirmed active FDA/FSIS match takes visual priority over a
  preference warning without replacing it.
- The compact card edge is danger red for that current official notice and amber for an
  ordinary dietary or preference conflict.
- Show the official classification, reason, source attribution, source link, and
  package-check instruction. Keep lot, package, and date wording exact when available.
- Never describe an absent match as safe, expose a probable match before moderation,
  or present the notice as medical advice.
- Put the compact danger summary in the primary reading path. Its explicit details
  action opens an app-standard information modal containing the complete official
  notice. Every notice in that modal owns its direct issuing-agency link; multiple
  recalls never share one ambiguous destination.
- Recall-information modals use list-preserving paths such as
  `/ingredients/fridge/manual-entry/recall-notice` and
  `/ingredients/fridge/nutrition/123/recall-notice`. Dismissal and browser Back return
  to the underlying Manual Entry or Nutrition Details state without resetting it.
- Compact cards retain the danger edge and accessible warning text without adding a
  source-link control. Activating the card opens Nutrition details, where the same
  warning-to-summary-to-official-source path is available.

Supporting disclosures appear together at the bottom, in this order when present:

1. `Review these warnings`;
2. `Ingredient details`;
3. food-check details;
4. `Food passport`, containing the current record status, available catalog history,
   information-coverage summary, `Product details`, Data quality, correction, and
   missing-warning tools;
5. moderator image placement.

All supporting disclosures start closed. The closed Food passport shows only its title
and a bounded status such as `Verified`, `Shared record`, `Personal`, or `Unverified`.
Opening it may show database-backed verification dates, accepted revision identity,
label-observation dates, and a concise inventory of available information. Missing
passport information remains `Not provided`; it never means zero, none, allergen-free,
or safe. Technical source, quality, and reporting details remain nested and closed so a
user can ignore them. Supporting disclosures must not interrupt Ingredients,
`Contains`, `May contain`, dietary labels, dietary considerations, current recalls, or
current personalized warnings. Privileged controls stay last and are absent for
ordinary users. Opening or closing a disclosure must preserve the current scroll
position.

## Food-Preference Results

The server returns one result for the current account and food:

- `conflict`: reviewed evidence conflicts with at least one active preference;
- `checked`: the active policy covers every active setting and required evidence is
  available, with no conflict found in that information;
- `incomplete`: settings were applied but evidence or policy coverage is missing;
- `not_checked`: no active settings were applied.

No state is a safety guarantee. A card warning frame means `conflict`; no frame does not
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
  return-to-top controls. The shared filter sheet can show all items, items with current
  preference or public-health warnings, or items in an active recall. Safety filtering
  uses current server-annotated DB evidence before pagination so counts and pages stay
  accurate.
- The requested list is server-rendered for first paint. The inactive list and
  overlay-only supporting data load during idle time or on demand, while counts remain
  accurate and every food shown to the user retains current server-owned safety
  evaluation.
- Closed routed sheets, dialogs, scanners, and detail views stay outside the initial
  Fridge JavaScript and CSS graph. Opening one loads the shared popin bundle, with an
  accessible loading status if that network boundary is observable.
- Explicit Load more paints its busy state before list retrieval or reflow begins and
  records a bounded interaction diagnostic without changing pagination semantics.
- The full card performs its primary open/select action. Trailing move, options, and
  delete controls remain separate and take priority.
- Long-press enters selection mode and selects the held card. Selection remains visible
  without permanent checkboxes in ordinary mode.
- Bulk moves are atomic. Selected cards leave together with the established staggered
  direction animation, then remaining cards close the gaps smoothly.
- Fridge and Shopping List membership is exclusive; a move cannot leave duplicate
  copies in both lists.
- Cards show the accepted image or centered category symbol with the shared media lane,
  warning frame, title, category, and actionable status without exposing provider rank.
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
