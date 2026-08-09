import { expect, test, waitForAppReady } from "./support/browserTest";

const authenticatedRoutes = [
	{
		path: "/ingredients/fridge",
		heading: "Ingredients",
		title: /Fridge · blendCalc$/,
	},
	{
		path: "/mix",
		heading: "Mix.",
		title: /Mix · blendCalc$/,
	},
	{
		path: "/saved",
		heading: "Saved Recipes",
		title: /Saved Recipes · blendCalc$/,
	},
	{
		path: "/profile",
		heading: "Your profile",
		title: /Profile · blendCalc$/,
	},
] as const;

for (const route of authenticatedRoutes) {
	test(`${route.path} renders its authenticated route shell without browser errors`, async ({
		page,
	}) => {
		const response = await page.goto(route.path);
		expect(response?.status()).toBeLessThan(400);
		await waitForAppReady(page);
		await expect(
			page.getByRole("heading", { name: route.heading, exact: true }),
		).toBeVisible();
		await expect(page).toHaveTitle(route.title);
	});
}

test("Fridge and Shopping List preserve browser Back and Forward history", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);

	await page.getByRole("tab", { name: /Shopping List/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
	await expect(page.getByRole("tab", { name: /Fridge/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);

	await page.goForward();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await expect(page.getByRole("tab", { name: /Shopping List/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);
});

test("signed-out visitors are redirected away from protected routes", async ({
	context,
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"Server-enforced route protection is covered once in Chromium.",
	);
	await context.clearCookies();
	await page.goto("/ingredients/fridge");

	await expect(page).toHaveURL(/\/\?next=%2Fingredients%2Ffridge$/);
	await expect(
		page.getByRole("heading", { name: "See how your food adds up." }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: /Sign in to start building/ }),
	).toHaveAttribute("href", "/auth?next=%2Fingredients%2Ffridge");
});
