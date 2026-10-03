import type { Locator, Page } from "@playwright/test";
import { expect, test, waitForAppReady } from "./support/browserTest";

const strawberryJellyFoodId = 9100001;
const expectedDesktopSpacingPixels = 12;
const expectedCompactSpacingPixels = 8;
const viewingModeLabel = "Adjust viewing amount by";

const expectCompactViewingMode = async (page: Page) => {
	const amount = page.getByRole("region", { name: "Viewing amount" });
	const toggle = amount.getByRole("tablist", { name: viewingModeLabel });
	// Measure the complete layout in one frame, including after text-size changes.
	await expect
		.poll(() =>
			amount.evaluate((element) => {
				const amountBox = element.getBoundingClientRect();
				const headingBox = element.querySelector("h2")!.getBoundingClientRect();
				const toggleBox = element
					.querySelector('[role="tablist"]')!
					.getBoundingClientRect();
				const controlsBox = element
					.querySelector(".nutrition-detail-view__amount-controls")!
					.getBoundingClientRect();
				return {
					compact: toggleBox.width < amountBox.width - 16,
					rightAligned: Math.abs(toggleBox.right - amountBox.right) <= 1,
					separated:
						headingBox.right <= toggleBox.left - 7 ||
						headingBox.bottom <= toggleBox.top - 7,
					controlsBelow: controlsBox.top >= toggleBox.bottom + 7,
					controlsContained:
						controlsBox.left >= amountBox.left - 1 &&
						controlsBox.right <= amountBox.right + 1,
				};
			}),
		)
		.toEqual({
			compact: true,
			rightAligned: true,
			separated: true,
			controlsBelow: true,
			controlsContained: true,
		});

	for (const name of ["Weight", "Servings"]) {
		const tab = toggle.getByRole("tab", { name, exact: true });
		const box = await readElementBox(tab);
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		const label = await tab.locator("span").evaluate((element) => ({
			clipped: element.scrollWidth > element.clientWidth + 1,
			wrap: getComputedStyle(element).whiteSpace,
		}));
		expect(label).toEqual({ clipped: false, wrap: "nowrap" });
		// Read the button and label in one frame, after text-size/route layout settles.
		await expect
			.poll(() =>
				tab.evaluate((element) => {
					const styles = getComputedStyle(element);
					const labelWidth = element
						.querySelector("span")!
						.getBoundingClientRect().width;
					const intrinsicWidth = Math.max(
						Number.parseFloat(styles.minWidth),
						labelWidth +
							Number.parseFloat(styles.paddingLeft) +
							Number.parseFloat(styles.paddingRight),
					);
					return Math.abs(
						element.getBoundingClientRect().width - intrinsicWidth,
					);
				}),
			)
			.toBeLessThanOrEqual(1);
		await expect(tab).toHaveCSS("transition-property", "none");
	}
	const selected = toggle.getByRole("tab", { selected: true });
	const unselected = toggle.getByRole("tab", { selected: false });
	const background = async (tab: Locator) =>
		tab.evaluate((element) => getComputedStyle(element).backgroundColor);
	expect(await background(selected)).not.toBe(await background(unselected));
	await expect(toggle.locator(".segmented-control__selection")).toHaveCount(0);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth + 1,
		),
	).toBe(true);
};

for (const width of [320, 390, 1024]) {
	for (const theme of ["light", "dark"] as const) {
		test(
			`compact viewing switch fits ${width}px ${theme} with short/wrapped names and enlarged text`,
			{ tag: "@compatibility" },
			async ({ page }, testInfo) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({
					colorScheme: theme,
					reducedMotion: "reduce",
				});
				for (const foodId of [9100006, 2032704]) {
					await page.goto(`/ingredients/fridge/nutrition/${foodId}`);
					await waitForAppReady(page);
					await page.evaluate(() => document.fonts.ready);
					await page.evaluate((value) => {
						document.documentElement.dataset.theme = value;
					}, theme);
					for (const textSize of [100, 200]) {
						await page.addStyleTag({
							content: `html { font-size: ${textSize}% !important; }`,
						});
						await expectCompactViewingMode(page);
						const servings = page.getByRole("tab", {
							name: "Servings",
							exact: true,
						});
						await servings.click();
						await expectCompactViewingMode(page);
						await page
							.getByRole("tab", { name: "Weight", exact: true })
							.click();
						if (
							testInfo.project.name === "desktop-chromium" &&
							foodId === 2032704
						) {
							await page
								.locator(".nutrition-detail-view .view-top")
								.screenshot({
									path: `test-results/nutrition-viewing-switch-${width}-${theme}-${textSize}.png`,
								});
						}
					}
				}
			},
		);
	}
}

