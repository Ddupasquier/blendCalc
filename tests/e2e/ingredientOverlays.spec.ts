import {
	expect,
	expectFocusOutlineInsideBoundary,
	test,
	waitForAppReady,
} from "./support/browserTest";
import type { Locator, Page } from "@playwright/test";
import { getAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";

type CapturedEntryAnimation = {
	duration: number | undefined;
	keyframes: Array<{
		opacity: string | null | undefined;
		transform: string | null | undefined;
	}>;
};

type EntryAnimationCaptureWindow = Window & {
	__blendCalcEntryAnimationCapture?: CapturedEntryAnimation[] | null;
	__blendCalcEntryAnimationFrame?: number;
};

const installEntryAnimationCapture = async (
	page: Page,
	elementSelector: string,
) => {
	await page.evaluate((selector) => {
		const captureWindow = window as EntryAnimationCaptureWindow;
		if (captureWindow.__blendCalcEntryAnimationFrame !== undefined) {
			cancelAnimationFrame(captureWindow.__blendCalcEntryAnimationFrame);
		}
		captureWindow.__blendCalcEntryAnimationCapture = null;
		let remainingFrameCount = 180;
		const existingElements = new Set(document.querySelectorAll(selector));

		const captureAnimation = () => {
			const element = Array.from(
				document.querySelectorAll<HTMLElement>(selector),
			).find((candidate) => !existingElements.has(candidate));
			const animations = element?.getAnimations() ?? [];
			if (animations.length > 0) {
				captureWindow.__blendCalcEntryAnimationCapture = animations.map(
					(animation) => {
						const effect = animation.effect;
						const rawDuration = effect?.getTiming().duration;
						const numericDuration = Number.parseFloat(String(rawDuration));
						return {
							duration: Number.isFinite(numericDuration)
								? numericDuration
								: undefined,
							keyframes:
								effect instanceof KeyframeEffect
									? effect.getKeyframes().map((keyframe) => ({
											opacity:
												keyframe.opacity == null
													? keyframe.opacity
													: String(keyframe.opacity),
											transform:
												keyframe.transform == null
													? keyframe.transform
													: String(keyframe.transform),
										}))
									: [],
						};
					},
				);
				captureWindow.__blendCalcEntryAnimationFrame = undefined;
				return;
			}

			remainingFrameCount -= 1;
			if (remainingFrameCount <= 0) {
				captureWindow.__blendCalcEntryAnimationFrame = undefined;
				return;
			}
			captureWindow.__blendCalcEntryAnimationFrame =
				requestAnimationFrame(captureAnimation);
		};

		captureWindow.__blendCalcEntryAnimationFrame =
			requestAnimationFrame(captureAnimation);
	}, elementSelector);
};

const readCapturedEntryAnimation = async (page: Page) => {
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as EntryAnimationCaptureWindow)
						.__blendCalcEntryAnimationCapture ?? null,
			),
		)
		.not.toBeNull();

	return page.evaluate(
		() =>
			(window as EntryAnimationCaptureWindow)
				.__blendCalcEntryAnimationCapture ?? [],
	);
};

const expectBottomSheetPlacement = async (
	page: Page,
	dialog: Locator,
	openSheet: () => Promise<void>,
) => {
	const panelSelector = ".sheet-base__panel--bottom";
	await installEntryAnimationCapture(page, panelSelector);
	await openSheet();
	await expect(dialog).toBeVisible();
	const panel = dialog.locator(panelSelector);
	await expect(panel).toHaveCount(1);

	const entryAnimation = await readCapturedEntryAnimation(page);
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
		.poll(async () =>
			panel.evaluate((element) => element.getAnimations().length),
		)
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
	expect(
		Math.abs(geometry!.panelBottom - geometry!.navigationTop),
	).toBeLessThanOrEqual(2);
	expect(
		Math.abs(geometry!.backdropTop - geometry!.headerBottom),
	).toBeLessThanOrEqual(2);
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
	await expect(
		dialog.getByRole("button", { name: /^Back(?:\b|$)/ }),
	).toHaveCount(0);

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
	expect(
		Math.abs(actual.handleHeight - expected.handleHeight),
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(actual.handleWidth - expected.handleWidth),
	).toBeLessThanOrEqual(1);
};

