import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");

const getSvelteFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return getSvelteFiles(path);
		return entry.isFile() && entry.name.endsWith(".svelte") ? [path] : [];
	});

describe("collapsible motion architecture", () => {
	it("routes every native details disclosure through the shared animation behavior", () => {
		const unanimatedDetails = getSvelteFiles(sourceRoot).flatMap((path) => {
			const source = readFileSync(path, "utf8");
			return [...source.matchAll(/<details\b[\s\S]*?>/g)]
				.filter(([tag]) => !tag.includes("use:animatedDetails"))
				.map(() => path.slice(process.cwd().length + 1));
		});

		expect(unanimatedDetails).toEqual([]);
	});
});
