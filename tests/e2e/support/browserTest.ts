import {
	expect,
	test as playwrightTest,
	type ConsoleMessage,
	type Page,
} from "@playwright/test";

type BrowserErrorFixture = {
	unexpectedBrowserErrors: string[];
};

const formatConsoleError = (message: ConsoleMessage) =>
	`console.${message.type()}: ${message.text()}`;

export const test = playwrightTest.extend<BrowserErrorFixture>({
	unexpectedBrowserErrors: [
		async ({ page }, use) => {
			const unexpectedBrowserErrors: string[] = [];
			page.on("response", (response) => {
				if (response.status() < 500) return;
				const applicationOrigin = new URL(page.url()).origin;
				if (new URL(response.url()).origin !== applicationOrigin) return;
				unexpectedBrowserErrors.push(
					`response.${response.status()}: ${response.request().method()} ${response.url()}`,
				);
			});
			page.on("console", (message) => {
				if (message.type() === "error") {
					unexpectedBrowserErrors.push(formatConsoleError(message));
				}
			});
			page.on("pageerror", (error) => {
				unexpectedBrowserErrors.push(`pageerror: ${error.message}`);
			});

			await use(unexpectedBrowserErrors);

			expect(
				unexpectedBrowserErrors,
				"The browser emitted unexpected console or page errors.",
			).toEqual([]);
		},
		{ auto: true },
	],
});

export const waitForAppReady = async (page: Page) => {
	await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
};

export { expect };
