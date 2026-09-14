import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	createConnectSources,
	createFrameSources,
	createImageSources,
	createScriptSources,
	createSvelteKitOutputDirectory,
	createWorkerSources,
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

	it("allows trusted Open Food Facts images to be read for on-device OCR", () => {
		expect(createConnectSources("production")).toContain(
			"https://images.openfoodfacts.org",
		);
	});

	it("allows local image previews without allowing another network origin", () => {
		expect(createImageSources("production")).toContain("blob:");
	});

	it("limits on-device OCR assets to the Tesseract CDN and local workers", () => {
		expect(createScriptSources("production")).toContain(
			"https://cdn.jsdelivr.net",
		);
		expect(createWorkerSources("production")).toContain(
			"https://cdn.jsdelivr.net",
		);
		expect(createScriptSources("production")).toContain("wasm-unsafe-eval");
		expect(createScriptSources("test")).not.toContain(
			"https://cdn.jsdelivr.net",
		);
	});

	it("allows only the official Turnstile origin for the Auth challenge", () => {
		expect(createConnectSources("production")).toContain(
			"https://challenges.cloudflare.com",
		);
		expect(createFrameSources("production")).toContain(
			"https://challenges.cloudflare.com",
		);
		expect(createScriptSources("production")).toContain(
			"https://challenges.cloudflare.com",
		);
		expect(createFrameSources("local")).not.toContain(
			"https://challenges.cloudflare.com",
		);
	});

	it("allows only local Supabase stacks in safe local modes", () => {
		expect(createConnectSources("local")).toContain("http://127.0.0.1:54321");
		expect(createConnectSources("test")).toContain("http://127.0.0.1:54321");
		expect(createConnectSources("test")).toContain("ws://127.0.0.1:54321");
		expect(createConnectSources("test")).toContain("http://127.0.0.1:55321");
		expect(createConnectSources("test")).toContain(
			"https://images.openfoodfacts.org",
		);
		expect(createConnectSources("test")).not.toContain(
			"https://api.nal.usda.gov",
		);
		expect(createConnectSources("production")).not.toContain(
			"http://127.0.0.1:54321",
		);
		expect(createConnectSources("production")).not.toContain(
			"ws://127.0.0.1:54321",
		);
		expect(createConnectSources("rehearsal")).toContain(
			"http://127.0.0.1:58321",
		);
		expect(createConnectSources("rehearsal")).toContain("ws://127.0.0.1:58321");
		expect(createConnectSources("rehearsal")).not.toContain(
			"http://127.0.0.1:54321",
		);
	});

	it("allows local storage and the read-only product image host in test mode", () => {
		expect(createImageSources("test")).toContain("http://127.0.0.1:54321");
		expect(createImageSources("test")).toContain(
			"https://images.openfoodfacts.org",
		);
		expect(createImageSources("test")).not.toContain("https:");
		expect(createImageSources("production")).not.toContain(
			"http://127.0.0.1:54321",
		);
		expect(createImageSources("rehearsal")).toContain("http://127.0.0.1:58321");
		expect(createImageSources("rehearsal")).not.toContain(
			"http://127.0.0.1:54321",
		);
	});

	it("detects test-database mode before Vite loads mode-specific env files", () => {
		expect(readViteMode([], { BLENDCALC_RUNTIME_ENVIRONMENT: "test" })).toBe(
			"test",
		);
	});

	it("fails closed when the configured runtime mode is invalid", () => {
		expect(() =>
			readViteMode([], { BLENDCALC_RUNTIME_ENVIRONMENT: "prodution" }),
		).toThrow("BLENDCALC_RUNTIME_ENVIRONMENT is invalid.");
	});

	it("isolates Rehearsal generated application state from test commands", () => {
		expect(createSvelteKitOutputDirectory("rehearsal")).toBe(
			".svelte-kit/rehearsal",
		);
		expect(createSvelteKitOutputDirectory("test")).toBe(".svelte-kit");
		expect(createSvelteKitOutputDirectory("production")).toBe(".svelte-kit");
	});

	it("runs validation commands through the hermetic test environment", () => {
		const packageMetadata = JSON.parse(
			readFileSync("package.json", "utf8"),
		) as {
			scripts: Record<string, string>;
		};

		for (const command of ["check", "check:watch", "test", "test:watch"]) {
			expect(packageMetadata.scripts[command]).toContain(
				"scripts/operations/environment/run_test_command.mjs",
			);
		}
	});
});
