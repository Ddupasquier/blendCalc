import { createHash } from "node:crypto";
import type { Json } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import type {
	FoodItem,
	FoodNutrient,
	FoodFieldSource,
	FoodTrackedField,
} from "$lib/utils/food/types";
import { getPrimaryFoodServing } from "$lib/utils/food/servings/foodServings";
import {
	compareNormalizedFoods,
	normalizeComparisonText,
} from "$lib/utils/products/productDifferenceEngine";
import {
	getCatalogUpdateProvenancePaths,
	mergeCatalogUpdateFood,
} from "$lib/utils/products/catalogUpdateMerge";
import type { CatalogSubmissionFieldChange } from "$lib/utils/products/catalogSubmissionComparison";
import {
	getProductDifferenceThresholds,
	type ProductResolutionPolicy,
} from "$lib/utils/products/productResolutionPolicy";
import { createCatalogFoodFromDraft } from "./catalogFood.server";
import type { ResolvedFoodCategory } from "./categoryMapping.server";

export type CatalogObservationSource =
	"usda" | "open-food-facts" | "user-label" | "manufacturer" | "gs1";

export type CatalogObservation = {
	key: string;
	source: CatalogObservationSource;
	sourceReference?: string;
	sourceLicense: string;
	rawPayload: Json;
	normalizedFood: Json;
	contentHash: string;
	observedAt: string;
	expiresAt?: string;
};

export type CatalogFieldProvenance = {
	fieldPath: string;
	observationKey: string;
	sourceValue: Json;
	normalizedValue: Json;
	confidence:
		"source-verified" | "moderator-reviewed" | "corroborated" | "imported";
	verificationMethod: "exact-barcode" | "label-review" | "cross-source";
};

export type CatalogConflict = {
	fieldPath: string;
	observedValues: Json[];
	severity: "low" | "medium" | "high";
};

export type CatalogVerificationBundle = {
	canonicalFood: FoodItem;
	observations: CatalogObservation[];
	provenance: CatalogFieldProvenance[];
	conflicts: CatalogConflict[];
};

const toJson = (value: unknown) => value as Json;

const hashPayload = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

const getReportedNutrientIds = (food: FoodItem) =>
	new Set(
		food.reportedNutrientIds ??
			food.foodNutrients
				.filter((nutrient) => nutrient.valueOrigin === "reported")
				.map((nutrient) => nutrient.nutrientId),
	);

const createObservation = (input: {
	key: string;
	source: CatalogObservationSource;
	sourceReference?: string;
	sourceLicense: string;
	food: FoodItem;
	rawPayload?: unknown;
}): CatalogObservation => {
	const normalizedFood = normalizeFoodForStorage(input.food);
	const rawPayload = input.rawPayload ?? normalizedFood;
	return {
		key: input.key,
		source: input.source,
		sourceReference: input.sourceReference,
		sourceLicense: input.sourceLicense,
		rawPayload: toJson(rawPayload),
		normalizedFood: toJson(normalizedFood),
		contentHash: hashPayload({
			source: input.source,
			sourceReference: input.sourceReference ?? null,
			rawPayload,
		}),
		observedAt: new Date().toISOString(),
	};
};

