import {
	expect,
	expectFocusOutlineInsideBoundary,
	test,
	waitForAppReady,
} from "./support/browserTest";
import type { Locator, Page } from "@playwright/test";

const expectBottomSheetPlacement = async (
	page: Page,
	dialog: Locator,
	openSheet: () => Promise<void>,
) => {
	await openSheet();
	await expect(dialog).toBeVisible();
	const panel = dialog.locator(".sheet-base__panel--bottom");
	await expect(panel).toHaveCount(1);

	const entryAnimation = await panel.evaluate((element) =>
		element.getAnimations().map((animation) => {
			const effect = animation.effect;
			return {
				duration: effect?.getTiming().duration,
				keyframes:
					effect instanceof KeyframeEffect
						? effect.getKeyframes().map((keyframe) => ({
								opacity: keyframe.opacity,
								transform: keyframe.transform,
							}))
						: [],
			};
		}),
	);
	expect(entryAnimation).toHaveLength(1);
	expect(entryAnimation[0]?.duration).toBeGreaterThan(0);
	expect(entryAnimation[0]?.keyframes?.at(0)).toMatchObject({
		opacity: "0",
		transform: "translate(0px, 100%)",
	});
	expect(entryAnimation[0]?.keyframes?.at(-1)).toMatchObject({
		opacity: "1",
		transform: "translate(0px, 0%)",
	});

	await expect
		.poll(async () => panel.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	const geometry = await page.evaluate(() => {
		const panel = document.querySelector<HTMLElement>(
			".sheet-base__panel--bottom",
		);
		const backdrop = document.querySelector<HTMLElement>(
			".sheet-base__backdrop:not(.sheet-base__backdrop--full-viewport)",
		);
		const header = document.querySelector<HTMLElement>(".app-header");
		const navigation = document.querySelector<HTMLElement>(".tab-nav");
		if (!panel || !backdrop || !header || !navigation) return null;
		const panelBounds = panel.getBoundingClientRect();
		const backdropBounds = backdrop.getBoundingClientRect();
		const headerBounds = header.getBoundingClientRect();
		const navigationBounds = navigation.getBoundingClientRect();
		return {
			backdropBackgroundColor: getComputedStyle(backdrop).backgroundColor,
			backdropBottom: backdropBounds.bottom,
			backdropTop: backdropBounds.top,
			headerBottom: headerBounds.bottom,
			panelBottom: panelBounds.bottom,
			navigationTop: navigationBounds.top,
		};
	});
	expect(geometry).not.toBeNull();
	expect(Math.abs(geometry!.panelBottom - geometry!.navigationTop)).toBeLessThanOrEqual(
		2,
	);
	expect(Math.abs(geometry!.backdropTop - geometry!.headerBottom)).toBeLessThanOrEqual(
		2,
	);
	expect(
		Math.abs(geometry!.backdropBottom - geometry!.navigationTop),
	).toBeLessThanOrEqual(2);
	expect(geometry!.backdropBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
};

const readBottomSheetChrome = async (dialog: Locator) => {
	await expect(dialog).toBeVisible();
	const panel = dialog.locator(".sheet-base__panel--bottom");
	const handle = dialog.getByRole("button", { name: "Close sheet" });
	const title = dialog.locator(".bottom-sheet__header h2");
	await expect(panel).toHaveCount(1);
	await expect(handle).toHaveCount(1);
	await expect(title).toHaveCount(1);
	await expect(dialog.getByRole("button", { name: /^Back(?:\b|$)/ })).toHaveCount(
		0,
	);

	const chrome = await dialog.evaluate((element) => {
		const panel = element.querySelector<HTMLElement>(
			".sheet-base__panel--bottom",
		);
		const sheet = element.querySelector<HTMLElement>(".bottom-sheet");
		const chrome = element.querySelector<HTMLElement>(".bottom-sheet__chrome");
		const handle = element.querySelector<HTMLElement>(".bottom-sheet__handle");
		const title = element.querySelector<HTMLElement>(
			".bottom-sheet__header h2",
		);
		if (!panel || !sheet || !chrome || !handle || !title) return null;

		const panelBounds = panel.getBoundingClientRect();
		const handleBounds = handle.getBoundingClientRect();
		const titleStyles = getComputedStyle(title);
		const handleStyles = getComputedStyle(handle);
		return {
			chromeGap: getComputedStyle(chrome).gap,
			handleBorderRadius: handleStyles.borderRadius,
			handleHeight: handleBounds.height,
			handleWidth: handleBounds.width,
			horizontalCenterDifference:
				(handleBounds.left + handleBounds.right) / 2 -
				(panelBounds.left + panelBounds.right) / 2,
			panelPaddingTop: getComputedStyle(panel).paddingTop,
			sheetGap: getComputedStyle(sheet).gap,
			titleFontFamily: titleStyles.fontFamily,
			titleFontSize: titleStyles.fontSize,
			titleFontWeight: titleStyles.fontWeight,
			titleLineHeight: titleStyles.lineHeight,
			titleMargin: titleStyles.margin,
		};
	});

	expect(chrome).not.toBeNull();
	expect(Math.abs(chrome!.horizontalCenterDifference)).toBeLessThanOrEqual(1);
	return chrome!;
};

const expectMatchingBottomSheetChrome = (
	actual: Awaited<ReturnType<typeof readBottomSheetChrome>>,
	expected: Awaited<ReturnType<typeof readBottomSheetChrome>>,
) => {
	expect(actual).toMatchObject({
		chromeGap: expected.chromeGap,
		handleBorderRadius: expected.handleBorderRadius,
		panelPaddingTop: expected.panelPaddingTop,
		sheetGap: expected.sheetGap,
		titleFontFamily: expected.titleFontFamily,
		titleFontSize: expected.titleFontSize,
		titleFontWeight: expected.titleFontWeight,
		titleLineHeight: expected.titleLineHeight,
		titleMargin: expected.titleMargin,
	});
	expect(Math.abs(actual.handleHeight - expected.handleHeight)).toBeLessThanOrEqual(
		1,
	);
	expect(Math.abs(actual.handleWidth - expected.handleWidth)).toBeLessThanOrEqual(1);
};

test("URL-backed ingredient overlays close through Escape and browser history", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	const manualEntryButton = page.getByRole("button", {
		name: "Enter a custom ingredient manually",
	});
	await manualEntryButton.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/manual-entry$/);
	await expect(
		page.getByRole("dialog", { name: "Enter Manually" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(manualEntryButton).toBeFocused();

	const sortButton = page.getByRole("button", { name: "Sort saved ingredients" });
	await sortButton.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/filters$/);
	await expect(page.getByRole("dialog", { name: "Sort" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(sortButton).toBeFocused();

	const searchButton = page.getByRole("button", { name: "Open ingredient search" });
	await searchButton.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/search$/);
	await expect(page.getByRole("dialog", { name: "Ingredients" })).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(searchButton).toBeFocused();
});

test("shared ingredient bottom sheets enter from below and preserve app chrome boundaries", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	await expectBottomSheetPlacement(
		page,
		page.getByRole("dialog", { name: "Enter Manually" }),
		async () => {
			await page
				.getByRole("button", {
					name: "Enter a custom ingredient manually",
				})
				.click({ noWaitAfter: true });
		},
	);
	await page.getByRole("button", { name: "Close sheet" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);

	await expectBottomSheetPlacement(
		page,
		page.getByRole("dialog", { name: "Sort" }),
		async () => {
			await page
				.getByRole("button", { name: "Sort saved ingredients" })
				.click({ noWaitAfter: true });
		},
	);
	await page.getByRole("button", { name: "Close sheet" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);

	const firstFoodName = await page
		.locator(".saved-ingredient-card strong")
		.first()
		.innerText();
	await expectBottomSheetPlacement(
		page,
		page.getByRole("dialog", { name: firstFoodName }),
		async () => {
			await page
				.getByRole("button", { name: `Open actions for ${firstFoodName}` })
				.click({ noWaitAfter: true });
		},
	);

	await expectBottomSheetPlacement(
		page,
		page.getByRole("dialog", { name: "Rename ingredient" }),
		async () => {
			await page
				.getByRole("button", { name: "Rename", exact: true })
				.click({ noWaitAfter: true });
		},
	);
});

test("shared ingredient bottom sheets render identical chrome", async ({ page }) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	await page
		.getByRole("button", { name: "Enter a custom ingredient manually" })
		.click({ noWaitAfter: true });
	const manualEntryChrome = await readBottomSheetChrome(
		page.getByRole("dialog", { name: "Enter Manually" }),
	);
	await page.getByRole("button", { name: "Close sheet" }).click();

	await page
		.getByRole("button", { name: "Sort saved ingredients" })
		.click({ noWaitAfter: true });
	const sortChrome = await readBottomSheetChrome(
		page.getByRole("dialog", { name: "Sort" }),
	);
	await page.getByRole("button", { name: "Close sheet" }).click();

	const firstFoodName = await page
		.locator(".saved-ingredient-card strong")
		.first()
		.innerText();
	await page
		.getByRole("button", { name: `Open actions for ${firstFoodName}` })
		.click({ noWaitAfter: true });
	const actionChrome = await readBottomSheetChrome(
		page.getByRole("dialog", { name: firstFoodName }),
	);

	await page
		.getByRole("button", { name: "Rename", exact: true })
		.click({ noWaitAfter: true });
	const renameChrome = await readBottomSheetChrome(
		page.getByRole("dialog", { name: "Rename ingredient" }),
	);

	expectMatchingBottomSheetChrome(sortChrome, manualEntryChrome);
	expectMatchingBottomSheetChrome(actionChrome, manualEntryChrome);
	expectMatchingBottomSheetChrome(renameChrome, manualEntryChrome);
});

test("inside interactions and browser focus changes keep routed overlays open", async ({
	context,
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);
	const foodNameInput = page.getByLabel("Food name");
	await foodNameInput.fill("Overlay persistence test");
	await foodNameInput.click();

	const backgroundPage = await context.newPage();
	await backgroundPage.goto("about:blank");
	await backgroundPage.bringToFront();
	await page.bringToFront();

	await expect(page).toHaveURL(/\/ingredients\/fridge\/manual-entry$/);
	await expect(foodNameInput).toHaveValue("Overlay persistence test");
	await expect(page.getByRole("dialog", { name: "Enter Manually" })).toBeVisible();
	await backgroundPage.close();
});

test("modal sheet focus wraps without reaching the underlying page", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await page.getByRole("button", { name: "Sort saved ingredients" }).click();

	const dialog = page.getByRole("dialog", { name: "Sort" });
	const closeButton = dialog.getByRole("button", { name: "Close sheet" });
	await expect(closeButton).toBeFocused();

	await page.keyboard.press("Shift+Tab");
	await expect
		.poll(() =>
			dialog.evaluate((element) => element.contains(document.activeElement)),
		)
		.toBe(true);
	await page.keyboard.press("Tab");
	await expect(closeButton).toBeFocused();
});

test("right-sheet view frames keep edge focus outlines inside their clipping boundary", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);
	const ingredientSearchView = page.locator(".ingredient-search-view");
	await expectFocusOutlineInsideBoundary(
		ingredientSearchView.getByRole("button", { name: "Back to ingredients" }),
		ingredientSearchView,
	);

	const searchInput = page.getByRole("combobox", { name: "Search ingredients" });
	await searchInput.fill("spinach");
	const nutritionButton = page
		.getByRole("button", { name: /^View nutrition for / })
		.first();
	await expect(nutritionButton).toBeVisible();
	await nutritionButton.click();
	await expect(page).toHaveURL(/\/nutrition\//);
	const nutritionDetailView = page.locator(".nutrition-detail-view");
	await expectFocusOutlineInsideBoundary(
		nutritionDetailView.getByRole("button", { name: "Back to ingredients" }),
		nutritionDetailView,
	);
});
