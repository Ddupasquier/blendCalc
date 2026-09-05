import type {
	NutritionLabelOcrMapping,
	NutritionLabelOcrProgress,
	NutritionLabelOcrRecognition,
} from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { NutritionLabelCrop } from "$lib/utils/food/ocr/nutritionLabelOcr.client";
import type { NutritionLabelOcrApplyPayload } from "../formTypes";

export type NutritionLabelOcrRecognizer = (options: {
	file: File;
	crop: NutritionLabelCrop;
	onProgress?: (progress: NutritionLabelOcrProgress) => void;
	signal?: AbortSignal;
}) => Promise<NutritionLabelOcrRecognition>;

export type NutritionLabelOcrInputProps = {
	mappings: NutritionLabelOcrMapping[];
	photo: File | null;
	recognize?: NutritionLabelOcrRecognizer;
	onPhotoChange: (file: File | null) => void;
	onApply: (payload: NutritionLabelOcrApplyPayload) => void;
};
