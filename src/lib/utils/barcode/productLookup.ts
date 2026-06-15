import { cacheGet, cacheSet } from "$lib/cache";
import { getBarcodeLookupCandidates, normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	getOpenFoodFactsValue,
	mapOpenFoodFactsAdditionalNutrients,
} from "$lib/utils/barcode/barcodeNutrients";
import {
	parseVolumeEquivalent,
	type BarcodeVolumeEquivalent,
} from "$lib/utils/barcode/servingVolume";
import type { CustomFoodNutritionInput } from "$lib/utils/food/customFoods";
import { searchBrandedFoodByBarcode } from "$lib/utils/food/fdc";
import { NUTRIENT_IDS, type FdcFood, type FdcNutrient } from "$lib/utils/food/types";

type OpenFoodFactsNutriments = Record<string, number | string | undefined>;

type OpenFoodFactsProduct = {
	code?: string;
	product_name?: string;
	generic_name?: string;
	brands?: string;
	serving_size?: string;
	serving_quantity?: number | string;
	serving_quantity_unit?: string;
	nutriments?: OpenFoodFactsNutriments;
};

type OpenFoodFactsResponse = {
	status: number;
	product?: OpenFoodFactsProduct;
};

export type BarcodeProductDraft = {
	barcode: string;
	name: string;
	brandOwner: string;
	servingLabel: string;
	servingWeightGrams: number;
	nutrition: CustomFoodNutritionInput;
	additionalNutrients: FdcNutrient[];
	volumeEquivalent?: BarcodeVolumeEquivalent;
	source: "open-food-facts" | "usda";
	sourceLabel: string;
};

export type BarcodeLookupResult =
	| { status: "found"; draft: BarcodeProductDraft }
	| { status: "not-found"; barcode: string }
	| { status: "error"; barcode: string; message: string };

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
const CORE_NUTRIENT_IDS = new Set<number>([
	NUTRIENT_IDS.CALORIES,
	NUTRIENT_IDS.FAT,
	NUTRIENT_IDS.CARBS,
	NUTRIENT_IDS.FIBER,
	NUTRIENT_IDS.SUGAR,
	NUTRIENT_IDS.PROTEIN,
]);
const isGramUnit = (unit?: string) =>
	["g", "grm", "gram", "grams"].includes(unit?.trim().toLowerCase() ?? "");

