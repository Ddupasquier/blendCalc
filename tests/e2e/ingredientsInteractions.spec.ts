import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { getAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";
import type { Locator, Page } from "@playwright/test";

type IngredientListType = "fridge" | "shopping";

type DirectionalExitRecord = {
	delayMilliseconds: number;
	durationMilliseconds: number;
	keyframes: Keyframe[];
	position: string;
	zIndex: string;
};

type ListReflowRecord = {
	durationMilliseconds: number;
	keyframes: Keyframe[];
};

const moveRpcPath = "/rest/v1/rpc/move_user_food_list_items";

const beginDirectionalExitRecording = async (page: Page) => {
	await page.evaluate(() => {
		type RecordedWindow = Window & {
			__blendCalcDirectionalExitRecords?: DirectionalExitRecord[];
			__blendCalcListReflowRecords?: ListReflowRecord[];
			__blendCalcOriginalElementAnimate?: typeof Element.prototype.animate;
		};
		const recordedWindow = window as RecordedWindow;
		recordedWindow.__blendCalcDirectionalExitRecords = [];
		recordedWindow.__blendCalcListReflowRecords = [];
		if (recordedWindow.__blendCalcOriginalElementAnimate) return;

		const originalAnimate = Element.prototype.animate;
		recordedWindow.__blendCalcOriginalElementAnimate = originalAnimate;
		Element.prototype.animate = function (
			keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
			options?: number | KeyframeAnimationOptions,
		) {
			if (
				this instanceof HTMLElement &&
				this.hasAttribute("data-directional-exit-clone")
			) {
				const timing = typeof options === "object" && options ? options : {};
				recordedWindow.__blendCalcDirectionalExitRecords?.push({
					delayMilliseconds: Number(timing.delay ?? 0),
					durationMilliseconds: Number(timing.duration ?? 0),
					keyframes: Array.isArray(keyframes) ? structuredClone(keyframes) : [],
					position: this.style.position,
					zIndex: this.style.zIndex,
				});
			} else if (
				this instanceof HTMLLIElement &&
				this.hasAttribute("data-food-id")
			) {
				const timing = typeof options === "object" && options ? options : {};
				const frames = Array.isArray(keyframes)
					? structuredClone(keyframes)
					: [];
				if (
					frames.some((frame) =>
						String((frame as Keyframe).transform ?? "").includes("translate"),
					)
				) {
					recordedWindow.__blendCalcListReflowRecords?.push({
						durationMilliseconds:
							typeof options === "number"
								? options
								: Number(timing.duration ?? 0),
						keyframes: frames,
					});
				}
			}
			return originalAnimate.call(this, keyframes, options);
		};
	});
};

const readDirectionalExitRecords = (page: Page) =>
	page.evaluate(() => {
		type RecordedWindow = Window & {
			__blendCalcDirectionalExitRecords?: DirectionalExitRecord[];
		};
		return (window as RecordedWindow).__blendCalcDirectionalExitRecords ?? [];
	});

const readListReflowRecords = (page: Page) =>
	page.evaluate(() => {
		type RecordedWindow = Window & {
			__blendCalcListReflowRecords?: ListReflowRecord[];
		};
		return (window as RecordedWindow).__blendCalcListReflowRecords ?? [];
	});

const restoreFoodsToIngredientList = async (
	parallelWorkerIndex: number,
	foodIds: number[],
	targetListType: IngredientListType,
) => {
	if (foodIds.length === 0) return;
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const { data: listItems, error: listItemsError } = await supabase
		.from("user_food_list_items")
		.select("fdc_id, list_type")
		.in("fdc_id", foodIds);
	if (listItemsError) throw listItemsError;

	for (const sourceListType of ["fridge", "shopping"] as const) {
		if (sourceListType === targetListType) continue;
		const sourceFoodIds = (listItems ?? [])
			.filter((item) => item.list_type === sourceListType)
			.map((item) => item.fdc_id);
		if (sourceFoodIds.length === 0) continue;

		const { data: movedCount, error: moveError } = await supabase.rpc(
			"move_user_food_list_items",
			{
				p_source_list_type: sourceListType,
				p_target_list_type: targetListType,
				p_fdc_ids: sourceFoodIds,
			},
		);
		if (moveError) throw moveError;
		expect(movedCount).toBe(sourceFoodIds.length);
	}
};

const expectFoodsOnlyInIngredientList = async (
	parallelWorkerIndex: number,
	foodIds: number[],
	expectedListType: IngredientListType,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const { data: listItems, error: listItemsError } = await supabase
		.from("user_food_list_items")
		.select("fdc_id, list_type")
		.in("fdc_id", foodIds);
	if (listItemsError) throw listItemsError;
	expect(listItems).toHaveLength(foodIds.length);
	expect(new Set((listItems ?? []).map((item) => item.fdc_id))).toEqual(
		new Set(foodIds),
	);
	expect(
		(listItems ?? []).every((item) => item.list_type === expectedListType),
	).toBe(true);
};

const selectIngredientCards = async (page: Page, foodIds: number[]) => {
	for (const foodId of foodIds) {
		const selectionButton = page.locator(
			`li[data-food-id="${foodId}"] .saved-ingredient-card__select`,
		);
		await selectionButton.click();
		await expect(selectionButton).toHaveAttribute("aria-pressed", "true");
	}
};

const clickThroughCardSurface = async (
	page: Page,
	card: Locator,
	target: Locator | "empty-padding",
) => {
	const bounds = await (
		target === "empty-padding" ? card : target
	).boundingBox();
	expect(bounds).not.toBeNull();
	const clickPoint =
		target === "empty-padding"
			? {
					x: bounds!.x + bounds!.width / 2,
					y: bounds!.y + 6,
				}
			: {
					x: bounds!.x + bounds!.width / 2,
					y: bounds!.y + bounds!.height / 2,
				};
	const hitTargetUsesCardButton = await page.evaluate(({ x, y }) => {
		return (
			document
				.elementFromPoint(x, y)
				?.classList.contains("saved-ingredient-card__select") ?? false
		);
	}, clickPoint);
	expect(hitTargetUsesCardButton).toBe(true);
	await page.mouse.click(clickPoint.x, clickPoint.y);
};

const readCardDimensions = (page: Page, count: number) =>
	page.locator(".saved-ingredient-card").evaluateAll(
		(cards, requestedCount) =>
			cards.slice(0, requestedCount).map((card) => {
				const bounds = card.getBoundingClientRect();
				return { height: bounds.height, width: bounds.width };
			}),
		count,
	);

const focusWithKeyboard = async (
	page: Page,
	target: Locator,
	allowSafariKeyboardPreferenceFallback: boolean,
) => {
	for (let tabIndex = 0; tabIndex < 20; tabIndex += 1) {
		await page.keyboard.press("Tab");
		if (
			await target.evaluate((element) => element === document.activeElement)
		) {
			return;
		}
	}
	if (allowSafariKeyboardPreferenceFallback) {
		await target.focus();
		return;
	}
	throw new Error("Keyboard traversal did not reach the ingredient card.");
};

const readSearchCardPresentation = (card: Locator) =>
	card.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const mediaBounds = element
			.querySelector(".ingredient-card-media-lane")
			?.getBoundingClientRect();
		const titleElement = element.querySelector("strong");
		const titleBounds = titleElement?.getBoundingClientRect();
		const categoryBounds = element
			.querySelector("small")
			?.getBoundingClientRect();
		const badgeBounds = element
			.querySelector(".ingredient-provenance-badges")
			?.getBoundingClientRect();
		const addButton = element.querySelector<HTMLElement>(
			".ingredient-search-card__add",
		);
		const addBounds = addButton?.getBoundingClientRect();
		const openBounds = element
			.querySelector(".ingredient-search-card__open")
			?.getBoundingClientRect();
		const cardStyles = window.getComputedStyle(element);
		const titleStyles = titleElement
			? window.getComputedStyle(titleElement)
			: null;
		const addStyles = addButton ? window.getComputedStyle(addButton) : null;
		const themeColorProbe = document.createElement("span");
		themeColorProbe.style.position = "fixed";
		themeColorProbe.style.background = "var(--app-shell-surface-panel)";
		document.body.append(themeColorProbe);
		const panelBackgroundColor =
			window.getComputedStyle(themeColorProbe).backgroundColor;
		themeColorProbe.style.background = "var(--app-shell-surface-soft)";
		const activeBackgroundColor =
			window.getComputedStyle(themeColorProbe).backgroundColor;
		themeColorProbe.style.background = "var(--app-shell-accent-primary)";
		const primaryBackgroundColor =
			window.getComputedStyle(themeColorProbe).backgroundColor;
		themeColorProbe.remove();
		const firstTrailingBoundary = Math.min(
			addBounds?.left ?? Number.POSITIVE_INFINITY,
			openBounds?.left ?? Number.POSITIVE_INFINITY,
		);

		return {
			activeBackgroundColor,
			active: element.getAttribute("aria-selected") === "true",
			addBackgroundColor: addStyles?.backgroundColor ?? null,
			addHeight: addBounds?.height ?? null,
			addRadius: addStyles ? Number.parseFloat(addStyles.borderRadius) : null,
			addWidth: addBounds?.width ?? null,
			backgroundColor: cardStyles.backgroundColor,
			badgeEndsBeforeActions:
				!badgeBounds || badgeBounds.right <= firstTrailingBoundary,
			borderColor: cardStyles.borderTopColor,
			categoryEndsBeforeActions:
				!categoryBounds || categoryBounds.right <= firstTrailingBoundary,
			cardBottom: bounds.bottom,
			cardLeft: bounds.left,
			cardRight: bounds.right,
			cardTop: bounds.top,
			documentWidth: document.documentElement.scrollWidth,
			mediaHeight: mediaBounds?.height ?? null,
			panelBackgroundColor,
			primaryBackgroundColor,
			titleEndsBeforeActions:
				!titleBounds || titleBounds.right <= firstTrailingBoundary,
			titleFontWeight: Number.parseInt(titleStyles?.fontWeight ?? "0", 10),
			titleUsesEllipsisStyles:
				titleStyles?.overflow === "hidden" &&
				titleStyles?.textOverflow === "ellipsis" &&
				titleStyles?.whiteSpace === "nowrap",
			viewportHeight: window.innerHeight,
			viewportWidth: window.innerWidth,
		};
	});

