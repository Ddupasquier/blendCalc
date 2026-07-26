import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	createConnectSources,
	readViteMode,
} from "../../config/contentSecurityPolicy.js";

describe("content security policy", () => {
	it("allows requests to the FoodData Central API", () => {
		expect(createConnectSources("production")).toContain(
			"https://api.nal.usda.gov",
		);
	});

	it("allows packaged-food lookups from Open Food Facts", () => {
		expect(createConnectSources("production")).toContain(
			"https://world.openfoodfacts.org",
		);
	});

	it("limits on-device OCR assets to the Tesseract CDN and local workers", () => {
		const configSource = readFileSync("svelte.config.js", "utf8");

		expect(configSource).toContain("'https://cdn.jsdelivr.net'");
		expect(configSource).toContain("'worker-src': ['self', 'blob:', 'https://cdn.jsdelivr.net']");
		expect(configSource).toContain("'wasm-unsafe-eval'");
	});

	it("allows the local Supabase stack only in test mode", () => {
		expect(createConnectSources("test")).toContain("http://127.0.0.1:54321");
		expect(createConnectSources("test")).toContain("ws://127.0.0.1:54321");
		expect(createConnectSources("production")).not.toContain(
			"http://127.0.0.1:54321",
		);
		expect(createConnectSources("production")).not.toContain(
			"ws://127.0.0.1:54321",
		);
	});

	it("detects test-database mode before Vite loads mode-specific env files", () => {
		expect(
			readViteMode([], { BLENDCALC_DATABASE_ENVIRONMENT: "test" }),
		).toBe("test");
	});
});
