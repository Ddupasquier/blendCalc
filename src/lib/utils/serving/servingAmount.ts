import {
	DEFAULT_GRAMS_PER_WEIGHT_MEASURE,
	DEFAULT_MILLILITERS_PER_VOLUME_MEASURE,
	SERVING_MEASURE_ALIASES,
	getDefaultCountMeasureUnit,
	getDefaultServingMeasureUnit,
	getServingMeasureOption,
	normalizeServingMeasureAlias,
	type ServingMeasureDimension,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import type {
	FoodItem,
	FoodServing,
	FoodServingGramWeightMethod,
} from "../food/types";

export type ParsedServingAmount = {
	grams: number;
	quantity: number;
	unit: ServingMeasureUnit;
};

export type ParsedServingMeasure = {
	quantity: number;
	unit: ServingMeasureUnit;
};

export type DensityConversion = {
	gramsPerMilliliter: number;
	label: string;
	confidence: "known";
	basis: string;
};

export type ServingConversion = {
	grams: number | null;
	milliliters: number | null;
	servings: number | null;
	servingLabel: string | null;
	dimension: ServingMeasureDimension;
	density: DensityConversion | null;
	available: boolean;
	warning: string | null;
	method: FoodServingGramWeightMethod;
	basis: string | null;
};

export type SourceServingMeasureOption = {
	value: ServingMeasureUnit;
	label: string;
	gramWeight: number | null;
	serving: FoodServing;
};

const SOURCE_SERVING_MEASURE_PREFIX = "source-serving:";

const isPositiveNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0;

const normalizeCalculatedAmount = (value: number) => Number(value.toFixed(9));

const getSourceServingIdentity = (serving: FoodServing) =>
	JSON.stringify([
		serving.sourceMeasureKey?.trim() ?? "",
		serving.label.trim(),
		serving.gramWeight ?? null,
		serving.milliliterVolume ?? null,
	]);

const getSourceServingMeasureValue = (serving: FoodServing) =>
	`${SOURCE_SERVING_MEASURE_PREFIX}${encodeURIComponent(getSourceServingIdentity(serving))}`;

const getSourceServingMeasureLabel = (serving: FoodServing) => {
	const labelWithoutWeight = serving.label
		.replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:g|gram|grams)\s*\)\s*$/i, "")
		.trim();
	const singularLabel = labelWithoutWeight.replace(/^1(?:\.0+)?\s+/, "").trim();
	if (singularLabel !== labelWithoutWeight) return singularLabel;
	return /^\d/.test(labelWithoutWeight)
		? `${labelWithoutWeight} serving`
		: labelWithoutWeight;
};

const hasCatalogMeasure = (serving: FoodServing) =>
	isPositiveNumber(serving.amount) &&
	typeof serving.unitKey === "string" &&
	Boolean(getServingMeasureOption(serving.unitKey.trim()));

export const getSourceServingMeasureOptions = (
	food?: FoodItem,
): SourceServingMeasureOption[] =>
	(food?.foodServings ?? [])
		.filter(
			(serving) =>
				serving.label.trim().length > 0 && !hasCatalogMeasure(serving),
		)
		.map((serving) => ({
			value: getSourceServingMeasureValue(serving),
			label: getSourceServingMeasureLabel(serving),
			gramWeight: isPositiveNumber(serving.gramWeight)
				? serving.gramWeight
				: null,
			serving,
		}));

export const getSourceServingMeasureOption = (
	unit: ServingMeasureUnit,
	food?: FoodItem,
) =>
	unit.startsWith(SOURCE_SERVING_MEASURE_PREFIX)
		? (getSourceServingMeasureOptions(food).find(
				(option) => option.value === unit,
			) ?? null)
		: null;

const isWeightServingMeasureUnit = (unit: ServingMeasureUnit): boolean => {
	return typeof DEFAULT_GRAMS_PER_WEIGHT_MEASURE[unit] === "number";
};

const parseQuantity = (value: string) => {
	const normalized = value.trim();
	const mixedNumberMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixedNumberMatch) {
		const whole = Number(mixedNumberMatch[1]);
		const numerator = Number(mixedNumberMatch[2]);
		const denominator = Number(mixedNumberMatch[3]);
		return denominator === 0 ? null : whole + numerator / denominator;
	}

	const fractionMatch = normalized.match(/^(\d+)\/(\d+)$/);
	if (fractionMatch) {
		const numerator = Number(fractionMatch[1]);
		const denominator = Number(fractionMatch[2]);
		return denominator === 0 ? null : numerator / denominator;
	}

	const numericValue = Number(normalized);
	return Number.isFinite(numericValue) ? numericValue : null;
};

