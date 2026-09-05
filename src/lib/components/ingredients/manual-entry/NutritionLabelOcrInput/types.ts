import type {
	NutritionLabelOcrMapping,
	NutritionLabelOcrProgress,
	NutritionLabelOcrRecognition,
} from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { NutritionLabelOcrApplyPayload } from "../formTypes";

export type NutritionLabelOcrRecognizer = (options: {
	file: File;
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
