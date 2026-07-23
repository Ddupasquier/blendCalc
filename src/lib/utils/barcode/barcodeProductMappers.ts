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
	type FoodFieldProvenance,
	type FoodFieldSource,
	type FdcNutrient,
	type FoodImageAsset,
} from "$lib/utils/food/types";
import { OPEN_FOOD_FACTS_IMAGE_LICENSE } from "$lib/utils/food/images/foodImages";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
import { normalizeFoodCategoryValue } from "$lib/utils/food/categories/categoryNormalization.js";
import {
	getProductDataSource,
	type ProductReferenceData,
} from "$lib/utils/food/reference/productReferenceData";
import {
	getServingMeasureDimension,
	parseServingAmount,
} from "$lib/utils/serving/servingAmount";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

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
	nameProvenance: NonNullable<FdcFood["nameProvenance"]>;
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
		symbolKey?: string;
	};
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	volumeEquivalent?: BarcodeVolumeEquivalent;
	source: "open-food-facts" | "usda" | "shared-catalog";
	sourceLabel: string;
	sourceReference?: string;
	sourceKey?: string;
	sourceDataType?: string;
	sourcePublishedDate?: string;
	sourceModifiedDate?: string;
};

export const getBarcodeProductSourceDisplayLabel = (
	draft: Pick<BarcodeProductDraft, "sourceLabel" | "sourceDataType">,
) => [draft.sourceLabel, draft.sourceDataType].filter(Boolean).join(" · ");

const toNumber = (value: unknown) => toFiniteNonnegativeNumber(value);

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
		...createFullImagePlacement(),
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

const getFieldConfidence = (
	source: FoodFieldSource["source"],
): NonNullable<FoodFieldSource["confidence"]> => {
	if (source === "community-reviewed") {
		return "moderator-reviewed";
	}
	if (source === "user-label") return "user-reported";
	return "unknown";
};

const normalizeFieldSource = (
	source: string | null | undefined,
): FoodFieldSource["source"] => {
	switch (source) {
		case "usda":
		case "open-food-facts":
		case "user-label":
		case "manufacturer":
		case "gs1":
		case "community-reviewed":
		case "shared-catalog":
			return source;
		default:
			return "unknown";
	}
};

const createFieldSource = (
	source: FoodFieldSource["source"],
	sourceReference?: string,
	confidence: FoodFieldSource["confidence"] = getFieldConfidence(source),
): FoodFieldSource => ({
	source,
	sourceReference,
	confidence,
});

const createOpenFoodFactsFieldProvenance = ({
	barcode,
	nutrients,
	image,
	categories,
	hasSourceServing,
}: {
	barcode: string;
	nutrients: FdcNutrient[];
	image?: FoodImageAsset;
	categories: string[];
	hasSourceServing: boolean;
}): FoodFieldProvenance => {
	const source = createFieldSource("open-food-facts", barcode, "unknown");
	return {
		...(nutrients.length > 0 ? { nutrition: source } : {}),
		...(image
			? {
				image: createFieldSource(
					image.source,
					image.sourceReference,
					image.confidence,
				),
			}
			: {}),
		...(categories.length > 0 ? { categories: source } : {}),
		...(hasSourceServing ? { serving: source } : {}),
	};
};

