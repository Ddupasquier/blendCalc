import { beforeEach, describe, expect, it, vi } from "vitest";

const imagePreparation = vi.hoisted(() => ({
	prepareNutritionLabelOcrImage: vi.fn(),
}));
const coordinator = vi.hoisted(() => ({
	runCoordinatedOcrRecognition: vi.fn(),
}));

vi.mock("$lib/utils/food/images/selectedImagePreview.client", () => ({
	MAX_NUTRITION_LABEL_OCR_DIMENSION: 1600,
	prepareNutritionLabelOcrImage: imagePreparation.prepareNutritionLabelOcrImage,
}));
vi.mock("$lib/utils/food/ocr/ocrWorkerCoordinator.client", () => ({
	runCoordinatedOcrRecognition: coordinator.runCoordinatedOcrRecognition,
}));

import {
	MAX_NUTRITION_LABEL_OCR_DIMENSION,
	NUTRITION_LABEL_OCR_PAGE_SEGMENTATION_MODE,
	NUTRITION_LABEL_OCR_PREPROCESSING,
	recognizeNutritionLabelImage,
} from "$lib/utils/food/ocr/nutritionLabelOcr.client";

describe("nutrition label OCR client", () => {
	beforeEach(() => {
		imagePreparation.prepareNutritionLabelOcrImage.mockReset();
		coordinator.runCoordinatedOcrRecognition.mockReset();
	});

	it("recognizes only the bounded user crop with the measured-safe baseline", async () => {
		const source = new File(["full phone photo"], "label.jpg", {
			type: "image/jpeg",
		});
		const bounded = new Blob(["bounded crop"], { type: "image/webp" });
		const crop = { left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 };
		imagePreparation.prepareNutritionLabelOcrImage.mockResolvedValue(bounded);
		coordinator.runCoordinatedOcrRecognition.mockResolvedValue({
			data: { text: "Calories 100", confidence: 88 },
		});

		await expect(
			recognizeNutritionLabelImage({ file: source, crop }),
		).resolves.toEqual({ text: "Calories 100", confidence: 88 });
		expect(imagePreparation.prepareNutritionLabelOcrImage).toHaveBeenCalledWith(
			source,
			crop,
			undefined,
		);
		expect(coordinator.runCoordinatedOcrRecognition).toHaveBeenCalledWith(
			expect.objectContaining({
				image: bounded,
				parameters: expect.objectContaining({
					tessedit_pageseg_mode: "11",
				}),
			}),
		);
		expect(coordinator.runCoordinatedOcrRecognition).not.toHaveBeenCalledWith(
			expect.objectContaining({ image: source }),
		);
		expect(MAX_NUTRITION_LABEL_OCR_DIMENSION).toBe(1600);
		expect(NUTRITION_LABEL_OCR_PAGE_SEGMENTATION_MODE).toBe("11");
		expect(NUTRITION_LABEL_OCR_PREPROCESSING).toBe(
			"bounded-grayscale-contrast-crop",
		);
	});
});
