import {
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	documentationPages,
	documentationSections,
	repositoryOnlyDocumentation,
} from "../../config/documentation/navigation.mjs";
import { buildDocumentation } from "../../scripts/generators/documentation/build_documentation.mjs";
import {
	headingSlug,
	normalizeBase,
	renderMarkdown,
	rewriteLink,
} from "../../scripts/lib/documentation/render_markdown.mjs";

const temporaryOutput = mkdtempSync(join(tmpdir(), "blendcalc-docs-test-"));
afterAll(() => rmSync(temporaryOutput, { recursive: true }));
const repositoryPaths = new Set(documentationPages.map((page) => page.source));
const page = documentationPages.find(
	(item) => item.source === "docs/README.md",
)!;

describe("public static documentation", () => {
	it("puts user help first and clearly separates developer references", () => {
		expect(documentationSections.map((section) => section.title)).toEqual([
			"Start here",
			"For developers",
		]);
		expect(documentationSections[0].pages.map(([source]) => source)).toEqual([
			"docs/README.md",
			"docs/user/README.md",
		]);
	});
	it("builds every page, local link, source alias and section index beneath a Pages base", () => {
		const result = buildDocumentation({
			base: "/blendCalc/",
			output: temporaryOutput,
		});
		expect(result.pages).toBe(documentationPages.length);
		expect(result.checkedLinks).toBeGreaterThan(500);
		for (const document of documentationPages) {
			const output = readFileSync(
				join(temporaryOutput, document.route, "index.html"),
				"utf8",
			);
			expect(output).toContain('href="/blendCalc/assets/site.css"');
			expect(output).toMatch(
				/href="https:\/\/github\.com\/Ddupasquier\/blendCalc\/blob\/[a-f0-9]{40}\/docs\//,
			);
			expect(
				readFileSync(
					join(temporaryOutput, document.source, "index.html"),
					"utf8",
				),
			).toBe(output);
		}
		const index = JSON.parse(
			readFileSync(join(temporaryOutput, "search-index.json"), "utf8"),
		);
		expect(JSON.stringify(index)).not.toMatch(
			/DEV-\d+|QA-\d+|QA Moderation Fixtures|manage_blendCalcAPI_publication\.mjs|seed_catalog_submission\.mjs/,
		);
		const catalog = readFileSync(
			join(temporaryOutput, "development/shared-product-catalog/index.html"),
			"utf8",
		);
		expect(catalog).not.toContain('id="qa-moderation-fixtures"');
		const api = readFileSync(
			join(temporaryOutput, "development/blendCalcAPI/index.html"),
			"utf8",
		);
		expect(api).not.toContain('id="inspect-the-published-catalog-in-supabase"');
		expect(api).toContain('id="blendcalcapi-v1-status"');
		expect(
			index.some((entry: { url: string }) => entry.url.includes("#")),
		).toBe(true);
		expect(
			index.every((entry: { url: string }) =>
				entry.url.startsWith("/blendCalc/"),
			),
		).toBe(true);
		expect(readdirSync(temporaryOutput)).not.toContain("notes");
		for (const source of repositoryOnlyDocumentation)
			expect(existsSync(join(temporaryOutput, source))).toBe(false);
		expect(readdirSync(join(temporaryOutput, "docs"))).not.toContain(
			"workspace",
		);
	}, 30_000);

	it("retains GitHub-compatible heading fragments and duplicate suffixes", () => {
		expect(headingSlug("Accounts & OAuth — 24")).toBe("accounts--oauth--24");
		const result = renderMarkdown(
			'# Example\n\n## A *useful* `heading`\n\n## A useful heading\n\n<a id="stable-alias"></a>',
			{ page, pages: documentationPages, base: "/", repositoryPaths },
		);
		expect(result.headings.map((item: { id: string }) => item.id)).toEqual([
			"example",
			"a-useful-heading",
			"a-useful-heading-1",
		]);
		expect(result.html).toContain('id="stable-alias"');
	});

	it("replaces only marked build output and retires stale generated pages", () => {
		writeFileSync(
			join(temporaryOutput, "stale-generated.html"),
			"old generated page",
		);
		buildDocumentation({ output: temporaryOutput });
		expect(existsSync(join(temporaryOutput, "stale-generated.html"))).toBe(
			false,
		);
		const unowned = mkdtempSync(join(tmpdir(), "blendcalc-docs-unowned-"));
		try {
			writeFileSync(join(unowned, "keep.txt"), "do not replace");
			expect(() => buildDocumentation({ output: unowned })).toThrow(
				/not owned/,
			);
			expect(readFileSync(join(unowned, "keep.txt"), "utf8")).toBe(
				"do not replace",
			);
		} finally {
			rmSync(unowned, { recursive: true });
		}
	});

	it("publishes only generated docs from the explicitly selected branch", () => {
		const workflow = readFileSync(
			".github/workflows/documentation.yml",
			"utf8",
		);
		expect(workflow).toContain("path: dist/documentation");
		expect(workflow).toContain("needs: build");
		expect(workflow).toContain("vars.DOCS_PUBLISH_BRANCH || 'main'");
		expect(workflow).toContain("github.event_name != 'pull_request'");
		expect(workflow).toContain("npm ci --ignore-scripts");
		expect(workflow).toContain("pages: write");
		expect(workflow).not.toMatch(/supabase|vercel|secrets\./i);
	});

	it("rewrites Markdown and directory links without changing source fragments", () => {
		expect(
			rewriteLink(
				"user/README.md#ingredients",
				page.source,
				documentationPages,
				"/blendCalc/",
				repositoryPaths,
			),
		).toBe("/blendCalc/user/#ingredients");
		expect(
			rewriteLink(
				"user/",
				page.source,
				documentationPages,
				"/",
				repositoryPaths,
			),
		).toBe("/user/");
		expect(
			rewriteLink(
				"#existing",
				page.source,
				documentationPages,
				"/",
				repositoryPaths,
			),
		).toBe("#existing");
	});

	it("rejects unsupported URL schemes, unpublished files and unsafe bases", () => {
		for (const href of [
			"javascript:alert(1)",
			"//example.test",
			"workspace/context/working-context.md",
			"missing.md",
		])
			expect(() =>
				rewriteLink(
					href,
					page.source,
					documentationPages,
					"/",
					repositoryPaths,
				),
			).toThrow();
		for (const base of ["https://example.test/", "//", "/blendCalc", "/../../"])
			expect(() => normalizeBase(base)).toThrow();
	});

	it("escapes code, preserves callout content and refuses executable HTML", () => {
		const options = {
			page,
			pages: documentationPages,
			base: "/",
			repositoryPaths,
		};
		const rendered = renderMarkdown(
			"```html\n<script>alert('test')</script>\n```\n\n> [!WARNING]\n> Read this first.",
			options,
		);
		expect(rendered.html).toContain("&lt;script&gt;");
		expect(rendered.html).toContain("callout--warning");
		expect(rendered.html).toContain("Read this first.");
		expect(() =>
			renderMarkdown('<img src="x" onerror="alert(1)">', options),
		).toThrow();
		expect(() =>
			renderMarkdown("<script>alert(1)</script>", options),
		).toThrow();
	});
});
