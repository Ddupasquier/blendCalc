import type { FdcFood } from "$lib/utils/food/types";
import type { FoodCompatibilityFact } from "$lib/utils/food/compatibility";
import type { FoodPreferenceProfile } from "./foodPreferenceProfile";

export type FoodPreferenceWarningLevel = "warning" | "potential";

export type FoodPreferenceWarning = {
	id: string;
	level: FoodPreferenceWarningLevel;
	category: "allergen" | "restriction" | "avoid";
	label: string;
	reason: string;
};

const normalizeValue = (value: string) =>
	value
		.toLocaleLowerCase()
		.trim()
		.replace(/\s+/g, " ");

const getCompatibilityFacts = (food: FdcFood): FoodCompatibilityFact[] =>
	food.compatibilitySummary?.allFacts ?? [];

const summarizeFactReason = (fact: FoodCompatibilityFact) => {
	if (fact.factType === "contains") {
		return `Contains ${fact.label.toLowerCase()} from product metadata.`;
	}
	if (fact.factType === "may_contain") {
		return `May contain ${fact.label.toLowerCase()} from product metadata.`;
	}
	if (fact.factType === "dietary_claim") {
		return `Carries a ${fact.label} claim in product metadata.`;
	}
	if (fact.factType === "free_from") {
		return `Marked ${fact.label.toLowerCase()}-free in product metadata.`;
	}
	return `Matched ${fact.label.toLowerCase()} in product metadata.`;
};

const buildWarning = (
	id: string,
	level: FoodPreferenceWarningLevel,
	category: FoodPreferenceWarning["category"],
	label: string,
	reason: string,
): FoodPreferenceWarning => ({
	id,
	level,
	category,
	label,
	reason,
});

type FoodStructuredValues = {
	allergens: Set<string>;
	traces: Set<string>;
	dietaryClaims: Set<string>;
	ingredients: Set<string>;
	general: Set<string>;
};

const addValuesToSet = (target: Set<string>, values: Array<string | null | undefined>) => {
	for (const value of values) {
		if (typeof value !== "string") continue;
		const normalized = normalizeValue(value);
		if (normalized) target.add(normalized);
	}
};

const getStructuredValues = (food: FdcFood): FoodStructuredValues => {
	const allergens = new Set<string>();
	const traces = new Set<string>();
	const dietaryClaims = new Set<string>();
	const ingredients = new Set<string>();
	const general = new Set<string>();

	addValuesToSet(allergens, food.allergens ?? []);
	addValuesToSet(traces, food.traces ?? []);
	addValuesToSet(dietaryClaims, [
		...(food.dietaryTags ?? []),
		...(food.labels ?? []),
		...(food.categories ?? []),
	]);
	addValuesToSet(ingredients, food.ingredientList ?? []);
	addValuesToSet(general, [food.description, food.brandOwner, food.foodCategory]);

	return { allergens, traces, dietaryClaims, ingredients, general };
};

const factMatchesValue = (fact: FoodCompatibilityFact, value: string) => {
	const normalized = normalizeValue(value);
	if (!normalized) return false;

	return [fact.slug, fact.label, fact.sourceText]
		.filter((candidate): candidate is string => typeof candidate === "string")
		.some((candidate) => normalizeValue(candidate) === normalized);
};

const exactSetMatch = (values: Set<string>, value: string) => {
	const normalized = normalizeValue(value);
	return normalized ? values.has(normalized) : false;
};

