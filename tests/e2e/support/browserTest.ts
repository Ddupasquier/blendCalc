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
	await expect(page.locator("html")).toHaveAttribute(
		"data-app-ready",
		"true",
		{ timeout: 30_000 },
	);
};

export const waitForVisualStability = async (page: Page) => {
	await waitForAppReady(page);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			Array.from(document.images).map((image) => {
				if (image.complete) return Promise.resolve();
				return new Promise<void>((resolve) => {
					image.addEventListener("load", () => resolve(), { once: true });
					image.addEventListener("error", () => resolve(), { once: true });
				});
			}),
		);
	});
};

export { expect };
