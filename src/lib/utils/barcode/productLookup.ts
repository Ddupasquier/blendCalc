import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	getOpenFoodFactsValue,
	mapOpenFoodFactsAdditionalNutrients,
} from "$lib/utils/barcode/barcodeNutrients";
import {
	parseVolumeEquivalent,
	type BarcodeVolumeEquivalent,
} from "$lib/utils/barcode/servingVolume";
import { NUTRIENT_IDS, type FdcFood, type FdcNutrient } from "$lib/utils/food/types";

export type OpenFoodFactsNutriments = Record<string, number | string | undefined>;

export type OpenFoodFactsProduct = {
	code?: string;
	product_name?: string;
	generic_name?: string;
	brands?: string;
	ingredients_text?: string;
	ingredients_text_en?: string;
	allergens?: string;
	allergens_tags?: string[];
	traces?: string;
	traces_tags?: string[];
	labels?: string;
	labels_tags?: string[];
	categories?: string;
	categories_tags?: string[];
	serving_size?: string;
	serving_quantity?: number | string;
	serving_quantity_unit?: string;
	nutriments?: OpenFoodFactsNutriments;
};

export type OpenFoodFactsResponse = {
	status: number;
	product?: OpenFoodFactsProduct;
};

export type BarcodeProductDraft = {
	barcode: string;
	name: string;
	brandOwner: string;
	servingLabel: string;
	servingWeightGrams: number;
	nutrients: FdcNutrient[];
	reportedNutrientIds: number[];
	ingredients?: string;
	ingredientList?: string[];
	allergens?: string[];
	traces?: string[];
	dietaryTags?: string[];
	labels?: string[];
	categories?: string[];
	volumeEquivalent?: BarcodeVolumeEquivalent;
	source: "open-food-facts" | "usda" | "shared-catalog";
	sourceLabel: string;
	sourceReference?: string;
};

export type BarcodeLookupResult =
	| { status: "found"; draft: BarcodeProductDraft }
	| { status: "not-found"; barcode: string }
	| { status: "error"; barcode: string; message: string };

type CoreNutritionKey = "calories" | "fat" | "carbs" | "fiber" | "sugar" | "protein";
type CoreNutritionValues = Record<CoreNutritionKey, number>;

const coreNutrientDefinitions: Array<{
	key: CoreNutritionKey;
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string;
	unitName: string;
}> = [
	{
		key: "calories",
		nutrientId: NUTRIENT_IDS.CALORIES,
		nutrientName: "Energy",
		nutrientNumber: "208",
		unitName: "KCAL",
	},
	{
		key: "fat",
		nutrientId: NUTRIENT_IDS.FAT,
		nutrientName: "Total lipid (fat)",
		nutrientNumber: "204",
		unitName: "G",
	},
	{
		key: "carbs",
		nutrientId: NUTRIENT_IDS.CARBS,
		nutrientName: "Carbohydrate, by difference",
		nutrientNumber: "205",
		unitName: "G",
	},
	{
		key: "fiber",
		nutrientId: NUTRIENT_IDS.FIBER,
		nutrientName: "Fiber, total dietary",
		nutrientNumber: "291",
		unitName: "G",
	},
	{
		key: "sugar",
		nutrientId: NUTRIENT_IDS.SUGAR,
		nutrientName: "Total Sugars",
		nutrientNumber: "269",
		unitName: "G",
	},
	{
		key: "protein",
		nutrientId: NUTRIENT_IDS.PROTEIN,
		nutrientName: "Protein",
		nutrientNumber: "203",
		unitName: "G",
	},
];
const isGramUnit = (unit?: string) =>
	["g", "grm", "gram", "grams"].includes(unit?.trim().toLowerCase() ?? "");

