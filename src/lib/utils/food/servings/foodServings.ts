import type { FoodItem, FoodServing } from "$lib/utils/food/types";
import {
	convertServingAmount,
	getServingMeasureDimension,
	parseSourceServingMeasure,
} from "$lib/utils/serving/servingAmount";
import { toFinitePositiveNumber } from "$lib/utils/numbers/finiteNumbers";

const normalizeServing = (serving: FoodServing): FoodServing | null => {
	const label = serving.label.trim();
	const gramWeight = toFinitePositiveNumber(serving.gramWeight);
	const milliliterVolume = toFinitePositiveNumber(serving.milliliterVolume);
	const amount = toFinitePositiveNumber(serving.amount);
	if (
		!label ||
		(gramWeight === null && milliliterVolume === null && amount === null)
	) {
		return null;
	}

	return {
		label,
		gramWeight: gramWeight ?? undefined,
		milliliterVolume: milliliterVolume ?? undefined,
		amount: amount ?? undefined,
		unitKey: serving.unitKey?.trim() || undefined,
		isPrimary: serving.isPrimary === true,
		measureType: serving.measureType?.trim() || undefined,
		isHouseholdMeasure: serving.isHouseholdMeasure === true,
		sourceMeasureKey: serving.sourceMeasureKey?.trim() || undefined,
		origin: serving.origin ?? "unknown",
		gramWeightMethod: serving.gramWeightMethod ?? "unknown",
		calculationBasis: serving.calculationBasis?.trim() || undefined,
		source: serving.source,
		sourceReference: serving.sourceReference?.trim() || undefined,
		confidence: serving.confidence,
	};
};

const SERVING_SOURCES = new Set<NonNullable<FoodServing["source"]>>([
	"usda",
	"open-food-facts",
	"health-canada-cnf",
	"uk-cofid",
	"fsanz-afcd",
	"foodrepo",
	"user-label",
	"manufacturer",
	"gs1",
	"community-reviewed",
	"unknown",
]);

const isServingSource = (
	value: unknown,
): value is NonNullable<FoodServing["source"]> =>
	typeof value === "string" &&
	SERVING_SOURCES.has(value as NonNullable<FoodServing["source"]>);

export const normalizeFoodServingIdentityLabel = (label: string) =>
	label
		.trim()
		.toLocaleLowerCase()
		.replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:g|gram|grams)\s*\)\s*$/i, "")
		.replace(/\s+/g, " ");

export const hasExactFoodServingGramWeight = (serving: FoodServing) =>
	toFinitePositiveNumber(serving.gramWeight) !== null &&
	serving.gramWeightMethod !== "unknown";

export const isFoodServingHouseholdDisplayMeasure = (serving: FoodServing) => {
	if (
		serving.isHouseholdMeasure === true ||
		serving.origin === "source-household-measure"
	) {
		return true;
	}

	const normalizedLabel = normalizeFoodServingIdentityLabel(serving.label);
	const parsedLabelMeasure = parseSourceServingMeasure(normalizedLabel);
	const dimension = serving.unitKey
		? getServingMeasureDimension(serving.unitKey)
		: parsedLabelMeasure
			? getServingMeasureDimension(parsedLabelMeasure.unit)
			: null;
	return dimension === "volume" || dimension === "count";
};

export const getFoodServingWithExactGramWeightForLabel = (
	food: FoodItem | undefined,
	label: string,
): FoodServing | null => {
	const normalizedLabel = normalizeFoodServingIdentityLabel(label);
	return (
		getFoodServings(food).find(
			(serving) =>
				hasExactFoodServingGramWeight(serving) &&
				normalizeFoodServingIdentityLabel(serving.label) === normalizedLabel,
		) ?? null
	);
};

const getLegacyServingLineage = (food: FoodItem) => {
	const provenanceSource = food.fieldProvenance?.serving?.source;
	const source =
		provenanceSource === "shared-catalog"
			? "community-reviewed"
			: isServingSource(provenanceSource)
				? provenanceSource
				: "unknown";
	const sourceReference =
		food.fieldProvenance?.serving?.sourceReference?.trim() || undefined;
	const confidence =
		food.fieldProvenance?.serving?.confidence ??
		(source === "user-label" ? "user-reported" : "unknown");
	return { source, sourceReference, confidence } as const;
};

