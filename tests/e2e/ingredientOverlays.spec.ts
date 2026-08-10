import {
	expect,
	expectFocusOutlineInsideBoundary,
	test,
	waitForAppReady,
} from "./support/browserTest";

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
