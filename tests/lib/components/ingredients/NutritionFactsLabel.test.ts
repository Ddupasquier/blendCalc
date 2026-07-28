import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NutritionFactsLabel from "$lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.svelte";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const food: FdcFood = {
	fdcId: 1,
	description: "Test food",
	foodNutrients: [
		{
			nutrientId: NUTRIENT_IDS.SUGAR,
			nutrientName: "Total Sugars",
			nutrientNumber: "269",
			unitName: "G",
			value: 0,
		},
		{
			nutrientId: 20001,
			nutrientName: "SFA 4:0",
			nutrientNumber: "20001",
			unitName: "G",
			value: 0,
		},
		{
			nutrientId: 20002,
			nutrientName: "SFA 16:0",
			nutrientNumber: "20002",
			unitName: "G",
			value: 0.01,
		},
	],
};

describe("NutritionFactsLabel", () => {
	it("hides zero-valued secondary nutrients without hiding primary zero values", () => {
		render(NutritionFactsLabel, {
			props: {
				food,
				viewingGrams: 100,
			},
		});

		expect(screen.queryByText("SFA 4:0")).not.toBeInTheDocument();
		expect(screen.getByText("SFA 16:0")).toBeInTheDocument();
		expect(screen.getByText("Total Sugars").closest("li"))
			.toHaveTextContent("0");
	});
});
