import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.svelte";

describe("ImagePlacementCardPreview", () => {
	it("renders versioned placement through the shared image viewport", () => {
		render(ImagePlacementCardPreview, {
			props: {
				imageUrl: "https://example.com/package.jpg",
				alt: "Package image",
				foodName: "Sempio Gochu Jang",
				category: "Dips & Salsa",
				showWarningEdge: true,
				value: {
					cropX: 25,
					cropY: 75,
					cropZoom: 2,
					fitMode: "custom",
					placementVersion: 2,
				},
			},
		});

		const image = screen.getByRole("img", { name: "Package image" });

		expect(image).toHaveAttribute("src", "https://example.com/package.jpg");
		expect(image).toHaveClass("image-placement-viewport__image--current");
		expect(image.getAttribute("style")).toContain(
			"--image-placement-viewport-zoom",
		);
		expect(screen.getByText("Sempio Gochu Jang")).toBeInTheDocument();
		expect(screen.getByText("Dips & Salsa")).toBeInTheDocument();
		expect(image.closest(".ingredient-card-media-lane")).toBeInTheDocument();
		expect(document.querySelector(".card-warning-edge")).toBeInTheDocument();
	});

	it("uses the complete card preview as the direct-manipulation surface", () => {
		render(ImagePlacementCardPreview, {
			props: {
				imageUrl: "https://example.com/package.jpg",
				alt: "Package image",
				interactive: true,
				instructionsId: "placement-instructions",
				value: {
					cropX: 50,
					cropY: 50,
					cropZoom: 1,
					fitMode: "contain",
					placementVersion: 2,
				},
			},
		});

		const preview = screen.getByRole("group", { name: "Card image preview" });

		expect(preview).toHaveClass("image-placement-card-preview--interactive");
		expect(preview).toHaveAttribute(
			"aria-describedby",
			"placement-instructions",
		);
		expect(
			preview.querySelector(".image-placement-viewport"),
		).not.toHaveAttribute("role");
	});
});
