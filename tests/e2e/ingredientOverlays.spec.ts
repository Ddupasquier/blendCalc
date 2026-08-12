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

const waitForBottomSheetToSettle = async (dialog: Locator) => {
	const panel = dialog.locator(".sheet-base__panel--bottom");
	await expect(panel).toBeVisible();
	await expect
		.poll(() => panel.evaluate((element) => element.getAnimations().length))
		.toBe(0);
};

const expectIngredientSearchEntersFromRight = async (
	page: Page,
	listRoute: "/ingredients/fridge" | "/ingredients/shopping",
) => {
	await page.goto(listRoute);
	await waitForAppReady(page);
	await page
		.getByRole("button", { name: "Open ingredient search" })
		.click({ noWaitAfter: true });

	const searchDialog = page.getByRole("dialog", { name: "Ingredients" });
	await expect(searchDialog).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
	const panel = searchDialog.locator(".sheet-base__panel--right");
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
		transform: expect.stringMatching(/^translate\(100%(?:, 0px)?\)$/),
	});
	expect(entryAnimation[0]?.keyframes?.at(-1)).toMatchObject({
		opacity: "1",
		transform: expect.stringMatching(/^translate\((?:0%|0px)(?:, 0px)?\)$/),
	});
	await expect
		.poll(() => panel.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	await expect(searchDialog.getByRole("combobox", { name: "Search ingredients" })).toBeFocused();
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

test("manual entry closes through every supported sheet control without activating the page beneath", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	const manualEntryButton = page.getByRole("button", {
		name: "Enter a custom ingredient manually",
	});
	const sortButton = page.getByRole("button", { name: "Sort saved ingredients" });
	const manualEntryDialog = page.getByRole("dialog", { name: "Enter Manually" });
	const sortDialog = page.getByRole("dialog", { name: "Sort" });
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
	expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
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
	expect(Math.abs(bottomGeometry[0]!.y - initialGeometry[0]!.y)).toBeLessThanOrEqual(1);
	expect(Math.abs(bottomGeometry[1]!.y - initialGeometry[1]!.y)).toBeLessThanOrEqual(1);
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

		await page.getByRole("button", { name: "Sort saved ingredients" }).click();
		const sortDialog = page.getByRole("dialog", { name: "Sort" });
		await expect(sortDialog).toBeVisible();
		await waitForBottomSheetToSettle(sortDialog);
		const sortHeight = await sortDialog
			.locator(".sheet-base__panel--bottom")
			.evaluate((element) => element.getBoundingClientRect().height);
		await sortDialog.getByRole("button", { name: "Close sheet" }).click();

		await page
			.getByRole("button", { name: "Enter a custom ingredient manually" })
			.click();
		const manualEntryDialog = page.getByRole("dialog", { name: "Enter Manually" });
		await expect(manualEntryDialog).toBeVisible();
		await waitForBottomSheetToSettle(manualEntryDialog);
		const bounds = await page.evaluate(() => {
			const panel = document.querySelector<HTMLElement>(
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
		const sharedMaximumHeight = Math.min(viewport.height * 0.8, availableShellHeight);

		expect(sortHeight).toBeGreaterThan(0);
		expect(sortHeight).toBeLessThan(sharedMaximumHeight - 1);
		expect(bounds!.panelHeight).toBeGreaterThan(sortHeight);
		expect(Math.abs(bounds!.panelHeight - sharedMaximumHeight)).toBeLessThanOrEqual(2);
		expect(bounds!.panelTop).toBeGreaterThanOrEqual(bounds!.headerBottom - 1);
		expect(Math.abs(bounds!.panelBottom - bounds!.navigationTop)).toBeLessThanOrEqual(2);
		await manualEntryDialog.getByRole("button", { name: "Close sheet" }).click();
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
		await expect(page.getByRole("dialog", { name: "Ingredients" })).toBeVisible();
		await page.reload();
		await waitForAppReady(page);
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(page.getByRole("dialog", { name: "Ingredients" })).toBeVisible();
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
			name: "Sort ingredients",
		});

		await searchInput.fill(query.slice(0, 4));
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
		await expect(searchInput).toHaveValue(query.slice(0, 4));
		await expect(scannerButton).toBeFocused();

		await sortButton.click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search/filters$`));
		const sortDialog = page.getByRole("dialog", { name: "Sort", exact: true });
		await expect(sortDialog).toBeVisible();
		await sortDialog.getByRole("button", { name: "Close sheet" }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(searchDialog).toBeVisible();
		await expect(searchInput).toHaveValue(query.slice(0, 4));
		await expect(sortButton).toBeFocused();

		await sortButton.click();
		await sortDialog.getByRole("button", { name: "A → Z" }).click();
		await sortDialog.getByRole("button", { name: "Apply" }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/search$`));
		await expect(searchInput).toHaveValue(query.slice(0, 4));

		await searchInput.fill(query);
		const result = searchDialog.getByRole("row", { name: resultName });
		await expect(result).toBeVisible();
		await result.getByRole("button", { name: /^View nutrition for / }).click();
		await expect(page).toHaveURL(new RegExp(`${listRoute}/nutrition/-?\\d+$`));
		await expect(page.locator("#nutrition-detail-view-title")).toBeVisible();
	}
});

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
			return url.pathname === "/api/foods/search" && url.searchParams.get("q") === query;
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

	const multiWordResults = await search("green tomat");
	expect(multiWordResults.foods.map((food) => food.description)).toEqual([
		"Green Tomato Pantry Preserve",
		"Tomatoes, Green, Raw",
	]);
	await expect(searchResults.getByRole("row")).toHaveCount(2);

	const completedWordResults = await search("tomato");
	expect(completedWordResults.total).toBeGreaterThanOrEqual(6);
	await expect(
		searchResults.getByRole("row", { name: /^Tomatoes, Green, Raw,/ }),
	).toBeVisible();

	for (const [query, expectedResultName] of [
		["tomatoes green", /^Tomatoes, Green, Raw,/],
		["spin", /^Spinach, Raw,/],
		["strawb", /^Strawberries, Raw,/],
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
	}

	await search("green tomat");
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
