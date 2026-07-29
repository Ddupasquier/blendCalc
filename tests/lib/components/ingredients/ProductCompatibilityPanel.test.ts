import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductCompatibilityPanel from "$lib/components/ingredients/nutrition/ProductCompatibilityPanel/ProductCompatibilityPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

describe("ProductCompatibilityPanel", () => {
	it("renders explicit and possible allergen disclosures separately", () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					allergenDisclosure: {
						contains: ["Milk", "Soybeans"],
						mayContain: ["Tree nuts"],
					},
				}),
			},
		});

		expect(screen.getByRole("heading", { name: "Contains" }))
			.toBeInTheDocument();
		expect(screen.getByText("Milk, Soybeans")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "May contain" }))
			.toBeInTheDocument();
		expect(screen.getByText("Tree nuts")).toBeInTheDocument();
	});

	it("renders nothing when no source or DB allergen information exists", () => {
		render(ProductCompatibilityPanel, {
			props: { food: createFood() },
		});

		expect(screen.queryByRole("heading", { name: "Contains" }))
			.not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "May contain" }))
			.not.toBeInTheDocument();
	});

	it("shows reviewed dietary labels and considerations without policy jargon", () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					compatibilitySummary: {
						version: 1,
						generatedAt: "2026-07-29T00:00:00.000Z",
						allFacts: [
							{
								slug: "vegan",
								label: "Vegan",
								category: "dietary",
								factType: "dietary_claim",
								sourceType: "label_dietary_field",
								sourceText: "en:vegan",
								confidence: "confirmed",
							},
							{
								slug: "meat",
								label: "Meat",
								category: "avoidance",
								factType: "dietary_conflict",
								sourceType: "label_ingredient_field",
								sourceText: "beef",
								confidence: "confirmed",
							},
						],
						contains: [],
						mayContain: [],
						dietaryClaims: [{
							slug: "vegan",
							label: "Vegan",
							category: "dietary",
							factType: "dietary_claim",
							sourceType: "label_dietary_field",
							sourceText: "en:vegan",
							confidence: "confirmed",
						}],
						ingredientSignals: [],
					},
				}),
			},
		});

		expect(screen.getByRole("heading", { name: "Dietary labels" }))
			.toBeInTheDocument();
		expect(screen.getByText("Vegan")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Dietary considerations" }))
			.toBeInTheDocument();
		expect(screen.getByText("Meat")).toBeInTheDocument();
	});
});