const toNumber = (value: unknown) => {
	const numberValue = typeof value === "string" ? Number.parseFloat(value) : Number(value);
	return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const parseServingBasis = (product: OpenFoodFactsProduct) => {
	const servingQuantity = toNumber(product.serving_quantity);
	const servingMatch = product.serving_size?.match(/([0-9]+(?:\.[0-9]+)?)\s*g\b/i);
	if (servingMatch) {
		return {
			servingWeightGrams: toNumber(servingMatch[1]),
			useServingValues: true,
			hasExactGramWeight: true,
		};
	}
	if (
		servingQuantity > 0 &&
		isGramUnit(product.serving_quantity_unit)
	) {
		return {
			servingWeightGrams: servingQuantity,
			useServingValues: true,
			hasExactGramWeight: true,
		};
	}
	return {
		servingWeightGrams: 100,
		useServingValues: false,
		hasExactGramWeight: false,
	};
};

const getOpenFoodFactsNutrient = (
	nutriments: OpenFoodFactsNutriments,
	keys: string[],
	servingWeightGrams: number,
	useServingValues: boolean,
) => getOpenFoodFactsValue(
	nutriments,
	keys,
	servingWeightGrams,
	useServingValues,
)?.value ?? 0;

export const mapOpenFoodFactsProduct = (
	product: OpenFoodFactsProduct,
	barcode: string,
): BarcodeProductDraft | null => {
	const canonicalBarcode = normalizeBarcode(barcode);
	const name = product.product_name?.trim() || product.generic_name?.trim();
	if (!canonicalBarcode || !name || !product.nutriments) return null;

	const { servingWeightGrams, useServingValues, hasExactGramWeight } =
		parseServingBasis(product);
	const energyKcal = getOpenFoodFactsNutrient(
		product.nutriments,
		["energy-kcal"],
		servingWeightGrams,
		useServingValues,
	);
	const energyKilojoules = getOpenFoodFactsNutrient(
		product.nutriments,
		["energy-kj"],
		servingWeightGrams,
		useServingValues,
	);

	return {
		barcode: canonicalBarcode,
		name,
		brandOwner: product.brands?.trim() ?? "",
		servingLabel:
			(useServingValues && product.serving_size?.trim()) || `${servingWeightGrams} g`,
		servingWeightGrams,
		additionalNutrients: mapOpenFoodFactsAdditionalNutrients(
			product.nutriments,
			servingWeightGrams,
			useServingValues,
		),
		volumeEquivalent: hasExactGramWeight
			? parseVolumeEquivalent(product.serving_size)
				?? undefined
			: undefined,
		nutrition: {
			calories: energyKcal || energyKilojoules / 4.184,
			fat: getOpenFoodFactsNutrient(
				product.nutriments,
				["fat"],
				servingWeightGrams,
				useServingValues,
			),
			carbs: getOpenFoodFactsNutrient(
				product.nutriments,
				["carbohydrates", "carbohydrates-total"],
				servingWeightGrams,
				useServingValues,
			),
			fiber: getOpenFoodFactsNutrient(
				product.nutriments,
				["fiber"],
				servingWeightGrams,
				useServingValues,
			),
			sugar: getOpenFoodFactsNutrient(
				product.nutriments,
				["sugars"],
				servingWeightGrams,
				useServingValues,
			),
			protein: getOpenFoodFactsNutrient(
				product.nutriments,
				["proteins", "protein"],
				servingWeightGrams,
				useServingValues,
			),
		},
		source: "open-food-facts",
		sourceLabel: "Open Food Facts",
	};
};

const getFdcNutrientValue = (food: FdcFood, nutrientId: number) =>
	toNumber(food.foodNutrients.find((nutrient) => nutrient.nutrientId === nutrientId)?.value);

export const mapFdcBarcodeFood = (
	food: FdcFood,
	barcode: string,
): BarcodeProductDraft | null => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode || !food.description) return null;

	const servingWeightGrams =
		food.servingSize && isGramUnit(food.servingSizeUnit)
			? food.servingSize
			: 100;
	const hasExactGramWeight =
		Boolean(food.servingSize) && isGramUnit(food.servingSizeUnit);
	const servingScale = servingWeightGrams / 100;
	const perServing = (nutrientId: number) =>
		getFdcNutrientValue(food, nutrientId) * servingScale;

	return {
		barcode: canonicalBarcode,
		name: food.description,
		brandOwner: food.brandOwner ?? "",
		servingLabel:
			(hasExactGramWeight && food.householdServingFullText) || `${servingWeightGrams} g`,
		servingWeightGrams,
		additionalNutrients: food.foodNutrients
			.filter((nutrient) => !CORE_NUTRIENT_IDS.has(nutrient.nutrientId))
			.map((nutrient) => ({
				...nutrient,
				value: toNumber(nutrient.value) * servingScale,
			})),
		volumeEquivalent: hasExactGramWeight
			? parseVolumeEquivalent(food.householdServingFullText) ?? undefined
			: undefined,
		nutrition: {
			calories: perServing(NUTRIENT_IDS.CALORIES),
			fat: perServing(NUTRIENT_IDS.FAT),
			carbs: perServing(NUTRIENT_IDS.CARBS),
			fiber: perServing(NUTRIENT_IDS.FIBER),
			sugar: perServing(NUTRIENT_IDS.SUGAR),
			protein: perServing(NUTRIENT_IDS.PROTEIN),
		},
		source: "usda",
		sourceLabel: "USDA FoodData Central",
	};
};

const lookupOpenFoodFacts = async (barcode: string) => {
	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const response = await fetch(
			`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(candidate)}.json?fields=code,product_name,generic_name,brands,serving_size,serving_quantity,serving_quantity_unit,nutriments`,
		);
		if (!response.ok) {
			if (response.status === 404) continue;
			throw new Error(`Open Food Facts lookup failed with ${response.status}.`);
		}

		const data: OpenFoodFactsResponse = await response.json();
		if (data.status !== 1 || !data.product) continue;
		const draft = mapOpenFoodFactsProduct(data.product, barcode);
		if (draft) return draft;
	}
	return null;
};

export const lookupBarcodeProduct = async (
	barcode: string,
): Promise<BarcodeLookupResult> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) {
		return {
			status: "error",
			barcode,
			message: "This does not look like a valid UPC or EAN barcode.",
		};
	}

	const cacheKey = `barcode_product_v2_${canonicalBarcode}`;
	const cached = cacheGet<BarcodeProductDraft | false>(cacheKey);
	if (cached !== null) {
		return cached
			? { status: "found", draft: cached }
			: { status: "not-found", barcode: canonicalBarcode };
	}

	let openFoodFactsFailed = false;
	try {
		const openFoodFactsDraft = await lookupOpenFoodFacts(barcode);
		if (openFoodFactsDraft) {
			cacheSet(cacheKey, openFoodFactsDraft);
			return { status: "found", draft: openFoodFactsDraft };
		}
	} catch {
		openFoodFactsFailed = true;
	}

	try {
		const fdcFood = await searchBrandedFoodByBarcode(barcode);
		const fdcDraft = fdcFood ? mapFdcBarcodeFood(fdcFood, barcode) : null;
		if (fdcDraft) {
			cacheSet(cacheKey, fdcDraft);
			return { status: "found", draft: fdcDraft };
		}
	} catch {
		if (openFoodFactsFailed) {
			return {
				status: "error",
				barcode: canonicalBarcode,
				message: "Product lookup is temporarily unavailable. You can still enter the label manually.",
			};
		}
	}

	cacheSet(cacheKey, false, 60 * 60 * 1000);
	return { status: "not-found", barcode: canonicalBarcode };
};
