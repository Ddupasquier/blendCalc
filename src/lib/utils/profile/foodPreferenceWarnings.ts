import type { FdcFood } from "$lib/utils/food/types";
import type { FoodCompatibilityFact } from "$lib/utils/food/compatibility";
import type { FoodPreferenceProfile } from "./foodPreferenceProfile";

export type FoodPreferenceWarningLevel = "warning" | "potential";

export type FoodPreferenceWarning = {
	id: string;
	level: FoodPreferenceWarningLevel;
	category: "allergen" | "restriction";
	label: string;
	reason: string;
};

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

const ALLERGEN_TERMS: Record<string, string[]> = {
	celery: ["celery"],
	dairy: [
		"butter",
		"casein",
		"cheese",
		"cream",
		"dairy",
		"ghee",
		"lactose",
		"milk",
		"nonfat milk",
		"whey",
		"yogurt",
	],
	egg: ["albumen", "egg", "eggs", "mayonnaise"],
	fish: ["anchovy", "cod", "fish", "salmon", "tuna"],
	gluten: ["barley", "durum wheat", "gluten", "malt", "rye", "semolina", "wheat"],
	lupin: ["lupin"],
	milk: [
		"butter",
		"casein",
		"cheese",
		"cream",
		"dairy",
		"ghee",
		"lactose",
		"milk",
		"nonfat milk",
		"whey",
		"yogurt",
	],
	mustard: ["mustard"],
	peanut: ["peanut", "peanuts"],
	sesame: ["sesame", "sesame seeds"],
	shellfish: ["crab", "crustaceans", "lobster", "shellfish", "shrimp"],
	soy: ["soy", "soybean", "soybeans"],
	"tree-nut": [
		"almond",
		"almonds",
		"cashew",
		"hazelnut",
		"nut",
		"nuts",
		"pecan",
		"pecans",
		"pistachio",
		"tree nut",
		"tree nuts",
		"walnut",
		"walnuts",
	],
	wheat: ["barley", "durum wheat", "gluten", "malt", "rye", "semolina", "wheat"],
};

const RESTRICTION_CONFLICT_TERMS: Record<string, string[]> = {
	"dairy-free": ALLERGEN_TERMS.dairy,
	"egg-free": ALLERGEN_TERMS.egg,
	"gluten-free": ALLERGEN_TERMS.gluten,
	halal: ["alcohol", "bacon", "gelatin", "ham", "lard", "pork", "wine"],
	kosher: ["bacon", "crab", "gelatin", "ham", "lard", "lobster", "pork", "shellfish", "shrimp"],
	"nut-free": [...ALLERGEN_TERMS.peanut, ...ALLERGEN_TERMS["tree-nut"]],
	"soy-free": ALLERGEN_TERMS.soy,
	vegan: [
		...ALLERGEN_TERMS.dairy,
		...ALLERGEN_TERMS.egg,
		...ALLERGEN_TERMS.fish,
		...ALLERGEN_TERMS.shellfish,
		"beef",
		"chicken",
		"collagen",
		"confectioner s glaze",
		"gelatin",
		"honey",
		"lamb",
		"lard",
		"pork",
		"shellac",
		"turkey",
	],
	vegetarian: [
		...ALLERGEN_TERMS.fish,
		...ALLERGEN_TERMS.shellfish,
		"beef",
		"chicken",
		"collagen",
		"gelatin",
		"lamb",
		"lard",
		"pork",
		"turkey",
	],
};

const getTermAliases = (value: string, aliasMap: Record<string, string[]>) => {
	const key = normalizeKey(value);
	const normalized = normalizeValue(value);
	return [...new Set([normalized, key, ...(aliasMap[key] ?? [])].map(normalizeValue))].filter(Boolean);
};

const PLANT_MILK_PATTERN =
	/\b(almond|cashew|coconut|flax|hazelnut|hemp|macadamia|oat|pea|pistachio|rice|soy)\s+milk\b/g;

const getComparableText = (text: string, term: string) => {
	const normalizedText = ` ${normalizeValue(text)} `;
	const normalizedTerm = normalizeValue(term);

	if (normalizedTerm === "milk") {
		return normalizedText.replace(PLANT_MILK_PATTERN, " ");
	}

	return normalizedText;
};

const hasExactTerm = (values: Set<string>, terms: string[]) =>
	terms.some((term) => values.has(normalizeValue(term)));

