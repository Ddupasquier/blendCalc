import type {
	NutritionLabelOcrCandidate,
	NutritionLabelOcrQualitativeFact,
	NutritionLabelServingCandidate,
} from "./nutritionLabelOcr.js";

export const NUTRITION_LABEL_OCR_PROCESSOR_VERSION =
	"nutrition-label-tesseract-v2";
export const NUTRITION_LABEL_OCR_JOB_MAX_INPUT_BYTES = 4 * 1024 * 1024;
export const NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION = 1600;
export const NUTRITION_LABEL_OCR_JOB_RETENTION_SECONDS = 24 * 60 * 60;
export const NUTRITION_LABEL_OCR_JOB_POLL_INITIAL_MILLISECONDS = 750;
export const NUTRITION_LABEL_OCR_JOB_POLL_MAX_MILLISECONDS = 4000;

export type NutritionLabelOcrJobCandidate = Pick<
	NutritionLabelOcrCandidate,
	"nutrientId" | "nutrientName" | "value" | "unitName"
>;

export type NutritionLabelOcrJobStatus =
	"queued" | "running" | "completed" | "failed" | "cancelled";

export type NutritionLabelOcrJobResult = {
	candidates: NutritionLabelOcrJobCandidate[];
	qualitativeFacts: NutritionLabelOcrQualitativeFact[];
	serving: NutritionLabelServingCandidate | null;
	confidence: number;
};

export type NutritionLabelOcrJob = {
	id: string;
	status: NutritionLabelOcrJobStatus;
	result: NutritionLabelOcrJobResult | null;
	errorCode: string | null;
	expiresAt: string;
};

export const isNutritionLabelOcrJobStatus = (
	value: unknown,
): value is NutritionLabelOcrJobStatus =>
	value === "queued" ||
	value === "running" ||
	value === "completed" ||
	value === "failed" ||
	value === "cancelled";

export const isNutritionLabelOcrJobResult = (
	value: unknown,
): value is NutritionLabelOcrJobResult => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const candidate = value as Partial<NutritionLabelOcrJobResult>;
	const isBoundedString = (entry: unknown, maximumLength = 200) =>
		typeof entry === "string" &&
		entry.length > 0 &&
		entry.length <= maximumLength;
	const candidatesAreValid =
		Array.isArray(candidate.candidates) &&
		candidate.candidates.length <= 150 &&
		candidate.candidates.every(
			(entry) =>
				entry &&
				typeof entry === "object" &&
				Number.isInteger(entry.nutrientId) &&
				entry.nutrientId > 0 &&
				isBoundedString(entry.nutrientName) &&
				typeof entry.value === "number" &&
				Number.isFinite(entry.value) &&
				entry.value >= 0 &&
				isBoundedString(entry.unitName, 32),
		);
	const qualitativeFactsAreValid =
		Array.isArray(candidate.qualitativeFacts) &&
		candidate.qualitativeFacts.length <= 150 &&
		candidate.qualitativeFacts.every(
			(entry) =>
				entry &&
				typeof entry === "object" &&
				Number.isInteger(entry.nutrientId) &&
				entry.nutrientId > 0 &&
				isBoundedString(entry.nutrientName) &&
				typeof entry.nutrientNumber === "string" &&
				entry.nutrientNumber.length <= 32 &&
				isBoundedString(entry.unitName, 32) &&
				(entry.status === "below-reporting-threshold" ||
					entry.status === "present-unquantified") &&
				isBoundedString(entry.statement, 500) &&
				(entry.maximumAmount === undefined ||
					(typeof entry.maximumAmount === "number" &&
						Number.isFinite(entry.maximumAmount) &&
						entry.maximumAmount >= 0)),
		);
	const servingIsValid =
		candidate.serving === null ||
		(Boolean(candidate.serving) &&
			isBoundedString(candidate.serving?.label, 120) &&
			typeof candidate.serving?.gramWeight === "number" &&
			Number.isFinite(candidate.serving.gramWeight) &&
			candidate.serving.gramWeight > 0);
	return (
		candidatesAreValid &&
		qualitativeFactsAreValid &&
		servingIsValid &&
		typeof candidate.confidence === "number" &&
		Number.isFinite(candidate.confidence) &&
		candidate.confidence >= 0 &&
		candidate.confidence <= 100
	);
};
