import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte";
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
		licenseUrl: "https://example.com/license",
		attributionText: "Example contributors",
		confidence: "moderator-reviewed",
	},
};

describe("ProductImagePanel", () => {
	it("keeps admin and moderator image-placement actions collapsed by default", async () => {
		const { container } = render(ProductImagePanel, {
			props: {
				food: foodWithImage,
				canAdjustImagePlacement: true,
				onImagePlacementSave: vi.fn(),
			},
		});

		const summary = screen.getByText("Adjust card image placement").closest("summary");
		const details = summary?.closest("details");
		expect(details).not.toHaveAttribute("open");
		expect(summary?.querySelector(".privileged-action-badge")).toBeInTheDocument();
		await fireEvent.click(screen.getByText("Adjust card image placement"));
		expect(details).toHaveAttribute("open");
		expect(screen.getByText("Card image placement")).toBeInTheDocument();
		expect(screen.getAllByTitle("Admin or moderator action")).toHaveLength(1);
		expect(
			screen.getByRole("button", { name: "Save image placement" })
				.querySelector(".privileged-action-badge"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("Nutrition page shows the full image."),
		).not.toBeInTheDocument();
		expect(container.querySelector(".product-image-frame")).toBeInTheDocument();
		expect(screen.getByText("Image: Example contributors")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Example license/ }))
			.toHaveAttribute("href", "https://example.com/license");
	});

	it("does not show privileged action badges to normal users", () => {
		render(ProductImagePanel, {
			props: {
				food: foodWithImage,
				canAdjustImagePlacement: false,
				onImagePlacementSave: vi.fn(),
			},
		});

		expect(screen.queryByText("Adjust card image placement")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Admin or moderator action")).not.toBeInTheDocument();
	});
});
