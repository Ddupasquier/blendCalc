import {
	expect,
	request as playwrightRequest,
	test as playwrightTest,
	type ConsoleMessage,
	type Locator,
	type Page,
} from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
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

const hasUnexpiredAuthenticatedBrowserState = async ({
	baseURL,
	storageStatePath,
}: {
	baseURL: string;
	storageStatePath: string;
}) => {
	try {
		const state = JSON.parse(await readFile(storageStatePath, "utf8")) as {
			cookies?: Array<{
				domain?: string;
				expires?: number;
				name?: string;
				secure?: boolean;
			}>;
		};
		const expectedOrigin = new URL(baseURL);
		const minimumReusableExpirySeconds = Date.now() / 1_000 + 5 * 60;

		return Boolean(
			state.cookies?.some(
				(cookie) =>
					cookie.name?.startsWith("sb-") &&
					cookie.name.endsWith("-auth-token") &&
					cookie.domain === expectedOrigin.hostname &&
					cookie.secure === (expectedOrigin.protocol === "https:") &&
					typeof cookie.expires === "number" &&
					cookie.expires > minimumReusableExpirySeconds,
			),
		);
	} catch {
		return false;
	}
};

const isStoredBrowserSessionStillAuthenticated = async ({
	baseURL,
	storageStatePath,
}: {
	baseURL: string;
	storageStatePath: string;
}) => {
	if (
		!(await hasUnexpiredAuthenticatedBrowserState({
			baseURL,
			storageStatePath,
		}))
	) {
		return false;
	}

	const verificationRequest = await playwrightRequest.newContext({
		baseURL,
		extraHTTPHeaders: { origin: baseURL },
		storageState: storageStatePath,
	});
	try {
		const response = await verificationRequest.get(
			"/api/user-food-lists/fridge?limit=1&offset=0&sort=recent&source=all&trust=any",
		);
		return response.status() !== 401 && response.status() !== 403;
	} catch {
		return false;
	} finally {
		await verificationRequest.dispose();
	}
};

const createAuthenticatedBrowserState = async ({
	baseURL,
	parallelWorkerIndex,
	projectName,
}: {
	baseURL: string;
	parallelWorkerIndex: number;
	projectName: string;
}) => {
	const account = getLocalQaAccountForWorker(parallelWorkerIndex);
	const storageStatePath = getAuthenticatedBrowserStatePath(
		projectName,
		parallelWorkerIndex,
	);
	if (
		await isStoredBrowserSessionStillAuthenticated({
			baseURL,
			storageStatePath,
		})
	) {
		return storageStatePath;
	}
	const authenticationRequest = await playwrightRequest.newContext({
		baseURL,
		extraHTTPHeaders: { origin: baseURL },
	});

	try {
		const response = await authenticationRequest.post("/auth?/emailSignIn", {
			form: {
				email: account.email,
				next: "/ingredients/fridge",
				password: account.password,
			},
		});
		const actionResult = (await response.json()) as {
			message?: string;
			location?: string;
			status?: number;
			type?: string;
		};
		if (!response.ok()) {
			throw new Error(
				`The local QA account could not sign in (HTTP ${response.status()}${actionResult.message ? `: ${actionResult.message}` : ""}).`,
			);
		}
		expect(actionResult).toMatchObject({
			location: "/ingredients/fridge",
			status: 303,
			type: "redirect",
		});
		await mkdir(dirname(storageStatePath), { recursive: true });
		await authenticationRequest.storageState({ path: storageStatePath });
		return storageStatePath;
	} finally {
		await authenticationRequest.dispose();
	}
};

export const test = playwrightTest.extend<
	BrowserErrorFixture,
	AuthenticatedBrowserWorkerFixture
>({
	authenticatedBrowserStatePath: [
		async ({}, use, workerInfo) => {
			const storageStatePath = await createAuthenticatedBrowserState({
				baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
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
	await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true", {
		timeout: 30_000,
	});
	const dailyWelcome = page.locator(".daily-welcome");
	if (await dailyWelcome.isVisible()) {
		await dailyWelcome.click();
		await dailyWelcome.evaluateAll((elements) => {
			for (const element of elements) {
				for (const animation of element.getAnimations({ subtree: true })) {
					try {
						animation.finish();
					} catch {
						animation.cancel();
					}
				}
			}
		});
		await expect(dailyWelcome).toBeHidden();
	}
};

export const signInLocalQaAccount = async ({
	page,
	email,
	nextPath,
}: {
	page: Page;
	email: string;
	nextPath: string;
}) => {
	const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174";
	const password =
		process.env.PLAYWRIGHT_QA_PASSWORD ?? "BlendCalc-Local-QA-2026!";
	let lastFailure = "The local QA sign-in did not complete.";

	for (let attempt = 1; attempt <= 3; attempt += 1) {
		await page.context().clearCookies();
		const response = await page.request.post("/auth?/emailSignIn", {
			headers: { origin: baseURL },
			form: { email, next: nextPath, password },
		});
		const actionResult = (await response.json()) as {
			location?: string;
			message?: string;
			status?: number;
			type?: string;
		};
		if (
			response.ok() &&
			actionResult.type === "redirect" &&
			actionResult.location === nextPath
		) {
			await page.goto(nextPath);
			try {
				await expect(page).toHaveURL((url) => url.pathname === nextPath, {
					timeout: 5_000,
				});
				await waitForAppReady(page);
				return;
			} catch {
				lastFailure = `The local QA session redirected to ${page.url()}.`;
			}
		} else {
			lastFailure = `The local QA sign-in returned HTTP ${response.status()}${actionResult.message ? `: ${actionResult.message}` : ""}.`;
		}
		await page.waitForTimeout(attempt * 250);
	}

	throw new Error(lastFailure);
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

	const [focusTargetBounds, clippingBoundaryBounds, focusOutline] =
		await Promise.all([
			focusTarget.boundingBox(),
			clippingBoundary.boundingBox(),
			focusTarget.evaluate((element) => {
				const styles = window.getComputedStyle(element);
				const outlineWidthPixels = Number.parseFloat(styles.outlineWidth) || 0;
				const outlineOffsetPixels =
					Number.parseFloat(styles.outlineOffset) || 0;

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

	expect(
		focusTargetBounds!.x - focusOutline.extentPixels,
	).toBeGreaterThanOrEqual(clippingBoundaryBounds!.x - tolerancePixels);
	expect(
		focusTargetBounds!.y - focusOutline.extentPixels,
	).toBeGreaterThanOrEqual(clippingBoundaryBounds!.y - tolerancePixels);
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
	await scrollContainer.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);

	await scrollContainer.evaluate((element) =>
		element.scrollTo({ top: Math.max(0, element.scrollTop - 160) }),
	);
	await expect(header).not.toHaveClass(/view-top--compact-hidden/);
};

export { expect };
