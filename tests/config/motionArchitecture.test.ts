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

describe("functional motion architecture", () => {
	it("routes JavaScript-driven Svelte transition timing through reduced-motion handling", () => {
		const unsafeTransitionFiles = getSvelteFiles(sourceRoot)
			.filter((path) => readFileSync(path, "utf8").includes("transition:"))
			.filter(
				(path) =>
					!readFileSync(path, "utf8").includes("getMotionSafeDuration"),
			)
			.map((path) => path.slice(process.cwd().length + 1));

		expect(unsafeTransitionFiles).toEqual([]);
	});
});
