import {
	expect,
	test as playwrightTest,
	type Browser,
	type ConsoleMessage,
	type Page,
} from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
	getAuthenticatedBrowserStatePath,
	getLocalQaAccountForWorker,
} from "./localQaAccounts";

type BrowserErrorFixture = {
	unexpectedBrowserErrors: string[];
};

type AuthenticatedBrowserWorkerFixture = {
	authenticatedBrowserStatePath: string;
};

const formatConsoleError = (message: ConsoleMessage) =>
	`console.${message.type()}: ${message.text()}`;

const createAuthenticatedBrowserState = async ({
	baseURL,
	browser,
	parallelWorkerIndex,
	projectName,
}: {
	baseURL: string;
	browser: Browser;
	parallelWorkerIndex: number;
	projectName: string;
}) => {
	const account = getLocalQaAccountForWorker(parallelWorkerIndex);
	const storageStatePath = getAuthenticatedBrowserStatePath(
		projectName,
		parallelWorkerIndex,
	);
	const page = await browser.newPage({ baseURL });

	try {
		await page.goto("/auth?next=/ingredients/fridge");
		await page.getByLabel("Email").fill(account.email);
		await page.getByLabel("Password", { exact: true }).fill(account.password);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		await expect(page).toHaveURL(/\/ingredients\/fridge(?:[/?#]|$)/);
		await expect(
			page.getByRole("heading", { name: "Ingredients", exact: true }),
		).toBeVisible();
		await waitForAppReady(page);
		await mkdir(dirname(storageStatePath), { recursive: true });
		await page.context().storageState({ path: storageStatePath });
	} finally {
		await page.close();
	}

	return storageStatePath;
};

export const test = playwrightTest.extend<
	BrowserErrorFixture,
	AuthenticatedBrowserWorkerFixture
>({
	authenticatedBrowserStatePath: [
		async ({ browser }, use, workerInfo) => {
			const storageStatePath = await createAuthenticatedBrowserState({
				baseURL:
					process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
				browser,
				parallelWorkerIndex: workerInfo.parallelIndex,
				projectName: workerInfo.project.name,
			});
			await use(storageStatePath);
		},
		{ scope: "worker" },
	],
	storageState: async ({ authenticatedBrowserStatePath }, use) => {
		await use(authenticatedBrowserStatePath);
	},
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