const expectSearchCardGeometry = async (
	card: Locator,
	options: { expectAdd: boolean; expectEllipsis?: boolean },
) => {
	await card.evaluate(async (element) => {
		void window.getComputedStyle(element).backgroundColor;
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});
	const presentation = await readSearchCardPresentation(card);

	expect(presentation.backgroundColor).toBe(
		presentation.active
			? presentation.activeBackgroundColor
			: presentation.panelBackgroundColor,
	);
	expect(presentation.borderColor).toMatch(
		/^rgba\(0, 0, 0, 0\)$|^transparent$/,
	);
	expect(presentation.cardLeft).toBeGreaterThanOrEqual(0);
	expect(presentation.cardRight).toBeLessThanOrEqual(
		presentation.viewportWidth + 1,
	);
	expect(presentation.documentWidth).toBeLessThanOrEqual(
		presentation.viewportWidth,
	);
	expect(presentation.mediaHeight).toBeGreaterThanOrEqual(
		(presentation.cardBottom - presentation.cardTop) * 0.9,
	);
	expect(presentation.titleFontWeight).toBeGreaterThanOrEqual(700);
	expect(presentation.titleEndsBeforeActions).toBe(true);
	expect(presentation.categoryEndsBeforeActions).toBe(true);
	expect(presentation.badgeEndsBeforeActions).toBe(true);

	if (options.expectAdd) {
		expect(presentation.addWidth).toBeGreaterThan(0);
		expect(
			Math.abs(presentation.addWidth! - presentation.addHeight!),
		).toBeLessThanOrEqual(1);
		expect(presentation.addRadius).toBeGreaterThanOrEqual(
			presentation.addWidth! / 2 - 1,
		);
		expect(presentation.addBackgroundColor).toBe(
			presentation.primaryBackgroundColor,
		);
	} else {
		expect(presentation.addWidth).toBeNull();
	}

	if (options.expectEllipsis !== undefined) {
		expect(presentation.titleUsesEllipsisStyles).toBe(options.expectEllipsis);
	}
};

