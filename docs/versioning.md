# blendCalc Versioning

blendCalc uses separate version streams so one kind of change does not incorrectly
force every other part of the system to change versions.

## Current Versions

| Area | Current version | Source of truth | Purpose |
| --- | --- | --- | --- |
| Application release | `1.0.0` / `V1` | `package.json` | User-facing web/mobile product release |
| Application build | `1.0.0+<deployment>` | SvelteKit build configuration | Exact deployed build identification |
| Catalog API | URL `/api/v1`, response `1.0` | `src/lib/api/v1/types.ts` and OpenAPI | Stable consumer contract |
| Database schema | Timestamped migrations | `supabase/migrations` | Ordered, forward-only database changes |
| Catalog product | Per-product revision number | `shared_product_revisions` | Product-label and evidence history |
| Image placement | Placement version | `food_image_assets.placement_version` | Crop and positioning behavior |
| Browser storage | Feature-specific schema versions | Each storage utility | Safe local-data migrations |

## Application Releases

Application releases use semantic versioning:

- **Major:** incompatible workflow, persisted-data, or platform behavior.
- **Minor:** backward-compatible features.
- **Patch:** backward-compatible fixes.

The major version is displayed as `V1`; the complete release is `1.0.0`. Deployment
build identifiers distinguish two builds of the same release without pretending each
deployment is a new product release.

## API Releases

The API version changes only when its consumer contract changes. An app patch or feature
does not automatically change `/api/v1` or `apiVersion: 1.0`. Compatible API additions
remain in the current API major version; incompatible response changes require a new API
path and migration period.

## Compatibility Rules

- Do not use the app version as a database migration number.
- Do not use the API version as a catalog product revision.
- Do not use deployment hashes as user-facing release numbers.
- Do not hardcode version strings in components, routes, scripts, or provider clients.
- Keep old persisted data readable or provide an explicit migration before a release.
- Document supported app/API combinations before either side receives a major bump.
