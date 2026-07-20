import { describe, expect, it } from "vitest";
import {
	getFoodDisplayCategory,
	getIngredientMembershipLabel,
} from "$lib/utils/ingredients/ingredientListUi";

describe("ingredient list UI helpers", () => {
	it("formats saved-list membership status for nutrition details", () => {
		expect(
			getIngredientMembershipLabel({
				inFridge: false,
				inShoppingList: false,
			}),
		).toBe("");
		expect(
			getIngredientMembershipLabel({
				inFridge: true,
				inShoppingList: false,
			}),
		).toBe("Already in Fridge");
		expect(
			getIngredientMembershipLabel({
				inFridge: false,
				inShoppingList: true,
			}),
		).toBe("Already in Shopping List");
		expect(
			getIngredientMembershipLabel({
				inFridge: true,
				inShoppingList: true,
			}),
		).toBe("Already in Fridge and Shopping List");
	});

	it("uses the canonical category instead of the legacy custom placeholder", () => {
		expect(
			getFoodDisplayCategory({
				fdcId: -1,
				description: "Strawberry jelly",
				foodCategory: "Custom Ingredient",
				categories: ["Jams"],
				customFood: true,
				foodNutrients: [],
			}),
		).toBe("Jams");
	});
});
