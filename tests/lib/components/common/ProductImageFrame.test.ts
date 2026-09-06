import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProductImageFrame from "$lib/components/common/images/ProductImageFrame/ProductImageFrame.svelte";

describe("ProductImageFrame", () => {
	it("renders a full product image and reports client-side failures", async () => {
		const onError = vi.fn();

		const { container } = render(ProductImageFrame, {
			props: {
				src: "https://example.com/product.jpg",
				alt: "Example product package",
				onError,
			},
		});

		const image = screen.getByRole("img", { name: "Example product package" });
		expect(image).toHaveAttribute("src", "https://example.com/product.jpg");
		expect(image).toHaveAttribute("loading", "lazy");
		expect(image).toHaveAttribute("fetchpriority", "auto");
		expect(image).toHaveAttribute("width", "288");
		expect(image).toHaveAttribute("height", "224");
		expect(
			container.querySelector(".product-image-frame__image"),
		).toBeInTheDocument();

		await fireEvent.error(image);
		expect(onError).toHaveBeenCalledOnce();
	});

	it("prioritizes an explicitly visible product image", () => {
		render(ProductImageFrame, {
			props: {
				src: "https://example.com/visible-product.jpg",
				alt: "Visible product package",
				loading: "eager",
				fetchPriority: "high",
			},
		});

		const image = screen.getByRole("img", { name: "Visible product package" });
		expect(image).toHaveAttribute("loading", "eager");
		expect(image).toHaveAttribute("fetchpriority", "high");
	});

	it("uses the shared full-image renderer for a saved rotation", () => {
		const { container } = render(ProductImageFrame, {
			props: {
				src: "https://example.com/sideways-product.jpg",
				alt: "Correctly oriented product package",
				loading: "eager",
				fetchPriority: "high",
				rotationDegrees: 90,
			},
		});

		expect(
			container.querySelector(
				'.product-image-frame__rotated-image[data-rotation-degrees="90"]',
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", { name: "Correctly oriented product package" }),
		).toHaveStyle("--image-placement-viewport-rotation: 90deg");
		expect(
			screen.getByRole("img", { name: "Correctly oriented product package" }),
		).toHaveAttribute("loading", "eager");
		expect(
			screen.getByRole("img", { name: "Correctly oriented product package" }),
		).toHaveAttribute("fetchpriority", "high");
	});
});
