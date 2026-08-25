import { defineConfig, devices } from "@playwright/test";

delete process.env.NO_COLOR;

const applicationBaseUrl =
	process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174";
const localPlaywrightWorkerCount = Number.parseInt(
	process.env.PLAYWRIGHT_WORKERS ?? "2",
	10,
);

if (
	!Number.isInteger(localPlaywrightWorkerCount) ||
	localPlaywrightWorkerCount < 1
) {
	throw new Error("PLAYWRIGHT_WORKERS must be a positive integer.");
}

export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "test-results/playwright",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: localPlaywrightWorkerCount,
	reporter: process.env.CI
		? [["github"], ["dot"], ["html", { open: "never" }]]
		: [["dot"], ["html", { open: "never" }]],
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
				reuseExistingServer: false,
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
			use: {
				...devices["Desktop Firefox"],
				viewport: { width: 1280, height: 900 },
			},
		},
		{
			name: "desktop-webkit",
			use: {
				...devices["Desktop Safari"],
				viewport: { width: 1280, height: 900 },
			},
		},
		{
			name: "mobile-chromium",
			use: {
				...devices["Pixel 7"],
				viewport: { width: 360, height: 740 },
			},
		},
		{
			name: "mobile-webkit",
			use: {
				...devices["iPhone 13"],
			},
		},
	],
});