export const convertServingToGrams = (
	quantity: number,
	unit: ServingMeasureUnit,
	food?: FoodItem,
) => {
	return convertServingAmount(quantity, unit, food).grams;
};

export const convertServingQuantityToUnit = (
	quantity: number,
	currentUnit: ServingMeasureUnit,
	nextUnit: ServingMeasureUnit,
	food?: FoodItem,
) => {
	const current = convertServingAmount(quantity, currentUnit, food);
	const nextUnitConversion = convertServingAmount(1, nextUnit, food);
	const exactPair = [
		[current.grams, nextUnitConversion.grams],
		[current.milliliters, nextUnitConversion.milliliters],
		[current.servings, nextUnitConversion.servings],
	].find(
		(pair): pair is [number, number] =>
			pair[0] !== null && pair[1] !== null && pair[1] > 0,
	);
	return exactPair ? exactPair[0] / exactPair[1] : null;
};

const getMatchingFoodServingMultiplier = (
	food: FoodItem | undefined,
	measurement: {
		quantity: number;
		unit: ServingMeasureUnit;
		grams: number | null;
		milliliters: number | null;
	},
) => {
	for (const serving of food?.foodServings ?? []) {
		if (
			isPositiveNumber(serving.amount) &&
			serving.unitKey === measurement.unit
		) {
			return {
				multiplier: normalizeCalculatedAmount(
					measurement.quantity / serving.amount,
				),
				servingLabel: serving.label,
			};
		}
		if (measurement.grams !== null && isPositiveNumber(serving.gramWeight)) {
			return {
				multiplier: normalizeCalculatedAmount(
					measurement.grams / serving.gramWeight,
				),
				servingLabel: serving.label,
			};
		}
		if (
			measurement.milliliters !== null &&
			isPositiveNumber(serving.milliliterVolume)
		) {
			return {
				multiplier: normalizeCalculatedAmount(
					measurement.milliliters / serving.milliliterVolume,
				),
				servingLabel: serving.label,
			};
		}
	}
	return null;
};

