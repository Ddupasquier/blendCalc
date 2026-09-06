import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { NutritionLabelCrop } from "$lib/utils/food/ocr/nutritionLabelOcr.client";
import type { NutritionLabelOcrApplyPayload } from "../formTypes";
import type {
	NutritionLabelOcrJobResult,
	NutritionLabelOcrJobStatus,
} from "$lib/utils/food/ocr/nutritionLabelOcrJobs";

export type NutritionLabelOcrJobRunner = (options: {
	file: File;
	crop: NutritionLabelCrop;
	onPrepared?: () => void;
	onJobId?: (jobId: string) => void;
	onStatus?: (status: NutritionLabelOcrJobStatus) => void;
	onUploadProgress?: (progress: number | null) => void;
	signal?: AbortSignal;
}) => Promise<{ jobId: string; result: NutritionLabelOcrJobResult }>;

export type NutritionLabelOcrInputProps = {
	mappings: NutritionLabelOcrMapping[];
	photo: File | null;
	runJob?: NutritionLabelOcrJobRunner;
	onPhotoChange: (file: File | null) => void;
	onApply: (payload: NutritionLabelOcrApplyPayload) => void;
};
