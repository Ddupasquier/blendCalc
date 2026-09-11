# Google Discovery Strategy

This document defines how blendCalc can earn durable, unpaid discovery across Google
Search, Google Discover, and Google Play. It owns the channel strategy, readiness gates,
measurement model, and experiment order. It does not promise rankings or featuring, and
it does not replace the public-site, Android-release, privacy, or product contracts that
own implementation.

| Read this for...                        | Go to                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------- |
| The decision and current readiness      | [Executive Decision](#executive-decision)                               |
| What each Google surface requires       | [Channel Matrix](#channel-matrix)                                       |
| The first 30, 60, and 90 days           | [Prioritized Roadmap](#prioritized-roadmap)                             |
| Public content and trust standards      | [People-First Content Plan](#people-first-content-plan)                 |
| Play Store copy and creative            | [Play Store Asset Plan](#play-store-asset-plan)                         |
| Measurement and experiments             | [Measurement](#measurement-and-privacy) and [Experiments](#experiments) |
| What not to do                          | [Prohibited Shortcuts](#prohibited-shortcuts)                           |
| Existing owners and proposed follow-ups | [Delivery Map](#delivery-map)                                           |

## Executive Decision

blendCalc should pursue Google discovery in this order:

1. **Become eligible and measurable.** Verify the `blendcalc.food` domain in Search
   Console, finish the Play organization-account checks, publish a small indexable public
   site with legal and trust information, and keep private application routes out of the
   index.
2. **Ship something genuinely useful.** Publish the real Android client through internal
   testing and create a public knowledge surface that answers food-awareness questions
   with original explanations, named sources, review dates, and clear safety limits.
3. **Earn distribution through quality.** Use honest Play assets, reliable app behavior,
   responsive public pages, and helpful content. Google explicitly treats app quality,
   user experience, technical quality, and store-listing quality as discovery inputs; it
   does not offer a shortcut to featuring.[^play-discovery][^android-quality]
4. **Experiment only after a baseline exists.** Compare one meaningful change at a time,
   keep it only when Search Console or Play Console shows a durable improvement, and stop
   producing a content type or creative direction that does not help users.

This sequence is important. As audited on September 9, 2026, Google Search returned no
blendCalc result for the brand or `site:blendcalc.food`; the blendCalc Google account had
no Search Console website property; Play Console had no app record and would not allow
one until the organization account completed identity, website, and phone verification.
The production site exposed one indexable landing page but no sitemap, structured data,
public privacy or deletion page, or Android Digital Asset Links file. The current Android
bundle remained a placeholder shell. Promotion before those foundations would have
nothing complete to promote.

## Current-State Audit

The baseline below combines production HTTP observations, repository inspection, and
read-only console inspection on September 9, 2026.

| Area                       | Evidence                                                                                                                        | Readiness                                     | Consequence                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary origin             | `https://blendcalc.food/` permanently redirects to `https://www.blendcalc.food/`; the page self-canonicalizes to the `www` URL  | Sound                                         | Use `https://www.blendcalc.food` consistently in sitemaps, metadata, Search Console URL-prefix views, and links                                                                       |
| Public page                | The signed-out root has a descriptive title, description, one heading, product benefits, and a sign-in call to action           | Partial                                       | It explains the product briefly but does not yet establish enough public value, trust, or crawlable depth for non-brand discovery                                                     |
| Crawl controls             | `/robots.txt` allows crawling but names no sitemap; `/sitemap.xml` redirects to the landing page                                | Not ready                                     | Google has no maintained public URL inventory                                                                                                                                         |
| Index controls             | Most authenticated and authentication routes inherit indexable global metadata; only moderation routes explicitly use `noindex` | Not ready                                     | Login and thin/private route URLs can compete with the intended public surface or appear as low-value results                                                                         |
| Structured data            | No JSON-LD is present                                                                                                           | Not ready                                     | Google receives no explicit organization identity; rich-result markup must wait for matching visible public content                                                                   |
| Preview imagery            | A 1200 × 630 social preview is declared in Open Graph and Twitter metadata                                                      | Useful base                                   | Reuse the visual direction, but public editorial pages should have their own relevant, crawlable lead images                                                                          |
| Page experience            | Production uses HTTPS, responsive server-rendered HTML, Vercel Analytics, and Speed Insights                                    | Promising, unbaselined                        | Search Console Core Web Vitals field data and public-page route metrics still need to be established                                                                                  |
| Search Console             | Neither the owner account nor the blendCalc account showed a blendCalc website property                                         | Blocked                                       | Index coverage, search queries, crawl errors, manual actions, Discover data, and sitemap status cannot be managed yet                                                                 |
| Play account               | An Organization account exists, but identity, website, and phone verification remain incomplete                                 | Blocked                                       | Play Console disables creating the first app                                                                                                                                          |
| Play app                   | No app record exists                                                                                                            | Not ready                                     | There is no store listing, internal release, vitals baseline, acquisition report, or review history                                                                                   |
| Android client             | Package `food.blendcalc` builds, but the bundled client is still a placeholder and has debug logging enabled                    | Not ready                                     | Do not publish or market the current bundle                                                                                                                                           |
| Android App Links          | The manifest has no verified web-link intent filter and the website does not serve `/.well-known/assetlinks.json`               | Not ready                                     | Web URLs cannot securely open corresponding app destinations                                                                                                                          |
| Public trust/legal surface | `/privacy`, `/terms`, and `/account-deletion` are not public routes                                                             | Launch blocker for Play, trust gap for Search | Play requires accurate privacy and deletion disclosures for the planned account-creating app; public claims also lack an obvious policy and provenance destination[^account-deletion] |

## Channel Matrix

Scores use **High / Medium / Low** for user value and confidence. Effort is a relative
blendCalc estimate, not a vendor quote. Learning windows start only after eligibility,
enough impressions, and stable measurement.

| Surface and user intent                                                                                                  | Eligibility                                                                                                                                     | Current readiness and exact gap                                                                                           | Recommended work and owner                                                                                                                                                                                                                          | Measurement and learning window                                                                                                                              | Cost, risk, and stop condition                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Branded Google Search** — a user already knows blendCalc and wants the official site                                   | A crawlable, indexable canonical page that meets Search Essentials                                                                              | **Low.** One public page exists, but no Search Console property, sitemap, organization markup, or observed branded result | **Owner:** verify a domain property. **Engineering:** discovery foundation. **Public site:** clear brand/about/support/legal identity                                                                                                               | Search Console branded impressions, clicks, CTR, indexed canonical; review after 2–6 weeks                                                                   | **Value/confidence:** High/High. **Effort:** Low. **Risk:** conflicting identities or indexing login URLs. **Stop:** never stop maintaining the official result; remove tactics that create duplicate or misleading pages                                                |
| **Non-brand Google Search** — a user asks how to understand labels, servings, recalls, allergens, or organize food       | Helpful public pages that Google can crawl and index; compliance with Search and spam policies                                                  | **Low.** The authenticated product contains expertise, but no crawlable public answer library exists                      | **Content owner + qualified reviewers:** publish a small evidence-backed knowledge library. **Engineering:** templates, metadata, sitemap, internal links, accessible responsive rendering                                                          | Non-brand queries, impressions, clicks, CTR, indexed pages, landing-to-sign-up activation; 8–12 weeks per content cluster                                    | **Value/confidence:** High/Medium. **Effort:** Medium–High. **Risk:** health/safety overclaiming or thin search-first copy. **Stop:** pause a cluster after two substantive iterations and 90 days with no qualified impressions, useful referrals, or direct-user value |
| **Google Discover** — a user encounters timely, personally relevant food-awareness content                               | Content must be indexed and meet Discover policies; no special tag or schema guarantees inclusion[^discover]                                    | **None today.** No public editorial content, Search Console Discover data, or page-specific large imagery                 | **Content:** occasional timely explainers with original value, transparent dates, sources, and non-sensational headings. **Engineering:** allow large previews and provide relevant high-quality images                                             | Discover report appears only after sufficient data; impressions, clicks, CTR, engaged sessions; assess over 12+ weeks, not daily                             | **Value/confidence:** Medium/Low. **Effort:** Medium. **Risk:** chasing volatility, clickbait, or unsafe urgency. **Stop:** do not make Discover a quota; stop formats that require sensationalism or do not retain users                                                |
| **Google Images and visual Search surfaces** — a user recognizes a package, label concept, or food-workflow illustration | Crawlable image landing pages, descriptive context, stable image URLs, accessible alt text                                                      | **Low.** A social preview exists but there are no public subject pages or image-specific context                          | **Content/design:** original diagrams and product-workflow imagery only where it materially teaches. **Engineering:** image metadata, dimensions, performance, sitemap support when scale warrants it                                               | Search Console image-search impressions/clicks and downstream activation; 8–12 weeks                                                                         | **Value/confidence:** Medium/Medium. **Effort:** Medium. **Risk:** licensing/attribution or decorative image churn. **Stop:** no bulk image pages and no unlicensed package imagery                                                                                      |
| **Google Play branded search** — a user searches for blendCalc or a direct food-awareness app                            | A published, policy-compliant app and complete listing                                                                                          | **Blocked.** Account verification is incomplete; app record and real client do not exist                                  | **Owner:** complete account checks. **DEV-071:** real client, policy declarations, signed internal release, then controlled production. **Design/content:** accurate listing assets                                                                 | Play store impressions/visitors, unique install clicks, acquisitions, activation, retention; baseline after 28 days of production traffic[^play-acquisition] | **Value/confidence:** High/High once shipped. **Effort:** High. **Risk:** submitting placeholder/incomplete claims. **Stop:** do not publish until the exact Play-delivered build passes physical-device and policy verification                                         |
| **Google Play category/search recommendations** — a user browses for pantry, nutrition, or food-information tools        | Relevant app, truthful listing, sustained user value, policy compliance, and acceptable technical quality                                       | **Blocked.** No app, listing, user metrics, reviews, or Android vitals                                                    | **Product/engineering:** solve core use cases reliably. **Growth:** choose the most accurate category/tags, describe outcomes plainly, and localize only after product support exists                                                               | Query/source-level listing traffic, CTR, install/open clicks, acquisition, activation, 7/30-day retention, uninstall rate, peer benchmarks; 28–56 days       | **Value/confidence:** High/Medium. **Effort:** High. **Risk:** keyword stuffing, false category fit, low retention. **Stop:** revert listing variants that reduce qualified activation or retention despite increasing clicks                                            |
| **Play editorial featuring and promotional surfaces** — Google considers the app for broader placement                   | High app quality and, for promotional content, feature-specific eligibility; selection remains discretionary[^play-promo]                       | **None today.** No production app or quality history                                                                      | **Product:** differentiated core value. **Engineering:** strong vitals and adaptive UX. **Growth:** keep external marketing enabled, maintain current high-quality assets, and use promotional content only for real launches or meaningful updates | Featuring/referral surfaces in Play reports, acquisitions, retention, vitals; evaluate each event over its eligible window                                   | **Value/confidence:** Medium/Low. **Effort:** High. **Risk:** planning around discretionary placement. **Stop:** never build a roadmap dependent on being featured                                                                                                       |
| **Android App Links from Search/web/email** — a user opens an eligible public URL in the installed app                   | Matching HTTPS routes, `android:autoVerify`, valid Digital Asset Links with the Play signing certificate, and native route handling[^app-links] | **Not ready.** No matching public content routes, manifest filters, signing fingerprint, or asset file                    | **DEV-071 + public-site owner:** add only after route and signing contracts settle; verify with Play/ADB tools                                                                                                                                      | Verified-domain state, open success/failure, destination completion, web fallback; test every release and review after 30 days                               | **Value/confidence:** Medium/High. **Effort:** Medium. **Risk:** redirect/host mismatch or overly broad interception. **Stop:** remove any path that cannot reliably open the exact supported destination                                                                |

## Prioritized Roadmap

The roadmap is dependency-ordered. “Day 30” does not mean publishing unfinished work to
meet a calendar promise.

### Days 0–30 — Establish eligibility and trust

1. The owner completes Play Console identity, website, and phone verification. Do not
   upload the placeholder Android bundle.
2. The owner adds and verifies the **Domain property** `blendcalc.food` in Search Console
   using DNS, which covers protocols and subdomains.[^search-console-property]
3. Engineering implements the web discovery foundation:
   - expose a valid root sitemap containing only intended public canonical URLs;
   - name the sitemap in `robots.txt`;
   - make public-page canonical, title, description, image, and robots directives explicit;
   - apply `noindex` to auth, callback, account, application, API, and privileged routes;
   - add accurate `Organization` JSON-LD to the visible organization/brand surface;
   - verify HTTP status and redirect behavior for every listed URL.
4. Promote the existing public landing-page work into the before-launch sequence. Add an
   About/trust section, support path, data-source explanation, safety boundary, privacy
   notice, terms, and account-deletion resource. Legal text must be reviewed by its actual
   owner; engineering documentation is not public legal advice.
5. Submit the sitemap in Search Console, inspect the canonical landing page, request its
   indexing once, and record the baseline. Repeated indexing requests are not a growth
   strategy.
6. Define the first three public questions from real tester confusion or support needs.
   Draft no page until it has a user problem, an evidence set, a reviewer, and a distinct
   useful outcome.

**Day-30 gate:** Search Console is verified, the intended public URLs return `200`, the
sitemap validates, private/thin routes are excluded, public policies are live, and Play
account verification no longer blocks creating the app record.

### Days 31–60 — Ship credible product and content

1. Advance DEV-071 through the real authenticated client and Play internal testing. Use
   screenshots only from the exact supported build.
2. Publish the first small knowledge set. Prefer three excellent pages over a calendar of
   thin posts. Each page must satisfy the editorial contract below.
3. Build the Play listing around one promise: **organize the food you use and understand
   the available nutrition, warning, and source context.** Avoid language implying that
   blendCalc diagnoses, guarantees safety, or replaces official recall notices.
4. Establish weekly Search Console and Play Console review, but make decisions on the
   stated learning windows rather than short-term noise.
5. Once signing and supported public routes are stable, implement and end-to-end verify
   Android App Links for only those routes.

**Day-60 gate:** the internal Play build provides the advertised journeys, store assets
match the build, the first public pages pass factual/safety/editorial review, and both
Search and Play measurements have named owners.

### Days 61–90 — Learn without gaming the systems

1. Release through the controlled Play path only after the separate release gates pass.
2. Run one store-listing experiment if the app has enough eligible traffic for Play
   Console to estimate a meaningful result.[^play-experiments]
3. Improve one public content cluster from observed queries and user outcomes. Expand it
   only if the next page answers a genuinely different question.
4. Publish at most one timely Discover candidate when there is a real event or material
   product update that blendCalc can explain better than a generic news rewrite.
5. Review cohorts by acquisition source: qualified activation and retention outrank raw
   impressions, clicks, installs, or ranking anecdotes.
6. Write the next 90-day plan from observed evidence. Continue, change, or stop every
   experiment explicitly.

**Day-90 gate:** blendCalc has a reliable branded result or a documented indexing cause;
non-brand impressions have a credible baseline; the Play funnel has quality and retention
data; and no active tactic depends on policy manipulation, unsupported claims, or content
volume for its own sake.

## Technical Recommendations

### Public URL and indexing contract

- Maintain one canonical public origin: `https://www.blendcalc.food`.
- Return real `404` responses for nonexistent public files and pages. A redirect from a
  missing sitemap or legal URL to the landing page hides configuration errors and can
  look like a soft 404.
- Put only index-worthy public pages in the sitemap. Google recommends absolute canonical
  URLs and a root-level sitemap; inclusion remains a hint, not an indexing guarantee.[^sitemap]
- Let crawlers fetch pages that carry `noindex`; blocking them in `robots.txt` can prevent
  Google from seeing the directive.[^noindex][^robots]
- Keep account-specific state, query strings, callbacks, internal search, and private
  overlays out of canonical URLs and the sitemap.
- Server-render the unique title, description, heading, visible copy, canonical, robots
  directive, and relevant image metadata for every public page.
- Add `max-image-preview:large` only where blendCalc is willing to let Google use the
  page's relevant high-quality image in large previews.

### Structured data

Start narrowly:

1. Use `Organization` on the main public identity page with only visible, verifiable
   properties: name, canonical URL, logo, and maintained contact details. Google says
   this can help disambiguate the organization, not guarantee a knowledge panel.[^organization]
2. Do not add Recipe, Product, FAQ, Article, or SoftwareApplication markup merely because
   schema.org defines it. Add a Google-supported type only when the visible page satisfies
   its content and policy requirements.
3. Keep JSON-LD synchronized with visible content and test it with Google's Rich Results
   Test where the type is eligible. Valid markup does not guarantee a rich result.[^structured-data]

### Android and web association

- Use the final Play app-signing certificate fingerprint, not only the debug or upload
  key, in `assetlinks.json`.
- Serve `https://www.blendcalc.food/.well-known/assetlinks.json` directly over HTTPS with
  valid JSON and no redirect.
- Declare `android:autoVerify="true"` only for owned hosts and supported path families.
- Preserve a useful web fallback for users without the app.
- Test clean install, update, signed Play build, link routing, cancellation, and every
  supported destination. A verified host alone does not prove application routing.

### Page and app quality

- Continue measuring real-user Largest Contentful Paint, Interaction to Next Paint, and
  Cumulative Layout Shift. Google's good-experience targets are LCP within 2.5 seconds,
  INP under 200 milliseconds, and CLS under 0.1.[^core-web-vitals]
- Treat these as experience thresholds, not a ranking scorecard. Regressions on the public
  landing/content templates should block release.
- After Play release, monitor user-perceived crashes and ANRs, slow startup, permissions,
  and device reach. Core vitals affect Play visibility.[^android-vitals]
- Optimize for successful first use and repeat value. Play's own quality guidance warns
  that acquisition alone is not a reliable measure of core value.[^core-value]

## People-First Content Plan

Google recommends original, complete, trustworthy content created for people rather than
mass-produced search-first pages.[^helpful-content] That aligns with blendCalc's safety
needs.

### Audience and content jobs

| Content family            | User question                                                                          | Original blendCalc value                                                                               | Safety boundary                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Food organization         | “How do I keep a useful fridge and shopping list without duplicating food?”            | Explain a concrete workflow using the product's real Fridge, Shopping List, and barcode behaviors      | Do not imply storage duration or food safety unless an authoritative reviewed source supports it |
| Nutrition and servings    | “Why do two labels show different serving bases?”                                      | Explain per-serving versus per-100-unit comparisons and what blendCalc can and cannot normalize        | No personalized medical, weight-loss, or treatment recommendation                                |
| Allergens and preferences | “What is the difference between contains, may contain, and my own preference warning?” | Explain evidence strength, label wording, user preferences, and uncertainty                            | Never convert missing evidence into “safe” or “free from”                                        |
| Food recalls              | “How can I tell whether a recall applies to the package I have?”                       | Explain barcode/product identity, source dates, official notice links, and blendCalc's matching limits | Direct urgent decisions to official notices; never promise completeness or real-time coverage    |
| Product data provenance   | “Where did this product fact come from?”                                               | Show source, observation, review, revision, and conflict concepts in plain language                    | Respect provider licences, image rights, private evidence, and publication holds                 |

### Required editorial record

Every public knowledge page needs:

- one explicit user question and an answer that stands alone without opening the app;
- a named author or responsible organization and, for safety-sensitive material, a named
  qualified reviewer or a clear statement of the review boundary;
- primary sources linked beside the claims they support;
- published and materially reviewed dates, with no artificial freshness changes;
- an explanation of what blendCalc observes, infers, and cannot determine;
- accessible headings, descriptive images, readable tables, and a useful mobile layout;
- a contextual product call to action only after the question has been answered;
- a correction/contact path and a scheduled evidence review appropriate to the subject.

Do not generate individual ingredient or product pages at scale until each page has
unique public value, legally publishable evidence, a canonical lifecycle, and meaningful
quality control. Database cardinality is not a content strategy.

## Play Store Asset Plan

Google uses listing quality as part of the pre-install experience and may reuse eligible
assets across Play surfaces.[^play-assets] The listing must set the same expectation the
installed build fulfills.

### Proposed listing narrative

- **App name:** `blendCalc`
- **Positioning:** a food-awareness workspace for organizing food and reviewing available
  nutrition, recall, allergen, preference, and source context.
- **Primary screenshot story:** add food → organize Fridge and Shopping List → review
  nutrition and warnings → combine and save.
- **Trust story:** sources and uncertainty are visible; no “safe,” “healthy,” diagnostic,
  or guaranteed-recall claims.

### Required creative set

1. High-resolution Play icon derived from the approved app mark, tested at small size and
   without ranking, price, or call-to-action text.
2. Feature graphic with one clear product idea, generous safe space, and no unsupported
   accolades.
3. At least two phone screenshots; prepare a coherent sequence of four to six from the
   real Play candidate so users can understand the main journey without reading the full
   description.
4. A short description that leads with the user outcome, not a keyword list.
5. A full description organized around supported workflows, evidence limits, privacy,
   and accessibility.
6. Tablet assets only after the app has been directly verified and is genuinely useful
   at those sizes.
7. A preview video only when it can show a stable, high-value journey better than the
   screenshots. It is not a before-launch requirement.

Google currently requires a feature graphic and at least two qualifying screenshots for
the store listing, and applies detailed size and content rules in Play Console.[^play-assets]
Check the live requirements again immediately before upload.

### Review and ratings policy

- Ask for an honest review only after a successful meaningful action and allow dismissal.
- Never pay for, gate functionality on, or otherwise incentivize ratings, reviews, or
  installs.[^ratings]
- Respond to reviews with specific help and fix recurring product problems.
- Track rating themes alongside activation, retention, crashes, and support issues; a
  higher star count is not useful if the underlying experience degrades.

## Measurement And Privacy

### Measurement hierarchy

| Layer         | Metric                                                                                                 | Why it matters                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Eligibility   | verified property, sitemap success, indexed canonical pages, Play policy/app status                    | Shows whether the channel can operate at all                  |
| Discovery     | branded/non-brand impressions, Discover impressions, Play listing impressions and visitors             | Shows whether Google is exposing blendCalc                    |
| Choice        | Search CTR, Play unique install/open clicks, store listing CTR                                         | Shows whether the result or listing sets a useful expectation |
| Product value | sign-up/start rate, first food added, first organized list, first reviewed detail, first saved mix     | Shows whether discovered users reach the promised value       |
| Durable value | 7/30-day retention, uninstall/user-loss rate, recurring supported action, support rate                 | Prevents optimizing for empty clicks or installs              |
| Quality       | Core Web Vitals, crashes, ANRs, startup, permission failure, accessibility and task-completion defects | Protects eligibility and user trust                           |

Search Console should be the authority for Google Search and Discover impressions,
queries, pages, clicks, and CTR. Play Console should be the authority for store traffic,
clicks, acquisitions, retention, ratings, device reach, and Android vitals. Vercel's
privacy-safe route analytics may measure the public-page funnel, but it must not become a
shadow source for search queries or user profiling.

### Privacy rules

- Use aggregate channel and campaign dimensions; do not store full referrer URLs, search
  queries, email addresses, barcodes, food searches, or account identifiers in growth
  events.
- Keep advertising identifiers out of the initial organic-discovery plan.
- Allowlist campaign codes and discard arbitrary query parameters before analytics.
- Do not join Search Console query rows to identified user accounts.
- Apply minimum cohort sizes before reporting segmented retention.
- Document metric definitions, time zone, attribution window, and material reporting
  changes. Google changed Play listing performance toward click intent in July 2026, so
  old acquisition assumptions must not be silently carried forward.[^play-acquisition]

## Experiments

Run the smallest test that can answer one decision.

| Experiment                    | Hypothesis and change                                                                                                       | Primary decision metric                          | Guardrail                                            | Minimum decision window                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| Branded-result foundation     | A verified property, correct canonical, sitemap, and clear organization identity allow Google to discover the official site | indexed canonical plus branded impressions       | no private/auth URLs indexed                         | 2–6 weeks after successful fetch                   |
| First public question cluster | Three independently useful, evidence-backed pages earn qualified non-brand impressions and activation                       | non-brand impressions and engaged sign-up starts | corrections, bounce/quick return, safety review      | 8–12 weeks                                         |
| Play screenshot sequence      | Outcome-first screenshots help qualified users choose the app                                                               | unique install clicks and downstream activation  | retention and uninstall rate may not worsen          | Play Console's estimated sample; normally 28+ days |
| Play short description        | Plain user-outcome copy attracts more relevant visitors than feature enumeration                                            | listing CTR plus activation                      | no increase in immediate uninstall/support confusion | Play Console's estimated sample                    |
| Timely public explainer       | A genuinely useful, source-led explanation of a major relevant change may reach Discover                                    | Discover impressions and engaged sessions        | no sensational title or unsupported urgency          | 12 weeks; zero exposure is an acceptable result    |

Change one material variable at a time. Pre-register the hypothesis, audience, metric,
guardrail, and stop condition. Do not call an inconclusive result a win.

## Prohibited Shortcuts

blendCalc will not:

- buy or exchange links, reviews, installs, ratings, or engagement;
- reward a positive review or make access depend on a review;
- create doorway pages, hidden text, keyword variants, fake locations, or duplicate pages;
- mass-produce generic food, recipe, nutrition, or recall copy to fill a publishing quota;
- rewrite official notices without original user value and clear source attribution;
- manufacture author expertise, endorsements, testimonials, usage, freshness, or awards;
- add structured data for content not visible on the page;
- conceal sponsorships or affiliate relationships;
- imply that indexing, schema validity, policy compliance, or a high Lighthouse score
  guarantees ranking, recommendation, or editorial featuring;
- use medical, allergen-free, “safe,” or real-time/comprehensive recall claims that the
  product and evidence cannot support.

Google's spam policies prohibit practices intended to manipulate ranking, while its
people-first guidance explicitly warns against producing content mainly for search
traffic.[^spam][^helpful-content]

## Delivery Map

| Work                                                                                                                                     | Existing owner                                                                            | Decision or completion condition                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete Play account checks, create the app, build the real client, policy declarations, signed internal testing, physical-device proof | `DEV-071 — Deliver The Authenticated Android Client Through Google Play Internal Testing` | Keep one owner; do not create a separate Play-launch ticket                                                                                   |
| Build the signed-out public surface and approved visual system                                                                           | `DEV-055 — Create A Public Landing Page`                                                  | Owner should approve moving it from post-launch/future planning into the before-launch sequence and expand it to the trust/legal entry points |
| Define account deletion and retention, expose the in-app and public request paths                                                        | DEV-071 already requires the behavior; `NOTE-FUTURE-011` is private planning only         | Promote or replace the personal note only through an explicit owner decision; do not duplicate implementation                                 |
| Search Console, sitemap, indexing boundaries, public metadata, organization identity, and regression coverage                            | `DEV-073 — Establish The Public Google Search Foundation`                                 | Implement as one focused engineering ticket; the duplicate review is complete                                                                 |
| Public knowledge library, editorial workflow, and first approved content set                                                             | Proposed child of DEV-055 after the owner approves this strategy                          | Define the actual first user questions and reviewers before ticketing production volume                                                       |
| Android App Links                                                                                                                        | DEV-071                                                                                   | Implement only after final signing identity and public route contracts exist                                                                  |

## Sources

The guidance was reviewed against the following first-party Google sources on September
9, 2026. Requirements can change; recheck the live source at each release or experiment.

[^search-console-property]: Google Search Console, [Add a website property](https://support.google.com/webmasters/answer/34592) and [Getting started with Search Console](https://support.google.com/webmasters/answer/10267942).

[^sitemap]: Google Search Central, [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and Search Console, [Sitemaps report](https://support.google.com/webmasters/answer/7451001).

[^noindex]: Google Search Central, [Block Search indexing with `noindex`](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

[^robots]: Google Search Central, [Introduction to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

[^organization]: Google Search Central, [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization).

[^structured-data]: Google Search Central, [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

[^core-web-vitals]: Google Search Central, [Understanding Core Web Vitals and Google Search results](https://developers.google.com/search/docs/appearance/core-web-vitals).

[^helpful-content]: Google Search Central, [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

[^spam]: Google Search Central, [Spam policies for Google web search](https://developers.google.com/search/docs/essentials/spam-policies).

[^discover]: Google Search Central, [Discover and your website](https://developers.google.com/search/docs/appearance/google-discover).

[^play-discovery]: Google Play Console Help, [App discovery and ranking](https://support.google.com/googleplay/android-developer/answer/9958766) and [Get discovered on Google Play Search](https://support.google.com/googleplay/android-developer/answer/4448378).

[^android-quality]: Android Developers, [App quality](https://developer.android.com/quality) and [What a great user experience looks like](https://developer.android.com/quality/user-experience).

[^core-value]: Android Developers, [What great core value looks like](https://developer.android.com/quality/core-value) and [User metrics on Google Play](https://developer.android.com/quality/core-value/user-metrics).

[^android-vitals]: Google Play Console Help, [Monitor technical quality with Android vitals](https://support.google.com/googleplay/android-developer/answer/9844486).

[^play-assets]: Google Play Console Help, [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151) and [Best practices for your store listing](https://support.google.com/googleplay/android-developer/answer/13393723).

[^play-acquisition]: Google Play Console Help, [Understand and grow your app's user base](https://support.google.com/googleplay/android-developer/answer/9859173).

[^play-experiments]: Google Play Console Help, [Run A/B tests on your store listing](https://support.google.com/googleplay/android-developer/answer/12053285).

[^play-promo]: Google Play Console Help, [Understand promotional content](https://support.google.com/googleplay/android-developer/answer/12929029).

[^ratings]: Google Play Console Help, [User ratings, reviews, and installs](https://support.google.com/googleplay/android-developer/answer/9898684).

[^account-deletion]: Google Play Console Help, [App account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) and [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

[^app-links]: Android Developers, [About Android App Links](https://developer.android.com/training/app-links/about), [Verify App Links](https://developer.android.com/training/app-links/verify-applinks), and [Troubleshoot App Links](https://developer.android.com/training/app-links/troubleshoot).
