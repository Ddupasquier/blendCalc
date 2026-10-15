import { test, expect, waitForAppReady } from "./support/browserTest";

test(
	"food favorites survive list moves and removal and are privately discoverable",
	{ tag: "@compatibility" },
	async ({ page, unexpectedBrowserErrors }) => {
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const original = await (
			await page.request.get("/api/user-food-lists/fridge?limit=1")
		).json();
		const food = original.foods[0];
		expect(food).toBeTruthy();
		const favorite = () =>
			page.getByRole("button", {
				name: `Favorite: ${food.description}`,
				exact: true,
			});
		const removeFavorite = () =>
			page.getByRole("button", {
				name: `Remove favorite: ${food.description}`,
				exact: true,
			});
		await page.request.post("/api/favorites", {
			data: { kind: "food", targetId: String(food.fdcId), favorite: false },
		});
		try {
			await page.reload();
			await waitForAppReady(page);
			await favorite().press("Enter");
			await expect(removeFavorite()).toHaveAttribute("aria-pressed", "true");
			await expect(removeFavorite()).toBeEnabled();
			await page.reload();
			await waitForAppReady(page);
			await expect(removeFavorite()).toHaveAttribute("aria-pressed", "true");
			const moved = await page.request.post(
				"/api/user-food-lists/shopping-list",
				{ data: { food, allowMove: true } },
			);
			expect(moved.ok()).toBeTruthy();
			const state = await (
				await page.request.get(`/api/favorites?kind=food&id=${food.fdcId}`)
			).json();
			expect(state.state.favorite).toBe(true);
			expect(
				(
					await page.request.delete(
						`/api/user-food-lists/shopping-list?foodId=${food.fdcId}`,
					)
				).ok(),
			).toBeTruthy();
			await page.reload();
			await waitForAppReady(page);
			let refuseRead = true;
			await page.route("**/api/favorites?**", async (route) => {
				const url = new URL(route.request().url());
				if (
					refuseRead &&
					url.searchParams.get("kind") === "food" &&
					!url.searchParams.has("id")
				)
					await route.fulfill({
						status: 503,
						contentType: "application/json",
						body: '{"error":"synthetic favorite read refusal"}',
					});
				else await route.continue();
			});
			await page
				.getByRole("button", {
					name: "Filter and sort saved ingredients",
					exact: true,
				})
				.click();
			await page
				.getByRole("button", { name: "Favorites only", exact: true })
				.click();
			await page.getByRole("button", { name: "Apply", exact: true }).click();
			const collection = page.getByRole("region", {
				name: "Favorite foods",
				exact: true,
			});
			await expect(
				collection.getByText("Your favorite foods could not load. Try again.", {
					exact: true,
				}),
			).toBeVisible();
			for (const error of unexpectedBrowserErrors) {
				if (error.startsWith("response.503: GET ")) {
					const url = new URL(error.slice("response.503: GET ".length));
					expect(url.origin).toBe(new URL(page.url()).origin);
					expect(url.pathname).toBe("/api/favorites");
					expect(url.searchParams.get("kind")).toBe("food");
					expect(url.searchParams.has("id")).toBe(false);
				} else expect(error).toMatch(/^console\.error:.*503/);
			}
			unexpectedBrowserErrors.splice(0);
			refuseRead = false;
			await collection
				.getByRole("button", { name: "Retry favorites", exact: true })
				.click();
			await expect(
				collection.getByRole("button", {
					name: `Preview ${food.description}`,
					exact: true,
				}),
			).toBeVisible();
			await collection
				.getByRole("button", {
					name: `Remove favorite: ${food.description}`,
					exact: true,
				})
				.click();
			await expect(
				collection.getByRole("button", {
					name: `Preview ${food.description}`,
					exact: true,
				}),
			).toHaveCount(0);
			await expect(
				collection.getByText(/No favorite foods match/),
			).toBeVisible();
		} finally {
			await page.unroute("**/api/favorites?**");
			expect(
				(
					await page.request.post("/api/favorites", {
						data: {
							kind: "food",
							targetId: String(food.fdcId),
							favorite: false,
						},
					})
				).ok(),
			).toBeTruthy();
			expect(
				(
					await page.request.post("/api/user-food-lists/fridge", {
						data: { food, allowMove: true },
					})
				).ok(),
			).toBeTruthy();
		}
	},
);

