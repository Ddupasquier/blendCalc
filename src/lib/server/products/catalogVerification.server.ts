import { createHash } from "node:crypto";
import type { Json } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { compactFood } from "$lib/utils/food/records/foodRecords";
import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
import {
	compareNormalizedFoods,
	normalizeComparisonText,
} from "$lib/utils/products/productDifferenceEngine";
import { createCatalogFoodFromDraft } from "./catalogFood.server";
import type { ResolvedFoodCategory } from "./categoryMapping.server";

export type CatalogObservationSource =
	| "usda"
	| "open-food-facts"
	| "user-label"
	| "manufacturer"
	| "gs1";

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
		| "source-verified"
		| "moderator-reviewed"
		| "corroborated"
		| "imported";
	verificationMethod: "exact-barcode" | "label-review" | "cross-source";
};

export type CatalogConflict = {
	fieldPath: string;
	observedValues: Json[];
	severity: "low" | "medium" | "high";
};

export type CatalogVerificationBundle = {
	canonicalFood: FdcFood;
	observations: CatalogObservation[];
	provenance: CatalogFieldProvenance[];
	conflicts: CatalogConflict[];
};

const toJson = (value: unknown) => value as Json;

const hashPayload = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

const getReportedNutrientIds = (food: FdcFood) =>
	new Set(
		food.reportedNutrientIds ?? food.foodNutrients
			.filter((nutrient) => nutrient.valueOrigin === "reported")
			.map((nutrient) => nutrient.nutrientId),
	);

const createObservation = (input: {
	key: string;
	source: CatalogObservationSource;
	sourceReference?: string;
	sourceLicense: string;
	food: FdcFood;
	rawPayload?: unknown;
}): CatalogObservation => {
	const normalizedFood = compactFood(input.food);
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
	food: FdcFood,
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
	if (food.customServingWeightGrams || food.servingSize) {
		const value = food.customServingWeightGrams ?? food.servingSize ?? 100;
		fields.push({
			fieldPath: "servingWeightGrams",
			observationKey,
			sourceValue: value,
			normalizedValue: value,
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

	return fields;
};

const getNumericConflictSeverity = (left: number, right: number) => {
	const largest = Math.max(Math.abs(left), Math.abs(right), 0.001);
	const differenceRatio = Math.abs(left - right) / largest;
	if (differenceRatio >= 0.25) return "high" as const;
	if (differenceRatio >= 0.1) return "medium" as const;
	return differenceRatio >= 0.03 ? "low" as const : null;
};

const findFoodConflicts = (
	userFood: FdcFood,
	sourceFood: FdcFood,
	sourceKey: "usda" | "open-food-facts",
): CatalogConflict[] => {
	const userReported = getReportedNutrientIds(userFood);
	const sourceReported = getReportedNutrientIds(sourceFood);
	return compareNormalizedFoods(userFood, sourceFood, {
		submittedNutrientIds: userReported,
		previousNutrientIds: sourceReported,
		includeAddedNutrients: false,
	}).flatMap((difference): CatalogConflict[] => {
		if (![
			"brandOwner",
			"servingWeightGrams",
		].includes(difference.field) && !difference.field.startsWith("nutrient:")) {
			return [];
		}
		const severity = difference.field === "brandOwner"
			? "medium"
			: difference.unitMismatch
				? "high"
				: typeof difference.submittedValue === "number" &&
						typeof difference.previousValue === "number"
					? getNumericConflictSeverity(
						difference.submittedValue,
						difference.previousValue,
					)
					: difference.submittedNutrient && difference.previousNutrient
						? getNumericConflictSeverity(
							difference.submittedNutrient.value,
							difference.previousNutrient.value,
						)
						: null;
		if (!severity) return [];
		const submittedValue = difference.submittedNutrient ??
			difference.submittedValue;
		const previousValue = difference.previousNutrient ??
			difference.previousValue;
		return [{
			fieldPath: difference.field,
			observedValues: [
				toJson({ source: "user-label", value: submittedValue }),
				toJson({ source: sourceKey, value: previousValue }),
			],
			severity,
		}];
	});
};

const preserveFoodMetadata = (food: FdcFood): FdcFood => ({
	...compactFood(food),
	reportedNutrientIds: [...getReportedNutrientIds(food)],
});

export const buildUsdaVerifiedCatalogBundle = (
	userFood: FdcFood,
	usdaDraft: BarcodeProductDraft,
	category: ResolvedFoodCategory,
): CatalogVerificationBundle =>
	buildCombinedSourceCatalogBundle(userFood, usdaDraft, [usdaDraft], category);

export const buildOpenFoodFactsCatalogBundle = (
	userFood: FdcFood,
	openFoodFactsDraft: BarcodeProductDraft,
	category: ResolvedFoodCategory,
): CatalogVerificationBundle =>
	buildCombinedSourceCatalogBundle(
		userFood,
		openFoodFactsDraft,
		[openFoodFactsDraft],
		category,
	);

export const buildCombinedSourceCatalogBundle = (
	userFood: FdcFood,
	canonicalDraft: BarcodeProductDraft,
	sourceDrafts: BarcodeProductDraft[],
	category: ResolvedFoodCategory,
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
		const source = draft.source === "open-food-facts"
			? "open-food-facts" as const
			: "usda" as const;
		return createObservation({
			key: source,
			source,
			sourceReference: draft.sourceReference,
			sourceLicense: source === "usda" ? "CC0-1.0" : "ODbL-1.0",
			food: preserveFoodMetadata(createCatalogFoodFromDraft(draft, category)),
			rawPayload: draft,
		});
	});
	const primaryObservationKey = canonicalDraft.source === "open-food-facts"
		? "open-food-facts"
		: "usda";
	const servingObservationKey =
		canonicalDraft.fieldProvenance?.serving?.source === "open-food-facts"
			? "open-food-facts"
			: canonicalDraft.fieldProvenance?.serving?.source === "usda"
				? "usda"
				: primaryObservationKey;

	return {
		canonicalFood,
		observations: [userObservation, ...sourceObservations],
		provenance: addFoodProvenance(
			canonicalFood,
			primaryObservationKey,
			"source-verified",
			"exact-barcode",
		).map((entry) => {
			if (entry.fieldPath === "servingWeightGrams") {
				return { ...entry, observationKey: servingObservationKey };
			}
			if (!entry.fieldPath.startsWith("nutrient:")) return entry;
			const nutrientId = Number(entry.fieldPath.split(":")[1]);
			const nutrientSource = canonicalFood.foodNutrients.find(
				(nutrient) => nutrient.nutrientId === nutrientId,
			)?.source;
			if (nutrientSource !== "usda" && nutrientSource !== "open-food-facts") {
				return entry;
			}
			return { ...entry, observationKey: nutrientSource };
		}),
		conflicts: findFoodConflicts(
			userFood,
			canonicalFood,
			primaryObservationKey,
		),
	};
};

export const buildModeratorReviewedCatalogBundle = (
	userFood: FdcFood,
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

export const mergeMissingNutrients = (
	primary: FdcFood,
	supplement: FdcFood,
): FdcFood => {
	const primaryReported = getReportedNutrientIds(primary);
	const additions: FdcNutrient[] = supplement.foodNutrients.filter(
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
