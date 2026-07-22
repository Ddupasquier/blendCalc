import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutrientAdjustmentSuggestions from "$lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte";
import type {
	NutrientFoodSuggestion,
	NutrientReductionSuggestion,
} from "$lib/utils/mix/calculations";
import type { FdcFood } from "$lib/utils/food/types";

const banana: FdcFood = {
	fdcId: 1,
	description: "Banana, raw",
	foodNutrients: [],
};

const oil: FdcFood = {
	fdcId: 2,
	description: "Oil, olive",
	foodNutrients: [],
};

const foodSuggestion: NutrientFoodSuggestion = {
	food: banana,
	action: "add",
	nutrientId: 1003,
	nutrientLabel: "Protein",
	unit: "g",
	amountPer100g: 2,
	remainingAmount: 6,
	servingGramsToTarget: 300,
	currentServingGrams: 0,
	nextServingGrams: 300,
	targetAddedAmount: 6,
	conflicts: [],
	sourceLabel: "Fridge",
};

const reductionSuggestion: NutrientReductionSuggestion = {
	food: oil,
	nutrientId: 1004,
	nutrientLabel: "Total Fat",
	unit: "g",
	currentServingGrams: 100,
	nextServingGrams: 75,
	reduceByGrams: 25,
	targetReducedAmount: 20,
	overageAmount: 20,
	percentOfOverageResolved: 100,
	conflicts: [],
	sourceLabel: "Fridge",
};

describe("NutrientAdjustmentSuggestions", () => {
	it("starts collapsed and marks available suggestions", async () => {
		render(NutrientAdjustmentSuggestions, {
			props: {
				foodSuggestions: [foodSuggestion],
				reductionSuggestions: [],
				onAdd: vi.fn(),
				onReduce: vi.fn(),
			},
		});

		const toggle = screen.getByRole("button", {
			name: /suggested adjustments/i,
		});

		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Banana, raw")).not.toBeInTheDocument();

		await fireEvent.click(toggle);

		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Banana, raw")).toBeInTheDocument();
	});

	it("applies add and reduce suggestions with the next serving amount", async () => {
		const onAdd = vi.fn();
		const onReduce = vi.fn();

		render(NutrientAdjustmentSuggestions, {
			props: {
				foodSuggestions: [foodSuggestion],
				reductionSuggestions: [reductionSuggestion],
				onAdd,
				onReduce,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: /suggested adjustments/i }),
		);
		const applyButtons = screen.getAllByRole("button", { name: "Apply" });

		await fireEvent.click(applyButtons[0]);
		await fireEvent.click(applyButtons[1]);

		expect(onReduce).toHaveBeenCalledWith(oil.fdcId, 75);
		expect(onAdd).toHaveBeenCalledWith(banana.fdcId, 300);
	});
});
