import { expect, test, waitForAppReady } from "./support/browserTest";

test("the guided tour spotlights real controls and navigates between app views", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The complete route-aware tour is deterministic in one browser; shared controls are covered cross-engine elsewhere.",
	);

	await page.goto("/profile/tutorial");
	await waitForAppReady(page);
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Find the foods you use" }),
	).toBeVisible();
	await expect(page.locator(".app-main")).toHaveAttribute("inert", "");
	await expect(page.locator("html")).toHaveCSS("overflow", "hidden");

	const activeTarget = page.locator("[data-tutorial-active='true']");
	const spotlight = page.locator(".tutorial-spotlight");
	await expect(activeTarget).toHaveCount(1);
	await expect(spotlight).toBeVisible();
	const [targetBounds, spotlightBounds] = await Promise.all([
		activeTarget.boundingBox(),
		spotlight.boundingBox(),
	]);
	expect(targetBounds).not.toBeNull();
	expect(spotlightBounds).not.toBeNull();
	expect(targetBounds!.x - spotlightBounds!.x).toBeGreaterThanOrEqual(8);
	expect(targetBounds!.y - spotlightBounds!.y).toBeGreaterThanOrEqual(8);

	for (const heading of [
		"Scan packaged foods",
		"Open one ingredient",
		"Manage that ingredient",
	]) {
		await dialog.getByRole("button", { name: "Next" }).click();
		await expect(page.getByRole("heading", { name: heading })).toBeVisible();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	}

	await dialog.getByRole("button", { name: "Next" }).click();
	await expect(page).toHaveURL(/\/mix$/);
	await expect(
		page.getByRole("heading", { name: "Choose what goes into Mix" }),
	).toBeVisible();

	await page.getByRole("button", { name: "Exit tour" }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(page.locator(".app-main")).not.toHaveAttribute("inert", "");
});