const waitForBottomSheetToSettle = async (dialog: Locator) => {
	const panel = dialog.locator(".sheet-base__panel--bottom");
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

const expectIngredientSearchEntersFromRight = async (
	page: Page,
	listRoute: "/ingredients/fridge" | "/ingredients/shopping",
) => {
	await page.goto(listRoute);
	await waitForAppReady(page);
	await installEntryAnimationCapture(page, ".sheet-base__panel--right");
	await page
		.getByRole("button", { name: "Open ingredient search" })
		.click({ noWaitAfter: true });

	const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
	await expect(searchDialog).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
	const panel = searchDialog.locator(".sheet-base__panel--right");
	const entryAnimation = await readCapturedEntryAnimation(page);

	expect(entryAnimation).toHaveLength(1);
	expect(entryAnimation[0]?.duration).toBeGreaterThan(0);
	expect(entryAnimation[0]?.keyframes?.at(0)).toMatchObject({
		opacity: "0",
		transform: expect.stringMatching(/^translate\(100%(?:, 0px)?\)$/),
	});
	expect(entryAnimation[0]?.keyframes?.at(-1)).toMatchObject({
		opacity: "1",
		transform: expect.stringMatching(/^translate\((?:0%|0px)(?:, 0px)?\)$/),
	});
	await expect
		.poll(() => panel.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	await expect(
		searchDialog.getByRole("combobox", { name: "Search ingredients" }),
	).toBeFocused();
};

const reachManualEntryExtendedStep = async (dialog: Locator) => {
	await dialog.getByLabel("Food name").fill("Extended sheet scroll test");
	await dialog.getByRole("button", { name: "Category" }).click();
	const categorySearch = dialog.getByRole("searchbox", {
		name: "Search categories",
	});
	await categorySearch.fill("protein bar");
	await expect(
		dialog.getByRole("status", { name: "Searching categories" }),
	).toBeHidden({ timeout: 20_000 });
	await dialog
		.getByRole("button", { name: "Protein Bars", exact: true })
		.first()
		.click();
	await dialog.getByRole("button", { name: "Continue" }).click();
	await dialog.getByLabel("Weight (g)").fill("100");
	await dialog.getByRole("button", { name: "Continue" }).click();

	const requiredMacroInputs = dialog.locator(
		'.manual-nutrients__fields input[aria-required="true"]',
	);
	await expect(requiredMacroInputs.first()).toBeVisible();
	for (let index = 0; index < (await requiredMacroInputs.count()); index += 1) {
		await requiredMacroInputs.nth(index).fill("1");
	}
	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(dialog.getByRole("tab", { name: "Extended" })).toHaveAttribute(
		"aria-current",
		"step",
	);
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

	const sortButton = page.getByRole("button", {
		name: "Filter and sort saved ingredients",
	});
	await sortButton.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/filters$/);
	await expect(
		page.getByRole("dialog", { name: "Filter and sort" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(sortButton).toBeFocused();

	const searchButton = page.getByRole("button", {
		name: "Open ingredient search",
	});
	await searchButton.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/search$/);
	await expect(page.getByRole("dialog", { name: "Ingredients" })).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(searchButton).toBeFocused();
});

test("manual entry closes through every supported sheet control without activating the page beneath", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	const manualEntryButton = page.getByRole("button", {
		name: "Enter a custom ingredient manually",
	});
	const sortButton = page.getByRole("button", {
		name: "Filter and sort saved ingredients",
	});
	const manualEntryDialog = page.getByRole("dialog", {
		name: "Enter Manually",
	});
	const sortDialog = page.getByRole("dialog", { name: "Filter and sort" });
	const openManualEntry = async () => {
		await manualEntryButton.click({ noWaitAfter: true });
		await expect(page).toHaveURL(/\/ingredients\/fridge\/manual-entry$/);
		await expect(manualEntryDialog).toBeVisible();
		await expect(
			manualEntryDialog.getByRole("button", { name: /^Back(?:\b|$)/ }),
		).toHaveCount(0);
	};
	const expectOnlyBasePage = async () => {
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		await expect(manualEntryDialog).toBeHidden();
		await expect(sortDialog).toBeHidden();
		await expect(sortButton).toHaveAttribute("aria-expanded", "false");
	};

	await openManualEntry();
	await manualEntryDialog.getByRole("button", { name: "Close sheet" }).click();
	await expectOnlyBasePage();
	await expect(manualEntryButton).toBeFocused();

	await openManualEntry();
	await manualEntryDialog.getByLabel("Food name").click();
	const backdrop = page.locator(".sheet-base__backdrop");
	const panel = manualEntryDialog.locator(".sheet-base__panel--bottom");
	const exposedBackdropPoint = await Promise.all([
		backdrop.boundingBox(),
		panel.boundingBox(),
	]).then(([backdropBounds, panelBounds]) => {
		if (!backdropBounds || !panelBounds) return null;
		return {
			x: backdropBounds.x + backdropBounds.width / 2,
			y: backdropBounds.y + Math.max(1, (panelBounds.y - backdropBounds.y) / 2),
		};
	});
	expect(exposedBackdropPoint).not.toBeNull();
	await page.mouse.click(exposedBackdropPoint!.x, exposedBackdropPoint!.y);
	await expectOnlyBasePage();
	await expect(manualEntryButton).toBeFocused();

	await openManualEntry();
	await page.keyboard.press("Escape");
	await expectOnlyBasePage();
	await expect(manualEntryButton).toBeFocused();
});

test("long manual entry content scrolls beneath persistent shared sheet chrome", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);
	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await reachManualEntryExtendedStep(dialog);

	const content = dialog.locator(".bottom-sheet__content");
	const chrome = dialog.locator(".bottom-sheet__chrome");
	const handle = dialog.getByRole("button", { name: "Close sheet" });
	const nutrientGroups = dialog.locator(".manual-nutrients__group");
	await expect(nutrientGroups.first()).toBeVisible();
	for (let index = 0; index < (await nutrientGroups.count()); index += 1) {
		const group = nutrientGroups.nth(index);
		if (!(await group.getAttribute("open"))) {
			await group.locator("summary").click();
		}
	}

	const firstField = dialog.locator(".manual-nutrients__fields input").first();
	const lastField = dialog.locator(".manual-nutrients__fields input").last();
	const continueButton = dialog.getByRole("button", { name: "Continue" });
	await expect(firstField).toBeVisible();
	const initialGeometry = await Promise.all([
		chrome.boundingBox(),
		handle.boundingBox(),
		page.evaluate(() => window.scrollY),
	]);

	const scrollMetrics = await content.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
		return {
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			scrollTop: element.scrollTop,
		};
	});
	expect(scrollMetrics.scrollHeight).toBeGreaterThan(
		scrollMetrics.clientHeight,
	);
	expect(scrollMetrics.scrollTop).toBeGreaterThan(0);
	await expect(lastField).toBeVisible();
	await expect(continueButton).toBeVisible();
	await expect(chrome).toBeVisible();
	await expect(handle).toBeVisible();

	const bottomGeometry = await Promise.all([
		chrome.boundingBox(),
		handle.boundingBox(),
		page.evaluate(() => window.scrollY),
	]);
	expect(
		Math.abs(bottomGeometry[0]!.y - initialGeometry[0]!.y),
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(bottomGeometry[1]!.y - initialGeometry[1]!.y),
	).toBeLessThanOrEqual(1);
	expect(bottomGeometry[2]).toBe(initialGeometry[2]);

	await content.evaluate((element) => {
		element.scrollTop = 0;
	});
	await expect(firstField).toBeVisible();
	await expect(chrome).toBeVisible();
	await expect(handle).toBeVisible();
});

