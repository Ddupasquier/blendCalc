import { expect, test, waitForAppReady } from "./support/browserTest";
import type { Page } from "@playwright/test";

const waitForRightSheetToSettle = async (page: Page) => {
	const panel = page.locator(".sheet-base__panel--right");
	await expect(panel).toBeVisible();
	await expect
		.poll(() =>
			panel.evaluate((element) =>
				element
					.getAnimations()
					.every((animation) =>
						["finished", "idle"].includes(animation.playState),
					),
			),
		)
		.toBe(true);
};

const expectRightSheetOwnsVisibleContentArea = async (page: Page) => {
	const geometry = await page.evaluate(() => {
		const sheet = document.querySelector<HTMLElement>(".sheet-base--right");
		const panel = document.querySelector<HTMLElement>(
			".sheet-base__panel--right",
		);
		const content = document.querySelector<HTMLElement>(
			".right-sheet__content",
		);
		const view = document.querySelector<HTMLElement>(
			".right-sheet__content > .view-frame",
		);
		const header = document.querySelector<HTMLElement>(".app-header");
		const navigation = document.querySelector<HTMLElement>(".tab-nav");
		if (!sheet || !panel || !content || !view || !header || !navigation) {
			return null;
		}

		const sheetBounds = sheet.getBoundingClientRect();
		const panelBounds = panel.getBoundingClientRect();
		const contentBounds = content.getBoundingClientRect();
		const viewBounds = view.getBoundingClientRect();
		const headerBounds = header.getBoundingClientRect();
		const navigationBounds = navigation.getBoundingClientRect();
		const verticalCenter = sheetBounds.top + sheetBounds.height / 2;
		const edgeInset = 4;
		const samplePoints = [
			[edgeInset, sheetBounds.top + edgeInset],
			[window.innerWidth - edgeInset, sheetBounds.top + edgeInset],
			[edgeInset, verticalCenter],
			[window.innerWidth - edgeInset, verticalCenter],
			[edgeInset, sheetBounds.bottom - edgeInset],
			[window.innerWidth - edgeInset, sheetBounds.bottom - edgeInset],
		];

		return {
			contentBottom: contentBounds.bottom,
			contentHeight: contentBounds.height,
			contentTop: contentBounds.top,
			headerBottom: headerBounds.bottom,
			navigationTop: navigationBounds.top,
			panelBottom: panelBounds.bottom,
			panelHeight: panelBounds.height,
			panelTop: panelBounds.top,
			sheetBackgroundColor: getComputedStyle(sheet).backgroundColor,
			sheetBottom: sheetBounds.bottom,
			sheetHeight: sheetBounds.height,
			sheetLeft: sheetBounds.left,
			sheetRight: sheetBounds.right,
			sheetTop: sheetBounds.top,
			viewBackgroundColor: getComputedStyle(view).backgroundColor,
			viewBottom: viewBounds.bottom,
			viewHeight: viewBounds.height,
			viewTop: viewBounds.top,
			edgesOwnedBySheet: samplePoints.every(([x, y]) =>
				document.elementFromPoint(x, y)?.closest(".sheet-base--right"),
			),
		};
	});

	expect(geometry).not.toBeNull();
	expect(
		Math.abs(geometry!.sheetTop - geometry!.headerBottom),
	).toBeLessThanOrEqual(2);
	expect(
		Math.abs(geometry!.sheetBottom - geometry!.navigationTop),
	).toBeLessThanOrEqual(2);
	expect(geometry!.sheetLeft).toBeCloseTo(0, 0);
	expect(geometry!.sheetRight).toBeCloseTo(
		await page.evaluate(() => innerWidth),
		0,
	);
	expect(geometry!.panelHeight).toBeCloseTo(geometry!.sheetHeight, 0);
	expect(geometry!.contentTop).toBeGreaterThanOrEqual(geometry!.panelTop);
	expect(geometry!.contentBottom).toBeLessThanOrEqual(
		geometry!.panelBottom + 1,
	);
	expect(geometry!.panelBottom - geometry!.contentBottom).toBeLessThanOrEqual(
		8,
	);
	expect(geometry!.contentHeight).toBeGreaterThan(0);
	expect(geometry!.viewHeight).toBeGreaterThanOrEqual(geometry!.contentHeight);
	expect(geometry!.viewTop).toBeLessThanOrEqual(geometry!.contentTop + 1);
	expect(geometry!.viewBottom).toBeGreaterThanOrEqual(
		geometry!.contentBottom - 1,
	);
	expect(geometry!.sheetBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	expect(geometry!.viewBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	expect(geometry!.edgesOwnedBySheet).toBe(true);
};

test("ingredient search fills the app content area and closes with Escape", async ({
	page,
}) => {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 900 },
	]) {
		await page.setViewportSize(viewport);
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);

		const savedList = page.locator(".saved-ingredient-list__cards");
		await expect(savedList).toBeVisible();
		await savedList.evaluate((element) => {
			element.scrollTop = Math.max(1, element.scrollHeight / 2);
			element.dispatchEvent(new Event("scroll"));
		});
		await expect
			.poll(() => savedList.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);

		const searchTrigger = page.getByRole("button", {
			name: "Open ingredient search",
		});
		await searchTrigger.click();
		await expect(page).toHaveURL(/\/ingredients\/fridge\/search$/);
		await expect(
			page.getByRole("dialog", { name: "Ingredients" }),
		).toBeVisible();
		await waitForRightSheetToSettle(page);
		await expectRightSheetOwnsVisibleContentArea(page);

		await page.keyboard.press("Escape");
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		await expect(
			page.getByRole("dialog", { name: "Ingredients" }),
		).toBeHidden();
		await expect(searchTrigger).toBeFocused();
	}
});

test("ingredient search remains opaque and unclipped while loading and scrolling results", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	let markSearchRequestStarted: () => void = () => undefined;
	let releaseSearchRequest: () => void = () => undefined;
	const searchRequestStarted = new Promise<void>((resolve) => {
		markSearchRequestStarted = resolve;
	});
	const searchRequestRelease = new Promise<void>((resolve) => {
		releaseSearchRequest = resolve;
	});
	await page.route("**/api/foods/search?**", async (route) => {
		const requestUrl = new URL(route.request().url());
		if (requestUrl.searchParams.get("q") !== "spinach") {
			await route.continue();
			return;
		}
		markSearchRequestStarted();
		await searchRequestRelease;
		await route.continue();
	});
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);
	await waitForRightSheetToSettle(page);
	await expectRightSheetOwnsVisibleContentArea(page);

	const searchInput = page.getByRole("combobox", {
		name: "Search ingredients",
	});
	await searchInput.fill("spinach");
	await searchRequestStarted;
	await expect(
		page.getByRole("status", { name: "Searching ingredients" }),
	).toBeVisible();
	await expectRightSheetOwnsVisibleContentArea(page);
	releaseSearchRequest();

	const results = page.locator(".results-panel");
	await expect(
		page.getByRole("row", { name: /^Spinach,/ }).first(),
	).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("status", { name: "Searching ingredients" }),
	).toBeHidden();
	await results.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
		element.dispatchEvent(new Event("scroll"));
	});
	await expect
		.poll(() =>
			results.evaluate(
				(element) =>
					element.scrollTop + element.clientHeight >= element.scrollHeight - 2,
			),
		)
		.toBe(true);
	await expectRightSheetOwnsVisibleContentArea(page);
});