const readVisibleIngredientFoodIds = async (page: Page, count: number) => {
	const foodIds = await page
		.locator("li[data-food-id]")
		.evaluateAll(
			(listItems, requestedCount) =>
				listItems
					.slice(0, requestedCount)
					.map((listItem) => Number((listItem as HTMLElement).dataset.foodId)),
			count,
		);
	expect(foodIds).toHaveLength(count);
	expect(foodIds.every(Number.isSafeInteger)).toBe(true);
	return foodIds;
};

const revealIngredientCards = async (page: Page, foodIds: number[]) => {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const renderedFoodIds = new Set(
			await page
				.locator("li[data-food-id]")
				.evaluateAll((listItems) =>
					listItems.map((listItem) =>
						Number((listItem as HTMLElement).dataset.foodId),
					),
				),
		);
		if (foodIds.every((foodId) => renderedFoodIds.has(foodId))) return;

		const loadMoreButton = page.getByRole("button", { name: "Load more" });
		if (!(await loadMoreButton.isVisible().catch(() => false))) break;
		await loadMoreButton.click();
		await expect
			.poll(
				async () =>
					await loadMoreButton.evaluateAll((buttons) =>
						buttons.some(
							(button) => button.getAttribute("aria-busy") === "true",
						),
					),
				{
					message:
						"The next saved-ingredient page should finish hydrating before another page is requested.",
					timeout: 45_000,
				},
			)
			.toBe(false);
	}

	for (const foodId of foodIds) {
		await expect(page.locator(`li[data-food-id="${foodId}"]`)).toHaveCount(1);
	}
};

test("the saved-list segmented control supports pointer and keyboard navigation", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const fridgeTab = page.getByRole("tab", { name: /Fridge/ });
	const shoppingTab = page.getByRole("tab", { name: /Shopping List/ });

	await expect(fridgeTab).toHaveAttribute("aria-selected", "true");
	await shoppingTab.click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await expect(shoppingTab).toHaveAttribute("aria-selected", "true");

	await shoppingTab.focus();
	await shoppingTab.press("ArrowLeft");
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(fridgeTab).toHaveAttribute("aria-selected", "true");
});

