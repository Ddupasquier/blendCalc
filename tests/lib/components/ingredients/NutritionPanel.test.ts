import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionPanel from "$lib/components/ingredients/nutrition/NutritionPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

vi.mock("$lib/utils/profile/foodPreferenceContext.svelte", () => ({
	getFoodPreferenceContext: () => ({
		current: {
			unitSystem: "metric",
			allergens: ["peanut"],
			dietaryRestrictions: [],
			prioritizedNutrientIds: [],
			defaultSmoothieServingGrams: null,
			sensitiveAcknowledgedAt: null,
		},
	}),
}));

const peanutButter: FdcFood = {
	fdcId: 172470,
	description: "Peanut butter, smooth style, with salt",
	foodCategory: "Legumes and Legume Products",
	foodNutrients: [],
};

describe("NutritionPanel", () => {
	it("renders the shared preference conflict before nutrition facts", () => {
		render(NutritionPanel, {
			props: {
				food: peanutButter,
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const heading = screen.getByText("Possible conflict");
		const statusMessage = heading.closest(".status-message");
		const nutritionFacts = screen.getByText("Nutrition Facts");

		expect(statusMessage).toHaveAttribute("data-tone", "warning");
		expect(statusMessage).toContainElement(
			screen.getByText(
				/peanut may be present based on the food name or category\./i,
			),
		);
		expect(statusMessage?.querySelector(".status-icon-badge"))
			.toBeInTheDocument();
		expect(
			statusMessage?.compareDocumentPosition(nutritionFacts) ?? 0,
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});
});
