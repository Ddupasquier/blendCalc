import type {
	FoodItem,
	FoodNutrient,
	FoodNutrientMeasurementBasis,
} from "$lib/utils/food/types";
import {
	getDensityConversion,
	type ServingConversion,
} from "$lib/utils/serving/servingAmount";
import { getServingMeasureOption } from "$lib/utils/serving/servingMeasureCatalog";
import { getConfiguredAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
import {
	getFoodServingWithExactGramWeightForLabel,
	normalizeFoodServingIdentityLabel,
} from "$lib/utils/food/servings/foodServings";

export type NutrientResolutionMethod =
	"exact" | "mapped" | "derived" | "missing";

export type ResolvedFoodNutrient = {
	nutrient: FoodNutrient | null;
	value: number | null;
	source: NutrientResolutionMethod;
};

export const findFoodNutrient = (food: FoodItem, nutrientId: number) => {
	return food.foodNutrients.find((nutrient) =>
		isMatchingFoodNutrient(nutrient, nutrientId, food.sourceKey),
	);
};

export const getFoodNutrientValue = (food: FoodItem, nutrientId: number) => {
	return resolveFoodNutrient(food, nutrientId).value;
};

export const getFoodNutrientMeasurementBasis = (
	nutrient: FoodNutrient,
): FoodNutrientMeasurementBasis =>
	nutrient.measurementBasis ?? {
		kind: "mass",
		quantity: 100,
		unitKey: "g",
	};

const getBasisBaseQuantity = (basis: FoodNutrientMeasurementBasis) => {
	if (basis.kind === "serving") return basis.quantity;
	if (basis.kind === "mass" && basis.unitKey === "g") return basis.quantity;
	if (basis.kind === "volume" && basis.unitKey === "ml") return basis.quantity;
	const option = getServingMeasureOption(basis.unitKey);
	if (!option || option.dimension !== basis.kind) return null;
	return basis.quantity * option.conversionToBase;
};

export const getFoodNutrientExactMassBasisGrams = (
	food: FoodItem,
	nutrient: FoodNutrient,
): number | null => {
	const basis = getFoodNutrientMeasurementBasis(nutrient);
	const basisQuantity = getBasisBaseQuantity(basis);
	if (!basisQuantity || basisQuantity <= 0) return null;

	if (basis.kind === "mass") return basisQuantity;
	if (basis.kind === "volume") {
		const density = getDensityConversion(food);
		return density ? basisQuantity * density.gramsPerMilliliter : null;
	}

	const serving = getFoodServingWithExactGramWeightForLabel(
		food,
		basis.servingLabel,
	);
	return serving?.gramWeight ? basisQuantity * serving.gramWeight : null;
};

export type ComparableFoodNutrientAmount = {
	value: number;
	basisKey: string;
};

export const getComparableFoodNutrientAmount = (
	nutrient: FoodNutrient,
): ComparableFoodNutrientAmount | null => {
	const basis = getFoodNutrientMeasurementBasis(nutrient);
	const basisQuantity = getBasisBaseQuantity(basis);
	if (
		!basisQuantity ||
		basisQuantity <= 0 ||
		!Number.isFinite(nutrient.value)
	) {
		return null;
	}
	const basisKey =
		basis.kind === "serving"
			? `serving:${basis.servingLabel.trim().toLocaleLowerCase()}`
			: basis.kind;
	return {
		value:
			basis.kind === "serving"
				? nutrient.value / basisQuantity
				: (nutrient.value * 100) / basisQuantity,
		basisKey,
	};
};

export const getFoodNutrientAmountForServingConversion = (
	food: FoodItem,
	nutrientId: number,
	conversion: ServingConversion,
): number | null => {
	const nutrient = resolveFoodNutrient(food, nutrientId).nutrient;
	if (!nutrient) return null;
	return getNutrientAmountForServingConversion(nutrient, conversion, food);
};

export const getNutrientAmountForServingConversion = (
	nutrient: FoodNutrient,
	conversion: ServingConversion,
	food?: FoodItem,
): number | null => {
	const conversionFactor = getNutrientServingConversionFactor(
		nutrient,
		conversion,
		food,
	);
	return conversionFactor === null ? null : nutrient.value * conversionFactor;
};

export const getNutrientStandardErrorForServingConversion = (
	nutrient: FoodNutrient,
	conversion: ServingConversion,
	food?: FoodItem,
): number | null => {
	if (
		!Number.isFinite(nutrient.standardError) ||
		Number(nutrient.standardError) < 0
	) {
		return null;
	}
	const conversionFactor = getNutrientServingConversionFactor(
		nutrient,
		conversion,
		food,
	);
	return conversionFactor === null
		? null
		: Number(nutrient.standardError) * conversionFactor;
};

const getNutrientServingConversionFactor = (
	nutrient: FoodNutrient,
	conversion: ServingConversion,
	food?: FoodItem,
): number | null => {
	const basis = getFoodNutrientMeasurementBasis(nutrient);
	const basisQuantity = getBasisBaseQuantity(basis);
	if (!basisQuantity || basisQuantity <= 0) return null;

	const measuredQuantity =
		basis.kind === "mass"
			? conversion.grams
			: basis.kind === "volume"
				? conversion.milliliters
				: conversion.servings;
	const sameServingBasis =
		basis.kind !== "serving" ||
		(conversion.servingLabel !== null &&
			normalizeFoodServingIdentityLabel(conversion.servingLabel) ===
				normalizeFoodServingIdentityLabel(basis.servingLabel));
	if (measuredQuantity !== null && sameServingBasis) {
		return measuredQuantity / basisQuantity;
	}

	if (conversion.grams !== null && food) {
		const exactMassBasisGrams = getFoodNutrientExactMassBasisGrams(
			food,
			nutrient,
		);
		if (exactMassBasisGrams !== null) {
			return conversion.grams / exactMassBasisGrams;
		}
	}

	return null;
};

export const resolveFoodNutrient = (
	food: FoodItem,
	nutrientId: number,
): ResolvedFoodNutrient => {
	const exact = food.foodNutrients.find(
		(nutrient) => Number(nutrient.nutrientId) === nutrientId,
	);

	if (exact) {
		return { nutrient: exact, value: exact.value, source: "exact" };
	}

	const mappedNutrient = food.foodNutrients.find((nutrient) =>
		matchesEquivalentNutrient(nutrient, nutrientId, food.sourceKey),
	);

	if (mappedNutrient) {
		return {
			nutrient: mappedNutrient,
			value: mappedNutrient.value,
			source: "mapped",
		};
	}

	return { nutrient: null, value: null, source: "missing" };
};

export const isMatchingFoodNutrient = (
	nutrient: FoodNutrient,
	nutrientId: number,
	foodSourceKey?: string,
) => {
	if (Number(nutrient.nutrientId) === nutrientId) return true;

	return matchesEquivalentNutrient(nutrient, nutrientId, foodSourceKey);
};

const matchesEquivalentNutrient = (
	nutrient: FoodNutrient,
	nutrientId: number,
	foodSourceKey?: string,
) => {
	const sourceKey = nutrient.source ?? foodSourceKey ?? "unknown";
	return getConfiguredAppReferenceCatalog().nutrientEquivalences.some(
		(equivalence) =>
			equivalence.canonicalNutrientId === nutrientId &&
			equivalence.sourceKey === sourceKey &&
			((equivalence.sourceNutrientId !== null &&
				Number(nutrient.nutrientId) === equivalence.sourceNutrientId) ||
				(equivalence.sourceNutrientNumber !== null &&
					String(nutrient.nutrientNumber) ===
						equivalence.sourceNutrientNumber)),
	);
};
