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
		source: food.barcodeSource === "open-food-facts"
			? "open-food-facts"
			: food.barcodeSource === "manual"
				? "user-label"
				: food.barcodeSource === "community"
					? "community-reviewed"
					: "usda",
		sourceReference: food.sourceKey === "usda"
			? String(food.fdcId)
			: food.barcode ?? food.gtinUpc,
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
