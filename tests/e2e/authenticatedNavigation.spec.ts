import { expect, test, waitForAppReady } from "./support/browserTest";

test("primary tabs use client navigation without remounting the document", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const documentIdentity = await page.evaluate(() => {
		const identity = crypto.randomUUID();
		(
			window as Window & { blendCalcPlaywrightDocumentIdentity?: string }
		).blendCalcPlaywrightDocumentIdentity = identity;
		return identity;
	});

	await page.getByRole("link", { name: "Mix" }).click();
	await expect(page).toHaveURL(/\/mix(?:[/?#]|$)/);
	await expect(page.getByRole("heading", { name: "Mix." })).toBeVisible();

	await page.getByRole("link", { name: "Saved" }).click();
	await expect(page).toHaveURL(/\/saved(?:[/?#]|$)/);
	await expect(page.getByRole("heading", { name: "Saved Recipes" })).toBeVisible();

	const preservedDocumentIdentity = await page.evaluate(
		() =>
			(
				window as Window & { blendCalcPlaywrightDocumentIdentity?: string }
			).blendCalcPlaywrightDocumentIdentity,
	);
	expect(preservedDocumentIdentity).toBe(documentIdentity);
});

test("changing browser focus does not reload or discard an open manual-entry draft", async ({
	context,
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await page
		.getByRole("button", { name: "Enter a custom ingredient manually" })
		.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge\/manual-entry$/);

	const foodNameInput = page.getByLabel("Food name");
	await foodNameInput.fill("Browser focus persistence test");

	const backgroundPage = await context.newPage();
	await backgroundPage.goto("about:blank");
	await backgroundPage.bringToFront();
	await page.bringToFront();

	await expect(page).toHaveURL(/\/ingredients\/fridge\/manual-entry$/);
	await expect(foodNameInput).toHaveValue("Browser focus persistence test");

	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(
		page.getByRole("button", { name: "Enter a custom ingredient manually" }),
	).toBeFocused();
	await backgroundPage.close();
});