const addFoodProvenance = (
	food: FoodItem,
	observationKey: string,
	confidence: CatalogFieldProvenance["confidence"],
	verificationMethod: CatalogFieldProvenance["verificationMethod"],
) => {
	const fields: CatalogFieldProvenance[] = [
		{
			fieldPath: "productName",
			observationKey,
			sourceValue: food.description,
			normalizedValue: normalizeComparisonText(food.description),
			confidence,
			verificationMethod,
		},
	];

	if (food.brandOwner?.trim()) {
		fields.push({
			fieldPath: "brandOwner",
			observationKey,
			sourceValue: food.brandOwner,
			normalizedValue: normalizeComparisonText(food.brandOwner),
			confidence,
			verificationMethod,
		});
	}
	const primaryServing = getPrimaryFoodServing(food);
	const servingWeightGrams =
		primaryServing?.gramWeight ?? food.customServingWeightGrams;
	if (servingWeightGrams !== undefined) {
		fields.push({
			fieldPath: "servingWeightGrams",
			observationKey,
			sourceValue: servingWeightGrams,
			normalizedValue: servingWeightGrams,
			confidence,
			verificationMethod,
		});
	}

	const reportedIds = getReportedNutrientIds(food);
	for (const nutrient of food.foodNutrients) {
		if (!reportedIds.has(nutrient.nutrientId)) continue;
		fields.push({
			fieldPath: `nutrient:${nutrient.nutrientId}`,
			observationKey,
			sourceValue: toJson(nutrient),
			normalizedValue: toJson({
				value: nutrient.value,
				unitName: nutrient.unitName.toUpperCase(),
			}),
			confidence,
			verificationMethod,
		});
	}

	const trackedFields: Array<{
		fieldPath: FoodTrackedField;
		include: boolean;
		value: Json;
	}> = [
		{
			fieldPath: "serving",
			include: Boolean(primaryServing),
			value: toJson({
				servingSize: food.servingSize ?? null,
				servingSizeUnit: food.servingSizeUnit ?? null,
				householdServingFullText: food.householdServingFullText ?? null,
				foodServings: food.foodServings ?? [],
			}),
		},
		{
			fieldPath: "categories",
			include: Boolean(food.foodCategory?.trim() || food.categories?.length),
			value: toJson({
				foodCategory: food.foodCategory ?? null,
				categories: food.categories ?? [],
			}),
		},
		{
			fieldPath: "ingredients",
			include: Boolean(food.ingredients?.trim() || food.ingredientList?.length),
			value: toJson({
				ingredients: food.ingredients ?? null,
				ingredientList: food.ingredientList ?? [],
			}),
		},
		{
			fieldPath: "allergens",
			include: Boolean(food.allergens?.length),
			value: toJson(food.allergens ?? []),
		},
		{
			fieldPath: "traces",
			include: Boolean(food.traces?.length),
			value: toJson(food.traces ?? []),
		},
		{
			fieldPath: "precautionaryStatements",
			include: Boolean(food.precautionaryStatements?.length),
			value: toJson(food.precautionaryStatements ?? []),
		},
		{
			fieldPath: "dietaryTags",
			include: Boolean(food.dietaryTags?.length),
			value: toJson(food.dietaryTags ?? []),
		},
		{
			fieldPath: "labels",
			include: Boolean(food.labels?.length),
			value: toJson(food.labels ?? []),
		},
		{
			fieldPath: "structuredIngredients",
			include: Boolean(food.structuredIngredients?.length),
			value: toJson(food.structuredIngredients ?? []),
		},
		{
			fieldPath: "ingredientAnalysis",
			include: Boolean(food.ingredientAnalysis),
			value: toJson(food.ingredientAnalysis ?? null),
		},
		{
			fieldPath: "additives",
			include: Boolean(food.additives?.length),
			value: toJson(food.additives ?? []),
		},
		{
			fieldPath: "package",
			include: Boolean(food.packageQuantity),
			value: toJson(food.packageQuantity ?? null),
		},
		{
			fieldPath: "sourceMetadata",
			include: Boolean(food.sourceMetadata),
			value: toJson(food.sourceMetadata ?? null),
		},
	];
	for (const field of trackedFields) {
		if (!field.include) continue;
		fields.push({
			fieldPath: field.fieldPath,
			observationKey,
			sourceValue: field.value,
			normalizedValue: field.value,
			confidence,
			verificationMethod,
		});
	}

	return fields;
};

const getNumericConflictSeverity = (
	left: number,
	right: number,
	policy: ProductResolutionPolicy,
) => {
	const largest = Math.max(
		Math.abs(left),
		Math.abs(right),
		policy.numericDifferenceRatioFloor,
	);
	const differenceRatio = Math.abs(left - right) / largest;
	const absoluteDifference = Math.abs(left - right);
	return (
		getProductDifferenceThresholds(policy, "catalog-verification-numeric").find(
			(threshold) =>
				differenceRatio >= threshold.minimumDifferenceRatio &&
				absoluteDifference >= threshold.minimumAbsoluteDifference,
		)?.severity ?? null
	);
};

