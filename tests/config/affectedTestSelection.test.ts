import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("affected-test selection", () => {
	it("maps changed ownership to focused unit and browser commands", () => {
		const packageSource = readSource("package.json");
		const selectorSource = readSource(
			"scripts/operations/quality/run_affected_tests.mjs",
		);
		const verifyWorkflow = readSource(".github/workflows/verify.yml");

		expect(packageSource).toContain('"test:affected"');
		expect(packageSource).toContain('"test:e2e:affected"');
		expect(selectorSource).toContain('"vitest",');
		expect(selectorSource).toContain('"related",');
		expect(selectorSource).toContain('"desktop-chromium"');
		expect(selectorSource).toContain('"mobile-chromium"');
		expect(selectorSource).toContain("globalBrowserOwners");
		expect(selectorSource).toContain("globalUnitOwners");
		expect(selectorSource).toContain('runCommand("npm", ["run", "test"])');
		expect(selectorSource).toContain("browserDomainMappings");
		expect(selectorSource).toContain('"chromium", "firefox", "webkit"');
		expect(selectorSource).toContain("runCommandWithInheritedOutput");
		expect(verifyWorkflow).toContain(
			"run_affected_tests.mjs browser --install-browsers",
		);
		expect(selectorSource).toContain(
			"test-results/affected-test-selection.json",
		);
	});

	it("keeps timing reports local and enforces release budgets explicitly", () => {
		const gitignore = readSource(".gitignore");
		const reporterSource = readSource("tests/e2e/support/slowTestReporter.ts");
		const dashboardSource = readSource(
			"scripts/operations/quality/run_verification_dashboard.mjs",
		);

		expect(gitignore).toContain("/test-results/");
		expect(reporterSource).toContain("PLAYWRIGHT_TEST_BUDGET_MS");
		expect(reporterSource).toContain('PLAYWRIGHT_TEST_BUDGET_MS ?? "60000"');
		expect(reporterSource).toContain("PLAYWRIGHT_ENFORCE_DURATION_BUDGETS");
		expect(reporterSource).toContain("playwright-slow-tests.json");
		expect(dashboardSource).toContain(
			'PLAYWRIGHT_ENFORCE_DURATION_BUDGETS: "true"',
		);
	});
});