const toNumber = (value: unknown) => {
	const numberValue = typeof value === "string" ? Number.parseFloat(value) : Number(value);
	return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const nutritionToNutrients = (
	nutrition: CoreNutritionValues,
	source: FdcNutrient["source"],
	confidence: FdcNutrient["confidence"],
	sourceReference?: string,
): FdcNutrient[] =>
	coreNutrientDefinitions.flatMap((definition) => {
		const value = toNumber(nutrition[definition.key]);
		if (value <= 0) return [];
		return [{
			nutrientId: definition.nutrientId,
			nutrientName: definition.nutrientName,
			nutrientNumber: definition.nutrientNumber,
			unitName: definition.unitName,
			value,
			valueOrigin: "reported",
			source,
			sourceReference,
			confidence,
		}];
	});

const cleanTag = (value: string) =>
	value
		.replace(/^[a-z]{2}:/i, "")
		.replace(/-/g, " ")
		.trim();

const uniqueCleanValues = (values: Array<string | undefined>) => {
	const seen = new Set<string>();
	return values.flatMap((value) => {
		const cleaned = cleanTag(value ?? "");
		if (!cleaned) return [];
		const key = cleaned.toLocaleLowerCase();
		if (seen.has(key)) return [];
		seen.add(key);
		return [cleaned];
	});
};

const splitDelimitedValues = (value?: string) =>
	uniqueCleanValues((value ?? "").split(/[;,]/));

const splitIngredientList = (value?: string) =>
	uniqueCleanValues((value ?? "").split(/,(?![^(]*\))/));

const parseOpenFoodFactsMetadata = (product: OpenFoodFactsProduct) => {
	const ingredients =
		product.ingredients_text_en?.trim() || product.ingredients_text?.trim();

	return {
		ingredients: ingredients || undefined,
		ingredientList: splitIngredientList(ingredients),
		allergens: uniqueCleanValues([
			...splitDelimitedValues(product.allergens),
			...(product.allergens_tags ?? []),
		]),
		traces: uniqueCleanValues([
			...splitDelimitedValues(product.traces),
			...(product.traces_tags ?? []),
		]),
		dietaryTags: uniqueCleanValues(product.labels_tags ?? []),
		labels: uniqueCleanValues([
			...splitDelimitedValues(product.labels),
			...(product.labels_tags ?? []),
		]),
		categories: uniqueCleanValues([
			...splitDelimitedValues(product.categories),
			...(product.categories_tags ?? []),
		]),
	};
};

const parseFdcMetadata = (food: FdcFood) => ({
	ingredients: food.ingredients?.trim() || undefined,
	ingredientList: food.ingredientList?.length
		? uniqueCleanValues(food.ingredientList)
		: splitIngredientList(food.ingredients),
	allergens: uniqueCleanValues(food.allergens ?? []),
	traces: uniqueCleanValues(food.traces ?? []),
	dietaryTags: uniqueCleanValues(food.dietaryTags ?? []),
	labels: uniqueCleanValues(food.labels ?? []),
	categories: uniqueCleanValues(food.categories ?? []),
});

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

const getOpenFoodFactsReportedNutrientIds = (
	nutriments: OpenFoodFactsNutriments,
	servingWeightGrams: number,
	useServingValues: boolean,
) => {
	const candidates: Array<[number, string[]]> = [
		[NUTRIENT_IDS.CALORIES, ["energy-kcal", "energy-kj"]],
		[NUTRIENT_IDS.FAT, ["fat"]],
		[NUTRIENT_IDS.CARBS, ["carbohydrates", "carbohydrates-total"]],
		[NUTRIENT_IDS.FIBER, ["fiber"]],
		[NUTRIENT_IDS.SUGAR, ["sugars"]],
		[NUTRIENT_IDS.PROTEIN, ["proteins", "protein"]],
	];
	const reported = candidates.flatMap(([nutrientId, keys]) =>
		getOpenFoodFactsValue(
			nutriments,
			keys,
			servingWeightGrams,
			useServingValues,
		)
			? [nutrientId]
			: [],
	);
	return reported;
};

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

	const observedNutrients = mapOpenFoodFactsAdditionalNutrients(
		product.nutriments,
		servingWeightGrams,
		useServingValues,
	);
	const metadata = parseOpenFoodFactsMetadata(product);

	const nutrition = {
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
	};
	const nutrients = [
		...nutritionToNutrients(
			nutrition,
			"open-food-facts",
			"imported",
			canonicalBarcode,
		),
		...observedNutrients.map((nutrient) => ({
			...nutrient,
			valueOrigin: nutrient.valueOrigin ?? "reported",
			source: nutrient.source ?? "open-food-facts",
			sourceReference: nutrient.sourceReference ?? canonicalBarcode,
			confidence: nutrient.confidence ?? "imported",
		})),
	];

	return {
		barcode: canonicalBarcode,
		name,
		brandOwner: product.brands?.trim() ?? "",
		servingLabel:
			(useServingValues && product.serving_size?.trim()) || `${servingWeightGrams} g`,
		servingWeightGrams,
		nutrients,
		reportedNutrientIds: [
			...new Set([
				...getOpenFoodFactsReportedNutrientIds(
					product.nutriments,
					servingWeightGrams,
					useServingValues,
				),
				...observedNutrients.map((nutrient) => nutrient.nutrientId),
			]),
		],
		...metadata,
		volumeEquivalent: hasExactGramWeight
			? parseVolumeEquivalent(product.serving_size)
				?? undefined
			: undefined,
		source: "open-food-facts",
		sourceLabel: "Open Food Facts",
		sourceReference: canonicalBarcode,
	};
};

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
	const metadata = parseFdcMetadata(food);
	const nutrients = food.foodNutrients.map((nutrient) => ({
		...nutrient,
		value: toNumber(nutrient.value) * servingScale,
	}));

	return {
		barcode: canonicalBarcode,
		name: food.description,
		brandOwner: food.brandOwner ?? "",
		servingLabel:
			(hasExactGramWeight && food.householdServingFullText) || `${servingWeightGrams} g`,
		servingWeightGrams,
		nutrients,
		reportedNutrientIds: [
			...new Set(
				food.reportedNutrientIds ??
					food.foodNutrients.map((nutrient) => nutrient.nutrientId),
			),
		],
		...metadata,
		volumeEquivalent: hasExactGramWeight
			? parseVolumeEquivalent(food.householdServingFullText) ?? undefined
			: undefined,
		source: "usda",
		sourceLabel: "USDA FoodData Central",
		sourceReference: String(food.fdcId),
	};
};

export const mapSharedCatalogFood = (
	food: FdcFood,
	barcode: string,
): BarcodeProductDraft | null => {
	const draft = mapFdcBarcodeFood(food, barcode);
	if (!draft) return null;

	return {
		...draft,
		source: "shared-catalog",
		sourceLabel: "Smoothie Mixer verified catalog",
		sourceReference: food.sharedProductId,
	};
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

	try {
		const response = await fetch(
			`/api/products/barcode/${encodeURIComponent(canonicalBarcode)}`,
			{ headers: { accept: "application/json" } },
		);
		if (response.status === 404) {
			return { status: "not-found", barcode: canonicalBarcode };
		}
		if (!response.ok) throw new Error("Barcode lookup failed.");
		return await response.json() as BarcodeLookupResult;
	} catch {
		return {
			status: "error",
			barcode: canonicalBarcode,
			message: "Product lookup is temporarily unavailable. You can still enter the label manually.",
		};
	}
};
