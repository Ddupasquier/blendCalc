import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapOpenFoodFactsNutrients,
	type OpenFoodFactsNutriments,
} from "$lib/utils/barcode/barcodeNutrients";
import {
	parseVolumeEquivalent,
	type BarcodeVolumeEquivalent,
} from "$lib/utils/barcode/servingVolume";
import {
	type FdcFood,
	type FdcNutrient,
	type FoodImageAsset,
} from "$lib/utils/food/types";
import { OPEN_FOOD_FACTS_IMAGE_LICENSE } from "$lib/utils/food/images/foodImages";
import { normalizeFoodCategoryValue } from "$lib/utils/food/categories/categoryNormalization.js";
import {
	getProductDataSource,
	type ProductReferenceData,
} from "$lib/utils/food/reference/productReferenceData";
import {
	getServingMeasureDimension,
	parseServingAmount,
} from "$lib/utils/serving/servingAmount";

export type { OpenFoodFactsNutriments } from "$lib/utils/barcode/barcodeNutrients";

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
	categories_hierarchy?: string[];
	food_groups?: string;
	food_groups_tags?: string[];
	image_front_url?: string;
	image_front_small_url?: string;
	image_front_thumb_url?: string;
	image_url?: string;
	image_small_url?: string;
	image_thumb_url?: string;
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
	hasSourceServing?: boolean;
	nutrients: FdcNutrient[];
	reportedNutrientIds: number[];
	ingredients?: string;
	ingredientList?: string[];
	allergens?: string[];
	traces?: string[];
	dietaryTags?: string[];
	labels?: string[];
	categories?: string[];
	resolvedCategory?: string;
	categoryResolution?: {
		categoryOptionId: string;
		label: string;
		sourceValue: string;
		confidence: string;
	};
	image?: FoodImageAsset;
	volumeEquivalent?: BarcodeVolumeEquivalent;
	source: "open-food-facts" | "usda" | "shared-catalog";
	sourceLabel: string;
	sourceReference?: string;
	sourceKey?: string;
	sourceDataType?: string;
	sourcePublishedDate?: string;
	sourceModifiedDate?: string;
};

export type BarcodeLookupResult =
	| { status: "found"; draft: BarcodeProductDraft }
	| { status: "not-found"; barcode: string }
	| { status: "error"; barcode: string; message: string };

export const getBarcodeProductSourceDisplayLabel = (
	draft: Pick<BarcodeProductDraft, "sourceLabel" | "sourceDataType">,
) => [draft.sourceLabel, draft.sourceDataType].filter(Boolean).join(" · ");

const toNumber = (value: unknown) => {
	const numberValue = typeof value === "string" ? Number.parseFloat(value) : Number(value);
	return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

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
			...splitDelimitedValues(product.food_groups),
			...(product.food_groups_tags ?? []),
			...(product.categories_hierarchy ?? []),
			...(product.categories_tags ?? []),
			...splitDelimitedValues(product.categories),
		]),
	};
};

const parseOpenFoodFactsImage = (
	product: OpenFoodFactsProduct,
	barcode: string,
): FoodImageAsset | undefined => {
	const imageUrl = product.image_front_url || product.image_url;
	if (!imageUrl) return undefined;

	return {
		source: "open-food-facts",
		sourceReference: barcode,
		role: "front",
		imageUrl,
		thumbnailUrl:
			product.image_front_small_url ||
			product.image_front_thumb_url ||
			product.image_small_url ||
			product.image_thumb_url ||
			imageUrl,
		licenseName: OPEN_FOOD_FACTS_IMAGE_LICENSE.name,
		licenseUrl: OPEN_FOOD_FACTS_IMAGE_LICENSE.url,
		attributionText: OPEN_FOOD_FACTS_IMAGE_LICENSE.attribution,
		confidence: "imported",
		fetchedAt: new Date().toISOString(),
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
	categories: uniqueCleanValues([
		...(food.categories ?? []),
		food.foodCategory,
		food.brandedFoodCategory,
	]),
});

