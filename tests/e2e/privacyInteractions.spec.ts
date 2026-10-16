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