test("short and filled bottom sheets honor shared responsive height bounds", async ({
	page,
}) => {
	const viewports = [
		{ width: 1280, height: 900 },
		{ width: 390, height: 667 },
		{ width: 360, height: 568 },
	];

	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);

		await page
			.getByRole("button", { name: "Filter and sort saved ingredients" })
			.click();
		const sortDialog = page.getByRole("dialog", { name: "Filter and sort" });
		await expect(sortDialog).toBeVisible();
		await waitForBottomSheetToSettle(sortDialog);
		const sortHeight = await sortDialog
			.locator(".sheet-base__panel--bottom")
			.evaluate((element) => element.getBoundingClientRect().height);
		await sortDialog.getByRole("button", { name: "Close sheet" }).click();

		await page
			.getByRole("button", { name: "Enter a custom ingredient manually" })
			.click();
		const manualEntryDialog = page.getByRole("dialog", {
			name: "Enter Manually",
		});
		await expect(manualEntryDialog).toBeVisible();
		await waitForBottomSheetToSettle(manualEntryDialog);
		const bounds = await manualEntryDialog.evaluate((dialog) => {
			const panel = dialog.querySelector<HTMLElement>(
				".sheet-base__panel--bottom",
			);
			const header = document.querySelector<HTMLElement>(".app-header");
			const navigation = document.querySelector<HTMLElement>(".tab-nav");
			if (!panel || !header || !navigation) return null;
			const panelBounds = panel.getBoundingClientRect();
			const headerBounds = header.getBoundingClientRect();
			const navigationBounds = navigation.getBoundingClientRect();
			return {
				headerBottom: headerBounds.bottom,
				navigationTop: navigationBounds.top,
				panelBottom: panelBounds.bottom,
				panelHeight: panelBounds.height,
				panelTop: panelBounds.top,
			};
		});
		expect(bounds).not.toBeNull();
		const availableShellHeight = bounds!.navigationTop - bounds!.headerBottom;
		const sharedMaximumHeight = Math.min(
			viewport.height * 0.8,
			availableShellHeight,
		);

		expect(sortHeight).toBeGreaterThan(0);
		expect(sortHeight).toBeLessThan(sharedMaximumHeight - 1);
		expect(bounds!.panelHeight).toBeGreaterThan(sortHeight);
		expect(
			Math.abs(bounds!.panelHeight - sharedMaximumHeight),
		).toBeLessThanOrEqual(2);
		expect(bounds!.panelTop).toBeGreaterThanOrEqual(bounds!.headerBottom - 1);
		expect(
			Math.abs(bounds!.panelBottom - bounds!.navigationTop),
		).toBeLessThanOrEqual(2);
		await manualEntryDialog
			.getByRole("button", { name: "Close sheet" })
			.click();
	}
});

test("ingredient search enters from the right in both saved-list contexts", async ({
	page,
}) => {
	await expectIngredientSearchEntersFromRight(page, "/ingredients/fridge");
	await page.getByRole("button", { name: "Back to ingredients" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);

	await expectIngredientSearchEntersFromRight(page, "/ingredients/shopping");
	await page.getByRole("button", { name: "Back to ingredients" }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);

	for (const listRoute of [
		"/ingredients/fridge",
		"/ingredients/shopping",
	] as const) {
		await page.goto(`${listRoute}/search`);
		await waitForAppReady(page);
		await expect(
			page.getByRole("dialog", { name: "Ingredients" }),
		).toBeVisible();
		await page.reload();
		await waitForAppReady(page);
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(
			page.getByRole("dialog", { name: "Ingredients" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Back to ingredients" }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}$`));
	}
});

test("search scanner and saved-list sort return to the active search context", async ({
	page,
}) => {
	const contexts = [
		{
			listRoute: "/ingredients/fridge",
			query: "spinach",
			resultName: /^Spinach, Raw,/,
		},
		{
			listRoute: "/ingredients/shopping",
			query: "tomat",
			resultName: /^Tomatoes, Green, Raw,/,
		},
	] as const;

	for (const { listRoute, query, resultName } of contexts) {
		await page.goto(`${listRoute}/search`);
		await waitForAppReady(page);

		const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
		const searchInput = searchDialog.getByRole("combobox", {
			name: "Search ingredients",
		});
		const scannerButton = searchDialog.getByRole("button", {
			name: "Scan barcode",
		});
		const sortButton = searchDialog.getByRole("button", {
			name: "Filter and sort ingredients",
		});

		const partialQuery = query.slice(0, 4);
		const initialSearchResponse = page.waitForResponse((response) => {
			const responseUrl = new URL(response.url());
			return (
				responseUrl.pathname === "/api/foods/search" &&
				responseUrl.searchParams.get("q") === partialQuery &&
				response.ok()
			);
		});
		await searchInput.fill(partialQuery);
		await initialSearchResponse;
		await scannerButton.click();
		await expect(page).toHaveURL(
			new RegExp(`${listRoute}/search/barcode-scanner$`),
		);
		const scannerDialog = page.getByRole("dialog", { name: "Scan Barcode" });
		await expect(scannerDialog).toBeVisible();
		await scannerDialog
			.getByRole("button", { name: "Close barcode scanner" })
			.click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(searchDialog).toBeVisible();
		await expect(searchInput).toHaveValue(partialQuery);
		await expect(scannerButton).toBeFocused();

		await sortButton.click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search/filters$`));
		const sortDialog = page.getByRole("dialog", {
			name: "Filter and sort",
			exact: true,
		});
		await expect(sortDialog).toBeVisible();
		await sortDialog.getByRole("button", { name: "Close sheet" }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(searchDialog).toBeVisible();
		await expect(searchInput).toHaveValue(partialQuery);
		await expect(sortButton).toBeFocused();

		await sortButton.click();
		await sortDialog.getByRole("button", { name: "A → Z" }).click();
		await sortDialog.getByRole("button", { name: "Apply" }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(searchInput).toHaveValue(partialQuery);

		await searchInput.fill(query);
		const result = searchDialog.getByRole("row", { name: resultName });
		await expect(result).toBeVisible();
		await result.getByRole("button", { name: /^View nutrition for / }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/nutrition/-?\\d+$`));
		await expect(page.locator("#nutrition-detail-view-title")).toBeVisible();
	}
});

test(
	"nutrition routes replace and restore descriptive browser titles",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await page.goto("/ingredients/fridge/search");
		await waitForAppReady(page);
		await expect(page).toHaveTitle("Search Ingredients · blendCalc");

		const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
		const searchInput = searchDialog.getByRole("combobox", {
			name: "Search ingredients",
		});
		await searchInput.fill("spinach");

		const spinachRawResult = searchDialog.getByRole("row", {
			name: /^Spinach, Raw,/,
		});
		await expect(spinachRawResult).toBeVisible();
		await spinachRawResult
			.getByRole("button", { name: /^View nutrition for Spinach, Raw/ })
			.click();
		await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\/9200001$/);
		await expect(page).toHaveTitle("Spinach, Raw Nutrition · blendCalc");

		await page.goBack();
		await expect(page).toHaveURL(/\/ingredients\/fridge\/search$/);
		await expect(page).toHaveTitle("Search Ingredients · blendCalc");
		await searchInput.fill("spinach");

		const packagedSpinachNutritionButton = searchDialog
			.locator("#ingredient-search-result-1905313")
			.getByRole("button", {
				name: /^View nutrition for Spinach/,
			});
		await expect(packagedSpinachNutritionButton).toBeVisible();
		await packagedSpinachNutritionButton.click();
		await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\/1905313$/);
		await expect(page).toHaveTitle("Spinach Nutrition · blendCalc");

		await page.reload();
		await waitForAppReady(page);
		await expect(page).toHaveTitle("Spinach Nutrition · blendCalc");
	},
);

