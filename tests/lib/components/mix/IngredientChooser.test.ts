import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientChooser from "$lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const food = (values: Partial<FoodItem>): FoodItem => ({
	fdcId: 1,
	description: "Test ingredient",
	foodNutrients: [],
	...values,
});

const defaultFridgeItems = [
	food({
		fdcId: 1,
		description: "Catalog Jelly",
		customFood: true,
		sourceKey: "usda",
		sharedProductId: "catalog-product-id",
		trustStatus: "source-verified",
	}),
	food({
		fdcId: 2,
		description: "Purple Homebrew",
		customFood: true,
		sourceKey: "custom",
		barcodeSource: "manual",
	}),
];

const renderChooser = (fridgeItems = defaultFridgeItems, filtersOpen = false) =>
	render(IngredientChooser, {
		props: {
			fridgeItems,
			shoppingItems: [
				food({
					fdcId: 3,
					description: "Pending Pantry Product",
					customFood: true,
					sourceKey: "unknown",
					sharedProductSubmissionId: "pending-submission-id",
					trustStatus: "pending-review",
				}),
			],
			selectedFoodIds: [],
			onToggleFood: vi.fn(),
			filtersOpen,
			onOpenFilters: vi.fn(),
			onCloseFilters: vi.fn(),
		},
	});

describe("IngredientChooser custom filtering", () => {
	it("keeps catalog and pending foods out of Custom only", async () => {
		renderChooser(defaultFridgeItems, true);

		expect(screen.getByText("Catalog Jelly")).toBeInTheDocument();
		expect(screen.getByText("Purple Homebrew")).toBeInTheDocument();
		expect(
			screen.queryByText("Pending Pantry Product"),
		).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("tab", { name: /shopping list/i }));
		expect(screen.getByText("Pending Pantry Product")).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("tab", { name: /fridge/i }));

		await fireEvent.click(screen.getByRole("button", { name: "Custom only" }));
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		const fridge = screen.getByLabelText("Mix fridge ingredients");
		expect(within(fridge).getByText("Purple Homebrew")).toBeInTheDocument();
		expect(within(fridge).queryByText("Custom")).not.toBeInTheDocument();
		expect(screen.queryByText("Catalog Jelly")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Pending Pantry Product"),
		).not.toBeInTheDocument();
		expect(screen.getByText("1 available · 0 selected")).toBeInTheDocument();
	});

	it("keeps categories searchable without rendering them on chooser cards", async () => {
		renderChooser([
			food({
				fdcId: 4,
				description: "Plain Pantry Item",
				foodCategory: "Protein Bars",
			}),
		]);

		await fireEvent.input(screen.getByLabelText("Find ingredients"), {
			target: { value: "protein bars" },
		});

		expect(screen.getByText("Plain Pantry Item")).toBeInTheDocument();
		expect(screen.queryByText("Protein Bars")).not.toBeInTheDocument();
	});

	it("offers separate warning and active-recall filters", async () => {
		const preferenceWarningFood = food({
			fdcId: 4,
			description: "Milk yogurt",
			preferenceWarnings: [
				{
					id: "milk-warning",
					level: "warning",
					category: "allergen",
					label: "Milk",
					code: "FOOD_ALLERGEN_CONTAINS",
					params: {},
				},
			],
		});
		const recalledFood = food({
			fdcId: 5,
			description: "Recalled salad",
			safetyAlerts: [
				{
					id: "recall-1",
					providerKey: "open-fda-food-enforcement",
					sourceName: "openFDA Food Enforcement",
					sourceAttribution: "U.S. Food and Drug Administration",
					alertType: "recall",
					status: "Ongoing",
					productDescription: "Recalled salad",
					sourceUrl: "https://api.fda.gov/food/enforcement.json",
					matchType: "exact_gtin",
					requiresPackageCheck: false,
					detectedAt: "2026-08-14T12:00:00.000Z",
				},
			],
		});
		renderChooser(
			[
				food({ fdcId: 3, description: "Rice" }),
				preferenceWarningFood,
				recalledFood,
			],
			true,
		);

		await fireEvent.click(screen.getByRole("button", { name: "Warnings" }));
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(screen.getByText("Milk yogurt")).toBeInTheDocument();
		expect(screen.queryByText("Recalled salad")).not.toBeInTheDocument();
		expect(screen.queryByText("Rice")).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: "Active recalls" }),
		);
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(screen.getByText("Recalled salad")).toBeInTheDocument();
		expect(screen.queryByText("Milk yogurt")).not.toBeInTheDocument();
	});
});

describe("IngredientChooser progressive loading", () => {
	it("appends more ingredients without replacing the current results", async () => {
		const ingredients = Array.from({ length: 12 }, (_, index) =>
			food({
				fdcId: index + 100,
				description: `Ingredient ${String(index + 1).padStart(2, "0")}`,
			}),
		);
		renderChooser(ingredients);

		expect(screen.getByText("Ingredient 12")).toBeInTheDocument();
		expect(screen.getByText("Ingredient 03")).toBeInTheDocument();
		expect(screen.queryByText("Ingredient 02")).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: "Load more ingredients" }),
		);

		expect(screen.getByText("Ingredient 12")).toBeInTheDocument();
		expect(screen.getByText("Ingredient 02")).toBeInTheDocument();
		expect(screen.getByText("Ingredient 01")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /next page/i }),
		).not.toBeInTheDocument();
	});
});

describe("IngredientChooser empty guidance", () => {
	it("replaces unusable list controls with one direct Ingredients route", () => {
		render(IngredientChooser, {
			props: {
				fridgeItems: [],
				shoppingItems: [],
				selectedFoodIds: [],
				onToggleFood: vi.fn(),
			},
		});

		expect(screen.getByText("Find ingredients first")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Go to Ingredients" }),
		).toHaveAttribute("href", "/ingredients/fridge");
		expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();
		expect(
			screen.queryByText("No ingredients selected"),
		).not.toBeInTheDocument();
	});
});