test(
	"compact viewing switch retains keyboard/touch operation and nutrition amounts",
	{ tag: "@compatibility" },
	async ({ page, isMobile }) => {
		await page.goto(`/ingredients/fridge/nutrition/${strawberryJellyFoodId}`);
		await waitForAppReady(page);
		const amount = page.getByRole("region", { name: "Viewing amount" });
		const toggle = amount.getByRole("tablist", { name: viewingModeLabel });
		const weight = toggle.getByRole("tab", { name: "Weight", exact: true });
		const servings = toggle.getByRole("tab", { name: "Servings", exact: true });
		const calories = page
			.locator(".nf-row")
			.filter({ hasText: "CALORIES" })
			.first();
		await weight.focus();
		await weight.press("ArrowRight");
		await expect(servings).toBeFocused();
		await expect(servings).toHaveAttribute("aria-selected", "true");
		await expect(amount.locator("strong")).toHaveText("1 serving (1 tbsp)");
		await expect(servings).toHaveCSS("outline-style", "solid");
		await servings.press("Home");
		await expect(weight).toBeFocused();
		await weight.press("End");
		await expect(servings).toBeFocused();
		const increaseServing = amount.getByRole("button", {
			name: /Increase viewing amount by 1 serving/,
		});
		await increaseServing.click();
		await expect(amount.locator("strong")).toHaveText(/2 servings.*40g/);
		await expect(servings).toHaveAttribute("aria-selected", "true");
		await expect(calories).toContainText("100");
		if (isMobile) await weight.tap();
		else await weight.click();
		await expect(amount.locator("strong")).toHaveText("40g");
		await amount
			.getByRole("button", { name: /Increase viewing amount by 1g/ })
			.click();
		await expect(amount.locator("strong")).toHaveText("41g");
		await expect(weight).toHaveAttribute("aria-selected", "true");
		// The label keeps its existing whole-calorie presentation rounding.
		await expect(calories).toContainText("103");
		if (isMobile) await servings.tap();
		else await servings.click();
		await expect(amount.locator("strong")).toHaveText(/2 servings.*40g/);
		await expect(calories).toContainText("100");
	},
);

test(
	"viewing switch stays absent without an exact serving weight",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await page.goto("/ingredients/fridge/nutrition/9100005");
		await waitForAppReady(page);
		await expect(
			page.getByRole("heading", {
				name: "Blue Agave Light Golden Syrup",
				exact: true,
			}),
		).toBeVisible();
		await expect(
			page.getByRole("tablist", { name: viewingModeLabel }),
		).toHaveCount(0);
		await expect(
			page.getByRole("region", { name: "Viewing amount" }).locator("strong"),
		).toHaveText("100g");
	},
);

const readElementBox = async (element: Locator) => {
	const box = await element.boundingBox();
	expect(box).not.toBeNull();
	return box!;
};

