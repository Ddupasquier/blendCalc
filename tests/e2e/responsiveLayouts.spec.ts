import { expect, test, waitForAppReady } from "./support/browserTest";

const responsiveViewports = [
	{ width: 320, height: 568 },
	{ width: 360, height: 740 },
	{ width: 390, height: 844 },
	{ width: 420, height: 844 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 768 },
	{ width: 1440, height: 900 },
] as const;

const routes = ["/ingredients/fridge", "/mix", "/saved", "/profile"] as const;

for (const viewport of responsiveViewports) {
	test(`${viewport.width}×${viewport.height} keeps primary views inside the viewport`, async ({
		page,
	}, testInfo) => {
		test.skip(
			testInfo.project.name !== "desktop-chromium",
			"The deterministic viewport matrix runs once in Chromium.",
		);
		await page.setViewportSize(viewport);

		for (const route of routes) {
			await page.goto(route);
			await waitForAppReady(page);
			const layoutWidth = await page.evaluate(() => ({
				documentWidth: document.documentElement.scrollWidth,
				viewportWidth: window.innerWidth,
			}));
			expect(
				layoutWidth.documentWidth,
				`${route} overflowed horizontally`,
			).toBeLessThanOrEqual(layoutWidth.viewportWidth);
		}
	});
}

test("reduced motion keeps ingredient navigation functional", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"Reduced-motion behavior is engine-independent and runs once in Chromium.",
	);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	await page.getByRole("tab", { name: /Shopping List/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await page.getByRole("tab", { name: /Fridge/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
});
