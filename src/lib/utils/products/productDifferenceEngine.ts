import type { FoodItem, FoodNutrient } from "$lib/utils/food/types";
import {
	productNamesAreUnrelated,
	productNamesDiffer,
} from "$lib/utils/products/productIdentity";

export type ProductDifferenceValue =
	| string
	| number
	| Record<string, string | number>
	| null;

export type NormalizedProductDifference = {
	field: string;
	changeType: "added" | "removed" | "changed";
	previousValue: ProductDifferenceValue;
	submittedValue: ProductDifferenceValue;
	textRelationship?: "different" | "unrelated";
	absoluteDifference?: number;
	differenceRatio?: number;
	unitMismatch?: boolean;
	previousNutrient?: FoodNutrient;
	submittedNutrient?: FoodNutrient;
};

export type ProductDifferenceOptions = {
	submittedNutrientIds?: ReadonlySet<number>;
	previousNutrientIds?: ReadonlySet<number>;
	includeAddedNutrients?: boolean;
};

export const normalizeComparisonText = (value?: string | null) =>
	(value ?? "")
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

export const getRelativeDifference = (left: number, right: number) => {
	const absoluteDifference = Math.abs(left - right);
	return {
		absoluteDifference,
		differenceRatio:
			absoluteDifference / Math.max(Math.abs(left), Math.abs(right), 0.001),
	};
};

const getChangeType = (
	previousValue: ProductDifferenceValue,
	submittedValue: ProductDifferenceValue,
) => {
	if (previousValue === null || previousValue === "") return "added" as const;
	if (submittedValue === null || submittedValue === "") return "removed" as const;
	return "changed" as const;
};

const getComparableCategoryText = (food: FoodItem) =>
	[food.foodCategory, ...(food.categories ?? [])]
		.map(normalizeComparisonText)
		.filter(Boolean)
		.join(" ");

const getServingWeight = (food: FoodItem) =>
	food.customServingWeightGrams ?? food.servingSize ?? null;

const normalizeTextList = (values?: string[]) =>
	[...new Set((values ?? []).map(normalizeComparisonText).filter(Boolean))].sort();

const addTextDifference = (
	differences: NormalizedProductDifference[],
	field: string,
	submittedValue: string | null,
	previousValue: string | null,
) => {
	if (!productNamesDiffer(submittedValue, previousValue)) return;
	differences.push({
		field,
		changeType: getChangeType(previousValue, submittedValue),
		previousValue,
		submittedValue,
		textRelationship: productNamesAreUnrelated(submittedValue, previousValue)
			? "unrelated"
			: "different",
	});
};

const addListDifference = (
	differences: NormalizedProductDifference[],
	field: string,
	submittedValues?: string[],
	previousValues?: string[],
) => {
	if (!submittedValues?.length) return;
	const submittedValue = normalizeTextList(submittedValues).join(", ") || null;
	const previousValue = normalizeTextList(previousValues).join(", ") || null;
	if (submittedValue === previousValue) return;
	differences.push({
		field,
		changeType: getChangeType(previousValue, submittedValue),
		previousValue,
		submittedValue,
		textRelationship: "different",
	});
};

const getNutrientMap = (
	food: FoodItem,
	includedIds?: ReadonlySet<number>,
) =>
	new Map(
		food.foodNutrients
			.filter((nutrient) => !includedIds || includedIds.has(nutrient.nutrientId))
			.map((nutrient) => [nutrient.nutrientId, nutrient]),
	);

const getNutrientValue = (nutrient?: FoodNutrient) =>
	nutrient
		? { value: nutrient.value, unit: nutrient.unitName.toLocaleUpperCase() }
		: null;

export const compareNormalizedFoods = (
	submittedFood: FoodItem,
	previousFood: FoodItem,
	options: ProductDifferenceOptions = {},
): NormalizedProductDifference[] => {
	const differences: NormalizedProductDifference[] = [];

	addTextDifference(
		differences,
		"productName",
		submittedFood.description,
		previousFood.description,
	);

	if (submittedFood.brandOwner?.trim()) {
		addTextDifference(
			differences,
			"brandOwner",
			submittedFood.brandOwner.trim(),
			previousFood.brandOwner?.trim() || null,
		);
	}

	addTextDifference(
		differences,
		"category",
		getComparableCategoryText(submittedFood) || null,
		getComparableCategoryText(previousFood) || null,
	);

	const submittedServing = getServingWeight(submittedFood);
	const previousServing = getServingWeight(previousFood);
	if (
		submittedServing !== null &&
		(previousServing === null || submittedServing !== previousServing)
	) {
		differences.push({
			field: "servingWeightGrams",
			changeType: getChangeType(previousServing, submittedServing),
			previousValue: previousServing,
			submittedValue: submittedServing,
			...(previousServing === null
				? {}
				: getRelativeDifference(submittedServing, previousServing)),
		});
	}

	if (submittedFood.householdServingFullText?.trim()) {
		addTextDifference(
			differences,
			"householdServing",
			submittedFood.householdServingFullText.trim(),
			previousFood.householdServingFullText?.trim() || null,
		);
	}

	if (submittedFood.ingredients?.trim()) {
		addTextDifference(
			differences,
			"ingredients",
			submittedFood.ingredients.trim(),
			previousFood.ingredients?.trim() || null,
		);
	}

	addListDifference(
		differences,
		"allergens",
		submittedFood.allergens,
		previousFood.allergens,
	);
	addListDifference(
		differences,
		"traces",
		submittedFood.traces,
		previousFood.traces,
	);

	const submittedNutrients = getNutrientMap(
		submittedFood,
		options.submittedNutrientIds,
	);
	const previousNutrients = getNutrientMap(
		previousFood,
		options.previousNutrientIds,
	);
	for (const [nutrientId, submittedNutrient] of submittedNutrients) {
		const previousNutrient = previousNutrients.get(nutrientId);
		if (!previousNutrient) {
			if (options.includeAddedNutrients === false) continue;
			differences.push({
				field: `nutrient:${nutrientId}`,
				changeType: "added",
				previousValue: null,
				submittedValue: getNutrientValue(submittedNutrient),
				submittedNutrient,
			});
			continue;
		}

		const submittedUnit = submittedNutrient.unitName.toLocaleUpperCase();
		const previousUnit = previousNutrient.unitName.toLocaleUpperCase();
		const unitMismatch = submittedUnit !== previousUnit;
		const numericDifference = getRelativeDifference(
			submittedNutrient.value,
			previousNutrient.value,
		);
		if (!unitMismatch && numericDifference.absoluteDifference === 0) continue;
		differences.push({
			field: `nutrient:${nutrientId}`,
			changeType: "changed",
			previousValue: getNutrientValue(previousNutrient),
			submittedValue: getNutrientValue(submittedNutrient),
			unitMismatch,
			...numericDifference,
			previousNutrient,
			submittedNutrient,
		});
	}

	return differences;
};
