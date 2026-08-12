import {
	expect,
	test as playwrightTest,
	type Browser,
	type ConsoleMessage,
	type Locator,
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
	let latestAuthenticationError: unknown = null;

	try {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				await page.goto("/auth?next=/ingredients/fridge");
				if (!/\/ingredients\/fridge(?:[/?#]|$)/.test(page.url())) {
					await page.getByLabel("Email").fill(account.email);
					await page
						.getByLabel("Password", { exact: true })
						.fill(account.password);
					await page
						.getByRole("button", { name: "Sign in", exact: true })
						.click();
				}
				await expect(page).toHaveURL(/\/ingredients\/fridge(?:[/?#]|$)/);
				await waitForAppReady(page);
				await expect(
					page.getByRole("heading", { name: "Ingredients", exact: true }),
				).toBeVisible({ timeout: 10_000 });
				await mkdir(dirname(storageStatePath), { recursive: true });
				await page.context().storageState({ path: storageStatePath });
				return storageStatePath;
			} catch (error) {
				latestAuthenticationError = error;
			}
		}

		throw new Error(
			`Authenticated browser state did not reach the Ingredients view after two attempts. ` +
				`URL: ${page.url()}; title: ${await page.title()}; ` +
				`body: ${(await page.locator("body").innerText()).slice(0, 500)}`,
			{ cause: latestAuthenticationError },
		);
	} finally {
		await page.close();
	}
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

export const expectFocusOutlineInsideBoundary = async (
	focusTarget: Locator,
	clippingBoundary: Locator,
) => {
	await focusTarget.page().keyboard.press("Tab");
	await focusTarget.focus();
	await expect(focusTarget).toBeFocused();

	const [focusTargetBounds, clippingBoundaryBounds, focusOutline] = await Promise.all([
		focusTarget.boundingBox(),
		clippingBoundary.boundingBox(),
		focusTarget.evaluate((element) => {
			const styles = window.getComputedStyle(element);
			const outlineWidthPixels = Number.parseFloat(styles.outlineWidth) || 0;
			const outlineOffsetPixels = Number.parseFloat(styles.outlineOffset) || 0;

			return {
				extentPixels: Math.max(0, outlineWidthPixels + outlineOffsetPixels),
				style: styles.outlineStyle,
			};
		}),
	]);

	expect(focusTargetBounds).not.toBeNull();
	expect(clippingBoundaryBounds).not.toBeNull();
	expect(focusOutline.style).not.toBe("none");
	expect(focusOutline.extentPixels).toBeGreaterThan(0);

	const tolerancePixels = 1;
	const focusTargetRight = focusTargetBounds!.x + focusTargetBounds!.width;
	const focusTargetBottom = focusTargetBounds!.y + focusTargetBounds!.height;
	const clippingBoundaryRight =
		clippingBoundaryBounds!.x + clippingBoundaryBounds!.width;
	const clippingBoundaryBottom =
		clippingBoundaryBounds!.y + clippingBoundaryBounds!.height;

	expect(focusTargetBounds!.x - focusOutline.extentPixels).toBeGreaterThanOrEqual(
		clippingBoundaryBounds!.x - tolerancePixels,
	);
	expect(focusTargetBounds!.y - focusOutline.extentPixels).toBeGreaterThanOrEqual(
		clippingBoundaryBounds!.y - tolerancePixels,
	);
	expect(focusTargetRight + focusOutline.extentPixels).toBeLessThanOrEqual(
		clippingBoundaryRight + tolerancePixels,
	);
	expect(focusTargetBottom + focusOutline.extentPixels).toBeLessThanOrEqual(
		clippingBoundaryBottom + tolerancePixels,
	);
};

export const expectCompactHeaderHidesAndRevealsWithScroll = async (
	header: Locator,
	scrollContainer: Locator,
) => {
	await scrollContainer.evaluate((element) => element.scrollTo({ top: 0 }));
	await expect(header).not.toHaveClass(/view-top--compact-hidden/);
	await expect(header).toBeVisible();
	const maximumScrollTop = await scrollContainer.evaluate((element) => {
		const nextScrollTop = element.scrollHeight - element.clientHeight;
		element.scrollTo({ top: nextScrollTop });
		return nextScrollTop;
	});
	expect(maximumScrollTop).toBeGreaterThan(0);
	await expect(header).toHaveClass(/view-top--compact-hidden/);
	await header.evaluate(async (element) => {
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});

	await scrollContainer.evaluate((element) =>
		element.scrollTo({ top: Math.max(0, element.scrollTop - 160) }),
	);
	await expect(header).not.toHaveClass(/view-top--compact-hidden/);
};

export { expect };
