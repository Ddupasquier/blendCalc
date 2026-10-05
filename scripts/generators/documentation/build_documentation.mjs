/**
 * Purpose: Generate and validate the public static documentation site.
 * Run: `npm run docs -- build [--base /blendCalc/]`
 * Writes only generated public documentation beneath dist/documentation.
 * Never reads environment values, private workspace content or application data.
 */
import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import {
	documentationPages,
	documentationSections,
	publishedReferenceSections,
	repositoryOnlyReferenceSections,
	repositoryOnlyDocumentation,
} from "../../../config/documentation/navigation.mjs";
import {
	normalizeBase,
	renderMarkdown,
} from "../../lib/documentation/render_markdown.mjs";
import { renderSite } from "../../lib/documentation/render_site.mjs";

export const repositoryRoot = fileURLToPath(
	new URL("../../../", import.meta.url),
);
export const documentationOutput = resolve(
	repositoryRoot,
	"dist/documentation",
);

export function buildDocumentation({
	base = "/",
	output = documentationOutput,
} = {}) {
	if (Number(process.versions.node.split(".")[0]) !== 24)
		throw new Error("Documentation commands require Node.js 24.");
	base = normalizeBase(base);
	output = resolve(output);
	const marker = ".blendcalc-documentation-output";
	if (
		existsSync(output) &&
		readdirSync(output).length &&
		(!existsSync(resolve(output, marker)) ||
			readFileSync(resolve(output, marker), "utf8") !==
				"Generated BlendCalc public documentation.\n")
	)
		throw new Error(
			"Refusing to replace a directory not owned by the documentation builder.",
		);
	const repositoryPaths = new Set(
		execFileSync(
			"git",
			["ls-files", "--cached", "--others", "--exclude-standard"],
			{ cwd: repositoryRoot, encoding: "utf8" },
		)
			.trim()
			.split("\n"),
	);
	const publicMarkdown = [...repositoryPaths].filter(
		(path) =>
			path.endsWith(".md") &&
			(path === "README.md" ||
				path === "scripts/README.md" ||
				/^docs\/(?:README\.md|development\/|user\/)/.test(path)),
	);
	const missing = publicMarkdown.filter(
		(source) =>
			!repositoryOnlyDocumentation.has(source) &&
			!documentationPages.some((page) => page.source === source),
	);
	if (missing.length)
		throw new Error(
			`Classify these sources as public or repository-only: ${missing.join(", ")}`,
		);
	if (
		new Set(documentationPages.map(({ route }) => route)).size !==
			documentationPages.length ||
		new Set(documentationPages.map(({ source }) => source)).size !==
			documentationPages.length
	)
		throw new Error("Duplicate documentation route or source.");
	const { version } = JSON.parse(
		readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
	);
	const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: repositoryRoot,
		encoding: "utf8",
	}).trim();
	/** @type {Map<string, Set<string>>} */
	const omittedFragments = new Map();
	const documents = documentationPages.map((page) => {
		if (
			!repositoryPaths.has(page.source) ||
			!publicMarkdown.includes(page.source)
		)
			throw new Error(`Not a public documentation source: ${page.source}`);
		const markdown = readFileSync(resolve(repositoryRoot, page.source), "utf8");
		const rendered = renderMarkdown(markdown, {
			page,
			pages: documentationPages,
			base,
			repositoryPaths,
		});
		const selectedSections = publishedReferenceSections.get(page.source);
		const privateSections =
			repositoryOnlyReferenceSections.get(page.source) ?? [];
		if (selectedSections || privateSections.length) {
			const projection = new JSDOM(`<article>${rendered.html}</article>`);
			const article = projection.window.document.querySelector("article");
			if (!article)
				throw new Error(`Missing reference content: ${page.source}`);
			for (const id of [...(selectedSections ?? []), ...privateSections])
				if (!projection.window.document.getElementById(id))
					throw new Error(
						`Review changed reference section: ${page.source}#${id}`,
					);
			let excludedDepth = 0;
			for (const element of [...article.children]) {
				const depth = /^H[1-6]$/.test(element.tagName)
					? Number(element.tagName[1])
					: 0;
				if (depth && excludedDepth && depth <= excludedDepth) excludedDepth = 0;
				if (
					(depth === 2 &&
						selectedSections &&
						!selectedSections.includes(element.id)) ||
					(depth && privateSections.includes(element.id))
				)
					excludedDepth = depth;
				if (excludedDepth) element.remove();
			}
			const retainedIds = new Set(
				[...article.querySelectorAll("[id]")].map((element) => element.id),
			);
			omittedFragments.set(
				page.source,
				new Set(
					rendered.headings
						.filter((heading) => !retainedIds.has(heading.id))
						.map((heading) => heading.id),
				),
			);
			rendered.headings = rendered.headings.filter((heading) =>
				retainedIds.has(heading.id),
			);
			rendered.html = article.innerHTML;
			projection.window.close();
		}
		const html = renderSite({
			page,
			pages: documentationPages,
			sections: documentationSections,
			version,
			base,
			content: rendered.html,
			headings: rendered.headings,
		});
		const dom = new JSDOM(html);
		const document = dom.window.document;
		const ids = [...document.querySelectorAll("[id]")].map(
			(element) => element.id,
		);
		if (new Set(ids).size !== ids.length)
			throw new Error(
				`Duplicate heading or shell ID: ${page.source}: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(", ")}`,
			);
		const links = [...document.querySelectorAll("a[href]")].map(
			(link) => link.getAttribute("href") ?? "",
		);
		const entries = [
			{
				title: page.title,
				section: page.section,
				url: `${base}${page.route}`,
				text: page.description,
			},
		];
		const article = document.querySelector("article");
		if (!article) throw new Error(`Missing article: ${page.source}`);
		let entry = {
			title: page.title,
			section: page.section,
			url: `${base}${page.route}`,
			text: "",
		};
		for (const element of article.children) {
			if (/^H[23]$/.test(element.tagName)) {
				if (entry.text.trim()) entries.push(entry);
				entry = {
					title: (element.textContent ?? "").replace(/#$/, ""),
					section: `${page.title} · ${page.section}`,
					url: `${base}${page.route}#${element.id}`,
					text: "",
				};
			} else
				entry.text += ` ${(element.textContent ?? "").replace(/\s+/g, " ")}`;
		}
		if (entry.text.trim()) entries.push(entry);
		dom.window.close();
		return { page, html, ids: new Set(ids), links, entries };
	});
	// Links to omitted operating sections still work, but open the repository source.
	for (const document of documents) {
		const dom = new JSDOM(document.html);
		for (const link of dom.window.document.querySelectorAll("a[href]")) {
			const href = link.getAttribute("href") ?? "";
			if (
				/^https:\/\/github\.com\/Ddupasquier\/blendCalc\/(?:blob|tree)\/main\//.test(
					href,
				)
			) {
				const replacement = href.replace("/main/", `/${sourceRevision}/`);
				link.setAttribute("href", replacement);
				document.links = document.links.map((value) =>
					value === href ? replacement : value,
				);
				continue;
			}
			if (!href.startsWith(base) && !href.startsWith("#")) continue;
			const [route, fragment] = href.startsWith("#")
				? [document.page.route, href.slice(1)]
				: href.slice(base.length).split("#");
			const target = documentationPages.find(
				(page) => page.route === route.split("?")[0],
			);
			if (
				target &&
				fragment &&
				omittedFragments.get(target.source)?.has(decodeURIComponent(fragment))
			) {
				const replacement = `https://github.com/Ddupasquier/blendCalc/blob/${sourceRevision}/${target.source}#${fragment}`;
				link.setAttribute("href", replacement);
				document.links = document.links.map((value) =>
					value === href ? replacement : value,
				);
			}
		}
		for (const image of dom.window.document.querySelectorAll("img[src]")) {
			const source = image.getAttribute("src") ?? "";
			if (
				/^https:\/\/github\.com\/Ddupasquier\/blendCalc\/(?:blob|tree)\/main\//.test(
					source,
				)
			)
				image.setAttribute(
					"src",
					source.replace("/main/", `/${sourceRevision}/`),
				);
		}
		document.html = dom.serialize();
		dom.window.close();
	}
	const index = documents.flatMap((document) => document.entries);
	let checkedLinks = 0;
	for (const { page, links } of documents) {
		for (const href of links) {
			if (!href.startsWith(base) && !href.startsWith("#")) continue;
			if (href.startsWith(`${base}assets/`)) continue;
			const [route, fragment] = href.startsWith("#")
				? [page.route, href.slice(1)]
				: href.slice(base.length).split("#");
			const target = documents.find(
				(item) => item.page.route === route.split("?")[0],
			);
			if (
				!target ||
				(fragment && !target.ids.has(decodeURIComponent(fragment)))
			)
				throw new Error(`Broken generated link: ${page.source} → ${href}`);
			checkedLinks++;
		}
	}
	// Build a fresh generation so removed pages cannot linger in published artifacts.
	mkdirSync(dirname(output), { recursive: true });
	const generation = mkdtempSync(
		resolve(dirname(output), ".blendcalc-docs-build-"),
	);
	try {
		/** @param {string} path @param {string} content */
		const write = (path, content) => {
			const destination = resolve(generation, path);
			mkdirSync(dirname(destination), { recursive: true });
			writeFileSync(destination, content);
		};
		for (const { page, html } of documents) {
			write(`${page.route}index.html`, html);
			// Directory aliases work on Pages without pretending .md files have an HTML MIME type.
			write(`${page.source}/index.html`, html);
		}
		write("search-index.json", JSON.stringify(index));
		write(".nojekyll", "");
		write(
			"404.html",
			documents[0].html
				.replace("BlendCalc,<br />well documented.", "That page wandered off.")
				.replace(
					"Find the guide you need. Everything in one place.",
					"Use the menu or search to find your way back.",
				),
		);
		const assets = [
			["config/documentation/site.css", "site.css"],
			["config/documentation/site.js", "site.js"],
			["config/documentation/theme.js", "theme.js"],
			["src/lib/assets/favicon.svg", "favicon.svg"],
			["static/api/v1/openapi.json", "openapi.json"],
			[
				"node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
				"dm-sans.woff2",
			],
			[
				"node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
				"plus-jakarta-sans.woff2",
			],
			[
				"node_modules/@fontsource-variable/dm-sans/LICENSE",
				"dm-sans-LICENSE.txt",
			],
			[
				"node_modules/@fontsource-variable/plus-jakarta-sans/LICENSE",
				"plus-jakarta-sans-LICENSE.txt",
			],
		];
		for (const [source, name] of assets) {
			if (!existsSync(resolve(repositoryRoot, source)))
				throw new Error(`Missing documentation asset: ${source}`);
			mkdirSync(resolve(generation, "assets"), { recursive: true });
			copyFileSync(
				resolve(repositoryRoot, source),
				resolve(generation, "assets", name),
			);
		}
		write(marker, "Generated BlendCalc public documentation.\n");
		const previous = `${generation}-previous`;
		const hadPrevious = existsSync(output);
		if (hadPrevious) renameSync(output, previous);
		try {
			renameSync(generation, output);
		} catch (error) {
			if (hadPrevious) renameSync(previous, output);
			throw error;
		}
		if (hadPrevious) rmSync(previous, { recursive: true });
		return {
			pages: documents.length,
			checkedLinks,
			searchEntries: index.length,
			version,
			base,
		};
	} finally {
		if (existsSync(generation)) rmSync(generation, { recursive: true });
	}
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2);
	let base = "/";
	let output = documentationOutput;
	for (let index = 0; index < args.length; index += 2) {
		if (args[index] === "--base") base = normalizeBase(args[index + 1]);
		else if (
			args[index] === "--preview-port" &&
			/^\d+$/.test(args[index + 1] ?? "")
		)
			output = resolve(
				repositoryRoot,
				`dist/documentation-preview-${args[index + 1]}`,
			);
		else throw new Error("Usage: npm run docs -- build [--base /blendCalc/]");
	}
	console.log("Documentation build:", buildDocumentation({ base, output }));
}
