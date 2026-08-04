import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import IngredientImagePlacementSheet from "$lib/components/ingredients/sheets/IngredientImagePlacementSheet/IngredientImagePlacementSheet.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const foodWithImage: FdcFood = {
	fdcId: 1,
	description: "Gochujang",
	foodCategory: "Dips and Salsa",
	dataType: "Branded",
	foodNutrients: [],
	image: {
		source: "open-food-facts",
		sourceReference: "00000000000000",
		role: "front",
		imageUrl: "https://example.com/gochujang.jpg",
		licenseName: "Example license",
		licenseUrl: "https://example.com/license",
		attributionText: "Example contributors",
		confidence: "moderator-reviewed",
	},
};

describe("IngredientImagePlacementSheet", () => {
	it("renders one flat placement flow inside the scrollable bottom sheet", () => {
		const { container } = render(IngredientImagePlacementSheet, {
			props: {
				open: true,
				food: foodWithImage,
				canAdjustImagePlacement: true,
				onClose: vi.fn(),
				onImagePlacementSave: vi.fn(),
			},
		});

		expect(
			screen.getByRole("dialog", { name: "Adjust image placement" }),
		).toBeInTheDocument();
		expect(container.querySelector("details")).not.toBeInTheDocument();
		expect(screen.queryByText("Card image placement")).not.toBeInTheDocument();
		expect(container.querySelector(".product-image-frame")).not.toBeInTheDocument();
		expect(
			screen.getByRole("group", { name: "Interactive card image preview" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Save image placement" }),
		).toBeInTheDocument();
		expect(container.querySelector(".bottom-sheet__content")).toHaveClass(
			"bottom-sheet__content",
		);
	});
});
