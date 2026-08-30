import { getNutrientTotal } from "$lib/utils/mix/calculations/nutrientTotals";
import { getServingMeasureOption } from "$lib/utils/serving/servingMeasureCatalog";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";
import { getServingConversions } from "$lib/utils/mix/state/mixState";

const formatAmount = (value: number) =>
	new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

export const formatSavedRecipeIngredientAmount = (
	recipe: SavedRecipe,
	foodId: number,
) => {
	const quantity = recipe.servingQuantities[foodId];
	const unit = recipe.servingUnits[foodId];
	if (Number.isFinite(quantity) && quantity > 0 && unit) {
		const unitLabel = getServingMeasureOption(unit)?.shortLabel ?? unit;
		return `${formatAmount(quantity)} ${unitLabel}`;
	}

	const grams = recipe.servingGrams[foodId];
	return Number.isFinite(grams) && grams > 0
		? `${formatAmount(grams)} g`
		: "Amount not saved";
};

const getNutrientUnit = (recipe: SavedRecipe, nutrientId: number) =>
	recipe.foods
		.flatMap((food) => food.foodNutrients)
		.find((nutrient) => nutrient.nutrientId === nutrientId)
		?.unitName.toLowerCase() ?? "";

export const buildSavedRecipeExportText = (recipe: SavedRecipe) => {
	const servingConversions = getServingConversions(
		recipe.foods,
		recipe.servingQuantities,
		recipe.servingUnits,
	);
	const ingredientLines = recipe.foods.map(
		(food) =>
			`- ${formatSavedRecipeIngredientAmount(recipe, food.fdcId)} ${food.description}`,
	);
	const selectedIds = [...new Set(recipe.selected.map(Number))].filter(
		Number.isFinite,
	);
	const nutrientLines = selectedIds.flatMap((nutrientId) => {
		const option = recipe.options.find(
			(item) => Number(item.id) === nutrientId,
		);
		if (!option) return [];

		const total = getNutrientTotal(
			recipe.foods,
			nutrientId,
			recipe.servingGrams,
			servingConversions,
		);
		const unit = getNutrientUnit(recipe, nutrientId);
		return [
			`- ${option.label}: ${formatAmount(total)}${unit ? ` ${unit}` : ""}`,
		];
	});

	return [
		recipe.name,
		"",
		"Ingredients",
		...(ingredientLines.length > 0
			? ingredientLines
			: ["- No ingredients saved"]),
		...(nutrientLines.length > 0
			? ["", "Nutrition totals", ...nutrientLines]
			: []),
		"",
		"Created with blendCalc",
	].join("\n");
};
