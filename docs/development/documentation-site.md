# Maintaining The Documentation Site

The site is a curated static presentation of existing Markdown, not a second set of
application rules. Root setup stays in the [repository README](../../README.md), script
ownership in [Repository scripts](../../scripts/README.md), and each subject in its
existing guide. Private workspace files, personal notes and environment values never
enter the build.

## Preview Locally

Use Node.js 24 and install the committed dependencies. No application credentials or
database services are needed.

The loopback preview does not authenticate, read application cookies or set cookies.
It accepts request headers up to 64 KiB so existing localhost sessions on other ports
do not hit Node's smaller default limit. Do not clear app sessions to preview the docs.

```bash
npm run docs
```

Open [http://localhost:4178](http://localhost:4178). The preview rebuilds when public
Markdown, navigation, styling or package metadata changes. Refresh the browser to see
the result. Ctrl+C stops only the docs preview. A busy port is an error, not permission
to terminate another process; pass `--port 4179` to choose an unused one.

## Add Or Organize A Page

1. Edit the guide that already owns the subject. Add a file only for a distinct owner.
2. Decide whether it belongs on the public site. Internal workflow, security/recovery,
   privileged operations, QA and deployment runbooks stay repository-only. The registry
   explicitly classifies them; they are absent from built pages, aliases and search.
   New, unclassified Markdown fails the build rather than publishing automatically.
   Add a public page's source, stable route, friendly label and short description to
   `config/documentation/navigation.mjs`. The registry supplies both sidebars, page
   metadata, reading order and search labels.
3. Keep links in source Markdown relative to the repository. The builder maps public
   Markdown to site routes, checks local anchors, and links other tracked source files
   to GitHub. References to repository-only guides open their original GitHub source,
   not a mirrored site page. This is audience separation, not access control: files in
   a public repository remain publicly readable there. OpenAPI is copied as an asset.
4. Preserve established routes and heading IDs. Source-shaped paths such as
   `docs/user/README.md/` are also generated as directory aliases, keeping
   direct links and fragments usable on static hosting with normal HTML content types.
   The original repository Markdown stays intact.
5. Run the checks below and inspect the rendered result.

The build rejects unlisted public Markdown, missing targets, duplicate routes and
broken generated anchors. Explicit HTML IDs and GitHub-style duplicate heading suffixes
are preserved. Executable HTML and inline event handlers are rejected.

User help leads the navigation. Selected architecture, app-behavior, design, nutrition,
provenance and API references live under **For developers**; that heading does not imply
the API is publicly available. Its existing availability guidance remains authoritative.
Mixed reference documents use reviewed section allowlists in the same registry. Internal
runbooks are excluded from the rendered body, outline and search without editing the
source document. Links to omitted sections open the original GitHub heading instead.
Changed or missing selected headings fail the build and require another audience review.
Generated repository links use the build's Git commit, so publishing a reviewed docs
branch does not send readers to a different version of a guide on `main`.

## Presentation Ownership

- `config/documentation/site.css` owns the documentation-only layout and semantic
  themes, derived from the Ingredients colors and font families.
- `config/documentation/site.js` owns search, the mobile drawer, theme controls and
  code copying. Search runs locally; it does not send queries to an external service.
- `config/documentation/theme.js` sets the theme before paint. Its optional preference
  storage is separate from application cookies and account settings.
- `scripts/lib/documentation/` owns Markdown rendering and the static page shell.
- `scripts/generators/documentation/` owns the public build; the preview lives under
  `scripts/operations/documentation/`.

The smoothie-cup favicon is reused directly. DM Sans and Plus Jakarta Sans are
self-hosted from pinned font packages, including their license files. Small
documentation-only shadows are permitted; the application remains shadow-free. Green
text uses a stronger contrast-safe shade instead of the button fill color.

The header version comes from `package.json` at build time. Do not type release numbers
into the shell or navigation.

## Verify The Site

```bash
npm run docs -- build
npm run docs -- test
npm run test:focused -- tests/config/documentationQuality.test.ts tests/config/documentationSite.test.ts
npm run format:check
```

The docs browser suite starts its own preview on port 4179; leave that port free.
It uses the existing Chromium, Firefox and WebKit installations without application
Auth or a database. Its projects cover desktop, 390px mobile and tablet layouts. The
ordinary application browser suite remains separate.

## Prepare A GitHub Pages Build

The published site is [BlendCalc documentation](https://ddupasquier.github.io/blendCalc/).
`.github/workflows/documentation.yml` checks documentation pull requests and publishes
the checked static artifact from `main` by default. A manual run can rebuild it.
Pull requests never publish. Other `docs/` branches only run checks unless explicitly
selected as the publishing source.

For the initial publication, set repository **Settings → Pages → Source** to
**GitHub Actions**. Restrict the `github-pages` environment to the publishing branch.
An isolated, owner-approved initial rollout can set the repository Actions variable
`DOCS_PUBLISH_BRANCH` to a reviewed `docs/` branch without promoting application code.
Return that variable and the environment protection to `main` after the docs source
is integrated. Keep local and remote source inspectable before publishing.
Local preview needs neither Pages configuration nor hosted application credentials.

For a project Pages URL such as `https://ddupasquier.github.io/blendCalc/`:

```bash
npm run docs -- build --base /blendCalc/
```

The workflow derives the project path from the repository name and uploads
**`dist/documentation`**, not the repository or raw `docs/` directory, using GitHub’s
[custom-workflow deployment procedure](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
The output contains `.nojekyll`, normal directory `index.html` pages and a 404 page;
it does not depend on single-page-app routing. Assets, navigation and search retain the
configured base path. Use `/` for a custom-domain root.

To inspect the project-path build before publishing:

```bash
npm run docs -- dev --base /blendCalc/
```

Open [http://localhost:4178/blendCalc/](http://localhost:4178/blendCalc/).

Building or previewing never enables Pages, commits files or publishes anything.
