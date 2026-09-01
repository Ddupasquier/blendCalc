import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const collectTrackedSourceFiles = (): string[] =>
	execFileSync("git", ["ls-files", "src", "scripts"], { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter((path) => /\.(?:ts|svelte|mjs)$/.test(path));

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
		const affectedSource = collectTrackedSourceFiles()
			.map((path) => readFileSync(path, "utf8"))
			.join("\n");

		expect(affectedSource).not.toContain(retiredKey);
		expect(affectedSource).toContain("FDC_API_KEY");
	});
});
