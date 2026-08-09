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
