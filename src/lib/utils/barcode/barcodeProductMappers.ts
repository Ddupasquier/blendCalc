import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapOpenFoodFactsNutrients,
	mapOpenFoodFactsNutrientSourceReview,
	mapOpenFoodFactsQualitativeNutrients,
	type OpenFoodFactsNutriments,
} from "$lib/utils/barcode/barcodeNutrients";
import {
	parseVolumeEquivalent,
	type BarcodeVolumeEquivalent,
} from "$lib/utils/barcode/servingVolume";
import {
	type FoodItem,
	type FoodFieldProvenance,
	type FoodFieldSource,
	type FoodNutrient,
	type FoodNutrientQualitativeFact,
	type FoodNutrientSourceReview,
	type FoodImageAsset,
	type FoodIdentityType,
	type FoodIngredientAnalysis,
	type FoodPackageQuantity,
	type FoodPrecautionaryStatement,
	type FoodSourceRecordMetadata,
	type FoodStructuredIngredient,
	type FoodServing,
	type FoodAlcoholByVolume,
	type FoodRegulatoryDisclosure,
} from "$lib/utils/food/types";
import { OPEN_FOOD_FACTS_IMAGE_LICENSE } from "$lib/utils/food/images/foodImages";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
import { normalizeFoodCategoryValue } from "$lib/utils/food/categories/categoryNormalization.js";
import { normalizeExternalIngredientStatement } from "$lib/utils/food/ingredients/ingredientStatementNormalization.js";
import {
	canonicalizeProductNutrients,
	getCanonicalProductNutrientId,
	getProductDataSource,
	type ProductReferenceCatalog,
} from "$lib/utils/food/reference/productReferenceCatalog";
import {
	convertServingAmount,
	convertFoodServingMultiplier,
	convertServingToGrams,
	getServingMeasureDimension,
	parseSourceServingMeasure,
	parseSourceWeightMeasure,
} from "$lib/utils/serving/servingAmount";
import { getNutrientAmountForServingConversion } from "$lib/utils/food/nutrients/foodNutrients";
import { normalizeFoodServingIdentityLabel } from "$lib/utils/food/servings/foodServings";
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
	nutrition_data_per?: string;
	quantity?: string;
	product_quantity?: number | string;
	product_quantity_unit?: string;
	lang?: string;
	languages_tags?: string[];
	countries?: string;
	countries_tags?: string[];
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
	status?: number | "success" | "success_with_warnings";
	product?: OpenFoodFactsProduct;
};

