import type { FdcFood, FoodServing } from "$lib/utils/food/types";
import {
	getServingMeasureDimension,
	parseSourceServingMeasure,
	convertServingToGrams,
} from "$lib/utils/serving/servingAmount";
import { toFinitePositiveNumber } from "$lib/utils/numbers/finiteNumbers";

const normalizeServing = (serving: FoodServing): FoodServing | null => {
	const label = serving.label.trim();
	const gramWeight = toFinitePositiveNumber(serving.gramWeight);
	if (!label || gramWeight === null) return null;

	const amount = toFinitePositiveNumber(serving.amount);
	return {
		label,
		gramWeight,
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

const getLegacyServingLineage = (food: FdcFood) => {
	const provenanceSource = food.fieldProvenance?.serving?.source;
	const source = provenanceSource === "shared-catalog"
		? "community-reviewed"
		: isServingSource(provenanceSource)
			? provenanceSource
			: "unknown";
	const sourceReference = food.fieldProvenance?.serving?.sourceReference?.trim() ||
		undefined;
	const confidence = food.fieldProvenance?.serving?.confidence ??
		(source === "user-label" ? "user-reported" : "unknown");
	return { source, sourceReference, confidence } as const;
};

const getLegacyServing = (food: FdcFood): FoodServing | null => {
	if (food.hasSourceServing === false) return null;

	const customWeight = toFinitePositiveNumber(food.customServingWeightGrams);
	const parsedServing = parseSourceServingMeasure(
		`${food.servingSize ?? ""} ${food.servingSizeUnit ?? ""}`,
	);
	const convertedWeight = parsedServing
		? convertServingToGrams(parsedServing.quantity, parsedServing.unit)
		: null;
	const parsedWeight =
		parsedServing &&
		getServingMeasureDimension(parsedServing.unit) === "weight" &&
		convertedWeight !== null
			? convertedWeight
			: null;
	const gramWeight =
		customWeight !== null
			? customWeight
			: parsedWeight;
	if (!gramWeight || gramWeight <= 0) return null;

	const label =
		food.customServingLabel?.trim() ||
		food.householdServingFullText?.trim() ||
		`${Number(gramWeight.toFixed(2))}g`;
	const lineage = getLegacyServingLineage(food);
	return {
		label,
		gramWeight,
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
		calculationBasis: parsedWeight !== null && lineage.source !== "user-label"
			? `${parsedServing?.quantity} ${parsedServing?.unit}`
			: undefined,
		...lineage,
	};
};

export const getFoodServings = (food?: FdcFood): FoodServing[] => {
	if (!food) return [];
	const explicit = (food.foodServings ?? []).flatMap((serving) => {
		const normalized = normalizeServing(serving);
		return normalized ? [normalized] : [];
	});
	if (explicit.length > 0) {
		return explicit.sort((left, right) =>
			Number(right.isPrimary) - Number(left.isPrimary) ||
			left.gramWeight - right.gramWeight ||
			left.label.localeCompare(right.label),
		);
	}

	const legacy = getLegacyServing(food);
	return legacy ? [legacy] : [];
};

export const getPrimaryFoodServing = (food?: FdcFood): FoodServing | null => {
	const servings = getFoodServings(food);
	return servings.find((serving) => serving.isPrimary) ?? servings[0] ?? null;
};

export const getFoodServingByGrams = (
	food: FdcFood | undefined,
	gramWeight: number,
): FoodServing | null =>
	getFoodServings(food).find(
		(serving) => Math.abs(serving.gramWeight - gramWeight) < 0.01,
	) ?? null;