test("Ingredients exposes one page-level manual-entry action without a duplicate floating add button", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	const manualEntryAction = page.getByRole("button", {
		name: "Enter a custom ingredient manually",
	});
	await expect(manualEntryAction).toHaveCount(1);
	await expect(manualEntryAction).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Add ingredient manually" }),
	).toHaveCount(0);
	await expect(
		page.locator(".search-toolbar").getByRole("button", {
			name: "Enter a custom ingredient manually",
		}),
	).toHaveCount(1);
	const filterAction = page.getByRole("button", {
		name: "Sort saved ingredients",
		exact: true,
	});
	const manualEntryBounds = await manualEntryAction.boundingBox();
	const filterBounds = await filterAction.boundingBox();
	expect(manualEntryBounds).not.toBeNull();
	expect(filterBounds).not.toBeNull();
	expect(
		Math.abs(
			manualEntryBounds!.y +
				manualEntryBounds!.height / 2 -
				(filterBounds!.y + filterBounds!.height / 2),
		),
	).toBeLessThanOrEqual(1);
	expect(manualEntryBounds!.x).toBeLessThan(filterBounds!.x);

	await manualEntryAction.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/manual-entry$/);
});

test("ingredient-card copy never occupies the trailing action area", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const firstCard = page.locator(".saved-ingredient-card").first();
	await expect(firstCard).toBeVisible();

	const copyBounds = await firstCard
		.locator(".saved-ingredient-card__copy")
		.boundingBox();
	const trailingActionBounds = await firstCard
		.locator(".saved-ingredient-card__move-action")
		.boundingBox();

	expect(copyBounds).not.toBeNull();
	expect(trailingActionBounds).not.toBeNull();
	expect(copyBounds!.x + copyBounds!.width).toBeLessThanOrEqual(
		trailingActionBounds!.x,
	);
});

