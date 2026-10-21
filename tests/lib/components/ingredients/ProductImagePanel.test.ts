import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const foodWithImage: FoodItem = {
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
		licenseUrl: "https://example.com/license",
		attributionText: "Example contributors",
		confidence: "moderator-reviewed",
	},
};

describe("ProductImagePanel", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("applies the saved moderator rotation to the detailed product image", () => {
		const rotatedFood = {
			...foodWithImage,
			image: {
				...foodWithImage.image!,
				rotationDegrees: 90 as const,
				placementVersion: 2,
			},
		};
		const { container } = render(ProductImagePanel, {
			props: {
				food: rotatedFood,
				canAdjustImagePlacement: false,
				onImagePlacementSave: vi.fn(),
			},
		});

		expect(
			container.querySelector(
				'.product-image-frame__rotated-image[data-rotation-degrees="90"]',
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", {
				name: "Blue Diamond almond milk package image",
			}),
		).toHaveStyle("--image-placement-viewport-rotation: 90deg");
	});
});
