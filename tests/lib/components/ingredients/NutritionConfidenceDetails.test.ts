import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NutritionConfidenceDetails from "$lib/components/ingredients/nutrition/NutritionConfidenceDetails.svelte";
import type { FoodQuality } from "$lib/utils/food/quality/foodQuality";

const partialQuality: FoodQuality = {
	label: "Partial",
	symbol: "⚠️",
	title: "4/6 vital nutrients are available.",
	score: 10,
	completeCount: 4,
	missingCount: 2,
	sourceCounts: {
		exact: 3,
		fallback: 1,
		derived: 0,
		missing: 2,
	},
	details: [
		{
			nutrientId: 1008,
			label: "Calories",
			source: "fallback",
			sourceLabel: "Mapped",
			detail: "Resolved from an alternate source nutrient field.",
		},
		{
			nutrientId: 2000,
			label: "Total Sugars",
			source: "missing",
			sourceLabel: "Missing",
			detail: "Not reported in this source record.",
		},
	],
	needsDetails: true,
};

describe("NutritionConfidenceDetails", () => {
	it("starts collapsed and can be opened and closed", async () => {
		render(NutritionConfidenceDetails, { props: { quality: partialQuality } });

		const toggle = screen.getByRole("button", { name: /partial nutrition data/i });
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Mapped")).not.toBeInTheDocument();
		expect(screen.queryByText("Missing")).not.toBeInTheDocument();

		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Mapped")).toBeInTheDocument();
		expect(screen.getByText("Missing")).toBeInTheDocument();

		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Mapped")).not.toBeInTheDocument();
	});
});
