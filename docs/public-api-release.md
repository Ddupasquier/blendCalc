# Public API Release Review

## Quick Navigation

| Need                                   | Sections                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Understand why public access is closed | [Current Status](#current-status) and [Release Conditions](#release-conditions)           |
| Prepare professional review            | [Review Packet](#review-packet) and [Required Terms Decisions](#required-terms-decisions) |
| Review official references             | [Official Review References](#official-review-references)                                 |
| Record approval and release safely     | [Approval And Release Procedure](#approval-and-release-procedure)                         |

## Current Status

blendCalc API v1 is an **internal, read-only preview for signed-in blendCalc accounts**.
Public API keys, developer accounts, billing, and anonymous catalog access do not exist.
Public access remains blocked in `src/lib/api/v1/accessPolicy.ts` and the OpenAPI status
metadata until the reviews in this document are complete.

This is an engineering review packet, not approved legal language or legal advice. It
identifies the real product behavior, decisions, evidence, and professional review
needed before public release. It must not be presented as public Terms of Service or a
Privacy Notice.

## Release Conditions

Every area below needs a dated approval or a dated correction list from a qualified
reviewer. One approval cannot silently stand in for a different subject.

| Review area                     | What the review must settle                                                                                                                                                    | Current state                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Acceptable use                  | Who may access the API; prohibited abuse, evasion, re-identification, credential sharing, and unsafe automation; suspension and termination; request and rate limits           | Pending                                             |
| Privacy                         | Data collected from API consumers and concern reporters; purposes, vendors, retention, deletion, correction, export, security, breach response, and applicable regional rights | Pending                                             |
| Source and asset attribution    | Downstream display and preservation of field-level source, dataset release, image credit, licence, excluded rights, and non-endorsement requirements                           | Pending                                             |
| Correction and removal          | Product correction, rights notice, privacy report, rapid withholding, response expectations, counter-evidence, restoration, and audit retention                                | Engineering workflow complete; terms review pending |
| Community submission rights     | The permission users grant for reviewing, storing, revising, displaying, and redistributing accepted product facts and images through the app and API                          | Pending                                             |
| Health and nutrition disclaimer | Clear limits of nutrition, allergen, preference, serving, goal, and recommendation data without making unsupported health or safety claims                                     | Pending                                             |
| Warranty and liability          | Availability, accuracy, reliance, third-party data, indemnity, damages, governing law, dispute terms, and enforceability                                                       | Pending professional drafting                       |

No status in this table means blendCalc has received legal approval. Public access may
be considered only after every required area is approved and every requested correction
is implemented and regression-tested.

## Review Packet

Provide the reviewer with one dated bundle containing:

1. The exact OpenAPI document and its SHA-256 checksum.
2. Representative product, search, category, revision, error, attribution, and image
   responses from every source eligible for redistribution.
3. The source and dataset policy rows, licence evidence, excluded-rights notes, import
   release identities, and image-licence records described in
   [`data-source-licensing.md`](data-source-licensing.md).
4. The private-data inventory and API serializer boundary described in
   [`data-architecture.md`](data-architecture.md) and
   [`api-structures/catalog-field-lineage.md`](api-structures/catalog-field-lineage.md).
5. The correction, publication-hold, and immutable revision behavior described in
   [`moderation.md`](moderation.md) and
   [`shared-product-catalog.md`](shared-product-catalog.md).
6. The proposed public authentication, API-key, rate-limit, log-retention, revocation,
   abuse-response, and support model. These systems do not exist yet and must not be
   inferred from the current browser-session preview.
7. The complete app privacy inventory for account, profile, food-preference, recipe,
   nutrition-goal, analytics, image, moderation, and concern-report data—not merely the
   fields returned by API v1.
8. The final consumer-facing Privacy Notice, developer/API terms, acceptable-use
   policy, attribution instructions, health disclaimer, and correction/removal policy.

The review record must identify the reviewed legal entity, reviewer, jurisdictions,
date, app release, API contract version, OpenAPI checksum, source-policy export, final
documents, required corrections, and re-review triggers. Do not store privileged legal
advice, private reporter evidence, or reviewer secrets in the public repository.

## Required Terms Decisions

### Acceptable Use

Public terms need explicit rules for credentials, request limits, automated collection,
redistribution, security testing, service interference, bypass attempts, unlawful use,
false source claims, removal of required credits, and attempts to identify private
users. Enforcement must be compatible with a future API-key and account-revocation
model rather than relying on the current browser cookie.

### Privacy

Before public access, document exactly whether blendCalc will retain API account data,
key identifiers, request timestamps, endpoint and response status, IP or device data,
abuse signals, support correspondence, and correction-report contact/evidence. Define
purpose and retention for each item, identify processors, and implement access,
correction, deletion, export, and appeal paths where applicable.

The API must never expose private foods, lists, recipes, goals, preferences, identities,
pending moderation records, concern contact details, or private evidence. A public API
privacy review does not replace the broader app privacy review. The FTC's current
health-app guidance also requires evaluating whether the Health Breach Notification
Rule applies to blendCalc's identifiable health-related data and incident process.

### Attribution And Redistribution

blendCalc combines canonical fields and images with independent source lineage. Terms
must not claim blanket ownership over third-party facts or assets. Consumers need clear
instructions for preserving every returned `sourceAttributions` entry and image licence
credit, following share-alike or other source-specific conditions, respecting excluded
rights such as trademarks and photographs, and avoiding implied source endorsement.

### Corrections, Rights Notices, And Removal

The ordinary immutable product-update flow corrects canonical facts. The public concern
intake accepts one exact product, image, dataset release, or provider report. A credible
accuracy, rights, attribution, privacy, or retirement concern can place a reversible
hold immediately while preserving evidence and revision history. Final terms still need
reviewed notice requirements, response expectations, counter-notice/restoration rules,
contact details, and any legally required copyright process.

Because blendCalc accepts user images and may redistribute accepted submissions, review
whether a U.S. Copyright Office DMCA agent designation and public agent contact are
appropriate. The existing publication-hold workflow is useful operationally but does
not itself establish DMCA safe-harbor compliance.

### Health, Nutrition, And Safety

The API reports available evidence; it does not guarantee a current package formula,
complete nutrient panel, allergen absence, dietary suitability, diagnosis, treatment,
or a safe serving for a particular person. Missing remains unknown rather than zero,
and warning coverage states must remain visible. Users should verify the current package
label and seek qualified advice for medical or allergy decisions.

Disclaimers do not permit misleading claims. Public wording and marketing must match
what the evidence, completeness status, provenance, and correction system actually do.

### Warranty And Liability

Qualified counsel must draft and approve the final warranty, limitation-of-liability,
indemnity, governing-law, dispute, suspension, termination, and service-change language.
Engineering documentation must not invent enforceability or copy generic boilerplate
from another service.

## Official Review References

- [FTC: Protecting Personal Information—A Guide for Business](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business)
- [FTC: Health Breach Notification Rule—The Basics for Business](https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business)
- [FTC: Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
- [Oregon DOJ: Privacy Law FAQs for Businesses](https://www.doj.state.or.us/consumer-protection/for-businesses/privacy-law-faqs-for-businesses/)
- [California DOJ: California Consumer Privacy Act](https://oag.ca.gov/privacy/ccpa)
- [U.S. Copyright Office: Online Service Providers](https://www.copyright.gov/onlinesp/)

These references help scope review; they do not determine which laws apply to
blendCalc. The reviewer must evaluate the actual business, users, jurisdictions, data,
and release model.

## Approval And Release Procedure

1. Freeze the reviewed OpenAPI and source-policy export; record checksums.
2. Receive dated professional approval or corrections for every required review area.
3. Implement every correction in its authoritative code, schema, source-policy, or
   public document owner.
4. Publish the final terms and privacy documents at stable HTTPS URLs.
5. Add those URLs and contact information to OpenAPI, then deliberately change the
   source-controlled API access policy. Never enable public access through an
   undocumented environment toggle.
6. Implement and test public credentials, revocation, quotas, retention, abuse response,
   correction intake, and support before accepting external consumers.
7. Rerun API privacy, attribution, correction/removal, OpenAPI, security, database, and
   production checks against representative source and negative-control responses.
8. Record the approval reference and next mandatory review date without committing
   privileged advice or personal information.

Re-review is required when API terms, response fields, data categories, source rights,
community-submission rights, authentication, billing, analytics, retention, health
claims, correction behavior, or relevant jurisdictions materially change.
