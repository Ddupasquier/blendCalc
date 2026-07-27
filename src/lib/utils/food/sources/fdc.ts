import type {
	FdcFood,
	FdcNutrient,
	FoodServing,
} from "$lib/utils/food/types";
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

type FdcDetailPortion = {
	amount?: number;
	gramWeight?: number;
	modifier?: string;
	portionDescription?: string;
	sequenceNumber?: number;
	measureUnit?: {
		name?: string;
		abbreviation?: string;
	};
};

type FdcSearchMeasure = {
	amount?: number;
	disseminationText?: string;
	gramWeight?: number;
	measureUnitName?: string;
	modifier?: string;
	rank?: number;
};

type FdcFoodResponse = Omit<FdcFood, "foodNutrients"> & {
	foodNutrients?: Array<FdcNutrient | FdcDetailNutrient>;
	foodPortions?: FdcDetailPortion[];
	foodMeasures?: FdcSearchMeasure[];
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

const toPositiveNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
};

const getDetailPortionLabel = (portion: FdcDetailPortion) =>
	portion.portionDescription?.trim() ||
	portion.modifier?.trim() ||
	[
		toPositiveNumber(portion.amount),
		portion.measureUnit?.abbreviation?.trim() ||
			portion.measureUnit?.name?.trim(),
	].filter(Boolean).join(" ");

const getSearchMeasureLabel = (measure: FdcSearchMeasure) =>
	measure.disseminationText?.trim() ||
	measure.modifier?.trim() ||
	[
		toPositiveNumber(measure.amount),
		measure.measureUnitName?.trim(),
	].filter(Boolean).join(" ");

const normalizeFoodServings = (
	food: FdcFoodResponse,
): FoodServing[] => {
	const sourceReference = String(food.fdcId);
	const rows = [
		...(food.foodPortions ?? []).flatMap((portion) => {
			const label = getDetailPortionLabel(portion);
			const gramWeight = toPositiveNumber(portion.gramWeight);
			return label && gramWeight !== null
				? [{
					label,
					gramWeight,
					amount: toPositiveNumber(portion.amount),
					order: toPositiveNumber(portion.sequenceNumber),
				}]
				: [];
		}),
		...(food.foodMeasures ?? []).flatMap((measure) => {
			const label = getSearchMeasureLabel(measure);
			const gramWeight = toPositiveNumber(measure.gramWeight);
			return label && gramWeight !== null
				? [{
					label,
					gramWeight,
					amount: toPositiveNumber(measure.amount),
					order: toPositiveNumber(measure.rank),
				}]
				: [];
		}),
	];
	const seen = new Set<string>();
	return rows.flatMap((serving, index) => {
		const key = `${serving.label.toLocaleLowerCase("en-US")}:${serving.gramWeight}`;
		if (seen.has(key)) return [];
		seen.add(key);
		return [{
			label: serving.label,
			gramWeight: serving.gramWeight,
			amount: serving.amount ?? undefined,
			isPrimary: serving.order === 1 || (index === 0 && !rows.some(
				(candidate) => candidate.order === 1,
			)),
			source: "usda" as const,
			sourceReference,
			confidence: "unknown" as const,
		}];
	});
};

export const normalizeFdcFood = (food: FdcFoodResponse): FdcFood => {
	const foodNutrients = (food.foodNutrients ?? []).flatMap((nutrient) => {
		const normalized = normalizeFoodNutrient(nutrient);
		return normalized ? [normalized] : [];
	});
	const legacyUsdaNdbNumber = normalizeLegacyUsdaNdbNumber(food.ndbNumber);
	const foodServings = normalizeFoodServings(food);
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
		foodServings,
		hasSourceServing: foodServings.length > 0,
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
