import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";

type FdcDetailNutrient = {
	amount?: number;
	nutrient?: {
		id?: number;
		name?: string;
		number?: string;
		unitName?: string;
	};
};

type FdcFoodResponse = Omit<FdcFood, "foodNutrients"> & {
	foodNutrients?: Array<FdcNutrient | FdcDetailNutrient>;
};

export const FDC_CONFIGURATION_MESSAGE =
	"Food search is temporarily unavailable.";

export class FdcConfigurationError extends Error {
	constructor(message = FDC_CONFIGURATION_MESSAGE) {
		super(message);
		this.name = "FdcConfigurationError";
	}
}

const normalizeFoodNutrient = (
	nutrient: FdcNutrient | FdcDetailNutrient,
): FdcNutrient | null => {
	if ("nutrientId" in nutrient) {
		return {
			nutrientId: Number(nutrient.nutrientId),
			nutrientName: nutrient.nutrientName,
			nutrientNumber: String(nutrient.nutrientNumber ?? ""),
			unitName: nutrient.unitName,
			value: Number(nutrient.value) || 0,
		};
	}

	if (!nutrient.nutrient?.id) return null;
	return {
		nutrientId: nutrient.nutrient.id,
		nutrientName: nutrient.nutrient.name ?? "Unknown nutrient",
		nutrientNumber: String(nutrient.nutrient.number ?? ""),
		unitName: nutrient.nutrient.unitName ?? "",
		value: Number(nutrient.amount) || 0,
	};
};

export const normalizeFdcFood = (food: FdcFoodResponse): FdcFood => {
	const foodNutrients = (food.foodNutrients ?? []).flatMap((nutrient) => {
		const normalized = normalizeFoodNutrient(nutrient);
		return normalized ? [normalized] : [];
	});
	return {
		...food,
		foodNutrients,
		reportedNutrientIds: foodNutrients.map((nutrient) => nutrient.nutrientId),
	};
};

export const searchFoods = async (query: string): Promise<FdcFood[]> => {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const response = await fetch(
		`/api/foods/search?q=${encodeURIComponent(trimmed)}`,
		{ headers: { accept: "application/json" } },
	);
	if (!response.ok) {
		throw new FdcConfigurationError();
	}
	const data = await response.json() as { foods?: FdcFood[] };
	return data.foods ?? [];
};
