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
	gramWeight: number;
	serving: FoodServing;
};

const SOURCE_SERVING_MEASURE_PREFIX = "source-serving:";

const isPositiveNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0;

const normalizeCalculatedAmount = (value: number) =>
	Number(value.toFixed(9));

const getSourceServingIdentity = (serving: FoodServing) =>
	JSON.stringify([
		serving.sourceMeasureKey?.trim() ?? "",
		serving.label.trim(),
		serving.gramWeight,
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
				serving.label.trim().length > 0 &&
				isPositiveNumber(serving.gramWeight) &&
				!hasCatalogMeasure(serving),
		)
		.map((serving) => ({
			value: getSourceServingMeasureValue(serving),
			label: getSourceServingMeasureLabel(serving),
			gramWeight: serving.gramWeight,
			serving,
		}));

export const getSourceServingMeasureOption = (
	unit: ServingMeasureUnit,
	food?: FoodItem,
) =>
	unit.startsWith(SOURCE_SERVING_MEASURE_PREFIX)
		? getSourceServingMeasureOptions(food).find((option) => option.value === unit) ?? null
		: null;

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
	const currentGrams = convertServingToGrams(quantity, currentUnit, food);
	const nextUnitGrams = convertServingToGrams(1, nextUnit, food);
	if (
		currentGrams === null ||
		nextUnitGrams === null ||
		nextUnitGrams <= 0
	) return null;
	return currentGrams / nextUnitGrams;
};

export const convertServingAmount = (
	quantity: number,
	unit: ServingMeasureUnit,
	food?: FoodItem,
): ServingConversion => {
	const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
	const sourceServingOption = getSourceServingMeasureOption(unit, food);
	if (sourceServingOption) {
		const grams = safeQuantity === null
			? null
			: normalizeCalculatedAmount(
				safeQuantity * sourceServingOption.gramWeight,
			);
		return {
			grams,
			milliliters: null,
			dimension: "weight",
			density: null,
			available: grams !== null,
			warning: null,
			method: sourceServingOption.serving.gramWeightMethod ?? "source-reported",
			basis: grams === null
				? null
				: `${safeQuantity} × ${sourceServingOption.serving.label} at ${sourceServingOption.gramWeight}g per serving`,
		};
	}
	if (isWeightServingMeasureUnit(unit)) {
		const conversion = DEFAULT_GRAMS_PER_WEIGHT_MEASURE[unit];
		return {
			grams: safeQuantity !== null && typeof conversion === "number"
				? normalizeCalculatedAmount(safeQuantity * conversion)
				: null,
			milliliters: null,
			dimension: "weight",
			density: null,
			available: safeQuantity !== null && typeof conversion === "number",
			warning: null,
			method: "exact-unit-conversion",
			basis: safeQuantity !== null && typeof conversion === "number"
				? `${safeQuantity} ${unit} × ${conversion} grams per ${unit}`
				: null,
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
			method: "unknown",
			basis: null,
		};
	}
	const milliliters = safeQuantity === null
		? null
		: normalizeCalculatedAmount(safeQuantity * volumeConversion);
	const density = getDensityConversion(food);
	if (milliliters === null || !density) {
		return {
			grams: null,
			milliliters,
			dimension: "volume",
			density: null,
			available: false,
			warning: "A measured weight-to-volume conversion is not available for this ingredient. Use a weight unit instead.",
			method: "unknown",
			basis: null,
		};
	}
	const grams = normalizeCalculatedAmount(
		milliliters * density.gramsPerMilliliter,
	);

	return {
		grams,
		milliliters,
		dimension: "volume",
		density,
		available: true,
		warning: null,
		method: "calculated-conversion",
		basis: `${safeQuantity} ${unit}; ${density.basis}`,
	};
};

export const getServingMeasureDimension = (
	unit: ServingMeasureUnit,
): ServingMeasureDimension | null => {
	return getServingMeasureOption(unit)?.dimension ?? null;
};

export const getDensityConversion = (food?: FoodItem): DensityConversion | null => {
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
		) continue;

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
) => Boolean(getSourceServingMeasureOption(unit, food)) || isWeightServingMeasureUnit(unit) || (
	getServingMeasureOption(unit)?.dimension === "volume" &&
	Boolean(getDensityConversion(food))
);

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
): ParsedServingMeasure | null => parseServingMeasure(input, null);

export const parseSourceWeightMeasure = (
	input: string,
): ParsedServingMeasure | null => {
	const exactMeasure = parseSourceServingMeasure(input);
	if (
		exactMeasure &&
		getServingMeasureDimension(exactMeasure.unit) === "weight"
	) return exactMeasure;

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

export const parseServingAmount = (input: string): ParsedServingAmount | null => {
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
