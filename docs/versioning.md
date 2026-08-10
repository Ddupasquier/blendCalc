# blendCalc Versioning

blendCalc uses separate version streams so one kind of change does not incorrectly
force every other part of the system to change versions.

## Current Versions

| Area | Current version | Source of truth | Purpose |
| --- | --- | --- | --- |
| Application release | `1.0.0` | `package.json` | Web/mobile product release |
| Application build | `1.0.0+<deployment>` | SvelteKit build configuration | Exact deployed build identification |
| Catalog API | URL `/api/v1`, response `1.0`, OpenAPI `1.0.0` | `src/lib/api/v1/types.ts` and OpenAPI | Stable consumer contract |
| Database schema | Timestamped migrations | `supabase/migrations` | Ordered, forward-only database changes |
| Catalog product | Per-product revision number | `shared_product_revisions` | Product-label and evidence history |
| Image placement | Placement version | `food_image_assets.placement_version` | Crop and positioning behavior |
| Transient browser state | Feature-specific schema versions | Each owning utility | Safe draft/session migrations |

## Application Releases

Application releases use semantic versioning:

- **Major:** incompatible workflow, persisted-data, or platform behavior.
- **Minor:** backward-compatible features.
- **Patch:** backward-compatible fixes.

The code can derive the major-version shorthand `V1`, but version text does not belong in
the app header, navigation, or primary product screens. If users or support need to read
the version, a future About or Settings view may show the complete release, such as
`1.0.0`. Deployment build identifiers distinguish two builds of the same release without
pretending each deployment is a new product release.

### Node Runtime Contract

Node.js 24 is the only supported development, test, preview, and build major. `.nvmrc`
and `.node-version` are matching runtime selectors for supported local tools, while
`package.json` and `package-lock.json` require `>=24 <25`.
Engine-strict dependency installation rejects unsupported majors, and
`npm run version:check` verifies the active runtime before development, test, check,
preview, and production-build commands perform substantive work. Development startup
also stops any stale Vite process before checking the replacement runtime, so a server
cannot continue using an obsolete dependency graph. New project terminals select Node
24 automatically; if an already-open terminal retains another runtime, reopen it from
the repository instead of continuing with a stale process.

### Application Release Commands

Check every version source without changing files:

```bash
npm run version:check
```

Bump the application release:

```bash
npm run version:bump -- patch
npm run version:bump -- minor
npm run version:bump -- major
```

The bump helper runs `npm version <level> --no-git-tag-version`, updates both package
files and this document, and reruns the consistency check. It does not create a commit
or Git tag. Review the resulting files before choosing whether to commit them.

Development, test, check, preview, and build commands execute `version:check`
automatically. Future CI should run a check or build command, so version drift fails
before deployment.

## API Releases

The API version changes only when its consumer contract changes. An app patch or feature
does not automatically change `/api/v1` or `apiVersion: 1.0`. Compatible API additions
remain in the current API major version; incompatible response changes require a new API
path and migration period.

The response contract uses `major.minor`; OpenAPI uses the matching full semantic
version. Preview status is stored separately in `info.x-blendcalc-status` instead of
being appended to the version.

API changes remain deliberate:

1. Compatible additions may update the contract minor and OpenAPI version while staying
   under `/api/v1`.
2. Breaking changes require a new `/api/v2` route tree, contract constant, OpenAPI
   document, and a documented migration period.
3. Run `npm run version:check` after changing any API version source.

Current product reads and product revision-history reads remain separate endpoints.
Adding the bounded `/api/v1/products/{barcode}/revisions` resource is a compatible API
v1 addition; it does not expand the current-product response with historical snapshots
or private evidence.

## Compatibility Rules

- Do not use the app version as a database migration number.
- Do not use the API version as a catalog product revision.
- Do not use deployment hashes as user-facing release numbers.
- Do not display app or API version text throughout the primary app interface.
- If a visible app version is needed, place the complete release in About or Settings.
- Do not hardcode version strings in components, routes, scripts, or provider clients.
- Keep old persisted data readable or provide an explicit migration before a release.
- Document supported app/API combinations before either side receives a major bump.