test("selection mode exposes the complete card surface, stable geometry, keyboard focus, and announcements", async ({
	page,
}, testInfo) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const cards = page.locator(".saved-ingredient-card");
	const visibleCardCount = await cards.count();
	expect(visibleCardCount).toBeGreaterThanOrEqual(4);
	const initialDimensions = await readCardDimensions(page, 4);
	await expect(
		cards.locator(".saved-ingredient-card__selection-indicator"),
	).toHaveCount(0);
	await expect(cards.locator(".card-selection-indicator--circle")).toHaveCount(
		0,
	);
	await page.getByRole("button", { name: "Select items" }).click();
	const selectionStatus = page.getByRole("status");
	await expect(selectionStatus).toHaveAttribute("aria-live", "polite");
	await expect(selectionStatus).toHaveAttribute("aria-atomic", "true");
	await expect(cards.locator(".saved-ingredient-card__actions")).toHaveCount(0);
	await expect(
		cards.locator(".saved-ingredient-card__move-action"),
	).toHaveCount(0);

	const selectedCards = [
		cards.nth(0),
		cards.nth(1),
		cards.nth(2),
		cards.nth(3),
	];
	await clickThroughCardSurface(
		page,
		selectedCards[0],
		selectedCards[0].locator(".ingredient-card-media-lane"),
	);
	await clickThroughCardSurface(
		page,
		selectedCards[1],
		selectedCards[1].locator("strong"),
	);
	await clickThroughCardSurface(
		page,
		selectedCards[2],
		selectedCards[2].locator("small"),
	);
	await clickThroughCardSurface(page, selectedCards[3], "empty-padding");

	for (const card of selectedCards) {
		const selectionButton = card.locator(".saved-ingredient-card__select");
		await expect(selectionButton).toHaveAttribute("aria-pressed", "true");
		await expect(card).toHaveClass(/saved-ingredient-card--checked/);
		await expect(card.locator(".card-selection-indicator svg")).toHaveCount(1);
	}
	await expect(selectionStatus).toContainText(
		"Selection mode. 4 ingredients selected.",
	);
	const selectedBorderColor = await selectedCards[0].evaluate(
		(element) => getComputedStyle(element).borderColor,
	);
	const unselectedBorderColor = await cards
		.nth(4)
		.evaluate((element) => getComputedStyle(element).borderColor);
	expect(selectedBorderColor).not.toBe(unselectedBorderColor);

	const afterIndividualSelectionDimensions = await readCardDimensions(page, 4);
	expect(afterIndividualSelectionDimensions).toEqual(initialDimensions);
	for (const card of selectedCards) {
		const copyBounds = await card
			.locator(".saved-ingredient-card__copy")
			.boundingBox();
		const indicatorBounds = await card
			.locator(".saved-ingredient-card__selection-indicator")
			.boundingBox();
		expect(copyBounds).not.toBeNull();
		expect(indicatorBounds).not.toBeNull();
		expect(copyBounds!.x + copyBounds!.width).toBeLessThanOrEqual(
			indicatorBounds!.x,
		);
	}

	await page.getByRole("button", { name: "Select all" }).click();
	await expect(
		page.locator('.saved-ingredient-card__select[aria-pressed="true"]'),
	).toHaveCount(visibleCardCount);
	await expect(selectionStatus).toContainText(
		`Selection mode. ${visibleCardCount} ingredients selected.`,
	);
	expect(await readCardDimensions(page, 4)).toEqual(initialDimensions);

	await page.getByRole("button", { name: "Cancel" }).click();
	await expect(
		page.getByRole("button", { name: "Select items" }),
	).toBeVisible();
	await expect(
		cards.locator(".saved-ingredient-card__selection-indicator"),
	).toHaveCount(0);
	await expect(
		cards.locator(".saved-ingredient-card__move-action"),
	).toHaveCount(visibleCardCount);

	await page.getByRole("button", { name: "Select items" }).click();
	const keyboardSelectionButton = cards
		.first()
		.locator(".saved-ingredient-card__select");
	await focusWithKeyboard(
		page,
		keyboardSelectionButton,
		testInfo.project.name.includes("webkit"),
	);
	await expect(keyboardSelectionButton).toBeFocused();
	await keyboardSelectionButton.press("Space");
	await expect(keyboardSelectionButton).toHaveAttribute("aria-pressed", "true");
	const focusAndSelectionColors = await keyboardSelectionButton.evaluate(
		(button) => {
			const card = button.closest(".saved-ingredient-card");
			const focusStyles = getComputedStyle(button, "::before");
			return {
				cardBorderColor: card ? getComputedStyle(card).borderColor : "",
				focusBorderColor: focusStyles.borderColor,
				focusBorderStyle: focusStyles.borderStyle,
				focusBorderWidth: Number.parseFloat(focusStyles.borderWidth) || 0,
			};
		},
	);
	expect(focusAndSelectionColors.focusBorderStyle).not.toBe("none");
	expect(focusAndSelectionColors.focusBorderWidth).toBeGreaterThan(0);
	expect(focusAndSelectionColors.focusBorderColor).not.toBe(
		focusAndSelectionColors.cardBorderColor,
	);
	await keyboardSelectionButton.press("Enter");
	await expect(keyboardSelectionButton).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	await expect(keyboardSelectionButton).toHaveAccessibleName(
		`Select ${await cards.first().locator("strong").innerText()}`,
	);
	await page.getByRole("button", { name: "Cancel" }).click();

	const firstFoodName = await cards.first().locator("strong").innerText();
	await page
		.getByRole("button", {
			name: `Open actions for ${firstFoodName}`,
			exact: true,
		})
		.click();
	await page.getByRole("button", { name: "Select item", exact: true }).click();
	await expect(
		cards.first().getByRole("button", { name: `Unselect ${firstFoodName}` }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("status")).toContainText(
		"Selection mode. 1 ingredient selected.",
	);
	await expect(
		cards.first().locator(".saved-ingredient-card__move-action"),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Cancel" }).click();
});

test(
	"a deliberate touch hold selects its card while a scroll gesture does not",
	{ tag: "@mobile" },
	async ({ page }) => {
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const cards = page.locator(".saved-ingredient-card");
		const firstCard = cards.first();
		const firstCardSelectionButton = firstCard.locator(
			".saved-ingredient-card__select",
		);
		await firstCardSelectionButton.dispatchEvent("pointerdown", {
			pointerId: 1,
			pointerType: "touch",
			button: 0,
			isPrimary: true,
		});
		await page.waitForTimeout(550);
		await firstCardSelectionButton.dispatchEvent("pointerup", {
			pointerId: 1,
			pointerType: "touch",
			button: 0,
			isPrimary: true,
		});
		await expect(firstCardSelectionButton).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(firstCard).toHaveClass(/saved-ingredient-card--checked/);
		await expect(cards.nth(1)).not.toHaveClass(
			/saved-ingredient-card--checked/,
		);
		await page.getByRole("button", { name: "Cancel" }).click();

		const secondCardSelectionButton = cards
			.nth(1)
			.locator(".saved-ingredient-card__select");
		await secondCardSelectionButton.dispatchEvent("pointerdown", {
			pointerId: 2,
			pointerType: "touch",
			button: 0,
			clientX: 20,
			clientY: 20,
			isPrimary: true,
		});
		await secondCardSelectionButton.dispatchEvent("pointermove", {
			pointerId: 2,
			pointerType: "touch",
			button: 0,
			clientX: 20,
			clientY: 50,
			isPrimary: true,
		});
		await page.waitForTimeout(550);
		await secondCardSelectionButton.dispatchEvent("pointerup", {
			pointerId: 2,
			pointerType: "touch",
			button: 0,
			clientX: 20,
			clientY: 50,
			isPrimary: true,
		});
		await expect(
			page.getByRole("button", { name: "Select items" }),
		).toBeVisible();
		await expect(secondCardSelectionButton).not.toHaveAttribute("aria-pressed");
		await expect(cards.nth(1)).not.toHaveClass(
			/saved-ingredient-card--checked/,
		);
	},
);

test("normal card actions retain priority over preview and selection", async ({
	page,
}, testInfo) => {
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The movable action-priority corpus is restricted to disposable local infrastructure.",
	);
	let movedFoodId: number | null = null;

	try {
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const firstCard = page.locator(".saved-ingredient-card").first();
		const firstFoodName = await firstCard.locator("strong").innerText();
		movedFoodId = Number(
			await firstCard.locator("xpath=..").getAttribute("data-food-id"),
		);
		expect(Number.isSafeInteger(movedFoodId)).toBe(true);

		await clickThroughCardSurface(page, firstCard, firstCard.locator("strong"));
		await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\//);
		await page.getByRole("button", { name: "Back to ingredients" }).click();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);

		await page
			.getByRole("button", {
				name: `Open actions for ${firstFoodName}`,
				exact: true,
			})
			.click();
		await expect(page).toHaveURL(/\/ingredients\/fridge\/actions\//);
		await expect(
			page.getByRole("button", { name: "Select item", exact: true }),
		).toBeVisible();
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);

		await page
			.getByRole("button", {
				name: `Remove ${firstFoodName}`,
				exact: true,
			})
			.click();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		await expect(
			page.getByText("Tap or click delete again to confirm."),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Select items" }),
		).toBeVisible();

		await page
			.getByRole("button", {
				name: `Move to Shopping List: ${firstFoodName}`,
				exact: true,
			})
			.click();
		await expect(
			page.getByRole("status").filter({
				hasText: `Moved ${firstFoodName} to Shopping List.`,
			}),
		).toBeVisible();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		await expect(
			page.getByRole("button", { name: "Select items" }),
		).toBeVisible();
	} finally {
		if (movedFoodId !== null) {
			await restoreFoodsToIngredientList(
				testInfo.parallelIndex,
				[movedFoodId],
				"fridge",
			);
		}
	}
});

