import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProductImageFrame from "$lib/components/common/images/ProductImageFrame.svelte";

describe("ProductImageFrame", () => {
	it("renders a full product image in the shared compact frame", () => {
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
		expect(container.querySelector(".product-image-frame__image")).toBeInTheDocument();
	});
});
