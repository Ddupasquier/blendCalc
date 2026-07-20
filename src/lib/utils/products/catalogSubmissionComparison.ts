import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";
import { getNutritionFactsFields } from "$lib/utils/food/reference/appReferenceCatalog";
import {
	productNamesAreUnrelated,
	productNamesDiffer,
} from "$lib/utils/products/productIdentity";

type DifferenceSeverity = "low" | "medium" | "high";

export type CatalogSubmissionFieldChange = {
	field: string;
	label: string;
	message: string;
	severity: DifferenceSeverity;
	changeType: "added" | "removed" | "changed";
	previousValue: string | number | Record<string, string | number> | null;
	submittedValue: string | number | Record<string, string | number> | null;
};

export type CatalogSubmissionComparison = {
	matchesExisting: boolean;
	shouldAutoDecline: boolean;
	hasBlockingIdentityMismatch: boolean;
	changedFields: string[];
	changes: CatalogSubmissionFieldChange[];
	issues: string[];
	severeDifferences: string[];
};

const normalizeText = (value?: string | null) =>
	(value ?? "")
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const getComparableCategoryText = (food: FdcFood) =>
	[
		food.foodCategory,
		...(food.categories ?? []),
	]
		.map(normalizeText)
		.filter(Boolean)
		.join(" ");

const getServingWeight = (food: FdcFood) =>
	food.customServingWeightGrams ?? food.servingSize ?? null;

const numbersDiffer = (left: number | null, right: number | null, tolerance = 0.001) =>
	left !== null &&
	right !== null &&
	Number.isFinite(left) &&
	Number.isFinite(right) &&
	Math.abs(left - right) > tolerance;

const getNutrientMap = (food: FdcFood) =>
	new Map(food.foodNutrients.map((nutrient) => [nutrient.nutrientId, nutrient]));

const getNutrientLabel = (nutrient: FdcNutrient) =>
	nutrient.nutrientName || `Nutrient ${nutrient.nutrientId}`;

const getNutrientValue = (nutrient?: FdcNutrient) =>
	nutrient
		? { value: nutrient.value, unit: nutrient.unitName.toLocaleUpperCase() }
		: null;

const getChangeType = (previousValue: unknown, submittedValue: unknown) => {
	if (previousValue === null || previousValue === "") return "added" as const;
	if (submittedValue === null || submittedValue === "") return "removed" as const;
	return "changed" as const;
};

const normalizeTextList = (values?: string[]) =>
	[...new Set((values ?? []).map(normalizeText).filter(Boolean))].sort();

const textListsDiffer = (left?: string[], right?: string[]) => {
	const normalizedLeft = normalizeTextList(left);
	const normalizedRight = normalizeTextList(right);
	return normalizedLeft.length !== normalizedRight.length ||
		normalizedLeft.some((value, index) => value !== normalizedRight[index]);
};

const getNutrientDifferenceSeverity = (
	left: FdcNutrient,
	right: FdcNutrient,
): DifferenceSeverity | null => {
	if (left.unitName.toLocaleUpperCase() !== right.unitName.toLocaleUpperCase()) {
		return "high";
	}

	const largest = Math.max(Math.abs(left.value), Math.abs(right.value), 0.001);
	const difference = Math.abs(left.value - right.value);
	const differenceRatio = difference / largest;

	if (differenceRatio >= 0.75 && difference >= 1) return "high";
	if (differenceRatio >= 0.35 && difference >= 0.5) return "medium";
	return differenceRatio >= 0.1 && difference >= 0.1 ? "low" : null;
};

