import type { Json } from "$lib/types/database.types";
import {
	expect,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { createAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";

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

const readSavedIngredientRecord = async (
	parallelWorkerIndex: number,
	listType: IngredientDeletionKeyboardCase["listType"],
	foodId: number,
) => {
	const supabase =
		await createAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	try {
		const { data, error } = await supabase
			.from("user_food_list_items")
			.select("food")
			.eq("list_type", listType)
			.eq("fdc_id", foodId)
			.maybeSingle();
		if (error) throw error;
		return data?.food ?? null;
	} finally {
		await supabase.auth.signOut({ scope: "local" });
	}
};

const restoreSavedIngredientRecord = async (
	parallelWorkerIndex: number,
	listType: IngredientDeletionKeyboardCase["listType"],
	food: Json,
) => {
	const supabase =
		await createAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	try {
		const { error } = await supabase.rpc("place_user_food_list_items", {
			p_foods: [food],
			p_list_type: listType,
		});
		if (error) throw error;
	} finally {
		await supabase.auth.signOut({ scope: "local" });
	}
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
				.getByRole("button", { name: `Open actions for ${foodName}` })
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
			await expect(
				page.locator(`li[data-food-id="${foodId}"]`),
			).toHaveCount(0);
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
