import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageMetadata = JSON.parse(readFileSync("package.json", "utf8"));
const readSource = (path: string) => readFileSync(path, "utf8");

describe("resource-safe verification architecture", () => {
	it("guards maintained heavy entry points and caps Vitest workers", () => {
		for (const command of [
			"build",
			"build:test:e2e",
			"test:node",
			"test:dom:fast",
			"test:dom:svelte-runtime",
			"verify:feature",
			"verify:release",
			"verify:nightly",
			"db:test:verify",
		]) {
			expect(packageMetadata.scripts[command]).toContain(
				"run_with_resource_limits.mjs",
			);
		}
		expect(packageMetadata.scripts["test:e2e"]).toContain(
			"run_browser_verification.mjs",
		);
		expect(readSource("vite.config.ts")).toContain("maxWorkers: 4");
		expect(packageMetadata.scripts.test).toContain("vitest run --reporter=dot");
		expect(packageMetadata.scripts.test).not.toContain("npm run test:node");
	});

	it("caps browser workers and cleans up an owned database runtime", () => {
		const playwrightConfig = readSource("playwright.config.ts");
		const databaseManager = readSource(
			"scripts/operations/database/manage_test_database.mjs",
		);
		const dashboard = readSource(
			"scripts/operations/quality/run_verification_dashboard.mjs",
		);
		const browserRunner = readSource(
			"scripts/operations/quality/run_browser_verification.mjs",
		);
		expect(playwrightConfig).toContain("localPlaywrightWorkerCount > 2");
		expect(databaseManager).toContain('"--memory",\n\t\t\t"4"');
		expect(databaseManager).toContain("runtimeOwnershipPath");
		expect(databaseManager).toContain(
			"if (!keepRuntimeRunning) stopLocalStack()",
		);
		expect(dashboard).toContain('"--keep-running"');
		expect(dashboard).toContain("stopOwnedDatabaseStack");
		expect(dashboard).toContain("finally");
		expect(browserRunner).toContain("manage_test_database.mjs");
		expect(browserRunner).toContain("finally");
	});
});
