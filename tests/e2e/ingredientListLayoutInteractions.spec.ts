import type { Locator, Page } from "@playwright/test";
import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	test,
	waitForAppReady,
} from "./support/browserTest";

type ElementBounds = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

const getSavedIngredientList = (
	page: Page,
	label: "Fridge" | "Shopping List",
) => page.getByRole("list", { name: `${label} ingredients` });

const getSavedIngredientCards = (list: Locator) =>
	list.locator(":scope > li[data-food-id]");

const requireBounds = async (locator: Locator) => {
	const bounds = await locator.boundingBox();
	expect(bounds).not.toBeNull();
	return bounds as ElementBounds;
};

const expectVerticalOrder = (
	upperBounds: ElementBounds,
	lowerBounds: ElementBounds,
) => {
	expect(upperBounds.y + upperBounds.height).toBeLessThanOrEqual(
		lowerBounds.y + 1,
	);
};

const readListSpacing = async (page: Page, list: Locator) => {
	const [tabBounds, actionBounds, firstCardBounds] = await Promise.all([
		requireBounds(
			page.getByRole("tablist", { name: "Saved ingredient lists" }),
		),
		requireBounds(page.locator(".ingredient-bulk-actions")),
		requireBounds(getSavedIngredientCards(list).first()),
	]);

	return {
		actionToCardPixels:
			firstCardBounds.y - (actionBounds.y + actionBounds.height),
		tabToActionPixels: actionBounds.y - (tabBounds.y + tabBounds.height),
	};
};

const expectSharedDesktopSpacing = (
	spacing: Awaited<ReturnType<typeof readListSpacing>>,
) => {
	for (const measuredGap of [
		spacing.tabToActionPixels,
		spacing.actionToCardPixels,
	]) {
		expect(measuredGap).toBeGreaterThanOrEqual(11);
		expect(measuredGap).toBeLessThanOrEqual(13);
	}
};

test("saved ingredient lists scroll completely without overlapping fixed application chrome", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One Chromium project owns the exact responsive geometry matrix.",
	);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	const list = getSavedIngredientList(page, "Fridge");
	const cards = getSavedIngredientCards(list);
	await expect(cards.first()).toBeVisible();
	const savedFridgeCount = Number(
		await page
			.getByRole("tab", { name: /Fridge/ })
			.locator(".segmented-control__count")
			.innerText(),
	);
	expect(savedFridgeCount).toBeGreaterThanOrEqual(15);
	expect(await cards.count()).toBeGreaterThan(3);

	const [
		viewTopBounds,
		tabsBounds,
		actionsBounds,
		listBounds,
		navigationBounds,
	] = await Promise.all([
		requireBounds(page.locator(".view-top")),
		requireBounds(
			page.getByRole("tablist", { name: "Saved ingredient lists" }),
		),
		requireBounds(page.locator(".ingredient-bulk-actions")),
		requireBounds(list),
		requireBounds(page.getByRole("navigation", { name: "Main navigation" })),
	]);
	expectVerticalOrder(viewTopBounds, tabsBounds);
	expectVerticalOrder(tabsBounds, actionsBounds);
	expectVerticalOrder(actionsBounds, await requireBounds(cards.first()));
	expect(
		await page
			.getByRole("navigation", { name: "Main navigation" })
			.evaluate((element) => getComputedStyle(element).position),
	).toBe("fixed");

	const listScrollRange = await list.evaluate(
		(element) => element.scrollHeight - element.clientHeight,
	);
	expect(listScrollRange).toBeGreaterThan(0);
	let renderedCardCount = await cards.count();
	const loadMoreButton = page.getByRole("button", { name: "Load more" });
	while (await loadMoreButton.isVisible()) {
		await loadMoreButton.scrollIntoViewIfNeeded();
		await loadMoreButton.click();
		await expect.poll(() => cards.count()).toBeGreaterThan(renderedCardCount);
		renderedCardCount = await cards.count();
	}
	expect(renderedCardCount).toBe(savedFridgeCount);
	await cards.last().scrollIntoViewIfNeeded();
	await expect
		.poll(() => list.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);
	const finalCardBounds = await requireBounds(cards.last());
	expect(finalCardBounds.y).toBeGreaterThanOrEqual(listBounds.y - 1);
	expect(finalCardBounds.y + finalCardBounds.height).toBeLessThanOrEqual(
		listBounds.y + listBounds.height + 1,
	);
	expect(finalCardBounds.y + finalCardBounds.height).toBeLessThanOrEqual(
		navigationBounds.y + 1,
	);

	const horizontalLayout = await page.evaluate(() => ({
		documentWidth: document.documentElement.scrollWidth,
		viewportWidth: window.innerWidth,
	}));
	expect(horizontalLayout.documentWidth).toBeLessThanOrEqual(
		horizontalLayout.viewportWidth,
	);
});

