import {
	getFoodNutrientAmountForServingConversion,
	resolveFoodNutrient,
} from "$lib/utils/food/nutrients/foodNutrients";
import type { FoodItem } from "$lib/utils/food/types";
import { getServingMeasureOption } from "$lib/utils/serving/servingMeasureCatalog";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";
import { convertServingAmount } from "$lib/utils/serving/servingAmount";

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

export const buildSavedRecipeExportText = (recipe: SavedRecipe) => {
	const getContribution = (food: FoodItem, nutrientId: number) => {
		const nutrient = resolveFoodNutrient(food, nutrientId).nutrient;
		if (
			!nutrient ||
			!Number.isFinite(nutrient.value) ||
			nutrient.value < 0 ||
			["missing", "invalid", "unknown", "present-unquantified"].includes(
				nutrient.valueStatus ?? "",
			) ||
			nutrient.mappingStatus === "unmapped" ||
			nutrient.mappingStatus === "excluded"
		)
			return null;

		const quantity = recipe.servingQuantities[food.fdcId];
		const unit = recipe.servingUnits[food.fdcId];
		const grams = recipe.servingGrams[food.fdcId];
		const hasMeasure =
			Number.isFinite(quantity) && quantity >= 0 && Boolean(unit);
		const hasGrams = Number.isFinite(grams) && grams >= 0;
		if (!hasMeasure && !hasGrams) return null;
		const conversion = convertServingAmount(
			hasMeasure ? quantity : 0,
			hasMeasure ? unit : "g",
			food,
		);
		const amount = getFoodNutrientAmountForServingConversion(food, nutrientId, {
			...conversion,
			grams: hasGrams ? grams : hasMeasure ? conversion.grams : null,
			milliliters: hasMeasure ? conversion.milliliters : null,
			servings: hasMeasure ? conversion.servings : null,
			servingLabel: hasMeasure ? conversion.servingLabel : null,
		});
		return amount !== null && Number.isFinite(amount) && amount >= 0
			? { amount, unit: nutrient.unitName.toLowerCase() }
			: null;
	};
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

		const contributions = recipe.foods.map((food) =>
			getContribution(food, nutrientId),
		);
		const known = contributions.filter((value) => value !== null);
		if (known.length === 0)
			return [`- ${option.label}: Unknown (no calculable nutrient data)`];
		const unit = known[0].unit;
		if (known.some((value) => value.unit !== unit))
			return [`- ${option.label}: Unknown (incompatible nutrient units)`];
		const total = known.reduce((sum, value) => sum + value.amount, 0);
		if (!Number.isFinite(total))
			return [`- ${option.label}: Unknown (total unavailable)`];
		const amount = `${formatAmount(total)}${unit ? ` ${unit}` : ""}`;
		return [
			known.length === recipe.foods.length
				? `- ${option.label}: ${amount}`
				: `- ${option.label}: ${amount} known; total incomplete (${known.length} of ${recipe.foods.length} ingredients)`,
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
		...(nutrientLines.some(
			(line) => line.includes("total incomplete") || line.includes(": Unknown"),
		)
			? [
					"Nutrition is incomplete where an ingredient's nutrient amount or serving conversion is unavailable.",
					"",
				]
			: []),
		"Created with blendCalc",
	].join("\n");
};