test("partial ingredient words combine every eligible source and remain selectable", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);

	const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
	const searchInput = searchDialog.getByRole("combobox", {
		name: "Search ingredients",
	});
	const searchResults = searchDialog.getByRole("grid", {
		name: "Search results",
	});

	const search = async (query: string) => {
		const responsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				url.pathname === "/api/foods/search" &&
				url.searchParams.get("q") === query
			);
		});
		await searchInput.fill(query);
		const response = await responsePromise;
		expect(response.status()).toBe(200);
		return response.json() as Promise<{
			foods: Array<{
				description: string;
				fdcId: number;
				sourceKey?: string;
				trustStatus?: string;
			}>;
			total: number;
		}>;
	};

	const partialTomatoResults = await search("tomat");
	const partialTomatoNames = partialTomatoResults.foods.map(
		(food) => food.description,
	);
	expect(partialTomatoNames.slice(0, 5)).toEqual([
		"Tomato",
		"Tomato, Roma, Raw",
		"Tomatoes, Green, Raw",
		"Diced Tomatoes, Tomatoes",
		"Green Tomato Pantry Preserve",
	]);
	await expect(searchResults.getByRole("row")).toHaveCount(
		partialTomatoNames.length,
	);
	expect(
		await searchResults
			.locator(".ingredient-search-card__copy strong")
			.allTextContents(),
	).toEqual(partialTomatoNames);
	expect(
		new Set(partialTomatoResults.foods.map((food) => food.fdcId)).size,
	).toBe(partialTomatoResults.foods.length);
	const partialTomatoSourceKeys = new Set(
		partialTomatoResults.foods.map((food) => food.sourceKey),
	);
	expect(partialTomatoSourceKeys.has("custom")).toBe(true);
	expect(partialTomatoSourceKeys.has("shared-catalog")).toBe(true);
	expect(partialTomatoSourceKeys.has("usda")).toBe(true);
	await expect(
		searchResults.getByRole("row", {
			name: /^Green Tomato Pantry Preserve,/,
		}),
	).toBeVisible();
	await expect(
		searchResults.getByRole("row", { name: /^Tomato, Roma, Raw,/ }),
	).toBeVisible();
	await expect(
		searchResults.getByRole("row", {
			name: /^Tomato, Vegetables and Vegetable Products/,
		}),
	).toBeVisible();
	const latePartialMatch = searchResults.getByRole("row", {
		name: /^Babyfood, Dinner, Macaroni & Tomato,/,
	});
	await latePartialMatch.scrollIntoViewIfNeeded();
	await expect(latePartialMatch).toBeVisible();

	const multiWordResults = await search("green tomat");
	expect(multiWordResults.foods.map((food) => food.description)).toEqual([
		"Green Tomato Pantry Preserve",
		"Tomatoes, Green, Raw",
	]);
	await expect(searchResults.getByRole("row")).toHaveCount(2);

	const completedWordResults = await search("tomato");
	expect(completedWordResults.total).toBeGreaterThanOrEqual(6);
	expect(completedWordResults.foods.map((food) => food.description)).toEqual(
		partialTomatoNames,
	);
	await expect(searchResults.getByRole("row")).toHaveCount(
		partialTomatoNames.length,
	);
	expect(
		await searchResults
			.locator(".ingredient-search-card__copy strong")
			.allTextContents(),
	).toEqual(partialTomatoNames);
	const completedTomatoNames = completedWordResults.foods.map(
		(food) => food.description,
	);
	for (const strongMatch of [
		"Tomato",
		"Tomato, Roma, Raw",
		"Tomatoes, Green, Raw",
		"Diced Tomatoes, Tomatoes",
		"Green Tomato Pantry Preserve",
	]) {
		expect(completedTomatoNames.indexOf(strongMatch)).toBeGreaterThanOrEqual(0);
		expect(completedTomatoNames.indexOf(strongMatch)).toBeLessThan(
			completedTomatoNames.indexOf("Babyfood, Dinner, Macaroni & Tomato"),
		);
	}
	await expect(
		searchResults.getByRole("row", { name: /^Tomatoes, Green, Raw,/ }),
	).toBeVisible();

	for (const [query, expectedResultName] of [
		["tomatoes green", /^Tomatoes, Green, Raw,/],
		["spin", /^Spinach, Raw,/],
		["strawb", /^Strawberries, Raw,/],
		["rookshir", /^100% Juice Lemon Juice,/],
		["hellfis", /^Shrimp, Cooked,/],
		["bisulf", /^100% Juice Lemon Juice,/],
		["aylor far", /^Marketside Iceberg Salad, 12 Ounce,/],
	] as const) {
		const results = await search(query);
		expect(results.total).toBeGreaterThan(0);
		await expect(
			searchResults.getByRole("row", { name: expectedResultName }),
		).toBeVisible();
	}

	for (const query of ["zzzz-no-match", "t"]) {
		const results = await search(query);
		expect(results).toMatchObject({ foods: [], total: 0 });
		await expect(searchDialog.getByRole("row")).toHaveCount(0);
		await expect(searchInput).toHaveAttribute("aria-expanded", "false");
		const emptySearchNotice = searchDialog.getByRole("status");
		await expect(emptySearchNotice).toContainText("Nothing found");
		await expect(emptySearchNotice).toContainText(query);
	}

	await search("green tomat");
	await expect(searchDialog.getByText("Nothing found")).toHaveCount(0);
	const sharedCatalogResult = searchResults.getByRole("row", {
		name: /^Tomatoes, Green, Raw,/,
	});
	await sharedCatalogResult
		.getByRole("button", { name: /^View nutrition for Tomatoes, Green, Raw/ })
		.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\/170456$/);
	await expect(page.locator("#nutrition-detail-view-title")).toContainText(
		"Tomatoes, Green, Raw",
	);
});