test("bulk moves animate once, persist atomically, and reverse without duplicates", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The mutable bidirectional bulk-move corpus runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The mutable bulk-move corpus is restricted to disposable local infrastructure.",
	);
	test.slow();

	let foodIds: number[] = [];

	try {
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		foodIds = await readVisibleIngredientFoodIds(page, 5);
		await page.getByRole("button", { name: "Select items" }).click();
		await selectIngredientCards(page, foodIds);
		await beginDirectionalExitRecording(page);

		const forwardMoveRequests: string[] = [];
		page.on("request", (request) => {
			if (new URL(request.url()).pathname === moveRpcPath) {
				forwardMoveRequests.push(request.url());
			}
		});
		await page
			.getByRole("button", { name: "Move 5 selected → Shopping List" })
			.click();
		await expect(
			page.getByRole("status").filter({
				hasText: "Moved 5 ingredients to Shopping List.",
			}),
		).toBeVisible();
		await expect
			.poll(() => forwardMoveRequests.length, {
				message:
					"The five selected cards should move through one database RPC.",
			})
			.toBe(1);

		const forwardExitRecords = await readDirectionalExitRecords(page);
		expect(forwardExitRecords).toHaveLength(foodIds.length);
		expect(
			forwardExitRecords.map((record) => record.delayMilliseconds),
		).toEqual([0, 100, 200, 300, 400]);
		for (const record of forwardExitRecords) {
			expect(record.durationMilliseconds).toBe(360);
			expect(record.position).toBe("fixed");
			expect(record.zIndex).toBe("1000");
			expect(record.keyframes).toHaveLength(3);
			expect(record.keyframes[1]).toMatchObject({
				offset: 0.18,
				opacity: 1,
				transform: "translate3d(-10%, 0, 0)",
			});
			expect(record.keyframes[2]).toMatchObject({
				offset: 1,
				opacity: 0,
				transform: "translate3d(110%, 0, 0)",
			});
		}
		await expect(page.locator("[data-directional-exit-clone]")).toHaveCount(0);
		await expect
			.poll(async () => (await readListReflowRecords(page)).length)
			.toBeGreaterThan(0);
		expect(
			(await readListReflowRecords(page)).some(
				(record) => record.durationMilliseconds > 0,
			),
		).toBe(true);
		for (const foodId of foodIds) {
			await expect(page.locator(`li[data-food-id="${foodId}"]`)).toHaveCount(0);
		}
		await expectFoodsOnlyInIngredientList(
			testInfo.parallelIndex,
			foodIds,
			"shopping",
		);

		await page.getByRole("tab", { name: /Shopping List/ }).click();
		await expect(page).toHaveURL(/\/ingredients\/shopping$/);
		await revealIngredientCards(page, foodIds);
		for (const foodId of foodIds) {
			await expect(page.locator(`li[data-food-id="${foodId}"]`)).toHaveCount(1);
		}
		await page.getByRole("button", { name: "Select items" }).click();
		await selectIngredientCards(page, foodIds);
		await beginDirectionalExitRecording(page);

		let reverseMoveRequestCount = 0;
		page.on("request", (request) => {
			if (new URL(request.url()).pathname === moveRpcPath) {
				reverseMoveRequestCount += 1;
			}
		});
		await page
			.getByRole("button", { name: "Move 5 selected → Fridge" })
			.click();
		await expect(
			page.getByRole("status").filter({
				hasText: "Moved 5 ingredients to Fridge.",
			}),
		).toBeVisible();
		await expect.poll(() => reverseMoveRequestCount).toBe(1);
		const reverseExitRecords = await readDirectionalExitRecords(page);
		expect(reverseExitRecords).toHaveLength(foodIds.length);
		for (const record of reverseExitRecords) {
			expect(record.keyframes[1]).toMatchObject({
				transform: "translate3d(10%, 0, 0)",
			});
			expect(record.keyframes[2]).toMatchObject({
				transform: "translate3d(-110%, 0, 0)",
			});
		}
		await expectFoodsOnlyInIngredientList(
			testInfo.parallelIndex,
			foodIds,
			"fridge",
		);
	} finally {
		await restoreFoodsToIngredientList(
			testInfo.parallelIndex,
			foodIds,
			"fridge",
		);
	}
});

