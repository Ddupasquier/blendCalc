import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("Playwright browser-testing architecture", () => {
	it("keeps browser tests isolated from Vitest", () => {
		const viteConfig = readSource("vite.config.ts");
		expect(viteConfig).toContain("exclude: ['tests/e2e/**']");
	});

	it("runs authenticated desktop and mobile browser projects against the test app", () => {
		const playwrightConfig = readSource("playwright.config.ts");
		for (const project of [
			"desktop-chromium",
			"desktop-firefox",
			"desktop-webkit",
			"mobile-chromium",
			"mobile-webkit",
		]) {
			expect(playwrightConfig).toContain(`name: "${project}"`);
		}
		expect(playwrightConfig).toContain('command: "npm run dev:test:server"');
		expect(playwrightConfig).toContain('"http://localhost:5174"');
		expect(playwrightConfig).toContain("reuseExistingServer: false");
		expect(playwrightConfig).toContain("workers: 1");
	});

	it("exposes maintained local-database browser commands and documentation", () => {
		const packageSource = readSource("package.json");
		const browserTestingGuide = readSource("docs/browser-testing.md");
		const developmentRules = readSource("docs/dev-rules/dev-rules.md");

		for (const command of [
			'test:e2e"',
			'test:e2e:chromium"',
			'test:e2e:headed"',
			'test:e2e:ui"',
			'test:e2e:update"',
		]) {
			expect(packageSource).toContain(command);
		}
		expect(packageSource).toContain("npm run db:test:start");
		expect(packageSource).toContain("npm run free:test-port");
		expect(packageSource).toContain("--port 5174 --strictPort");
		expect(browserTestingGuide).toContain("## QA Evidence");
		expect(developmentRules).toContain("npm run test:e2e:chromium");
	});

	it("owns rendered accessibility and responsive behavior in browser tests", () => {
		const accessibilitySuite = readSource("tests/e2e/accessibility.spec.ts");
		const responsiveSuite = readSource("tests/e2e/responsiveLayouts.spec.ts");
		expect(accessibilitySuite).toContain("@axe-core/playwright");
		expect(accessibilitySuite).toContain('disableRules(["color-contrast"])');
		expect(responsiveSuite).toContain("document.documentElement.scrollWidth");
		expect(responsiveSuite).toContain('reducedMotion: "reduce"');
	});

	it("stores authentication and generated reports only under ignored test output", () => {
		const playwrightConfig = readSource("playwright.config.ts");
		const gitignore = readSource(".gitignore");
		expect(playwrightConfig).toContain('"test-results/authenticated-browser-state/qa-user.json"');
		expect(gitignore).toContain("/playwright-report/");
		expect(gitignore).toContain("/test-results/");
	});

	it("exposes one deterministic client-readiness signal before browser interaction", () => {
		const rootLayout = readSource("src/routes/+layout.svelte");
		expect(rootLayout).toContain('dataset.appReady = "true"');
		expect(rootLayout).toContain("delete document.documentElement.dataset.appReady");
	});

	it("does not duplicate migrated browser interactions in jsdom component tests", () => {
		for (const migratedTestPath of [
			"tests/lib/components/common/CollapsibleSection.test.ts",
			"tests/lib/components/common/SegmentedControl.test.ts",
			"tests/lib/components/mix/NutrientPicker.test.ts",
			"tests/lib/components/mix/SelectedIngredientsPanel.test.ts",
		]) {
			expect(existsSync(migratedTestPath), migratedTestPath).toBe(false);
		}
	});
});
