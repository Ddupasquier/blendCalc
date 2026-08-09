import AxeBuilder from "@axe-core/playwright";
import { expect, test, waitForAppReady } from "./support/browserTest";

const accessibilityRoutes = [
	"/ingredients/fridge",
	"/mix",
	"/saved",
	"/profile",
] as const;

for (const route of accessibilityRoutes) {
	test(`${route} has no automatically detectable structural WCAG A or AA violations`, async ({
		page,
	}, testInfo) => {
		test.skip(
			!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
			"Automated semantic scans run at desktop and phone sizes in Chromium.",
		);
		await page.goto(route);
		await waitForAppReady(page);

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
			.disableRules(["color-contrast"])
			.analyze();

		expect(results.violations).toEqual([]);
	});
}
