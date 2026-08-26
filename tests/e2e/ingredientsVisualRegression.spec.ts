import {
	expect,
	test,
	waitForAppReady,
	waitForVisualStability,
} from "./support/browserTest";

test(
	"Ingredients keeps its approved desktop and phone composition",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			Boolean(process.env.CI),
			"Reviewed macOS image baselines run locally; CI owns structural layout checks.",
		);
		test.skip(
			!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
			"Visual baselines are intentionally limited to deterministic Chromium projects.",
		);

		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		await page
			.getByRole("button", { name: "Sort saved ingredients", exact: true })
			.click();
		const sortDialog = page.getByRole("dialog", { name: "Sort", exact: true });
		await sortDialog.getByRole("button", { name: "A → Z" }).click();
		await sortDialog.getByRole("button", { name: "Apply" }).click();
		await expect(sortDialog).toBeHidden();
		await expect
			.poll(async () => {
				const names = await page
					.locator(".saved-ingredient-card__title-row strong")
					.allTextContents();
				return (
					names.join("|") ===
					[...names].sort((left, right) => left.localeCompare(right)).join("|")
				);
			})
			.toBe(true);
		await waitForVisualStability(page);

		await expect(page.locator(".view-frame")).toHaveScreenshot(
			"ingredients-fridge.png",
			{
				mask: [page.locator(".ingredient-card-media img")],
				maskColor: "#eaf7ef",
			},
		);
	},
);

test(
	"Ingredient Search keeps its approved light and dark card presentation",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			Boolean(process.env.CI),
			"Reviewed macOS image baselines run locally; CI owns structural layout checks.",
		);
		test.skip(
			!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
			"Visual baselines are intentionally limited to deterministic Chromium projects.",
		);

		await page.goto("/ingredients/fridge/search");
		await waitForAppReady(page);
		await page
			.getByRole("combobox", { name: "Search ingredients" })
			.fill("strawberries");
		await expect(
			page.getByRole("row", { name: /^Strawberries, Raw,/ }),
		).toBeVisible();
		const dailyWelcome = page.getByRole("button", {
			name: /^Dismiss welcome message for /,
		});
		if (await dailyWelcome.isVisible().catch(() => false)) {
			await dailyWelcome.click();
		}
		const searchView = page.locator(".sheet-base__panel--right .view-frame");

		for (const theme of ["light", "dark"] as const) {
			await page.evaluate((selectedTheme) => {
				document.documentElement.dataset.theme = selectedTheme;
			}, theme);
			await waitForVisualStability(page);
			await expect(searchView).toHaveScreenshot(
				`ingredients-search-${theme}.png`,
				{
					mask: [searchView.locator(".ingredient-card-media img")],
					maskColor: "#eaf7ef",
				},
			);
		}
	},
);
