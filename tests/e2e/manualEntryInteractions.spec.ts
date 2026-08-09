import { expect, test, waitForAppReady } from "./support/browserTest";

test("manual entry defers required warnings until a forward attempt", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText("Name must be at least 3 characters")).toHaveCount(0);

	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(dialog.getByText("Name must be at least 3 characters")).toBeVisible();
});

test("manual-entry progress tabs perform the same forward validation", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByRole("tab", { name: "Macros" }).click();

	await expect(dialog.getByRole("tab", { name: "Identity" })).toHaveAttribute(
		"aria-current",
		"step",
	);
	await expect(dialog.getByText("Name must be at least 3 characters")).toBeVisible();
});

test("the DB-backed category picker searches, selects, and restores focus", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByLabel("Food name").fill("Playwright lentil bowl");
	const categoryTrigger = dialog.getByRole("button", { name: "Category" });
	await expect(categoryTrigger).toBeEnabled();
	await categoryTrigger.click();

	const categorySearch = dialog.getByRole("searchbox", {
		name: "Search categories",
	});
	await expect(categorySearch).toBeFocused();
	await categorySearch.fill("legume");
	await expect(
		dialog.getByRole("status", { name: "Searching categories" }),
	).toBeHidden({ timeout: 20_000 });
	const categoryResult = dialog
		.getByRole("button", { name: /Legumes and Legume Products/i })
		.first();
	await expect(categoryResult).toBeVisible();
	await categoryResult.click();
	await expect(categoryTrigger).toContainText(/Legumes and Legume Products/i);
	await expect(categoryTrigger).toBeFocused();

	await categoryTrigger.click();
	await page.keyboard.press("Escape");
	await expect(categoryTrigger).toHaveAttribute("aria-expanded", "false");
	await expect(categoryTrigger).toBeFocused();
});
