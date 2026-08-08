import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SavedRecipeCard from "$lib/components/saved/SavedRecipeCard/SavedRecipeCard.svelte";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";

const food = (
	fdcId: number,
	description: string,
	foodNutrients: FoodItem["foodNutrients"] = [],
): FoodItem => ({ fdcId, description, foodNutrients });

const recipe: SavedRecipe = {
	id: "saved-1",
	name: "Morning Green",
	createdAt: new Date("2026-07-20T12:00:00Z").getTime(),
	foods: [
		food(1, "Banana", [
			{
				nutrientId: NUTRIENT_IDS.CALORIES,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "KCAL",
				value: 100,
			},
			{
				nutrientId: NUTRIENT_IDS.PROTEIN,
				nutrientName: "Protein",
				nutrientNumber: "203",
				unitName: "G",
				value: 5,
			},
		]),
		food(2, "Spinach"),
		food(3, "Greek Yogurt"),
		food(4, "Chia Seeds"),
		food(5, "Blueberries"),
		food(6, "Almond Milk"),
		food(7, "Flax Seeds"),
		food(8, "Mango"),
		food(9, "Pineapple"),
		food(10, "Ginger"),
	],
	selected: [NUTRIENT_IDS.CALORIES, NUTRIENT_IDS.PROTEIN],
	options: [
		{ id: NUTRIENT_IDS.CALORIES, label: "Calories" },
		{ id: NUTRIENT_IDS.PROTEIN, label: "Protein" },
	],
	nutrientGoals: {
    [NUTRIENT_IDS.CALORIES]: {
      nutrientId: NUTRIENT_IDS.CALORIES,
      goalType: "exact",
      targetAmount: 100,
      upperAmount: null,
      toleranceRatio: 0.1,
      importanceWeight: 1,
      sortOrder: 1,
    },
    [NUTRIENT_IDS.PROTEIN]: {
      nutrientId: NUTRIENT_IDS.PROTEIN,
      goalType: "minimum",
      targetAmount: 10,
      upperAmount: null,
      toleranceRatio: 0.1,
      importanceWeight: 1,
      sortOrder: 2,
	},
  },
  goalBasis: "per_mix",
	servingGrams: Object.fromEntries(
		Array.from({ length: 10 }, (_, index) => [index + 1, 100]),
	),
	servingQuantities: { 1: 1, 2: 0.5, 3: 170, 4: 1 },
	servingUnits: { 1: "item", 2: "cup", 3: "g", 4: "tbsp" },
};

describe("SavedRecipeCard", () => {
	beforeEach(() => {
		configureServingMeasureCatalog({
			options: [
				{
					value: "item",
					label: "Items",
					shortLabel: "item",
					dimension: "weight",
					conversionToBase: 1,
					isDefault: false,
				},
				{
					value: "cup",
					label: "Cups",
					shortLabel: "cup",
					dimension: "volume",
					conversionToBase: 236.588,
					isDefault: false,
				},
				{
					value: "g",
					label: "Grams",
					shortLabel: "g",
					dimension: "weight",
					conversionToBase: 1,
					isDefault: true,
				},
				{
					value: "tbsp",
					label: "Tablespoons",
					shortLabel: "Tbsp",
					dimension: "volume",
					conversionToBase: 14.787,
					isDefault: false,
				},
			],
			aliases: {},
			aliasEntries: [],
		});
	});

	it("starts closed with calories and expands recipe details", async () => {
		render(SavedRecipeCard, {
			props: {
				recipe,
				onLoad: vi.fn(),
				onDelete: vi.fn(),
			},
		});

		const title = screen.getByText("Morning Green");
		const summary = title.closest("summary");
		const recipeDetails = summary?.closest("details");
		expect(recipeDetails?.open).toBe(false);
		expect(recipeDetails).toHaveAttribute("data-surface", "panel");
		expect(screen.getByText("100 kcal")).toBeInTheDocument();
		expect(screen.queryByText("Goal match")).not.toBeInTheDocument();
		expect(screen.getByText("75%")).toBeInTheDocument();
		expect(
			screen.getByLabelText("Overall goal match 75% across 2 goals"),
		).toBeInTheDocument();
		expect(screen.getByText("Protein")).not.toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Load Morning Green" }),
		).not.toBeVisible();

		await fireEvent.click(summary!);
		expect(recipeDetails?.open).toBe(true);
		expect(screen.getByText("10 ingredients")).toBeInTheDocument();
		expect(screen.getByText("Calories")).toBeInTheDocument();
		expect(screen.getByText("100%")).toBeInTheDocument();
		expect(screen.getByText("Protein")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Load Morning Green" }),
		).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share recipe" })).toHaveClass(
      "circle-icon-button",
    );

		const ingredientSummary = screen
			.getByText("+2 more ingredients")
			.closest("summary");
		const ingredientDetails = ingredientSummary?.closest("details");
		expect(ingredientDetails?.open).toBe(false);
		await fireEvent.click(ingredientSummary!);
		expect(ingredientDetails?.open).toBe(true);
		expect(screen.getByText("Pineapple")).toBeInTheDocument();
	});

	it("loads directly and requires two delete activations", async () => {
		const onLoad = vi.fn();
		const onDelete = vi.fn();
		render(SavedRecipeCard, {
			props: { recipe, onLoad, onDelete },
		});

    await fireEvent.click(
      screen.getByText("Morning Green").closest("summary")!,
    );
		await fireEvent.click(
			screen.getByRole("button", { name: "Load Morning Green" }),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: "Delete Morning Green" }),
		);

		expect(onLoad).toHaveBeenCalledWith(recipe);
		expect(onDelete).not.toHaveBeenCalled();
		expect(
			screen.getByText("Tap or click delete again to confirm."),
		).toBeInTheDocument();
		await fireEvent.click(
			screen.getByRole("button", {
				name: "Confirm deletion of Morning Green",
			}),
		);
		expect(onDelete).toHaveBeenCalledWith(recipe);
    expect(screen.getByRole("button", { name: "Share recipe" })).toHaveClass(
      "circle-icon-button",
    );
	});
});
