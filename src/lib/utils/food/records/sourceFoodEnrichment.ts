import type {
	FdcFood,
	FdcNutrient,
	FoodServing,
} from "$lib/utils/food/types";

const mergeNutrients = (
	current: FdcNutrient[],
	source: FdcNutrient[],
) => {
	const nutrients = new Map(
		current.map((nutrient) => [nutrient.nutrientId, nutrient]),
	);
	for (const nutrient of source) {
		nutrients.set(nutrient.nutrientId, nutrient);
	}
	return [...nutrients.values()];
};

const mergeReportedNutrientIds = (
	nutrients: FdcNutrient[],
	current: number[] | undefined,
	source: number[] | undefined,
) => {
	const availableIds = new Set(nutrients.map(({ nutrientId }) => nutrientId));
	return [...new Set([...(current ?? []), ...(source ?? [])])].filter(
		(nutrientId) => availableIds.has(nutrientId),
	);
};

const preferSourceValues = <Value>(
	source: Value[] | undefined,
	current: Value[] | undefined,
) => source?.length ? source : current;

const preferSourceText = (
	source: string | undefined,
	current: string | undefined,
) => source?.trim() ? source : current;

const preferSourceServings = (
	source: FoodServing[] | undefined,
	current: FoodServing[] | undefined,
) => source?.length ? source : current;

export const mergeExactSourceFood = (
	current: FdcFood,
	source: FdcFood,
): FdcFood => {
	const foodNutrients = mergeNutrients(
		current.foodNutrients,
		source.foodNutrients,
	);
	const foodServings = preferSourceServings(
		source.foodServings,
		current.foodServings,
	);
	const preserveUserName = current.nameProvenance === "user";
	const preserveCanonicalCategory = Boolean(current.categoryOptionId);

	return {
		...current,
		...source,
		fdcId: current.fdcId,
		description: preserveUserName ? current.description : source.description,
		nameProvenance: preserveUserName ? "user" : source.nameProvenance,
		sourceIdentifiers: {
			...current.sourceIdentifiers,
			...source.sourceIdentifiers,
		},
		foodCategory: preserveCanonicalCategory
			? current.foodCategory
			: preferSourceText(source.foodCategory, current.foodCategory),
		categories: preserveCanonicalCategory
			? current.categories
			: preferSourceValues(source.categories, current.categories),
		categoryOptionId: current.categoryOptionId ?? source.categoryOptionId,
		symbolKey: current.symbolKey ?? source.symbolKey,
		ingredients: preferSourceText(source.ingredients, current.ingredients),
		ingredientList: preferSourceValues(
			source.ingredientList,
			current.ingredientList,
		),
		structuredIngredients: preferSourceValues(
			source.structuredIngredients,
			current.structuredIngredients,
		),
		additives: preferSourceValues(source.additives, current.additives),
		allergens: preferSourceValues(source.allergens, current.allergens),
		traces: preferSourceValues(source.traces, current.traces),
		dietaryTags: preferSourceValues(source.dietaryTags, current.dietaryTags),
		labels: preferSourceValues(source.labels, current.labels),
		packageQuantity: source.packageQuantity ?? current.packageQuantity,
		sourceMetadata: source.sourceMetadata ?? current.sourceMetadata,
		foodNutrients,
		reportedNutrientIds: mergeReportedNutrientIds(
			foodNutrients,
			current.reportedNutrientIds,
			source.reportedNutrientIds,
		),
		foodServings,
		hasSourceServing: source.hasSourceServing ??
			current.hasSourceServing ??
			Boolean(foodServings?.length),
		image: current.image ?? source.image,
		fieldProvenance: {
			...current.fieldProvenance,
			...source.fieldProvenance,
		},
		customFood: current.customFood,
		barcode: current.barcode ?? source.barcode,
		barcodeSource: current.barcodeSource ?? source.barcodeSource,
		barcodeProvenance: current.barcodeProvenance ?? source.barcodeProvenance,
		gtinUpc: current.gtinUpc ?? source.gtinUpc,
		sharedProductId: current.sharedProductId ?? source.sharedProductId,
		sharedProductSubmissionId:
			current.sharedProductSubmissionId ?? source.sharedProductSubmissionId,
		sharedProductConfidence:
			current.sharedProductConfidence ?? source.sharedProductConfidence,
		trustStatus: current.trustStatus ?? source.trustStatus,
		listAddedAt: current.listAddedAt,
		customDensityGramsPerMilliliter:
			current.customDensityGramsPerMilliliter ??
			source.customDensityGramsPerMilliliter,
		customDensityLabel:
			current.customDensityLabel ?? source.customDensityLabel,
		customDensityVariancePercent:
			current.customDensityVariancePercent ??
			source.customDensityVariancePercent,
		customDensityConfidence:
			current.customDensityConfidence ?? source.customDensityConfidence,
	};
};
