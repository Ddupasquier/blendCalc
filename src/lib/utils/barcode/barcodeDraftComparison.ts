import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { BarcodeVolumeEquivalent } from "$lib/utils/barcode/servingVolume";
import type {
	FoodNutrient,
	FoodNutrientQualitativeFact,
} from "$lib/utils/food/types";

export type BarcodeProductDraftComparisonEntry = {
	name: string;
	brandOwner: string;
	category: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	volumeEquivalent: { quantity: number; unit: string } | null;
	nutrients: FoodNutrient[];
	nutrientQualitativeFacts: FoodNutrientQualitativeFact[];
	ingredients: string;
	ingredientList: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	categories: string[];
};

const normalizeText = (value: string | undefined | null) =>
	(value ?? "").trim().toLocaleLowerCase();

const isStringValue = (value: string | undefined): value is string =>
	Boolean(value);

const normalizeTextList = (values: string[] | undefined) =>
	[...new Set((values ?? []).map(normalizeText).filter(Boolean))].sort();

const listsMatch = (left: string[], right: string[]) =>
	left.length === right.length &&
	left.every((value, index) => value === right[index]);

const numbersMatch = (
	left: number | null | undefined,
	right: number | null | undefined,
) => {
	if (left == null || right == null) return left == null && right == null;
	const leftNumber = Number(left);
	const rightNumber = Number(right);
	return (
		Number.isFinite(leftNumber) &&
		Number.isFinite(rightNumber) &&
		Math.abs(leftNumber - rightNumber) < 0.001
	);
};

const nutrientsMatch = (left: FoodNutrient[], right: FoodNutrient[]) => {
	const leftMap = new Map(
		left.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
	);
	const rightMap = new Map(
		right.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
	);
	const nutrientIds = new Set([...leftMap.keys(), ...rightMap.keys()]);

	for (const nutrientId of nutrientIds) {
		if (!leftMap.has(nutrientId) || !rightMap.has(nutrientId)) return false;
		if (!numbersMatch(leftMap.get(nutrientId), rightMap.get(nutrientId)))
			return false;
	}

	return true;
};

const qualitativeNutrientsMatch = (
	left: FoodNutrientQualitativeFact[] | undefined,
	right: FoodNutrientQualitativeFact[],
) => {
	const signature = (fact: FoodNutrientQualitativeFact) =>
		JSON.stringify({
			nutrientId: fact.nutrientId,
			status: fact.status,
			statement: normalizeText(fact.statement),
			maximumAmount: fact.maximumAmount ?? null,
			unitName: fact.unitName.toUpperCase(),
			measurementBasis: fact.measurementBasis,
		});
	return listsMatch(
		(left ?? []).map(signature).sort(),
		right.map(signature).sort(),
	);
};

const volumeEquivalentMatches = (
	left: BarcodeVolumeEquivalent | undefined,
	right: { quantity: number; unit: string } | null,
) => {
	if (!left && !right) return true;
	if (!left || !right) return false;
	return (
		numbersMatch(left.quantity, right.quantity) &&
		normalizeText(left.unit) === normalizeText(right.unit)
	);
};

export const barcodeDraftMatchesEntry = (
	draft: BarcodeProductDraft,
	entry: BarcodeProductDraftComparisonEntry,
) => {
	const entryCategories = normalizeTextList([
		entry.category,
		...entry.categories,
	]);

	return (
		normalizeText(draft.name) === normalizeText(entry.name) &&
		normalizeText(draft.brandOwner) === normalizeText(entry.brandOwner) &&
		normalizeText(draft.servingLabel) === normalizeText(entry.servingLabel) &&
		numbersMatch(draft.servingWeightGrams, entry.servingWeightGrams) &&
		volumeEquivalentMatches(draft.volumeEquivalent, entry.volumeEquivalent) &&
		normalizeText(draft.ingredients) === normalizeText(entry.ingredients) &&
		listsMatch(
			normalizeTextList(draft.ingredientList),
			normalizeTextList(entry.ingredientList),
		) &&
		listsMatch(
			normalizeTextList(draft.allergens),
			normalizeTextList(entry.allergens),
		) &&
		listsMatch(
			normalizeTextList(draft.traces),
			normalizeTextList(entry.traces),
		) &&
		listsMatch(
			normalizeTextList(draft.dietaryTags),
			normalizeTextList(entry.dietaryTags),
		) &&
		listsMatch(
			normalizeTextList(draft.labels),
			normalizeTextList(entry.labels),
		) &&
		listsMatch(
			normalizeTextList(
				[draft.resolvedCategory, ...(draft.categories ?? [])].filter(
					isStringValue,
				),
			),
			entryCategories,
		) &&
		nutrientsMatch(draft.nutrients, entry.nutrients) &&
		qualitativeNutrientsMatch(
			draft.nutrientQualitativeFacts,
			entry.nutrientQualitativeFacts,
		)
	);
};

export const barcodeDraftHasEntryChanges = (
	draft: BarcodeProductDraft | null,
	entry: BarcodeProductDraftComparisonEntry,
) => Boolean(draft && !barcodeDraftMatchesEntry(draft, entry));