test("reduced motion moves selected cards immediately through one atomic request", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The mutable reduced-motion corpus runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The mutable reduced-motion corpus is restricted to disposable local infrastructure.",
	);

	let foodIds: number[] = [];

	try {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		foodIds = await readVisibleIngredientFoodIds(page, 2);
		await page.getByRole("button", { name: "Select items" }).click();
		await selectIngredientCards(page, foodIds);
		await beginDirectionalExitRecording(page);

		let moveRequestCount = 0;
		page.on("request", (request) => {
			if (new URL(request.url()).pathname === moveRpcPath) {
				moveRequestCount += 1;
			}
		});
		await page
			.getByRole("button", { name: "Move 2 selected → Shopping List" })
			.click();
		await expect(
			page.getByRole("status").filter({
				hasText: "Moved 2 ingredients to Shopping List.",
			}),
		).toBeVisible();
		await expect.poll(() => moveRequestCount).toBe(1);
		expect(await readDirectionalExitRecords(page)).toEqual([]);
		expect(
			(await readListReflowRecords(page)).every(
				(record) => record.durationMilliseconds === 0,
			),
		).toBe(true);
		await expect(page.locator("[data-directional-exit-clone]")).toHaveCount(0);
		await expectFoodsOnlyInIngredientList(
			testInfo.parallelIndex,
			foodIds,
			"shopping",
		);
	} finally {
		await restoreFoodsToIngredientList(
			testInfo.parallelIndex,
			foodIds,
			"fridge",
		);
	}
});

test("the shared sort sheet applies a choice and closes its URL-backed overlay", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await page
		.getByRole("button", { name: "Sort saved ingredients", exact: true })
		.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/filters$/);
	const dialog = page.getByRole("dialog", { name: "Sort", exact: true });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "A → Z" }).click();
	await dialog.getByRole("button", { name: "Apply" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(dialog).toBeHidden();
	await expect
		.poll(async () => {
			const names = await page
				.locator(".saved-ingredient-card__title-row strong")
				.allTextContents();
			const alphabetizedNames = [...names].sort((left, right) =>
				left.localeCompare(right),
			);
			return names.join("|") === alphabetizedNames.join("|");
		})
		.toBe(true);
});

test("ingredient search uses keyboard selection without turning the add action into the card target", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await page.getByRole("button", { name: "Open ingredient search" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/search$/);

	const search = page.getByRole("combobox", { name: "Search ingredients" });
	await search.fill("spinach");
	const firstResult = page.locator(".ingredient-search-card").first();
	await expect(firstResult).toBeVisible();
	await search.press("ArrowDown");
	await search.press("Enter");
	await expect(page).toHaveURL(/\/nutrition\//);
});

test("ingredient search places results in the list named by the current route", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The mutable destination-aware search flow runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The mutable destination-aware search flow is restricted to disposable local infrastructure.",
	);

	let movedFoodId: number | null = null;
	try {
		await page.goto("/ingredients/shopping/search");
		await waitForAppReady(page);
		await expect(
			page.getByText(
				"Search foods and place them directly in your Shopping List.",
			),
		).toBeVisible();

		const search = page.getByRole("combobox", { name: "Search ingredients" });
		await search.fill("08801005523455");
		const result = page.locator(".ingredient-search-card").first();
		await expect(result).toBeVisible();
		const foodName = await result.locator("strong").innerText();
		movedFoodId = Number(
			(await result.getAttribute("id"))?.replace(
				"ingredient-search-result-",
				"",
			),
		);
		expect(Number.isSafeInteger(movedFoodId)).toBe(true);
		await expect(result.getByText(/currently in Fridge$/)).toBeVisible();

		await result
			.getByRole("button", { name: `Move ${foodName} to Shopping List` })
			.click();

		await expect(result.getByText(/already in Shopping List$/)).toBeVisible();
		await expect(
			result.getByRole("button", { name: /^(Add|Move) / }),
		).toHaveCount(0);
		await expectFoodsOnlyInIngredientList(
			testInfo.parallelIndex,
			[movedFoodId],
			"shopping",
		);
	} finally {
		if (movedFoodId !== null) {
			await restoreFoodsToIngredientList(
				testInfo.parallelIndex,
				[movedFoodId],
				"fridge",
			);
		}
	}
});

test("ingredient search finds every product linked to a matching recall supplier", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);
	const search = page.getByRole("combobox", { name: "Search ingredients" });
	await search.fill("Taylor Farms");

	for (const productName of [
		"Marketside Iceberg Salad, 12 Ounce",
		"Marketside Iceberg Salad, 24 Ounce",
		"Marketside Shredded Iceberg Lettuce, 8 Ounce",
		"Marketside Shredded Iceberg Lettuce, 16 Ounce",
	]) {
		await expect(
			page.getByRole("row", {
				name: new RegExp(`^${productName},`),
			}),
		).toBeVisible();
	}
});

