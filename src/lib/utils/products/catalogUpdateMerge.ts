import type { FdcFood } from "$lib/utils/food/types";
import type { CatalogSubmissionFieldChange } from "$lib/utils/products/catalogSubmissionComparison";

const SERVING_FIELDS = [
	"servingSize",
	"servingSizeUnit",
	"customServingWeightGrams",
	"foodServings",
	"hasSourceServing",
] as const;

const HOUSEHOLD_SERVING_FIELDS = [
	"householdServingFullText",
	"customServingLabel",
] as const;

const CATEGORY_FIELDS = [
	"foodCategory",
	"brandedFoodCategory",
	"categories",
	"categoryOptionId",
	"symbolKey",
] as const;

const INGREDIENT_FIELDS = [
	"ingredients",
	"ingredientList",
	"structuredIngredients",
	"ingredientAnalysis",
	"additives",
	"dietaryTags",
	"labels",
	"allergenDisclosure",
] as const;

const copyFields = <Key extends keyof FdcFood>(
	target: FdcFood,
	source: FdcFood,
	fields: readonly Key[],
) => {
	for (const field of fields) {
		target[field] = source[field];
	}
};

const getChangedNutrientIds = (
	changes: readonly CatalogSubmissionFieldChange[],
) =>
	new Set(
		changes.flatMap((change) => {
			if (!change.field.startsWith("nutrient:")) return [];
			const nutrientId = Number(change.field.slice("nutrient:".length));
			return Number.isSafeInteger(nutrientId) && nutrientId > 0
				? [nutrientId]
				: [];
		}),
	);

export const getCatalogUpdateProvenancePaths = (
	changes: readonly CatalogSubmissionFieldChange[],
) => {
	const paths = new Set<string>();
	for (const change of changes) {
		if (change.field.startsWith("nutrient:")) {
			paths.add(change.field);
			continue;
		}
		switch (change.field) {
			case "productName":
				paths.add("productName");
				break;
			case "brandOwner":
				paths.add("brandOwner");
				break;
			case "category":
				paths.add("categories");
				break;
			case "servingWeightGrams":
			case "householdServing":
				paths.add("servingWeightGrams");
				break;
			case "ingredients":
				paths.add("ingredients");
				paths.add("structuredIngredients");
				paths.add("ingredientAnalysis");
				paths.add("additives");
				paths.add("dietaryTags");
				paths.add("labels");
				break;
			case "allergens":
				paths.add("allergens");
				break;
			case "traces":
				paths.add("traces");
				break;
		}
	}
	return paths;
};

export const mergeCatalogUpdateFood = (
	currentFood: FdcFood,
	submittedFood: FdcFood,
	changes: readonly CatalogSubmissionFieldChange[],
): FdcFood => {
	const mergedFood: FdcFood = {
		...currentFood,
		foodNutrients: [...currentFood.foodNutrients],
		reportedNutrientIds: [...(currentFood.reportedNutrientIds ?? [])],
	};
	const changedFields = new Set(changes.map((change) => change.field));

	if (changedFields.has("productName")) {
		mergedFood.description = submittedFood.description;
		mergedFood.canonicalDescription = submittedFood.description;
	}
	if (changedFields.has("brandOwner")) {
		mergedFood.brandOwner = submittedFood.brandOwner;
	}
	if (changedFields.has("category")) {
		copyFields(mergedFood, submittedFood, CATEGORY_FIELDS);
	}
	if (changedFields.has("servingWeightGrams")) {
		copyFields(mergedFood, submittedFood, SERVING_FIELDS);
	}
	if (changedFields.has("householdServing")) {
		copyFields(mergedFood, submittedFood, HOUSEHOLD_SERVING_FIELDS);
	}
	if (changedFields.has("ingredients")) {
		copyFields(mergedFood, submittedFood, INGREDIENT_FIELDS);
	}
	if (changedFields.has("allergens")) {
		mergedFood.allergens = submittedFood.allergens;
	}
	if (changedFields.has("traces")) {
		mergedFood.traces = submittedFood.traces;
	}

	const changedNutrientIds = getChangedNutrientIds(changes);
	if (changedNutrientIds.size > 0) {
		const submittedNutrients = new Map(
			submittedFood.foodNutrients.map((nutrient) => [
				nutrient.nutrientId,
				nutrient,
			]),
		);
		const nutrientsById = new Map(
			mergedFood.foodNutrients.map((nutrient) => [
				nutrient.nutrientId,
				nutrient,
			]),
		);
		for (const nutrientId of changedNutrientIds) {
			const submittedNutrient = submittedNutrients.get(nutrientId);
			if (submittedNutrient) nutrientsById.set(nutrientId, submittedNutrient);
		}
		mergedFood.foodNutrients = [...nutrientsById.values()];
		mergedFood.reportedNutrientIds = [
			...new Set([
				...(currentFood.reportedNutrientIds ?? []),
				...(submittedFood.reportedNutrientIds ?? []),
				...changedNutrientIds,
			]),
		];
	}

	mergedFood.customFood = false;
	mergedFood.dataType = "Shared Product";
	mergedFood.barcodeSource = "community";
	mergedFood.sharedProductConfidence = "moderator-reviewed";
	return mergedFood;
};
