import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const trackedRepositoryPaths = new Set(
	execFileSync("git", ["ls-files"], { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter(Boolean),
);
const trackedRepositoryDirectories = new Set(
	[...trackedRepositoryPaths].flatMap((path) => {
		const segments = path.split("/");
		return segments
			.slice(1)
			.map((_, index) => segments.slice(0, index + 1).join("/"));
	}),
);
const documentedRuntimeOnlyPaths = new Set([
	"scripts/output",
	"supabase/functions/.env.local",
]);

const repositoryRelativePath = (path: string): string =>
	relative(process.cwd(), resolve(path))
		.replaceAll("\\", "/")
		.replace(/\/$/, "");

const isDocumentedRuntimeOnlyPath = (path: string): boolean =>
	documentedRuntimeOnlyPaths.has(repositoryRelativePath(path));

const isTrackedRepositoryPath = (path: string): boolean => {
	const repositoryPath = repositoryRelativePath(path);
	return (
		trackedRepositoryPaths.has(repositoryPath) ||
		trackedRepositoryDirectories.has(repositoryPath)
	);
};

const collectMarkdownFiles = (directory: string): string[] =>
	maintainedDocumentationFiles.filter((path) =>
		path.startsWith(`${directory}/`),
	);

const maintainedDocumentationFiles = [...trackedRepositoryPaths]
	.filter(
		(path) =>
			path.endsWith(".md") &&
			(path === "README.md" ||
				path === "scripts/README.md" ||
				path.startsWith("docs/")),
	)
	.sort();

const removeFencedCode = (source: string) =>
	source.replace(/```[\s\S]*?```/g, "");
const createHeadingAnchor = (heading: string): string =>
	heading
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[`*_~]/g, "")
		.replace(/<[^>]+>/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^\p{L}\p{N}\s_-]/gu, "")
		.replace(/\s/g, "-");

const collectDocumentAnchors = (source: string): Set<string> => {
	const anchors = new Set<string>();
	const headingCounts = new Map<string, number>();

	for (const match of source.matchAll(/\bid=["']([^"']+)["']/g)) {
		anchors.add(match[1]);
	}
	for (const match of removeFencedCode(source).matchAll(/^#{1,6}\s+(.+)$/gm)) {
		const baseAnchor = createHeadingAnchor(match[1]);
		const duplicateCount = headingCounts.get(baseAnchor) ?? 0;
		headingCounts.set(baseAnchor, duplicateCount + 1);
		anchors.add(
			duplicateCount === 0 ? baseAnchor : `${baseAnchor}-${duplicateCount}`,
		);
	}

	return anchors;
};

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

				const targetPath = resolve(
					dirname(documentationFile),
					decodeURIComponent(target),
				);
				if (!existsSync(targetPath) || !isTrackedRepositoryPath(targetPath)) {
					brokenLinks.push(`${documentationFile}: ${link}`);
				}
			}
		}

		expect(brokenLinks).toEqual([]);
	});

	it("keeps local Markdown section links pointed at real anchors", () => {
		const brokenSectionLinks: string[] = [];
		const anchorCache = new Map<string, Set<string>>();

		for (const documentationFile of maintainedDocumentationFiles) {
			const source = removeFencedCode(readFileSync(documentationFile, "utf8"));
			for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
				const link = match[1].trim();
				if (/^(?:https?:|mailto:)/.test(link) || !link.includes("#")) continue;

				const [target, encodedFragment] = link.split("#", 2);
				if (!encodedFragment) continue;
				const targetPath = target
					? resolve(
							dirname(documentationFile),
							decodeURIComponent(target.split("?")[0]),
						)
					: resolve(documentationFile);
				if (!existsSync(targetPath) || !isTrackedRepositoryPath(targetPath))
					continue;

				let anchors = anchorCache.get(targetPath);
				if (!anchors) {
					anchors = collectDocumentAnchors(readFileSync(targetPath, "utf8"));
					anchorCache.set(targetPath, anchors);
				}
				const fragment = decodeURIComponent(encodedFragment).toLowerCase();
				if (!anchors.has(fragment)) {
					brokenSectionLinks.push(`${documentationFile}: ${link}`);
				}
			}
		}

		expect(brokenSectionLinks).toEqual([]);
	});

	it("keeps documented npm commands backed by package scripts", () => {
		const packageScripts = JSON.parse(readFileSync("package.json", "utf8"))
			.scripts as Record<string, string> | undefined;
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
				let target = match[1]
					.replace(/[.,;:]$/, "")
					.replace(/:\d+(?::\d+)?$/, "");
				if (/[<{*]|\.\.\./.test(target)) continue;
				target = target.split("#")[0];
				if (
					(!existsSync(target) || !isTrackedRepositoryPath(target)) &&
					!isDocumentedRuntimeOnlyPath(target)
				) {
					missingPaths.push(`${documentationFile}: ${target}`);
				}
			}
		}

		expect(missingPaths).toEqual([]);
	});

	it("keeps every UI behavior contract reachable from its stable index", () => {
		const uiBehaviorIndex = readFileSync(
			"docs/development/ui-functionality.md",
			"utf8",
		);
		const viewContracts = collectMarkdownFiles(
			"docs/development/ui-functionality",
		);

		for (const viewContract of viewContracts) {
			expect(uiBehaviorIndex).toContain(
				viewContract.replace("docs/development/", ""),
			);
		}
	});

	it("gives long maintained documents a compact navigation table", () => {
		const missingNavigation: string[] = [];
		const navigationHeading =
			/^## (?:Quick Navigation|Guide Navigation|Schema Navigation|Ledger Navigation|Rule Groups)$/m;

		for (const documentationFile of maintainedDocumentationFiles) {
			const source = readFileSync(documentationFile, "utf8");
			if (source.split("\n").length < 150) continue;

			const navigation = navigationHeading.exec(source);
			const beginsNearTop =
				navigation !== null &&
				source.slice(0, navigation.index).split("\n").length <= 120;
			const navigationWindow = navigation
				? source.slice(navigation.index, navigation.index + 4_000)
				: "";
			const containsTable = /^\|.+\|$/m.test(navigationWindow);

			if (!beginsNearTop || !containsTable) {
				missingNavigation.push(documentationFile);
			}
		}

		expect(missingNavigation).toEqual([]);
	});

	it("keeps current user-facing behavior docs free of retired product terms", () => {
		const currentProductDocumentation = [
			"README.md",
			"docs/user/README.md",
			"docs/development/ui-functionality.md",
			...collectMarkdownFiles("docs/development/ui-functionality"),
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
