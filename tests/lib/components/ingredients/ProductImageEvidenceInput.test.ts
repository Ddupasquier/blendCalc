import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProductImageEvidenceInput from "$lib/components/ingredients/manual-entry/ProductImageEvidenceInput.svelte";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";

describe("ProductImageEvidenceInput", () => {
	it("attributes a stored trusted image and hides duplicate upload", () => {
		render(ProductImageEvidenceInput, {
			props: {
				trustedImage: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					role: "front",
					imageUrl: "https://example.com/package.jpg",
					licenseName: "Example image license",
					licenseUrl: "https://example.com/license",
					attributionText: "Example image contributors",
					confidence: "source-verified",
				},
				frontPhoto: null,
				placement: createFullImagePlacement(),
				onFrontPhotoChange: vi.fn(),
				onPlacementChange: vi.fn(),
			},
		});

		expect(screen.getByText("Image: Example image contributors"))
			.toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Example image license/ }))
			.toHaveAttribute("href", "https://example.com/license");
		expect(screen.queryByLabelText("Front of package"))
			.not.toBeInTheDocument();
	});
});
