import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { documentationPages } from "../../../config/documentation/navigation.mjs";

const assertNoOverflow = async (page: Page) => {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
};

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (message) => {
		if (["error", "warning"].includes(message.type()))
			errors.push(message.text());
	});
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("response", (response) => {
		if (response.status() >= 500)
			errors.push(`${response.status()}: ${response.url()}`);
	});
	await page.goto("./");
	await page.evaluate(() => document.fonts.ready);
	await page.exposeFunction("documentationErrors", () => errors);
});

test.afterEach(async ({ page }) => {
	const errors = await page.evaluate(async () =>
		(
			window as unknown as { documentationErrors: () => Promise<string[]> }
		).documentationErrors(),
	);
	expect(errors).toEqual([]);
});

test("themes, navigation, search, copying and focus work at the intended viewport", async ({
	page,
}, testInfo) => {
	await expect(
		page.getByRole("heading", { name: /BlendCalc.*well documented/ }),
	).toBeVisible();
	await assertNoOverflow(page);
	const compact = (testInfo.project.use.viewport?.width ?? 1440) < 1024;
	// WebKit's screenshot helper injects `body {}`; keep the site's strict CSP intact.
	if (!testInfo.project.name.includes("webkit"))
		await page.screenshot({
			path: testInfo.outputPath("home-light.png"),
			fullPage: true,
		});
	if (compact) {
		await page.getByRole("button", { name: "Open documentation menu" }).click();
		const drawer = page.getByRole("dialog", { name: "Documentation menu" });
		await expect(drawer).toBeVisible();
		await expect(
			drawer.getByRole("heading", { name: "For developers" }),
		).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(drawer).not.toBeVisible();
		await expect(
			page.getByRole("button", { name: "Open documentation menu" }),
		).toBeFocused();
		await page.getByRole("button", { name: "Open documentation menu" }).click();
		await drawer
			.getByRole("link", { name: "Using BlendCalc", exact: true })
			.click();
		await page.waitForURL("**/user/", { waitUntil: "load" });
		await expect(drawer).not.toBeVisible();
		await page.goto("./");
	}
	await page.getByRole("button", { name: /Color theme:/ }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await page.getByRole("button", { name: /Color theme:/ }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
		"content",
		"#11141c",
	);
	await assertNoOverflow(page);
	if (!testInfo.project.name.includes("webkit"))
		await page.screenshot({
			path: testInfo.outputPath("home-dark.png"),
			fullPage: true,
		});

	await page.keyboard.press("Control+k");
	const search = page.getByRole("dialog", { name: "Search documentation" });
	await search.getByRole("searchbox").fill("serving");
	await expect(search.locator(".search-result").first()).toBeVisible();
	await search.getByRole("searchbox").fill("xyznotarealword123");
	await expect(search.getByRole("status")).toContainText("No results");
	await search.getByRole("searchbox").fill("nutrition");
	await expect(search.locator(".search-result").first()).toBeVisible();
	await page.keyboard.press("ArrowDown");
	await expect(search.locator(".search-result").first()).toBeFocused();
	await page.keyboard.press("Enter");
	await page.waitForURL(/\/blendCalc\/.+/, { waitUntil: "load" });
	await expect(search).not.toBeVisible();
	await expect(page).toHaveURL(/\/blendCalc\/.+/);

	await page.goto("./");
	// Native clipboard observation where Playwright can grant the browser permission.
	if (
		["docs-chromium", "docs-mobile-chromium", "docs-tablet"].includes(
			testInfo.project.name,
		)
	) {
		await page
			.context()
			.grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.getByRole("button", { name: "Copy setup command" }).click();
		await expect(
			page.getByRole("button", { name: "Copy setup command" }),
		).toHaveText("Copied!");
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			"nvm use 24\nnpm ci --ignore-scripts",
		);
		await page.reload();
	}
	// Explicitly exercise the non-permission fallback in isolated test contexts.
	await page.evaluate(() =>
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		}),
	);
	await page.getByRole("button", { name: "Copy setup command" }).click();
	await expect(
		page.getByText("Copy isn’t available here.", { exact: false }),
	).toBeVisible();
	expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
		"nvm use 24\nnpm ci --ignore-scripts",
	);

	await page
		.locator(".hero-actions")
		.getByRole("link", { name: "Get started", exact: true })
		.click();
	await page.waitForURL("**/user/", { waitUntil: "load" });
	await expect(
		page.getByRole("heading", { name: "Using BlendCalc", exact: true }),
	).toBeVisible();
	await page
		.getByRole("navigation", { name: "On this page" })
		.getByRole("link", { name: "Ingredients", exact: true })
		.click();
	await expect(page).toHaveURL(/#ingredients$/);
	await assertNoOverflow(page);
	if (!testInfo.project.name.includes("webkit"))
		await page.screenshot({
			path: testInfo.outputPath("guide-dark.png"),
			fullPage: true,
		});
});

test("every page and original direct link renders without overflow", async ({
	page,
}) => {
	for (const document of documentationPages) {
		await page.goto(`./${document.route}`);
		await expect(page.locator("article")).toBeVisible();
		await assertNoOverflow(page);
	}
	await page.goto("./docs/user/README.md#ingredients");
	await expect(page.locator("#ingredients")).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Using BlendCalc", exact: true }),
	).toBeVisible();
});

test("preview tolerates bounded accumulated localhost headers without using cookies", async ({
	request,
}) => {
	const response = await request.get("./", {
		headers: { Cookie: `docs-fixture=${"x".repeat(24_000)}` },
	});
	expect(response.status()).toBe(200);
	expect(response.headers()["set-cookie"]).toBeUndefined();
	const refused = await request.get("./", {
		headers: { Cookie: `docs-fixture=${"x".repeat(75_000)}` },
	});
	expect(refused.status()).toBe(431);
});

test("light and dark accessibility, text zoom and reduced motion", async ({
	page,
}) => {
	for (const theme of ["light", "dark"]) {
		await page.getByRole("button", { name: /Color theme:/ }).click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
		const result = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
			.analyze();
		expect(result.violations).toEqual([]);
		await assertNoOverflow(page);
	}
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "32px";
	});
	await assertNoOverflow(page);
	await expect(
		page
			.locator(".hero-actions")
			.getByRole("link", { name: "Get started", exact: true }),
	).toBeVisible();
});
