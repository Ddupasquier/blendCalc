import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SelectedIngredientsPanel from "$lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";

const food = (fdcId: number): FdcFood => ({
	fdcId,
	description: `Selected ingredient ${String(fdcId).padStart(2, "0")}`,
	foodNutrients: [],
});

const conversion: ServingConversion = {
	grams: 100,
	milliliters: null,
	dimension: "weight",
	density: null,
	available: true,
	warning: null,
	method: "source-reported",
	basis: "package serving",
};

describe("SelectedIngredientsPanel progressive loading", () => {
	it("keeps visible cards mounted while appending the remaining selection", async () => {
		const selectedFoods = Array.from({ length: 8 }, (_, index) => food(index + 1));
		render(SelectedIngredientsPanel, {
			props: {
				selectedFoods,
				fridgeItems: selectedFoods,
				selectedNutrients: [],
				servingGrams: {},
				getServingQuantity: () => 100,
				getServingUnit: () => "g",
				getServingConversion: () => conversion,
				getServingConversionWarning: () => null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(screen.getByText("Selected ingredient 01")).toBeInTheDocument();
		expect(screen.getByText("Selected ingredient 06")).toBeInTheDocument();
		expect(screen.queryByText("Selected ingredient 07")).not.toBeInTheDocument();
		expect(screen.queryByText("8 selected")).not.toBeInTheDocument();
		expect(screen.queryByText("100.0 g equivalent")).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: "Load more selected ingredients" }),
		);

		expect(screen.getByText("Selected ingredient 01")).toBeInTheDocument();
		expect(screen.getByText("Selected ingredient 07")).toBeInTheDocument();
		expect(screen.getByText("Selected ingredient 08")).toBeInTheDocument();
	});

	it("shows a result count only after search narrows the selected list", async () => {
		const selectedFoods = Array.from({ length: 8 }, (_, index) => food(index + 1));
		render(SelectedIngredientsPanel, {
			props: {
				selectedFoods,
				fridgeItems: selectedFoods,
				selectedNutrients: [],
				servingGrams: {},
				getServingQuantity: () => 100,
				getServingUnit: () => "g",
				getServingConversion: () => conversion,
				getServingConversionWarning: () => null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		await fireEvent.input(
			screen.getByRole("searchbox", { name: "Find selected ingredients" }),
			{ target: { value: "ingredient 01" } },
		);

		expect(screen.getByText("1 of 8 selected")).toBeInTheDocument();
	});
});
