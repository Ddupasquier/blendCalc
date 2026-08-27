import type { Page } from "@playwright/test";
import { expect, test, waitForAppReady } from "./support/browserTest";
import { getAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";

const readRenderedFoodIds = (page: Page) =>
	page
		.getByRole("list", { name: "Fridge ingredients" })
		.locator("li[data-food-id]")
		.evaluateAll((listItems) =>
			listItems.map((listItem) =>
				Number((listItem as HTMLElement).dataset.foodId),
			),
		);

test("a hard refresh restores the newest bounded Fridge page", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One primary browser proves deterministic list-page reset behavior.",
	);

	const supabase = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);
	const { data: newestRows, error: newestRowsError } = await supabase
		.from("user_food_list_items")
		.select("fdc_id, created_at, id")
		.eq("list_type", "fridge")
		.order("created_at", { ascending: false })
		.order("id", { ascending: false });
	if (newestRowsError) throw newestRowsError;
	const newestFoodIds = (newestRows ?? []).map((row) => row.fdc_id);

	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const fridgeList = page.getByRole("list", { name: "Fridge ingredients" });
	await expect(fridgeList).toHaveAttribute("aria-busy", "false");
	const initialRenderedFoodIds = await readRenderedFoodIds(page);
	expect(initialRenderedFoodIds.length).toBeGreaterThan(0);
	expect(initialRenderedFoodIds.length).toBeLessThan(newestFoodIds.length);
	const expectedFirstPageFoodIds = newestFoodIds.slice(
		0,
		initialRenderedFoodIds.length,
	);
	await expect
		.poll(() => readRenderedFoodIds(page))
		.toEqual(expectedFirstPageFoodIds);

	const loadMoreButton = page.getByRole("button", {
		name: "Load more",
		exact: true,
	});
	await expect(loadMoreButton).toBeVisible();
	await loadMoreButton.click();
	await expect
		.poll(async () => (await readRenderedFoodIds(page)).length)
		.toBeGreaterThan(expectedFirstPageFoodIds.length);

	await page.reload();
	await waitForAppReady(page);
	await expect(fridgeList).toHaveAttribute("aria-busy", "false");
	await expect
		.poll(() => readRenderedFoodIds(page))
		.toEqual(expectedFirstPageFoodIds);
	await expect(loadMoreButton).toBeVisible();
});