export const convertServingAmount = (
	quantity: number,
	unit: ServingMeasureUnit,
	food?: FoodItem,
): ServingConversion => {
	const safeQuantity =
		Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
	const sourceServingOption = getSourceServingMeasureOption(unit, food);
	if (sourceServingOption) {
		const hasReportedVolume = isPositiveNumber(
			sourceServingOption.serving.milliliterVolume,
		);
		const grams =
			safeQuantity === null || sourceServingOption.gramWeight === null
				? null
				: normalizeCalculatedAmount(
						safeQuantity * sourceServingOption.gramWeight,
					);
		return {
			grams,
			milliliters:
				safeQuantity === null ||
				!isPositiveNumber(sourceServingOption.serving.milliliterVolume)
					? null
					: normalizeCalculatedAmount(
							safeQuantity * sourceServingOption.serving.milliliterVolume,
						),
			servings: safeQuantity,
			servingLabel: sourceServingOption.serving.label,
			dimension:
				sourceServingOption.gramWeight !== null
					? "weight"
					: hasReportedVolume
						? "volume"
						: "count",
			density: null,
			available: safeQuantity !== null,
			warning: null,
			method: sourceServingOption.serving.gramWeightMethod ?? "source-reported",
			basis:
				safeQuantity === null
					? null
					: sourceServingOption.gramWeight === null
						? `${safeQuantity} × ${sourceServingOption.serving.label}`
						: `${safeQuantity} × ${sourceServingOption.serving.label} at ${sourceServingOption.gramWeight}g per serving`,
		};
	}
	if (isWeightServingMeasureUnit(unit)) {
		const conversion = DEFAULT_GRAMS_PER_WEIGHT_MEASURE[unit];
		const grams =
			safeQuantity !== null && typeof conversion === "number"
				? normalizeCalculatedAmount(safeQuantity * conversion)
				: null;
		const matchingServing =
			safeQuantity === null
				? null
				: getMatchingFoodServingMultiplier(food, {
						quantity: safeQuantity,
						unit,
						grams,
						milliliters: null,
					});
		return {
			grams,
			milliliters: null,
			servings: matchingServing?.multiplier ?? null,
			servingLabel: matchingServing?.servingLabel ?? null,
			dimension: "weight",
			density: null,
			available: safeQuantity !== null && typeof conversion === "number",
			warning: null,
			method: "exact-unit-conversion",
			basis:
				safeQuantity !== null && typeof conversion === "number"
					? `${safeQuantity} ${unit} × ${conversion} grams per ${unit}`
					: null,
		};
	}

	const volumeConversion = DEFAULT_MILLILITERS_PER_VOLUME_MEASURE[unit];
	if (typeof volumeConversion !== "number") {
		const dimension =
			getServingMeasureOption(unit)?.dimension ??
			(unit === getDefaultCountMeasureUnit() ? "count" : "volume");
		if (dimension === "count") {
			const matchingServing = food?.foodServings?.find(
				(serving) =>
					serving.unitKey === unit && isPositiveNumber(serving.amount),
			);
			const servings =
				safeQuantity === null
					? null
					: matchingServing && isPositiveNumber(matchingServing.amount)
						? normalizeCalculatedAmount(safeQuantity / matchingServing.amount)
						: safeQuantity;
			return {
				grams: null,
				milliliters: null,
				servings,
				servingLabel: matchingServing?.label ?? null,
				dimension,
				density: null,
				available: safeQuantity !== null,
				warning: null,
				method: "unknown",
				basis:
					safeQuantity === null
						? null
						: matchingServing
							? `${safeQuantity} ${unit}; ${matchingServing.label} per serving`
							: `${safeQuantity} ${unit}`,
			};
		}
		return {
			grams: null,
			milliliters: null,
			servings: null,
			servingLabel: null,
			dimension,
			density: null,
			available: false,
			warning: "This serving unit is not available right now.",
			method: "unknown",
			basis: null,
		};
	}
	const milliliters =
		safeQuantity === null
			? null
			: normalizeCalculatedAmount(safeQuantity * volumeConversion);
	const density = getDensityConversion(food);
	const matchingServing =
		safeQuantity === null
			? null
			: getMatchingFoodServingMultiplier(food, {
					quantity: safeQuantity,
					unit,
					grams: null,
					milliliters,
				});
	if (milliliters === null || !density) {
		return {
			grams: null,
			milliliters,
			servings: matchingServing?.multiplier ?? null,
			servingLabel: matchingServing?.servingLabel ?? null,
			dimension: "volume",
			density: null,
			available: milliliters !== null,
			warning: null,
			method: "exact-unit-conversion",
			basis:
				safeQuantity === null
					? null
					: `${safeQuantity} ${unit} × ${volumeConversion} milliliters per ${unit}`,
		};
	}
	const grams = normalizeCalculatedAmount(
		milliliters * density.gramsPerMilliliter,
	);

	return {
		grams,
		milliliters,
		servings:
			matchingServing?.multiplier ??
			getMatchingFoodServingMultiplier(food, {
				quantity: safeQuantity ?? 0,
				unit,
				grams,
				milliliters,
			})?.multiplier ??
			null,
		servingLabel:
			matchingServing?.servingLabel ??
			getMatchingFoodServingMultiplier(food, {
				quantity: safeQuantity ?? 0,
				unit,
				grams,
				milliliters,
			})?.servingLabel ??
			null,
		dimension: "volume",
		density,
		available: true,
		warning: null,
		method: "calculated-conversion",
		basis: `${safeQuantity} ${unit}; ${density.basis}`,
	};
};

export const convertFoodServingMultiplier = (
	serving: FoodServing,
	multiplier: number,
): ServingConversion => {
	const safeMultiplier = isPositiveNumber(multiplier) ? multiplier : null;
	const grams =
		safeMultiplier !== null && isPositiveNumber(serving.gramWeight)
			? normalizeCalculatedAmount(safeMultiplier * serving.gramWeight)
			: null;
	const milliliters =
		safeMultiplier !== null && isPositiveNumber(serving.milliliterVolume)
			? normalizeCalculatedAmount(safeMultiplier * serving.milliliterVolume)
			: null;
	const dimension: ServingMeasureDimension =
		grams !== null ? "weight" : milliliters !== null ? "volume" : "count";

	return {
		grams,
		milliliters,
		servings: safeMultiplier,
		servingLabel: serving.label,
		dimension,
		density: null,
		available: safeMultiplier !== null,
		warning: null,
		method: serving.gramWeightMethod ?? "unknown",
		basis:
			safeMultiplier === null ? null : `${safeMultiplier} × ${serving.label}`,
	};
};

export const getServingMeasureDimension = (
	unit: ServingMeasureUnit,
): ServingMeasureDimension | null => {
	return (
		getServingMeasureOption(unit)?.dimension ??
		(unit === getDefaultCountMeasureUnit() ? "count" : null)
	);
};

