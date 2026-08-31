import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NutritionFactsLabel from "$lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.svelte";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import { DEFAULT_NUTRITION_VIEWING_CONVERSION } from "$lib/utils/food/nutrients/nutritionViewingAmount";

const food: FoodItem = {
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
				viewingConversion: DEFAULT_NUTRITION_VIEWING_CONVERSION,
				viewingLabel: "100g",
			},
		});

		expect(screen.queryByText("SFA 4:0")).not.toBeInTheDocument();
		expect(screen.getByText("SFA 16:0")).toBeInTheDocument();
		expect(screen.getByText("Total Sugars").closest("li")).toHaveTextContent(
			"0",
		);
	});

	it("prints the canonical food name instead of a personal list name", () => {
		render(NutritionFactsLabel, {
			props: {
				food: {
					...food,
					description: "My Test Food",
					canonicalDescription: "Original Test Food",
					nameProvenance: "user",
				},
				viewingConversion: DEFAULT_NUTRITION_VIEWING_CONVERSION,
				viewingLabel: "100g",
			},
		});

		expect(screen.getByText("Original Test Food")).toBeInTheDocument();
		expect(screen.queryByText("My Test Food")).not.toBeInTheDocument();
	});

	it("distinguishes unavailable nutrients from reported zero and bounded label evidence", () => {
		render(NutritionFactsLabel, {
			props: {
				food: {
					fdcId: 2,
					description: "Threshold food",
					foodNutrients: [],
					nutrientQualitativeFacts: [
						{
							nutrientId: NUTRIENT_IDS.FIBER,
							nutrientName: "Fiber, total dietary",
							nutrientNumber: "291",
							unitName: "G",
							status: "below-reporting-threshold",
							statement: "<1 g",
							maximumAmount: 1,
							measurementBasis: {
								kind: "mass",
								quantity: 100,
								unitKey: "g",
							},
							source: "user-label",
							confidence: "moderator-reviewed",
						},
					],
				},
				viewingConversion: DEFAULT_NUTRITION_VIEWING_CONVERSION,
				viewingLabel: "100g",
			},
		});

		expect(screen.getByText("Dietary Fiber").closest("li")).toHaveTextContent(
			"<1 G",
		);
		expect(screen.getByText("Total Sugars").closest("li")).toHaveTextContent(
			"—",
		);
	});

	it("keeps deduplicated unquantified label evidence out of nutrient rows", () => {
		const statement =
			"Not a significant source of dietary fiber, total sugars or added sugars.";
		const { container } = render(NutritionFactsLabel, {
			props: {
				food: {
					fdcId: 3,
					description: "Qualitative label food",
					foodNutrients: [],
					nutrientQualitativeFacts: [
						{
							nutrientId: NUTRIENT_IDS.FIBER,
							nutrientName: "Fiber, total dietary",
							nutrientNumber: "291",
							unitName: "G",
							status: "below-reporting-threshold",
							statement,
							measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
							source: "user-label",
							confidence: "moderator-reviewed",
						},
						{
							nutrientId: NUTRIENT_IDS.SUGAR,
							nutrientName: "Total Sugars",
							nutrientNumber: "269",
							unitName: "G",
							status: "below-reporting-threshold",
							statement,
							measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
							source: "user-label",
							confidence: "moderator-reviewed",
						},
					],
				},
				viewingConversion: DEFAULT_NUTRITION_VIEWING_CONVERSION,
				viewingLabel: "100g",
			},
		});

		expect(screen.getByText("Dietary Fiber").closest("li")).toHaveTextContent(
			"—",
		);
		expect(screen.getByText("Total Sugars").closest("li")).toHaveTextContent(
			"—",
		);
		expect(screen.getAllByText(`* ${statement}`)).toHaveLength(1);
		expect(
			Array.from(container.querySelectorAll(".nf-row")).every(
				(row) => !row.textContent?.includes(statement),
			),
		).toBe(true);
		expect(container.querySelector(".nf-qualitative-notes")).toHaveTextContent(
			statement,
		);
	});
});