const findFoodConflicts = (
	userFood: FoodItem,
	sourceFood: FoodItem,
	sourceKey: "usda" | "open-food-facts",
	policy: ProductResolutionPolicy,
): CatalogConflict[] => {
	const userReported = getReportedNutrientIds(userFood);
	const sourceReported = getReportedNutrientIds(sourceFood);
	return compareNormalizedFoods(userFood, sourceFood, {
		resolutionPolicy: policy,
		submittedNutrientIds: userReported,
		previousNutrientIds: sourceReported,
		includeAddedNutrients: false,
	}).flatMap((difference): CatalogConflict[] => {
		if (
			!["brandOwner", "servingWeightGrams"].includes(difference.field) &&
			!difference.field.startsWith("nutrient:")
		) {
			return [];
		}
		const severity =
			difference.field === "brandOwner"
				? "medium"
				: difference.unitMismatch
					? "high"
					: typeof difference.submittedValue === "number" &&
						  typeof difference.previousValue === "number"
						? getNumericConflictSeverity(
								difference.submittedValue,
								difference.previousValue,
								policy,
							)
						: difference.submittedNutrient && difference.previousNutrient
							? getNumericConflictSeverity(
									difference.submittedNutrient.value,
									difference.previousNutrient.value,
									policy,
								)
							: null;
		if (!severity) return [];
		const submittedValue =
			difference.submittedNutrient ?? difference.submittedValue;
		const previousValue =
			difference.previousNutrient ?? difference.previousValue;
		return [
			{
				fieldPath: difference.field,
				observedValues: [
					toJson({ source: "user-label", value: submittedValue }),
					toJson({ source: sourceKey, value: previousValue }),
				],
				severity,
			},
		];
	});
};

const preserveFoodMetadata = (food: FoodItem): FoodItem => ({
	...normalizeFoodForStorage(food),
	reportedNutrientIds: [...getReportedNutrientIds(food)],
});

const getCanonicalFieldConfidence = (
	confidence: FoodFieldSource["confidence"] | undefined,
): CatalogFieldProvenance["confidence"] => {
	switch (confidence) {
		case "source-verified":
		case "moderator-reviewed":
		case "corroborated":
		case "imported":
			return confidence;
		default:
			return "imported";
	}
};

export const buildUsdaVerifiedCatalogBundle = (
	userFood: FoodItem,
	usdaDraft: BarcodeProductDraft,
	category: ResolvedFoodCategory,
	policy: ProductResolutionPolicy,
): CatalogVerificationBundle =>
	buildCombinedSourceCatalogBundle(
		userFood,
		usdaDraft,
		[usdaDraft],
		category,
		policy,
	);

export const buildOpenFoodFactsCatalogBundle = (
	userFood: FoodItem,
	openFoodFactsDraft: BarcodeProductDraft,
	category: ResolvedFoodCategory,
	policy: ProductResolutionPolicy,
): CatalogVerificationBundle =>
	buildCombinedSourceCatalogBundle(
		userFood,
		openFoodFactsDraft,
		[openFoodFactsDraft],
		category,
		policy,
	);

