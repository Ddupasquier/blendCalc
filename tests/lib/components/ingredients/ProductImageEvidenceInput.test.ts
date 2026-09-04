import { act, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductImageEvidenceInput from "$lib/components/ingredients/manual-entry/ProductImageEvidenceInput/ProductImageEvidenceInput.svelte";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";

const selectedPreview = vi.hoisted(() => ({
	prepare: vi.fn(),
}));

vi.mock("$lib/utils/food/images/selectedImagePreview.client", () => ({
	prepareSelectedImagePreview: selectedPreview.prepare,
}));

describe("ProductImageEvidenceInput", () => {
	let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
	let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		selectedPreview.prepare.mockResolvedValue(
			new Blob(["bounded-preview"], { type: "image/webp" }),
		);
		createObjectUrlSpy = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:bounded-preview");
		revokeObjectUrlSpy = vi
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => undefined);
	});

	afterEach(() => {
		createObjectUrlSpy.mockRestore();
		revokeObjectUrlSpy.mockRestore();
	});

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

		expect(
			screen.getByText("Image: Example image contributors"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Example image license/ }),
		).toHaveAttribute("href", "https://example.com/license");
		expect(screen.queryByLabelText("Front of package")).not.toBeInTheDocument();
		expect(screen.getByText("Blue Diamond Almond Milk")).toBeInTheDocument();
		expect(screen.getByText("Dairy Alternatives")).toBeInTheDocument();
	});

	it("prepares a bounded preview without replacing the original photo", async () => {
		let resolvePreview: ((preview: Blob) => void) | undefined;
		selectedPreview.prepare.mockReturnValueOnce(
			new Promise<Blob>((resolve) => {
				resolvePreview = resolve;
			}),
		);
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

		await waitFor(() =>
			expect(
				screen.getByText(
					"Preparing the photo preview. You can keep working while it loads.",
				),
			).toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(selectedPreview.prepare).toHaveBeenCalledTimes(1),
		);
		expect(selectedPreview.prepare.mock.calls[0]?.[0]).toBe(frontPhoto);
		expect(selectedPreview.prepare.mock.calls[0]?.[1]).toBeInstanceOf(
			AbortSignal,
		);
		await act(() => {
			resolvePreview?.(new Blob(["bounded-preview"], { type: "image/webp" }));
		});
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Place automatically" }),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: "Stop automatic placement" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Rotate 90° clockwise" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Restore default" }),
		).toBeInTheDocument();
	});

	it("keeps controls usable while a large preview is still preparing", () => {
		selectedPreview.prepare.mockReturnValue(new Promise(() => undefined));
		render(ProductImageEvidenceInput, {
			props: {
				frontPhoto: new File(["large-photo"], "phone-photo.jpg", {
					type: "image/jpeg",
				}),
				placement: createFullImagePlacement(),
				onFrontPhotoChange: vi.fn(),
				onPlacementChange: vi.fn(),
			},
		});

		expect(screen.getByLabelText("Front of package")).toBeEnabled();
		expect(
			screen.getByText(
				"Preparing the photo preview. You can keep working while it loads.",
			),
		).toHaveAttribute("role", "status");
		expect(
			screen.queryByRole("button", { name: "Place automatically" }),
		).not.toBeInTheDocument();
	});

	it("keeps the selected original usable when safe preview decoding is unavailable", async () => {
		selectedPreview.prepare.mockRejectedValueOnce(
			new Error("Nonblocking image decoding is unavailable."),
		);
		render(ProductImageEvidenceInput, {
			props: {
				frontPhoto: new File(["photo"], "phone-photo.jpg", {
					type: "image/jpeg",
				}),
				placement: createFullImagePlacement(),
				onFrontPhotoChange: vi.fn(),
				onPlacementChange: vi.fn(),
			},
		});

		await waitFor(() =>
			expect(
				screen.getByText(
					"Preview isn't available in this browser. Your original photo is still selected, and you can keep completing the form.",
				),
			).toHaveAttribute("role", "alert"),
		);
		expect(screen.getByLabelText("Front of package")).toBeEnabled();
	});
});
