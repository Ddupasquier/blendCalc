import { expect, test } from "@playwright/test";

test(
	"privacy choice follows cross-tab updates and clearing",
	{ tag: "@compatibility" },
	async ({ page, context }) => {
		await page.goto("/privacy");
		const other = await context.newPage();
		await other.goto("/privacy");
		const currentBlock = page.getByRole("switch", {
			name: "Block advertising on this browser",
		});
		const otherBlock = other.getByRole("switch", {
			name: "Block advertising on this browser",
		});
		await expect(currentBlock).toBeEnabled();
		await expect(otherBlock).toBeEnabled();
		await currentBlock.check();
		await expect(otherBlock).toBeChecked();
		await other.evaluate(() => localStorage.clear());
		await expect(currentBlock).not.toBeChecked();
	},
);

test(
	"privacy dark layout supports enlarged text and keyboard choices",
	{ tag: "@compatibility" },
	async ({ page }, testInfo) => {
		await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
		await page.goto("/privacy");
		await page.evaluate(() => {
			document.documentElement.style.fontSize = "200%";
		});
		const block = page.getByRole("switch", {
			name: "Block advertising on this browser",
		});
		await expect(block).toBeEnabled();
		await block.focus();
		await page.keyboard.press("Space");
		await expect(block).toBeChecked();
		await page.keyboard.press("Space");
		await expect(block).not.toBeChecked();
		const advertisingWordLines = await page
			.locator(".advertising-privacy-choices__label")
			.evaluate((label) => {
				const text = label.firstChild!;
				const start = text.textContent!.indexOf("advertising");
				const range = document.createRange();
				range.setStart(text, start);
				range.setEnd(text, start + "advertising".length);
				return range.getClientRects().length;
			});
		expect(advertisingWordLines).toBe(1);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		await page.screenshot({
			path: testInfo.outputPath("privacy-dark-enlarged-text.png"),
		});
	},
);

test(
	"privacy is public, linked from landing and preserves a browser refusal",
	{ tag: "@compatibility" },
	async ({ page }) => {
		const requests: string[] = [];
		page.on("request", (request) => requests.push(request.url()));
		await page.goto("/");
		await page
			.getByRole("link", { name: "Privacy & advertising", exact: true })
			.click();
		await expect(page).toHaveURL(/\/privacy$/);
		await expect(page).toHaveTitle("Privacy & Advertising · blendCalc");
		await expect(
			page.getByRole("heading", { name: "Privacy & advertising", exact: true }),
		).toBeVisible();
		const block = page.getByRole("switch", {
			name: "Block advertising on this browser",
		});
		await expect(block).toBeEnabled();
		await expect(block).not.toBeChecked();
		await block.check();
		await expect(block).toBeChecked();
		await block.uncheck();
		await expect(block).not.toBeChecked();
		await expect(page.getByRole("status")).toContainText(
			"saved on this browser",
		);
		await page.reload();
		await expect(block).not.toBeChecked();
		await block.check();
		await page.reload();
		await expect(block).toBeChecked();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		expect(
			requests.filter((url) =>
				/googlesyndication|doubleclick|fundingchoices/.test(url),
			),
		).toEqual([]);
		await page.goto("/ingredients/fridge");
		await expect(page).toHaveURL(/\/\?next=%2Fingredients%2Ffridge$/);
	},
);

test(
	"storage failure keeps the advertising block enabled",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem("blendcalc-advertising-block-v1", "blocked");
			Storage.prototype.setItem = () => {
				throw new Error("Synthetic storage failure");
			};
		});
		await page.goto("/privacy");
		const block = page.getByRole("switch", {
			name: "Block advertising on this browser",
		});
		await expect(block).toBeEnabled();
		await block.click();
		await expect(block).toBeChecked();
		await expect(page.getByRole("status")).toContainText("couldn't save");
	},
);

test(
	"browser privacy signal overrides an earlier consent-request preference",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem(
				"blendcalc-advertising-block-v1",
				"allow-consent-request",
			);
			Object.defineProperty(navigator, "globalPrivacyControl", {
				value: true,
				configurable: true,
			});
		});
		await page.goto("/privacy");
		const block = page.getByRole("switch", {
			name: "Block advertising on this browser",
		});
		await expect(block).toBeChecked();
		await expect(block).toBeDisabled();
		await expect(
			page.getByText(
				"Your browser's Global Privacy Control signal keeps advertising blocked.",
			),
		).toBeVisible();
	},
);

test(
	"consumer terms are public, linked and readable across policy pages",
	{ tag: ["@smoke", "@compatibility"] },
	async ({ page }, testInfo) => {
		const providerRequests: string[] = [];
		page.on("request", (request) => {
			if (/googlesyndication|doubleclick|fundingchoices/.test(request.url()))
				providerRequests.push(request.url());
		});
		await page.goto("/");
		const termsLink = page.getByRole("link", {
			name: "Terms of service",
			exact: true,
		});
		await termsLink.focus();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/terms$/);
		await expect(page).toHaveTitle("Terms of Service · blendCalc");
		await expect(
			page.getByRole("heading", { name: "Terms of service", exact: true }),
		).toBeVisible();
		await expect(page.locator("article")).toContainText(
			"ModernCraft LLC, Oregon",
		);
		await expect(page.locator("article")).not.toContainText("[REVIEW");
		await expect(
			page.getByRole("navigation", { name: "Terms sections" }),
		).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath("terms-light.png") });
		await page
			.getByRole("link", { name: "Food information and safety", exact: true })
			.click();
		await expect(page).toHaveURL(/\/terms#food-information$/);
		await expect(
			page.getByRole("heading", {
				name: "Food information and safety",
				exact: true,
			}),
		).toBeInViewport();
		await page.reload();
		await expect(
			page.getByRole("heading", {
				name: "Food information and safety",
				exact: true,
			}),
		).toBeVisible();
		await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
		await page.evaluate(() => {
			document.documentElement.style.fontSize = "200%";
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		for (const width of [320, 390, 768, 1280]) {
			await page.setViewportSize({ width, height: 844 });
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			).toBe(true);
		}
		await page.setViewportSize({ width: 390, height: 844 });
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			path: testInfo.outputPath("terms-compact-dark-enlarged.png"),
		});
		await page
			.getByRole("link", { name: "Privacy & advertising", exact: true })
			.click();
		await expect(page).toHaveURL(/\/privacy$/);
		await expect(page.locator("article")).toContainText(
			"ModernCraft LLC, Oregon",
		);
		await expect(page.locator("article")).toContainText(
			"blendCalc and other websites",
		);
		await expect(
			page.getByRole("switch", { name: "Block advertising on this browser" }),
		).toBeEnabled();
		await page.screenshot({
			path: testInfo.outputPath("public-policy-dark-enlarged.png"),
			fullPage: true,
		});
		expect(providerRequests).toEqual([]);
		await page.goto("/saved");
		await expect(page).toHaveURL(/\/\?next=%2Fsaved$/);
	},
);
