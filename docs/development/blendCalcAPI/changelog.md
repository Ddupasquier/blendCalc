# blendCalcAPI Changelog

This history records changes to the food-data HTTP contract independently from
BlendCalc application releases. The API remains an internal, authenticated, read-only
preview. A changelog entry does not enable public access.

[API reference](README.md) describes the endpoints and access requirements;
[OpenAPI](../../../static/api/v1/openapi.json) defines the executable schemas.
[Versioning](../versioning.md#api-releases) owns compatibility and release rules.
Product-label revisions returned by the API are food-data history, separate from this
API contract history.

## How To Read Entries

Each released entry identifies the API path, response version, OpenAPI version,
release date and a link to the exact released contract. Changes are grouped by their
consumer impact:

| Kind            | Meaning                                                        | Consumer action                                                                                      |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Addition        | A compatible endpoint or optional capability                   | Existing integrations can continue; adopt it when useful.                                            |
| Correction      | A fix to documented behavior or an explanation                 | Review the affected behavior; a fix that breaks a supported contract belongs under Breaking changes. |
| Deprecation     | A supported capability is planned for removal or replacement   | Review the replacement and migration guidance; this does not mean removal has happened.              |
| Breaking change | A supported request, response or behavior becomes incompatible | Follow the new major-route migration guide before switching.                                         |

A deprecation entry identifies the affected capability, replacement, announcement date
and any approved removal date. A breaking-change entry identifies the previous and new
major paths, supported coexistence period and required request or response changes.
Only approved dates belong in released entries; proposed dates remain explicitly
unreleased. This history does not promise a notice period or removal schedule that has
not been approved.

Documentation-only corrections keep the existing API version. Changes to an individual
product, provider dataset or app feature are not API releases unless they change the
supported HTTP contract.

## Unreleased

No API contract changes, deprecations or removals are announced here. This section is
for reviewed changes awaiting release; it is not a roadmap or a guarantee of future
availability.

## v1 — Documented Internal Preview Baseline

**Path:** `/api/v1` · **Response version:** `1.0` · **OpenAPI version:** `1.0.0`.

This is a baseline of the existing contract when this history was introduced, not a new
API release or a reconstruction of earlier release dates. Its access status remains
internal and authenticated. The baseline was recorded on October 11, 2026 against
[the shipped v1 OpenAPI contract](https://github.com/Ddupasquier/blendCalc/blob/65a05dc8a6a7421f6c60b05ec8897a99156e88f1/static/api/v1/openapi.json).
That is the documentation baseline date, not the API's original release date.

### Additions

The baseline includes these existing read resources:

- Product lookup by GTIN: `GET /api/v1/products/{barcode}`.
- Evidence-backed product revision history:
  `GET /api/v1/products/{barcode}/revisions`.
- Paginated product search: `GET /api/v1/foods/search`.
- Category listing: `GET /api/v1/categories`.
- The machine-readable contract: `GET /api/v1/openapi.json`.

Catalog reads use stored, publication-ready canonical data. They do not perform live
provider lookups or return private foods, pending submissions or moderation evidence.
[Response examples](README.md#response-examples) explain pagination, missing nutrients,
reported zero, serving conversions and stable errors using fictional data.

### Corrections

The response examples clarify existing behavior without changing the HTTP contract.
No API version change or client migration is required for those documentation examples.

### Deprecations

None announced in this baseline.

### Breaking Changes

None introduced by documenting this baseline. Future incompatible changes require a
new major API path and the migration process owned by
[Versioning](../versioning.md#api-releases).
