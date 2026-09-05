import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";

describe("ImagePlacementEditor", () => {
	it("offers simplified full and fill presets with accessible custom controls", async () => {
		const onChange = vi.fn();
		render(ImagePlacementEditor, {
			props: {
				imageUrl: "https://example.com/package.jpg",
				alt: "Package",
				value: {
					cropX: 20,
					cropY: 70,
					cropZoom: 2,
					rotationDegrees: 0,
					fitMode: "custom",
					placementVersion: 2,
				},
				onChange,
			},
		});

		expect(screen.getByRole("button", { name: "Full image" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Fill card" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Place automatically" })).toBeDisabled();
		expect(screen.queryByRole("button", { name: "Custom" })).not.toBeInTheDocument();
		expect(screen.getByRole("group", { name: "Interactive card image preview" }))
			.toBeInTheDocument();
		expect(screen.getByLabelText(/Shift image left/)).toBeDisabled();
		expect(screen.getByLabelText(/Shift image left/)).toHaveValue("0");
		expect(screen.getByLabelText(/Vertical position/)).toBeDisabled();
		expect(screen.getByLabelText(/Zoom/)).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Rotate 90° clockwise" }),
		).toBeEnabled();
		expect(screen.getByRole("button", { name: "Restore default" })).toBeEnabled();

		await fireEvent.click(
			screen.getByRole("button", { name: "Rotate 90° clockwise" }),
		);
		expect(onChange).toHaveBeenCalledWith({
			cropX: 50,
			cropY: 70,
			cropZoom: 2,
			rotationDegrees: 90,
			fitMode: "custom",
			placementVersion: 2,
			placementMethod: "manual",
		});

		onChange.mockClear();
		await fireEvent.click(screen.getByRole("button", { name: "Full image" }));
		expect(onChange).toHaveBeenCalledWith({
			cropX: 50,
			cropY: 50,
			cropZoom: 1,
			rotationDegrees: 0,
			fitMode: "contain",
			placementVersion: 2,
			placementMethod: "default",
		});

		onChange.mockClear();
		await fireEvent.click(screen.getByRole("button", { name: "Restore default" }));
		expect(onChange).toHaveBeenCalledWith({
			cropX: 50,
			cropY: 50,
			cropZoom: 1,
			rotationDegrees: 0,
			fitMode: "contain",
			placementVersion: 2,
			placementMethod: "default",
		});
	});
});
