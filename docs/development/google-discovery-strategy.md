# Google Discovery Strategy

This document owns blendCalc’s organic discovery strategy, measurement boundaries and
experiment order. Public-site behavior, consumer policies and Android delivery retain
their own contracts. Discovery work does not promise rankings, Google approval or revenue.

## Quick Navigation

| Need                                   | Section                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Current scope and channel choices      | [Executive Decision](#executive-decision) and [Channel Matrix](#channel-matrix)                               |
| Public URLs and indexing               | [Public URL And Indexing Contract](#public-url-and-indexing-contract)                                         |
| Metrics and privacy boundaries         | [Measurement And Privacy](#measurement-and-privacy)                                                           |
| Order of work and deferred channels    | [Experiment Order](#experiment-order)                                                                         |
| Content quality and prohibited tactics | [Content And Trust Standards](#content-and-trust-standards) and [Prohibited Shortcuts](#prohibited-shortcuts) |

## Executive Decision

The approved direction is **web first**. Maintain the useful public recipe calculator
and its indexing foundation, learn whether people find and use it, and improve the
existing experience from that evidence. Android, paid promotion and a separate content
library remain deferred until the web MVP has real usage and the owner selects that work.
They are not consumer-MVP requirements.

Android delivery, a publishing calendar and growth experiments must not block the web
MVP. Do not publish a placeholder app or repeat completed console setup. An acquisition
recommendation does not create a launch requirement.

## Channel Matrix

| Channel                           | Current responsibility                                                                          | Measure                                                                       | Selection boundary                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Branded Google Search             | Keep the canonical public identity, calculator, policies and support links useful and crawlable | Indexed canonical pages, branded impressions, clicks and useful visits        | Maintain the existing foundation; investigate a concrete indexing problem before adding work |
| Non-brand Google Search           | Let the existing calculator and explanation answer a real recipe-label question                 | Relevant queries, impressions, clicks and evidence that visitors use the tool | Improve an observed problem; a content library is deferred                                   |
| Google Discover                   | Keep eligible public content honest and useful                                                  | Use the Discover report only if Google supplies data                          | No publishing quota, guaranteed exposure or separate launch prerequisite                     |
| Google Play and Android App Links | Retain the separate Android delivery responsibility                                             | Future store acquisition, activation, retention and technical quality         | Deferred; no account changes, app upload, signing or release is implied                      |
| Paid promotion                    | No current campaign                                                                             | Define cost and useful-user outcomes before any future experiment             | Deferred; requires a separate owner decision and spending authority                          |

Google describes Discover eligibility separately from actual appearance. Treat it as a
possible distribution source, not a dependable acquisition plan.[^discover]

## Public URL And Indexing Contract

- Use the canonical origin `https://www.blendcalc.food` consistently.
- Maintain the existing verified `blendcalc.food` Search Console property. Check its
  current access and evidence; do not add a duplicate property or repeat DNS verification.
- Keep only intended, index-worthy public canonical URLs in the sitemap and name that
  sitemap in `robots.txt`. Sitemap inclusion does not guarantee indexing.[^sitemap]
- Keep public titles, descriptions, headings and canonical metadata consistent with
  visible content. Preserve the working calculator and its original explanations.
- Keep authentication, private app state, internal APIs and account-specific overlays
  out of the public sitemap. Preserve server authorization independently of indexing.
- Allow crawlers to fetch pages carrying `noindex` so they can see the directive;
  `robots.txt` alone is not a privacy or authorization boundary.[^noindex]
- Keep public privacy, terms, operator identity and support links accurate. Do not reopen
  settled consumer-policy decisions merely to repeat this review.
- Use structured data only for visible, truthful content that meets the relevant
  Google requirements. Do not invent reviews, recipes, qualifications or product claims
  to obtain a richer result.[^structured-data]
- Inspect a demonstrated indexing problem before requesting another crawl. Avoid
  repeated submissions as a substitute for useful content and actual visitors.

Keep dated console observations in operational evidence; this guide owns the durable
strategy rather than a changing readiness baseline.

## Measurement And Privacy

Use Search Console for Search impressions, clicks, click-through rate, queries and
indexed pages. Record the property, reporting window, search type and available sample
with every comparison. Separate branded discovery from relevant non-brand discovery;
small or absent samples do not establish a trend.[^search-console]

Use existing aggregate application analytics and direct feedback to understand whether
visitors reach a useful outcome. Search visibility alone does not prove calculator use,
account activation, recipe reuse or retention. Do not invent those outcomes from clicks.

Use existing Speed Insights for real-user performance. Record device, hostname, window
and available p75 observations when the dashboard supplies them. No events means the
performance result is unknown, not zero or passing. First distinguish missing ingestion
from insufficient usage; neither automatically authorizes a paid upgrade or new tracking.
Synthetic checks and installed-browser observations do not substitute for field p75 data.

Preserve these privacy boundaries:

- Use aggregate, allowlisted dimensions. Do not add food searches, barcodes, account
  identifiers, email addresses or full referrer/query URLs to growth events.
- Do not join Search Console query rows to identified accounts.
- Keep advertising identifiers and new trackers outside this discovery plan.
- Apply existing cohort/privacy safeguards before reporting segmented user behavior.
- Record changed metric definitions and attribution windows rather than comparing
  incompatible numbers.

## Experiment Order

### Maintain The Existing Web Foundation

Review the existing property, sitemap, public calculator and private-route indexing
boundaries. Reuse valid engineering evidence and investigate only observed failures.
Google site review and advertising readiness remain separately owned; Search indexing
is not AdSense approval.

### Learn From Real Use

Use the already approved consumer-pilot plan when its existing dependencies are ready.
Look for actual confusion, useful calculator sessions, saved-recipe reuse and support
burden. Review Search Console alongside that evidence without adding a new tracking
system or demanding a traffic threshold as another launch gate.

### Make One Bounded Improvement

For a selected experiment, write down the observed problem, one proposed change, the
existing metric or direct feedback that can answer it, the cost and a review point.
Keep the result only when it improves a useful outcome without weakening privacy,
accessibility, data accuracy or safety. An inconclusive result remains inconclusive.
Do not change several material variables and attribute the outcome to one of them.

### Reconsider Deferred Channels Deliberately

Only after real web usage and a separate owner decision should the project reconsider
Android delivery, paid promotion or a content library. Existing owners retain those
responsibilities; do not create duplicate tickets or treat this strategy as release,
account, purchase or outreach authority. Future Android work must use a real supported
client, truthful store assets and its own policy and physical-device verification.

## Content And Trust Standards

The public calculator should answer a useful question even when the visitor never signs
in. Explain label-serving scaling, portions, missing nutrients and uncertainty plainly.
Do not claim a food is safe, medically suitable or free of an allergen merely because
evidence is missing. Respect external-source licences, attribution and private evidence.

If a content library is selected later, each page needs a distinct user question,
original value, responsible author or organization, primary sources beside factual
claims, honest review dates, accessible presentation and a correction/contact path.
Safety-sensitive claims need an appropriate review boundary. A publishing calendar or
database size is not a reason to mass-produce pages.[^helpful-content]

## Prohibited Shortcuts

Do not buy or exchange links, reviews, installs or engagement; reward positive reviews;
create doorway or keyword-variant pages; manufacture expertise, testimonials, usage or
freshness; conceal sponsorship; or produce generic food copy merely to attract search
traffic. Do not use structured data for invisible claims. Policy compliance and valid
markup do not guarantee rankings, approval, rich results or editorial selection.[^spam]

## Sources

Recheck first-party requirements before a selected channel change or release. These
references support the strategy; they do not expand the current work queue.

[^search-console]: Google Search Console, [Getting started](https://support.google.com/webmasters/answer/10267942).

[^sitemap]: Google Search Central, [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

[^noindex]: Google Search Central, [Block Search indexing with `noindex`](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

[^structured-data]: Google Search Central, [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

[^discover]: Google Search Central, [Discover and your website](https://developers.google.com/search/docs/appearance/google-discover).

[^helpful-content]: Google Search Central, [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

[^spam]: Google Search Central, [Spam policies for Google web search](https://developers.google.com/search/docs/essentials/spam-policies).
