import {
	cleanBarcode,
	expandUpcEBarcode,
	normalizeBarcode,
} from "$lib/utils/barcode/barcode";
import type { ProductSourceFieldPath } from "$lib/utils/barcode/barcodeProductEnrichment";

export const OPEN_FOOD_FACTS_PRODUCT_API_VERSION = "2";
export const OPEN_FOOD_FACTS_PRODUCT_API_BASE_URL =
	"https://world.openfoodfacts.org/api/v2/product";

const IDENTITY_FIELDS = ["code", "product_name", "generic_name"] as const;

const OPEN_FOOD_FACTS_FIELDS_BY_PATH: Record<
	Exclude<ProductSourceFieldPath, `nutrient:${number}` | "productIdentity">,
	readonly string[]
> = {
	productName: ["product_name", "generic_name"],
	brandOwner: ["brands"],
	nutrition: [
		"nutriments",
		"nutrition_data_per",
		"serving_size",
		"serving_quantity",
		"serving_quantity_unit",
	],
	image: [
		"image_front_url",
		"image_front_small_url",
		"image_front_thumb_url",
		"image_url",
		"image_small_url",
		"image_thumb_url",
	],
	categories: [
		"categories",
		"categories_tags",
		"food_groups",
		"food_groups_tags",
		"tags_sources",
	],
	serving: ["serving_size", "serving_quantity", "serving_quantity_unit"],
	ingredients: ["ingredients_text", "ingredients_text_en", "ingredients_tags"],
	allergens: ["allergens", "allergens_tags", "tags_sources"],
	traces: [
		"traces",
		"traces_tags",
		"traces_from_ingredients",
		"traces_from_user",
		"tags_sources",
	],
	precautionaryStatements: [
		"allergens",
		"allergens_tags",
		"traces",
		"traces_tags",
		"traces_from_ingredients",
		"traces_from_user",
		"tags_sources",
	],
	dietaryTags: ["ingredients_analysis_tags", "labels_tags", "tags_sources"],
	labels: ["labels", "labels_tags", "tags_sources"],
	structuredIngredients: ["ingredients"],
	ingredientAnalysis: [
		"ingredients_tags",
		"ingredients_analysis_tags",
		"ingredients_percent_analysis",
		"ingredients_percent_estimate",
		"ingredients_percent_known",
		"ingredients_percent_unknown",
	],
	additives: ["additives_tags"],
	package: ["quantity", "product_quantity", "product_quantity_unit"],
	alcoholByVolume: ["nutriments"],
	regulatoryDisclosure: [
		"nutriments",
		"categories_tags",
		"labels_tags",
		"tags_sources",
	],
	sourceMetadata: [
		"lang",
		"languages_tags",
		"countries",
		"countries_tags",
		"created_t",
		"last_modified_t",
		"last_updated_t",
		"rev",
		"schema_version",
		"completeness",
		"data_quality_tags",
		"data_quality_errors_tags",
		"data_quality_warnings_tags",
		"obsolete",
		"obsolete_since_date",
		"tags_sources",
	],
};

const isNutrientFieldPath = (
	fieldPath: ProductSourceFieldPath,
): fieldPath is `nutrient:${number}` => fieldPath.startsWith("nutrient:");

export const getOpenFoodFactsRequestedFields = (
	requestedFieldPaths: readonly ProductSourceFieldPath[],
) => {
	const fields = new Set<string>(IDENTITY_FIELDS);
	for (const fieldPath of requestedFieldPaths) {
		const providerFields = isNutrientFieldPath(fieldPath)
			? OPEN_FOOD_FACTS_FIELDS_BY_PATH.nutrition
			: fieldPath === "productIdentity"
				? IDENTITY_FIELDS
				: OPEN_FOOD_FACTS_FIELDS_BY_PATH[fieldPath];
		for (const field of providerFields) fields.add(field);
	}
	return [...fields].sort();
};

export const getOpenFoodFactsRequestBarcode = (barcode: string) => {
	const cleaned = cleanBarcode(barcode);
	if (!normalizeBarcode(cleaned)) return null;
	const expanded = expandUpcEBarcode(cleaned) ?? cleaned;
	return expanded.length === 14 && expanded.startsWith("0")
		? expanded.slice(1)
		: expanded;
};
