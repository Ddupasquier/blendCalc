import { expect, test, waitForAppReady } from "./support/browserTest";

const shallowRouteOverlayCases = [
	{
		baseRoute: "/ingredients/fridge",
		launcherName: "Sort saved ingredients",
		overlayRoute: "/ingredients/fridge/filters",
		dialogName: "Sort",
	},
	{
		baseRoute: "/mix",
		launcherName: "Open mix options",
		overlayRoute: "/mix/options",
		dialogName: "Mix options",
	},
	{
		baseRoute: "/saved",
		launcherName: "Sort saved recipes",
		overlayRoute: "/saved/sort",
		dialogName: "Sort",
		documentTitle: "Sort Saved Recipes · blendCalc",
	},
	{
		baseRoute: "/profile",
		launcherName: /Light\/Dark Mode/,
		overlayRoute: "/profile/appearance",
		dialogName: "Light/Dark Mode",
	},
] as const;

for (const routeCase of shallowRouteOverlayCases) {
	test(
		`${routeCase.overlayRoute} opens immediately and follows browser history`,
		{ tag: "@compatibility" },
		async ({ page }) => {
			await page.goto(routeCase.baseRoute);
			await waitForAppReady(page);

			await page.getByRole("button", { name: routeCase.launcherName }).click();
			await expect(page).toHaveURL(new RegExp(`${routeCase.overlayRoute}$`));
			await expect(
				page.getByRole("dialog", { name: routeCase.dialogName }),
			).toBeVisible();
			if ("documentTitle" in routeCase) {
				await expect(page).toHaveTitle(routeCase.documentTitle);
				await expect(
					page.getByRole("heading", { name: "Sort", exact: true }),
				).toHaveCount(1);
			}

			await page.goBack();
			await expect(page).toHaveURL(new RegExp(`${routeCase.baseRoute}$`));
			await expect(
				page.getByRole("dialog", { name: routeCase.dialogName }),
			).toBeHidden();

			await page.goForward();
			await expect(page).toHaveURL(new RegExp(`${routeCase.overlayRoute}$`));
			await expect(
				page.getByRole("dialog", { name: routeCase.dialogName }),
			).toBeVisible();

			await page.reload();
			await waitForAppReady(page);
			await expect(page).toHaveURL(new RegExp(`${routeCase.overlayRoute}$`));
			await expect(
				page.getByRole("dialog", { name: routeCase.dialogName }),
			).toBeVisible();

			await page.keyboard.press("Escape");
			await expect(page).toHaveURL(new RegExp(`${routeCase.baseRoute}$`));
			await expect(
				page.getByRole("dialog", { name: routeCase.dialogName }),
			).toBeHidden();
		},
	);
}