test(
	"phone search pagination loads only on request and preserves ordered results",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			!testInfo.project.name.startsWith("mobile-"),
			"Search pagination is verified in the phone-sized browser projects.",
		);

		const searchRequests: Array<{
			limit: number;
			offset: number;
			query: string;
		}> = [];
		page.on("request", (request) => {
			const url = new URL(request.url());
			if (url.pathname !== "/api/foods/search") return;
			searchRequests.push({
				limit: Number(url.searchParams.get("limit")),
				offset: Number(url.searchParams.get("offset")),
				query: url.searchParams.get("q") ?? "",
			});
		});

		await page.goto("/ingredients/fridge/search");
		await waitForAppReady(page);

		const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
		const searchInput = searchDialog.getByRole("combobox", {
			name: "Search ingredients",
		});
		const searchResults = searchDialog.getByRole("grid", {
			name: "Search results",
		});
		const resultsPanel = searchDialog.locator(".results-panel");
		const waitForSearchPage = (query: string, offset: number) =>
			page.waitForResponse((response) => {
				const url = new URL(response.url());
				return (
					url.pathname === "/api/foods/search" &&
					url.searchParams.get("q") === query &&
					Number(url.searchParams.get("offset")) === offset
				);
			});
		const readRenderedFoodIds = () =>
			searchResults
				.locator(".ingredient-search-card")
				.evaluateAll((cards) =>
					cards.map((card) => card.id.replace("ingredient-search-result-", "")),
				);

		const firstPageResponsePromise = waitForSearchPage("food", 0);
		await searchInput.fill("food");
		const firstPageResponse = await firstPageResponsePromise;
		expect(firstPageResponse.status()).toBe(200);
		const firstPage = (await firstPageResponse.json()) as {
			foods: Array<{ fdcId: number }>;
			hasMore: boolean;
			nextOffset: number | null;
			total: number;
		};
		expect(firstPage).toMatchObject({ hasMore: true, nextOffset: 15 });
		expect(firstPage.total).toBeGreaterThan(30);
		expect(firstPage.foods).toHaveLength(15);
		await expect(searchResults.getByRole("row")).toHaveCount(15);
		const firstPageIds = await readRenderedFoodIds();
		expect(firstPageIds).toEqual(
			firstPage.foods.map((food) => String(food.fdcId)),
		);

		await resultsPanel.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
			element.dispatchEvent(new Event("scroll"));
		});
		await page.waitForTimeout(3_000);
		expect(searchRequests.filter(({ query }) => query === "food")).toEqual([
			{ limit: 15, offset: 0, query: "food" },
		]);

		let loadMoreButton = searchDialog.getByRole("button", {
			name: "Load more",
		});
		await expect(loadMoreButton).toBeVisible();
		await expect(
			searchDialog.getByRole("button", { name: "Return to top" }),
		).toBeVisible();
		const scrollTopBeforeAppend = await resultsPanel.evaluate(
			(element) => element.scrollTop,
		);
		const secondPageResponsePromise = waitForSearchPage("food", 15);
		await loadMoreButton.evaluate((button) => {
			(button as HTMLButtonElement).click();
			(button as HTMLButtonElement).click();
		});
		const secondPageResponse = await secondPageResponsePromise;
		expect(secondPageResponse.status()).toBe(200);
		const secondPage = (await secondPageResponse.json()) as {
			foods: Array<{ fdcId: number }>;
			hasMore: boolean;
			nextOffset: number | null;
			total: number;
		};
		expect(secondPage).toMatchObject({
			hasMore: true,
			nextOffset: 30,
			total: firstPage.total,
		});
		expect(secondPage.foods).toHaveLength(15);
		await expect(searchResults.getByRole("row")).toHaveCount(30);
		const firstTwoPageIds = await readRenderedFoodIds();
		expect(firstTwoPageIds.slice(0, 15)).toEqual(firstPageIds);
		expect(new Set(firstTwoPageIds).size).toBe(firstTwoPageIds.length);
		expect(
			searchRequests.filter(
				({ query, offset }) => query === "food" && offset === 15,
			),
		).toHaveLength(1);
		expect(
			await resultsPanel.evaluate((element) => element.scrollTop),
		).toBeGreaterThanOrEqual(scrollTopBeforeAppend - 2);

		loadMoreButton = searchDialog.getByRole("button", { name: "Load more" });
		await loadMoreButton.scrollIntoViewIfNeeded();
		const finalPageResponsePromise = waitForSearchPage("food", 30);
		await loadMoreButton.click();
		const finalPageResponse = await finalPageResponsePromise;
		expect(finalPageResponse.status()).toBe(200);
		const finalPage = (await finalPageResponse.json()) as {
			foods: Array<{ fdcId: number }>;
			hasMore: boolean;
			nextOffset: number | null;
			total: number;
		};
		expect(finalPage).toMatchObject({
			hasMore: false,
			nextOffset: null,
			total: firstPage.total,
		});
		await expect(searchResults.getByRole("row")).toHaveCount(firstPage.total);
		const allFoodIds = await readRenderedFoodIds();
		expect(allFoodIds.slice(0, 30)).toEqual(firstTwoPageIds);
		expect(new Set(allFoodIds).size).toBe(allFoodIds.length);
		await expect(loadMoreButton).toHaveCount(0);

		const returnToTopButton = searchDialog.getByRole("button", {
			name: "Return to top",
		});
		await expect(returnToTopButton).toBeVisible();
		await returnToTopButton.click();
		await expect
			.poll(() => resultsPanel.evaluate((element) => element.scrollTop))
			.toBeLessThanOrEqual(1);

		const resetQueryResponsePromise = waitForSearchPage("tomato", 0);
		await searchInput.fill("tomato");
		const resetQueryResponse = await resetQueryResponsePromise;
		expect(resetQueryResponse.status()).toBe(200);
		const resetQueryPage = (await resetQueryResponse.json()) as {
			foods: Array<{ fdcId: number }>;
			hasMore: boolean;
			total: number;
		};
		await expect(searchResults.getByRole("row")).toHaveCount(
			resetQueryPage.foods.length,
		);
		expect(await readRenderedFoodIds()).toEqual(
			resetQueryPage.foods.map((food) => String(food.fdcId)),
		);
		expect(resetQueryPage.total).toBeLessThan(15);
		expect(resetQueryPage.hasMore).toBe(false);
		await expect(
			searchDialog.getByRole("button", { name: "Load more" }),
		).toHaveCount(0);
	},
);

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
		page.getByRole("dialog", { name: "Filter and sort" }),
		async () => {
			await page
				.getByRole("button", {
					name: "Filter and sort saved ingredients",
				})
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
				.getByRole("button", {
					name: `Open actions for ${firstFoodName}`,
					exact: true,
				})
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

test("shared ingredient bottom sheets render identical chrome", async ({
	page,
}) => {
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
		.getByRole("button", { name: "Filter and sort saved ingredients" })
		.click({ noWaitAfter: true });
	const sortChrome = await readBottomSheetChrome(
		page.getByRole("dialog", { name: "Filter and sort" }),
	);
	await page.getByRole("button", { name: "Close sheet" }).click();

	const firstFoodName = await page
		.locator(".saved-ingredient-card strong")
		.first()
		.innerText();
	await page
		.getByRole("button", {
			name: `Open actions for ${firstFoodName}`,
			exact: true,
		})
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
	await expect(
		page.getByRole("dialog", { name: "Enter Manually" }),
	).toBeVisible();
	await backgroundPage.close();
});

test("modal sheet focus wraps without reaching the underlying page", async ({
	page,
}) => {
	for (const { route, dialogName } of [
		{
			route: "/ingredients/fridge/filters",
			dialogName: "Filter and sort",
		},
		{
			route: "/ingredients/fridge/manual-entry",
			dialogName: "Enter Manually",
		},
	]) {
		await page.goto(route);
		await waitForAppReady(page);

		const dialog = page.getByRole("dialog", { name: dialogName });
		const closeButton = dialog.getByRole("button", { name: "Close sheet" });
		await closeButton.focus();

		await page.keyboard.press("Shift+Tab");
		await expect
			.poll(() =>
				dialog.evaluate((element) => {
					const focusableElements = Array.from(
						element.querySelectorAll<HTMLElement>(
							"a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
						),
					).filter(
						(focusableElement) =>
							!focusableElement.closest("[hidden], [aria-hidden='true']") &&
							focusableElement.getAttribute("aria-disabled") !== "true",
					);
					return document.activeElement === focusableElements.at(-1);
				}),
			)
			.toBe(true);
		await page.keyboard.press("Tab");
		await expect(closeButton).toBeFocused();
	}
});

test("right-sheet view frames keep edge focus outlines inside their clipping boundary", async ({
	page,
}, testInfo) => {
	if (testInfo.project.name === "desktop-chromium") {
		await page.setViewportSize({ width: 390, height: 844 });
	}
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);
	const ingredientSearchView = page.locator(".ingredient-search-view");
	await expectFocusOutlineInsideBoundary(
		ingredientSearchView.getByRole("button", { name: "Back to ingredients" }),
		ingredientSearchView,
	);

	const searchInput = page.getByRole("combobox", {
		name: "Search ingredients",
	});
	await searchInput.fill("spinach");
	const nutritionButton = page
		.getByRole("button", { name: /^View nutrition for / })
		.first();
	await expect(nutritionButton).toBeVisible();
	await nutritionButton.click();
	await expect(page).toHaveURL(/\/nutrition\//);
	const nutritionDetailView = page.locator(".nutrition-detail-view");
	const nutritionBackButton = nutritionDetailView.getByRole("button", {
		name: "Back to ingredients",
	});
	await expectFocusOutlineInsideBoundary(
		nutritionBackButton,
		nutritionDetailView,
	);
	const nutritionBackButtonPresentation = await nutritionBackButton.evaluate(
		(element) => {
			const styles = window.getComputedStyle(element);
			return {
				borderRadius: styles.borderRadius,
				height: element.getBoundingClientRect().height,
				width: element.getBoundingClientRect().width,
			};
		},
	);
	expect(
		Math.abs(
			nutritionBackButtonPresentation.width -
				nutritionBackButtonPresentation.height,
		),
	).toBeLessThanOrEqual(1);
	expect(nutritionBackButtonPresentation.width).toBeLessThan(40);
	expect(
		Number.parseFloat(nutritionBackButtonPresentation.borderRadius),
	).toBeGreaterThanOrEqual(nutritionBackButtonPresentation.width / 2 - 1);
	await nutritionBackButton.press("Enter");
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(
		page.getByRole("region", { name: "Saved ingredients", exact: true }),
	).toBeVisible();
});

test("nutrition details separate personalized warnings from source allergen disclosures", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The DB-backed food-disclosure contract runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"Preference mutation is restricted to disposable local infrastructure.",
	);

	const supabase = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);
	const { data: authenticatedUserData, error: authenticatedUserError } =
		await supabase.auth.getUser();
	if (authenticatedUserError || !authenticatedUserData.user) {
		throw (
			authenticatedUserError ??
			new Error("The QA user could not be authenticated.")
		);
	}
	const userId = authenticatedUserData.user.id;
	const { data: originalPreferences, error: preferenceReadError } =
		await supabase
			.from("user_food_preferences")
			.select("allergens,dietary_restrictions")
			.eq("user_id", userId)
			.single();
	if (preferenceReadError) throw preferenceReadError;

	try {
		const { error: preferenceUpdateError } = await supabase
			.from("user_food_preferences")
			.update({
				allergens: ["peanut"],
				dietary_restrictions: ["gluten-free"],
			})
			.eq("user_id", userId);
		if (preferenceUpdateError) throw preferenceUpdateError;

		await page.goto("/ingredients/fridge/nutrition/9100003");
		await waitForAppReady(page);
		const nutritionDetails = page.locator(".nutrition-detail-view");
		await expect(
			nutritionDetails.getByText("Check this ingredient"),
		).toBeVisible();
		await expect(
			nutritionDetails.getByText(
				/current package label is the final authority/i,
			),
		).toBeVisible();

		const ingredientsHeading = nutritionDetails.getByRole("heading", {
			name: "Ingredients",
		});
		const containsHeading = nutritionDetails.getByRole("heading", {
			name: "Contains",
		});
		const mayContainHeading = nutritionDetails.getByRole("heading", {
			name: "May contain",
		});
		const dietaryLabelsHeading = nutritionDetails.getByRole("heading", {
			name: "Dietary labels",
		});
		await expect(ingredientsHeading).toBeVisible();
		await expect(
			nutritionDetails.getByText(/red pepper powder/i),
		).toBeVisible();
		await expect(containsHeading).toBeVisible();
		await expect(nutritionDetails.getByText("Soy, Wheat")).toBeVisible();
		await expect(mayContainHeading).toHaveCount(0);
		await expect(dietaryLabelsHeading).toBeVisible();
		await expect(
			dietaryLabelsHeading.locator("xpath=..").getByText("Vegetarian", {
				exact: true,
			}),
		).toBeVisible();
		const dietaryConsiderationsHeading = nutritionDetails.getByRole("heading", {
			name: "Dietary considerations",
		});
		await expect(dietaryConsiderationsHeading).toBeVisible();
		await expect(
			dietaryConsiderationsHeading
				.locator("xpath=..")
				.getByText("Alcohol", { exact: true }),
		).toBeVisible();

		const summaryOrder = await nutritionDetails.evaluate((element) => {
			const headingOrder = [
				"Ingredients",
				"Contains",
				"Dietary labels",
				"Dietary considerations",
			].map((name) =>
				Array.from(element.querySelectorAll("h2")).find(
					(heading) => heading.textContent?.trim() === name,
				),
			);
			return headingOrder.every((heading, index) => {
				if (!heading) return false;
				if (index === 0) return true;
				const previousHeading = headingOrder[index - 1];
				return Boolean(
					previousHeading &&
					previousHeading.compareDocumentPosition(heading) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				);
			});
		});
		expect(summaryOrder).toBe(true);
	} finally {
		await supabase
			.from("user_food_preferences")
			.update({
				allergens: originalPreferences.allergens,
				dietary_restrictions: originalPreferences.dietary_restrictions,
			})
			.eq("user_id", userId);
	}
});

