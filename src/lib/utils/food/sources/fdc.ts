import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import {
	INGREDIENT_SEARCH_PAGE_SIZE,
	type IngredientSearchPage,
	type IngredientSearchPageOptions,
} from "$lib/utils/ingredients/ingredientSearchPagination";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";
import { resolveFoodIdentityType } from "$lib/utils/food/identity/foodIdentity";

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
	ndbNumber?: number | string;
};

const normalizeLegacyUsdaNdbNumber = (value: number | string | undefined) => {
	const digits = String(value ?? "").replace(/\D/g, "");
	return digits ? digits.padStart(5, "0") : null;
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
		const nutrientId = Number(nutrient.nutrientId);
		const nutrientName = nutrient.nutrientName?.trim();
		const unitName = nutrient.unitName?.trim();
		const value = toFiniteNonnegativeNumber(nutrient.value);
		if (
			!Number.isSafeInteger(nutrientId) ||
			nutrientId <= 0 ||
			!nutrientName ||
			!unitName ||
			value === null
		) return null;
		return {
			nutrientId,
			nutrientName,
			nutrientNumber: String(nutrient.nutrientNumber ?? ""),
			unitName,
			value,
		};
	}

	const definition = nutrient.nutrient;
	const nutrientId = Number(definition?.id);
	const nutrientName = definition?.name?.trim();
	const unitName = definition?.unitName?.trim();
	const value = toFiniteNonnegativeNumber(nutrient.amount);
	if (
		!Number.isSafeInteger(nutrientId) ||
		nutrientId <= 0 ||
		!nutrientName ||
		!unitName ||
		value === null
	) return null;
	return {
		nutrientId,
		nutrientName,
		nutrientNumber: String(definition?.number ?? ""),
		unitName,
		value,
	};
};

export const normalizeFdcFood = (food: FdcFoodResponse): FdcFood => {
	const foodNutrients = (food.foodNutrients ?? []).flatMap((nutrient) => {
		const normalized = normalizeFoodNutrient(nutrient);
		return normalized ? [normalized] : [];
	});
	const legacyUsdaNdbNumber = normalizeLegacyUsdaNdbNumber(food.ndbNumber);
	return {
		...food,
		description: formatSourceProductName(food.description),
		sourceIdentifiers: {
			...food.sourceIdentifiers,
			usdaFdcId: String(food.fdcId),
			...(legacyUsdaNdbNumber
				? { usdaNdbNumber: legacyUsdaNdbNumber }
				: {}),
		},
		nameProvenance: "source",
		foodIdentityType: resolveFoodIdentityType(food),
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
		source: options.sourceFilter ?? "all",
		trust: options.trustFilter ?? "any",
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
