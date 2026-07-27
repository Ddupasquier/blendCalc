import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionPanel from "$lib/components/ingredients/nutrition/NutritionPanel/NutritionPanel.svelte";
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
			warningRules: [],
			matchRules: [],
		},
	}),
}));

const peanutButter: FdcFood = {
	fdcId: 172470,
	description: "Peanut butter, smooth style, with salt",
	foodCategory: "Legumes and Legume Products",
	allergens: ["peanut"],
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

		const heading = screen.getByText("Check this ingredient");
		const statusMessage = heading.closest(".status-message");
		const nutritionFacts = screen.getByText("Nutrition Facts");

		expect(statusMessage).toHaveAttribute("data-tone", "danger");
		expect(statusMessage).toHaveAttribute("data-icon-placement", "top-end");
		expect(statusMessage).toContainElement(
			screen.getByText(
				/the label lists peanut as an allergen\./i,
			),
		);
		expect(statusMessage?.querySelector(".status-icon-badge"))
			.toBeInTheDocument();
		expect(
			statusMessage?.compareDocumentPosition(nutritionFacts) ?? 0,
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("shows stored product ingredients after nutrition facts", () => {
		const ingredients = "Peanuts, sea salt";
		render(NutritionPanel, {
			props: {
				food: { ...peanutButter, ingredients },
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const nutritionFacts = screen.getByText("Nutrition Facts");
		const ingredientsHeading = screen.getByRole("heading", { name: "Ingredients" });
		expect(screen.getByText(ingredients)).toBeInTheDocument();
		expect(
			nutritionFacts.compareDocumentPosition(ingredientsHeading),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("shows source-provided allergen details below ingredients", () => {
		render(NutritionPanel, {
			props: {
				food: {
					...peanutButter,
					ingredients: "Peanuts, sea salt",
					allergens: ["peanuts"],
					traces: ["tree nuts"],
				},
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const ingredientsHeading = screen.getByRole("heading", { name: "Ingredients" });
		const containsHeading = screen.getByRole("heading", { name: "Contains" });
		const mayContainHeading = screen.getByRole("heading", { name: "May contain" });

		expect(ingredientsHeading.compareDocumentPosition(containsHeading))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(containsHeading.compareDocumentPosition(mayContainHeading))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(screen.getByText("Peanuts")).toBeInTheDocument();
		expect(screen.getByText("Tree nuts")).toBeInTheDocument();
	});

	it("shows zero instead of a partial-data warning for missing ingredient nutrients", () => {
		render(NutritionPanel, {
			props: {
				food: peanutButter,
				viewingGrams: 100,
				showListActions: false,
			},
		});

		expect(screen.queryByText(/nutrition data/i)).not.toBeInTheDocument();
		expect(screen.getAllByText("0").length).toBeGreaterThan(0);
	});
});
