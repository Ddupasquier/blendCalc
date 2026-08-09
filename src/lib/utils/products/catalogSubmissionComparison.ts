import type { FoodItem } from "$lib/utils/food/types";
import { getNutritionFactsFields } from "$lib/utils/food/reference/appReferenceCatalog";
import {
	compareNormalizedFoods,
	type NormalizedProductDifference,
	type ProductDifferenceValue,
} from "$lib/utils/products/productDifferenceEngine";

type DifferenceSeverity = "low" | "medium" | "high";

export type CatalogSubmissionFieldChange = {
	field: string;
	label: string;
	message: string;
	severity: DifferenceSeverity;
	changeType: "added" | "removed" | "changed";
	previousValue: ProductDifferenceValue;
	submittedValue: ProductDifferenceValue;
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

const getNutrientDifferenceSeverity = (
	difference: NormalizedProductDifference,
): DifferenceSeverity | null => {
	if (difference.unitMismatch) return "high";
	if (
		(difference.differenceRatio ?? 0) >= 0.75 &&
		(difference.absoluteDifference ?? 0) >= 1
	) return "high";
	if (
		(difference.differenceRatio ?? 0) >= 0.35 &&
		(difference.absoluteDifference ?? 0) >= 0.5
	) return "medium";
	return (difference.differenceRatio ?? 0) >= 0.1 &&
		(difference.absoluteDifference ?? 0) >= 0.1
		? "low"
		: null;
};

const getDifferences = (submittedFood: FoodItem, existingFood: FoodItem) => {
	return compareNormalizedFoods(submittedFood, existingFood).flatMap(
		(difference): CatalogSubmissionFieldChange[] => {
			const isNutrient = difference.field.startsWith("nutrient:");
			const nutrientLabel =
				difference.submittedNutrient?.nutrientName ||
				`Nutrient ${difference.field.split(":")[1]}`;
			const metadata = {
				productName: ["Product name", "Product name differs from the active catalog item."],
				brandOwner: ["Brand", "Brand differs from the active catalog item."],
				category: ["Category", "Category differs from the active catalog item."],
				servingWeightGrams: ["Serving weight", "Serving weight differs from the active catalog item."],
				householdServing: ["Household serving", "Household serving text differs from the active catalog item."],
				ingredients: ["Ingredient statement", "Ingredient statement differs from the active catalog item."],
				allergens: ["Allergens", "Allergens differ from the active catalog item."],
				traces: ["Possible traces", "Possible traces differ from the active catalog item."],
			} as const;
			if (
				difference.field === "servingWeightGrams" &&
				difference.previousValue !== null &&
				(difference.absoluteDifference ?? 0) <= 0.1
			) return [];
			const severity = isNutrient
				? difference.changeType === "added"
					? "low"
					: getNutrientDifferenceSeverity(difference)
				: difference.field === "productName" || difference.field === "brandOwner"
					? difference.textRelationship === "unrelated" ? "high" : "medium"
					: difference.field === "category"
						? difference.textRelationship === "unrelated" ? "high" : "low"
						: difference.field === "householdServing" ? "low" : "medium";
			if (!severity) return [];
			const [label, defaultMessage] = isNutrient
				? [
					nutrientLabel,
					difference.changeType === "added"
						? `${nutrientLabel} was added to the submitted label data.`
						: `${nutrientLabel} differs from the active catalog item.`,
				]
				: metadata[difference.field as keyof typeof metadata];
			return [{
				field: difference.field,
				label,
				message: defaultMessage,
				severity,
				changeType: difference.changeType,
				previousValue: difference.previousValue,
				submittedValue: difference.submittedValue,
			}];
		},
	);
};

export const compareCatalogSubmissionToExistingProduct = (
	submittedFood: FoodItem,
	existingFood: FoodItem,
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