test("the Food passport keeps catalog depth optional and responsive", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/nutrition/9100003");
	await waitForAppReady(page);

	const nutritionDetails = page.locator(".nutrition-detail-view");
	const passportSummary = nutritionDetails.locator("summary").filter({
		hasText: "Food passport",
	});
	const passportDetails = passportSummary.locator("..");
	await expect(passportSummary).toBeVisible();
	await expect(passportSummary).toContainText(/Verified|Shared record/);
	await expect(passportDetails).not.toHaveAttribute("open", "");
	await expect(
		passportDetails.getByRole("heading", { name: "Information available" }),
	).toBeHidden();

	await passportSummary.focus();
	await expect(passportSummary).toBeFocused();
	await passportSummary.press("Enter");
	await expect(passportDetails).toHaveAttribute("open", "");
	await expect(
		passportDetails.getByRole("heading", { name: "Information available" }),
	).toBeVisible();
	await expect(
		passportDetails.getByText(/does not mean zero, none, or allergen-free/i),
	).toBeVisible();
	await expect(
		passportDetails.locator("summary").filter({
			hasText: "Product details",
		}),
	).toBeVisible();
	expect(
		await passportDetails.evaluate(
			(element) => element.scrollWidth <= element.clientWidth + 1,
		),
	).toBe(true);
});

