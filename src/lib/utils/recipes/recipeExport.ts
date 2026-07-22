import { getNutrientTotalResult } from "$lib/utils/mix/calculations/nutrientTotals";
import { getServingMeasureOption } from "$lib/utils/serving/servingMeasureCatalog";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";

const formatAmount = (value: number) =>
	new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

const getIngredientAmount = (drink: SavedDrink, foodId: number) => {
	const quantity = drink.servingQuantities[foodId];
	const unit = drink.servingUnits[foodId];
	if (Number.isFinite(quantity) && quantity > 0 && unit) {
		const unitLabel = getServingMeasureOption(unit)?.shortLabel ?? unit;
		return `${formatAmount(quantity)} ${unitLabel}`;
	}

	const grams = drink.servingGrams[foodId];
	return Number.isFinite(grams) && grams > 0
		? `${formatAmount(grams)} g`
		: "Amount not saved";
};

const getNutrientUnit = (drink: SavedDrink, nutrientId: number) =>
	drink.foods
		.flatMap((food) => food.foodNutrients)
		.find((nutrient) => nutrient.nutrientId === nutrientId)
		?.unitName.toLowerCase() ?? "";

export const buildSavedDrinkExportText = (drink: SavedDrink) => {
	const ingredientLines = drink.foods.map(
		(food) => `- ${getIngredientAmount(drink, food.fdcId)} ${food.description}`,
	);
	const selectedIds = [...new Set(drink.selected.map(Number))].filter(Number.isFinite);
	const nutrientLines = selectedIds.flatMap((nutrientId) => {
		const option = drink.options.find((item) => Number(item.id) === nutrientId);
		if (!option) return [];

		const result = getNutrientTotalResult(
			drink.foods,
			nutrientId,
			drink.servingGrams,
		);
		const unit = getNutrientUnit(drink, nutrientId);
		const incompleteNote = result.missingFoodIds.length > 0
			? ` (partial: ${result.missingFoodIds.length} ingredient${result.missingFoodIds.length === 1 ? "" : "s"} missing this value)`
			: "";
		return [`- ${option.label}: ${formatAmount(result.total)}${unit ? ` ${unit}` : ""}${incompleteNote}`];
	});

	return [
		drink.name,
		"",
		"Ingredients",
		...(ingredientLines.length > 0 ? ingredientLines : ["- No ingredients saved"]),
		...(nutrientLines.length > 0
			? ["", "Nutrition totals", ...nutrientLines]
			: []),
		"",
		"Created with blendCalc",
	].join("\n");
};
