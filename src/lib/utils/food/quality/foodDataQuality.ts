import type {
	FdcFood,
	FoodSourceRecordMetadata,
} from "$lib/utils/food/types";

export type FoodDataQualityCode =
	| "SOURCE_RECORD_OBSOLETE"
	| "SOURCE_RECORD_ERROR"
	| "SOURCE_RECORD_WARNING"
	| "SOURCE_RECORD_PARTIAL"
	| "SOURCE_RECORD_QUALITY_NOTES"
	| "ACCEPTED_FIELDS_COMBINE_SOURCES"
	| "SOURCE_METADATA_COMBINES_RECORDS"
	| "NUTRIENT_VALUES_DERIVED"
	| "NUTRIENT_STANDARD_ERROR_REPORTED"
	| "NUTRIENT_SOURCE_VALUES_UNQUANTIFIED"
	| "NUTRIENT_SOURCE_VALUES_MISSING"
	| "NUTRIENT_SOURCE_ROWS_UNMAPPED";

export type FoodDataQualityNotice = {
	code: FoodDataQualityCode;
	count?: number;
	percentage?: number;
};

export type FoodDataQualityDisclosure = {
	notices: FoodDataQualityNotice[];
	schemaVersion?: number;
};

const hasValues = (values?: string[]) =>
	Boolean(values?.some((value) => value.trim()));

const getCompletenessPercentage = (
	metadata: FoodSourceRecordMetadata | undefined,
) => {
	const completeness = metadata?.completeness;
	return Number.isFinite(completeness) &&
		completeness !== undefined &&
		completeness >= 0 &&
		completeness < 1
		? Math.round(completeness * 100)
		: undefined;
};

const getAcceptedFieldSourceCount = (food: FdcFood) =>
	new Set(
		Object.values(food.fieldProvenance ?? {})
			.flatMap((source) =>
				source?.source && source.source !== "shared-catalog"
					? [source.source]
					: []
			),
	).size;

const getSourceMetadataRecordCount = (
	metadata: FoodSourceRecordMetadata | undefined,
) =>
	new Set(
		Object.values(metadata?.tagSources ?? {})
			.flatMap((sources) => sources)
			.map((source) => source.trim())
			.filter(Boolean),
	).size;

export const getFoodDataQualityDisclosure = (
	food: FdcFood,
): FoodDataQualityDisclosure | null => {
	const metadata = food.sourceMetadata;
	const notices: FoodDataQualityNotice[] = [];
	const completenessPercentage = getCompletenessPercentage(metadata);
	const acceptedFieldSourceCount = getAcceptedFieldSourceCount(food);
	const sourceMetadataRecordCount = getSourceMetadataRecordCount(metadata);
	const hasSourceErrors = hasValues(metadata?.qualityErrorTags);
	const hasSourceWarnings = hasValues(metadata?.qualityWarningTags);
	const derivedNutrientCount = food.foodNutrients.filter((nutrient) =>
		nutrient.valueStatus === "derived" || nutrient.valueOrigin === "derived"
	).length;
	const standardErrorCount = food.foodNutrients.filter((nutrient) =>
		Number.isFinite(nutrient.standardError) && Number(nutrient.standardError) >= 0
	).length;
	const unquantifiedCount = (food.nutrientSourceReview ?? []).filter((entry) =>
		entry.valueStatus === "trace" || entry.valueStatus === "present-unquantified"
	).length;
	const missingCount = (food.nutrientSourceReview ?? []).filter(
		(entry) => entry.valueStatus === "missing",
	).length;
	const unmappedCount = (food.nutrientSourceReview ?? []).filter(
		(entry) => entry.mappingStatus === "unmapped",
	).length;

	if (metadata?.obsolete === true) {
		notices.push({ code: "SOURCE_RECORD_OBSOLETE" });
	}
	if (hasSourceErrors) {
		notices.push({ code: "SOURCE_RECORD_ERROR" });
	}
	if (hasSourceWarnings) {
		notices.push({ code: "SOURCE_RECORD_WARNING" });
	}
	if (completenessPercentage !== undefined) {
		notices.push({
			code: "SOURCE_RECORD_PARTIAL",
			percentage: completenessPercentage,
		});
	}
	if (
		!hasSourceErrors &&
		!hasSourceWarnings &&
		hasValues(metadata?.qualityTags)
	) {
		notices.push({ code: "SOURCE_RECORD_QUALITY_NOTES" });
	}
	if (acceptedFieldSourceCount > 1) {
		notices.push({
			code: "ACCEPTED_FIELDS_COMBINE_SOURCES",
			count: acceptedFieldSourceCount,
		});
	} else if (sourceMetadataRecordCount > 1) {
		notices.push({
			code: "SOURCE_METADATA_COMBINES_RECORDS",
			count: sourceMetadataRecordCount,
		});
	}
	if (derivedNutrientCount > 0) {
		notices.push({ code: "NUTRIENT_VALUES_DERIVED", count: derivedNutrientCount });
	}
	if (standardErrorCount > 0) {
		notices.push({
			code: "NUTRIENT_STANDARD_ERROR_REPORTED",
			count: standardErrorCount,
		});
	}
	if (unquantifiedCount > 0) {
		notices.push({
			code: "NUTRIENT_SOURCE_VALUES_UNQUANTIFIED",
			count: unquantifiedCount,
		});
	}
	if (missingCount > 0) {
		notices.push({
			code: "NUTRIENT_SOURCE_VALUES_MISSING",
			count: missingCount,
		});
	}
	if (unmappedCount > 0) {
		notices.push({
			code: "NUTRIENT_SOURCE_ROWS_UNMAPPED",
			count: unmappedCount,
		});
	}

	if (notices.length === 0) return null;
	return {
		notices,
		...(Number.isSafeInteger(metadata?.schemaVersion) &&
				(metadata?.schemaVersion ?? 0) >= 0
			? { schemaVersion: metadata?.schemaVersion }
			: {}),
	};
};
