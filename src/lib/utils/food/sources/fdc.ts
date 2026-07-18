import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import {
	INGREDIENT_SEARCH_PAGE_SIZE,
	type IngredientSearchPage,
	type IngredientSearchPageOptions,
} from "$lib/utils/ingredients/ingredientSearchPagination";

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
		description: formatSourceProductName(food.description),
		nameProvenance: "source",
		foodNutrients,
		reportedNutrientIds: foodNutrients.map((nutrient) => nutrient.nutrientId),
	};
};

export const searchFoodPage = async (
	query: string,
	options: IngredientSearchPageOptions = {},
): Promise<IngredientSearchPage> => {
	const trimmed = query.trim();
	if (!trimmed) {
		return { foods: [], hasMore: false, nextOffset: null, total: 0 };
	}
	const offset = options.offset ?? 0;
	const limit = options.limit ?? INGREDIENT_SEARCH_PAGE_SIZE;
	const searchParams = new URLSearchParams({
		q: trimmed,
		offset: String(offset),
		limit: String(limit),
	});

	const response = await fetch(
		`/api/foods/search?${searchParams.toString()}`,
		{ headers: { accept: "application/json" } },
	);
	if (!response.ok) {
		throw new FdcConfigurationError();
	}
	const data = await response.json() as Partial<IngredientSearchPage>;
	const foods = data.foods ?? [];
	const nextOffset = typeof data.nextOffset === "number" &&
		Number.isInteger(data.nextOffset)
		? data.nextOffset
		: null;
	const total = typeof data.total === "number" && Number.isInteger(data.total)
		? data.total
		: foods.length;
	return {
		foods,
		hasMore: data.hasMore === true,
		nextOffset,
		total,
	};
};

export const searchFoods = async (query: string): Promise<FdcFood[]> =>
	(await searchFoodPage(query)).foods;
