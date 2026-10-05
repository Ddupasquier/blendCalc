/**
 * Purpose: Wrap existing public documentation in the shared branded static shell.
 * Do not run directly; imported by the documentation builder.
 */
import { escapeHtml } from "./render_markdown.mjs";

/** @typedef {typeof import('../../../config/documentation/navigation.mjs').documentationPages[number]} DocumentationPage */
/** @typedef {typeof import('../../../config/documentation/navigation.mjs').documentationSections} DocumentationSections */
/** @typedef {import('./render_markdown.mjs').DocumentationHeading} DocumentationHeading */

/** @param {string} name */
const icon = (name) => {
	/** @type {Record<string, string>} */
	const paths = {
		search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
		menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
		theme: '<path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/>',
		arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
		leaf: '<path d="M20 4c-12-2-18 8-12 13s14-1 12-13ZM5 20 15 9"/>',
		book: '<path d="M12 6c-3-3-8-2-9-1v15c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-1-6-2-9 1Zm0 0v14"/>',
		code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
	};
	return /* HTML */ `<svg
		viewBox="0 0 24 24"
		width="20"
		height="20"
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		${paths[name] ?? paths.arrow}
	</svg>`;
};

/** @param {DocumentationSections} sections @param {string} current @param {string} base */
export function renderNavigation(sections, current, base) {
	return sections
		.map(
			(section) =>
				/* HTML */ ` <section class="nav-section">
					<h2>${escapeHtml(section.title)}</h2>
					<ul>
						${section.pages.map(([_source, route, title]) => /* HTML */ `<li><a href="${base}${route}" ${route === current ? ' aria-current="page"' : ""}>${escapeHtml(title)}</a></li>`).join("")}
					</ul>
				</section>`,
		)
		.join("");
}

/** @param {string} base */
function renderHero(base) {
	return /* HTML */ ` <section class="hero" aria-labelledby="hero-title">
			<div class="hero-copy">
				<p class="eyebrow">A little clarity. A better blend.</p>
				<h1 id="hero-title">BlendCalc,<br />well documented.</h1>
				<p class="hero-description">
					Find the guide you need. Everything in one place.
				</p>
				<div class="hero-actions">
					<a class="button button--primary" href="${base}user/"
						>Get started ${icon("arrow")}</a
					>
					<a class="button button--outline" href="#guides"
						>Browse guides ${icon("book")}</a
					>
				</div>
				<div class="setup-snippet code-block">
					<div class="code-toolbar">
						<span>Project setup · Node 24</span
						><button
							class="copy-button"
							type="button"
							aria-label="Copy setup command"
						>
							Copy
						</button>
					</div>
					<pre tabindex="0" aria-label="Setup command"><code>nvm use 24
npm ci --ignore-scripts</code></pre>
					<span class="copy-status sr-only" role="status"></span>
				</div>
			</div>
			<div class="hero-art" aria-hidden="true">
				<div class="art-orbit"></div>
				<div class="cup-tile">
					<img
						src="${base}assets/favicon.svg"
						alt=""
						width="160"
						height="160"
					/><span>Made to make sense.</span>
				</div>
				<div class="art-chip art-chip--top">
					${icon("leaf")} Know your food.
				</div>
				<div class="art-chip art-chip--bottom">
					${icon("code")} Build with care.
				</div>
				<span class="art-spark art-spark--one">✦</span
				><span class="art-spark art-spark--two">+</span>
			</div>
		</section>
		<section class="pathways" aria-labelledby="pathways-title">
			<div class="section-heading">
				<h2 id="pathways-title">Quick links</h2>
			</div>
			<div class="pathway-grid">
				<a class="pathway" href="${base}user/"
					><span class="pathway-icon">${icon("leaf")}</span>
					<h3>Using BlendCalc</h3>
					<p>Ingredients, Mix and saved recipes.</p>
					<span class="pathway-action">View guide ${icon("arrow")}</span></a
				>
				<a class="pathway" href="${base}development/data-architecture/"
					><span class="pathway-icon pathway-icon--lilac">${icon("code")}</span>
					<h3>Architecture</h3>
					<p>Data, boundaries and ownership.</p>
					<span class="pathway-action">View guide ${icon("arrow")}</span></a
				>
				<a class="pathway" href="${base}development/style-guide/"
					><span class="pathway-icon pathway-icon--peach">${icon("book")}</span>
					<h3>Design system</h3>
					<p>Colors, typography and components.</p>
					<span class="pathway-action">View guide ${icon("arrow")}</span></a
				>
			</div>
		</section>`;
}

