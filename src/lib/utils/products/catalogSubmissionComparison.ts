import { NUTRIENT_IDS, type FdcFood, type FdcNutrient } from "$lib/utils/food/types";

type DifferenceSeverity = "low" | "medium" | "high";

type Difference = {
	field: string;
	message: string;
	severity: DifferenceSeverity;
};

export type CatalogSubmissionComparison = {
	matchesExisting: boolean;
	shouldAutoDecline: boolean;
	changedFields: string[];
	issues: string[];
	severeDifferences: string[];
};

const KEY_NUTRIENT_IDS = [
	NUTRIENT_IDS.CALORIES,
	NUTRIENT_IDS.FAT,
	NUTRIENT_IDS.CARBS,
	NUTRIENT_IDS.PROTEIN,
	NUTRIENT_IDS.SODIUM,
	NUTRIENT_IDS.SUGAR,
	NUTRIENT_IDS.FIBER,
];

const normalizeText = (value?: string | null) =>
	(value ?? "")
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const tokenize = (value?: string | null) =>
	normalizeText(value)
		.split(/\s+/)
		.filter((token) => token.length > 1);

const tokenOverlapScore = (left?: string | null, right?: string | null) => {
	const leftTokens = new Set(tokenize(left));
	const rightTokens = new Set(tokenize(right));
	if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
	const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
	return shared / Math.min(leftTokens.size, rightTokens.size);
};

const textsDiffer = (left?: string | null, right?: string | null) => {
	const normalizedLeft = normalizeText(left);
	const normalizedRight = normalizeText(right);
	return Boolean(normalizedLeft && normalizedRight && normalizedLeft !== normalizedRight);
};

const textsAreUnrelated = (left?: string | null, right?: string | null) => {
	const normalizedLeft = normalizeText(left);
	const normalizedRight = normalizeText(right);
	if (!normalizedLeft || !normalizedRight) return false;
	if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
		return false;
	}
	return tokenOverlapScore(normalizedLeft, normalizedRight) < 0.2;
};

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
	const differences: Difference[] = [];

	if (textsDiffer(submittedFood.description, existingFood.description)) {
		differences.push({
			field: "productName",
			message: "Product name differs from the active catalog item.",
			severity: textsAreUnrelated(submittedFood.description, existingFood.description)
				? "high"
				: "medium",
		});
	}

	if (textsDiffer(submittedFood.brandOwner, existingFood.brandOwner)) {
		differences.push({
			field: "brandOwner",
			message: "Brand differs from the active catalog item.",
			severity: textsAreUnrelated(submittedFood.brandOwner, existingFood.brandOwner)
				? "high"
				: "medium",
		});
	}

	const submittedCategory = getComparableCategoryText(submittedFood);
	const existingCategory = getComparableCategoryText(existingFood);
	if (textsDiffer(submittedCategory, existingCategory)) {
		differences.push({
			field: "category",
			message: "Category differs from the active catalog item.",
			severity: textsAreUnrelated(submittedCategory, existingCategory) ? "high" : "low",
		});
	}

	const submittedServing = getServingWeight(submittedFood);
	const existingServing = getServingWeight(existingFood);
	if (numbersDiffer(submittedServing, existingServing, 0.1)) {
		differences.push({
			field: "servingWeightGrams",
			message: "Serving weight differs from the active catalog item.",
			severity: "medium",
		});
	}

	const submittedNutrients = getNutrientMap(submittedFood);
	const existingNutrients = getNutrientMap(existingFood);
	for (const nutrientId of KEY_NUTRIENT_IDS) {
		const submittedNutrient = submittedNutrients.get(nutrientId);
		const existingNutrient = existingNutrients.get(nutrientId);
		if (!submittedNutrient || !existingNutrient) continue;
		const severity = getNutrientDifferenceSeverity(submittedNutrient, existingNutrient);
		if (!severity) continue;
		differences.push({
			field: `nutrient:${nutrientId}`,
			message: `${getNutrientLabel(submittedNutrient)} differs from the active catalog item.`,
			severity,
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

	const hasNameMismatch = differences.some((difference) =>
		difference.field === "productName" && difference.severity === "high"
	);
	const hasBrandMismatch = differences.some((difference) =>
		difference.field === "brandOwner" && difference.severity === "high"
	);
	const hasCategoryMismatch = differences.some((difference) =>
		difference.field === "category" && difference.severity === "high"
	);
	const severeNutrientCount = differences.filter((difference) =>
		difference.field.startsWith("nutrient:") && difference.severity === "high"
	).length;

	const shouldAutoDecline =
		(hasNameMismatch && (hasBrandMismatch || hasCategoryMismatch)) ||
		(severeDifferences.length >= 2 && severeNutrientCount >= 1) ||
		severeNutrientCount >= 4;

	return {
		matchesExisting: differences.length === 0,
		shouldAutoDecline,
		changedFields,
		issues: differences.map((difference) => difference.message),
		severeDifferences,
	};
};