const hasTextTerm = (text: string, terms: string[]) => {
	return terms.some((term) => {
		const normalizedTerm = normalizeValue(term);
		if (!normalizedTerm) return false;
		return getComparableText(text, normalizedTerm).includes(` ${normalizedTerm} `);
	});
};

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
	ingredientText: string;
	generalText: string;
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
	const ingredientText = [food.ingredients, ...(food.ingredientList ?? [])]
		.filter((value): value is string => typeof value === "string")
		.join(" ");
	const generalText = [food.description, food.brandOwner, food.foodCategory]
		.filter((value): value is string => typeof value === "string")
		.join(" ");

	addValuesToSet(allergens, food.allergens ?? []);
	addValuesToSet(traces, food.traces ?? []);
	addValuesToSet(dietaryClaims, [
		...(food.dietaryTags ?? []),
		...(food.labels ?? []),
		...(food.categories ?? []),
	]);
	addValuesToSet(ingredients, food.ingredientList ?? []);
	addValuesToSet(general, [food.description, food.brandOwner, food.foodCategory]);

	return {
		allergens,
		traces,
		dietaryClaims,
		ingredients,
		general,
		ingredientText,
		generalText,
	};
};

const factMatchesValue = (fact: FoodCompatibilityFact, value: string) => {
	const aliases = getTermAliases(value, ALLERGEN_TERMS);
	if (aliases.length === 0) return false;

	return [fact.slug, fact.label, fact.sourceText]
		.filter((candidate): candidate is string => typeof candidate === "string")
		.some((candidate) => aliases.includes(normalizeValue(candidate)));
};

const exactSetMatch = (values: Set<string>, value: string) => {
	const aliases = getTermAliases(value, ALLERGEN_TERMS);
	return aliases.length ? hasExactTerm(values, aliases) : false;
};

const getRestrictionConflict = (
	restriction: string,
	structuredValues: FoodStructuredValues,
	compatibilityFacts: FoodCompatibilityFact[],
) => {
	const restrictionKey = normalizeKey(restriction);
	const conflictTerms = RESTRICTION_CONFLICT_TERMS[restrictionKey] ?? [];
	if (conflictTerms.length === 0) return null;

	const conflictingFact = compatibilityFacts.find(
		(fact) =>
			(fact.factType === "contains" || fact.factType === "ingredient_present") &&
			hasTextTerm([fact.slug, fact.label, fact.sourceText].filter(Boolean).join(" "), conflictTerms),
	);
	if (conflictingFact) {
		return {
			level: "warning" as const,
			reason: `${restriction} conflict: ${summarizeFactReason(conflictingFact)}`,
		};
	}

	if (
		hasExactTerm(structuredValues.allergens, conflictTerms) ||
		hasExactTerm(structuredValues.ingredients, conflictTerms) ||
		hasTextTerm(structuredValues.ingredientText, conflictTerms)
	) {
		return {
			level: "warning" as const,
			reason: `${restriction} conflict: this food lists ${restriction.toLowerCase()}-conflicting ingredients.`,
		};
	}

	if (hasTextTerm(structuredValues.generalText, conflictTerms)) {
		return {
			level: "potential" as const,
			reason: `${restriction} may conflict based on the food name or category.`,
		};
	}

	return null;
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
		const allergenTerms = getTermAliases(allergen, ALLERGEN_TERMS);
		const summaryFact = compatibilityFacts.find(
			(fact) =>
				(factMatchesValue(fact, allergen) ||
					hasTextTerm(
						[fact.slug, fact.label, fact.sourceText].filter(Boolean).join(" "),
						allergenTerms,
					)) &&
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
			continue;
		}

		if (
			hasExactTerm(structuredValues.ingredients, allergenTerms) ||
			hasTextTerm(structuredValues.ingredientText, allergenTerms)
		) {
			warnings.push(
				buildWarning(
					`ingredient-allergen-${normalizeKey(allergen)}`,
					"warning",
					"allergen",
					allergen,
					`Lists ${allergen} or a related term in ingredients.`,
				),
			);
			continue;
		}

		if (hasTextTerm(structuredValues.generalText, allergenTerms)) {
			warnings.push(
				buildWarning(
					`general-allergen-${normalizeKey(allergen)}`,
					"potential",
					"allergen",
					allergen,
					`${allergen} may be present based on the food name or category.`,
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

		const conflict = getRestrictionConflict(
			restriction,
			structuredValues,
			compatibilityFacts,
		);
		if (conflict) {
			warnings.push(
				buildWarning(
					`restriction-${normalizeKey(restriction)}`,
					conflict.level,
					"restriction",
					restriction,
					conflict.reason,
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

	return getFoodPreferenceWarnings(food, profile).reduce(
		(total, warning) => total + (warning.level === "warning" ? 6 : 3),
		0,
	);
};

export const getFoodWarningLabel = (
	food: FdcFood,
	profile: FoodPreferenceProfile | null | undefined,
) => {
	const warnings = food.preferenceWarnings ?? getFoodPreferenceWarnings(food, profile);
	if (warnings.length === 0) return null;
	return "⚠";
};
