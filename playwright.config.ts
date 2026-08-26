import { defineConfig, devices } from "@playwright/test";

delete process.env.NO_COLOR;

const applicationBaseUrl =
	process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174";
const runExhaustiveBrowserMatrix =
	process.env.PLAYWRIGHT_EXHAUSTIVE_MATRIX === "true";
const localPlaywrightWorkerCount = Number.parseInt(
	process.env.PLAYWRIGHT_WORKERS ?? "2",
	10,
);
const compatibilityTestPattern = /@compatibility/;
const mobileTestPattern = /@(?:compatibility|mobile)/;
const getFocusedProjectPattern = (project: "compatibility" | "mobile") =>
	runExhaustiveBrowserMatrix
		? undefined
		: project === "mobile"
			? mobileTestPattern
			: compatibilityTestPattern;
const terminalReporter = process.env.PLAYWRIGHT_PROGRESS_REPORTER ?? "dot";

if (
	!Number.isInteger(localPlaywrightWorkerCount) ||
	localPlaywrightWorkerCount < 1
) {
	throw new Error("PLAYWRIGHT_WORKERS must be a positive integer.");
}

export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "test-results/playwright",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: localPlaywrightWorkerCount,
	reporter: process.env.CI
		? [
				["github"],
				["dot"],
				["./tests/e2e/support/slowTestReporter.ts"],
				["html", { open: "never" }],
			]
		: [
				[terminalReporter],
				["./tests/e2e/support/slowTestReporter.ts"],
				["html", { open: "never" }],
			],
	timeout: 60_000,
	expect: {
		timeout: 20_000,
		toHaveScreenshot: {
			animations: "disabled",
			maxDiffPixelRatio: 0.005,
		},
	},
	use: {
		baseURL: applicationBaseUrl,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
		? undefined
		: {
				command: "npm run test:e2e:server",
				url: applicationBaseUrl,
				reuseExistingServer: !process.env.CI,
				timeout: 180_000,
			},
	projects: [
		{
			name: "desktop-chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 900 },
			},
		},
		{
			name: "desktop-firefox",
			grep: getFocusedProjectPattern("compatibility"),
			use: {
				...devices["Desktop Firefox"],
				viewport: { width: 1280, height: 900 },
			},
		},
		{
			name: "desktop-webkit",
			grep: getFocusedProjectPattern("compatibility"),
			use: {
				...devices["Desktop Safari"],
				viewport: { width: 1280, height: 900 },
			},
		},
		{
			name: "mobile-chromium",
			grep: getFocusedProjectPattern("mobile"),
			use: {
				...devices["Pixel 7"],
				viewport: { width: 360, height: 740 },
			},
		},
		{
			name: "mobile-webkit",
			grep: getFocusedProjectPattern("compatibility"),
			use: {
				...devices["iPhone 13"],
			},
		},
	],
});
