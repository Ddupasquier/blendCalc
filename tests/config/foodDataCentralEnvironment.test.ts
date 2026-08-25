import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const collectFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? collectFiles(path) : [path];
	});

describe("FoodData Central environment configuration", () => {
	it("documents only the server-owned application key", () => {
		const environmentExample = readFileSync(".env.example", "utf8");

		expect(environmentExample).toMatch(/^FDC_API_KEY=$/m);
		expect(environmentExample).not.toMatch(/^VITE_FDC_API_KEY=$/m);
	});

	it("prefers the server-only key before the temporary legacy fallback", () => {
		const applicationReader = readFileSync(
			"src/lib/server/products/usdaCache.server.ts",
			"utf8",
		);
		const scriptReaders = collectFiles("scripts")
			.filter((path) => path.endsWith(".mjs"))
			.map((path) => ({ path, source: readFileSync(path, "utf8") }))
			.filter(({ source }) => source.includes("VITE_FDC_API_KEY"));

		for (const { path, source } of [
			{
				path: "src/lib/server/products/usdaCache.server.ts",
				source: applicationReader,
			},
			...scriptReaders,
		]) {
			expect(source, path).toContain("FDC_API_KEY");
			expect(source.indexOf("FDC_API_KEY"), path).toBeLessThan(
				source.indexOf("VITE_FDC_API_KEY"),
			);
		}
	});
});
