import { expect, test, waitForAppReady } from "./support/browserTest";
import type { Page, Request } from "@playwright/test";

type IngredientListSnapshot = {
	activeTabLabel: string;
	listTabLabels: string[];
	renderedFoodIds: string[];
	selectedFoodIds: string[];
	lastVisibleFoodId: string | null;
	scrollTop: number;
};

const ingredientList = (page: Page) =>
	page.locator(".saved-ingredient-list__cards");

const revealAnotherIngredientPage = async (page: Page) => {
	const list = ingredientList(page);
	const initialCardCount = await list.locator("li[data-food-id]").count();
	const loadMoreButton = page.getByRole("button", {
		name: "Load more",
		exact: true,
	});

	await expect(loadMoreButton).toBeVisible();
	await loadMoreButton.click();
	await expect
		.poll(() => list.locator("li[data-food-id]").count())
		.toBeGreaterThan(initialCardCount);
	await expect(list.locator("li[data-food-id]")).not.toHaveCount(12);
};

const scrollIngredientListAwayFromTop = async (page: Page) => {
	const list = ingredientList(page);
	const targetScrollTop = await list.evaluate((element) => {
		const maximumScrollTop = element.scrollHeight - element.clientHeight;
		const nextScrollTop = Math.min(240, maximumScrollTop);
		element.scrollTo({ top: nextScrollTop, behavior: "auto" });
		return nextScrollTop;
	});
	expect(targetScrollTop).toBeGreaterThan(0);
	await expect
		.poll(() => list.evaluate((element) => element.scrollTop))
		.toBe(targetScrollTop);
};

const readIngredientListSnapshot = async (
	page: Page,
): Promise<IngredientListSnapshot> => {
	const list = ingredientList(page);
	const listLayout = page.locator(".saved-ingredient-list-layout");
	const [activeTabLabel, listTabLabels, listState] = await Promise.all([
		listLayout
			.getByRole("tab", { selected: true })
			.innerText()
			.then((label) => label.replace(/\s+/g, " ").trim()),
		listLayout
			.getByRole("tab")
			.allInnerTexts()
			.then((labels) =>
				labels.map((label) => label.replace(/\s+/g, " ").trim()),
			),
		list.evaluate((element) => {
			const listBounds = element.getBoundingClientRect();
			const cards = Array.from(
				element.querySelectorAll<HTMLElement>("li[data-food-id]"),
			);
			const visibleCards = cards.filter((card) => {
				const bounds = card.getBoundingClientRect();
				return bounds.bottom > listBounds.top && bounds.top < listBounds.bottom;
			});

			return {
				renderedFoodIds: cards.map((card) => card.dataset.foodId ?? ""),
				selectedFoodIds: cards
					.filter((card) => card.dataset.bulkSelected === "true")
					.map((card) => card.dataset.foodId ?? ""),
				lastVisibleFoodId: visibleCards.at(-1)?.dataset.foodId ?? null,
				scrollTop: element.scrollTop,
			};
		}),
	]);

	return {
		activeTabLabel,
		listTabLabels,
		...listState,
	};
};

const expectIngredientListSnapshot = async (
	page: Page,
	expectedSnapshot: IngredientListSnapshot,
) => {
	await expect
		.poll(() => readIngredientListSnapshot(page))
		.toEqual(expectedSnapshot);
	await expect(
		page.getByText("Loading saved ingredients…", { exact: true }),
	).toHaveCount(0);
};

const recordIngredientListRequests = (page: Page) => {
	const requestUrls: string[] = [];
	const recordRequest = (request: Request) => {
		if (new URL(request.url()).pathname.startsWith("/api/user-food-lists/")) {
			requestUrls.push(request.url());
		}
	};
	page.on("request", recordRequest);

	return {
		requestUrls,
		stop: () => page.off("request", recordRequest),
	};
};

