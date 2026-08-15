import { describe, expect, it } from "vitest";
import {
	getFoodCalories,
	getFoodDisplayCategory,
	getIngredientMembershipLabel,
	getPrimaryFoodWarning,
} from "$lib/utils/ingredients/ingredientListUi";

describe("ingredient list UI helpers", () => {
	it("keeps a reported zero-calorie value distinct from missing data", () => {
		expect(getFoodCalories({
			fdcId: 3,
			description: "Zero-calorie food",
			foodNutrients: [{
				nutrientId: 1008,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "KCAL",
				value: 0,
			}],
		})).toBe(0);
	});

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

	it("does not display a brand as a missing category", () => {
		expect(
			getFoodDisplayCategory({
				fdcId: 2,
				description: "Brand-only food",
				brandOwner: "Example Brand",
				foodNutrients: [],
			}),
		).toBe("Category unavailable");
	});

	it("prioritizes an active official recall over preference warnings", () => {
		expect(getPrimaryFoodWarning({
			fdcId: 9,
			description: "Recalled product",
			foodNutrients: [],
			preferenceWarnings: [{
				id: "preference-warning",
				level: "warning",
				category: "allergen",
				label: "milk",
				code: "FOOD_ALLERGEN_CONTAINS",
				params: {},
			}],
			safetyAlerts: [{
				id: "ea81b720-5e12-46a9-89cc-f6795aa68d08",
				providerKey: "open-fda-food-enforcement",
				sourceName: "openFDA Food Enforcement",
				sourceAttribution: "U.S. Food and Drug Administration",
				alertType: "recall",
				status: "Ongoing",
				productDescription: "Recalled product",
				sourceUrl: "https://api.fda.gov/food/enforcement.json",
				matchType: "exact_gtin",
				requiresPackageCheck: false,
				detectedAt: "2026-08-14T12:00:00.000Z",
			}],
		})).toBe("This product appears in an active official recall.");
	});
});