test(
	"recipe favorites persist, filter and roll back failed persistence",
	{ tag: "@compatibility" },
	async ({ page, isMobile, unexpectedBrowserErrors }, testInfo) => {
		await page.goto("/saved");
		await waitForAppReady(page);
		const card = page
			.locator(".saved-recipe-card")
			.filter({ has: page.getByText("QA Morning Green", { exact: true }) });
		const recipeId = await card.getAttribute("aria-labelledby");
		expect(recipeId).toBeTruthy();
		const id = recipeId!.replace(/^saved-recipe-/, "").replace(/-title$/, "");
		await page.request.post("/api/favorites", {
			data: { kind: "recipe", targetId: id, favorite: false },
		});
		try {
			await page.reload();
			await waitForAppReady(page);
			await card.locator("summary").first().click();
			const favorite = card.getByRole("button", {
				name: "Favorite: QA Morning Green",
				exact: true,
			});
			if (isMobile) await favorite.tap();
			else await favorite.click();
			const remove = card.getByRole("button", {
				name: "Remove favorite: QA Morning Green",
				exact: true,
			});
			await expect(remove).toBeEnabled();
			await expect(card.locator("details").first()).toHaveAttribute("open", "");
			await expect(remove).toHaveAttribute("aria-pressed", "true");
			await page.reload();
			await waitForAppReady(page);
			await card.locator("summary").first().click();
			await expect(remove).toHaveAttribute("aria-pressed", "true");
			await page
				.getByRole("button", {
					name: "Filter and sort saved recipes",
					exact: true,
				})
				.click();
			await page
				.getByRole("button", { name: "Favorites only", exact: true })
				.click();
			await page.getByRole("button", { name: "Apply", exact: true }).click();
			await expect(page.locator(".saved-recipe-card")).toHaveCount(1);
			if (!(await card.locator("details").first().getAttribute("open")))
				await card.locator("summary").first().click();
			await page.route("**/api/favorites", async (route) => {
				if (route.request().method() === "POST")
					await route.fulfill({
						status: 409,
						contentType: "application/json",
						body: '{"error":"synthetic persistence refusal"}',
					});
				else await route.continue();
			});
			await remove.click();
			await expect(card.getByRole("alert")).toHaveText(
				"Favorite could not be saved. Try again.",
			);
			await expect(remove).toHaveAttribute("aria-pressed", "true");
			// The sole injected 409 may emit the browser's standard resource diagnostic.
			for (const error of unexpectedBrowserErrors)
				expect(error).toMatch(/^console\.error:.*409/);
			unexpectedBrowserErrors.splice(0);
			await page.unroute("**/api/favorites");
			await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
			await page
				.locator("html")
				.evaluate((element) => element.setAttribute("data-theme", "dark"));
			await remove.focus();
			// Establish keyboard modality, then focus the control without assuming Tab traversal settings.
			await page.keyboard.press("Tab");
			await remove.focus();
			await expect(remove).toBeFocused();
			await expect(remove).toHaveJSProperty("tabIndex", 0);
			expect(
				await remove.evaluate((element) => element.matches(":focus-visible")),
			).toBe(true);
			const bounds = await remove.boundingBox();
			expect(bounds!.width).toBeGreaterThanOrEqual(24);
			expect(bounds!.height).toBeGreaterThanOrEqual(24);
			await page.screenshot({
				path: testInfo.outputPath("favorites-recipe-dark-focus.png"),
			});
			await remove.press("Space");
			await expect(page.locator(".saved-recipe-card")).toHaveCount(0);
		} finally {
			await page.unroute("**/api/favorites");
			expect(
				(
					await page.request.post("/api/favorites", {
						data: { kind: "recipe", targetId: id, favorite: false },
					})
				).ok(),
			).toBeTruthy();
		}
	},
);
