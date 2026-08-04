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
});