const parseServingBasis = (product: OpenFoodFactsProduct) => {
	const servingQuantity = toNumber(product.serving_quantity);
	const parsedServing = parseServingAmount(product.serving_size ?? "");
	if (parsedServing && getServingMeasureDimension(parsedServing.unit) === "weight") {
		return {
			servingWeightGrams: parsedServing.grams,
			useServingValues: true,
			hasExactGramWeight: true,
		};
	}
	const parsedQuantity = parseServingAmount(
		`${servingQuantity} ${product.serving_quantity_unit ?? ""}`,
	);
	if (
		servingQuantity > 0 &&
		parsedQuantity &&
		getServingMeasureDimension(parsedQuantity.unit) === "weight"
	) {
		return {
			servingWeightGrams: parsedQuantity.grams,
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

export const mapOpenFoodFactsProduct = (
	product: OpenFoodFactsProduct,
	barcode: string,
	referenceData: ProductReferenceData,
): BarcodeProductDraft | null => {
	const canonicalBarcode = normalizeBarcode(barcode);
	const name = product.product_name?.trim() || product.generic_name?.trim();
	if (!canonicalBarcode || !name || !product.nutriments) return null;

	const { servingWeightGrams, useServingValues, hasExactGramWeight } =
		parseServingBasis(product);
	const nutrients = mapOpenFoodFactsNutrients(
		product.nutriments,
		servingWeightGrams,
		useServingValues,
		referenceData,
	).map((nutrient) => ({ ...nutrient, sourceReference: canonicalBarcode }));
	const metadata = parseOpenFoodFactsMetadata(product);
	const image = parseOpenFoodFactsImage(product, canonicalBarcode);

	const source = getProductDataSource(referenceData, "open-food-facts");

	return {
		barcode: canonicalBarcode,
		name,
		brandOwner: product.brands?.trim() ?? "",
		servingLabel:
			(useServingValues && product.serving_size?.trim()) || `${servingWeightGrams} g`,
		servingWeightGrams,
		hasSourceServing: hasExactGramWeight,
		nutrients,
		reportedNutrientIds: [...new Set(nutrients.map((nutrient) => nutrient.nutrientId))],
		...metadata,
		image,
		volumeEquivalent: hasExactGramWeight
			? parseVolumeEquivalent(product.serving_size)
				?? undefined
			: undefined,
		source: "open-food-facts",
		sourceLabel: source.displayName,
		sourceReference: canonicalBarcode,
		sourceKey: source.key,
	};
};

export const mapFdcBarcodeFood = (
	food: FdcFood,
	barcode: string,
	referenceData: ProductReferenceData,
): BarcodeProductDraft | null => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode || !food.description) return null;

	const parsedServing = parseServingAmount(
		`${food.servingSize ?? ""} ${food.servingSizeUnit ?? ""}`,
	);
	const hasExactGramWeight = Boolean(
		parsedServing && getServingMeasureDimension(parsedServing.unit) === "weight",
	);
	const servingWeightGrams = hasExactGramWeight ? parsedServing?.grams ?? 100 : 100;
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
		hasSourceServing: hasExactGramWeight,
		nutrients,
		reportedNutrientIds: [
			...new Set(
				food.reportedNutrientIds ??
					food.foodNutrients.map((nutrient) => nutrient.nutrientId),
			),
		],
		...metadata,
		image: food.image,
		volumeEquivalent: hasExactGramWeight
			? parseVolumeEquivalent(food.householdServingFullText) ?? undefined
			: undefined,
		source: "usda",
		sourceLabel: getProductDataSource(referenceData, "usda").displayName,
		sourceReference: String(food.fdcId),
		sourceKey: "usda",
		sourceDataType: food.sourceDataType ?? food.dataType,
		sourcePublishedDate:
			food.sourcePublishedDate ?? food.publishedDate ?? food.publicationDate,
		sourceModifiedDate: food.sourceModifiedDate ?? food.modifiedDate,
	};
};

export const mapSharedCatalogFood = (
	food: FdcFood,
	barcode: string,
	referenceData: ProductReferenceData,
): BarcodeProductDraft | null => {
	const draft = mapFdcBarcodeFood(food, barcode, referenceData);
	if (!draft) return null;

	return {
		...draft,
		source: "shared-catalog",
		sourceLabel: getProductDataSource(referenceData, "shared-catalog").displayName,
		sourceReference: food.sharedProductId,
		resolvedCategory: food.foodCategory,
		categoryResolution:
			food.categoryOptionId && food.foodCategory
				? {
						categoryOptionId: food.categoryOptionId,
						label: food.foodCategory,
						sourceValue: normalizeFoodCategoryValue(food.foodCategory),
						confidence: "exact",
					}
				: undefined,
		sourceKey: "shared-catalog",
		sourceDataType: food.sourceDataType,
		sourcePublishedDate: food.sourcePublishedDate,
		sourceModifiedDate: food.sourceModifiedDate,
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
