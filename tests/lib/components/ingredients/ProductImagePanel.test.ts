import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const foodWithImage: FdcFood = {
	fdcId: 1,
	description: "Blue Diamond almond milk",
	foodCategory: "Verified Packaged Food",
	dataType: "Branded",
	foodNutrients: [],
	image: {
		source: "open-food-facts",
		sourceReference: "00000000000000",
		role: "front",
		imageUrl: "https://example.com/almond-milk.jpg",
		licenseName: "Example license",
		confidence: "moderator-reviewed",
	},
};

describe("ProductImagePanel", () => {
	it("marks admin and moderator image-placement actions with crown badges", () => {
		render(ProductImagePanel, {
			props: {
				food: foodWithImage,
				canAdjustImagePlacement: true,
				onImagePlacementSave: vi.fn(),
			},
		});

		expect(screen.getByText("Card image placement")).toBeInTheDocument();
		expect(screen.getAllByTitle("Admin or moderator action")).toHaveLength(6);
		expect(
			screen.queryByText("Nutrition page shows the full image."),
		).not.toBeInTheDocument();
	});

	it("does not show privileged action badges to normal users", () => {
		render(ProductImagePanel, {
			props: {
				food: foodWithImage,
				canAdjustImagePlacement: false,
				onImagePlacementSave: vi.fn(),
			},
		});

		expect(screen.queryByText("Card image placement")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Admin or moderator action")).not.toBeInTheDocument();
	});
});
