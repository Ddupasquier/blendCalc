import type { Json } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { FoodItem } from "$lib/utils/food/types";
import {
	createNutrientValueMapFromFood,
	validateNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { productNamesAreUnrelated } from "$lib/utils/products/productIdentity";
import { compareNormalizedFoods } from "$lib/utils/products/productDifferenceEngine";
import {
	getNumericProductDifferenceSeverity,
	type ProductDifferenceSeverity,
	type ProductResolutionPolicy,
} from "$lib/utils/products/productResolutionPolicy";
import type { ProductSourceFieldMetricIncrement } from "./sourceMetrics.server";
import { createCatalogFoodFromDraft } from "./catalogFood.server";

type ComparableProviderKey = "usda" | "open-food-facts";

export type CatalogSourceAccuracyConflict = {
	fieldPath: string;
	observedValues: Json[];
	severity: ProductDifferenceSeverity;
};

export type CatalogSourceAccuracyAssessment = {
	usdaDraft: BarcodeProductDraft | null;
	openFoodFactsDraft: BarcodeProductDraft | null;
	conflicts: CatalogSourceAccuracyConflict[];
	reviewFlags: string[];
	metricIncrements: ProductSourceFieldMetricIncrement[];
};

const getComparableProviderKey = (
	draft: BarcodeProductDraft,
): ComparableProviderKey | null => {
	switch (draft.source) {
		case "usda":
		case "open-food-facts":
			return draft.source;
		default:
			return null;
	}
};

const createObservedValue = (
	draft: BarcodeProductDraft,
	value: unknown,
): Json =>
	({
		source: draft.source,
		sourceReference: draft.sourceReference ?? null,
		sourcePublishedDate: draft.sourcePublishedDate ?? null,
		sourceModifiedDate: draft.sourceModifiedDate ?? null,
		value,
	}) as Json;

const createMetricIncrement = (
	draft: BarcodeProductDraft,
	fieldPath: string,
	increment: Omit<ProductSourceFieldMetricIncrement, "sourceKey" | "fieldPath">,
): ProductSourceFieldMetricIncrement | null => {
	const sourceKey = getComparableProviderKey(draft);
	return sourceKey ? { sourceKey, fieldPath, ...increment } : null;
};

export const assessProviderDraftNutrientAccuracy = (
	draft: BarcodeProductDraft | null,
	rules: readonly NutrientRelationshipRule[] | null,
) => {
	if (!draft) {
		return {
			draft: null,
			metricIncrements: [] as ProductSourceFieldMetricIncrement[],
		};
	}
	if (!rules) {
		const fieldProvenance = { ...draft.fieldProvenance };
		delete fieldProvenance.nutrition;
		return {
			draft: {
				...draft,
				nutrients: [],
				nutrientQualitativeFacts: [],
				reportedNutrientIds: [],
				fieldProvenance,
			},
			metricIncrements: [] as ProductSourceFieldMetricIncrement[],
		};
	}

	const food = createCatalogFoodFromDraft(draft);
	const issues = validateNutrientRelationshipRules(
		createNutrientValueMapFromFood(food),
		[...rules],
	);
	const invalidNutrientIds = new Set(
		issues.map((issue) => issue.childNutrientId),
	);
	const metricIncrements = [...invalidNutrientIds].flatMap(
		(nutrientId): ProductSourceFieldMetricIncrement[] => {
			const increment = createMetricIncrement(draft, `nutrient:${nutrientId}`, {
				evaluatedCount: 1,
				internallyInvalidCount: 1,
			});
			return increment ? [increment] : [];
		},
	);

	if (invalidNutrientIds.size === 0) {
		return { draft, metricIncrements };
	}

	const nutrients = draft.nutrients.filter(
		(nutrient) => !invalidNutrientIds.has(nutrient.nutrientId),
	);
	const fieldProvenance = { ...draft.fieldProvenance };
	if (nutrients.length === 0) delete fieldProvenance.nutrition;

	return {
		draft: {
			...draft,
			nutrients,
			reportedNutrientIds: draft.reportedNutrientIds.filter(
				(nutrientId) => !invalidNutrientIds.has(nutrientId),
			),
			fieldProvenance,
		},
		metricIncrements,
	};
};

const getReportedNutrientMap = (draft: BarcodeProductDraft) => {
	const reportedIds = new Set(draft.reportedNutrientIds);
	const food = createCatalogFoodFromDraft(draft);
	return new Map(
		food.foodNutrients
			.filter((nutrient) => reportedIds.has(nutrient.nutrientId))
			.map((nutrient) => [nutrient.nutrientId, nutrient]),
	);
};

const addConflictMetrics = (
	metricIncrements: ProductSourceFieldMetricIncrement[],
	leftDraft: BarcodeProductDraft,
	rightDraft: BarcodeProductDraft,
	fieldPath: string,
) => {
	for (const draft of [leftDraft, rightDraft]) {
		const increment = createMetricIncrement(draft, fieldPath, {
			evaluatedCount: 1,
			crossSourceDisagreementCount: 1,
		});
		if (increment) metricIncrements.push(increment);
	}
};

const compareProviderDrafts = (
	leftDraft: BarcodeProductDraft,
	rightDraft: BarcodeProductDraft,
	policy: ProductResolutionPolicy,
) => {
	const conflicts: CatalogSourceAccuracyConflict[] = [];
	const metricIncrements: ProductSourceFieldMetricIncrement[] = [];
	const addConflict = (
		fieldPath: string,
		leftValue: unknown,
		rightValue: unknown,
		severity: ProductDifferenceSeverity,
	) => {
		conflicts.push({
			fieldPath,
			observedValues: [
				createObservedValue(leftDraft, leftValue),
				createObservedValue(rightDraft, rightValue),
			],
			severity,
		});
		addConflictMetrics(metricIncrements, leftDraft, rightDraft, fieldPath);
	};

	if (
		productNamesAreUnrelated(
			leftDraft.name,
			rightDraft.name,
			policy.minimumRelatedNameTokenOverlap,
		)
	) {
		addConflict("productName", leftDraft.name, rightDraft.name, "high");
	}

	if (
		leftDraft.brandOwner.trim() &&
		rightDraft.brandOwner.trim() &&
		productNamesAreUnrelated(
			leftDraft.brandOwner,
			rightDraft.brandOwner,
			policy.minimumRelatedNameTokenOverlap,
		)
	) {
		addConflict(
			"brandOwner",
			leftDraft.brandOwner,
			rightDraft.brandOwner,
			"medium",
		);
	}

	if (
		leftDraft.hasSourceServing &&
		rightDraft.hasSourceServing &&
		leftDraft.servingWeightGrams !== null &&
		rightDraft.servingWeightGrams !== null
	) {
		const severity = getNumericProductDifferenceSeverity(
			policy,
			"catalog-verification-numeric",
			leftDraft.servingWeightGrams,
			rightDraft.servingWeightGrams,
		);
		if (severity) {
			addConflict(
				"servingWeightGrams",
				{
					label: leftDraft.servingLabel,
					grams: leftDraft.servingWeightGrams,
				},
				{
					label: rightDraft.servingLabel,
					grams: rightDraft.servingWeightGrams,
				},
				severity,
			);
		}
	}

	const leftNutrients = getReportedNutrientMap(leftDraft);
	const rightNutrients = getReportedNutrientMap(rightDraft);
	for (const [nutrientId, leftNutrient] of leftNutrients) {
		const rightNutrient = rightNutrients.get(nutrientId);
		if (!rightNutrient) continue;
		const fieldPath = `nutrient:${nutrientId}`;
		if (
			leftNutrient.unitName.toLocaleUpperCase() !==
			rightNutrient.unitName.toLocaleUpperCase()
		) {
			addConflict(fieldPath, leftNutrient, rightNutrient, "high");
			continue;
		}
		const severity = getNumericProductDifferenceSeverity(
			policy,
			"catalog-verification-numeric",
			leftNutrient.value,
			rightNutrient.value,
		);
		if (severity) {
			addConflict(fieldPath, leftNutrient, rightNutrient, severity);
		}
	}

	return { conflicts, metricIncrements };
};

const createReviewFlags = (conflicts: CatalogSourceAccuracyConflict[]) =>
	conflicts
		.filter((conflict) => conflict.severity !== "low")
		.map(
			(conflict) =>
				`Trusted source records materially disagree about ${conflict.fieldPath}. Review the current package label before sharing this product.`,
		);

export const assessCatalogSourceAccuracy = ({
	usdaDraft,
	openFoodFactsDraft,
	nutrientRelationshipRules,
	policy,
}: {
	usdaDraft: BarcodeProductDraft | null;
	openFoodFactsDraft: BarcodeProductDraft | null;
	nutrientRelationshipRules: readonly NutrientRelationshipRule[];
	policy: ProductResolutionPolicy;
}): CatalogSourceAccuracyAssessment => {
	const sanitizedUsda = assessProviderDraftNutrientAccuracy(
		usdaDraft,
		nutrientRelationshipRules,
	);
	const sanitizedOpenFoodFacts = assessProviderDraftNutrientAccuracy(
		openFoodFactsDraft,
		nutrientRelationshipRules,
	);
	const comparison =
		sanitizedUsda.draft && sanitizedOpenFoodFacts.draft
			? compareProviderDrafts(
					sanitizedUsda.draft,
					sanitizedOpenFoodFacts.draft,
					policy,
				)
			: { conflicts: [], metricIncrements: [] };

	return {
		usdaDraft: sanitizedUsda.draft,
		openFoodFactsDraft: sanitizedOpenFoodFacts.draft,
		conflicts: comparison.conflicts,
		reviewFlags: createReviewFlags(comparison.conflicts),
		metricIncrements: [
			...sanitizedUsda.metricIncrements,
			...sanitizedOpenFoodFacts.metricIncrements,
			...comparison.metricIncrements,
		],
	};
};

export const addSelectedSourceFieldMetrics = (
	metricIncrements: readonly ProductSourceFieldMetricIncrement[],
	mergedDraft: BarcodeProductDraft | null,
) => {
	if (!mergedDraft) return [...metricIncrements];
	const selected: ProductSourceFieldMetricIncrement[] = [];
	for (const [fieldPath, provenance] of Object.entries(
		mergedDraft.fieldProvenance ?? {},
	)) {
		if (!provenance) continue;
		const sourceKey =
			provenance.source === "usda" || provenance.source === "open-food-facts"
				? provenance.source
				: null;
		if (!sourceKey) continue;
		selected.push({
			sourceKey,
			fieldPath,
			evaluatedCount: 1,
			selectedCount: 1,
		});
	}
	for (const nutrient of mergedDraft.nutrients) {
		if (nutrient.source !== "usda" && nutrient.source !== "open-food-facts") {
			continue;
		}
		selected.push({
			sourceKey: nutrient.source,
			fieldPath: `nutrient:${nutrient.nutrientId}`,
			evaluatedCount: 1,
			selectedCount: 1,
		});
	}
	return [...metricIncrements, ...selected];
};

export const findSubmittedLabelDisagreementMetrics = (
	submittedFood: FoodItem,
	sourceDraft: BarcodeProductDraft,
	policy: ProductResolutionPolicy,
): ProductSourceFieldMetricIncrement[] => {
	const sourceKey = getComparableProviderKey(sourceDraft);
	if (!sourceKey) return [];
	const submittedNutrientIds = new Set(
		submittedFood.reportedNutrientIds ??
			submittedFood.foodNutrients.map((nutrient) => nutrient.nutrientId),
	);
	const sourceNutrientIds = new Set(sourceDraft.reportedNutrientIds);
	return compareNormalizedFoods(
		submittedFood,
		createCatalogFoodFromDraft(sourceDraft),
		{
			resolutionPolicy: policy,
			submittedNutrientIds,
			previousNutrientIds: sourceNutrientIds,
			includeAddedNutrients: false,
		},
	).flatMap((difference): ProductSourceFieldMetricIncrement[] => {
		if (
			difference.field === "productName" ||
			difference.field === "brandOwner"
		) {
			return difference.textRelationship === "unrelated"
				? [
						{
							sourceKey,
							fieldPath: difference.field,
							evaluatedCount: 1,
							submittedLabelDisagreementCount: 1,
						},
					]
				: [];
		}
		if (
			difference.field === "servingWeightGrams" &&
			!sourceDraft.hasSourceServing
		) {
			return [];
		}
		if (
			difference.field !== "servingWeightGrams" &&
			!difference.field.startsWith("nutrient:")
		) {
			return [];
		}
		const severity = difference.unitMismatch
			? "high"
			: typeof difference.submittedValue === "number" &&
				  typeof difference.previousValue === "number"
				? getNumericProductDifferenceSeverity(
						policy,
						"catalog-verification-numeric",
						difference.submittedValue,
						difference.previousValue,
					)
				: difference.submittedNutrient && difference.previousNutrient
					? getNumericProductDifferenceSeverity(
							policy,
							"catalog-verification-numeric",
							difference.submittedNutrient.value,
							difference.previousNutrient.value,
						)
					: null;
		return severity
			? [
					{
						sourceKey,
						fieldPath: difference.field,
						evaluatedCount: 1,
						submittedLabelDisagreementCount: 1,
					},
				]
			: [];
	});
};
