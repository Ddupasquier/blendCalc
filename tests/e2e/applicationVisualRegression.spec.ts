import { expect, test, waitForVisualStability } from "./support/browserTest";

const stableViewSnapshots = [
	{ route: "/mix", snapshotName: "mix.png", rootSelector: ".view-frame" },
	{
		route: "/saved",
		snapshotName: "saved-recipes.png",
		rootSelector: ".view-frame",
	},
] as const;

for (const view of stableViewSnapshots) {
	test(`${view.route} keeps its approved desktop and phone composition`, async ({
		page,
	}, testInfo) => {
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