/** @param {DocumentationSections} sections @param {string} base */
function renderDirectory(sections, base) {
	return /* HTML */ `<div id="guides" class="doc-directory">
		<span id="blendcalc-documentation"></span>${sections
			.map(
				(section) =>
					/* HTML */ `<section>
						<h2>${escapeHtml(section.title)}</h2>
						<ul>
							${section.pages
								.map(
									([_source, route, title, description]) =>
										/* HTML */ `<li>
											<a href="${base}${route}">${escapeHtml(title)}</a>
											<p>${escapeHtml(description)}</p>
										</li>`,
								)
								.join("")}
						</ul>
					</section>`,
			)
			.join("")}
	</div>`;
}

/** @param {(DocumentationPage | undefined)[]} adjacent @param {string} base */
function renderPagination(adjacent, base) {
	return adjacent
		.map((item, index) =>
			item
				? /* HTML */ ` <a
						href="${base}${item.route}"
						class="pagination-link${index ? " pagination-link--next" : ""}"
					>
						<span>${index ? "Up next" : "Previous"}</span>
						<strong>${escapeHtml(item.title)} ${index ? "→" : ""}</strong>
					</a>`
				: "<span></span>",
		)
		.join("");
}

/** @param {DocumentationHeading[]} headings */
function renderOutline(headings) {
	return headings
		.filter(({ depth }) => depth === 2 || depth === 3)
		.map(
			(heading) => /* HTML */ `
		<li${heading.depth === 3 ? ' class="outline-child"' : ""}><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a></li>`,
		)
		.join("");
}

