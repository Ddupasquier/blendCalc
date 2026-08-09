import {
	formatFoodMetadataTag,
	getUniqueFoodMetadataTags,
} from "$lib/utils/food/records/foodMetadataPresentation";
import type {
	FoodItem,
	FoodIngredientPresentation,
	FoodIngredientPresentationClassification,
	FoodIngredientPresentationMetric,
	FoodIngredientPresentationRow,
	FoodStructuredIngredient,
} from "$lib/utils/food/types";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import type { FoodPreferenceWarningEvidence } from "$lib/utils/profile/foodPreferenceWarnings";

const percentFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 2,
});

const toPercent = (value: number | undefined) =>
	Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 100
		? Number(value)
		: null;

const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;

const getPercentageLabel = (ingredient: FoodStructuredIngredient) => {
	const exact = toPercent(ingredient.percent);
	if (exact !== null) return formatPercent(exact);
	const estimate = toPercent(ingredient.percentEstimate);
	if (estimate !== null) return `About ${formatPercent(estimate)}`;
	const minimum = toPercent(ingredient.percentMin);
	const maximum = toPercent(ingredient.percentMax);
	if (minimum !== null && maximum !== null) {
		return `${formatPercent(minimum)}–${formatPercent(maximum)}`;
	}
	if (minimum !== null) return `at least ${formatPercent(minimum)}`;
	if (maximum !== null) return `up to ${formatPercent(maximum)}`;
	return null;
};

const getClassifications = (
	ingredient: FoodStructuredIngredient,
): FoodIngredientPresentationClassification[] => ([
	["Vegan", ingredient.vegan],
	["Vegetarian", ingredient.vegetarian],
] as const).flatMap(([label, value]) => {
	const formatted = value ? formatFoodMetadataTag(value) : "";
	return formatted ? [{ label, value: formatted }] : [];
});

const flattenIngredients = (
	ingredients: FoodStructuredIngredient[],
	parentPath: string[] = [],
	depth = 0,
): FoodIngredientPresentationRow[] => ingredients.flatMap((ingredient) => {
	const text = ingredient.text?.trim() || formatFoodMetadataTag(ingredient.id ?? "");
	const path = text ? [...parentPath, text] : parentPath;
	const row = text
		? [{
			text,
			depth: Math.min(depth, 3),
			path,
			percentageLabel: getPercentageLabel(ingredient),
			classifications: getClassifications(ingredient),
		}]
		: [];
	return [
		...row,
		...flattenIngredients(ingredient.ingredients ?? [], path, depth + 1),
	];
});

const getMetric = (
	label: string,
	value: number | undefined,
): FoodIngredientPresentationMetric[] => {
	const percent = toPercent(value);
	return percent === null ? [] : [{ label, value: formatPercent(percent) }];
};

export const buildFoodIngredientPresentation = (
	food: FoodItem,
): FoodIngredientPresentation | undefined => {
	const ingredientText = food.ingredients?.trim() ||
		(food.ingredientList ?? [])
			.map((ingredient) => ingredient.trim())
			.filter(Boolean)
			.join(", ") ||
		null;
	const rows = flattenIngredients(food.structuredIngredients ?? []);
	const additives = getUniqueFoodMetadataTags(food.additives ?? []);
	const analysis = food.ingredientAnalysis;
	const metrics = analysis
		? [
			...getMetric("Source analysis coverage", analysis.percentAnalysis),
			...getMetric("Known ingredient percentages", analysis.percentKnown),
			...getMetric("Estimated ingredient percentages", analysis.percentEstimate),
			...getMetric("Unknown ingredient percentages", analysis.percentUnknown),
		]
		: [];
	const tagGroups = analysis
		? [
			{ label: "Ingredient tags", values: getUniqueFoodMetadataTags(analysis.ingredientTags) },
			{ label: "Source analysis", values: getUniqueFoodMetadataTags(analysis.analysisTags) },
			{ label: "Source trace analysis", values: getUniqueFoodMetadataTags(analysis.derivedTraceTags) },
		].filter((group) => group.values.length > 0)
		: [];
	const hasSourceAnalysis = metrics.length > 0 ||
		tagGroups.length > 0 ||
		rows.some((row) => row.classifications.length > 0);

	if (!ingredientText && rows.length === 0 && additives.length === 0 && !hasSourceAnalysis) {
		return undefined;
	}
	return {
		ingredientText,
		rows,
		additives,
		metrics,
		tagGroups,
		hasSourceAnalysis,
	};
};

const normalizeEvidence = (value: string) => value
	.normalize("NFKD")
	.replace(/[\u0300-\u036f]/g, "")
	.toLocaleLowerCase("en-US")
	.trim()
	.replace(/[^a-z0-9]+/g, " ")
	.replace(/\s+/g, " ")
	.trim();

export const buildFoodPreferenceWarningEvidence = (
	fact: FoodCompatibilityFact,
	policyVersion: number,
	presentation: FoodIngredientPresentation | undefined,
): FoodPreferenceWarningEvidence => {
	const sourceText = fact.sourceText?.trim() || fact.label.trim();
	const normalizedSourceText = normalizeEvidence(sourceText);
	const matchingIngredient = presentation?.rows.find((row) =>
		normalizeEvidence(row.text) === normalizedSourceText
	);
	return {
		factType: fact.factType,
		sourceType: fact.sourceType,
		sourceText,
		confidence: fact.confidence,
		policyVersion,
		ingredientPath: matchingIngredient?.path ?? [],
		percentageLabel: matchingIngredient?.percentageLabel ?? null,
	};
};
