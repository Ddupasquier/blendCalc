import { getNutrientDefinitionCatalog } from "$lib/server/nutrition/nutrientDefinitionCatalog.server";
import type { Database } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	createNutrientValueMapFromFood,
	readNutrientRelationshipRules,
	validateNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type { FoodItem } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const validateSharedProductFood = (
	food: FoodItem,
	nutrientRelationshipRules: NutrientRelationshipRule[] = [],
) => {
	const issues: string[] = [];
	const barcode = normalizeBarcode(food.barcode ?? food.gtinUpc ?? "");
	if (!barcode) issues.push("A valid GTIN barcode is required.");
	const productName = food.description?.trim() ?? "";
	const brandOwner = food.brandOwner?.trim() ?? "";
	if (!productName) issues.push("A product name is required.");
	if (productName.length > 120) {
		issues.push("Product name must be 120 characters or fewer.");
	}
	if (brandOwner.length > 120) {
		issues.push("Brand must be 120 characters or fewer.");
	}
	if (food.customFood === true) {
		issues.push(
			"Private custom foods cannot be submitted to the shared catalog.",
		);
	}
	if (!Array.isArray(food.foodNutrients) || food.foodNutrients.length === 0) {
		issues.push("At least one nutrition value is required.");
	}
	if ((food.foodNutrients?.length ?? 0) > 300) {
		issues.push("A product cannot contain more than 300 nutrition values.");
	}
	if (
		food.customServingWeightGrams !== undefined &&
		(!Number.isFinite(food.customServingWeightGrams) ||
			food.customServingWeightGrams <= 0)
	) {
		issues.push("Serving weight must be greater than zero.");
	}

	const nutrientIds = new Set<number>();
	for (const nutrient of food.foodNutrients ?? []) {
		if (
			!Number.isSafeInteger(nutrient.nutrientId) ||
			nutrient.nutrientId <= 0
		) {
			issues.push("Every nutrition value needs a valid nutrient identity.");
			continue;
		}
		if (nutrientIds.has(nutrient.nutrientId)) {
			issues.push(`${nutrient.nutrientName || "A nutrient"} is duplicated.`);
			continue;
		}
		nutrientIds.add(nutrient.nutrientId);
		if (!Number.isFinite(nutrient.value) || nutrient.value < 0) {
			issues.push(
				`${nutrient.nutrientName || "A nutrient"} has an invalid value.`,
			);
		}
	}

	issues.push(
		...validateNutrientRelationshipRules(
			createNutrientValueMapFromFood(food),
			nutrientRelationshipRules,
		).map((issue) => issue.message),
	);

	return { barcode, issues, valid: issues.length === 0 };
};

const assertKnownCatalogNutrients = async (food: FoodItem) => {
	const nutrientIds = [
		...new Set(food.foodNutrients.map((nutrient) => nutrient.nutrientId)),
	];
	const knownIds = new Set(
		(await getNutrientDefinitionCatalog()).map(
			(definition) => definition.nutrient_id,
		),
	);
	const unknownIds = nutrientIds.filter(
		(nutrientId) => !knownIds.has(nutrientId),
	);
	if (unknownIds.length > 0) {
		throw new Error(
			`Unknown nutrient identifiers cannot be submitted: ${unknownIds.join(", ")}.`,
		);
	}
};

export const assertSharedProductFoodCanBePublished = async (
	supabase: SupabaseClient<Database>,
	food: FoodItem,
) => {
	const nutrientRelationshipRules =
		await readNutrientRelationshipRules(supabase);
	if (!nutrientRelationshipRules?.length) {
		throw new Error("Nutrition validation rules are not configured.");
	}
	const validation = validateSharedProductFood(food, nutrientRelationshipRules);
	if (!validation.valid) {
		throw new Error(validation.issues.join(" "));
	}
	await assertKnownCatalogNutrients(food);
	return { ...validation, nutrientRelationshipRules };
};
