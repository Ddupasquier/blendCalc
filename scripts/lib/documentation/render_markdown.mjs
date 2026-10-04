/**
 * Purpose: Render public Markdown with stable anchors and checked repository links.
 * Do not run directly; imported by the documentation builder and its tests.
 */
import { Marked, Renderer } from "marked";
import { posix } from "node:path";
import { repositoryOnlyDocumentation } from "../../../config/documentation/navigation.mjs";

/** @typedef {typeof import('../../../config/documentation/navigation.mjs').documentationPages[number]} DocumentationPage */
/** @typedef {{id: string, title: string, depth: number}} DocumentationHeading */
/** @param {unknown} value */
export const escapeHtml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(character) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				character
			] ?? character,
	);

/** @param {string} html */
export const plainText = (html) =>
	html.replace(/<[^>]*>/g, "").replace(
		/&(?:amp|lt|gt|quot|#39);/g,
		(entity) =>
			({
				"&amp;": "&",
				"&lt;": "<",
				"&gt;": ">",
				"&quot;": '"',
				"&#39;": "'",
			})[
				/** @type {'&amp;' | '&lt;' | '&gt;' | '&quot;' | '&#39;'} */ (entity)
			],
	);

/** @param {string} text */
export const headingSlug = (text) =>
	text
		.toLowerCase()
		.trim()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.replace(/\s/g, "-");

export function normalizeBase(base = "/") {
	if (
		!/^\/(?:[\w.-]+\/)*$/.test(base) ||
		base.split("/").some((segment) => segment === "." || segment === "..")
	) {
		throw new Error(
			"Documentation base must be / or a slash-terminated path such as /blendCalc/.",
		);
	}
	return base;
}

/**
 * @param {string} href
 * @param {string} source
 * @param {DocumentationPage[]} pages
 * @param {string} base
 * @param {Set<string>} repositoryPaths
 */
export function rewriteLink(href, source, pages, base, repositoryPaths) {
	if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
		throw new Error(`Unsupported link scheme in ${source}`);
	}
	const [pathAndQuery, fragment = ""] = href.split("#");
	const [linkPath, query = ""] = pathAndQuery.split("?");
	const target = posix.normalize(
		posix.join(posix.dirname(source), decodeURIComponent(linkPath)),
	);
	const page = pages.find((candidate) => candidate.source === target);
	const suffix = `${query ? `?${query}` : ""}${fragment ? `#${fragment}` : ""}`;
	if (page) return `${base}${page.route}${suffix}`;
	const directoryPage = pages.find(
		(candidate) =>
			candidate.source === `${target.replace(/\/$/, "")}/README.md`,
	);
	if (directoryPage) return `${base}${directoryPage.route}${suffix}`;
	if (
		!repositoryPaths.has(target) &&
		![...repositoryPaths].some((path) => path.startsWith(`${target}/`))
	) {
		throw new Error(
			`Unlisted or missing documentation target: ${source} → ${target}`,
		);
	}
	if (target.endsWith(".md") && !repositoryOnlyDocumentation.has(target))
		throw new Error(`Markdown target lacks site metadata: ${target}`);
	if (target === "static/api/v1/openapi.json")
		return `${base}assets/openapi.json${suffix}`;
	const isDirectory = !repositoryPaths.has(target);
	return `https://github.com/Ddupasquier/blendCalc/${isDirectory ? "tree" : "blob"}/main/${target}${suffix}`;
}

/**
 * @param {string} markdown
 * @param {{page: DocumentationPage, pages: DocumentationPage[], base: string, repositoryPaths: Set<string>}} options
 */
export function renderMarkdown(
	markdown,
	{ page, pages, base, repositoryPaths },
) {
	/** @type {DocumentationHeading[]} */
	const headings = [];
	const duplicates = new Map();
	/** @type {string[]} */
	const links = [];
	const defaultRenderer = new Renderer();
	/** @type {import('marked').RendererObject} */
	const renderer = {
		heading({ tokens, depth }) {
			const text = this.parser.parseInline(tokens);
			const title = plainText(text);
			const slug = headingSlug(title);
			const count = duplicates.get(slug) ?? 0;
			duplicates.set(slug, count + 1);
			const id = count ? `${slug}-${count}` : slug;
			headings.push({ id, title, depth });
			return `<h${depth} id="${escapeHtml(id)}">${text}<a class="heading-anchor" href="#${escapeHtml(id)}" aria-label="Link to ${escapeHtml(title)}">#</a></h${depth}>\n`;
		},
		link(token) {
			const href = rewriteLink(
				token.href,
				page.source,
				pages,
				base,
				repositoryPaths,
			);
			links.push(href);
			return `<a href="${escapeHtml(href)}"${token.title ? ` title="${escapeHtml(token.title)}"` : ""}>${this.parser.parseInline(token.tokens)}</a>`;
		},
		image(token) {
			const href = rewriteLink(
				token.href,
				page.source,
				pages,
				base,
				repositoryPaths,
			);
			return `<img src="${escapeHtml(href)}" alt="${escapeHtml(token.text)}" loading="lazy">`;
		},
		code({ text, lang }) {
			const language = (lang ?? "text").split(/\s/)[0];
			return `<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(language)}</span><button class="copy-button" type="button" aria-label="Copy ${escapeHtml(language)} code">Copy</button></div><pre tabindex="0" aria-label="${escapeHtml(language)} code"><code>${escapeHtml(text)}</code></pre><span class="copy-status sr-only" role="status"></span></div>`;
		},
		table(token) {
			return `<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable reference table">${defaultRenderer.table.call(this, token)}</div>`;
		},
		blockquote(token) {
			const html = this.parser.parse(token.tokens);
			const match = html.match(
				/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/,
			);
			if (!match) return `<blockquote>${html}</blockquote>`;
			return `<aside class="callout callout--${match[1].toLowerCase()}" aria-label="${match[1].toLowerCase()}"><strong>${match[1].toLowerCase()}</strong>${html.replace(match[0], "<p>")}</aside>`;
		},
		html({ text }) {
			// Repository-authored Markdown only; no executable or styled HTML enters the site.
			if (
				/<\/?(?:script|style|iframe|object|embed|form|input)\b|\son\w+\s*=|\sstyle\s*=/i.test(
					text,
				)
			) {
				throw new Error(`Executable HTML is not supported in ${page.source}`);
			}
			return text.replace(
				/\b(href|src)="([^"]+)"/g,
				(_match, attribute, href) => {
					const rewritten = rewriteLink(
						href,
						page.source,
						pages,
						base,
						repositoryPaths,
					);
					if (attribute === "href") links.push(rewritten);
					return `${attribute}="${escapeHtml(rewritten)}"`;
				},
			);
		},
	};
	const parser = new Marked({ gfm: true, renderer });
	return { html: parser.parse(markdown, { async: false }), headings, links };
}
