import { defineConfig, devices } from "@playwright/test";

const applicationBaseUrl =
	process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const authenticatedStorageStatePath =
	"test-results/authenticated-browser-state/qa-user.json";

export default defineConfig({
	testDir: "./tests/e2e",
	outputDir: "test-results/playwright",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	timeout: 45_000,
	expect: {
		timeout: 10_000,
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
				command: "npm run dev:test:server",
				url: applicationBaseUrl,
				reuseExistingServer: false,
				timeout: 180_000,
			},
	projects: [
		{
			name: "authenticate",
			testMatch: /authentication\.setup\.ts/,
		},
		{
			name: "desktop-chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 900 },
				storageState: authenticatedStorageStatePath,
			},
			dependencies: ["authenticate"],
			testIgnore: /authentication\.setup\.ts/,
		},
		{
			name: "desktop-firefox",
			use: {
				...devices["Desktop Firefox"],
				viewport: { width: 1280, height: 900 },
				storageState: authenticatedStorageStatePath,
			},
			dependencies: ["authenticate"],
			testIgnore: /authentication\.setup\.ts/,
		},
		{
			name: "desktop-webkit",
			use: {
				...devices["Desktop Safari"],
				viewport: { width: 1280, height: 900 },
				storageState: authenticatedStorageStatePath,
			},
			dependencies: ["authenticate"],
			testIgnore: /authentication\.setup\.ts/,
		},
		{
			name: "mobile-chromium",
			use: {
				...devices["Pixel 7"],
				viewport: { width: 360, height: 740 },
				storageState: authenticatedStorageStatePath,
			},
			dependencies: ["authenticate"],
			testIgnore: /authentication\.setup\.ts/,
		},
		{
			name: "mobile-webkit",
			use: {
				...devices["iPhone 13"],
				storageState: authenticatedStorageStatePath,
			},
			dependencies: ["authenticate"],
			testIgnore: /authentication\.setup\.ts/,
		},
	],
});