const createFdcFieldProvenance = ({
	food,
	nutrients,
	image,
	categories,
	hasSourceServing,
}: {
	food: FdcFood;
	nutrients: FdcNutrient[];
	image?: FoodImageAsset;
	categories: string[];
	hasSourceServing: boolean;
}): FoodFieldProvenance => {
	const fallbackSource = normalizeFieldSource(
		food.sourceKey ?? food.barcodeSource ?? "usda",
	);
	const fallbackReference = food.sharedProductId ?? String(food.fdcId);
	const fallback = createFieldSource(
		fallbackSource,
		fallbackReference,
		"unknown",
	);
	const nutrientSource = nutrients.find((nutrient) => nutrient.source);
	const servingSource = food.foodServings?.find((serving) => serving.isPrimary) ??
		food.foodServings?.[0];

	return {
		...food.fieldProvenance,
		...(nutrients.length > 0 && !food.fieldProvenance?.nutrition
			? {
				nutrition: nutrientSource
					? createFieldSource(
						nutrientSource.source ?? "unknown",
						nutrientSource.sourceReference,
						nutrientSource.confidence ?? "unknown",
					)
					: fallback,
			}
			: {}),
		...(image && !food.fieldProvenance?.image
			? {
				image: createFieldSource(
					image.source,
					image.sourceReference,
					image.confidence,
				),
			}
			: {}),
		...(categories.length > 0 && !food.fieldProvenance?.categories
			? { categories: fallback }
			: {}),
		...(hasSourceServing && !food.fieldProvenance?.serving
			? {
				serving: servingSource
					? createFieldSource(
						servingSource.source ?? "unknown",
						servingSource.sourceReference,
						servingSource.confidence ?? "unknown",
					)
					: fallback,
			}
			: {}),
	};
};

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
	const parsedQuantity = servingQuantity === null
		? null
		: parseServingAmount(
			`${servingQuantity} ${product.serving_quantity_unit ?? ""}`,
		);
	if (
		servingQuantity !== null &&
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
	const sourceName = product.product_name?.trim() || product.generic_name?.trim();
	const name = formatSourceProductName(sourceName);
	if (!canonicalBarcode || !name) return null;

	const { servingWeightGrams, useServingValues, hasExactGramWeight } =
		parseServingBasis(product);
	const nutrients = mapOpenFoodFactsNutrients(
		product.nutriments ?? {},
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
		nameProvenance: "source",
		brandOwner: product.brands?.trim() ?? "",
		servingLabel:
			(useServingValues && product.serving_size?.trim()) || `${servingWeightGrams} g`,
		servingWeightGrams,
		hasSourceServing: hasExactGramWeight,
		nutrients,
		reportedNutrientIds: [...new Set(nutrients.map((nutrient) => nutrient.nutrientId))],
		...metadata,
		image,
		fieldProvenance: createOpenFoodFactsFieldProvenance({
			barcode: canonicalBarcode,
			nutrients,
			image,
			categories: metadata.categories,
			hasSourceServing: hasExactGramWeight,
		}),
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
	const nutrients = food.foodNutrients.flatMap((nutrient) => {
		const value = toNumber(nutrient.value);
		return value === null ? [] : [{
			...nutrient,
			value: value * servingScale,
		}];
	});
	const nutrientIds = new Set(nutrients.map((nutrient) => nutrient.nutrientId));
	const reportedNutrientIds = food.reportedNutrientIds ?? food.foodNutrients
		.filter((nutrient) => nutrient.valueOrigin === "reported")
		.map((nutrient) => nutrient.nutrientId);

	return {
		barcode: canonicalBarcode,
		name: food.nameProvenance === "user"
			? food.description.trim().replace(/\s+/g, " ")
			: formatSourceProductName(food.description),
		nameProvenance: food.nameProvenance ?? "source",
		brandOwner: food.brandOwner ?? "",
		servingLabel:
			(hasExactGramWeight && food.householdServingFullText) || `${servingWeightGrams} g`,
		servingWeightGrams,
		hasSourceServing: hasExactGramWeight,
		nutrients,
		reportedNutrientIds: [
			...new Set(reportedNutrientIds),
		].filter((nutrientId) => nutrientIds.has(nutrientId)),
		...metadata,
		image: food.image,
		fieldProvenance: createFdcFieldProvenance({
			food,
			nutrients,
			image: food.image,
			categories: metadata.categories,
			hasSourceServing: hasExactGramWeight,
		}),
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
	const sourceKey = food.sourceKey ?? (
		food.barcodeSource === "usda"
			? "usda"
			: food.barcodeSource === "open-food-facts"
				? "open-food-facts"
				: "shared-catalog"
	);
	const source = getProductDataSource(referenceData, sourceKey);

	return {
		...draft,
		source: "shared-catalog",
		sourceLabel: food.sourceLabel ?? source.displayName,
		sourceReference: food.sharedProductId,
		resolvedCategory: food.foodCategory,
		categoryResolution:
			food.categoryOptionId && food.foodCategory
				? {
						categoryOptionId: food.categoryOptionId,
						label: food.foodCategory,
						sourceValue: normalizeFoodCategoryValue(food.foodCategory),
						confidence: "exact",
						symbolKey: food.symbolKey,
					}
					: undefined,
		fieldProvenance: {
			...draft.fieldProvenance,
			...(food.foodCategory && !food.fieldProvenance?.categories
				? {
					categories: createFieldSource(
						"shared-catalog",
						food.sharedProductId,
						"unknown",
					),
				}
				: {}),
		},
		sourceKey: source.key,
		sourceDataType: food.sourceDataType,
		sourcePublishedDate: food.sourcePublishedDate,
		sourceModifiedDate: food.sourceModifiedDate,
	};
};
