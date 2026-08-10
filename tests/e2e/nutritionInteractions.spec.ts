import { expect, test, waitForAppReady } from "./support/browserTest";

const openIngredientNutrition = async (
	page: import("@playwright/test").Page,
	previewButtonName: string | RegExp = /^Preview /,
) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const previewButton = page
		.getByRole("button", { name: previewButtonName })
		.first();
	for (let revealAttempt = 0; revealAttempt < 10; revealAttempt += 1) {
		if (await previewButton.isVisible()) break;
		const loadMoreButton = page.getByRole("button", {
			name: "Load more",
			exact: true,
		});
		await expect(loadMoreButton).toBeVisible();
		const visibleCardCount = await page.locator(".saved-ingredient-card").count();
		await loadMoreButton.click();
		await expect
			.poll(() => page.locator(".saved-ingredient-card").count())
			.toBeGreaterThan(visibleCardCount);
	}
	await expect(previewButton).toBeVisible();
	await previewButton.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/nutrition\//);
};

test("nutrition amount controls support ordinary and held browser input", async ({
	page,
}) => {
	await openIngredientNutrition(page);
	const amount = page.getByRole("region", { name: "Viewing amount" });
	const amountValue = amount.locator("strong");
	const originalValue = await amountValue.innerText();
	const increase = amount.getByRole("button", {
		name: /Increase viewing amount by 1g/,
	});
	const decrease = amount.getByRole("button", {
		name: /Decrease viewing amount by 1g/,
	});

	await increase.click();
	await expect(amountValue).not.toHaveText(originalValue);
	await decrease.click();
	await expect(amountValue).toHaveText(originalValue);

	const increaseBounds = await increase.boundingBox();
	expect(increaseBounds).not.toBeNull();
	await page.mouse.move(
		increaseBounds!.x + increaseBounds!.width / 2,
		increaseBounds!.y + increaseBounds!.height / 2,
	);
	await page.mouse.down();
	await page.waitForTimeout(750);
	await page.mouse.up();
	await expect(amountValue).not.toHaveText(originalValue);

	const valueAfterPointerHold = await amountValue.innerText();
	await increase.focus();
	await increase.press("Space", { delay: 750 });
	await expect(amountValue).not.toHaveText(valueAfterPointerHold);
});

test("nutrition serving choices use the shared accessible select", async ({
	page,
}) => {
	await openIngredientNutrition(page, "Preview Greek Yogurt, Plain");
	const serving = page.getByRole("combobox", { name: "Serving" });
	await expect(serving).toBeVisible();
	await serving.focus();
	await serving.press("ArrowDown");
	await expect(serving).toHaveAttribute("aria-expanded", "true");
	await serving.press("Escape");
	await expect(serving).toHaveAttribute("aria-expanded", "false");
	await expect(serving).toBeFocused();
});