export const getFoodPreferenceWarnings = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
): FoodPreferenceWarning[] => {
	if (!profile) return [];

	const warnings: FoodPreferenceWarning[] = [];
	const structuredValues = getStructuredValues(food);
	const compatibilityFacts = getCompatibilityFacts(food);

	for (const allergen of profile.allergens) {
		const summaryFact = compatibilityFacts.find(
			(fact) =>
				factMatchesValue(fact, allergen) &&
				(fact.factType === "contains" || fact.factType === "may_contain"),
		);
		if (summaryFact) {
			warnings.push(
				buildWarning(
					`summary-allergen-${normalizeValue(allergen)}-${summaryFact.factType}`,
					summaryFact.factType === "may_contain" ? "potential" : "warning",
					"allergen",
					allergen,
					summarizeFactReason(summaryFact),
				),
			);
			continue;
		}

		if (exactSetMatch(structuredValues.allergens, allergen)) {
			warnings.push(
				buildWarning(
					`allergen-${normalizeValue(allergen)}`,
					"warning",
					"allergen",
					allergen,
					`Lists ${allergen} in allergen metadata.`,
				),
			);
			continue;
		}

		if (exactSetMatch(structuredValues.traces, allergen)) {
			warnings.push(
				buildWarning(
					`trace-${normalizeValue(allergen)}`,
					"potential",
					"allergen",
					allergen,
					`Lists ${allergen} in trace metadata.`,
				),
			);
		}
	}

	for (const restriction of profile.dietaryRestrictions) {
		const safeSummaryFact = compatibilityFacts.find(
			(fact) => fact.factType === "dietary_claim" && factMatchesValue(fact, restriction),
		);
		if (safeSummaryFact || exactSetMatch(structuredValues.dietaryClaims, restriction)) {
			continue;
		}
	}

	for (const item of profile.ingredientsToAvoid) {
		const summaryFact = compatibilityFacts.find(
			(fact) =>
				factMatchesValue(fact, item) &&
				(fact.factType === "contains" || fact.factType === "may_contain"),
		);
		if (summaryFact) {
			warnings.push(
				buildWarning(
					`avoid-summary-${normalizeValue(item)}-${summaryFact.factType}`,
					summaryFact.factType === "may_contain" ? "potential" : "warning",
					"avoid",
					item,
					summarizeFactReason(summaryFact),
				),
			);
			continue;
		}

		if (exactSetMatch(structuredValues.ingredients, item)) {
			warnings.push(
				buildWarning(
					`avoid-ingredient-${normalizeValue(item)}`,
					"warning",
					"avoid",
					item,
					`Lists ${item} in ingredient metadata.`,
				),
			);
			continue;
		}

		if (exactSetMatch(structuredValues.allergens, item)) {
			warnings.push(
				buildWarning(
					`avoid-allergen-${normalizeValue(item)}`,
					"warning",
					"avoid",
					item,
					`Lists ${item} in allergen metadata.`,
				),
			);
			continue;
		}

		if (exactSetMatch(structuredValues.traces, item)) {
			warnings.push(
				buildWarning(
					`avoid-trace-${normalizeValue(item)}`,
					"potential",
					"avoid",
					item,
					`Lists ${item} in trace metadata.`,
				),
			);
		}
	}

	return warnings;
};

export const annotateFoodWithPreferenceWarnings = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
): FdcFood => {
	const preferenceWarnings = getFoodPreferenceWarnings(food, profile);
	if (preferenceWarnings.length === 0) return food;
	return { ...food, preferenceWarnings };
};

export const getFoodDownrankScore = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
): number => {
	if (!profile) return 0;

	const warningPenalty = getFoodPreferenceWarnings(food, profile).reduce(
		(total, warning) => total + (warning.level === "warning" ? 6 : 3),
		0,
	);
	const structuredValues = getStructuredValues(food);
	const compatibilityFacts = getCompatibilityFacts(food);
	const dislikePenalty = profile.dislikes.reduce((total, dislike) => {
		const hasStructuredMatch =
			exactSetMatch(structuredValues.ingredients, dislike) ||
			exactSetMatch(structuredValues.general, dislike) ||
			compatibilityFacts.some((fact) => factMatchesValue(fact, dislike));

		return total + (hasStructuredMatch ? 2 : 0);
	}, 0);

	return warningPenalty + dislikePenalty;
};

export const getFoodWarningLabel = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
) => {
	const warnings = food.preferenceWarnings ?? getFoodPreferenceWarnings(food, profile);
	if (warnings.length === 0) return null;
	return "⚠";
};
