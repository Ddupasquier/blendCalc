import type { Json } from "$lib/types/database.types";
import { expect, test, waitForAppReady } from "./support/browserTest";
import { getAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";

type IngredientDeletionKeyboardCase = {
	confirmationKey: "Enter" | "Space";
	listLabel: "Fridge" | "Shopping List";
	listType: "fridge" | "shopping";
	route: "/ingredients/fridge" | "/ingredients/shopping";
};

const keyboardCases: IngredientDeletionKeyboardCase[] = [
	{
		confirmationKey: "Enter",
		listLabel: "Fridge",
		listType: "fridge",
		route: "/ingredients/fridge",
	},
	{
		confirmationKey: "Space",
		listLabel: "Shopping List",
		listType: "shopping",
		route: "/ingredients/shopping",
	},
];

test(
	"the inline delete confirmation preserves the right edge while revealing the product image",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		test.skip(
			!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
			"Deterministic Chromium projects own the responsive confirmation geometry matrix.",
		);

		const scenario = testInfo.project.name.startsWith("mobile-")
			? {
					viewport: { width: 390, height: 844 },
					theme: "light" as const,
				}
			: {
					viewport: { width: 1280, height: 800 },
					theme: "dark" as const,
				};
		for (const { viewport, theme } of [scenario]) {
			await page.setViewportSize(viewport);
			await page.goto("/ingredients/fridge");
			await waitForAppReady(page);
			await page.evaluate((selectedTheme) => {
				document.documentElement.dataset.theme = selectedTheme;
			}, theme);

			const listItems = page.locator("li[data-food-id]");
			expect(await listItems.count()).toBeGreaterThan(0);
			const card = listItems.first().locator(".saved-ingredient-card");
			const foodName = await card.locator("strong").innerText();
			await card
				.getByRole("button", {
					name: `Remove ${foodName}`,
					exact: true,
				})
				.click();

			const message = card.getByRole("status");
			await expect(message).toBeVisible();
			const [cardBounds, mediaBounds, messageBounds] = await Promise.all([
				card.boundingBox(),
				card.locator(".ingredient-card-media-lane").boundingBox(),
				message.boundingBox(),
			]);
			expect(cardBounds).not.toBeNull();
			expect(mediaBounds).not.toBeNull();
			expect(messageBounds).not.toBeNull();

			const messageRight = messageBounds!.x + messageBounds!.width;
			const cardRight = cardBounds!.x + cardBounds!.width;
			const intrinsicMessageSizing = await message.evaluate((element) => {
				const styles = window.getComputedStyle(element);
				const textRange = document.createRange();
				textRange.selectNodeContents(element);
				return {
					actualWidth: element.getBoundingClientRect().width,
					contentWidth: textRange.getBoundingClientRect().width,
					paddingWidth:
						Number.parseFloat(styles.paddingInlineStart) +
						Number.parseFloat(styles.paddingInlineEnd),
				};
			});
			expect(cardRight - messageRight).toBeGreaterThanOrEqual(8);
			expect(cardRight - messageRight).toBeLessThanOrEqual(24);
			expect(
				Math.abs(
					intrinsicMessageSizing.actualWidth -
						(intrinsicMessageSizing.contentWidth +
							intrinsicMessageSizing.paddingWidth),
				),
			).toBeLessThanOrEqual(2);
			expect(messageBounds!.x).toBeGreaterThan(
				mediaBounds!.x + mediaBounds!.width * 0.45,
			);
			expect(messageBounds!.width).toBeLessThan(cardBounds!.width * 0.8);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth),
			).toBeLessThanOrEqual(viewport.width);
		}
	},
);

const readSavedIngredientRecord = async (
	parallelWorkerIndex: number,
	listType: IngredientDeletionKeyboardCase["listType"],
	foodId: number,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const { data, error } = await supabase
		.from("user_food_list_items")
		.select("food")
		.eq("list_type", listType)
		.eq("fdc_id", foodId)
		.maybeSingle();
	if (error) throw error;
	return data?.food ?? null;
};

const restoreSavedIngredientRecord = async (
	parallelWorkerIndex: number,
	listType: IngredientDeletionKeyboardCase["listType"],
	food: Json,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const { error } = await supabase.rpc("place_user_food_list_items", {
		p_foods: [food],
		p_list_type: listType,
	});
	if (error) throw error;
};

for (const keyboardCase of keyboardCases) {
	test(`${keyboardCase.confirmationKey} completes two-step deletion from ${keyboardCase.listLabel}`, async ({
		page,
	}, testInfo) => {
		test.skip(
			testInfo.project.name.startsWith("mobile-"),
			"Hardware-keyboard behavior is verified in the configured desktop browser engines.",
		);

		let savedFood: Json | null = null;
		let foodId: number | null = null;

		try {
			await page.goto(keyboardCase.route);
			await waitForAppReady(page);

			const firstListItem = page.locator("li[data-food-id]").first();
			foodId = Number(await firstListItem.getAttribute("data-food-id"));
			expect(Number.isSafeInteger(foodId)).toBe(true);
			savedFood = await readSavedIngredientRecord(
				testInfo.parallelIndex,
				keyboardCase.listType,
				foodId,
			);
			expect(savedFood).not.toBeNull();

			const foodName = await firstListItem.locator("strong").innerText();
			await page
				.getByRole("button", {
					name: `Open actions for ${foodName}`,
					exact: true,
				})
				.click();
			await expect(page).toHaveURL(
				new RegExp(`${keyboardCase.route}/actions/${foodId}$`),
			);

			const removeButton = page.getByRole("button", {
				name: `Remove from ${keyboardCase.listLabel}`,
			});
			await removeButton.focus();
			await expect(removeButton).toBeFocused();
			await page.keyboard.press(keyboardCase.confirmationKey);

			const confirmButton = page.getByRole("button", {
				name: `Tap again: Remove from ${keyboardCase.listLabel}`,
			});
			await expect(confirmButton).toBeFocused();
			await expect(
				page.getByText("Tap or click delete again to confirm."),
			).toBeVisible();
			await expect(page).toHaveURL(
				new RegExp(`${keyboardCase.route}/actions/${foodId}$`),
			);
			expect(
				await readSavedIngredientRecord(
					testInfo.parallelIndex,
					keyboardCase.listType,
					foodId,
				),
			).not.toBeNull();

			await page.keyboard.press(keyboardCase.confirmationKey);
			await expect(page).toHaveURL(new RegExp(`${keyboardCase.route}$`));
			await expect(page.locator(`li[data-food-id="${foodId}"]`)).toHaveCount(0);
			await expect
				.poll(() =>
					readSavedIngredientRecord(
						testInfo.parallelIndex,
						keyboardCase.listType,
						foodId!,
					),
				)
				.toBeNull();
		} finally {
			if (savedFood) {
				await restoreSavedIngredientRecord(
					testInfo.parallelIndex,
					keyboardCase.listType,
					savedFood,
				);
			}
		}
	});
}
