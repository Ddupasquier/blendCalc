import type { FdcFood, FoodServing } from "$lib/utils/food/types";
import {
	getServingMeasureDimension,
	parseServingAmount,
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

const getLegacyServingSource = (
	food: FdcFood,
): NonNullable<FoodServing["source"]> => {
	const provenanceSource = food.fieldProvenance?.serving?.source;
	if (provenanceSource === "shared-catalog") return "community-reviewed";
	if (isServingSource(provenanceSource)) {
		return provenanceSource;
	}
	if (isServingSource(food.sourceKey)) {
		return food.sourceKey;
	}
	if (food.barcodeSource === "manual") return "user-label";
	if (food.barcodeSource === "community") return "community-reviewed";
	if (
		food.barcodeSource === "usda" ||
		food.barcodeSource === "open-food-facts"
	) {
		return food.barcodeSource;
	}
	return "unknown";
};

const getLegacyServing = (food: FdcFood): FoodServing | null => {
	if (food.hasSourceServing === false) return null;

	const customWeight = toFinitePositiveNumber(food.customServingWeightGrams);
	const parsedServing = parseServingAmount(
		`${food.servingSize ?? ""} ${food.servingSizeUnit ?? ""}`,
	);
	const parsedWeight =
		parsedServing && getServingMeasureDimension(parsedServing.unit) === "weight"
			? parsedServing.grams
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
	return {
		label,
		gramWeight,
		amount: parsedServing?.quantity,
		unitKey: parsedServing?.unit,
		isPrimary: true,
		source: getLegacyServingSource(food),
		sourceReference:
			food.fieldProvenance?.serving?.sourceReference ??
			(food.sourceKey === "usda"
				? String(food.fdcId)
				: food.barcode ?? food.gtinUpc),
		confidence: food.barcodeSource === "manual"
			? "user-reported"
			: food.barcodeSource === "community"
				? "moderator-reviewed"
				: "unknown",
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
