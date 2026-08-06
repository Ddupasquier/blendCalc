import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import IngredientContributionBreakdown from "$lib/components/mix/insights/IngredientContributionBreakdown/IngredientContributionBreakdown.svelte";

describe("IngredientContributionBreakdown", () => {
	it("starts collapsed when contribution data is available", () => {
		render(IngredientContributionBreakdown, {
			props: {
				breakdowns: [
					{
						nutrientId: 1008,
						label: "Calories",
						unit: "kcal",
						total: 100,
						contributors: [],
					},
				],
			},
		});

		const disclosure = screen
			.getByText("What is driving this shape")
			.closest("details");
		expect(disclosure).not.toHaveAttribute("open");
	});

	it("uses the shared formatter for trace quantities and percentages", () => {
		render(IngredientContributionBreakdown, {
			props: {
				open: true,
				breakdowns: [
					{
						nutrientId: 1008,
						label: "Calories",
						unit: "kcal",
						total: 0.0004,
						contributors: [
							{
								label: "Trace ingredient",
								amount: 0.0004,
								grams: 0.01,
								percentOfTotal: 0.004,
							},
						],
					},
				],
			},
		});

		expect(screen.getByText("<0.001 kcal")).toBeInTheDocument();
		expect(screen.getByText("0.004%")).toBeInTheDocument();
		expect(
			screen.getByText("<0.001 kcal from 0.01 g"),
		).toBeInTheDocument();
	});
});
