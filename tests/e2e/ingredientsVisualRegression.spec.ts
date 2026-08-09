import { expect, test, waitForVisualStability } from "./support/browserTest";

test("Ingredients keeps its approved desktop and phone composition", async ({
	page,
}, testInfo) => {
	test.skip(
		!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
		"Visual baselines are intentionally limited to deterministic Chromium projects.",
	);

	await page.goto("/ingredients/fridge");
	await waitForVisualStability(page);

	await expect(page.locator(".view-frame")).toHaveScreenshot(
		"ingredients-fridge.png",
		{
			mask: [page.locator(".ingredient-card-media img")],
			maskColor: "#eaf7ef",
		},
	);
});
