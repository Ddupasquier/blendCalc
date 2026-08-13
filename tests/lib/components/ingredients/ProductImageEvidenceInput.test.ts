import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProductImageEvidenceInput from "$lib/components/ingredients/manual-entry/ProductImageEvidenceInput/ProductImageEvidenceInput.svelte";
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
					foodName: "Blue Diamond Almond Milk",
					category: "Dairy Alternatives",
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
			expect(screen.getByText("Blue Diamond Almond Milk")).toBeInTheDocument();
			expect(screen.getByText("Dairy Alternatives")).toBeInTheDocument();
		});

	it("marks newly selected photos for automatic placement while retaining manual controls", () => {
		const frontPhoto = new File(["photo"], "package.jpg", {
			type: "image/jpeg",
		});
		render(ProductImageEvidenceInput, {
			props: {
				frontPhoto,
				placement: createFullImagePlacement(),
				foodName: "Sempio Gochu Jang",
				brandName: "Sempio",
				category: "Dips and Salsa",
				onFrontPhotoChange: vi.fn(),
				onPlacementChange: vi.fn(),
			},
		});

		expect(screen.getByRole("button", { name: "Place automatically" }))
			.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Rotate 90° clockwise" }))
			.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Restore default" }))
			.toBeInTheDocument();
	});
});