const getLegacyServing = (food: FoodItem): FoodServing | null => {
	if (food.hasSourceServing === false) return null;

	const customWeight = toFinitePositiveNumber(food.customServingWeightGrams);
	const parsedServing = parseSourceServingMeasure(
		`${food.servingSize ?? ""} ${food.servingSizeUnit ?? ""}`,
	);
	const convertedServing = parsedServing
		? convertServingAmount(parsedServing.quantity, parsedServing.unit, food)
		: null;
	const parsedWeight =
		parsedServing &&
		getServingMeasureDimension(parsedServing.unit) === "weight" &&
		convertedServing?.grams !== null
			? (convertedServing?.grams ?? null)
			: null;
	const gramWeight = customWeight !== null ? customWeight : parsedWeight;
	const milliliterVolume = convertedServing?.milliliters ?? null;
	if (gramWeight === null && milliliterVolume === null && !parsedServing) {
		return null;
	}

	const label =
		food.customServingLabel?.trim() ||
		food.householdServingFullText?.trim() ||
		(gramWeight !== null
			? `${Number(gramWeight.toFixed(2))}g`
			: parsedServing
				? `${parsedServing.quantity} ${parsedServing.unit}`
				: "Serving");
	const lineage = getLegacyServingLineage(food);
	return {
		label,
		gramWeight: gramWeight ?? undefined,
		milliliterVolume: milliliterVolume ?? undefined,
		amount: parsedServing?.quantity,
		unitKey: parsedServing?.unit,
		isPrimary: true,
		origin: lineage.source === "user-label" ? "user-entered" : "unknown",
		gramWeightMethod:
			lineage.source === "user-label"
				? "user-reported"
				: parsedWeight !== null
					? "exact-unit-conversion"
					: "unknown",
		calculationBasis:
			parsedWeight !== null && lineage.source !== "user-label"
				? `${parsedServing?.quantity} ${parsedServing?.unit}`
				: undefined,
		...lineage,
	};
};

export const getFoodServings = (food?: FoodItem): FoodServing[] => {
	if (!food) return [];
	const explicit = (food.foodServings ?? []).flatMap((serving) => {
		const normalized = normalizeServing(serving);
		return normalized ? [normalized] : [];
	});
	if (explicit.length > 0) {
		return explicit.sort(
			(left, right) =>
				Number(right.isPrimary) - Number(left.isPrimary) ||
				(left.gramWeight ?? Number.POSITIVE_INFINITY) -
					(right.gramWeight ?? Number.POSITIVE_INFINITY) ||
				left.label.localeCompare(right.label),
		);
	}

	const legacy = getLegacyServing(food);
	return legacy ? [legacy] : [];
};

export const prioritizeFoodServingsForUserDisplay = (
	servings: FoodServing[],
): FoodServing[] =>
	servings
		.map((serving, originalIndex) => ({ serving, originalIndex }))
		.sort((left, right) => {
			const getDisplayPriority = (serving: FoodServing) => {
				const isHousehold = isFoodServingHouseholdDisplayMeasure(serving);
				if (isHousehold && serving.isPrimary) return 0;
				if (isHousehold) return 1;
				if (serving.isPrimary) return 2;
				return 3;
			};
			return (
				getDisplayPriority(left.serving) - getDisplayPriority(right.serving) ||
				left.originalIndex - right.originalIndex
			);
		})
		.map(({ serving }) => serving);

export const getFoodServingsInUserDisplayPriority = (
	food?: FoodItem,
): FoodServing[] => prioritizeFoodServingsForUserDisplay(getFoodServings(food));

export const getPrimaryFoodServing = (food?: FoodItem): FoodServing | null => {
	const servings = getFoodServings(food);
	return servings.find((serving) => serving.isPrimary) ?? servings[0] ?? null;
};

export const getFoodServingByGrams = (
	food: FoodItem | undefined,
	gramWeight: number,
): FoodServing | null =>
	getFoodServings(food).find(
		(serving) =>
			serving.gramWeight !== undefined &&
			Math.abs(serving.gramWeight - gramWeight) < 0.01,
	) ?? null;