test("nutrition details preserve the complete source-backed food record", async ({
	page,
}, testInfo) => {
	test.setTimeout(300_000);
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The complete DB-backed nutrition record contract runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"Preference mutation is restricted to disposable local infrastructure.",
	);

	const supabase = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);
	const { data: authenticatedUserData, error: authenticatedUserError } =
		await supabase.auth.getUser();
	if (authenticatedUserError || !authenticatedUserData.user) {
		throw (
			authenticatedUserError ??
			new Error("The QA user could not be authenticated.")
		);
	}
	const userId = authenticatedUserData.user.id;
	const { data: originalPreferences, error: preferenceReadError } =
		await supabase
			.from("user_food_preferences")
			.select("allergens,dietary_restrictions")
			.eq("user_id", userId)
			.single();
	if (preferenceReadError) throw preferenceReadError;

	const replacePreferences = async (
		allergens: string[],
		dietaryRestrictions: string[],
	) => {
		const { error } = await supabase
			.from("user_food_preferences")
			.update({
				allergens,
				dietary_restrictions: dietaryRestrictions,
			})
			.eq("user_id", userId);
		if (error) throw error;
	};
	const searchAndOpenNutrition = async (query: string, resultName: RegExp) => {
		await page.goto("/ingredients/fridge/search");
		await waitForAppReady(page);
		const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
		const searchInput = searchDialog.getByRole("combobox", {
			name: "Search ingredients",
		});
		const responsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				url.pathname === "/api/foods/search" &&
				url.searchParams.get("q") === query &&
				response.ok()
			);
		});
		await searchInput.fill(query);
		await responsePromise;
		const result = searchDialog.getByRole("row", { name: resultName }).first();
		await expect(result).toBeVisible();
		await result.getByRole("button", { name: /^View nutrition for / }).click();
		await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\/-?\d+$/);
		await expect(page.locator("#nutrition-detail-view-title")).toBeVisible();
		return page.locator(".nutrition-detail-view");
	};
	const expectAllDisclosuresClosed = async (nutritionDetails: Locator) => {
		const disclosures = nutritionDetails.locator(
			".nutrition-panel__disclosures details",
		);
		await expect(disclosures.first()).toBeVisible();
		expect(await disclosures.count()).toBeGreaterThan(0);
		expect(
			await disclosures.evaluateAll((elements) =>
				elements.every((element) => !(element as HTMLDetailsElement).open),
			),
		).toBe(true);
	};
	const waitForDisclosureAnimation = async (details: Locator) => {
		await details.evaluate(async (element) => {
			await Promise.allSettled(
				element.getAnimations().map((animation) => animation.finished),
			);
		});
	};
	const openDisclosure = async (nutritionDetails: Locator, title: string) => {
		const summary = nutritionDetails
			.locator("summary")
			.filter({
				hasText: title,
			})
			.first();
		const details = summary.locator("..");
		await summary.click();
		await expect(details).toHaveAttribute("open", "");
		await waitForDisclosureAnimation(details);
		return details;
	};
	const openDisclosureWithKeyboard = async (
		nutritionDetails: Locator,
		title: string,
	) => {
		const summary = nutritionDetails
			.locator("summary")
			.filter({
				hasText: title,
			})
			.first();
		const details = summary.locator("..");
		await summary.focus();
		await expect(summary).toBeFocused();
		await summary.press("Enter");
		await expect(details).toHaveAttribute("open", "");
		await waitForDisclosureAnimation(details);
		return details;
	};

	try {
		await replacePreferences([], []);
		const gochuDetails = await searchAndOpenNutrition(
			"Sempio",
			/^Gochu Jang Hot & Sweet Chili Sauce,/,
		);
		await expect(
			gochuDetails.getByRole("heading", { name: "Ingredients" }),
		).toBeVisible();
		await expect(
			gochuDetails.getByText(/red pepper paste \(wheat flour/i),
		).toBeVisible();
		await expect(
			gochuDetails.getByRole("heading", { name: "Contains" }),
		).toBeVisible();
		await expect(
			gochuDetails.getByText("Soy, Wheat", { exact: true }),
		).toBeVisible();
		await expect(
			gochuDetails.getByRole("heading", { name: "May contain" }),
		).toBeVisible();
		await expect(
			gochuDetails.getByText("Peanut", { exact: true }),
		).toBeVisible();
		await expect(
			gochuDetails.getByRole("heading", { name: "Dietary labels" }),
		).toBeVisible();
		await expect(
			gochuDetails.getByText("Vegetarian", { exact: true }),
		).toBeVisible();
		await expectAllDisclosuresClosed(gochuDetails);
		await expect(
			gochuDetails.getByText("Adjust card image placement"),
		).toHaveCount(0);
		await expect(
			gochuDetails.locator("summary").filter({ hasText: "Food passport" }),
		).toContainText(/Verified|Shared record/);

		const gochuFoodPassport = await openDisclosure(
			gochuDetails,
			"Food passport",
		);
		await expect(
			gochuFoodPassport.getByRole("heading", { name: "Information available" }),
		).toBeVisible();
		await expect(
			gochuFoodPassport.getByText(
				/does not mean zero, none, or allergen-free/i,
			),
		).toBeVisible();
		const productDetails = await openDisclosureWithKeyboard(
			gochuFoodPassport,
			"Product details",
		);
		for (const expectedText of [
			"Sempio Foods Company",
			"08801005523455",
			"Dips and Salsa",
			"500 g",
			"Packaged product",
			"2 tbsp (30 g)",
		]) {
			await expect(
				productDetails.getByText(expectedText, { exact: true }).first(),
			).toBeVisible();
		}
		expect(await productDetails.locator("dd").allTextContents()).not.toContain(
			"",
		);

		const snickersDetails = await searchAndOpenNutrition(
			"05000159461122",
			/^Snickers,/,
		);
		await expect(
			snickersDetails.getByText("Not checked against food settings"),
		).toBeVisible();
		await expect(
			snickersDetails.getByRole("heading", { name: "Contains" }),
		).toBeVisible();
		await expect(
			snickersDetails.getByText(/Egg.*Milk.*Peanut.*Soy/i),
		).toBeVisible();
		await expect(
			snickersDetails.getByRole("heading", { name: "May contain" }),
		).toBeVisible();
		await expect(
			snickersDetails.getByText("May contain nuts.", { exact: true }),
		).toBeVisible();
		const snickersIngredientDetails = await openDisclosure(
			snickersDetails,
			"Ingredient details",
		);
		await expect(
			snickersIngredientDetails.getByRole("heading", { name: "Additives" }),
		).toBeVisible();
		await expect(
			snickersIngredientDetails.getByText("E322, E322i", { exact: true }),
		).toBeVisible();

		await replacePreferences([], ["gluten-free"]);
		const blueberryDetails = await searchAndOpenNutrition(
			"Blueberries",
			/^Blueberries, Raw,/i,
		);
		const blueberryNutritionUrl = page.url();
		await expect(
			blueberryDetails.getByText("No conflict found in available information"),
		).toBeVisible();
		const blueberryFoodPassport = await openDisclosure(
			blueberryDetails,
			"Food passport",
		);
		const blueberryProductDetails = await openDisclosure(
			blueberryFoodPassport,
			"Product details",
		);
		for (const expectedText of [
			"Generic food",
			"Vaccinium spp.",
			"Blueberries",
			"Raw",
			"1 cup · 148g",
			"50 berries · 68g",
			"USDA FoodData Central",
			"USDA FoodData Central SR Legacy",
			"2018",
			"171711",
			"09050",
			"Source: USDA FoodData Central.",
		]) {
			await expect(
				blueberryProductDetails
					.getByText(expectedText, { exact: true })
					.first(),
			).toBeVisible();
		}
		await expect(
			blueberryProductDetails.getByRole("link", { name: /View source for/i }),
		).toHaveAttribute("href", "https://fdc.nal.usda.gov/");
		await expect(
			blueberryProductDetails.getByRole("link", { name: /CC0 1\.0/i }),
		).toHaveAttribute(
			"href",
			"https://creativecommons.org/publicdomain/zero/1.0/",
		);
		expect(
			(await blueberryProductDetails.locator("dd").allTextContents()).every(
				(value) => value.trim().length > 0,
			),
		).toBe(true);
		await expect(blueberryProductDetails).not.toContainText(
			/observationId|policyVersion|sharedProductId/i,
		);

		await page.goto("/ingredients/fridge/nutrition/-9818016");
		await waitForAppReady(page);
		await expect(
			page.getByText("Some food details could not be checked"),
		).toBeVisible();

		await replacePreferences([], []);
		await page.goto(blueberryNutritionUrl);
		await waitForAppReady(page);
		await expect(
			page.getByText("Not checked against food settings"),
		).toBeVisible();

		const shrimpDetails = await searchAndOpenNutrition(
			"Crustaceans, Shrimp",
			/^Crustaceans, Shrimp, Mixed Species, Raw \(May Contain Additives To Retain Moisture\),/i,
		);
		const shrimpNutritionFacts = shrimpDetails.locator(".nf-label");
		await expect(
			shrimpNutritionFacts.locator(".vital-list .nf-row"),
		).toHaveCount(6);
		expect(
			await shrimpNutritionFacts.locator(".extra-list .nf-row").count(),
		).toBeGreaterThan(0);
		const secondaryValues = await shrimpNutritionFacts
			.locator(".extra-list .nf-value")
			.allTextContents();
		expect(
			secondaryValues.every((value) => Number.parseFloat(value) !== 0),
		).toBe(true);
		await expect(
			shrimpNutritionFacts
				.locator(".vital-list .nf-row")
				.filter({ hasText: "Dietary Fiber" }),
		).toContainText("0");
		await expect(
			shrimpNutritionFacts
				.locator(".vital-list .nf-row")
				.filter({ hasText: "Total Sugars" }),
		).toContainText("0");

		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		await page.reload();
		await waitForAppReady(page);
		const fridgeList = page.getByRole("list", { name: "Fridge ingredients" });
		await expect(fridgeList).toHaveAttribute("aria-busy", "false");
		const savedGochuButton = page.getByRole("button", {
			name: /^Preview Gochu Jang Hot & Sweet Chili Sauce/,
		});
		for (
			let attempt = 0;
			attempt < 20 && !(await savedGochuButton.isVisible().catch(() => false));
			attempt += 1
		) {
			const loadMoreButton = page.getByRole("button", { name: "Load more" });
			if (!(await loadMoreButton.isVisible().catch(() => false))) break;
			await expect(loadMoreButton).toBeEnabled();
			const renderedCardCount = await fridgeList
				.locator("li[data-food-id]")
				.count();
			await loadMoreButton.click();
			await expect
				.poll(
					async () =>
						(await savedGochuButton.isVisible().catch(() => false)) ||
						(await fridgeList.locator("li[data-food-id]").count()) >
							renderedCardCount,
				)
				.toBe(true);
		}
		await expect(savedGochuButton).toBeVisible();
		await savedGochuButton.click();
		await expect(page).toHaveURL(
			/\/ingredients\/fridge\/nutrition\/9100003(?:\?actions=hide)?$/,
		);
		const savedGochuDetails = page.locator(".nutrition-detail-view");
		await expect(
			savedGochuDetails.getByRole("heading", { name: "Ingredients" }),
		).toBeVisible();
		await expect(
			savedGochuDetails.getByText("Soy, Wheat", { exact: true }),
		).toBeVisible();
	} finally {
		await supabase
			.from("user_food_preferences")
			.update({
				allergens: originalPreferences.allergens,
				dietary_restrictions: originalPreferences.dietary_restrictions,
			})
			.eq("user_id", userId);
	}
});
