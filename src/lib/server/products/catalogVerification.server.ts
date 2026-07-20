import { createHash } from "node:crypto";
import type { Json } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { compactFood } from "$lib/utils/food/records/foodRecords";
import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
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

const normalizeText = (value?: string) =>
	value?.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";

const getReportedNutrientIds = (food: FdcFood) =>
	new Set(
		food.reportedNutrientIds ?? food.foodNutrients
			.filter((nutrient) => nutrient.valueOrigin === "reported")
			.map((nutrient) => nutrient.nutrientId),
	);

const getNutrientMap = (food: FdcFood) =>
	new Map(food.foodNutrients.map((nutrient) => [nutrient.nutrientId, nutrient]));

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
			normalizedValue: normalizeText(food.description),
			confidence,
			verificationMethod,
		},
	];

	if (food.brandOwner?.trim()) {
		fields.push({
			fieldPath: "brandOwner",
			observationKey,
			sourceValue: food.brandOwner,
			normalizedValue: normalizeText(food.brandOwner),
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
	sourceKey: "usda" | "open-food-facts" = "usda",
): CatalogConflict[] => {
	const conflicts: CatalogConflict[] = [];
	const userBrand = normalizeText(userFood.brandOwner);
	const sourceBrand = normalizeText(sourceFood.brandOwner);
	if (userBrand && sourceBrand && userBrand !== sourceBrand) {
		conflicts.push({
			fieldPath: "brandOwner",
			observedValues: [
				toJson({ source: "user-label", value: userFood.brandOwner }),
				toJson({ source: sourceKey, value: sourceFood.brandOwner }),
			],
			severity: "medium",
		});
	}

	const userServing = userFood.customServingWeightGrams ?? userFood.servingSize;
	const sourceServing = sourceFood.customServingWeightGrams ?? sourceFood.servingSize;
	if (userServing && sourceServing) {
		const severity = getNumericConflictSeverity(userServing, sourceServing);
		if (severity) {
			conflicts.push({
				fieldPath: "servingWeightGrams",
				observedValues: [
					toJson({ source: "user-label", value: userServing }),
					toJson({ source: sourceKey, value: sourceServing }),
				],
				severity,
			});
		}
	}

	const userNutrients = getNutrientMap(userFood);
	const sourceNutrients = getNutrientMap(sourceFood);
	const userReported = getReportedNutrientIds(userFood);
	const sourceReported = getReportedNutrientIds(sourceFood);
	for (const nutrientId of userReported) {
		if (!sourceReported.has(nutrientId)) continue;
		const userNutrient = userNutrients.get(nutrientId);
		const sourceNutrient = sourceNutrients.get(nutrientId);
		if (!userNutrient || !sourceNutrient) continue;
		if (userNutrient.unitName.toUpperCase() !== sourceNutrient.unitName.toUpperCase()) {
			conflicts.push({
				fieldPath: `nutrient:${nutrientId}`,
				observedValues: [
					toJson({ source: "user-label", ...userNutrient }),
					toJson({ source: sourceKey, ...sourceNutrient }),
				],
				severity: "high",
			});
			continue;
		}
		const severity = getNumericConflictSeverity(userNutrient.value, sourceNutrient.value);
		if (!severity) continue;
		conflicts.push({
			fieldPath: `nutrient:${nutrientId}`,
			observedValues: [
				toJson({ source: "user-label", ...userNutrient }),
				toJson({ source: sourceKey, ...sourceNutrient }),
			],
			severity,
		});
	}

	return conflicts;
};

const preserveFoodMetadata = (food: FdcFood): FdcFood => ({
	...compactFood(food),
	reportedNutrientIds: [...getReportedNutrientIds(food)],
});

export const buildUsdaVerifiedCatalogBundle = (
	userFood: FdcFood,
	usdaDraft: BarcodeProductDraft,
	category: ResolvedFoodCategory,
): CatalogVerificationBundle => {
	const usdaFood = preserveFoodMetadata(
		createCatalogFoodFromDraft(usdaDraft, category),
	);
	const userObservation = createObservation({
		key: "user-label",
		source: "user-label",
		sourceLicense: "submitted-with-consent",
		food: preserveFoodMetadata(userFood),
	});
	const usdaObservation = createObservation({
		key: "usda",
		source: "usda",
		sourceReference: usdaDraft.sourceReference,
		sourceLicense: "CC0-1.0",
		food: usdaFood,
		rawPayload: usdaDraft,
	});

	return {
		canonicalFood: usdaFood,
		observations: [userObservation, usdaObservation],
		provenance: addFoodProvenance(
			usdaFood,
			"usda",
			"source-verified",
			"exact-barcode",
		),
		conflicts: findFoodConflicts(userFood, usdaFood),
	};
};

export const buildOpenFoodFactsCatalogBundle = (
	userFood: FdcFood,
	openFoodFactsDraft: BarcodeProductDraft,
	category: ResolvedFoodCategory,
): CatalogVerificationBundle => {
	const openFoodFactsFood = preserveFoodMetadata(
		createCatalogFoodFromDraft(openFoodFactsDraft, category),
	);
	const userObservation = createObservation({
		key: "user-label",
		source: "user-label",
		sourceLicense: "submitted-with-consent",
		food: preserveFoodMetadata(userFood),
	});
	const openFoodFactsObservation = createObservation({
		key: "open-food-facts",
		source: "open-food-facts",
		sourceReference: openFoodFactsDraft.sourceReference,
		sourceLicense: "ODbL-1.0",
		food: openFoodFactsFood,
		rawPayload: openFoodFactsDraft,
	});

	return {
		canonicalFood: openFoodFactsFood,
		observations: [userObservation, openFoodFactsObservation],
		provenance: addFoodProvenance(
			openFoodFactsFood,
			"open-food-facts",
			"source-verified",
			"exact-barcode",
		),
		conflicts: findFoodConflicts(
			userFood,
			openFoodFactsFood,
			"open-food-facts",
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
