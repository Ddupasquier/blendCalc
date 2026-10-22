import { expect, test, waitForAppReady } from "./support/browserTest";

test.use({
	storageState: { cookies: [], origins: [] },
	contextOptions: { reducedMotion: "reduce" },
});

test("@mobile @compatibility guests explore sample nutrition and reset a temporary Mix", async ({
	page,
}) => {
	const forbiddenRequests: string[] = [];
	page.on("request", (request) => {
		if (
			/\/api\/|supabase\.co|googlesyndication|doubleclick/.test(request.url())
		)
			forbiddenRequests.push(request.url());
	});
	await page.goto("/demo");
	await waitForAppReady(page);
	await expect(
		page.getByRole("heading", { name: "Try a Mix. No account needed." }),
	).toBeVisible();
	await expect(page.getByRole("status")).toContainText("325 grams, 508 kcal");
	const oats = page.getByLabel("Rolled oats amount (g)");
	await oats.fill("50");
	await expect(page.getByRole("status")).toContainText("275 grams, 318 kcal");
	await oats.fill("");
	await expect(page.getByRole("status")).toContainText("Totals paused");
	await oats.fill("1001");
	await expect(page.getByRole("status")).toContainText("Totals paused");
	await oats.fill("0");
	await page.getByLabel("Plain yogurt amount (g)").fill("0");
	await page.getByLabel("Berries amount (g)").fill("0");
	await expect(
		page.getByText("Your Mix is empty.", { exact: false }),
	).toBeVisible();
	await page.getByRole("button", { name: "Load example recipe" }).click();
	await expect(oats).toHaveValue("100");
	await expect(page.getByRole("status")).toContainText("Breakfast bowl loaded");
	await page
		.getByText("Sample nutrition per 100 g", { exact: true })
		.first()
		.click();
	await expect(
		page.getByText("Oats may contain gluten.", { exact: false }),
	).toBeVisible();
	await page.reload();
	await waitForAppReady(page);
	await expect(oats).toHaveValue("100");
	expect(forbiddenRequests).toEqual([]);
	const response = await page.request.get("/demo");
	const html = await response.text();
	expect(response.status()).toBe(200);
	expect(html).toContain("Rolled oats");
	expect(html).toContain("Sample nutrition per 100 g");
	expect(html).toContain('content="index,follow,max-image-preview:large"');
	await expect(page).toHaveTitle("Try the Demo · blendCalc");
	for (const colorScheme of ["light", "dark"] as const) {
		await page.emulateMedia({ colorScheme });
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		await page.screenshot({
			path: `test-results/DEV-055/demo-${test.info().project.name}-${colorScheme}.png`,
			fullPage: true,
			animations: "disabled",
		});
	}
	await oats.focus();
	await expect(oats).toBeFocused();
	expect(
		await oats.evaluate((element) => getComputedStyle(element).outlineStyle),
	).not.toBe("none");
});

test("@mobile @compatibility the public landing links demo, support and account access", async ({
	page,
}) => {
	await page.goto("/");
	await waitForAppReady(page);
	await expect(
		page.getByRole("heading", { name: "What’s in the food you make?" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Support on Buy Me a Coffee" }),
	).toHaveAttribute("href", "https://buymeacoffee.com/dylandupasquier");
	for (const colorScheme of ["light", "dark"] as const) {
		await page.emulateMedia({ colorScheme });
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		await page.screenshot({
			path: `test-results/DEV-055/landing-${test.info().project.name}-${colorScheme}.png`,
			fullPage: true,
			animations: "disabled",
		});
	}
	if (test.info().project.name === "desktop-chromium") {
		const original = page.viewportSize()!;
		await page.emulateMedia({ colorScheme: "light" });
		for (const width of [970, 600]) {
			await page.setViewportSize({ width, height: 900 });
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			).toBe(true);
			await page.screenshot({
				path: `test-results/DEV-055/landing-width-${width}.png`,
				fullPage: true,
				animations: "disabled",
			});
		}
		await page.setViewportSize(original);
	}
	await page
		.getByRole("link", { name: "Try the demo", exact: true })
		.first()
		.click();
	await expect(page).toHaveURL(/\/demo$/);
	await page.getByRole("link", { name: "Sign in to build and save" }).click();
	await expect(page).toHaveURL(/\/auth\?next=%2Fmix$/);
	const protectedResponse = await page.request.get("/ingredients/fridge", {
		maxRedirects: 0,
	});
	expect(protectedResponse.status()).toBe(303);
	const nestedResponse = await page.request.get("/demo/private", {
		maxRedirects: 0,
	});
	expect(nestedResponse.status()).toBe(404);
});
