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
	type FoodIdentityType,
	type FoodIngredientAnalysis,
	type FoodPackageQuantity,
	type FoodSourceRecordMetadata,
	type FoodStructuredIngredient,
} from "$lib/utils/food/types";
import { OPEN_FOOD_FACTS_IMAGE_LICENSE } from "$lib/utils/food/images/foodImages";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
import { normalizeFoodCategoryValue } from "$lib/utils/food/categories/categoryNormalization.js";
import { extractExplicitAllergenDeclarations } from "$lib/server/products/allergenDeclarations.server.js";
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
import { resolveFoodIdentityType } from "$lib/utils/food/identity/foodIdentity";

export type { OpenFoodFactsNutriments } from "$lib/utils/barcode/barcodeNutrients";

export type OpenFoodFactsProduct = {
	code?: string;
	product_name?: string;
	generic_name?: string;
	brands?: string;
	ingredients_text?: string;
	ingredients_text_en?: string;
	ingredients?: OpenFoodFactsIngredient[];
	ingredients_tags?: string[];
	ingredients_analysis_tags?: string[];
	ingredients_percent_analysis?: number | string;
	ingredients_percent_estimate?: number | string;
	ingredients_percent_known?: number | string;
	ingredients_percent_unknown?: number | string;
	allergens?: string;
	allergens_tags?: string[];
	allergens_hierarchy?: string[];
	allergens_lc?: string;
	traces?: string;
	traces_tags?: string[];
	traces_hierarchy?: string[];
	traces_lc?: string;
	traces_from_ingredients?: string;
	traces_from_user?: string;
	additives_tags?: string[];
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
	quantity?: string;
	product_quantity?: number | string;
	product_quantity_unit?: string;
	lang?: string;
	languages_tags?: string[];
	created_t?: number | string;
	last_modified_t?: number | string;
	last_updated_t?: number | string;
	rev?: number | string;
	schema_version?: number | string;
	completeness?: number | string;
	data_quality_tags?: string[];
	data_quality_errors_tags?: string[];
	data_quality_warnings_tags?: string[];
	obsolete?: boolean;
	obsolete_since_date?: string;
	tags_sources?: Record<string, string[] | string>;
	nutriments?: OpenFoodFactsNutriments;
};

