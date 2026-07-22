import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";

describe("ImagePlacementEditor", () => {
	it("offers full, fill, and custom modes with accessible fallback controls", async () => {
		const onChange = vi.fn();
		render(ImagePlacementEditor, {
			props: {
				imageUrl: "https://example.com/package.jpg",
				alt: "Package",
				value: {
					cropX: 20,
					cropY: 70,
					cropZoom: 2,
					fitMode: "custom",
					placementVersion: 2,
				},
				onChange,
			},
		});

		expect(screen.getByRole("button", { name: "Full image" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Fill circle" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByLabelText(/Horizontal position/)).toBeDisabled();
		expect(screen.getByLabelText(/Vertical position/)).toBeDisabled();
		expect(screen.getByLabelText(/Zoom/)).toBeEnabled();
		expect(screen.getByRole("button", { name: "Restore default" })).toBeEnabled();

		await fireEvent.click(screen.getByRole("button", { name: "Full image" }));
		expect(onChange).toHaveBeenCalledWith({
			cropX: 50,
			cropY: 50,
			cropZoom: 1,
			fitMode: "contain",
			placementVersion: 2,
		});

		onChange.mockClear();
		await fireEvent.click(screen.getByRole("button", { name: "Restore default" }));
		expect(onChange).toHaveBeenCalledWith({
			cropX: 50,
			cropY: 50,
			cropZoom: 1,
			fitMode: "contain",
			placementVersion: 2,
		});
	});
});