export const buildCombinedSourceCatalogBundle = (
	userFood: FoodItem,
	canonicalDraft: BarcodeProductDraft,
	sourceDrafts: BarcodeProductDraft[],
	category: ResolvedFoodCategory,
	policy: ProductResolutionPolicy,
): CatalogVerificationBundle => {
	const canonicalFood = preserveFoodMetadata(
		createCatalogFoodFromDraft(canonicalDraft, category),
	);
	const userObservation = createObservation({
		key: "user-label",
		source: "user-label",
		sourceLicense: "submitted-with-consent",
		food: preserveFoodMetadata(userFood),
	});
	const sourceObservations = sourceDrafts.map((draft) => {
		const source =
			draft.source === "open-food-facts"
				? ("open-food-facts" as const)
				: ("usda" as const);
		return createObservation({
			key: source,
			source,
			sourceReference: draft.sourceReference,
			sourceLicense: source === "usda" ? "CC0-1.0" : "ODbL-1.0",
			food: preserveFoodMetadata(createCatalogFoodFromDraft(draft, category)),
			rawPayload: draft,
		});
	});
	const primaryObservationKey =
		canonicalDraft.source === "open-food-facts" ? "open-food-facts" : "usda";
	const supportedObservationKeys = new Set(
		sourceObservations.map((observation) => observation.key),
	);
	const canonicalProvenance = addFoodProvenance(
		canonicalFood,
		primaryObservationKey,
		"imported",
		"exact-barcode",
	).flatMap((entry): CatalogFieldProvenance[] => {
		if (entry.fieldPath === "productName" || entry.fieldPath === "brandOwner") {
			const source = canonicalDraft.fieldProvenance?.[entry.fieldPath];
			return source && supportedObservationKeys.has(source.source)
				? [
						{
							...entry,
							observationKey: source.source,
							confidence: getCanonicalFieldConfidence(source.confidence),
						},
					]
				: [{ ...entry, confidence: "imported" }];
		}
		if (entry.fieldPath === "servingWeightGrams") {
			const source = canonicalDraft.fieldProvenance?.serving;
			return source && supportedObservationKeys.has(source.source)
				? [
						{
							...entry,
							observationKey: source.source,
							confidence: getCanonicalFieldConfidence(source.confidence),
						},
					]
				: [];
		}
		if (entry.fieldPath.startsWith("nutrient:")) {
			const nutrientId = Number(entry.fieldPath.split(":")[1]);
			const nutrient = canonicalFood.foodNutrients.find(
				(item) => item.nutrientId === nutrientId,
			);
			return nutrient?.source && supportedObservationKeys.has(nutrient.source)
				? [
						{
							...entry,
							observationKey: nutrient.source,
							confidence: getCanonicalFieldConfidence(nutrient.confidence),
						},
					]
				: [];
		}

		const trackedField = entry.fieldPath as FoodTrackedField;
		const source = canonicalDraft.fieldProvenance?.[trackedField];
		return source && supportedObservationKeys.has(source.source)
			? [
					{
						...entry,
						observationKey: source.source,
						confidence: getCanonicalFieldConfidence(source.confidence),
					},
				]
			: [];
	});

	return {
		canonicalFood,
		observations: [userObservation, ...sourceObservations],
		provenance: canonicalProvenance,
		conflicts: findFoodConflicts(
			userFood,
			canonicalFood,
			primaryObservationKey,
			policy,
		),
	};
};

export const buildModeratorReviewedCatalogBundle = (
	userFood: FoodItem,
): CatalogVerificationBundle => {
	const canonicalFood = preserveFoodMetadata(userFood);
	const observation = createObservation({
		key: "user-label",
		source: "user-label",
		sourceLicense: "submitted-with-consent",
		food: canonicalFood,
	});
	return {
		canonicalFood,
		observations: [observation],
		provenance: addFoodProvenance(
			canonicalFood,
			"user-label",
			"moderator-reviewed",
			"label-review",
		),
		conflicts: [],
	};
};

export const buildModeratorReviewedCatalogUpdateBundle = (
	currentFood: FoodItem,
	submittedFood: FoodItem,
	changes: readonly CatalogSubmissionFieldChange[],
): CatalogVerificationBundle => {
	const canonicalFood = preserveFoodMetadata(
		mergeCatalogUpdateFood(currentFood, submittedFood, changes),
	);
	const submittedObservationFood = preserveFoodMetadata(submittedFood);
	const observation = createObservation({
		key: "user-label",
		source: "user-label",
		sourceLicense: "submitted-with-consent",
		food: submittedObservationFood,
	});
	const changedPaths = getCatalogUpdateProvenancePaths(changes);
	return {
		canonicalFood,
		observations: [observation],
		provenance: addFoodProvenance(
			submittedObservationFood,
			"user-label",
			"moderator-reviewed",
			"label-review",
		).filter((entry) => changedPaths.has(entry.fieldPath)),
		conflicts: [],
	};
};

export const mergeMissingNutrients = (
	primary: FoodItem,
	supplement: FoodItem,
): FoodItem => {
	const primaryReported = getReportedNutrientIds(primary);
	const additions: FoodNutrient[] = supplement.foodNutrients.filter(
		(nutrient) => !primaryReported.has(nutrient.nutrientId),
	);
	return {
		...primary,
		foodNutrients: [...primary.foodNutrients, ...additions],
		reportedNutrientIds: [
			...new Set([
				...primaryReported,
				...additions.map((nutrient) => nutrient.nutrientId),
			]),
		],
	};
};
