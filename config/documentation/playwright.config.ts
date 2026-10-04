import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "../../tests/e2e/documentation",
	outputDir: "../../test-results/documentation",
	fullyParallel: true,
	workers: 2,
	forbidOnly: Boolean(process.env.CI),
	timeout: 60_000,
	reporter: "list",
	use: {
		baseURL: "http://localhost:4179/blendCalc/",
		// DOM tracing can force pre-load layout in Firefox; preserve API/network evidence.
		trace: { mode: "retain-on-failure", snapshots: false, screenshots: false },
		screenshot: "only-on-failure",
	},
	webServer: {
		command: "npm run docs -- dev --base /blendCalc/ --port 4179",
		url: "http://localhost:4179/blendCalc/",
		reuseExistingServer: false,
		timeout: 120_000,
	},
	projects: [
		{
			name: "docs-chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 1000 },
			},
		},
		{
			name: "docs-firefox",
			use: {
				...devices["Desktop Firefox"],
				viewport: { width: 1440, height: 1000 },
			},
		},
		{
			name: "docs-webkit",
			use: {
				...devices["Desktop Safari"],
				viewport: { width: 1440, height: 1000 },
			},
		},
		{
			name: "docs-mobile-chromium",
			use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
		},
		{
			name: "docs-mobile-webkit",
			use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
		},
		{
			name: "docs-tablet",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 834, height: 1112 },
			},
		},
	],
});
