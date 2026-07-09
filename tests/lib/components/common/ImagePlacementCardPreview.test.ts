import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview.svelte";

describe("ImagePlacementCardPreview", () => {
	it("uses the same placement variables as ingredient card images", () => {
		render(ImagePlacementCardPreview, {
			props: {
				imageUrl: "https://example.com/package.jpg",
				alt: "Package image",
				value: {
					cropX: 25,
					cropY: 75,
					cropZoom: 2,
				},
			},
		});

		const image = screen.getByRole("img", { name: "Package image" });

		expect(image).toHaveAttribute("src", "https://example.com/package.jpg");
		expect(image.getAttribute("style")).toContain(
			"--image-placement-preview-translate-x: 25%",
		);
		expect(image.getAttribute("style")).toContain(
			"--image-placement-preview-translate-y: -25%",
		);
	});
});
