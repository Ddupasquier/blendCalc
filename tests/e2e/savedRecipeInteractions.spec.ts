import { expect, test, waitForAppReady } from "./support/browserTest";

test("saved recipes default closed and expose their complete details on demand", async ({
	page,
}) => {
	await page.goto("/saved");
	await waitForAppReady(page);

	const card = page
		.locator(".saved-recipe-card")
		.filter({ has: page.getByText("QA Morning Green", { exact: true }) });
	const details = card.locator("details").first();
	const summary = card.locator("summary").first();
	await expect(details).not.toHaveAttribute("open", "");
	await expect(card.getByText(/609 kcal/)).toBeVisible();
	await expect(card.getByLabel(/Overall goal match/)).toBeVisible();

	await summary.click();
	await expect(details).toHaveAttribute("open", "");
	await expect(card.getByText(/10 ingredients/)).toBeVisible();
	await expect(card.getByRole("button", { name: "Load QA Morning Green" })).toBeVisible();

	const remainingIngredients = card.locator("details").nth(1);
	await expect(remainingIngredients).not.toHaveAttribute("open", "");
	await remainingIngredients.locator("summary").click();
	await expect(remainingIngredients).toHaveAttribute("open", "");
});

test("saved recipe deletion requires two deliberate activations", async (
	{ page },
	testInfo,
) => {
	await page.goto("/saved");
	await waitForAppReady(page);

	const card = page
		.locator(".saved-recipe-card")
		.filter({ has: page.getByText("QA Morning Green", { exact: true }) });
	await card.locator("summary").first().click();
	const deleteButton = card.getByRole("button", {
		name: "Delete QA Morning Green",
	});
	if (testInfo.project.name.startsWith("mobile-")) {
		await deleteButton.tap();
	} else {
		await deleteButton.click();
	}

	await expect(
		card.getByText("Tap or click delete again to confirm."),
	).toBeVisible();
	await expect(
		card.getByRole("button", { name: "Confirm deletion of QA Morning Green" }),
	).toBeVisible();
	await expect(page.getByText("4 recipes")).toBeVisible();
});

test("saved recipe search filters by recipe and ingredient text", async ({ page }) => {
	await page.goto("/saved");
	await waitForAppReady(page);

	const search = page.getByRole("searchbox", {
		name: "Search saved recipes by name or ingredient",
	});
	await search.fill("Morning Green");
	await expect(page.getByText("QA Morning Green", { exact: true })).toBeVisible();
	await expect(page.getByText("QA Berry Repeat", { exact: true })).toBeHidden();
	await search.fill("Mango");
	await expect(page.locator(".saved-recipe-card")).toHaveCount(1);
	await page
		.getByRole("button", {
			name: "Clear search saved recipes by name or ingredient",
		})
		.click();
	await expect(search).toHaveValue("");
	await expect(page.locator(".saved-recipe-card")).toHaveCount(4);
});
