import {
	EXACT_IDENTITY_RESOLVABLE_FIELDS,
	FOOD_FIELD_CONFIDENCE_RANK,
	applySelectedFoodField,
	getFoodEvidenceTimestamp,
	getFoodFieldCompleteness,
	getFoodSourceAttributions,
} from "$lib/utils/food/records/exactIdentityFoodResolution";
import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
import type {
	FoodFieldSource,
	FoodItem,
	FoodNutrient,
	FoodProvenanceField,
	FoodSourceEnrichmentDecision,
	FoodSourceEnrichmentReason,
} from "$lib/utils/food/types";

const REVIEW_STATE_RANK: Record<
	NonNullable<FoodFieldSource["reviewState"]>,
	number
> = {
	unreviewed: 0,
	accepted: 1,
	"moderator-reviewed": 2,
};

const getFieldImprovementReason = ({
	currentFood,
	sourceFood,
	field,
	currentSource,
	source,
}: {
	currentFood: FoodItem;
	sourceFood: FoodItem;
	field: FoodProvenanceField;
	currentSource?: FoodFieldSource;
	source: FoodFieldSource;
}): FoodSourceEnrichmentReason | null => {
	const currentCompleteness = getFoodFieldCompleteness(currentFood, field);
	const sourceCompleteness = getFoodFieldCompleteness(sourceFood, field);
	if (sourceCompleteness === 0) return null;
	if (currentCompleteness === 0) return "missing-current-value";
	if (!currentSource) return null;
	if (currentSource.source === "user-label") return null;

	const reviewStateDifference =
		REVIEW_STATE_RANK[source.reviewState ?? "unreviewed"] -
		REVIEW_STATE_RANK[currentSource.reviewState ?? "unreviewed"];
	if (reviewStateDifference > 0) return "stronger-review-state";
	if (reviewStateDifference < 0) return null;

	const confidenceDifference =
		FOOD_FIELD_CONFIDENCE_RANK[source.confidence ?? "unknown"] -
		FOOD_FIELD_CONFIDENCE_RANK[currentSource.confidence ?? "unknown"];
	if (confidenceDifference > 0) return "stronger-confidence";
	if (confidenceDifference < 0) return null;

	if (sourceCompleteness > currentCompleteness) return "more-complete-evidence";
	if (sourceCompleteness < currentCompleteness) return null;

	return getFoodEvidenceTimestamp(sourceFood, source) >
		getFoodEvidenceTimestamp(currentFood, currentSource)
		? "newer-observation"
		: null;
};

const isUsableNutrient = (nutrient: FoodNutrient) =>
	Number.isSafeInteger(nutrient.nutrientId) &&
	nutrient.nutrientId > 0 &&
	Number.isFinite(nutrient.value) &&
	nutrient.value >= 0;

const getNutrientEvidenceRank = (nutrient: FoodNutrient) => {
	if (nutrient.valueOrigin === "reported") return 3;
	if (nutrient.valueOrigin === "derived") return 2;
	if (nutrient.valueOrigin === "estimated") return 1;
	return 0;
};

const getNutrientSource = (
	food: FoodItem,
	nutrient: FoodNutrient,
): FoodFieldSource | undefined => {
	const fieldSource = food.fieldProvenance?.nutrition;
	if (nutrient.source) {
		const matchingFieldSource = fieldSource?.source === nutrient.source
			? fieldSource
			: undefined;
		return {
			source: nutrient.source,
			sourceReference:
				nutrient.sourceReference ?? matchingFieldSource?.sourceReference,
			confidence: nutrient.confidence ?? matchingFieldSource?.confidence,
			observationId: matchingFieldSource?.observationId,
			observedAt: matchingFieldSource?.observedAt,
			verificationMethod: matchingFieldSource?.verificationMethod,
			reviewState: matchingFieldSource?.reviewState,
		};
	}
	return fieldSource?.source === "shared-catalog" ||
		fieldSource?.source === "wikimedia-commons"
		? undefined
		: fieldSource;
};

