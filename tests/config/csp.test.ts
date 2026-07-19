import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("content security policy", () => {
	it("allows requests to the FoodData Central API", () => {
		const configSource = readFileSync("svelte.config.js", "utf8");

		expect(configSource).toContain("'https://api.nal.usda.gov'");
	});

	it("allows packaged-food lookups from Open Food Facts", () => {
		const configSource = readFileSync("svelte.config.js", "utf8");

		expect(configSource).toContain("'https://world.openfoodfacts.org'");
	});

	it("limits on-device OCR assets to the Tesseract CDN and local workers", () => {
		const configSource = readFileSync("svelte.config.js", "utf8");

		expect(configSource).toContain("'https://cdn.jsdelivr.net'");
		expect(configSource).toContain("'worker-src': ['self', 'blob:', 'https://cdn.jsdelivr.net']");
		expect(configSource).toContain("'wasm-unsafe-eval'");
	});
});
