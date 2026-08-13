import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const applicationSourceRoot = join(process.cwd(), "src");
const sharedNavigatorPath = join(
	applicationSourceRoot,
	"lib",
	"utils",
	"navigation",
	"shallowRouteNavigation.ts",
);

const listSourceFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return listSourceFiles(path);
		return [".svelte", ".ts"].includes(extname(entry.name)) ? [path] : [];
	});

describe("shallow route navigation architecture", () => {
	it("keeps raw shallow-history writes inside the shared navigator", () => {
		const directShallowHistoryWriters = listSourceFiles(applicationSourceRoot)
			.filter((path) => path !== sharedNavigatorPath)
			.filter((path) => /\b(pushState|replaceState)\s*\(/.test(readFileSync(path, "utf8")))
			.map((path) => path.slice(process.cwd().length + 1));

		expect(directShallowHistoryWriters).toEqual([]);
	});
});