export type BarcodeProductDraft = {
	barcode: string;
	name: string;
	nameProvenance: NonNullable<FoodItem["nameProvenance"]>;
	brandOwner: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	hasSourceServing?: boolean;
	serving?: FoodServing;
	nutrients: FoodNutrient[];
	nutrientQualitativeFacts?: FoodNutrientQualitativeFact[];
	nutrientSourceReview?: FoodNutrientSourceReview[];
	reportedNutrientIds: number[];
	foodIdentityType?: FoodIdentityType;
	ingredients?: string;
	ingredientList?: string[];
	structuredIngredients?: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	additives?: string[];
	allergens?: string[];
	traces?: string[];
	precautionaryStatements?: FoodPrecautionaryStatement[];
	dietaryTags?: string[];
	labels?: string[];
	packageQuantity?: FoodPackageQuantity;
	alcoholByVolume?: FoodAlcoholByVolume;
	regulatoryDisclosure?: FoodRegulatoryDisclosure;
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
	source: "open-food-facts" | "cola-cloud" | "usda" | "shared-catalog";
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

const uniqueIngredientValues = (values: Array<string | undefined>) => {
	const seen = new Set<string>();
	return values.flatMap((value) => {
		const cleaned = value?.trim();
		const key = cleaned?.toLocaleLowerCase("en-US");
		if (!cleaned || !key || seen.has(key)) return [];
		seen.add(key);
		return [cleaned];
	});
};

const toOptionalNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const toOptionalInteger = (value: unknown) => {
	const number = Number(value);
	return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
};

const normalizeAlcoholByVolumeUnit = (value: unknown) =>
	String(value ?? "")
		.trim()
		.toLocaleLowerCase()
		.replace(/\s+/g, "");

export const parseOpenFoodFactsAlcoholByVolume = (
	nutriments: OpenFoodFactsNutriments | undefined,
): FoodAlcoholByVolume | undefined => {
	if (!nutriments) return undefined;
	const percent = toOptionalNumber(
		nutriments.alcohol_100g ?? nutriments.alcohol_value ?? nutriments.alcohol,
	);
	if (percent === undefined || percent > 100) return undefined;
	const sourceUnit = String(nutriments.alcohol_unit ?? "").trim();
	if (
		!["%vol", "%alc/vol"].includes(normalizeAlcoholByVolumeUnit(sourceUnit))
	) {
		return undefined;
	}

	return {
		percent,
		valueStatus: percent === 0 ? "reported-zero" : "reported",
		basis: "volume-percent",
		sourceUnit,
	};
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
): string[] =>
	ingredients.flatMap((ingredient) => [
		...(ingredient.text ? [ingredient.text] : []),
		...(ingredient.ingredients
			? getStructuredIngredientTexts(ingredient.ingredients)
			: []),
	]);

const normalizeTagSources = (
	value: OpenFoodFactsProduct["tags_sources"],
): Record<string, string[]> | undefined => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return undefined;
	const entries = Object.entries(value).flatMap(([key, sources]) => {
		const normalized = uniqueCleanValues(
			Array.isArray(sources) ? sources : [sources],
		);
		return key.trim() && normalized.length > 0
			? [[key, normalized] as const]
			: [];
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

const createExactPackageVolumeServing = (
	packageQuantity: FoodPackageQuantity | undefined,
	barcode: string,
): FoodServing | undefined => {
	if (!packageQuantity) return undefined;
	const parsedMeasure =
		(packageQuantity.label
			? parseSourceServingMeasure(packageQuantity.label)
			: null) ??
		(packageQuantity.amount !== undefined && packageQuantity.unit
			? parseSourceServingMeasure(
					`${packageQuantity.amount} ${packageQuantity.unit}`,
				)
			: null);
	if (!parsedMeasure) return undefined;
	const conversion = convertServingAmount(
		parsedMeasure.quantity,
		parsedMeasure.unit,
	);
	if (conversion.milliliters === null) return undefined;
	const packageLabel =
		packageQuantity.label?.trim() ||
		`${parsedMeasure.quantity} ${parsedMeasure.unit}`;

	return {
		label: `${packageLabel} package`,
		milliliterVolume: conversion.milliliters,
		amount: parsedMeasure.quantity,
		unitKey: parsedMeasure.unit,
		isPrimary: true,
		measureType: "Package amount",
		isHouseholdMeasure: false,
		sourceMeasureKey: "product_quantity",
		origin: "package-label",
		gramWeightMethod: "unknown",
		source: "open-food-facts",
		sourceReference: barcode,
		confidence: "unknown",
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
		...(product.countries || product.countries_tags?.length
			? {
					marketCountries: uniqueCleanValues([
						...splitDelimitedValues(product.countries),
						...(product.countries_tags ?? []),
					]),
				}
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
			? {
					qualityErrorTags: uniqueCleanValues(product.data_quality_errors_tags),
				}
			: {}),
		...(product.data_quality_warnings_tags?.length
			? {
					qualityWarningTags: uniqueCleanValues(
						product.data_quality_warnings_tags,
					),
				}
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

const getOpenFoodFactsIngredientText = (product: OpenFoodFactsProduct) => {
	const englishIngredients = product.ingredients_text_en?.trim();
	if (englishIngredients) {
		return {
			text: englishIngredients,
			languageCode: "en",
			sourceField: "ingredients_text_en",
		};
	}

	return {
		text: product.ingredients_text?.trim() ?? "",
		languageCode: product.lang?.trim(),
		sourceField: "ingredients_text",
	};
};

const parseOpenFoodFactsMetadata = (product: OpenFoodFactsProduct) => {
	const sourceIngredientText = getOpenFoodFactsIngredientText(product);
	const normalizedIngredients = normalizeExternalIngredientStatement(
		sourceIngredientText.text,
		{
			languageCode: sourceIngredientText.languageCode,
			sourceField: sourceIngredientText.sourceField,
		},
	);
	const ingredients = normalizedIngredients.ingredientText;
	const allergenDeclarationAnalysis = normalizedIngredients.declarationAnalysis;
	const reportedTraceText = product.traces?.trim();
	const precautionaryStatements: FoodPrecautionaryStatement[] = [
		...normalizedIngredients.precautionaryStatements.flatMap((statement) => {
			const precautionaryStatement: FoodPrecautionaryStatement = {
				...statement,
				type: statement.type,
				languageCode: allergenDeclarationAnalysis.languageCode,
				sourceField: allergenDeclarationAnalysis.sourceField,
			};
			return [precautionaryStatement];
		}),
		...(reportedTraceText
			? [
					{
						type: "may_contain" as const,
						text: reportedTraceText,
						allergens: uniqueCleanValues([
							...splitDelimitedValues(product.traces),
							...(product.traces_tags ?? []),
							...(product.traces_hierarchy ?? []),
						]),
						languageCode:
							product.traces_lc?.trim() || product.lang?.trim() || undefined,
						sourceField: "traces",
					},
				]
			: []),
	];
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
		normalization: normalizedIngredients.normalization,
		...(ingredients ? { allergenDeclarationAnalysis } : {}),
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
			? {
					percentUnknown: toOptionalNumber(product.ingredients_percent_unknown),
				}
			: {}),
	};

	return {
		ingredients: ingredients || undefined,
		ingredientList: uniqueIngredientValues([
			...normalizedIngredients.ingredientList,
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
		precautionaryStatements,
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

const parseFdcMetadata = (food: FoodItem) => {
	const normalizedIngredients = normalizeExternalIngredientStatement(
		food.ingredients,
		{
			languageCode: food.sourceMetadata?.language ?? "en",
			sourceField: "ingredients",
		},
	);
	const allergenDeclarationAnalysis =
		food.ingredientAnalysis?.allergenDeclarationAnalysis ??
		normalizedIngredients.declarationAnalysis;
	const ingredientAnalysis: FoodIngredientAnalysis | undefined =
		food.ingredients || food.ingredientAnalysis
			? {
					...food.ingredientAnalysis,
					ingredientTags: [...(food.ingredientAnalysis?.ingredientTags ?? [])],
					analysisTags: [...(food.ingredientAnalysis?.analysisTags ?? [])],
					derivedTraceTags: [
						...(food.ingredientAnalysis?.derivedTraceTags ?? []),
					],
					normalization:
						food.ingredientAnalysis?.normalization ??
						normalizedIngredients.normalization,
					...(food.ingredients ? { allergenDeclarationAnalysis } : {}),
				}
			: undefined;
	return {
		ingredients: normalizedIngredients.ingredientText || undefined,
		ingredientList: [...normalizedIngredients.ingredientList],
		ingredientAnalysis,
		allergens: uniqueCleanValues(food.allergens ?? []),
		traces: uniqueCleanValues(food.traces ?? []),
		precautionaryStatements: [
			...(food.precautionaryStatements ?? []),
			...normalizedIngredients.precautionaryStatements.flatMap((statement) => {
				const precautionaryStatement: FoodPrecautionaryStatement = {
					...statement,
					type: statement.type,
					languageCode: allergenDeclarationAnalysis.languageCode,
					sourceField: allergenDeclarationAnalysis.sourceField,
				};
				return [precautionaryStatement];
			}),
		],
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
		case "cola-cloud":
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
	nutrientQualitativeFacts,
	image,
	metadata,
	hasSourceServing,
	hasBrandOwner,
	alcoholByVolume,
}: {
	barcode: string;
	nutrients: FoodNutrient[];
	nutrientQualitativeFacts: FoodNutrientQualitativeFact[];
	image?: FoodImageAsset;
	metadata: ReturnType<typeof parseOpenFoodFactsMetadata>;
	hasSourceServing: boolean;
	hasBrandOwner: boolean;
	alcoholByVolume?: FoodAlcoholByVolume;
}): FoodFieldProvenance => {
	const source = createFieldSource("open-food-facts", barcode, "unknown");
	return {
		productName: source,
		...(hasBrandOwner ? { brandOwner: source } : {}),
		...(nutrients.length > 0 || nutrientQualitativeFacts.length > 0
			? { nutrition: source }
			: {}),
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
		...(metadata.precautionaryStatements.length > 0
			? { precautionaryStatements: source }
			: {}),
		...(metadata.dietaryTags.length > 0 ? { dietaryTags: source } : {}),
		...(metadata.labels.length > 0 ? { labels: source } : {}),
		...(metadata.structuredIngredients.length > 0
			? { structuredIngredients: source }
			: {}),
		...(metadata.ingredientAnalysis.ingredientTags.length > 0 ||
		metadata.ingredientAnalysis.analysisTags.length > 0 ||
		metadata.ingredientAnalysis.derivedTraceTags.length > 0 ||
		metadata.ingredientAnalysis.allergenDeclarationAnalysis
			? { ingredientAnalysis: source }
			: {}),
		...(metadata.additives.length > 0 ? { additives: source } : {}),
		...(metadata.packageQuantity ? { package: source } : {}),
		...(alcoholByVolume ? { alcoholByVolume: source } : {}),
		...(metadata.sourceMetadata ? { sourceMetadata: source } : {}),
	};
};

const createFdcFieldProvenance = ({
	food,
	nutrients,
	image,
	metadata,
	hasSourceServing,
	adapterSource,
}: {
	food: FoodItem;
	nutrients: FoodNutrient[];
	image?: FoodImageAsset;
	metadata: ReturnType<typeof parseFdcMetadata>;
	hasSourceServing: boolean;
	adapterSource?: FoodFieldSource;
}): FoodFieldProvenance => {
	const nutrientSource = nutrients.find((nutrient) => nutrient.source);
	const servingSource =
		food.foodServings?.find((serving) => serving.isPrimary) ??
		food.foodServings?.[0];
	const mappedSource = adapterSource
		? createFieldSource(
				normalizeFieldSource(adapterSource.source),
				adapterSource.sourceReference,
				adapterSource.confidence ?? "unknown",
			)
		: undefined;

	return {
		...food.fieldProvenance,
		...(mappedSource && !food.fieldProvenance?.productName
			? { productName: mappedSource }
			: {}),
		...(mappedSource &&
		food.brandOwner?.trim() &&
		!food.fieldProvenance?.brandOwner
			? { brandOwner: mappedSource }
			: {}),
		...((nutrients.length > 0 || food.nutrientQualitativeFacts?.length) &&
		(nutrientSource || mappedSource) &&
		!food.fieldProvenance?.nutrition
			? {
					nutrition: nutrientSource
						? createFieldSource(
								nutrientSource.source ?? "unknown",
								nutrientSource.sourceReference,
								nutrientSource.confidence ?? "unknown",
							)
						: mappedSource,
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
		...(mappedSource &&
		metadata.categories.length > 0 &&
		!food.fieldProvenance?.categories
			? { categories: mappedSource }
			: {}),
		...(hasSourceServing &&
		(servingSource || mappedSource) &&
		!food.fieldProvenance?.serving
			? {
					serving: servingSource
						? createFieldSource(
								servingSource.source ?? "unknown",
								servingSource.sourceReference,
								servingSource.confidence ?? "unknown",
							)
						: mappedSource,
				}
			: {}),
		...(mappedSource &&
		(metadata.ingredients || metadata.ingredientList.length > 0) &&
		!food.fieldProvenance?.ingredients
			? { ingredients: mappedSource }
			: {}),
		...(mappedSource &&
		metadata.allergens.length > 0 &&
		!food.fieldProvenance?.allergens
			? { allergens: mappedSource }
			: {}),
		...(mappedSource &&
		metadata.traces.length > 0 &&
		!food.fieldProvenance?.traces
			? { traces: mappedSource }
			: {}),
		...(mappedSource &&
		metadata.precautionaryStatements.length > 0 &&
		!food.fieldProvenance?.precautionaryStatements
			? { precautionaryStatements: mappedSource }
			: {}),
		...(mappedSource &&
		metadata.dietaryTags.length > 0 &&
		!food.fieldProvenance?.dietaryTags
			? { dietaryTags: mappedSource }
			: {}),
		...(mappedSource &&
		metadata.labels.length > 0 &&
		!food.fieldProvenance?.labels
			? { labels: mappedSource }
			: {}),
		...(mappedSource &&
		food.structuredIngredients?.length &&
		!food.fieldProvenance?.structuredIngredients
			? { structuredIngredients: mappedSource }
			: {}),
		...(mappedSource &&
		metadata.ingredientAnalysis &&
		!food.fieldProvenance?.ingredientAnalysis
			? { ingredientAnalysis: mappedSource }
			: {}),
		...(mappedSource &&
		food.additives?.length &&
		!food.fieldProvenance?.additives
			? { additives: mappedSource }
			: {}),
		...(mappedSource && food.packageQuantity && !food.fieldProvenance?.package
			? { package: mappedSource }
			: {}),
		...(mappedSource &&
		food.alcoholByVolume &&
		!food.fieldProvenance?.alcoholByVolume
			? { alcoholByVolume: mappedSource }
			: {}),
		...(mappedSource &&
		food.regulatoryDisclosure &&
		!food.fieldProvenance?.regulatoryDisclosure
			? { regulatoryDisclosure: mappedSource }
			: {}),
		...(mappedSource &&
		food.sourceMetadata &&
		!food.fieldProvenance?.sourceMetadata
			? { sourceMetadata: mappedSource }
			: {}),
	};
};

const parseSourceWeight = (value: string) => {
	const parsed = parseSourceWeightMeasure(value);
	if (!parsed) return null;
	const grams = convertServingToGrams(parsed.quantity, parsed.unit);
	return grams === null ? null : { ...parsed, grams };
};

const parseServingBasis = (product: OpenFoodFactsProduct) => {
	const servingQuantity = toNumber(product.serving_quantity);
	const parsedServing = parseSourceWeight(product.serving_size ?? "");
	if (parsedServing) {
		return {
			servingWeightGrams: parsedServing.grams,
			useServingValues: true,
			hasExactGramWeight: true,
			parsedServing,
			milliliterVolume: null,
		};
	}
	const parsedQuantity =
		servingQuantity === null
			? null
			: parseSourceWeight(
					`${servingQuantity} ${product.serving_quantity_unit ?? ""}`,
				);
	if (servingQuantity !== null && servingQuantity > 0 && parsedQuantity) {
		return {
			servingWeightGrams: parsedQuantity.grams,
			useServingValues: true,
			hasExactGramWeight: true,
			parsedServing: parsedQuantity,
			milliliterVolume: null,
		};
	}
	const parsedMeasure =
		parseSourceServingMeasure(product.serving_size ?? "") ??
		(servingQuantity !== null && servingQuantity > 0
			? parseSourceServingMeasure(
					`${servingQuantity} ${product.serving_quantity_unit ?? ""}`,
				)
			: null);
	if (parsedMeasure) {
		const conversion = convertServingAmount(
			parsedMeasure.quantity,
			parsedMeasure.unit,
		);
		return {
			servingWeightGrams: conversion.grams,
			useServingValues: true,
			hasExactGramWeight: conversion.grams !== null,
			parsedServing: parsedMeasure,
			milliliterVolume: conversion.milliliters,
		};
	}
	return {
		servingWeightGrams: null,
		useServingValues: false,
		hasExactGramWeight: false,
		parsedServing: null,
		milliliterVolume: null,
	};
};

export const mapOpenFoodFactsProduct = (
	product: OpenFoodFactsProduct,
	barcode: string,
	productReferenceCatalog: ProductReferenceCatalog,
): BarcodeProductDraft | null => {
	const canonicalBarcode = normalizeBarcode(barcode);
	const sourceName =
		product.product_name?.trim() || product.generic_name?.trim();
	const name = formatSourceProductName(sourceName);
	if (!canonicalBarcode || !name) return null;

	const {
		servingWeightGrams,
		useServingValues,
		hasExactGramWeight,
		parsedServing,
		milliliterVolume,
	} = parseServingBasis(product);
	const nutrients = mapOpenFoodFactsNutrients(
		product.nutriments ?? {},
		servingWeightGrams,
		useServingValues,
		productReferenceCatalog,
		useServingValues
			? milliliterVolume !== null
				? {
						kind: "volume" as const,
						quantity: parsedServing?.quantity ?? milliliterVolume,
						unitKey: parsedServing?.unit ?? "ml",
					}
				: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: product.serving_size?.trim() || "Serving",
					}
			: { kind: "mass" as const, quantity: 100, unitKey: "g" },
	).map((nutrient) => ({ ...nutrient, sourceReference: canonicalBarcode }));
	const qualitativeFacts = mapOpenFoodFactsQualitativeNutrients(
		product.nutriments ?? {},
		product.nutrition_data_per,
		productReferenceCatalog,
		useServingValues
			? milliliterVolume !== null
				? {
						kind: "volume" as const,
						quantity: parsedServing?.quantity ?? milliliterVolume,
						unitKey: parsedServing?.unit ?? "ml",
					}
				: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: product.serving_size?.trim() || "Serving",
					}
			: { kind: "mass" as const, quantity: 100, unitKey: "g" },
	).map((fact) => ({ ...fact, sourceReference: canonicalBarcode }));
	const nutrientSourceReview = mapOpenFoodFactsNutrientSourceReview(
		product.nutriments ?? {},
		useServingValues,
		productReferenceCatalog,
		useServingValues
			? milliliterVolume !== null
				? {
						kind: "volume" as const,
						quantity: parsedServing?.quantity ?? milliliterVolume,
						unitKey: parsedServing?.unit ?? "ml",
					}
				: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: product.serving_size?.trim() || "Serving",
					}
			: { kind: "mass" as const, quantity: 100, unitKey: "g" },
	).map((entry) => ({ ...entry, sourceReference: canonicalBarcode }));
	const metadata = parseOpenFoodFactsMetadata(product);
	const image = parseOpenFoodFactsImage(product, canonicalBarcode);
	const alcoholByVolume = parseOpenFoodFactsAlcoholByVolume(product.nutriments);
	const volumeEquivalent = hasExactGramWeight
		? (parseVolumeEquivalent(product.serving_size) ?? undefined)
		: undefined;
	const parsedHouseholdEquivalent = hasExactGramWeight
		? parseSourceServingMeasure(
				normalizeFoodServingIdentityLabel(product.serving_size ?? ""),
			)
		: null;
	const householdEquivalent =
		parsedHouseholdEquivalent &&
		["count", "volume"].includes(
			getServingMeasureDimension(parsedHouseholdEquivalent.unit) ?? "",
		)
			? parsedHouseholdEquivalent
			: undefined;
	const displayEquivalent = volumeEquivalent ?? householdEquivalent;
	const packageVolumeServing = useServingValues
		? undefined
		: createExactPackageVolumeServing(
				metadata.packageQuantity,
				canonicalBarcode,
			);
	const exactServing: FoodServing | undefined = useServingValues
		? {
				label:
					product.serving_size?.trim() ||
					(servingWeightGrams ? `${servingWeightGrams} g` : "Package serving"),
				gramWeight: servingWeightGrams ?? undefined,
				milliliterVolume: milliliterVolume ?? undefined,
				amount: displayEquivalent?.quantity ?? parsedServing?.quantity,
				unitKey: displayEquivalent?.unit ?? parsedServing?.unit,
				isPrimary: true,
				measureType: "Package serving",
				isHouseholdMeasure:
					Boolean(displayEquivalent) || milliliterVolume !== null,
				sourceMeasureKey: "serving_size",
				origin: "package-label",
				gramWeightMethod: hasExactGramWeight ? "source-reported" : "unknown",
				source: "open-food-facts",
				sourceReference: canonicalBarcode,
				confidence: "unknown",
			}
		: packageVolumeServing;
	const servingLabel =
		exactServing?.label ||
		(servingWeightGrams ? `${servingWeightGrams} g` : "100 g reference");
	const source = getProductDataSource(
		productReferenceCatalog,
		"open-food-facts",
	);

	return {
		barcode: canonicalBarcode,
		name,
		nameProvenance: "source",
		brandOwner: product.brands?.trim() ?? "",
		servingLabel,
		servingWeightGrams,
		hasSourceServing: Boolean(exactServing),
		serving: exactServing,
		nutrients,
		nutrientQualitativeFacts: qualitativeFacts,
		nutrientSourceReview,
		reportedNutrientIds: [
			...new Set(nutrients.map((nutrient) => nutrient.nutrientId)),
		],
		foodIdentityType: "packaged",
		...metadata,
		alcoholByVolume,
		image,
		fieldProvenance: createOpenFoodFactsFieldProvenance({
			barcode: canonicalBarcode,
			nutrients,
			nutrientQualitativeFacts: qualitativeFacts,
			image,
			metadata,
			hasSourceServing: Boolean(exactServing),
			hasBrandOwner: Boolean(product.brands?.trim()),
			alcoholByVolume,
		}),
		volumeEquivalent,
		source: "open-food-facts",
		sourceLabel: source.displayName,
		sourceReference: canonicalBarcode,
		sourceKey: source.key,
		sourceModifiedDate: metadata.sourceMetadata?.modifiedAt,
	};
};

export const mapFdcBarcodeFood = (
	food: FoodItem,
	barcode: string,
	productReferenceCatalog: ProductReferenceCatalog,
	attributeMappedFields = true,
): BarcodeProductDraft | null => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode || !food.description) return null;

	const normalizedServing =
		food.foodServings?.find((serving) => serving.isPrimary) ??
		food.foodServings?.[0];
	const parsedServing = parseSourceWeight(
		`${food.servingSize ?? ""} ${food.servingSizeUnit ?? ""}`,
	);
	const hasSourceServing = Boolean(normalizedServing || parsedServing);
	const servingWeightGrams =
		normalizedServing?.gramWeight ?? parsedServing?.grams ?? null;
	const resolvedServing: FoodServing | undefined =
		normalizedServing ??
		(parsedServing
			? {
					label:
						food.householdServingFullText?.trim() || `${servingWeightGrams} g`,
					gramWeight: servingWeightGrams ?? undefined,
					amount: parsedServing.quantity,
					unitKey: parsedServing.unit,
					isPrimary: true,
					measureType: "Reported weight",
					isHouseholdMeasure: false,
					sourceMeasureKey: "servingSize",
					origin: "source-weight",
					gramWeightMethod: "source-reported",
					source: "usda",
					sourceReference: String(food.fdcId),
					confidence: "unknown",
				}
			: undefined);
	const servingConversion = resolvedServing
		? convertFoodServingMultiplier(resolvedServing, 1)
		: null;
	const metadata = parseFdcMetadata(food);
	const nutrients = canonicalizeProductNutrients(
		food.foodNutrients.flatMap((nutrient) => {
			const value = toNumber(nutrient.value);
			const servingValue = servingConversion
				? getNutrientAmountForServingConversion(nutrient, servingConversion)
				: value;
			return value === null || servingValue === null
				? []
				: [
						{
							...nutrient,
							value: servingValue,
							measurementBasis: resolvedServing
								? {
										kind: "serving" as const,
										quantity: 1,
										unitKey: "serving",
										servingLabel: resolvedServing.label,
									}
								: { kind: "mass" as const, quantity: 100, unitKey: "g" },
						},
					];
		}),
		productReferenceCatalog,
	);
	const nutrientIds = new Set(nutrients.map((nutrient) => nutrient.nutrientId));
	const reportedNutrientIds = (
		food.reportedNutrientIds ??
		food.foodNutrients
			.filter((nutrient) => nutrient.valueOrigin === "reported")
			.map((nutrient) => nutrient.nutrientId)
	).map((nutrientId) =>
		getCanonicalProductNutrientId(productReferenceCatalog, nutrientId),
	);

	return {
		barcode: canonicalBarcode,
		name:
			food.nameProvenance === "user"
				? food.description.trim().replace(/\s+/g, " ")
				: formatSourceProductName(food.description),
		nameProvenance: food.nameProvenance ?? "source",
		brandOwner: food.brandOwner ?? "",
		servingLabel:
			normalizedServing?.label ||
			(hasSourceServing && food.householdServingFullText) ||
			(servingWeightGrams ? `${servingWeightGrams} g` : "100 g reference"),
		servingWeightGrams,
		hasSourceServing,
		serving: resolvedServing,
		nutrients,
		nutrientQualitativeFacts: food.nutrientQualitativeFacts,
		reportedNutrientIds: [...new Set(reportedNutrientIds)].filter(
			(nutrientId) => nutrientIds.has(nutrientId),
		),
		foodIdentityType: "packaged",
		...metadata,
		structuredIngredients: food.structuredIngredients,
		additives: food.additives,
		packageQuantity: food.packageQuantity,
		alcoholByVolume: food.alcoholByVolume,
		regulatoryDisclosure: food.regulatoryDisclosure,
		sourceMetadata: food.sourceMetadata,
		image: food.image,
		fieldProvenance: createFdcFieldProvenance({
			food,
			nutrients,
			image: food.image,
			metadata,
			hasSourceServing,
			adapterSource: attributeMappedFields
				? createFieldSource("usda", String(food.fdcId), "unknown")
				: undefined,
		}),
		volumeEquivalent: hasSourceServing
			? (parseVolumeEquivalent(food.householdServingFullText) ?? undefined)
			: undefined,
		source: "usda",
		sourceLabel: getProductDataSource(productReferenceCatalog, "usda")
			.displayName,
		sourceReference: String(food.fdcId),
		sourceKey: "usda",
		sourceDataType: food.sourceDataType ?? food.dataType,
		sourcePublishedDate:
			food.sourcePublishedDate ?? food.publishedDate ?? food.publicationDate,
		sourceModifiedDate: food.sourceModifiedDate ?? food.modifiedDate,
	};
};

export const mapSharedCatalogFood = (
	food: FoodItem,
	barcode: string,
	productReferenceCatalog: ProductReferenceCatalog,
): BarcodeProductDraft | null => {
	const draft = mapFdcBarcodeFood(
		food,
		barcode,
		productReferenceCatalog,
		false,
	);
	if (!draft) return null;
	const sourceKey =
		food.sourceKey ??
		(food.barcodeSource === "usda"
			? "usda"
			: food.barcodeSource === "open-food-facts"
				? "open-food-facts"
				: "shared-catalog");
	const source = getProductDataSource(productReferenceCatalog, sourceKey);

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
		fieldProvenance: draft.fieldProvenance,
		sourceKey: source.key,
		sourceDataType: food.sourceDataType,
		sourcePublishedDate: food.sourcePublishedDate,
		sourceModifiedDate: food.sourceModifiedDate,
	};
};