const getNutrientImprovementReason = ({
	currentFood,
	sourceFood,
	currentNutrient,
	sourceNutrient,
	currentSource,
	source,
}: {
	currentFood: FoodItem;
	sourceFood: FoodItem;
	currentNutrient?: FoodNutrient;
	sourceNutrient: FoodNutrient;
	currentSource?: FoodFieldSource;
	source: FoodFieldSource;
}): FoodSourceEnrichmentReason | null => {
	if (!currentNutrient) return "missing-current-value";
	if (!currentSource) return null;
	if (currentSource.source === "user-label") return null;

	const reviewStateDifference =
		REVIEW_STATE_RANK[source.reviewState ?? "unreviewed"] -
		REVIEW_STATE_RANK[currentSource.reviewState ?? "unreviewed"];
	if (reviewStateDifference > 0) return "stronger-review-state";
	if (reviewStateDifference < 0) return null;

	const confidenceDifference =
		FOOD_FIELD_CONFIDENCE_RANK[source.confidence ?? "unknown"] -
		FOOD_FIELD_CONFIDENCE_RANK[currentSource.confidence ?? "unknown"];
	if (confidenceDifference > 0) return "stronger-confidence";
	if (confidenceDifference < 0) return null;

	const evidenceDifference =
		getNutrientEvidenceRank(sourceNutrient) -
		getNutrientEvidenceRank(currentNutrient);
	if (evidenceDifference > 0) return "more-complete-evidence";
	if (evidenceDifference < 0) return null;

	const reviewedMappingDifference =
		Number(Boolean(sourceNutrient.mappingReviewReference)) -
		Number(Boolean(currentNutrient.mappingReviewReference));
	if (reviewedMappingDifference > 0) return "more-complete-evidence";
	if (reviewedMappingDifference < 0) return null;

	return getFoodEvidenceTimestamp(sourceFood, source) >
		getFoodEvidenceTimestamp(currentFood, currentSource)
		? "newer-observation"
		: null;
};

const resolveNutrients = (
	currentFood: FoodItem,
	sourceFood: FoodItem,
) => {
	const nutrientMap = new Map(
		currentFood.foodNutrients
			.filter(isUsableNutrient)
			.map((nutrient) => [nutrient.nutrientId, nutrient]),
	);
	const decisions: FoodSourceEnrichmentDecision[] = [];

	for (const sourceNutrient of sourceFood.foodNutrients.filter(isUsableNutrient)) {
		const source = getNutrientSource(sourceFood, sourceNutrient);
		if (!source) continue;
		const currentNutrient = nutrientMap.get(sourceNutrient.nutrientId);
		const currentSource = currentNutrient
			? getNutrientSource(currentFood, currentNutrient)
			: undefined;
		const reason = getNutrientImprovementReason({
			currentFood,
			sourceFood,
			currentNutrient,
			sourceNutrient,
			currentSource,
			source,
		});
		if (!reason) continue;

		nutrientMap.set(sourceNutrient.nutrientId, {
			...sourceNutrient,
			source: source.source === "shared-catalog" ||
				source.source === "wikimedia-commons"
				? sourceNutrient.source
				: source.source,
			sourceReference: source.sourceReference,
			confidence: source.confidence,
		});
		decisions.push({
			field: "nutrition",
			nutrientId: sourceNutrient.nutrientId,
			reason,
			selectedSource: source,
			previousSource: currentSource,
		});
	}

	const foodNutrients = [...nutrientMap.values()].sort(
		(left, right) => left.nutrientId - right.nutrientId,
	);
	const reportedNutrientIds = [
		...new Set([
			...(currentFood.reportedNutrientIds ?? []),
			...decisions.flatMap((decision) =>
				decision.nutrientId !== undefined &&
				(sourceFood.reportedNutrientIds?.includes(decision.nutrientId) ||
					sourceFood.foodNutrients.find(
						(nutrient) => nutrient.nutrientId === decision.nutrientId,
					)?.valueOrigin === "reported")
					? [decision.nutrientId]
					: []
			),
		]),
	].filter((nutrientId) => nutrientMap.has(nutrientId));

	return { foodNutrients, reportedNutrientIds, decisions };
};

const mergeRecordValues = (
	current: Record<string, string> | undefined,
	source: Record<string, string> | undefined,
) => {
	const merged = { ...(current ?? {}), ...(source ?? {}) };
	return Object.keys(merged).length > 0 ? merged : undefined;
};

const mergeAttributions = (current: FoodItem, source: FoodItem) => {
	const attributions = [
		...getFoodSourceAttributions(current),
		...getFoodSourceAttributions(source),
	];
	return [...new Map(
		attributions.map((attribution) => [
			`${attribution.datasetKey}:${attribution.datasetVersion}:${attribution.sourceUrl}`,
			attribution,
		]),
	).values()];
};

