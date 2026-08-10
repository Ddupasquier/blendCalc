import { expect, test, waitForAppReady } from "./support/browserTest";

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

test("selection mode makes the full saved card selectable without stealing action priority", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await page.getByRole("button", { name: "Select items" }).click();

	const firstCard = page.locator(".saved-ingredient-card").first();
	const cardSelectionButton = firstCard.locator(".saved-ingredient-card__select");
	await cardSelectionButton.click();
	await expect(cardSelectionButton).toHaveAttribute("aria-pressed", "true");
	await expect(firstCard).toHaveClass(/saved-ingredient-card--checked/);
	await expect(firstCard.locator(".saved-ingredient-card__move-action")).toHaveCount(0);

	await cardSelectionButton.click();
	await expect(cardSelectionButton).toHaveAttribute("aria-pressed", "false");
});

test("a deliberate card hold enters selection mode and selects that card", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const firstCard = page.locator(".saved-ingredient-card").first();
	const cardSelectionButton = firstCard.locator(".saved-ingredient-card__select");
	await cardSelectionButton.dispatchEvent("pointerdown", {
		pointerId: 1,
		pointerType: "mouse",
		button: 0,
		isPrimary: true,
	});
	await page.waitForTimeout(550);
	await cardSelectionButton.dispatchEvent("pointerup", {
		pointerId: 1,
		pointerType: "mouse",
		button: 0,
		isPrimary: true,
	});
	await expect(cardSelectionButton).toHaveAttribute("aria-pressed", "true");
	await expect(firstCard).toHaveClass(/saved-ingredient-card--checked/);
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

test("compact Ingredients chrome leaves the viewport and returns with scroll direction", async ({
	page,
}, testInfo) => {
	test.skip(
		!testInfo.project.name.startsWith("mobile-"),
		"Compact chrome behavior is a phone-layout contract.",
	);

	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const viewTop = page.locator(".view-top");
	const ingredientList = page.getByRole("list", { name: "Fridge ingredients" });

	await expect(viewTop).toBeVisible();
	const listBottom = await ingredientList.evaluate((element) => {
		const maximumScrollTop = element.scrollHeight - element.clientHeight;
		element.scrollTo({ top: maximumScrollTop });
		return maximumScrollTop;
	});
	expect(listBottom).toBeGreaterThan(0);
	await expect(viewTop).toHaveClass(/view-top--compact-hidden/);
	await viewTop.evaluate(async (element) => {
		await Promise.all(
			element
				.getAnimations({ subtree: true })
				.map((animation) => animation.finished.catch(() => undefined)),
		);
	});

	await ingredientList.evaluate((element) =>
		element.scrollTo({ top: Math.max(0, element.scrollTop - 160) }),
	);
	await expect(viewTop).not.toHaveClass(/view-top--compact-hidden/);
});

test("narrow layouts do not create page-level horizontal overflow", async ({
	page,
}, testInfo) => {
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
		page.getByRole("button", { name: "Enter a custom ingredient manually" }),
	).toBeVisible();
});
