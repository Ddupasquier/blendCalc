import {
	MAX_NUTRITION_LABEL_OCR_DIMENSION,
	prepareNutritionLabelOcrImage,
} from "$lib/utils/food/images/selectedImagePreview.client";
import type { NormalizedImageCrop } from "$lib/utils/food/images/selectedImagePreview";
import type {
	NutritionLabelOcrProgress,
	NutritionLabelOcrRecognition,
} from "$lib/utils/food/ocr/nutritionLabelOcr";
import { runCoordinatedOcrRecognition } from "$lib/utils/food/ocr/ocrWorkerCoordinator.client";

export { MAX_NUTRITION_LABEL_OCR_DIMENSION };
export type NutritionLabelCrop = NormalizedImageCrop;
export const NUTRITION_LABEL_OCR_TIMEOUT_MILLISECONDS = 30_000;
export const NUTRITION_LABEL_OCR_PAGE_SEGMENTATION_MODE = "11";
export const NUTRITION_LABEL_OCR_PREPROCESSING =
	"bounded-grayscale-contrast-crop";

export const recognizeNutritionLabelImage = async ({
	file,
	crop,
	onProgress,
	signal,
}: {
	file: File;
	crop: NutritionLabelCrop;
	onProgress?: (progress: NutritionLabelOcrProgress) => void;
	signal?: AbortSignal;
}): Promise<NutritionLabelOcrRecognition> => {
	onProgress?.({ status: "Preparing bounded label image", progress: 0 });
	const preparedImage = await prepareNutritionLabelOcrImage(file, crop, signal);
	onProgress?.({ status: "Label image ready", progress: 0.08 });
	const result = await runCoordinatedOcrRecognition({
		image: preparedImage,
		parameters: {
			debug_file: "/dev/null",
			preserve_interword_spaces: "1",
			tessedit_pageseg_mode: NUTRITION_LABEL_OCR_PAGE_SEGMENTATION_MODE,
		},
		onProgress: (nextProgress) =>
			onProgress?.({
				status: nextProgress.status,
				progress: 0.08 + nextProgress.progress * 0.92,
			}),
		signal,
		timeoutMilliseconds: NUTRITION_LABEL_OCR_TIMEOUT_MILLISECONDS,
	});
	return {
		text: result.data.text,
		confidence: result.data.confidence,
	};
};