test("ingredient search cards preserve media, copy, status, and action geometry", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);
	const search = page.getByRole("combobox", { name: "Search ingredients" });

	await search.fill("strawberries");
	const unsavedStrawberries = page.getByRole("row", {
		name: /^Strawberries, Raw,/,
	});
	await expect(unsavedStrawberries).toBeVisible();
	await expect(
		unsavedStrawberries.getByText("Fruits and Fruit Juices"),
	).toBeVisible();
	await expect(
		unsavedStrawberries.getByLabel("Verification status: Verified"),
	).toBeVisible();
	await expect(
		unsavedStrawberries.getByRole("button", {
			name: "Add Strawberries, Raw to Fridge",
		}),
	).toBeVisible();
	await expect(
		unsavedStrawberries.locator(".ingredient-card-media-lane"),
	).toBeVisible();
	await expectSearchCardGeometry(unsavedStrawberries, { expectAdd: true });

	const savedStrawberryJelly = page.getByRole("row", {
		name: /^Strawberry Jelly, Strawberry,/,
	});
	await expect(savedStrawberryJelly).toBeVisible();
	await expect(savedStrawberryJelly).toContainText("Jams · already in Fridge");
	await expect(
		savedStrawberryJelly.getByRole("button", { name: /^Add / }),
	).toHaveCount(0);
	await expectSearchCardGeometry(savedStrawberryJelly, { expectAdd: false });

	for (const providerLabel of [
		"USDA",
		"USDA FoodData Central",
		"Open Food Facts",
		"Imported",
	]) {
		await expect(page.getByText(providerLabel, { exact: true })).toHaveCount(0);
	}

	await search.fill("tomato");
	const longUnsavedResult = page.getByRole("row", {
		name: /^Babyfood, Dinner, Macaroni & Tomato,/,
	});
	await expect(longUnsavedResult).toBeVisible();
	await expect(
		longUnsavedResult.getByText("Meals, Entrees, and Side Dishes"),
	).toBeVisible();
	await expectSearchCardGeometry(longUnsavedResult, {
		expectAdd: true,
		expectEllipsis: true,
	});

	await page.evaluate(() => {
		document.documentElement.dataset.theme = "dark";
	});
	await expectSearchCardGeometry(longUnsavedResult, {
		expectAdd: true,
		expectEllipsis: true,
	});
});

test("search-card presentation reflows through the complete responsive matrix", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One deterministic Chromium project owns the complete viewport and text-zoom matrix.",
	);

	for (const viewport of [
		{ width: 320, height: 568 },
		{ width: 360, height: 740 },
		{ width: 390, height: 844 },
		{ width: 420, height: 844 },
		{ width: 740, height: 360 },
		{ width: 768, height: 1024 },
		{ width: 1280, height: 900 },
	]) {
		await page.setViewportSize(viewport);
		await page.goto("/ingredients/fridge/search");
		await waitForAppReady(page);
		await page
			.getByRole("combobox", { name: "Search ingredients" })
			.fill("tomato");
		const longUnsavedResult = page.getByRole("row", {
			name: /^Babyfood, Dinner, Macaroni & Tomato,/,
		});
		await expect(longUnsavedResult).toBeVisible();
		await expectSearchCardGeometry(longUnsavedResult, {
			expectAdd: true,
			expectEllipsis: true,
		});
	}

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);
	await page.evaluate(() => {
		document.documentElement.style.zoom = "2";
	});
	await page
		.getByRole("combobox", { name: "Search ingredients" })
		.fill("tomato");
	const zoomedLongResult = page.getByRole("row", {
		name: /^Babyfood, Dinner, Macaroni & Tomato,/,
	});
	await expect(zoomedLongResult).toBeVisible();
	await expectSearchCardGeometry(zoomedLongResult, {
		expectAdd: true,
		expectEllipsis: true,
	});
});

test(
	"compact Ingredients chrome leaves the viewport and returns with scroll direction",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			!testInfo.project.name.startsWith("mobile-"),
			"Compact chrome behavior is a phone-layout contract.",
		);

		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const viewTop = page.locator(".view-top");
		const ingredientList = page.getByRole("list", {
			name: "Fridge ingredients",
		});

		await expectCompactHeaderHidesAndRevealsWithScroll(viewTop, ingredientList);
	},
);

test(
	"narrow layouts do not create page-level horizontal overflow",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			!testInfo.project.name.startsWith("mobile-"),
			"Horizontal phone overflow is covered by mobile projects.",
		);

		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const viewportWidth = await page.evaluate(() => window.innerWidth);
		const documentWidth = await page.evaluate(
			() => document.documentElement.scrollWidth,
		);
		expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

		await expect(page.getByLabel("Open ingredient search")).toBeVisible();
		await expect(
			page.getByRole("button", {
				name: "Enter a custom ingredient manually",
			}),
		).toBeVisible();
	},
);