export const enrichListFoodWithExactSourceEvidence = (
	current: FoodItem,
	source: FoodItem,
): FoodItem => {
	if (isPrivateCustomFood(current)) return current;

	let result: FoodItem = {
		...current,
		canonicalDescription:
			current.canonicalDescription ??
			source.canonicalDescription ??
			(current.nameProvenance === "user" ? source.description : undefined),
		dataType: current.dataType ?? source.dataType,
		foodIdentityType: current.foodIdentityType ?? source.foodIdentityType,
		sourceIdentifiers: mergeRecordValues(
			current.sourceIdentifiers,
			source.sourceIdentifiers,
		),
		barcode: current.barcode ?? source.barcode,
		barcodeSource: current.barcodeSource ?? source.barcodeSource,
		barcodeProvenance: current.barcodeProvenance ?? source.barcodeProvenance,
		gtinUpc: current.gtinUpc ?? source.gtinUpc,
		sharedProductId: current.sharedProductId ?? source.sharedProductId,
		sharedProductSubmissionId:
			current.sharedProductSubmissionId ?? source.sharedProductSubmissionId,
		sharedProductConfidence:
			current.sharedProductConfidence ?? source.sharedProductConfidence,
		trustStatus: current.trustStatus ?? source.trustStatus,
		sourceKey: current.sourceKey ?? source.sourceKey,
		sourceLabel: current.sourceLabel ?? source.sourceLabel,
		sourceDataType: current.sourceDataType ?? source.sourceDataType,
		listAddedAt: current.listAddedAt,
		customDensityGramsPerMilliliter:
			current.customDensityGramsPerMilliliter ??
			source.customDensityGramsPerMilliliter,
		customDensityLabel: current.customDensityLabel ?? source.customDensityLabel,
		customDensityVariancePercent:
			current.customDensityVariancePercent ?? source.customDensityVariancePercent,
		customDensityConfidence:
			current.customDensityConfidence ?? source.customDensityConfidence,
	};
	const fieldProvenance = { ...(current.fieldProvenance ?? {}) };
	const decisions: FoodSourceEnrichmentDecision[] = [
		...(current.sourceEnrichmentDecisions ?? []),
	];

	for (const field of EXACT_IDENTITY_RESOLVABLE_FIELDS) {
		if (field === "productName" && current.nameProvenance === "user") continue;
		if (field === "categories" && current.categoryOptionId) continue;
		const sourceField = source.fieldProvenance?.[field];
		if (!sourceField) continue;
		const currentField = current.fieldProvenance?.[field];
		const reason = getFieldImprovementReason({
			currentFood: current,
			sourceFood: source,
			field,
			currentSource: currentField,
			source: sourceField,
		});
		if (!reason) continue;

		result = applySelectedFoodField(result, field, source);
		fieldProvenance[field] = sourceField;
		decisions.push({
			field,
			reason,
			selectedSource: sourceField,
			previousSource: currentField,
		});
	}

	const nutrientResolution = resolveNutrients(current, source);
	result.foodNutrients = nutrientResolution.foodNutrients;
	result.reportedNutrientIds = nutrientResolution.reportedNutrientIds;
	decisions.push(...nutrientResolution.decisions);
	if (nutrientResolution.decisions.length > 0) {
		const nutrientSources = result.foodNutrients.map((nutrient) =>
			getNutrientSource(result, nutrient)
		);
		const sourceKeys = new Set(nutrientSources.map((nutrientSource) =>
			nutrientSource
				? `${nutrientSource.source}:${nutrientSource.sourceReference ?? ""}:${nutrientSource.confidence ?? "unknown"}`
				: "missing"
		));
		if (sourceKeys.size === 1 && nutrientSources[0]) {
			fieldProvenance.nutrition = nutrientSources[0];
		} else {
			delete fieldProvenance.nutrition;
		}
	}

	const sourceAttributions = mergeAttributions(current, source);
	return {
		...result,
		fieldProvenance: Object.keys(fieldProvenance).length > 0
			? fieldProvenance
			: undefined,
		sourceAttribution:
			current.sourceAttribution ?? source.sourceAttribution ?? sourceAttributions[0],
		sourceAttributions:
			sourceAttributions.length > 0 ? sourceAttributions : undefined,
		sourceEnrichmentDecisions: decisions.length > 0 ? decisions : undefined,
		customFood: current.customFood,
	};
};