export type OpenFoodFactsIngredient = {
	id?: string;
	text?: string;
	percent?: number | string;
	percent_estimate?: number | string;
	percent_min?: number | string;
	percent_max?: number | string;
	vegan?: string;
	vegetarian?: string;
	ingredients?: OpenFoodFactsIngredient[];
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
	foodIdentityType?: FoodIdentityType;
	ingredients?: string;
	ingredientList?: string[];
	structuredIngredients?: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	additives?: string[];
	allergens?: string[];
	traces?: string[];
	dietaryTags?: string[];
	labels?: string[];
	packageQuantity?: FoodPackageQuantity;
	sourceMetadata?: FoodSourceRecordMetadata;
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

const toOptionalNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const toOptionalInteger = (value: unknown) => {
	const number = Number(value);
	return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
};

const toIsoTimestamp = (value: unknown) => {
	const timestamp = Number(value);
	if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
	const date = new Date(timestamp * 1000);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const sanitizeStructuredIngredient = (
	ingredient: OpenFoodFactsIngredient,
	depth = 0,
): FoodStructuredIngredient | null => {
	if (depth > 5 || !ingredient || typeof ingredient !== "object") return null;
	const id = ingredient.id?.trim();
	const text = ingredient.text?.trim();
	const nested = (ingredient.ingredients ?? [])
		.slice(0, 100)
		.flatMap((item) => {
			const parsed = sanitizeStructuredIngredient(item, depth + 1);
			return parsed ? [parsed] : [];
		});
	if (!id && !text && nested.length === 0) return null;
	return {
		...(id ? { id: cleanTag(id) } : {}),
		...(text ? { text } : {}),
		...(toOptionalNumber(ingredient.percent) !== undefined
			? { percent: toOptionalNumber(ingredient.percent) }
			: {}),
		...(toOptionalNumber(ingredient.percent_estimate) !== undefined
			? { percentEstimate: toOptionalNumber(ingredient.percent_estimate) }
			: {}),
		...(toOptionalNumber(ingredient.percent_min) !== undefined
			? { percentMin: toOptionalNumber(ingredient.percent_min) }
			: {}),
		...(toOptionalNumber(ingredient.percent_max) !== undefined
			? { percentMax: toOptionalNumber(ingredient.percent_max) }
			: {}),
		...(ingredient.vegan?.trim() ? { vegan: ingredient.vegan.trim() } : {}),
		...(ingredient.vegetarian?.trim()
			? { vegetarian: ingredient.vegetarian.trim() }
			: {}),
		...(nested.length > 0 ? { ingredients: nested } : {}),
	};
};

const getStructuredIngredientTexts = (
	ingredients: FoodStructuredIngredient[],
): string[] => ingredients.flatMap((ingredient) => [
	...(ingredient.text ? [ingredient.text] : []),
	...(ingredient.ingredients
		? getStructuredIngredientTexts(ingredient.ingredients)
		: []),
]);

const normalizeTagSources = (
	value: OpenFoodFactsProduct["tags_sources"],
): Record<string, string[]> | undefined => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const entries = Object.entries(value).flatMap(([key, sources]) => {
		const normalized = uniqueCleanValues(
			Array.isArray(sources) ? sources : [sources],
		);
		return key.trim() && normalized.length > 0 ? [[key, normalized] as const] : [];
	});
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const parseOpenFoodFactsPackageQuantity = (
	product: OpenFoodFactsProduct,
): FoodPackageQuantity | undefined => {
	const label = product.quantity?.trim();
	const amount = toOptionalNumber(product.product_quantity);
	const unit = product.product_quantity_unit?.trim();
	if (!label && amount === undefined && !unit) return undefined;
	return {
		...(label ? { label } : {}),
		...(amount !== undefined ? { amount } : {}),
		...(unit ? { unit } : {}),
	};
};

const parseOpenFoodFactsSourceMetadata = (
	product: OpenFoodFactsProduct,
): FoodSourceRecordMetadata | undefined => {
	const metadata: FoodSourceRecordMetadata = {
		...(product.lang?.trim() ? { language: product.lang.trim() } : {}),
		...(product.languages_tags?.length
			? { languages: uniqueCleanValues(product.languages_tags) }
			: {}),
		...(toOptionalInteger(product.rev) !== undefined
			? { revision: toOptionalInteger(product.rev) }
			: {}),
		...(toOptionalInteger(product.schema_version) !== undefined
			? { schemaVersion: toOptionalInteger(product.schema_version) }
			: {}),
		...(toIsoTimestamp(product.created_t)
			? { createdAt: toIsoTimestamp(product.created_t) }
			: {}),
		...(toIsoTimestamp(product.last_modified_t)
			? { modifiedAt: toIsoTimestamp(product.last_modified_t) }
			: {}),
		...(toIsoTimestamp(product.last_updated_t)
			? { updatedAt: toIsoTimestamp(product.last_updated_t) }
			: {}),
		...(toOptionalNumber(product.completeness) !== undefined
			? { completeness: toOptionalNumber(product.completeness) }
			: {}),
		...(product.data_quality_tags?.length
			? { qualityTags: uniqueCleanValues(product.data_quality_tags) }
			: {}),
		...(product.data_quality_errors_tags?.length
			? { qualityErrorTags: uniqueCleanValues(product.data_quality_errors_tags) }
			: {}),
		...(product.data_quality_warnings_tags?.length
			? { qualityWarningTags: uniqueCleanValues(product.data_quality_warnings_tags) }
			: {}),
		...(typeof product.obsolete === "boolean"
			? { obsolete: product.obsolete }
			: {}),
		...(product.obsolete_since_date?.trim()
			? { obsoleteSince: product.obsolete_since_date.trim() }
			: {}),
		...(normalizeTagSources(product.tags_sources)
			? { tagSources: normalizeTagSources(product.tags_sources) }
			: {}),
	};
	return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const parseOpenFoodFactsMetadata = (product: OpenFoodFactsProduct) => {
	const ingredients =
		product.ingredients_text_en?.trim() || product.ingredients_text?.trim();
	const structuredIngredients = (product.ingredients ?? [])
		.slice(0, 250)
		.flatMap((ingredient) => {
			const parsed = sanitizeStructuredIngredient(ingredient);
			return parsed ? [parsed] : [];
		});
	const ingredientAnalysis: FoodIngredientAnalysis = {
		ingredientTags: uniqueCleanValues(product.ingredients_tags ?? []),
		analysisTags: uniqueCleanValues(product.ingredients_analysis_tags ?? []),
		derivedTraceTags: uniqueCleanValues(
			splitDelimitedValues(product.traces_from_ingredients),
		),
		...(toOptionalNumber(product.ingredients_percent_analysis) !== undefined
			? {
				percentAnalysis: toOptionalNumber(
					product.ingredients_percent_analysis,
				),
			}
			: {}),
		...(toOptionalNumber(product.ingredients_percent_estimate) !== undefined
			? {
				percentEstimate: toOptionalNumber(
					product.ingredients_percent_estimate,
				),
			}
			: {}),
		...(toOptionalNumber(product.ingredients_percent_known) !== undefined
			? { percentKnown: toOptionalNumber(product.ingredients_percent_known) }
			: {}),
		...(toOptionalNumber(product.ingredients_percent_unknown) !== undefined
			? { percentUnknown: toOptionalNumber(product.ingredients_percent_unknown) }
			: {}),
	};

	return {
		ingredients: ingredients || undefined,
		ingredientList: uniqueCleanValues([
			...splitIngredientList(ingredients),
			...getStructuredIngredientTexts(structuredIngredients),
		]),
		structuredIngredients,
		ingredientAnalysis,
		additives: uniqueCleanValues(product.additives_tags ?? []),
		allergens: uniqueCleanValues([
			...splitDelimitedValues(product.allergens),
			...(product.allergens_tags ?? []),
			...(product.allergens_hierarchy ?? []),
		]),
		traces: uniqueCleanValues([
			...splitDelimitedValues(product.traces),
			...(product.traces_tags ?? []),
			...(product.traces_hierarchy ?? []),
			...splitDelimitedValues(product.traces_from_user),
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
		packageQuantity: parseOpenFoodFactsPackageQuantity(product),
		sourceMetadata: parseOpenFoodFactsSourceMetadata(product),
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

const parseFdcMetadata = (food: FdcFood) => {
	const declarations = extractExplicitAllergenDeclarations(food.ingredients);
	return {
		ingredients: food.ingredients?.trim() || undefined,
		ingredientList: food.ingredientList?.length
			? uniqueCleanValues(food.ingredientList)
			: splitIngredientList(food.ingredients),
		allergens: uniqueCleanValues([
			...(food.allergens ?? []),
			...declarations.contains,
		]),
		traces: uniqueCleanValues([
			...(food.traces ?? []),
			...declarations.mayContain,
		]),
		dietaryTags: uniqueCleanValues(food.dietaryTags ?? []),
		labels: uniqueCleanValues(food.labels ?? []),
		categories: uniqueCleanValues([
			...(food.categories ?? []),
			food.foodCategory,
			food.brandedFoodCategory,
		]),
	};
};

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
	metadata,
	hasSourceServing,
}: {
	barcode: string;
	nutrients: FdcNutrient[];
	image?: FoodImageAsset;
	metadata: ReturnType<typeof parseOpenFoodFactsMetadata>;
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
		...(metadata.categories.length > 0 ? { categories: source } : {}),
		...(hasSourceServing ? { serving: source } : {}),
		...(metadata.ingredients || metadata.ingredientList.length > 0
			? { ingredients: source }
			: {}),
		...(metadata.allergens.length > 0 ? { allergens: source } : {}),
		...(metadata.traces.length > 0 ? { traces: source } : {}),
		...(metadata.dietaryTags.length > 0 ? { dietaryTags: source } : {}),
		...(metadata.labels.length > 0 ? { labels: source } : {}),
		...(metadata.structuredIngredients.length > 0
			? { structuredIngredients: source }
			: {}),
		...(metadata.ingredientAnalysis.ingredientTags.length > 0 ||
				metadata.ingredientAnalysis.analysisTags.length > 0 ||
				metadata.ingredientAnalysis.derivedTraceTags.length > 0
			? { ingredientAnalysis: source }
			: {}),
		...(metadata.additives.length > 0 ? { additives: source } : {}),
		...(metadata.packageQuantity ? { package: source } : {}),
		...(metadata.sourceMetadata ? { sourceMetadata: source } : {}),
	};
};

const createFdcFieldProvenance = ({
	food,
	nutrients,
	image,
	metadata,
	hasSourceServing,
}: {
	food: FdcFood;
	nutrients: FdcNutrient[];
	image?: FoodImageAsset;
	metadata: ReturnType<typeof parseFdcMetadata>;
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
		...(metadata.categories.length > 0 && !food.fieldProvenance?.categories
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
		...((metadata.ingredients || metadata.ingredientList.length > 0) &&
				!food.fieldProvenance?.ingredients
			? { ingredients: fallback }
			: {}),
		...(metadata.allergens.length > 0 && !food.fieldProvenance?.allergens
			? { allergens: fallback }
			: {}),
		...(metadata.traces.length > 0 && !food.fieldProvenance?.traces
			? { traces: fallback }
			: {}),
		...(metadata.dietaryTags.length > 0 && !food.fieldProvenance?.dietaryTags
			? { dietaryTags: fallback }
			: {}),
		...(metadata.labels.length > 0 && !food.fieldProvenance?.labels
			? { labels: fallback }
			: {}),
		...(food.structuredIngredients?.length &&
				!food.fieldProvenance?.structuredIngredients
			? { structuredIngredients: fallback }
			: {}),
		...(food.ingredientAnalysis && !food.fieldProvenance?.ingredientAnalysis
			? { ingredientAnalysis: fallback }
			: {}),
		...(food.additives?.length && !food.fieldProvenance?.additives
			? { additives: fallback }
			: {}),
		...(food.packageQuantity && !food.fieldProvenance?.package
			? { package: fallback }
			: {}),
		...(food.sourceMetadata && !food.fieldProvenance?.sourceMetadata
			? { sourceMetadata: fallback }
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
		foodIdentityType: "packaged",
		...metadata,
		image,
		fieldProvenance: createOpenFoodFactsFieldProvenance({
			barcode: canonicalBarcode,
			nutrients,
			image,
			metadata,
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
		sourceModifiedDate: metadata.sourceMetadata?.modifiedAt,
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
		foodIdentityType: resolveFoodIdentityType(food),
		...metadata,
		structuredIngredients: food.structuredIngredients,
		ingredientAnalysis: food.ingredientAnalysis,
		additives: food.additives,
		packageQuantity: food.packageQuantity,
		sourceMetadata: food.sourceMetadata,
		image: food.image,
		fieldProvenance: createFdcFieldProvenance({
			food,
			nutrients,
			image: food.image,
			metadata,
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
		foodIdentityType: "packaged",
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
