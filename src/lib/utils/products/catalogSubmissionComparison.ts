import type { FoodItem } from "$lib/utils/food/types";
import {
	compareNormalizedFoods,
	type NormalizedProductDifference,
	type ProductDifferenceValue,
} from "$lib/utils/products/productDifferenceEngine";
import {
	getProductDifferenceThresholds,
	type ProductDifferenceSeverity,
	type ProductResolutionPolicy,
} from "$lib/utils/products/productResolutionPolicy";

type DifferenceSeverity = ProductDifferenceSeverity;

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
	hasBlockingIdentityMismatch: boolean;
	changedFields: string[];
	changes: CatalogSubmissionFieldChange[];
	issues: string[];
	severeDifferences: string[];
};

const getNutrientDifferenceSeverity = (
	difference: NormalizedProductDifference,
	policy: ProductResolutionPolicy,
): DifferenceSeverity | null => {
	if (difference.unitMismatch) return "high";
	return (
		getProductDifferenceThresholds(policy, "catalog-submission-nutrient").find(
			(threshold) =>
				(difference.differenceRatio ?? 0) >= threshold.minimumDifferenceRatio &&
				(difference.absoluteDifference ?? 0) >=
					threshold.minimumAbsoluteDifference,
		)?.severity ?? null
	);
};

const getDifferences = (
	submittedFood: FoodItem,
	existingFood: FoodItem,
	policy: ProductResolutionPolicy,
) => {
	return compareNormalizedFoods(submittedFood, existingFood, {
		resolutionPolicy: policy,
	}).flatMap((difference): CatalogSubmissionFieldChange[] => {
		const isNutrient = difference.field.startsWith("nutrient:");
		const nutrientLabel =
			difference.submittedNutrient?.nutrientName ||
			`Nutrient ${difference.field.split(":")[1]}`;
		const metadata = {
			productName: [
				"Product name",
				"Product name differs from the active catalog item.",
			],
			brandOwner: ["Brand", "Brand differs from the active catalog item."],
			category: ["Category", "Category differs from the active catalog item."],
			servingWeightGrams: [
				"Serving weight",
				"Serving weight differs from the active catalog item.",
			],
			householdServing: [
				"Household serving",
				"Household serving text differs from the active catalog item.",
			],
			ingredients: [
				"Ingredient statement",
				"Ingredient statement differs from the active catalog item.",
			],
			allergens: [
				"Allergens",
				"Allergens differ from the active catalog item.",
			],
			traces: [
				"Possible traces",
				"Possible traces differ from the active catalog item.",
			],
		} as const;
		if (
			difference.field === "servingWeightGrams" &&
			difference.previousValue !== null &&
			(difference.absoluteDifference ?? 0) <= policy.servingWeightToleranceGrams
		)
			return [];
		const severity = isNutrient
			? difference.changeType === "added"
				? "low"
				: getNutrientDifferenceSeverity(difference, policy)
			: difference.field === "productName" || difference.field === "brandOwner"
				? difference.textRelationship === "unrelated"
					? "high"
					: "medium"
				: difference.field === "category"
					? difference.textRelationship === "unrelated"
						? "high"
						: "low"
					: difference.field === "householdServing"
						? "low"
						: "medium";
		if (!severity) return [];
		const [label, defaultMessage] = isNutrient
			? [
					nutrientLabel,
					difference.changeType === "added"
						? `${nutrientLabel} was added to the submitted label data.`
						: `${nutrientLabel} differs from the active catalog item.`,
				]
			: metadata[difference.field as keyof typeof metadata];
		return [
			{
				field: difference.field,
				label,
				message: defaultMessage,
				severity,
				changeType: difference.changeType,
				previousValue: difference.previousValue,
				submittedValue: difference.submittedValue,
			},
		];
	});
};

export const compareCatalogSubmissionToExistingProduct = (
	submittedFood: FoodItem,
	existingFood: FoodItem,
	policy: ProductResolutionPolicy,
): CatalogSubmissionComparison => {
	const differences = getDifferences(submittedFood, existingFood, policy);
	const severeDifferences = differences
		.filter((difference) => difference.severity === "high")
		.map((difference) => difference.message);
	const changedFields = [
		...new Set(differences.map((difference) => difference.field)),
	];

	const hasNameMismatch = differences.some(
		(difference) => difference.field === "productName",
	);
	return {
		matchesExisting: differences.length === 0,
		hasBlockingIdentityMismatch: hasNameMismatch,
		changedFields,
		changes: differences,
		issues: differences.map((difference) => difference.message),
		severeDifferences,
	};
};
