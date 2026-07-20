import {
	DEFAULT_GRAMS_PER_WEIGHT_MEASURE,
	DEFAULT_MILLILITERS_PER_VOLUME_MEASURE,
	SERVING_MEASURE_ALIASES,
	getDefaultServingMeasureUnit,
	getServingMeasureOption,
	normalizeServingMeasureAlias,
	type ServingMeasureDimension,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import type { FdcFood } from "../food/types";

export type ParsedServingAmount = {
	grams: number;
	quantity: number;
	unit: ServingMeasureUnit;
};

export type DensityConversion = {
	gramsPerMilliliter: number;
	label: string;
	confidence: "known";
};

export type ServingConversion = {
	grams: number | null;
	milliliters: number | null;
	dimension: ServingMeasureDimension;
	density: DensityConversion | null;
	available: boolean;
	warning: string | null;
};

const isWeightServingMeasureUnit = (
	unit: ServingMeasureUnit,
): boolean => {
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
	food?: FdcFood,
) => {
	return convertServingAmount(quantity, unit, food).grams;
};

export const convertServingAmount = (
	quantity: number,
	unit: ServingMeasureUnit,
	food?: FdcFood,
): ServingConversion => {
	const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
	if (isWeightServingMeasureUnit(unit)) {
		const conversion = DEFAULT_GRAMS_PER_WEIGHT_MEASURE[unit];
		return {
			grams: safeQuantity !== null && typeof conversion === "number"
				? safeQuantity * conversion
				: null,
			milliliters: null,
			dimension: "weight",
			density: null,
			available: safeQuantity !== null && typeof conversion === "number",
			warning: null,
		};
	}

	const volumeConversion = DEFAULT_MILLILITERS_PER_VOLUME_MEASURE[unit];
	if (typeof volumeConversion !== "number") {
		return {
			grams: null,
			milliliters: null,
			dimension: getServingMeasureOption(unit)?.dimension ?? "volume",
			density: null,
			available: false,
			warning: "This serving unit is not available right now.",
		};
	}
	const milliliters = safeQuantity === null ? null : safeQuantity * volumeConversion;
	const density = getDensityConversion(food);
	if (milliliters === null || !density) {
		return {
			grams: null,
			milliliters,
			dimension: "volume",
			density: null,
			available: false,
			warning: "A measured weight-to-volume conversion is not available for this ingredient. Use a weight unit instead.",
		};
	}
	const grams = milliliters * density.gramsPerMilliliter;

	return {
		grams,
		milliliters,
		dimension: "volume",
		density,
		available: true,
		warning: null,
	};
};

export const getServingMeasureDimension = (
	unit: ServingMeasureUnit,
): ServingMeasureDimension | null => {
	return getServingMeasureOption(unit)?.dimension ?? null;
};

export const getDensityConversion = (food?: FdcFood): DensityConversion | null => {
	if (
		food?.customDensityConfidence === "known" &&
		Number.isFinite(food.customDensityGramsPerMilliliter) &&
		Number(food.customDensityGramsPerMilliliter) > 0
	) {
		return {
			gramsPerMilliliter: Number(food.customDensityGramsPerMilliliter),
			label: food.customDensityLabel ?? "custom serving",
			confidence: "known",
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
		) continue;

		return {
			gramsPerMilliliter: gramWeight / (amount * option.conversionToBase),
			label: serving.label,
			confidence: "known",
		};
	}

	return null;
};

export const canConvertServingUnit = (
	unit: ServingMeasureUnit,
	food?: FdcFood,
) => isWeightServingMeasureUnit(unit) || (
	getServingMeasureOption(unit)?.dimension === "volume" &&
	Boolean(getDensityConversion(food))
);

export const parseServingAmount = (input: string): ParsedServingAmount | null => {
	const normalized = input.trim().toLowerCase();
	if (!normalized) return null;

	const match = normalized.match(
		/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-z.\s]+)?$/,
	);
	if (!match) return null;

	const quantity = parseQuantity(match[1]);
	if (quantity === null || quantity < 0) return null;

	const defaultWeightUnit = getDefaultServingMeasureUnit("weight");
	const unitText = match[2]?.replaceAll(".", "") ?? "";
	const unit = unitText
		? SERVING_MEASURE_ALIASES[normalizeServingMeasureAlias(unitText)]
		: defaultWeightUnit;
	if (!unit) return null;

	const grams = convertServingToGrams(quantity, unit);
	if (grams === null) return null;
	return {
		grams,
		quantity,
		unit,
	};
};
