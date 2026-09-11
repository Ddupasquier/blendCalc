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

The elevated-role-only Profile launcher uses the verified role title and opens one
compact bottom sheet containing only destinations granted by that role's current
`app_role_permissions` rows. Each destination opens a route-backed right sheet with
one focused responsibility: product submissions, food-warning reports, profile images,
account access, catalog review work, or data operations. Review work and data operations
appear under separate headings and only when the current database permission grants
them. Product submissions, the combined catalog-review decision queue, food-warning
reports, exact reported profile images, and deduplicated data-operation subjects expose
their real actionable counts. Account access remains unbadged because it is search-led,
not a pending queue. The launcher aggregate sums only those genuine actions without
double-counting. The focused route retains its own server and
database authorization, evidence, mutations, browser title, history entry, and direct-
load behavior. Pure queue rows remain visible and disabled at zero; standing account,
catalog-review, and permitted data-operation tools remain available. The bottom-sheet title and each right-sheet heading
own one crown without repeating the same visible label inside their content.

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

- Pending reports remain the decision queue. Each report requires one outcome, one
  bounded follow-up action, and a concise internal note.
- Lead each report with two plain-language statements: what the user says is wrong and
  why blendCalc showed or omitted the warning. Present the stored facts as readable
  evidence with their source and confidence; raw identifiers and JSON remain secondary
  troubleshooting details, never the primary review experience.
- Keep evidence open while the technical record stays closed. Number the three decision
  steps, start both selects without a chosen outcome, explain the effect of every
  follow-up option, and keep Save unavailable until the reviewer has deliberately chosen
  an outcome, chosen a compatible follow-up, and written an evidence note.
- When a report is dismissed, offer only no-follow-up or duplicate closure. Correction
  routes are available only when the report is confirmed, matching the database
  boundary and preventing an invalid outcome/follow-up combination.
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
review decisions, not data health metrics. Open the first non-clear queue, label every
queue badge as `to review` or `Clear`, explain the evidence decision at the start of
each queue, and route product-specific evidence to a path-backed product view.
Recall decisions start unselected and cannot be saved without an evidence note.
Recall cards show why the match was proposed, including the exact product code or
brand/product/package agreement and whether package-code verification is required.
Provider observations show the earlier and newly observed value for every changed field.
Keeping the current record closes the provider observation and only the conflicts
created by that exact snapshot; supported provider evidence must continue through a
catalog correction. When a correction is linked, finish that submission instead of
recording a contradictory provider decision.

`/profile/privileged-tools/data-operations` starts with the exact deduplicated human-
action count, an exact named Required work list, three explicitly named diagnostic checks, and
compact catalog-coverage facts. Publication readiness, nutrient identity, and revision
evidence use `match` wording because their broader results can overlap and do not add to
the red action total; their summary cards link directly to the first affected record.
Monitoring, source, dataset, and policy badges include their units or status so they
cannot be mistaken for task counts.
Keep automated monitoring, source activity, dataset/licence state, food-warning policy
coverage, blendCalcAPI publication gaps, nutrient mapping gaps, and revision gaps in closed
shared disclosures, except that the first non-clear action queue opens by default. Do not render product submissions, warning reports, provider-change
decisions, recall decisions, or catalog-conflict decisions in this workspace.
Its Profile badge counts each distinct affected subject once when that subject has one
or more open enabled `app_issue_codes` rows owned by `data_operations`. Informational
metrics, disabled issue codes, and multiple open issues on the same subject do not add
extra actions. Required work uses that same grouped query, orders the most severe
subjects first, and shows every issue attached to each subject. A subject card must
provide either a direct focused-workflow link or a plain-language missing prerequisite;
it must never substitute a generic remainder count or imply that an unavailable action
can be completed in the app.

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

Both routes render the shared product-readiness passport, but each server loader checks
its own exact AAL2 permission. Keep product identity and the three independent
availability states visible. Open current blocking issues by default. Keep revision,
evidence coverage, and API-publication details in closed shared disclosures so the
default view remains understandable. Only the data-operations route may render repair
controls, and only when the live permission set includes
`data_operations.catalog_health.repair`.
Both routes may render the shared **Correction workflow** handoff. It lists the exact
open conflict with the human-readable field or nutrient, reporting basis, separately
identified stored catalog value and provenance, and every competing source observation;
it also lists provider-change, warning-report, or readiness findings and opens the existing
prefilled catalog-correction form without changing stored data; and supplies an explicit
return link to the originating review. When a correction is already pending, the handoff
links to Product submissions and does not offer a duplicate. Its copy states that
approval creates a reviewed revision and rechecks the findings, while rejection keeps
the current product unchanged.
On the catalog-review route, an unlinked conflict with an identifiable stored value also
has an evidence-gated **Keep stored value and resolve conflict** outcome. It leaves the canonical product unchanged,
records the conflict and unused correction origin as terminal, and immediately
recalculates readiness. If the stored value cannot be identified, the shortcut is not
offered. A linked conflict must be finished through Product submissions.
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
