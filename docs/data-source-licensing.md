# Data Source Licensing And Compliance

Last reviewed: 2026-07-26

This tracked document is blendCalc's human-readable licensing and attribution ledger
for external food data, images, standards, and processing tools. It records what each
source permits, what it requires, how blendCalc currently uses it, and where the current
implementation still needs work.

This is an engineering compliance record, not legal advice. A repository review does
not replace professional legal review before a public API or commercial data product is
launched. When source terms, integrations, storage, attribution, or API publication
behavior change, update this document and the database policy in the same change.
The cross-source terms packet and public-access approval procedure are maintained in
[`public-api-release.md`](public-api-release.md); this ledger remains the authority for
each individual source and asset licence.

## Ledger Navigation

| Area                      | Sections                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decision model            | [Compliance model](#compliance-model) and [status summary](#status-summary)                                                                                                                                                          |
| Food data                 | [USDA](#usda-fooddata-central), [Open Food Facts](#open-food-facts), [COLA Cloud](#cola-cloud), [CNF](#canadian-nutrient-file-2026), [CoFID](#uk-cofid-2021), and [Australian data](#australian-food-composition-database-release-3) |
| Standards and tools       | [UCUM](#ucum-unit-standard), [GS1 Digital Link](#gs1-digital-link), and [label OCR](#nutrition-label-ocr-and-tesseractjs)                                                                                                            |
| Images and community data | [Product images](#product-images), [community submissions](#community-and-user-label-data), and [inactive sources](#retired-or-inactive-sources)                                                                                     |
| Release work              | [Known blockers](#known-gaps-and-release-blockers), [source changes](#adding-or-changing-a-source), [public API gate](#public-api-release-gate), and [repository locations](#authoritative-repository-locations)                     |

## Compliance Model

blendCalc separates source evidence from canonical published data:

1. External responses enter through server-only request modules and a provider-specific
   cache.
2. Accepted fields retain source identifiers, references, retrieval dates, confidence,
   and field-level provenance.
3. `product_data_sources` records source identity, terms, attribution, enablement,
   canonical-storage permission, API-redistribution permission, licence identity,
   policy review date, and policy notes.
4. `generic_food_datasets` records release-specific source URLs, hashes, licences,
   attribution, import approval, and activation.
5. `food_image_assets` records per-image source, source reference, licence, licence URL,
   attribution, retrieval date, approval, and public/private storage state.
6. Raw provider cache rows and private moderation evidence are not public catalog rows.
7. API v1 reads the blendCalc database only. It does not call external providers during
   a public read. Product responses preserve represented provider policy dates and any
   exact imported dataset release in `sourceAttributions`; image responses preserve
   their independent source, licence, credit, and retrieval date.
8. `blendcalc_api_v1_product_readiness` evaluates every active `shared_products` row.
   Product API reads include only rows whose populated fields, normalized nutrients, and
   normalized servings have complete, API-approved source evidence.

`canonical_storage_allowed = false` and `api_redistribution_allowed = false` are hard
publication boundaries. A source may still be usable for live lookup, comparison, or a
separately licensed asset without being eligible for the blendCalc canonical catalog or
future public API.

## Status Summary

| Source                                         | Current use                                                  | Governing terms                                                                                                                 | Current engineering status                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USDA FoodData Central                          | Runtime barcode/product data and nutrition                   | CC0 1.0/public domain                                                                                                           | Canonical and API reuse allowed                                                                                                                                                         |
| Open Food Facts                                | Runtime barcode lookup, licensed cache, package images       | ODbL/Database Contents Licence; images under CC BY-SA                                                                           | Product fields are excluded from API v1; individually licensed images remain eligible                                                                                                   |
| COLA Cloud                                     | Optional exact-barcode U.S. alcohol-label lookup             | Proprietary API terms over public TTB records and provider enrichments                                                          | Server-only trial; canonical storage, label-image use, and API redistribution blocked                                                                                                   |
| FDA Food Safety Notices                        | Scheduled FDA recall announcements plus enforcement evidence | openFDA terms and FDA website policy; generally U.S. government information, with stated third-party exceptions and disclaimers | Normalized index/enforcement facts and attribution may be retained; company-authored announcement prose is not copied, raw evidence stays private, and matches are never medical advice |
| USDA FSIS Recalls and Public Health Alerts     | Scheduled official meat, poultry, and egg safety evidence    | U.S. government source with USDA website policy and source attribution                                                          | Normalized current notices may be retained; provider failures retry independently and conservative matching is required                                                                 |
| Canadian Nutrient File 2026                    | Imported generic-food composition data                       | Open Government Licence – Canada                                                                                                | Canonical and API reuse approved in the registry with attribution                                                                                                                       |
| UK CoFID 2021                                  | Imported generic-food composition data                       | Open Government Licence v3.0                                                                                                    | Canonical and API reuse approved in the registry with attribution                                                                                                                       |
| Australian Food Composition Database Release 3 | Candidate generic-food dataset                               | FSANZ agreement based on CC BY-SA 3.0 Australia                                                                                 | Import and canonical use blocked                                                                                                                                                        |
| UCUM                                           | Reviewed local unit reference standard                       | UCUM Licence v1.1                                                                                                               | Active as bounded database reference data; no NLM service request                                                                                                                       |
| GS1 Digital Link                               | Local GTIN extraction from supported QR identifiers          | GS1 standards terms and trademark/IP notices                                                                                    | Identifier parsing only; no GS1 product-data redistribution                                                                                                                             |
| Tesseract.js label OCR                         | On-device label text recognition                             | Apache License 2.0                                                                                                              | Allowed as a software dependency; output remains user-confirmed label data                                                                                                              |
| Wikimedia Commons                              | Schema-supported image source                                | Per-file licence and attribution                                                                                                | No general import approval; each asset must be reviewed individually                                                                                                                    |
| FoodRepo                                       | Retired source candidate                                     | Provider terms                                                                                                                  | Disabled; no production traffic                                                                                                                                                         |
| Community/user label submissions               | Moderated product corrections and additions                  | User consent plus future blendCalc submission terms                                                                             | Private evidence is protected; public API grant must be finalized before launch                                                                                                         |

## USDA FoodData Central

### Requirements And Limitations

- FoodData Central states that its data are in the public domain and published under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Permission is not required to use the data. USDA nevertheless asks users to identify
  FoodData Central as the source and provides a suggested citation.
- The API requires a key and applies operational rate limits. Keys must remain
  server-side and rate limits are not permission to redistribute unrelated third-party
  material that may be linked from a record.
- USDA names, seals, and marks are not granted merely because the data are public
  domain; blendCalc must not imply USDA endorsement.

Official reference: [FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/).

### Current blendCalc Handling

- Exact product requests run server-side through the shared request/cache layer.
- API credentials are not sent to the browser.
- `product_data_sources.usda` records `CC0-1.0`, USDA attribution, reviewed canonical
  storage permission, and the source URL.
- Accepted values retain USDA identifiers and field-level provenance.
- Permitted exact-barcode backfills may retain reported package weight, market country,
  and source publication/availability/update/discontinued dates alongside their USDA
  observation; absent values remain absent.
- API v1 returns USDA in `sourceAttributions` when an accepted field uses it.
- Canonical gap-filling is allowed because the registry explicitly permits it; the
  provider name alone does not grant permission.

Current status: the implementation aligns with the recorded reuse policy. Keep the
source attribution even though CC0 does not require it.

## Open Food Facts

### Requirements And Limitations

- The Open Food Facts database is published under the
  [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/).
- Individual database contents are made available under the Database Contents Licence.
- Reuse requires attribution. A publicly used adapted or combined database may trigger
  ODbL share-alike obligations.
- Product images use Creative Commons Attribution-ShareAlike terms and require image
  attribution. The exact licence information stored for the selected asset must travel
  with that asset.
- API clients must use a descriptive custom `User-Agent` and respect documented rate
  limits.

Official references:

- [Open Food Facts API legal guidance](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/)
- [Open Food Facts API reuse conditions](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)

### Current blendCalc Handling

- Runtime requests use a custom blendCalc `User-Agent`, a bounded field list, shared
  request coalescing, a seven-day positive cache, a twelve-hour negative cache, and a
  bounded stale-on-outage window.
- Raw responses live in the provider cache rather than being treated as blendCalc-owned
  records.
- `product_data_sources.open-food-facts` currently sets
  `canonical_storage_allowed = false` and explains that records must remain in a
  licensed cache or asset path until the downstream database model is deliberately
  accepted.
- Open Food Facts images are stored separately in `food_image_assets` with their source,
  reference, licence, licence URL, and attribution. Full image views use the shared
  asset-attribution component.
- API v1 excludes products or populated fields that depend on Open Food Facts database
  content because its source row is not approved for canonical/API redistribution.
- Open Food Facts images remain a separate asset class. API v1 may return an image only
  when the asset row contains its CC BY-SA licence, licence URL, attribution, and
  retrieval date and the source registry supplies its public name and URL; image
  provenance does not make Open Food Facts a source of the product-data row.

### Known Policy Mismatch

The current catalog submission path can still automatically publish an exact Open Food
Facts match to `shared_products`. That behavior conflicts with the registry and with the
documented cache-only policy. It must not be described as compliant merely because the
source and ODbL observation are stored.

Before public API release, blendCalc must choose and implement one model:

1. block Open Food Facts product fields from automatic canonical publication and use
   them only as licensed lookup evidence, comparison evidence, and separately licensed
   images; or
2. deliberately adopt an ODbL-compatible public database model, including required
   attribution, share-alike publication, compatible-source analysis, and a reviewed
   legal decision.

Until that decision is implemented, Open Food Facts-backed canonical fields remain
withheld by the database publication gate. Their existence in `shared_products` does
not silently authorize or expose them.

## COLA Cloud

### Requirements And Limitations

- COLA Cloud provides an authenticated API over the U.S. TTB COLA Public Registry and
  adds proprietary normalization, barcode extraction, OCR, and model-generated
  enrichments.
- The provider states that the underlying U.S. government records are public-domain
  source material. That does not automatically grant rights to copy or redistribute
  COLA Cloud's compiled database, OCR output, normalized fields, API responses, or
  hosted image delivery.
- Barcode coverage is approximately 30% of COLA records because a barcode must be
  visible in the submitted label artwork. A miss is not proof that a product lacks a
  U.S. approval.
- ABV may come from structured source material or automated label extraction. Automated
  extraction can be wrong, so an exact barcode and explicit numeric value remain
  reviewable evidence rather than automatic verification.
- The self-service API uses a server-only key and plan-based monthly and per-minute
  quotas. The key must never reach browser code.

Official references:

- [COLA Cloud API](https://colacloud.us/api)
- [API barcode lookup](https://docs.colacloud.us/api-reference/barcodes/lookup-by-barcode)
- [Data provenance and limitations](https://docs.colacloud.us/trust/data-provenance)
- [COLA Cloud terms](https://colacloud.us/terms)
- [TTB Public COLA Registry](https://www.ttb.gov/regulated-commodities/labeling/cola-public-registry)

### Current blendCalc Handling

- `product_data_sources.cola-cloud` is an enabled trial lookup source only when the
  server has `COLA_CLOUD_API_KEY`.
- Runtime lookup uses an exact normalized barcode, selects the newest approved label,
  verifies the same GTIN again in the detail response, and fetches no more than one
  selected detail record.
- Only explicitly returned ABV, volume, identity, approval date, and TTB reference are
  eligible as temporary field-level lookup evidence. Probabilistic categories,
  descriptions, tasting notes, and other model-generated fields are not accepted.
- Provider responses are not promoted into the canonical catalog, exposed through API
  v1, or used as public label images. `canonical_storage_allowed` and
  `api_redistribution_allowed` remain false.
- A one-record smoke check proves endpoint compatibility only. A representative
  cross-source benchmark and written storage/redistribution review remain required
  before changing provider priority or retention.

Current status: suitable as a guarded U.S. alcohol fallback, not as a global alcohol
catalog or public blendCalc API source.

## FDA Food Safety Notices

### Requirements And Limitations

- The [openFDA terms](https://open.fda.gov/terms/) place the service's content and data
  in the public domain under CC0 1.0 unless a record is specifically marked otherwise.
  FDA requests attribution even though it is not generally required.
- The [food enforcement endpoint](https://open.fda.gov/apis/food/enforcement/) contains
  publicly releasable Recall Enterprise System records and may revise older records.
  Its update cadence is not a real-time guarantee.
- The [FDA recall-announcement index](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts)
  can publish a current notice before the corresponding enforcement record reaches
  openFDA. Company-authored announcement prose and third-party images are not assumed to
  be government works merely because FDA hosts the page.
- The service may rate-limit or terminate access. A key is optional for trial requests
  but recommended for scheduled use.
- FDA states that the endpoint must not be relied on for medical decisions and warns
  against treating it as a complete public-alert or recall-lifecycle system. An absent,
  late, or unmatched record is never proof of safety.

### Current blendCalc Handling

- `product_data_sources.open-fda-food-enforcement` records both official FDA channels,
  FDA attribution, terms, the policy review date, and the medical-decision disclaimer
  requirement.
- The scheduled server worker retrieves bounded enforcement pages with an optional
  `OPENFDA_API_KEY` and bounded recent announcement batches. Conditional ETag and
  last-modified requests avoid downloading an unchanged announcement index. When
  FDA.gov denies Supabase Edge network traffic, the worker uses a protected blendCalc
  app-server relay that is restricted to the fixed FDA recall index and FDA recall
  detail path. Browsers never call either source or the relay.
- Raw and normalized changed payloads are immutable private evidence. Public API and
  app surfaces receive only the current normalized notice, FDA attribution, official
  link, and package-check guidance.
- Announcement evidence stores index facts and explicitly labeled package identifiers;
  it does not persist full company press-release prose or page HTML.
- Exact GTIN evidence can activate a product notice. Strong non-GTIN identity remains
  under moderation, and weak title-only similarity is discarded.
- blendCalc does not claim complete recall coverage, provide medical advice, or tell a
  user that an unmatched package is safe. It presents a source-linked official record
  that the user must verify against the current package and official notice.

Current status: approved for bounded official-notice evidence with attribution and
disclaimers; external policy review remains appropriate before positioning this as a
public alerting product.

## USDA FSIS Recalls And Public Health Alerts

### Requirements And Limitations

- The [FSIS Recall API](https://www.fsis.usda.gov/science-data/developer-resources/recall-api)
  is a read-only official JSON source for meat, poultry, and egg recalls and public
  health alerts. The source page and API must remain linked and attributed to USDA FSIS.
- U.S. government source status does not justify copying unrelated third-party material
  that may appear on linked pages. blendCalc stores only the normalized official fields
  and the exact response evidence needed for review.
- Provider availability is not guaranteed. A failed FSIS request must not stop FDA or
  product revalidation work and cannot clear an existing notice.

### Current blendCalc Handling

- `product_data_sources.usda-fsis-recalls` records the official API, USDA policy page,
  source attribution, government-work status, and public-notice role.
- The server worker processes FSIS through its own cursor, backoff, and error code. It
  stores immutable alert revisions and retains current status without exposing raw
  payloads to browsers or API consumers.
- Exact GTIN evidence may activate a match. Strong identity without an exact identifier
  is reviewed, title-only similarity is ignored, and package/lot/date information is
  retained for a required package check.

Current status: approved as an official safety-notice source; production enablement
still requires a successful deployed endpoint smoke check and ongoing availability
monitoring.

## Canadian Nutrient File 2026

### Requirements And Limitations

- The [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
  permits commercial and non-commercial copying, modification, publication,
  distribution, and adaptation.
- Reuse must acknowledge the source and, where practical, link to the licence.
- The licence does not grant rights in excluded third-party material, personal
  information, official marks, crests, logos, or other protected identifiers.
- Attribution must not imply Health Canada or Government of Canada endorsement.

Dataset reference: [Canadian Nutrient File 2026](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109).

### Current blendCalc Handling

- `generic_food_datasets.cnf-2026` records the exact release, dataset/download URLs,
  licence, attribution statement, review state, expected counts, import state, and file
  hash after import.
- `product_data_sources.health-canada-cnf` permits canonical/API reuse and records the
  review evidence and non-endorsement/excluded-rights restrictions.
- Imported foods, nutrient values, and measures retain CNF identifiers and release
  provenance.
- Generic-food search returns release-specific source attribution.

Current status: approved by the repository's engineering policy review for canonical
and API use with the stored attribution. Excluded third-party material must still be
reviewed if a future release adds assets or fields outside the core dataset.

## UK CoFID 2021

### Requirements And Limitations

- The [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
  permits copying, publication, distribution, adaptation, and commercial or
  non-commercial reuse.
- Reuse must acknowledge the information provider/source and, where possible, link to
  the licence.
- Third-party rights, personal data, protected marks, logos, and material outside the
  provider's authority are excluded.
- Attribution must not imply endorsement.

Dataset reference: [UK Composition of Foods Integrated Dataset 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).

### Current blendCalc Handling

- `generic_food_datasets.cofid-2021` records the release, source/download URLs, licence,
  attribution, review status, import state, and imported file hash.
- `product_data_sources.uk-cofid` permits canonical/API reuse and records the official
  policy evidence and limitations.
- Source food/nutrient identifiers and source basis are retained. Records whose basis is
  per 100 ml remain identified as such instead of being silently converted to per 100 g.
- Generic-food search returns release-specific source attribution.

Current status: approved by the repository's engineering policy review for canonical
and API use with the stored attribution and basis semantics.

## Australian Food Composition Database Release 3

### Requirements And Limitations

- The [FSANZ Data User Licence Agreement](https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement)
  is based on Creative Commons Attribution-ShareAlike 3.0 Australia.
- Reproduction, incorporation, derivatives, and distribution are allowed only under its
  conditions, including attribution and share-alike licensing.
- Distributed copies or derivatives must include the licence link, the required
  limitation-of-data statement, and the warning that Australian data may not be suitable
  for other countries.
- Existing notices must remain, changes must be identified, and reuse must not imply
  endorsement or use FSANZ marks/logos without permission.

### Current blendCalc Handling

- The dataset and source are registered for evaluation.
- `generic_food_datasets.afcd-release-3` remains inactive with
  `import_enabled = false` and `license_review_status = requires_acceptance`.
- No AFCD import should run and no AFCD data should enter the public catalog/API until
  blendCalc deliberately accepts and implements the share-alike and notice obligations.

Current status: correctly blocked.

## UCUM Unit Standard

### Requirements And Limitations

- UCUM is distributed under the [UCUM Licence](https://ucum.org/license). Redistribution
  of UCUM material must preserve the licence notice and comply with its origin and
  trademark provisions.
- blendCalc uses a bounded reviewed subset of UCUM codes and conversion factors rather
  than reproducing or modifying the complete standard.

### Current blendCalc Handling

- `product_data_sources.ucum-standard` records UCUM specification version 2.2, UCUM
  Licence v1.1, the official licence URL, required attribution, and the engineering
  policy review date.
- Serving units and reviewed mass/energy conversion rows use the bounded factors stored
  in Supabase and the maintained local reference catalog. Seeding makes no NLM UCUM
  service request.
- `product_data_sources.ucum-nlm` remains disabled as historical provenance for the
  service that originally supplied the reviewed values; it is never deleted or called.
- Canonical storage is approved for the bounded reference subset. Direct public API
  redistribution remains disabled until API v1 has a dedicated unit-standard
  attribution contract carrying the stored UCUM origin, licence, and warranty
  disclaimer. UCUM codes retain their published meaning.

Current status: approved by the repository's engineering policy review for the bounded
stored reference subset; direct API redistribution remains conservatively blocked. This
is not independent legal advice.

## GS1 Digital Link

### Requirements And Limitations

- [GS1 Digital Link](https://ref.gs1.org/standards/digital-link/) defines how GS1
  identifiers can be represented in web URIs.
- GS1 standards, trademarks, and patent/IP notices do not grant permission to copy
  product content from arbitrary brand URLs.

### Current blendCalc Handling

- Supported uncompressed links are parsed locally to extract and validate the `01` GTIN.
- blendCalc does not fetch the scanned brand URL.
- Lot, serial, expiration, query, fragment, credentials, and package-instance data are
  discarded before persistence.
- Product fields come from blendCalc's existing DB-first barcode lookup, not from GS1.

Current status: no GS1 product database is ingested or redistributed.

## Nutrition-Label OCR And Tesseract.js

### Requirements And Limitations

- Tesseract.js is software distributed under the
  [Apache License 2.0](https://github.com/naptha/tesseract.js/blob/master/LICENSE.md).
- OCR output is not authoritative source data. The package label and the user's
  confirmation are the evidence for accepted values.
- Software distribution must retain required copyright and licence notices.

### Current blendCalc Handling

- OCR runs on-device in the browser.
- Recognized text is presented as a suggestion and is not accepted until the user
  confirms it.
- Confirmed values are stored as `user-label`, not as Tesseract-owned nutrition data.
- Label photos remain private moderation evidence unless separately approved under the
  product-image rules.

Current status: the data boundary is appropriate. Before public distribution, confirm
that the built application's third-party software notices preserve Apache-2.0 notices.

## Product Images

Image rights are independent from nutrition/database rights. A source that permits data
reuse does not automatically permit reuse of package photography.

- Every public image must have an active `food_image_assets` row with source, source
  reference, image role, licence name, licence URL when available, attribution text when
  required, approval state, and retrieval date.
- Open Food Facts images retain their Creative Commons Attribution-ShareAlike metadata.
- An exact-barcode Open Food Facts front image can become the app's canonical product
  image automatically only when its asset row preserves licence name, licence URL,
  attribution, source reference, and retrieval date. A later candidate does not replace
  an eligible canonical image merely because it is newer.
- Wikimedia Commons has no blanket approval. Each selected file must be checked for its
  exact licence, creator credit, source page, modifications, and share-alike conditions.
- User uploads stay in private moderation evidence. Approval creates a separate public
  community-reviewed asset; the original private evidence path is never exposed.
- Full image views render stored attribution through `AssetAttribution`. Compact card
  thumbnails may remain uncluttered only when a discoverable detailed attribution view
  is available.
- Missing or uncertain image rights mean the image is not public. The UI uses a category
  symbol instead.
- Public API reads expose only the selected canonical front image and apply the stricter
  complete-rights check independently. Canonical app selection does not grant missing
  redistribution rights or make the source product data canonical.

## Community And User-Label Data

Users can submit product labels, corrections, serving information, warnings, and images.
Current database rows record consent to share and moderation evidence, and public
catalog changes require the catalog/moderation flow.

Before blendCalc exposes community-derived records through a public API, its user terms
must explicitly grant blendCalc the rights needed to store, moderate, modify, publish,
redistribute, and version submitted factual data while preserving user privacy. Consent
to share inside the app should not be assumed to be a complete public-API licence grant.
Private foods, user identity, private evidence paths, and rejected submissions must
never appear in public API responses.

## Retired Or Inactive Sources

### FoodRepo

FoodRepo is recorded as retired and disabled. Production code must not call it. Its
historical evaluation and replacement decision remain in the source registry so a
future contributor does not accidentally restore it without a new terms and lifecycle
review.

### Wikimedia Commons

Wikimedia Commons is schema-supported but not a generally approved ingestion feed.
Only deliberately selected, per-file-reviewed assets may be stored and rendered.

## Known Gaps And Release Blockers

1. **Open Food Facts canonical intake:** exact matches can still enter the internal
   shared catalog even though the source registry blocks canonical/API redistribution.
   The API publication gate now withholds those rows. Resolve the downstream ODbL model
   or block that intake path before those fields can be published.
2. **In-app data attribution:** detailed nutrition currently shows a neutral source
   label, while full licence URLs and attribution are consistently available for images
   and API v1. Add a centralized, discoverable data-attribution view before public
   launch so required source credits and licence links are available without cluttering
   compact cards.
3. **Community submission grant:** write and review user-facing submission terms that
   cover future public API redistribution and correction/version history.
4. **AFCD:** remain disabled unless blendCalc accepts and implements the FSANZ
   share-alike, notice, and limitation-statement requirements.
5. **Wikimedia Commons:** do not start bulk image ingestion without per-asset licence and
   attribution enforcement.
6. **Third-party software notices:** verify that production distributions preserve
   required notices for Tesseract.js and all other redistributed dependencies.
7. **Periodic review:** terms can change. Review enabled external sources before major
   integration changes and before every public API launch milestone.

## Adding Or Changing A Source

Complete every item before enabling production traffic or canonical storage:

1. Identify the legal owner, official source page, API terms, dataset licence, database
   licence, contents licence, and image licence separately.
2. Record the exact release/version, retrieval date, terms URL, required attribution,
   modification rules, caching limits, canonical-storage rights, public redistribution
   rights, share-alike obligations, third-party exclusions, trademark restrictions, and
   non-endorsement language.
3. Confirm operational requirements such as API keys, rate limits, custom user agents,
   retention limits, deletion duties, and outage-cache rules.
4. Add or update `product_data_sources` through a migration. Do not infer permission in
   TypeScript from a provider key.
5. Add release-specific `generic_food_datasets` metadata for imported datasets.
6. Keep `canonical_storage_allowed = false` and import/publication disabled until the
   review is complete.
7. Preserve raw and normalized provenance, source references, timestamps, and required
   attribution in storage and API output.
8. Add tests for request boundaries, cache behavior, legal-storage gates, attribution,
   private-data exclusion, and source retirement.
9. Update this document, the source inventory, schema docs, API contract, and user-facing
   attribution path in the same change.
10. Re-review the source if its terms, API version, owner, dataset release, or blendCalc
    usage changes.

## Public API Release Gate

Do not include a source in a public blendCalc API response unless:

- canonical/public storage is explicitly allowed in the database;
- `api_redistribution_allowed` is explicitly enabled after policy review;
- licence name, licence URL, attribution, and policy review date are present;
- required field- and asset-level provenance survives normalization;
- share-alike compatibility has been reviewed across combined sources;
- required credits are returned in the API and available in the app's attribution view;
- private users, evidence, storage paths, and rejected submissions are excluded;
- corrections, removal requests, source retirement, and revision history have an
  operational process through private `api_publication_concerns`, reversible
  `api_publication_holds`, and immutable product revisions; and
- the current implementation matches the written policy.

If metadata or rights are uncertain, exclude the affected source or field from public
output. Do not convert uncertainty into permission.

### Correction And Withholding Operations

Publication concerns resolve exactly one canonical product, image asset, imported
dataset release, or provider identity before storage. The trusted server retains the
reporter's contact details, evidence links, concern type, urgency, and target in private
tables; browser roles cannot query or write those rows directly.

Use the ordinary catalog-correction workflow when reviewed label data should replace
specific canonical fields. Use a publication hold when a rights, attribution, privacy,
accuracy, or source-retirement concern requires immediate public withholding while the
evidence is reviewed. Holds are reversible and do not erase source or revision history.
Use `npm run api:publication -- list` for the bounded operator queue and the documented
`hold`, `release`, and `resolve` subcommands for emergency action.

## Authoritative Repository Locations

| Responsibility                            | Location                                               |
| ----------------------------------------- | ------------------------------------------------------ |
| Human-readable licensing ledger           | `docs/data-source-licensing.md`                        |
| Source capabilities and intake boundaries | `docs/api-structures/source-data-inventory.md`         |
| Source identity and canonical policy      | `product_data_sources`                                 |
| Imported dataset release policy           | `generic_food_datasets`                                |
| Per-image licence and attribution         | `food_image_assets`                                    |
| Provider cache                            | `product_api_cache`                                    |
| API v1 source attribution mapping         | `src/lib/server/api/v1/catalogApi.server.ts`           |
| API v1 row publication gate               | `blendcalc_api_v1_product_readiness`                   |
| API v1 field lineage                      | `docs/api-structures/catalog-field-lineage.md`         |
| Runtime provider requests                 | `src/lib/server/products/sources/`                     |
| Request caching/rate controls             | `src/lib/server/products/productApiRequests.server.ts` |
| Shared catalog policy                     | `docs/shared-product-catalog.md`                       |
| Database table map                        | `docs/supabase-schema.md`                              |
