import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const excludedDocumentationDirectories = new Set(["QA", "local-context"]);

const collectMarkdownFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (entry.isDirectory()) {
			if (excludedDocumentationDirectories.has(entry.name)) return [];
			return collectMarkdownFiles(`${directory}/${entry.name}`);
		}
		return extname(entry.name) === ".md" ? [`${directory}/${entry.name}`] : [];
	});

const maintainedDocumentationFiles = [
	"README.md",
	"AGENTS.md",
	"scripts/README.md",
	...collectMarkdownFiles("docs"),
];

const removeFencedCode = (source: string) => source.replace(/```[\s\S]*?```/g, "");

describe("documentation quality", () => {
	it("keeps every local Markdown link pointed at an existing file or directory", () => {
		const brokenLinks: string[] = [];

		for (const documentationFile of maintainedDocumentationFiles) {
			const source = removeFencedCode(readFileSync(documentationFile, "utf8"));
			for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
				const link = match[1].trim();
				if (/^(?:https?:|mailto:|#)/.test(link)) continue;

				const target = link.split("#")[0].split("?")[0];
				if (!target) continue;

				const targetPath = resolve(dirname(documentationFile), decodeURIComponent(target));
				if (!existsSync(targetPath)) brokenLinks.push(`${documentationFile}: ${link}`);
			}
		}

		expect(brokenLinks).toEqual([]);
	});

	it("keeps documented npm commands backed by package scripts", () => {
		const packageScripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as
			| Record<string, string>
			| undefined;
		const unknownCommands: string[] = [];

		for (const documentationFile of maintainedDocumentationFiles) {
			const source = readFileSync(documentationFile, "utf8");
			for (const match of source.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
				if (!packageScripts?.[match[1]]) {
					unknownCommands.push(`${documentationFile}: npm run ${match[1]}`);
				}
			}
		}

		expect(unknownCommands).toEqual([]);
	});

	it("keeps concrete inline repository paths pointed at existing files", () => {
		const missingPaths: string[] = [];

		for (const documentationFile of maintainedDocumentationFiles) {
			const source = readFileSync(documentationFile, "utf8");
			for (const match of source.matchAll(
				/`((?:src|tests|scripts|supabase|static)\/[^`\n]+)`/g,
			)) {
				let target = match[1].replace(/[.,;:]$/, "").replace(/:\d+(?::\d+)?$/, "");
				if (/[<{*]|\.\.\./.test(target)) continue;
				target = target.split("#")[0];
				if (!existsSync(target)) missingPaths.push(`${documentationFile}: ${target}`);
			}
		}

		expect(missingPaths).toEqual([]);
	});

	it("keeps every UI behavior contract reachable from its stable index", () => {
		const uiBehaviorIndex = readFileSync("docs/ui-functionality.md", "utf8");
		const viewContracts = collectMarkdownFiles("docs/ui-functionality");

		for (const viewContract of viewContracts) {
			expect(uiBehaviorIndex).toContain(viewContract.replace("docs/", ""));
		}
	});

	it("keeps current user-facing behavior docs free of retired product terms", () => {
		const currentProductDocumentation = [
			"README.md",
			"docs/ui-functionality.md",
			...collectMarkdownFiles("docs/ui-functionality"),
		]
			.map((file) => readFileSync(file, "utf8"))
			.join("\n");

		for (const retiredTerm of [
			"Saved Drinks",
			"Smart Warnings",
			"Radar / Point Shape",
			"On Hand",
		]) {
			expect(currentProductDocumentation).not.toContain(retiredTerm);
		}
	});
});