const getDifferences = (submittedFood: FdcFood, existingFood: FdcFood) => {
	const differences: CatalogSubmissionFieldChange[] = [];

	if (productNamesDiffer(submittedFood.description, existingFood.description)) {
		differences.push({
			field: "productName",
			label: "Product name",
			message: "Product name differs from the active catalog item.",
			severity: productNamesAreUnrelated(
				submittedFood.description,
				existingFood.description,
			)
				? "high"
				: "medium",
			changeType: "changed",
			previousValue: existingFood.description,
			submittedValue: submittedFood.description,
		});
	}

	if (submittedFood.brandOwner?.trim() &&
		productNamesDiffer(submittedFood.brandOwner, existingFood.brandOwner)) {
		differences.push({
			field: "brandOwner",
			label: "Brand",
			message: "Brand differs from the active catalog item.",
			severity: productNamesAreUnrelated(
				submittedFood.brandOwner,
				existingFood.brandOwner,
			)
				? "high"
				: "medium",
			changeType: getChangeType(
				existingFood.brandOwner?.trim() || null,
				submittedFood.brandOwner?.trim() || null,
			),
			previousValue: existingFood.brandOwner?.trim() || null,
			submittedValue: submittedFood.brandOwner?.trim() || null,
		});
	}

	const submittedCategory = getComparableCategoryText(submittedFood);
	const existingCategory = getComparableCategoryText(existingFood);
	if (productNamesDiffer(submittedCategory, existingCategory)) {
		differences.push({
			field: "category",
			label: "Category",
			message: "Category differs from the active catalog item.",
			severity: productNamesAreUnrelated(submittedCategory, existingCategory)
				? "high"
				: "low",
			changeType: getChangeType(existingCategory || null, submittedCategory || null),
			previousValue: existingCategory || null,
			submittedValue: submittedCategory || null,
		});
	}

	const submittedServing = getServingWeight(submittedFood);
	const existingServing = getServingWeight(existingFood);
	if (submittedServing !== null &&
		(existingServing === null || numbersDiffer(submittedServing, existingServing, 0.1))) {
		differences.push({
			field: "servingWeightGrams",
			label: "Serving weight",
			message: "Serving weight differs from the active catalog item.",
			severity: "medium",
			changeType: getChangeType(existingServing, submittedServing),
			previousValue: existingServing,
			submittedValue: submittedServing,
		});
	}

	if (submittedFood.householdServingFullText?.trim() && productNamesDiffer(
		submittedFood.householdServingFullText,
		existingFood.householdServingFullText,
	)) {
		differences.push({
			field: "householdServing",
			label: "Household serving",
			message: "Household serving text differs from the active catalog item.",
			severity: "low",
			changeType: getChangeType(
				existingFood.householdServingFullText?.trim() || null,
				submittedFood.householdServingFullText?.trim() || null,
			),
			previousValue: existingFood.householdServingFullText?.trim() || null,
			submittedValue: submittedFood.householdServingFullText?.trim() || null,
		});
	}

	if (submittedFood.ingredients?.trim() &&
		normalizeText(submittedFood.ingredients) !== normalizeText(existingFood.ingredients)) {
		differences.push({
			field: "ingredients",
			label: "Ingredient statement",
			message: "Ingredient statement differs from the active catalog item.",
			severity: "medium",
			changeType: getChangeType(
				existingFood.ingredients?.trim() || null,
				submittedFood.ingredients?.trim() || null,
			),
			previousValue: existingFood.ingredients?.trim() || null,
			submittedValue: submittedFood.ingredients?.trim() || null,
		});
	}

	for (const [field, label, submittedValues, existingValues] of [
		["allergens", "Allergens", submittedFood.allergens, existingFood.allergens],
		["traces", "Possible traces", submittedFood.traces, existingFood.traces],
	] as const) {
		if (!submittedValues?.length) continue;
		if (!textListsDiffer(submittedValues, existingValues)) continue;
		const previousValue = normalizeTextList(existingValues).join(", ") || null;
		const submittedValue = normalizeTextList(submittedValues).join(", ") || null;
		differences.push({
			field,
			label,
			message: `${label} differ from the active catalog item.`,
			severity: "medium",
			changeType: getChangeType(previousValue, submittedValue),
			previousValue,
			submittedValue,
		});
	}

	const submittedNutrients = getNutrientMap(submittedFood);
	const existingNutrients = getNutrientMap(existingFood);
	const nutrientIds = new Set([
		...submittedNutrients.keys(),
		...existingNutrients.keys(),
	]);
	for (const nutrientId of nutrientIds) {
		const submittedNutrient = submittedNutrients.get(nutrientId);
		const existingNutrient = existingNutrients.get(nutrientId);
		if (!submittedNutrient) continue;
		if (!existingNutrient) {
			const label = getNutrientLabel(submittedNutrient);
			differences.push({
				field: `nutrient:${nutrientId}`,
				label,
				message: `${label} was added to the submitted label data.`,
				severity: "low",
				changeType: "added",
				previousValue: null,
				submittedValue: getNutrientValue(submittedNutrient),
			});
			continue;
		}
		const severity = getNutrientDifferenceSeverity(submittedNutrient, existingNutrient);
		if (!severity) continue;
		differences.push({
			field: `nutrient:${nutrientId}`,
			label: getNutrientLabel(submittedNutrient),
			message: `${getNutrientLabel(submittedNutrient)} differs from the active catalog item.`,
			severity,
			changeType: "changed",
			previousValue: getNutrientValue(existingNutrient),
			submittedValue: getNutrientValue(submittedNutrient),
		});
	}

	return differences;
};

export const compareCatalogSubmissionToExistingProduct = (
	submittedFood: FdcFood,
	existingFood: FdcFood,
): CatalogSubmissionComparison => {
	const differences = getDifferences(submittedFood, existingFood);
	const severeDifferences = differences
		.filter((difference) => difference.severity === "high")
		.map((difference) => difference.message);
	const changedFields = [...new Set(differences.map((difference) => difference.field))];

	const hasNameMismatch = differences.some(
		(difference) => difference.field === "productName",
	);
	const hasSevereNameMismatch = differences.some((difference) =>
		difference.field === "productName" && difference.severity === "high"
	);
	const hasBrandMismatch = differences.some((difference) =>
		difference.field === "brandOwner" && difference.severity === "high"
	);
	const hasCategoryMismatch = differences.some((difference) =>
		difference.field === "category" && difference.severity === "high"
	);
	const keyNutrientIds = new Set(
		getNutritionFactsFields().map((nutrient) => nutrient.id),
	);
	const severeNutrientCount = differences.filter((difference) =>
		difference.field.startsWith("nutrient:") &&
		keyNutrientIds.has(Number(difference.field.split(":")[1])) &&
		difference.severity === "high"
	).length;

	const shouldAutoDecline =
		(hasSevereNameMismatch && (hasBrandMismatch || hasCategoryMismatch)) ||
		(severeDifferences.length >= 2 && severeNutrientCount >= 1) ||
		severeNutrientCount >= 4;

	return {
		matchesExisting: differences.length === 0,
		shouldAutoDecline,
		hasBlockingIdentityMismatch: hasNameMismatch,
		changedFields,
		changes: differences,
		issues: differences.map((difference) => difference.message),
		severeDifferences,
	};
};
