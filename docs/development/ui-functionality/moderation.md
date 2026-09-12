# Moderation

Routes: the Profile gateway at `/profile/privileged-tools`, focused privileged views
under `/profile/privileged-tools/*`, and the legacy compatibility redirects
`/moderation` and `/moderation/data-health`.

Only authorized moderators, administrators, and developers may enter these views. Role,
account-control, and notification rules live in [Moderation](../moderation.md).

## Quick Navigation

| Responsibility         | Sections                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Account decisions      | [Account Review](#account-review)                                                                                                     |
| Product decisions      | [Catalog Submission Review](#catalog-submission-review) and [Catalog Review And Data Operations](#catalog-review-and-data-operations) |
| Safety feedback        | [Food Warning Review And Follow-Up](#food-warning-review-and-follow-up)                                                               |
| Reported profile media | [Profile Image Report Review](#profile-image-report-review)                                                                           |

The elevated-role-only Profile launcher uses the verified role title and links to the
full-page `/profile/privileged-tools` landing dashboard. That dashboard contains only
destinations granted by the role's current `app_role_permissions` rows. Each destination opens a route-backed right sheet with
one focused responsibility: product submissions, food-warning reports, profile images,
account access, catalog review work, or data operations. Review work and data operations
appear under separate headings and only when the current database permission grants
them. Product submissions, the combined catalog-review decision queue, food-warning
reports, exact reported profile images, and deduplicated data-operation subjects expose
their real actionable counts. Account access remains unbadged because it is search-led,
not a pending queue. The launcher aggregate sums only those genuine actions without
double-counting. The focused route retains its own server and
database authorization, evidence, mutations, browser title, history entry, and direct-
load behavior. Nonzero queues appear once under **Needs attention**; zero-count and
search-led workspaces remain available as secondary links. The landing-page title and
each right-sheet heading own one crown without repeating the same visible label inside
their content.

The landing page is the sole home for cross-workspace diagnostics. Data operators see
the active shared-catalog total, public blendCalcAPI v1 total, shared-catalog-only total,
API publication coverage, monitoring status, source activity, dataset/licence state,
policy coverage, and broad diagnostic matches there. These signals never inflate action
badges and are not repeated inside focused workspaces.

Every focused right sheet follows the same reading order: the plain-language view
heading, current action feedback, one shared start card with the first step and
**Done when** condition, one bounded result summary, review records, supporting
evidence in closed shared disclosures, and the decision controls last. An adjacent
information button opens the shared contextual bottom sheet for that exact tool. It
explains the tool's purpose, review order, decision effect, and safety boundary without
adding permanent instructions to every record. The information sheet is contextual help,
not a second moderation workflow, and never exposes private evidence or internal codes.
Consequential decisions and public reasons start unselected. The final action remains
unavailable until every required choice and evidence note is complete, and nearby copy
states what the action changes, what it preserves, and where unfinished work goes.
Approve/confirm and reject/dismiss descriptions must each state both the immediate
system effect and what remains unchanged. They must distinguish closing a queue item
from downstream publication, notification, correction, access, or policy effects and
must not imply a user notification or automatic correction that the server does not
perform.

Above the shared `680px` mobile-content breakpoint, every focused privileged route
automatically uses the desktop workspace: its shared start card remains visible in a
bounded instruction rail while the queue, evidence, and decision controls use the
flexible work column. The landing page and focused tools use the same full-width desktop
canvas with a responsive side gutter that reaches `15rem` on large displays; focused
tools do not impose a second maximum width on the work column. Repeated queue,
destination, account, and diagnostic cards use content-sized responsive grids: a card
stops growing after `40rem`, and another column appears only when a complete `32rem`
card fits. Cards in each grid row share the tallest card's height so neighboring
surfaces and actions align. A single data comparison or correction workflow can remain wider when the
extra width communicates additional evidence. Empty queue states, decision-only forms,
safe-repair records, and repeated catalog-review records use the same readable bounds;
they do not become full-width merely because they are nested in a focused route.
Repeated diagnostic disclosures wrap at the same bounds but align to the start while
open so one expanded disclosure does not create empty height inside its neighbors. At
and below the breakpoint the exact
same content returns to one column in the established reading order. The responsive
switch preserves the current route, scrollable workspace, disclosure state, and entered
form values and never asks the operator to choose a device mode. This exception applies
only to privileged tools; ordinary right sheets remain capped to the standard app-shell
width.

Every route in the `/profile/privileged-tools` family also exposes desktop-only
**Product lookup** and **Delete product** toolbar actions above that same breakpoint,
including the privileged landing page. Focused workspaces keep the toolbar in the persistent left instruction
rail rather than competing with the app header or primary work column. It opens a
movable, non-modal inspector so the current form, disclosure
state, and unsaved values remain visible and untouched. The inspector can search the
active product data stored by blendCalc or request current provider evidence. Stored and
provider scopes are always named; provider results never silently replace or update the
approved catalog or record a moderation decision. Name lookup identifies its supported
provider, while an exact valid UPC/GTIN
queries the established packaged-product adapters and keeps their results separately
attributed.

An operator may designate one result as Product A and another as Product B. Comparison
shows identity, serving, and the union of reported nutrients. Nutrients are compared on
the same 100 g basis only when both records have exact conversion evidence. Differences,
one-sided missing values, and values that cannot be normalized safely have distinct
written statuses and visual treatments; the tool never treats an incompatible serving
basis as a numeric conflict. Matching fields are hidden initially but remain available
through an explicit control. Dragging is limited to the viewport, arrow keys can move
the inspector, Escape closes it, and closing restores focus to the toolbar action. At
`680px` and below the toolbar and inspector do not render as operable UI.

Delete product is restricted to MFA-verified data operators. It always starts with a
read-only exact-UPC preview and names the selected product and record families. Apply
requires a 10–1000 character reason plus retyping the normalized UPC. The destructive
copy explicitly states that approval permanently removes the catalog product,
submissions, revisions, evidence, moderation work, provider cache, and user list or
saved-mix copies; closing or declining changes nothing. A successful result reports the
database purge id and private Storage cleanup count. This tool is never available in
mobile privileged layouts.

If an additive moderation detail RPC is temporarily unavailable during a schema-first
rollout, the route must keep independently current readiness data usable and clearly
mark only the unavailable evidence detail. It must not turn an optional revision-detail
read into a whole-page 502, and it must tell reviewers not to close findings that depend
on the unavailable evidence.

The nutrient-mapping decision form shows compatible nutrient matches directly beneath
its search field with an announced result count. Search by canonical name, nutrient
number, or canonical ID narrows those choices without changing the current selection.
A zero-result query keeps the chosen nutrient intact and explains how to restore the
complete compatible list. If the suggested nutrient lacks a reviewed unit path, it is
not preselected and the form plainly requires another compatible choice or exclusion.

Product, warning, and reported-image queues use the shared moderator review-list and
review-card structure. Keep identity and the decision-relevant status in the card header,
keep a short fact summary in the primary reading path, and move package photos, raw
matching facts, long change lists, nutrient values, and report details into clearly named
shared disclosures. Decisions remain outside those disclosures so reviewers can find the
required action after reading the evidence.

## Account Review

- Show the viewer's current role.
- Search accounts by preferred/display name, email, user ID, role, or status.
- Keep each account closed by default. Its summary shows only the display name and
  current access status so moderators can scan the result list without reading every
  account field.
- Opening an account reveals its avatar when available, moderator-only email, role,
  image status, public block reason, cumulative moderator-rejected public submission
  count, and any active public-sharing suspension date.
- Keep the block form in a closed `Access controls` disclosure inside the opened account. Show
  `Restore access` directly only when the account is already blocked.
- Prevent self-moderation.
- Prevent moderators from acting on privileged accounts.
- Keep administrators and developers protected from the web blocking flow.
- Require a public reason when blocking and support restoring access.
- Send the bounded block notification without exposing internal notes.

## Catalog Submission Review

- Show product name, brand, barcode, source match, evidence completeness, conflict
  count, lookup failures, review flags, private evidence images, and nutrition details.
- Keep package photos, proposed changes, card-image placement, and full nutrition values
  in separate closed disclosures. Missing evidence and validation flags remain visible
  before the decision area.
- Require one unselected evidence decision before showing its matching action. Approval
  states that it publishes the reviewed values; rejection requires a useful correction
  note before its action is available.
- Preserve deterministic QA-fixture behavior in the disposable local environment.
- The 51st moderator rejection pauses public catalog sharing for six calendar months.
  Automated declines do not count, and private food tracking remains available.

## Food Warning Review And Follow-Up

- Exact incorrect-match disputes are dismissed before queue reads only when the active
  policy, current immutable product revision, and complete confirmed fact snapshot still
  match canonical evidence. The database stores an immutable system receipt. Reports
  about stale data, evidence type, missing warnings, changed revisions or policies,
  attached evidence, and ambiguous or mismatched facts remain pending.
- Pending reports remain the human decision queue. Each report requires one outcome and
  a concise internal note. Correction routing is required only when the user's report
  is correct; keeping current warning behavior records no follow-up automatically.
- Lead each report with two plain-language statements: what the user says is wrong and
  why blendCalc showed or omitted the warning. Present the stored facts as readable
  evidence with their source and confidence; raw identifiers and JSON remain secondary
  troubleshooting details, never the primary review experience.
- Summarize repeated facts by warning label and evidence source in the primary reading
  path. Keep raw fact rows and technical records in one closed Evidence details
  disclosure.
- Offer the two plain outcomes `The current warning is correct` and `The user's report
is correct`. Show correction routing only for the latter. Keep Save unavailable until
  an outcome and evidence note are present, plus a correction route when required.
- Confirmed reports with corrective work move into a separate `Follow-up work` list so
  completed review decisions do not look unfinished or disappear without an owner.
- The Profile launcher and page guide count pending reports plus open follow-ups. When
  only follow-ups remain, the queue stays enabled and leads with finishing that work
  instead of claiming the warning workspace is clear.
- Product corrections link to the shared product-readiness passport and show the exact
  affected field families. Policy and source cases identify the responsible work group.
- Product-correction follow-ups remain open until an evidence-backed correction creates
  an approved immutable revision. The UI must not imply that confirming a report already
  changed catalog data.
- `Open prefilled correction` carries the affected field families into the correction
  sheet so it asks only for relevant evidence. From a privileged product workspace, the
  sheet opens over that workspace without navigating through or rendering an Ingredients
  list route; closing it leaves the operator on the same review URL. Provider autofill is
  disabled for this entry point because the correction must preserve the reviewed
  identity and start from its canonical record. Existing canonical identity and eligible
  trusted images remain visible and attached. When reusable provider observations cover
  every finding, the sheet requests no duplicate photos. The server independently derives
  the required roles from the submitted differences and provider matches; the route hint
  is presentation only.
- Empty follow-up work renders nothing; it does not add a zero-state card beneath an
  already empty report queue.

## Profile Image Report Review

- Ordinary self-attested profile-image uploads are published without entering this
  queue.
- Show only exact current images with one or more pending user reports. Group multiple
  reports about the same image into one review card without exposing reporter identity.
- Keep the reported image visible while review is pending. A single report never hides
  or rejects an image automatically.
- Explain each report reason in plain language and preserve optional report details and
  dates as private moderation evidence.
- Keep the exact reported image visible while report reasons stay in one closed Report
  details disclosure.
- Require one explicit, initially unselected `Keep image` or `Remove image` decision and
  an evidence note before Save is available.
- `Keep image` dismisses every pending report for that exact image. `Remove image`
  clears only that exact current image and closes its reports. If the user already
  replaced the image, close the stale reports without affecting the replacement.
- User-facing report intake is deferred until a social surface intentionally displays
  another user's profile image.

## Catalog Review And Data Operations

`/profile/privileged-tools/catalog-review-work` contains possible recall matches,
material product conflicts, and provider changes in that priority order. These are
review decisions, not data health metrics. Its inbox groups the bounded decision set by
canonical product so each product and unique catalog UPC appears exactly once. Each
product row shows the total outstanding decisions and a written breakdown of recall,
conflict, and provider-change work; the path-backed product view contains every
individual decision and action for that product. Inside the product view, open the first
non-clear queue, label every queue badge as `to review` or `Clear`, and explain the
evidence decision at the start of each queue.
Recall decisions start unselected and cannot be saved without an evidence note.
Recall cards show why the match was proposed, including the exact product code or
brand/product/package agreement and whether package-code verification is required.
Provider observations show the earlier and newly observed value for every changed field.
Keeping the current record closes the provider observation and only the conflicts
created by that exact snapshot; supported provider evidence must continue through a
catalog correction. When a correction is linked, finish that submission instead of
recording a contradictory provider decision.

`/profile/privileged-tools/data-operations` starts with the exact deduplicated human-
action count and an exact named Required work list. It contains operator tasks only;
catalog/API coverage, automated monitoring, source activity, dataset/licence state,
food-warning policy coverage, publication gaps, nutrient-mapping gaps, and revision-audit
matches belong exclusively to the privileged-tools landing dashboard. Do not render product submissions, warning reports, provider-change
decisions, recall decisions, or catalog-conflict decisions in this workspace.
Its Profile badge counts each distinct affected subject once when that subject has one
or more open enabled `app_issue_codes` rows owned by `data_operations` that require a
current operator decision or repair. Historical revision-audit gaps remain in the
neutral Revision audit diagnostic even when the current product is API-ready; they do
not add required work. Informational metrics, disabled issue codes, and multiple open
issues on the same subject do not add extra actions. Required work uses that same grouped query, orders the most severe
subjects first, and shows every issue attached to each subject. A subject card must
provide either a direct focused-workflow link or a plain-language missing prerequisite;
it must never substitute a generic remainder count or imply that an unavailable action
can be completed in the app.

Import-enabled dataset findings link to
`/profile/privileged-tools/data-operations/datasets/[datasetKey]`. The focused sheet
names the exact release and missing canonical artifacts, shows existing evidence and
record counts, and explains why completion time and SHA-256 are required. An AAL2
administrator or developer with data-repair permission must confirm the stored release,
enter only missing evidence plus an HTTPS reference, and preview the result before
applying it. Apply remains unavailable until the preview proves the finding will clear
and a private note is present. Apply fills only missing `generic_food_datasets`
provenance, preserves release, licence, activation, and imported rows, then reruns the
owning health check and returns to the refreshed queue. Cancel leaves canonical data
and queue state unchanged. Already-complete, incomplete/no-change, invalid, stale,
unauthorized, and failed-recheck states remain explicit.

The legacy `/moderation` and `/moderation/data-health` routes redirect to the Profile
privileged-tools gateway so operators always enter the same role-aware workflow.
`/profile/privileged-tools/catalog-data-health` redirects to data operations during
rollout and owns no data or mutation logic.

Source activity uses the database-recorded lookup count for the selected bounded metric
window and lists the most-used source first. Equal lookup counts fall back to source name
so refreshes remain stable. API requests, cache hits, matches, errors, and response time
remain supporting metrics and do not silently alter the usage ranking.

Data operations is read-oriented at its workspace summary. Its product-specific route
may expose a bounded **Safe catalog repairs** disclosure only for issue codes whose
database contract names an approved repair handler. The first action is always a dry
run. Apply remains unavailable until that same AAL2 user has a current successful dry
run with at least one exact candidate. Repairs may connect current canonical values to
matching, legally reusable observations already stored by blendCalc, restore a missing
first revision from an exact approved submission or source observation, or rebuild
queryable change rows from an existing valid structured revision summary. They never
invent, replace, average, or infer product values or history. Unresolved items remain
unchanged and explain what evidence is missing. Review work owns only its explicit human
decisions. Never render raw provider payloads, private evidence paths, user identity
beyond the authorized account workflow, reviewer identity, or secrets.

Product-specific links open a path-backed nested right sheet:

- review work uses `/profile/privileged-tools/catalog-review-work/products/[productId]`;
- data operations uses `/profile/privileged-tools/data-operations/products/[productId]`.

Each server loader checks its own exact AAL2 permission. The Data Operations route
renders the full shared readiness passport and its repair controls only when the live
permission set includes `data_operations.catalog_health.repair`. The Catalog review
route instead renders one focused decision workbench so readiness diagnostics do not
appear to be duplicate catalog decisions. Its persistent desktop rail keeps product
identity, catalog availability, exact public-API status and withholding reasons visible;
revision and provenance diagnostics appear once as a grouped link to the owning Data
Operations record.

Each actionable field conflict appears exactly once in the Catalog review workbench.
The comparison identifies the stored value, current source, observation date, source
type, redistribution status, every competing provider value, and the absolute and
percentage difference. Nutrients use a common per-100-g basis and also show an automatic
per-serving conversion when an exact serving weight exists. The reviewer records one of
four outcomes for every field: keep the stored value, use a named provider observation,
enter another value with an exact evidence reference, or state that current evidence is
insufficient. Every outcome requires a field-specific private note and explains its
effect before submission.

One **Finish product review** action records the complete decision set atomically.
Keep-current closes only that conflict without changing the product. Replacement
decisions create one pending `catalog_correction` containing all selected changes; the
canonical product remains unchanged until a separate reviewer approves it. Approval
creates a revision and resolves the linked conflicts. Rejection leaves canonical data
unchanged and returns those conflicts to Catalog review. An insufficient-evidence
outcome removes only the exact unchanged evidence fingerprint from the actionable queue,
keeps the underlying conflict and API withholding state intact, and reopens
automatically when material evidence changes. After a successful finish the route opens
the next distinct product, or returns to the inbox when none remains. A pending
correction is shown once in the rail with a direct Product submissions link and cannot
create duplicate work.
The passport explicitly identifies itself as an evidence-and-status view. Every issue
has a `Do this now` panel that names the required workflow, states whether that action is
available on the current screen, and defines the observable condition that clears the
issue. Actionable issues appear before unavailable issues. The workspace guide states
the exact number operators can act on now and defines completion for the current screen
instead of describing every diagnostic as resolvable work. Issues are grouped into
public-API blockers and nonblocking catalog-evidence follow-ups, and every card states
its publication impact. Revision checks name the exact revision and the evidence sources
they inspect. When a safe repair is available, the issue links directly to its exact
repair control, scrolls that control fully into the visible sheet body, and moves keyboard
focus there. A dry run with no exact candidate is a stop state, not a retry loop: it tells
the operator to continue to the final product-review action and may be rerun only after
the stored evidence changes. The final action is enabled only after every available safe
check has returned no candidate. Before confirmation it states all four outcomes: the
product remains available inside blendCalc, remains withheld from public blendCalcAPI
v1, the exact current readiness snapshot leaves actionable queues, and changed evidence
automatically reopens the review. A private explanation of at least 10 characters is
required. Missing correction workflows remain clearly identified as unavailable; the
terminal outcome records `accepted_withheld` rather than implying that inspection fixed
or approved missing evidence. An already API-ready product never offers that withholding
action for internal diagnostics. Its separate final action records
`accepted_evidence_gap`, removes only the exact evidence follow-up from the queue, and
explicitly leaves product values, revision history, and public API availability unchanged.

The Revision and verification disclosure lists every stored revision newest-first and
states the exact difference from its predecessor in plain language, including the old
and new values. A revision number is never the only visible distinction. Reconstructable
historical gaps disappear from the work queue after their exact snapshot differences
are stored, and the database rejects truly identical future snapshots instead of asking
an operator to repeat the same check. A later legacy revision with no reconstructable
difference is labeled as unavailable history rather than being misidentified as an
initial revision or filled with invented old and new values. That label explicitly says
the gap does not affect the current product or its blendCalcAPI status.

Confirmed food-warning rule and source follow-ups use the focused nested route
`/profile/privileged-tools/food-warning-reports/follow-ups/[caseId]`. The screen shows
the original report, human-readable warning, complete readable fact snapshot, initial
review decision and note, policy, source, and owner before allowing a decision.
**Resolved** and **Dismissed** close the follow-up without mutating product, policy, or
source data; **Deferred** keeps it in the queue with a required named prerequisite.
Source-correction decisions additionally require the Data operations repair permission.
Every outcome requires a private evidence note and returns to the refreshed queue.
Direct navigation to a resolved or dismissed case renders a read-only completion receipt
with the retained evidence and notes, never another writable form.

Evidence coverage labels must distinguish completeness from provenance. `Existing
nutrient records with source evidence` describes only the nutrients already stored; it
does not imply that every nutrient required by the active publication profile exists.
Missing-required-nutrient cards resolve the database nutrient id to its canonical name
instead of displaying a generic product-information fallback.

Nutrient mapping gaps use a separate path-backed nested right sheet at
`/profile/privileged-tools/data-operations/nutrient-mappings/[mappingId]`. The summary
links only disabled candidates that are genuinely waiting for evidence. The sheet keeps
source identity and the current suggestion visible, puts explanatory evidence in a
closed shared disclosure, and uses the reusable searchable/select controls to offer
only database-returned nutrients with a reviewed compatible unit path. Approve requires
an evidence reference and review note; exclude requires a review note. Resolved work is
read-only and no longer appears in the summary queue.
The outcome starts unselected; the suggested nutrient and confidence are explicitly
described as clues rather than approval evidence, and the action remains unavailable
until the selected path is complete.
