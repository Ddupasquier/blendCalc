import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientChooser from "$lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const food = (values: Partial<FdcFood>): FdcFood => ({
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

const renderChooser = (
	fridgeItems = defaultFridgeItems,
	filtersOpen = false,
) =>
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
		expect(screen.queryByText("Pending Pantry Product")).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("tab", { name: /shopping list/i }));
		expect(screen.getByText("Pending Pantry Product")).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("tab", { name: /fridge/i }));

		await fireEvent.click(
			screen.getByRole("button", { name: "Custom only" }),
		);
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		const fridge = screen.getByLabelText("Mix fridge ingredients");
		expect(within(fridge).getByText("Purple Homebrew")).toBeInTheDocument();
		expect(within(fridge).queryByText("Custom")).not.toBeInTheDocument();
		expect(screen.queryByText("Catalog Jelly")).not.toBeInTheDocument();
		expect(screen.queryByText("Pending Pantry Product")).not.toBeInTheDocument();
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
		expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument();
	});
});
