import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const collectFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? collectFiles(path) : [path];
	});

describe("FoodData Central environment configuration", () => {
	it("documents the server-owned key in each environment that uses USDA lookups", () => {
		for (const environmentExamplePath of [
			".env.example",
			".env.moderation.example",
			".env.vercel.example",
		]) {
			const environmentExample = readFileSync(environmentExamplePath, "utf8");
			expect(environmentExample, environmentExamplePath).toMatch(
				/^FDC_API_KEY=$/m,
			);
		}

		expect(readFileSync("supabase/functions/.env.example", "utf8")).toMatch(
			/^USDA_API_KEY=$/m,
		);
	});

	it("removes the retired browser-prefixed key from runtime and script readers", () => {
		const retiredKey = ["VITE", "FDC", "API", "KEY"].join("_");
		const affectedSource = [...collectFiles("src"), ...collectFiles("scripts")]
			.filter((path) => /\.(?:ts|svelte|mjs)$/.test(path))
			.map((path) => readFileSync(path, "utf8"))
			.join("\n");

		expect(affectedSource).not.toContain(retiredKey);
		expect(affectedSource).toContain("FDC_API_KEY");
	});
});