test("list switching resets scroll and preserves shared spacing and selection controls", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One Chromium project owns list geometry while existing mobile coverage owns touch mechanics.",
	);

	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	let activeList = getSavedIngredientList(page, "Fridge");
	await expect(getSavedIngredientCards(activeList).first()).toBeVisible();
	const fridgeSpacing = await readListSpacing(page, activeList);
	expectSharedDesktopSpacing(fridgeSpacing);

	await activeList.evaluate((element) =>
		element.scrollTo({ top: element.scrollHeight }),
	);
	await expect
		.poll(() => activeList.evaluate((element) => element.scrollTop))
		.toBeGreaterThan(0);

	await page.getByRole("tab", { name: /Shopping List/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	activeList = getSavedIngredientList(page, "Shopping List");
	await expect(getSavedIngredientCards(activeList).first()).toBeVisible();
	await expect
		.poll(() => activeList.evaluate((element) => element.scrollTop))
		.toBe(0);
	const shoppingSpacing = await readListSpacing(page, activeList);
	expectSharedDesktopSpacing(shoppingSpacing);
	expect(shoppingSpacing).toEqual(fridgeSpacing);

	await page.getByRole("button", { name: "Select items" }).click();
	const shoppingCards = getSavedIngredientCards(activeList);
	await shoppingCards.first().locator(".saved-ingredient-card__select").click();
	await shoppingCards.nth(1).locator(".saved-ingredient-card__select").click();
	await expect(page.getByRole("button", { name: "Select all" })).toBeVisible();
	await page.getByRole("button", { name: "Select all" }).click();
	await expect(
		activeList.locator('.saved-ingredient-card__select[aria-pressed="true"]'),
	).toHaveCount(await shoppingCards.count());
	await page.getByRole("button", { name: "Cancel" }).click();
	await expect(
		page.getByRole("button", { name: "Select items" }),
	).toBeVisible();

	await page.getByRole("tab", { name: /Fridge/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	activeList = getSavedIngredientList(page, "Fridge");
	await expect(getSavedIngredientCards(activeList).first()).toBeVisible();
	await expect
		.poll(() => activeList.evaluate((element) => element.scrollTop))
		.toBe(0);
	expect(await readListSpacing(page, activeList)).toEqual(fridgeSpacing);
});

test("compact header behavior covers the exact phone, wide, and reduced-motion states", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One Chromium project owns the explicit viewport and reduced-motion states.",
	);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const viewTop = page.locator(".view-top");
	await expectCompactHeaderHidesAndRevealsWithScroll(
		viewTop,
		getSavedIngredientList(page, "Fridge"),
	);

	await page.getByRole("tab", { name: /Shopping List/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await expect(viewTop).not.toHaveClass(/view-top--compact-hidden/);

	await page.setViewportSize({ width: 1024, height: 768 });
	const wideList = getSavedIngredientList(page, "Shopping List");
	await wideList.evaluate((element) =>
		element.scrollTo({ top: element.scrollHeight }),
	);
	await expect(viewTop).toBeVisible();
	expect(
		await viewTop.evaluate((element) => getComputedStyle(element).opacity),
	).toBe("1");

	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.reload();
	await waitForAppReady(page);
	const reducedMotionViewTop = page.locator(".view-top");
	await expectCompactHeaderHidesAndRevealsWithScroll(
		reducedMotionViewTop,
		getSavedIngredientList(page, "Shopping List"),
	);
	const transitionDurations = await viewTop.evaluate((element) =>
		[
			getComputedStyle(
				element.querySelector(".view-top__content") as HTMLElement,
			).transitionDuration,
			getComputedStyle(element).transitionDuration,
		].flatMap((durationList) =>
			durationList
				.split(",")
				.map((duration) => Number.parseFloat(duration.trim())),
		),
	);
	for (const durationSeconds of transitionDurations) {
		expect(durationSeconds).toBeLessThanOrEqual(0.001);
	}
});
