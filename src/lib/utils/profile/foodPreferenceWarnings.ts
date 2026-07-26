import type {
	FoodCompatibilityFact,
	FoodCompatibilityFactType,
} from "$lib/utils/food/quality/compatibility";
import type { FdcFood } from "$lib/utils/food/types";
import type { FoodPreferenceProfile } from "./foodPreferenceProfile";
import { getRuleDerivedCompatibilityFacts } from "./foodCompatibilityRuleMatching";

export type FoodPreferenceWarningLevel = "warning" | "potential";

export type FoodPreferenceWarning = {
	id: string;
	level: FoodPreferenceWarningLevel;
	category: "allergen" | "restriction";
	label: string;
	reason: string;
};

export const FOOD_PREFERENCE_WARNING_TITLE = "Check this ingredient";

const normalizeValue = (value: string) =>
	value
		.toLocaleLowerCase()
		.trim()
		.replace(/^[a-z]{2}:/i, "")
		.replace(/-/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const normalizeKey = (value: string) => normalizeValue(value).replace(/\s+/g, "-");

const createStructuredFact = (
	value: string,
	factType: FoodCompatibilityFactType,
	category: FoodCompatibilityFact["category"],
): FoodCompatibilityFact => ({
	slug: normalizeKey(value),
	label: value.trim(),
	category,
	factType,
	sourceType: factType === "may_contain"
		? "label_trace_field"
		: factType === "dietary_claim"
			? "label_dietary_field"
			: "label_allergen_field",
	sourceText: value,
	confidence: "confirmed",
});

const getCompatibilityFacts = (
	food: FdcFood,
	profile: FoodPreferenceProfile,
) => {
	const facts = [
		...(food.compatibilitySummary?.allFacts ?? []),
		...(food.allergens ?? []).map((value) =>
			createStructuredFact(value, "contains", "allergen")
		),
		...(food.traces ?? []).map((value) =>
			createStructuredFact(value, "may_contain", "allergen")
		),
		...[...(food.dietaryTags ?? []), ...(food.labels ?? [])].map((value) =>
			createStructuredFact(value, "dietary_claim", "dietary")
		),
		...getRuleDerivedCompatibilityFacts(food, profile.matchRules),
	];
	const uniqueFacts = new Map(
		facts.map((fact) => [
			`${normalizeKey(fact.slug)}:${fact.factType}:${normalizeValue(fact.sourceText ?? "")}`,
			fact,
		]),
	);
	return [...uniqueFacts.values()];
};

const factMatches = (fact: FoodCompatibilityFact, value: string) => {
	const normalized = normalizeValue(value);
	return [fact.slug, fact.label, fact.sourceText]
		.some((candidate) =>
			typeof candidate === "string" && normalizeValue(candidate) === normalized
		);
};

const summarizeFactReason = (fact: FoodCompatibilityFact) => {
	if (fact.factType === "contains") {
		return `The label lists ${fact.label.toLocaleLowerCase()} as an allergen.`;
	}
	if (fact.factType === "may_contain") {
		return `The label says this product may contain ${fact.label.toLocaleLowerCase()}.`;
	}
	if (fact.factType === "ingredient_present") {
		return fact.sourceType === "source_food_identity"
			? fact.confidence === "confirmed"
				? `This food is identified as ${fact.label.toLocaleLowerCase()}.`
				: `The food name suggests ${fact.label.toLocaleLowerCase()} may be present.`
			: `${fact.label} appears in the ingredient list.`;
	}
	return `The label includes a ${fact.label.toLocaleLowerCase()} claim.`;
};

const summarizeRestrictionReason = (
	restriction: string,
	fact: FoodCompatibilityFact,
) => {
	const normalizedRestriction = restriction.toLocaleLowerCase();
	const normalizedFact = fact.label.toLocaleLowerCase();

	if (fact.factType === "contains") {
		return `This may not be ${normalizedRestriction} because the label lists ${normalizedFact} as an allergen.`;
	}
	if (fact.factType === "may_contain") {
		return `This may not be ${normalizedRestriction} because the label says it may contain ${normalizedFact}.`;
	}
	if (fact.sourceType === "source_food_identity") {
		return fact.confidence === "confirmed"
			? `This may not be ${normalizedRestriction} because this food is identified as ${normalizedFact}.`
			: `This may not be ${normalizedRestriction} because the food name suggests ${normalizedFact} may be present.`;
	}
	return `This may not be ${normalizedRestriction} because ${normalizedFact} appears in the ingredient list.`;
};

const buildWarning = (
	id: string,
	level: FoodPreferenceWarningLevel,
	category: FoodPreferenceWarning["category"],
	label: string,
	reason: string,
): FoodPreferenceWarning => ({ id, level, category, label, reason });

const getConflictFact = (
	preference: string,
	facts: FoodCompatibilityFact[],
	profile: FoodPreferenceProfile,
) => {
	const matchingRules = (profile.warningRules ?? []).filter((rule) =>
		normalizeValue(rule.preferenceSlug) === normalizeValue(preference) ||
		normalizeValue(rule.preferenceLabel) === normalizeValue(preference)
	);
	for (const rule of matchingRules) {
		const fact = facts.find((candidate) =>
			["contains", "may_contain", "ingredient_present"].includes(
				candidate.factType,
			) &&
			(
				normalizeValue(candidate.slug) === normalizeValue(rule.factSlug) ||
				normalizeValue(candidate.label) === normalizeValue(rule.factLabel)
			)
		);
		if (fact) return { fact, level: rule.level };
	}
	return null;
};

export const getFoodPreferenceWarnings = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
): FoodPreferenceWarning[] => {
	if (!profile) return [];

	const warnings: FoodPreferenceWarning[] = [];
	const facts = getCompatibilityFacts(food, profile);

	for (const allergen of profile.allergens) {
		const directFact = facts.find((fact) =>
			(fact.factType === "contains" || fact.factType === "may_contain") &&
			factMatches(fact, allergen)
		);
		const relatedFact = directFact
			? null
			: getConflictFact(allergen, facts, profile);
		const fact = directFact ?? relatedFact?.fact;
		if (!fact) continue;
		const level = fact.factType === "may_contain" ||
				fact.confidence !== "confirmed"
			? "potential"
			: relatedFact?.level ?? "warning";
		warnings.push(
			buildWarning(
				`allergen-${normalizeKey(allergen)}-${normalizeKey(fact.slug)}-${fact.factType}`,
				level,
				"allergen",
				allergen,
				summarizeFactReason(fact),
			),
		);
	}

	for (const restriction of profile.dietaryRestrictions) {
		const matchingClaim = facts.find((fact) =>
			(fact.factType === "dietary_claim" || fact.factType === "free_from") &&
			factMatches(fact, restriction)
		);
		if (matchingClaim) continue;

		const conflict = getConflictFact(restriction, facts, profile);
		if (!conflict) continue;
		warnings.push(
			buildWarning(
				`restriction-${normalizeKey(restriction)}-${normalizeKey(conflict.fact.slug)}`,
				conflict.fact.factType === "may_contain" ||
						conflict.fact.confidence !== "confirmed"
					? "potential"
					: conflict.level,
					"restriction",
					restriction,
					summarizeRestrictionReason(restriction, conflict.fact),
				),
			);
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
	return getFoodPreferenceWarnings(food, profile).reduce(
		(total, warning) => total + (warning.level === "warning" ? 6 : 3),
		0,
	);
};

export const getFoodWarningLabel = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
) => {
	const warnings =
		food.preferenceWarnings ?? getFoodPreferenceWarnings(food, profile);
	return warnings.length === 0 ? null : "⚠";
};
