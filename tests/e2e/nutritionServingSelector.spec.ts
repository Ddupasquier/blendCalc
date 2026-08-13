import type { Locator, Page } from "@playwright/test";
import { expect, test, waitForAppReady } from "./support/browserTest";

const strawberryJellyFoodId = 9100001;
const expectedDesktopSpacingPixels = 12;
const expectedCompactSpacingPixels = 8;

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
	const [amountBox, servingContainerBox, servingTriggerBox] = await Promise.all([
		readElementBox(amountSection),
		readElementBox(servingContainer),
		readElementBox(servingTrigger),
	]);
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
			servingTriggerBox.y -
				(servingContainerBox.y + spacing.paddingTopPixels),
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
	const caloriesRow = page.locator(".nf-row").filter({ hasText: "CALORIES" }).first();

	await expect(amountSection.locator("strong")).toHaveText("20g");
	await expect(servingTrigger).toContainText("1 tbsp (20 g) · 20g");
	await expect(caloriesRow).toContainText("50");

	await servingTrigger.click();
	await page.getByRole("option", { name: "100g standard" }).click();
	await expect(amountSection.locator("strong")).toHaveText("100g");
	await expect(caloriesRow).toContainText("250");
	await expect(page.getByText("Per 100g food data")).toBeVisible();

	await servingTrigger.click();
	await page
		.getByRole("option", { name: /^1 tbsp \(20 g\) · 20g/ })
		.click();
	await expect(amountSection.locator("strong")).toHaveText("20g");
	await expect(caloriesRow).toContainText("50");
	await expect(page.getByText("1 tbsp (20g)", { exact: true })).toBeVisible();
});
