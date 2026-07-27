import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductAllergenPanel from "$lib/components/ingredients/nutrition/ProductAllergenPanel/ProductAllergenPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

describe("ProductAllergenPanel", () => {
	it("renders explicit and possible allergen disclosures separately", () => {
		render(ProductAllergenPanel, {
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
		render(ProductAllergenPanel, {
			props: { food: createFood() },
		});

		expect(screen.queryByRole("heading", { name: "Contains" }))
			.not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "May contain" }))
			.not.toBeInTheDocument();
	});
});