const expectServingSelectorSpacing = async (
	page: Page,
	viewportWidth: number,
) => {
	await page.setViewportSize({ width: viewportWidth, height: 900 });
	await page.goto(`/ingredients/fridge/nutrition/${strawberryJellyFoodId}`);
	await waitForAppReady(page);

	const amountSection = page.getByRole("region", { name: "Viewing amount" });
	const servingContainer = page.locator(".nutrition-serving-select");
	const servingTrigger = page.getByRole("combobox", { name: "Serving" });
	const [amountBox, servingContainerBox, servingTriggerBox] = await Promise.all(
		[
			readElementBox(amountSection),
			readElementBox(servingContainer),
			readElementBox(servingTrigger),
		],
	);
	const spacing = await servingContainer.evaluate((element) => {
		const styles = window.getComputedStyle(element);
		return {
			borderBottomPixels: Number.parseFloat(styles.borderBottomWidth),
			paddingBottomPixels: Number.parseFloat(styles.paddingBottom),
			paddingTopPixels: Number.parseFloat(styles.paddingTop),
		};
	});
	const expectedSpacingPixels =
		viewportWidth <= 420
			? expectedCompactSpacingPixels
			: expectedDesktopSpacingPixels;

	expect(
		Math.abs(servingContainerBox.y - (amountBox.y + amountBox.height)),
	).toBeLessThanOrEqual(1);
	expect(spacing.paddingTopPixels).toBe(expectedSpacingPixels);
	expect(spacing.paddingBottomPixels).toBe(expectedSpacingPixels);
	expect(spacing.borderBottomPixels).toBe(2);
	expect(
		Math.abs(
			servingTriggerBox.y - (servingContainerBox.y + spacing.paddingTopPixels),
		),
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(
			servingContainerBox.y +
				servingContainerBox.height -
				spacing.borderBottomPixels -
				(servingTriggerBox.y + servingTriggerBox.height) -
				spacing.paddingBottomPixels,
		),
	).toBeLessThanOrEqual(1);
	expect(servingTriggerBox.x).toBeGreaterThan(amountBox.x);
	expect(servingTriggerBox.x + servingTriggerBox.width).toBeLessThanOrEqual(
		amountBox.x + amountBox.width + 1,
	);
	expect(servingTriggerBox.y).toBeGreaterThan(servingContainerBox.y);
	expect(servingTriggerBox.y + servingTriggerBox.height).toBeLessThan(
		servingContainerBox.y + servingContainerBox.height,
	);
};

test("serving selector keeps shared spacing at compact and desktop widths", async ({
	page,
}) => {
	for (const viewportWidth of [390, 500, 1024]) {
		await expectServingSelectorSpacing(page, viewportWidth);
	}
});

test("serving choices update the viewing amount and normalized nutrition values", async ({
	page,
}) => {
	await page.goto(`/ingredients/fridge/nutrition/${strawberryJellyFoodId}`);
	await waitForAppReady(page);

	const amountSection = page.getByRole("region", { name: "Viewing amount" });
	const servingTrigger = page.getByRole("combobox", { name: "Serving" });
	const caloriesRow = page
		.locator(".nf-row")
		.filter({ hasText: "CALORIES" })
		.first();

	await expect(amountSection.locator("strong")).toHaveText("20g");
	await expect(servingTrigger).toContainText("1 tbsp (20g) · Package label");
	await expect(caloriesRow).toContainText("50");

	await page.getByRole("tab", { name: "Servings" }).click();
	await expect(amountSection.locator("strong")).toHaveText(
		"1 serving (1 tbsp)",
	);
	await expect(caloriesRow).toContainText("50");

	await page.getByRole("tab", { name: "Weight" }).click();
	await expect(amountSection.locator("strong")).toHaveText("20g");

	await servingTrigger.click();
	await page.getByRole("option", { name: "100g standard" }).click();
	await expect(amountSection.locator("strong")).toHaveText("100g");
	await expect(caloriesRow).toContainText("250");
	await expect(page.getByText("Per 100g food data")).toBeVisible();

	await servingTrigger.click();
	await page
		.getByRole("option", { name: "1 tbsp (20g) · Package label" })
		.click();
	await expect(amountSection.locator("strong")).toHaveText("20g");
	await expect(caloriesRow).toContainText("50");
	await page.getByRole("tab", { name: "Servings" }).click();
	await expect(amountSection.locator("strong")).toHaveText(
		"1 serving (1 tbsp)",
	);
	await expect(
		page.locator(".nf-label").getByText("1 tbsp (20g)", { exact: true }),
	).toBeVisible();
});
