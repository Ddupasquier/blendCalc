import { expect, test, waitForAppReady } from "./support/browserTest";

test("Ingredients keeps its approved desktop and phone composition", async ({
	page,
}, testInfo) => {
	test.skip(
		!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
		"Visual baselines are intentionally limited to deterministic Chromium projects.",
	);

	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			Array.from(document.images).map((image) => {
				if (image.complete) return Promise.resolve();
				return new Promise<void>((resolve) => {
					image.addEventListener("load", () => resolve(), { once: true });
					image.addEventListener("error", () => resolve(), { once: true });
				});
			}),
		);
	});

	await expect(page.locator(".view-frame")).toHaveScreenshot(
		"ingredients-fridge.png",
		{
			mask: [page.locator(".ingredient-card-media img")],
			maskColor: "#eaf7ef",
		},
	);
});
