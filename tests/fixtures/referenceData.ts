import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { ServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import { NUTRIENT_IDS } from "$lib/utils/food/types";

export const servingMeasureCatalogFixture: ServingMeasureCatalog = {
	options: [
		{ value: "g", label: "grams (g)", shortLabel: "g", dimension: "weight", conversionToBase: 1, isDefault: true },
		{ value: "mg", label: "milligrams (mg)", shortLabel: "mg", dimension: "weight", conversionToBase: 0.001, isDefault: false },
		{ value: "oz", label: "ounces (oz)", shortLabel: "oz", dimension: "weight", conversionToBase: 28.349523, isDefault: false },
		{ value: "kg", label: "kilograms (kg)", shortLabel: "kg", dimension: "weight", conversionToBase: 1000, isDefault: false },
		{ value: "lb", label: "pounds (lb)", shortLabel: "lb", dimension: "weight", conversionToBase: 453.59237, isDefault: false },
		{ value: "ml", label: "milliliters (ml)", shortLabel: "ml", dimension: "volume", conversionToBase: 1, isDefault: false },
		{ value: "tsp", label: "teaspoons (tsp)", shortLabel: "tsp", dimension: "volume", conversionToBase: 4.9289216, isDefault: false },
		{ value: "tbsp", label: "tablespoons (tbsp)", shortLabel: "tbsp", dimension: "volume", conversionToBase: 14.786765, isDefault: true },
		{ value: "cup", label: "cups", shortLabel: "cup", dimension: "volume", conversionToBase: 236.58824, isDefault: false },
		{ value: "floz", label: "fluid ounces (fl oz)", shortLabel: "fl oz", dimension: "volume", conversionToBase: 29.57353, isDefault: false },
	],
	aliases: {
		g: "g", gram: "g", grams: "g", mg: "mg", milligram: "mg", milligrams: "mg",
		oz: "oz", ounce: "oz", ounces: "oz", kg: "kg", kilogram: "kg", kilograms: "kg",
		lb: "lb", lbs: "lb", pound: "lb", pounds: "lb", ml: "ml", milliliter: "ml",
		milliliters: "ml", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", tbsp: "tbsp",
		tablespoon: "tbsp", tablespoons: "tbsp", cup: "cup", cups: "cup", floz: "floz",
		fluidounce: "floz", fluidounces: "floz",
	},
	aliasEntries: [
		{ alias: "g", unit: "g" }, { alias: "grams", unit: "g" },
		{ alias: "ml", unit: "ml" }, { alias: "milliliters", unit: "ml" },
		{ alias: "tsp", unit: "tsp" }, { alias: "teaspoons", unit: "tsp" },
		{ alias: "tbsp", unit: "tbsp" }, { alias: "tablespoons", unit: "tbsp" },
		{ alias: "cup", unit: "cup" }, { alias: "cups", unit: "cup" },
		{ alias: "fl oz", unit: "floz" }, { alias: "fluid ounces", unit: "floz" },
	],
};

const mapping = (
	sourceNutrientKey: string,
	nutrientId: number,
	nutrientName: string,
	nutrientNumber: string,
	unitName: string,
	sourceUnitName = unitName,
) => ({
	sourceKey: "open-food-facts",
	sourceNutrientKey,
	sourceNutrientName: sourceNutrientKey,
	sourceUnitName,
	priority: 10,
	nutrientId,
	nutrientName,
	nutrientNumber,
	unitName,
});

export const productReferenceDataFixture: ProductReferenceData = {
	sources: {
		usda: { key: "usda", displayName: "USDA FoodData Central", attributionText: null },
		"open-food-facts": { key: "open-food-facts", displayName: "Open Food Facts", attributionText: null },
		"shared-catalog": { key: "shared-catalog", displayName: "blendCalc verified catalog", attributionText: null },
	},
	nutrientMappings: [
		mapping("energy-kcal", NUTRIENT_IDS.CALORIES, "Energy", "208", "KCAL"),
		mapping("fat", NUTRIENT_IDS.FAT, "Total lipid (fat)", "204", "G"),
		mapping("carbohydrates", NUTRIENT_IDS.CARBS, "Carbohydrate, by difference", "205", "G"),
		mapping("fiber", NUTRIENT_IDS.FIBER, "Fiber, total dietary", "291", "G"),
		mapping("sugars", NUTRIENT_IDS.SUGAR, "Total Sugars", "269", "G"),
		mapping("proteins", NUTRIENT_IDS.PROTEIN, "Protein", "203", "G"),
		mapping("saturated-fat", 1258, "Fatty acids, total saturated", "606", "G"),
		mapping("sodium", NUTRIENT_IDS.SODIUM, "Sodium, Na", "307", "MG", "G"),
		mapping("calcium", NUTRIENT_IDS.CALCIUM, "Calcium, Ca", "301", "MG"),
		mapping("vitamin-d", 1114, "Vitamin D (D2 + D3)", "328", "UG", "IU"),
	],
	nutrientConversions: [{
		sourceKey: "open-food-facts",
		nutrientId: NUTRIENT_IDS.SODIUM,
		fromUnitName: "G",
		toUnitName: "MG",
		multiplier: 1000,
	}, {
		sourceKey: "open-food-facts",
		nutrientId: 1114,
		fromUnitName: "IU",
		toUnitName: "UG",
		multiplier: 0.025,
	}],
};

export const ingredientProvenanceOptionsFixture: IngredientProvenanceOption[] = [
	{
		dimension: "source",
		value: "usda",
		filter_label: "USDA",
		badge_label: "USDA",
		badge_tone: "info",
		display_order: 1,
		filter_enabled: true,
		badge_enabled: true,
	},
	{
		dimension: "source",
		value: "custom",
		filter_label: "Custom",
		badge_label: "Custom",
		badge_tone: "custom",
		display_order: 4,
		filter_enabled: true,
		badge_enabled: true,
	},
	{
		dimension: "trust",
		value: "source-verified",
		filter_label: "Source verified",
		badge_label: "Verified",
		badge_tone: "success",
		display_order: 1,
		filter_enabled: true,
		badge_enabled: true,
	},
	{
		dimension: "trust",
		value: "user-private",
		filter_label: "Private",
		badge_label: "Private",
		badge_tone: "neutral",
		display_order: 6,
		filter_enabled: true,
		badge_enabled: true,
	},
];
