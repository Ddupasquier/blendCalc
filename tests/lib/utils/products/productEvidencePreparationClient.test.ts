import { beforeEach, describe, expect, it, vi } from "vitest";

const imagePreparation = vi.hoisted(() => ({
	prepare: vi.fn(),
}));

vi.mock("$lib/utils/food/images/selectedImagePreview.client", () => ({
	prepareSelectedImageUpload: imagePreparation.prepare,
}));

import { prepareSharedProductEvidence } from "$lib/utils/products/productEvidencePreparation.client";

describe("product evidence preparation", () => {
	beforeEach(() => {
		imagePreparation.prepare
			.mockReset()
			.mockImplementation(async (file) => file);
	});

	it("prepares evidence sequentially with role-specific detail budgets", async () => {
		const front = new File(["front"], "front.jpg", { type: "image/jpeg" });
		const nutrition = new File(["nutrition"], "nutrition.jpg", {
			type: "image/jpeg",
		});
		const barcode = new File(["barcode"], "barcode.jpg", {
			type: "image/jpeg",
		});
		const progress = vi.fn();

		const result = await prepareSharedProductEvidence(
			{ frontPhoto: front, nutritionPhoto: nutrition, barcodePhoto: barcode },
			progress,
		);

		expect(result).toMatchObject({
			frontPhoto: front,
			nutritionPhoto: nutrition,
			barcodePhoto: barcode,
		});
		expect(imagePreparation.prepare.mock.calls.map((call) => call[1])).toEqual([
			{ maxDimension: 3072, maxBytes: 800 * 1024 },
			{ maxDimension: 4096, maxBytes: 1400 * 1024 },
			{ maxDimension: 2048, maxBytes: 550 * 1024 },
		]);
		expect(progress).toHaveBeenLastCalledWith({
			phase: "prepared",
			role: "barcode",
			completed: 3,
			total: 3,
		});
	});
});