export const getDensityConversion = (
	food?: FoodItem,
): DensityConversion | null => {
	if (
		food?.customDensityConfidence === "known" &&
		Number.isFinite(food.customDensityGramsPerMilliliter) &&
		Number(food.customDensityGramsPerMilliliter) > 0
	) {
		return {
			gramsPerMilliliter: Number(food.customDensityGramsPerMilliliter),
			label: food.customDensityLabel ?? "custom serving",
			confidence: "known",
			basis: food.customDensityLabel ?? "User-reported weight and volume",
		};
	}

	for (const serving of food?.foodServings ?? []) {
		const unit = serving.unitKey?.trim();
		const option = unit ? getServingMeasureOption(unit) : null;
		const amount = Number(serving.amount);
		const gramWeight = Number(serving.gramWeight);
		if (
			option?.dimension !== "volume" ||
			!Number.isFinite(amount) ||
			amount <= 0 ||
			!Number.isFinite(gramWeight) ||
			gramWeight <= 0 ||
			!Number.isFinite(option.conversionToBase) ||
			option.conversionToBase <= 0
		)
			continue;

		return {
			gramsPerMilliliter: gramWeight / (amount * option.conversionToBase),
			label: serving.label,
			confidence: "known",
			basis: `${serving.label} = ${gramWeight}g (${serving.origin ?? "unknown origin"})`,
		};
	}

	return null;
};

export const canConvertServingUnit = (
	unit: ServingMeasureUnit,
	food?: FoodItem,
) => {
	const conversion = convertServingAmount(1, unit, food);
	if (!conversion.available) return false;
	if (!food?.foodNutrients.length) return true;
	return food.foodNutrients.every((nutrient) => {
		const basisKind = nutrient.measurementBasis?.kind ?? "mass";
		return basisKind === "mass"
			? conversion.grams !== null
			: basisKind === "volume"
				? conversion.milliliters !== null
				: conversion.servings !== null;
	});
};

const parseServingMeasure = (
	input: string,
	defaultUnit: ServingMeasureUnit | null,
): ParsedServingMeasure | null => {
	const normalized = input.trim().toLowerCase();
	if (!normalized) return null;

	const match = normalized.match(
		/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-z.\s]+)?$/,
	);
	if (!match) return null;

	const quantity = parseQuantity(match[1]);
	if (quantity === null || quantity < 0) return null;

	const unitText = match[2]?.replaceAll(".", "") ?? "";
	const unit = unitText
		? SERVING_MEASURE_ALIASES[normalizeServingMeasureAlias(unitText)]
		: defaultUnit;
	if (!unit) return null;

	return { quantity, unit };
};

export const parseSourceServingMeasure = (
	input: string,
): ParsedServingMeasure | null => {
	const knownMeasure = parseServingMeasure(input, null);
	if (knownMeasure) return knownMeasure;

	const sourceDefinedCount = input
		.trim()
		.toLowerCase()
		.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+([a-z][a-z.' -]*)$/);
	if (!sourceDefinedCount) return null;
	const quantity = parseQuantity(sourceDefinedCount[1]);
	if (quantity === null || quantity <= 0) return null;
	return { quantity, unit: getDefaultCountMeasureUnit() };
};

export const parseSourceWeightMeasure = (
	input: string,
): ParsedServingMeasure | null => {
	const exactMeasure = parseSourceServingMeasure(input);
	if (
		exactMeasure &&
		getServingMeasureDimension(exactMeasure.unit) === "weight"
	)
		return exactMeasure;

	const quantityMatches = [
		...input.matchAll(/\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+/g),
	];
	for (const match of quantityMatches.reverse()) {
		const candidate = input
			.slice(match.index)
			.replace(/[\s)\]},;:]+$/g, "")
			.trim();
		const parsed = parseSourceServingMeasure(candidate);
		if (parsed && getServingMeasureDimension(parsed.unit) === "weight") {
			return parsed;
		}
	}

	return null;
};

export const parseServingAmount = (
	input: string,
): ParsedServingAmount | null => {
	const parsed = parseServingMeasure(
		input,
		getDefaultServingMeasureUnit("weight"),
	);
	if (!parsed) return null;

	const grams = convertServingToGrams(parsed.quantity, parsed.unit);
	if (grams === null) return null;
	return {
		grams,
		quantity: parsed.quantity,
		unit: parsed.unit,
	};
};
