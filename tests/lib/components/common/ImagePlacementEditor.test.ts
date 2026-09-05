import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
import { SmartImagePlacementError } from "$lib/utils/food/images/smartImagePlacementDiagnostics";

const smartPlacement = vi.hoisted(() => ({
	suggestImagePlacement: vi.fn(),
}));

vi.mock("$lib/utils/food/images/smartImagePlacement.client", () => ({
	suggestImagePlacement: smartPlacement.suggestImagePlacement,
}));

describe("ImagePlacementEditor", () => {
	beforeEach(() => {
		smartPlacement.suggestImagePlacement.mockReset();
		smartPlacement.suggestImagePlacement.mockResolvedValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

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

		expect(
			screen.getByRole("button", { name: "Full image" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Fill card" })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Place automatically" }),
		).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: "Custom" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("group", { name: "Interactive card image preview" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/Shift image left/)).toBeDisabled();
		expect(screen.getByLabelText(/Shift image left/)).toHaveValue("0");
		expect(screen.getByLabelText(/Vertical position/)).toBeDisabled();
		expect(screen.getByLabelText(/Zoom/)).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Rotate 90° clockwise" }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Restore default" }),
		).toBeEnabled();

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
		await fireEvent.click(
			screen.getByRole("button", { name: "Restore default" }),
		);
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

	it("keeps manual controls usable and lets the user stop automatic placement", async () => {
		let receivedSignal: AbortSignal | undefined;
		smartPlacement.suggestImagePlacement.mockImplementation(
			({ signal }: { signal: AbortSignal }) => {
				receivedSignal = signal;
				return new Promise((_resolve, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					});
				});
			},
		);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 80,
			height: 68,
			x: 0,
			y: 0,
			top: 0,
			right: 80,
			bottom: 68,
			left: 0,
			toJSON: () => ({}),
		});
		const { unmount } = render(ImagePlacementEditor, {
			props: {
				imageUrl: "blob:package-photo",
				alt: "Package",
				value: {
					cropX: 50,
					cropY: 50,
					cropZoom: 1,
					rotationDegrees: 0,
					fitMode: "contain",
					placementVersion: 2,
				},
				smartPlacementSource: new File(["photo"], "package.jpg", {
					type: "image/jpeg",
				}),
				automaticallyPlaceNewImage: true,
			},
		});
		const image = screen.getByRole("img", { name: "Package" });
		Object.defineProperties(image, {
			naturalWidth: { configurable: true, value: 1200 },
			naturalHeight: { configurable: true, value: 800 },
		});
		await fireEvent.load(image);

		await waitFor(() =>
			expect(
				screen.getByRole("button", {
					name: "Stop automatic placement",
				}),
			).toBeEnabled(),
		);
		await waitFor(() =>
			expect(smartPlacement.suggestImagePlacement).toHaveBeenCalledTimes(1),
		);
		expect(screen.getByRole("button", { name: "Full image" })).toBeEnabled();
		expect(
			screen.getByRole("button", {
				name: "Rotate 90° clockwise",
			}),
		).toBeEnabled();
		expect(screen.getByText(/The full photo is ready now/)).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Stop automatic placement",
			}),
		);

		expect(receivedSignal?.aborted).toBe(true);
		expect(screen.getByText(/Automatic placement stopped/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Place automatically" }),
		).toBeEnabled();
		unmount();
	});

	it("reports one privacy-safe diagnostic for a genuine placement failure", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		smartPlacement.suggestImagePlacement.mockRejectedValueOnce(
			new SmartImagePlacementError({
				message: "We couldn't place this photo automatically.",
				phase: "recognition",
				reasonCode: "ocr-recognition-failed",
				cause: new Error("private OCR contents"),
			}),
		);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 80,
			height: 68,
			x: 0,
			y: 0,
			top: 0,
			right: 80,
			bottom: 68,
			left: 0,
			toJSON: () => ({}),
		});
		render(ImagePlacementEditor, {
			props: {
				imageUrl: "blob:failed-package-photo",
				alt: "Failed package",
				value: {
					cropX: 50,
					cropY: 50,
					cropZoom: 1,
					rotationDegrees: 0,
					fitMode: "contain",
					placementVersion: 2,
				},
				smartPlacementSource: new File(["photo"], "package.jpg", {
					type: "image/jpeg",
				}),
				automaticallyPlaceNewImage: true,
			},
		});
		const image = screen.getByRole("img", { name: "Failed package" });
		Object.defineProperties(image, {
			naturalWidth: { configurable: true, value: 1200 },
			naturalHeight: { configurable: true, value: 800 },
		});
		await fireEvent.load(image);

		await waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
		expect(consoleError).toHaveBeenCalledWith(
			"[image placement] Automatic placement failed",
			{ phase: "recognition", reasonCode: "ocr-recognition-failed" },
		);
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
			"private OCR contents",
		);
		expect(
			screen.getByText("We couldn't place this photo automatically."),
		).toBeInTheDocument();
	});

	it("treats a placement timeout as ordinary user-facing state", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		smartPlacement.suggestImagePlacement.mockRejectedValueOnce(
			new DOMException("Automatic placement timed out", "TimeoutError"),
		);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 80,
			height: 68,
			x: 0,
			y: 0,
			top: 0,
			right: 80,
			bottom: 68,
			left: 0,
			toJSON: () => ({}),
		});
		render(ImagePlacementEditor, {
			props: {
				imageUrl: "blob:slow-package-photo",
				alt: "Slow package",
				value: {
					cropX: 50,
					cropY: 50,
					cropZoom: 1,
					rotationDegrees: 0,
					fitMode: "contain",
					placementVersion: 2,
				},
				smartPlacementSource: new File(["photo"], "package.jpg", {
					type: "image/jpeg",
				}),
				automaticallyPlaceNewImage: true,
			},
		});
		const image = screen.getByRole("img", { name: "Slow package" });
		Object.defineProperties(image, {
			naturalWidth: { configurable: true, value: 1200 },
			naturalHeight: { configurable: true, value: 800 },
		});
		await fireEvent.load(image);

		await waitFor(() =>
			expect(
				screen.getByText(/Automatic placement took too long/),
			).toBeInTheDocument(),
		);
		expect(consoleError).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Full image" })).toBeEnabled();
	});
});