/** @param {{page: DocumentationPage, sections: DocumentationSections, pages: DocumentationPage[], version: string, base: string, content: string, headings: DocumentationHeading[]}} options */
export function renderSite({
	page,
	sections,
	pages,
	version,
	base,
	content,
	headings,
}) {
	const home = page.route === "";
	const pageIndex = pages.findIndex((item) => item.source === page.source);
	const navigation = renderNavigation(sections, page.route, base);
	// Keep the source heading's established anchor without repeating the page title.
	const article = home
		? renderDirectory(sections, base)
		: content
				.replace(/<h1\b/, '<p class="source-title"')
				.replace(/<\/h1>/, "</p>");
	return /* HTML */ `<!doctype html>
		<html lang="en" data-theme="system">
			<head>
				<meta charset="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, viewport-fit=cover"
				/>
				<title>${escapeHtml(page.title)} · BlendCalc docs</title>
				<meta name="description" content="${escapeHtml(page.description)}" />
				<meta name="theme-color" content="#f8f8fb" />
				<meta name="color-scheme" content="light dark" />
				<meta
					http-equiv="Content-Security-Policy"
					content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
				/>
				<link
					rel="icon"
					type="image/svg+xml"
					href="${base}assets/favicon.svg"
				/>
				<link rel="stylesheet" href="${base}assets/site.css" />
				<script src="${base}assets/theme.js"></script>
				<script defer src="${base}assets/site.js"></script>
			</head>
			<body data-base="${base}">
				<a class="skip-link" href="#main">Skip to content</a>
				<header class="site-header">
					<a
						class="brand"
						href="${base}"
						aria-label="BlendCalc documentation home"
						><img
							src="${base}assets/favicon.svg"
							alt=""
							width="32"
							height="32"
						/><span>blendCalc</span><span class="brand-docs">docs</span></a
					>
					<span
						class="version"
						aria-label="Application version ${escapeHtml(version)}"
						>v${escapeHtml(version)}</span
					>
					<div class="header-actions">
						<button
							class="search-trigger"
							type="button"
							aria-label="Search documentation"
							aria-haspopup="dialog"
						>
							${icon("search")}<span>Search documentation</span><kbd>⌘ K</kbd>
						</button>
						<button
							class="icon-button theme-toggle"
							type="button"
							aria-label="Change color theme"
							title="Change color theme"
						>
							${icon("theme")}
						</button>
						<a
							class="github-link"
							href="https://github.com/Ddupasquier/blendCalc"
							>GitHub <span aria-hidden="true">↗</span></a
						>
						<button
							class="icon-button menu-toggle"
							type="button"
							aria-label="Open documentation menu"
							aria-haspopup="dialog"
						>
							${icon("menu")}
						</button>
					</div>
				</header>
				<aside class="desktop-sidebar">
					<nav aria-label="Documentation">${navigation}</nav>
					<p class="sidebar-note">
						A good recipe starts with<br />a little understanding.
					</p>
				</aside>
				<main
					id="main"
					tabindex="-1"
					class="site-main${home ? " site-main--home" : ""}"
				>
					${
						home
							? renderHero(base)
							: /* HTML */ `<div class="page-heading">
									<p class="eyebrow">${escapeHtml(page.section)}</p>
									<h1 class="page-title">${escapeHtml(page.title)}</h1>
									<p class="page-description">
										${escapeHtml(page.description)}
									</p>
								</div>`
					}
					<div class="reading-layout">
						<div class="reading-column">
							<article class="prose" aria-label="${escapeHtml(page.title)}">
								${article}
							</article>
							<nav class="page-pagination" aria-label="Previous and next pages">
								${renderPagination([pages[pageIndex - 1], pages[pageIndex + 1]], base)}
							</nav>
							<footer class="page-footer">
								<span>Made with care. Built for clarity.</span
								><a
									href="https://github.com/Ddupasquier/blendCalc/blob/main/${page.source}"
									>View this page on GitHub ↗</a
								>
							</footer>
						</div>
						${
							!home && headings.some(({ depth }) => depth === 2 || depth === 3)
								? /* HTML */ `<aside class="page-outline">
										<nav aria-label="On this page">
											<h2>On this page</h2>
											<ul>
												${renderOutline(headings)}
											</ul>
										</nav>
									</aside>`
								: ""
						}
					</div>
				</main>
				<dialog class="mobile-drawer" aria-label="Documentation menu">
					<div class="dialog-heading">
						<strong>Explore the docs</strong
						><button
							class="icon-button"
							type="button"
							data-close
							aria-label="Close documentation menu"
						>
							×
						</button>
					</div>
					<nav aria-label="Mobile documentation">${navigation}</nav>
				</dialog>
				<dialog class="search-dialog" aria-label="Search documentation">
					<div class="dialog-heading">
						<label for="docs-search">Find your next answer</label
						><button
							class="icon-button"
							type="button"
							data-close
							aria-label="Close search"
						>
							×
						</button>
					</div>
					<div class="search-input-wrap">
						${icon("search")}<input
							id="docs-search"
							type="search"
							placeholder="Try “Google sign-in” or “nutrition”"
							autocomplete="off"
							maxlength="160"
						/>
					</div>
					<p id="docs-search-status" role="status">
						Search pages and sections. Your query stays in this browser.
					</p>
					<div id="docs-search-results"></div>
					<div class="search-footer">
						Tab through results · Enter to open · Esc to close
					</div>
				</dialog>
				<noscript
					><p class="noscript-note">
						All guides and links work without JavaScript. Search, copying and
						the compact navigation drawer need JavaScript; use the
						<a href="${base}">documentation directory</a> to browse.
					</p></noscript
				>
			</body>
		</html>`;
}
