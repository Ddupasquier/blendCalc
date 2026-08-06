import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutrientAdjustmentSuggestions from "$lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte";
import type { NutrientAdjustmentSuggestion } from "$lib/utils/mix/calculations";
import type { FdcFood } from "$lib/utils/food/types";

const milk: FdcFood = {
	fdcId: 1,
	description: "Milk, reduced fat",
	foodNutrients: [],
};

const suggestion: NutrientAdjustmentSuggestion = {
	food: milk,
	direction: "increase",
	currentServingGrams: 100,
	nextServingGrams: 130,
	changeGrams: 30,
	incrementLabel: "1 fl oz",
	incrementSource: "source-serving",
	primaryImpact: {
		nutrientId: 1003,
		label: "Protein",
		unit: "g",
		amountChange: 1,
		currentTotal: 3.3,
		nextTotal: 4.3,
		goal: 6,
		distanceImprovement: 0.17,
    weightedDistanceImprovement: 0.17,
	},
	impacts: [
		{
			nutrientId: 1003,
			label: "Protein",
			unit: "g",
			amountChange: 1,
			currentTotal: 3.3,
			nextTotal: 4.3,
			goal: 6,
			distanceImprovement: 0.17,
      weightedDistanceImprovement: 0.17,
		},
	],
	goalDistanceImprovement: 0.17,
};

describe("NutrientAdjustmentSuggestions", () => {
	it("starts collapsed and explains the safe selected-food adjustment", async () => {
		render(NutrientAdjustmentSuggestions, {
			props: {
				suggestions: [suggestion],
				onApply: vi.fn(),
			},
		});

		const toggle = screen.getByText("Suggested adjustments").closest("summary");
		const disclosure = toggle?.closest("details");
		expect(disclosure).not.toHaveAttribute("open");

		await fireEvent.click(toggle as HTMLElement);

		expect(disclosure).toHaveAttribute("open");
		expect(screen.getByText("Milk, reduced fat")).toBeInTheDocument();
		expect(screen.getByText("Increase to 130 g")).toBeInTheDocument();
		expect(screen.getByText("Protein +1 g")).toBeInTheDocument();
    expect(
      screen.getByText("Uses one reported serving: 1 fl oz"),
    ).toBeInTheDocument();
		expect(screen.queryByText(/watch out/i)).not.toBeInTheDocument();
	});

	it("applies the recommended amount", async () => {
		const onApply = vi.fn();
		render(NutrientAdjustmentSuggestions, {
			props: {
				suggestions: [suggestion],
				onApply,
			},
		});

		await fireEvent.click(
      screen
        .getByText("Suggested adjustments")
        .closest("summary") as HTMLElement,
		);
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(onApply).toHaveBeenCalledWith(milk.fdcId, 130);
	});
});
