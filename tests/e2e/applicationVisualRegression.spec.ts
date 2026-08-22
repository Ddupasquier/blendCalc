import { expect, test, waitForVisualStability } from "./support/browserTest";

const stableViewSnapshots = [
	{ route: "/mix", snapshotName: "mix.png", rootSelector: ".view-frame" },
	{
		route: "/saved",
		snapshotName: "saved-recipes.png",
		rootSelector: ".view-frame",
	},
	{
		route: "/profile/food-preferences",
		snapshotName: "profile-food-preferences.png",
		rootSelector: ".profile-food-preference-view",
	},
] as const;

for (const view of stableViewSnapshots) {
	test(`${view.route} keeps its approved desktop and phone composition`, async ({
		page,
	}, testInfo) => {
		test.skip(
			Boolean(process.env.CI),
			"Reviewed macOS image baselines run locally; CI owns structural layout checks.",
		);
		test.skip(
			!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
			"Visual baselines are intentionally limited to deterministic Chromium projects.",
		);

		await page.goto(view.route);
		await waitForVisualStability(page);

		await expect(page.locator(view.rootSelector)).toHaveScreenshot(
			view.snapshotName,
			{
				mask: [page.locator("img")],
				maskColor: "#eaf7ef",
			},
		);
	});
}