test("Sort preserves the loaded Fridge cards and scroll position", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await revealAnotherIngredientPage(page);
	await scrollIngredientListAwayFromTop(page);

	const expectedSnapshot = await readIngredientListSnapshot(page);
	expect(expectedSnapshot.activeTabLabel).toContain("Fridge");
	expect(expectedSnapshot.renderedFoodIds.length).toBeGreaterThan(12);
	expect(expectedSnapshot.lastVisibleFoodId).not.toBeNull();
	expect(expectedSnapshot.scrollTop).toBeGreaterThan(0);

	const listRequests = recordIngredientListRequests(page);
	await page
		.getByRole("button", {
			name: "Filter and sort saved ingredients",
			exact: true,
		})
		.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/filters$/);
	await expect(
		page.getByRole("dialog", { name: "Filter and sort" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Close sheet" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expectIngredientListSnapshot(page, expectedSnapshot);

	listRequests.stop();
	expect(listRequests.requestUrls).toEqual([]);
});

test("Manual Entry preserves loaded Shopping List cards, selection, and scroll position", async ({
	page,
}) => {
	await page.goto("/ingredients/shopping");
	await waitForAppReady(page);
	await revealAnotherIngredientPage(page);
	await scrollIngredientListAwayFromTop(page);

	await page.getByRole("button", { name: "Select items" }).click();
	await ingredientList(page)
		.locator(".saved-ingredient-card__select")
		.nth(4)
		.click();
	const expectedSnapshot = await readIngredientListSnapshot(page);
	expect(expectedSnapshot.activeTabLabel).toContain("Shopping List");
	expect(expectedSnapshot.renderedFoodIds.length).toBeGreaterThan(12);
	expect(expectedSnapshot.selectedFoodIds).toHaveLength(1);
	expect(expectedSnapshot.lastVisibleFoodId).not.toBeNull();
	expect(expectedSnapshot.scrollTop).toBeGreaterThan(0);

	const listRequests = recordIngredientListRequests(page);
	await page
		.getByRole("button", { name: "Enter a custom ingredient manually" })
		.click();
	await expect(page).toHaveURL(/\/ingredients\/shopping\/manual-entry$/);
	await expect(
		page.getByRole("dialog", { name: "Enter Manually" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Close sheet" }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await expectIngredientListSnapshot(page, expectedSnapshot);

	listRequests.stop();
	expect(listRequests.requestUrls).toEqual([]);
});

test("Actions and Nutrition preserve the loaded Fridge window without hidden pagination", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await revealAnotherIngredientPage(page);

	const targetCard = ingredientList(page).locator("li[data-food-id]").nth(6);
	await targetCard.scrollIntoViewIfNeeded();
	const foodName = await targetCard.locator("strong").innerText();
	const expectedSnapshot = await readIngredientListSnapshot(page);
	expect(expectedSnapshot.activeTabLabel).toContain("Fridge");
	expect(expectedSnapshot.renderedFoodIds.length).toBeGreaterThan(12);
	expect(expectedSnapshot.selectedFoodIds).toEqual([]);
	expect(expectedSnapshot.lastVisibleFoodId).not.toBeNull();
	expect(expectedSnapshot.scrollTop).toBeGreaterThan(0);

	const listRequests = recordIngredientListRequests(page);
	await page
		.getByRole("button", {
			name: `Open actions for ${foodName}`,
			exact: true,
		})
		.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/actions\//);
	await expect(page.getByRole("dialog", { name: foodName })).toBeVisible();
	await page.getByRole("button", { name: "Close sheet" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expectIngredientListSnapshot(page, expectedSnapshot);

	await targetCard
		.locator(".saved-ingredient-card__select")
		.evaluate((button: HTMLButtonElement) => button.click());
	await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\//);
	await expectIngredientListSnapshot(page, expectedSnapshot);
	await expect(
		page.getByRole("button", { name: "Back to ingredients" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Back to ingredients" }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expectIngredientListSnapshot(page, expectedSnapshot);

	listRequests.stop();
	expect(listRequests.requestUrls).toEqual([]);
});
