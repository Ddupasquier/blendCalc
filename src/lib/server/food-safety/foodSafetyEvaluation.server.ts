import type {
	FoodCompatibilityFact,
	FoodCompatibilityFactType,
	FoodCompatibilityPreferenceResolutionContext,
	FoodCompatibilityRegulatoryContext,
	FoodCompatibilitySummary,
} from "$lib/utils/food/quality/compatibility";
import { getFoodCompatibilityEvaluation } from "$lib/utils/food/quality/foodCompatibilityEvaluation";
import {
	buildFoodIngredientPresentation,
	buildFoodPreferenceWarningEvidence,
} from "./foodIngredientPresentation.server";
import {
	getAuthoritativeGenericFoodIdentity,
	isAuthoritativeGenericFood,
	resolveFoodIdentityType,
} from "$lib/utils/food/identity/foodIdentity";
import type { FoodItem, FoodAllergenDisclosure } from "$lib/utils/food/types";
import {
	getResolvedFoodPreferences,
	getUnresolvedFoodPreferences,
	type FoodPreferenceProfile,
	type FoodPreferenceResolution,
} from "$lib/utils/profile/foodPreferenceProfile";
import type {
	FoodCompatibilityMatchRule,
	FoodCompatibilityIngredientAlias,
	FoodSafetyPolicy,
} from "./foodSafetyPolicy.server";
import type {
	FoodPreferenceWarning,
	FoodPreferenceWarningLevel,
} from "$lib/utils/profile/foodPreferenceWarnings";
import type { AppIssueCode, AppIssueParams } from "$lib/utils/errors/appIssues";

const normalizeValue = (value: string) =>
	value
		.replace(/^[a-z]{2,3}(?:-[A-Z]{2})?:/i, "")
		.replace(/œ/gi, "oe")
		.replace(/æ/gi, "ae")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.trim()
		.replace(/-/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const normalizeKey = (value: string) =>
	normalizeValue(value).replace(/\s+/g, "-");

const createStructuredFact = (
	value: string,
	factType: FoodCompatibilityFactType,
	category: FoodCompatibilityFact["category"],
): FoodCompatibilityFact => ({
	slug: normalizeKey(value),
	label: value.trim(),
	category,
	factType,
	sourceType:
		factType === "may_contain"
			? "label_trace_field"
			: factType === "dietary_claim"
				? "label_dietary_field"
				: "label_allergen_field",
	sourceText: value,
	confidence: "confirmed",
});

const getPrimaryLanguageCode = (value: string | null | undefined) =>
	value?.trim().toLowerCase().split("-")[0] ?? "";

const getValueLanguageCode = (value: string) =>
	getPrimaryLanguageCode(
		/^([a-z]{2,3}(?:-[A-Z]{2})?):/i.exec(value.trim())?.[1],
	);

const getFoodLanguageCodes = (food: FoodItem) => [
	...new Set(
		[food.sourceMetadata?.language, ...(food.sourceMetadata?.languages ?? [])]
			.map(getPrimaryLanguageCode)
			.filter(Boolean),
	),
];

const aliasMatchesLanguage = (
	alias: FoodCompatibilityIngredientAlias,
	valueLanguage: string,
	foodLanguages: string[],
) => {
	const aliasLanguage = getPrimaryLanguageCode(alias.languageCode);
	if (!aliasLanguage) return true;
	if (valueLanguage) return aliasLanguage === valueLanguage;
	if (foodLanguages.length > 0) return foodLanguages.includes(aliasLanguage);
	return true;
};

const getAliasDerivedFacts = (
	food: FoodItem,
	policy: FoodSafetyPolicy,
): FoodCompatibilityFact[] => {
	const foodLanguages = getFoodLanguageCodes(food);
	const aliases = policy.ingredientAliases.filter(
		(alias) => alias.preferenceRuleType === "allergen",
	);
	const getMatches = (
		value: string,
		factType: "contains" | "may_contain" | "ingredient_present",
		sourceType:
			"label_allergen_field" | "label_trace_field" | "label_ingredient_field",
		requireExact: boolean,
		sourceText = value,
	) => {
		const normalizedValue = normalizeValue(value);
		if (!normalizedValue) return [];
		const paddedValue = ` ${normalizedValue} `;
		const valueLanguage = getValueLanguageCode(value);
		const matches = aliases.flatMap((alias) => {
			if (!aliasMatchesLanguage(alias, valueLanguage, foodLanguages)) return [];
			const normalizedAlias = normalizeValue(alias.normalizedAlias);
			const matchesAlias = requireExact
				? normalizedValue === normalizedAlias
				: paddedValue.includes(` ${normalizedAlias} `);
			if (!matchesAlias) return [];
			return [{ alias, normalizedAlias }];
		});
		const longestAliasLength = Math.max(
			0,
			...matches.map((match) => match.normalizedAlias.length),
		);
		return matches
			.filter(
				(match) =>
					requireExact || match.normalizedAlias.length === longestAliasLength,
			)
			.map(({ alias }) => ({
				slug: alias.tagSlug,
				label: alias.tagLabel,
				category: alias.tagCategory,
				factType,
				sourceType,
				sourceText: sourceText.trim(),
				confidence: "confirmed" as const,
			}));
	};

	const structuredIngredientTexts: string[] = [];
	const visitStructuredIngredients = (
		ingredients: NonNullable<FoodItem["structuredIngredients"]>,
	) => {
		for (const ingredient of ingredients) {
			const value = ingredient.text?.trim() || ingredient.id?.trim();
			if (value) structuredIngredientTexts.push(value);
			if (ingredient.ingredients?.length) {
				visitStructuredIngredients(ingredient.ingredients);
			}
		}
	};
	visitStructuredIngredients(food.structuredIngredients ?? []);
	const allergenDeclarationStatements =
		food.ingredientAnalysis?.allergenDeclarationAnalysis?.statements ?? [];

	return [
		...(food.allergens ?? []).flatMap((value) =>
			getMatches(value, "contains", "label_allergen_field", true),
		),
		...(food.traces ?? []).flatMap((value) =>
			getMatches(value, "may_contain", "label_trace_field", true),
		),
		...[...(food.ingredientList ?? []), ...structuredIngredientTexts].flatMap(
			(value) =>
				getMatches(
					value,
					"ingredient_present",
					"label_ingredient_field",
					false,
				),
		),
		...allergenDeclarationStatements.flatMap((statement) =>
			statement.allergens.flatMap((allergen) =>
				getMatches(
					allergen,
					statement.type === "contains" ? "contains" : "may_contain",
					"label_ingredient_field",
					true,
					statement.text,
				),
			),
		),
	];
};

const getDietaryClaimFacts = (food: FoodItem, policy: FoodSafetyPolicy) => {
	const dietaryClaims = new Map(
		policy.preferenceConflictRules
			.filter((rule) => rule.preferenceCategory === "dietary")
			.flatMap((rule) => [
				[normalizeValue(rule.preferenceSlug), rule.preferenceLabel],
				[normalizeValue(rule.preferenceLabel), rule.preferenceLabel],
			]),
	);

	return [...(food.dietaryTags ?? []), ...(food.labels ?? [])].flatMap(
		(value) => {
			const label = dietaryClaims.get(normalizeValue(value));
			return label
				? [createStructuredFact(label, "dietary_claim", "dietary")]
				: [];
		},
	);
};

const isCurrentCompatibilityFact = (fact: FoodCompatibilityFact) => {
	const sourceType = String(
		(fact as unknown as { sourceType?: unknown }).sourceType ?? "",
	);
	if (sourceType === "source_food_identity") return false;
	return (
		fact.factType !== "ingredient_present" ||
		sourceType === "label_ingredient_field"
	);
};

const getRuleFieldValue = (
	food: FoodItem,
	rule: FoodCompatibilityMatchRule,
) => {
	if (
		rule.fieldName === "generic_food_identity" &&
		rule.sourceType === "food_identity_taxonomy"
	) {
		return isAuthoritativeGenericFood(food)
			? getAuthoritativeGenericFoodIdentity(food)
			: "";
	}
	if (
		rule.fieldName === "ingredients" &&
		rule.sourceType === "label_ingredient_field"
	) {
		return food.ingredients ?? "";
	}
	if (
		rule.fieldName === "allergens" &&
		rule.sourceType === "label_allergen_field"
	) {
		return (food.allergens ?? []).join(" | ");
	}
	if (rule.fieldName === "traces" && rule.sourceType === "label_trace_field") {
		return (food.traces ?? []).join(" | ");
	}
	if (
		rule.fieldName === "ingredient_analysis" &&
		rule.sourceType === "source_dietary_analysis"
	) {
		return JSON.stringify({
			ingredientAnalysis: food.ingredientAnalysis ?? null,
			structuredIngredients: food.structuredIngredients ?? [],
		});
	}
	return "";
};

const matchesPattern = (value: string, pattern: string) => {
	try {
		return new RegExp(pattern, "i").exec(value);
	} catch {
		return null;
	}
};

const getRuleDerivedCompatibilityFacts = (
	food: FoodItem,
	rules: FoodCompatibilityMatchRule[],
): FoodCompatibilityFact[] =>
	[...rules]
		.sort((left, right) => left.priority - right.priority)
		.flatMap((rule) => {
			if (rule.sourceKey && rule.sourceKey !== food.sourceKey) return [];
			const sourceValue = getRuleFieldValue(food, rule);
			if (!sourceValue) return [];

			const match = matchesPattern(sourceValue, rule.matchPattern);
			if (
				!match ||
				(rule.excludePattern &&
					matchesPattern(sourceValue, rule.excludePattern))
			) {
				return [];
			}
			return [
				{
					slug: rule.tagSlug,
					label: rule.tagLabel,
					category: rule.tagCategory,
					factType: rule.factType,
					sourceType: rule.sourceType,
					sourceText: match[0],
					confidence: rule.confidence,
				},
			];
		});

const getCompatibilityFacts = (food: FoodItem, policy: FoodSafetyPolicy) => {
	const facts = [
		...(food.compatibilitySummary?.allFacts ?? []).filter(
			isCurrentCompatibilityFact,
		),
		...(food.allergens ?? []).map((value) =>
			createStructuredFact(value, "contains", "allergen"),
		),
		...(food.traces ?? []).map((value) =>
			createStructuredFact(value, "may_contain", "allergen"),
		),
		...getAliasDerivedFacts(food, policy),
		...getDietaryClaimFacts(food, policy),
		...getRuleDerivedCompatibilityFacts(food, policy.compatibilityMatchRules),
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
	return [fact.slug, fact.label, fact.sourceText].some(
		(candidate) =>
			typeof candidate === "string" && normalizeValue(candidate) === normalized,
	);
};

const getFactIssue = (
	fact: FoodCompatibilityFact,
): { code: AppIssueCode; params: AppIssueParams } => {
	const params = { factLabel: fact.label };
	if (fact.factType === "contains") {
		if (fact.sourceType === "food_identity_taxonomy") {
			return { code: "FOOD_INTRINSIC_ALLERGEN", params };
		}
		return { code: "FOOD_ALLERGEN_CONTAINS", params };
	}
	if (fact.factType === "may_contain") {
		return { code: "FOOD_ALLERGEN_MAY_CONTAIN", params };
	}
	return { code: "FOOD_INGREDIENT_PRESENT", params };
};

const getRestrictionEvidenceType = (fact: FoodCompatibilityFact) => {
	if (fact.factType === "contains" || fact.factType === "may_contain") {
		if (fact.sourceType === "food_identity_taxonomy") return "intrinsic";
		return fact.factType;
	}
	if (fact.sourceType === "source_dietary_analysis") return "source_analysis";
	if (fact.sourceType === "food_identity_taxonomy") return "intrinsic";
	return "ingredient";
};

const getRestrictionIssueParams = (
	restriction: string,
	fact: FoodCompatibilityFact,
): AppIssueParams => ({
	restrictionLabel: restriction,
	factLabel: fact.label,
	evidenceType: getRestrictionEvidenceType(fact),
});

const buildWarning = (
	id: string,
	level: FoodPreferenceWarningLevel,
	category: FoodPreferenceWarning["category"],
	label: string,
	code: AppIssueCode,
	params: AppIssueParams,
	evidence: FoodPreferenceWarning["evidence"],
): FoodPreferenceWarning => ({
	id,
	level,
	category,
	label,
	code,
	params,
	evidence,
});

const getConflictFact = (
	preference: string,
	facts: FoodCompatibilityFact[],
	policy: FoodSafetyPolicy,
) => {
	const matchingRules = policy.preferenceConflictRules
		.filter(
			(rule) =>
				normalizeValue(rule.preferenceSlug) === normalizeValue(preference) ||
				normalizeValue(rule.preferenceLabel) === normalizeValue(preference),
		)
		.sort((left, right) => left.priority - right.priority);
	for (const rule of matchingRules) {
		const fact = facts.find(
			(candidate) =>
				[
					"contains",
					"may_contain",
					"ingredient_present",
					"dietary_conflict",
				].includes(candidate.factType) &&
				(normalizeValue(candidate.slug) === normalizeValue(rule.factSlug) ||
					normalizeValue(candidate.label) === normalizeValue(rule.factLabel)),
		);
		if (fact) {
			return {
				fact,
				level: rule.level,
				warningCode: rule.warningCode,
			};
		}
	}
	return null;
};

const getFoodPreferenceWarnings = (
	facts: FoodCompatibilityFact[],
	profile: FoodPreferenceProfile | null,
	policy: FoodSafetyPolicy,
	ingredientPresentation: FoodItem["ingredientPresentation"],
): FoodPreferenceWarning[] => {
	if (!profile) return [];

	const warnings: FoodPreferenceWarning[] = [];
	for (const resolution of getResolvedFoodPreferences(profile, "allergen")) {
		const allergen = resolution.rawValue;
		const canonicalPreference = resolution.tag?.slug ?? "";
		const directFact = facts.find(
			(fact) =>
				fact.category === "allergen" &&
				["contains", "may_contain", "ingredient_present"].includes(
					fact.factType,
				) &&
				factMatches(fact, canonicalPreference),
		);
		const relatedFact = directFact
			? null
			: getConflictFact(canonicalPreference, facts, policy);
		const fact = directFact ?? relatedFact?.fact;
		if (!fact) continue;
		const level =
			fact.factType === "may_contain" || fact.confidence !== "confirmed"
				? "potential"
				: (relatedFact?.level ?? "warning");
		const issue = getFactIssue(fact);
		warnings.push(
			buildWarning(
				`allergen-${normalizeKey(allergen)}-${normalizeKey(fact.slug)}-${fact.factType}`,
				level,
				"allergen",
				allergen,
				issue.code,
				issue.params,
				buildFoodPreferenceWarningEvidence(
					fact,
					policy.version,
					ingredientPresentation,
				),
			),
		);
	}

	for (const resolution of getResolvedFoodPreferences(
		profile,
		"dietary_restriction",
	)) {
		const restriction = resolution.rawValue;
		const conflict = getConflictFact(resolution.tag?.slug ?? "", facts, policy);
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
				conflict.warningCode,
				getRestrictionIssueParams(restriction, conflict.fact),
				buildFoodPreferenceWarningEvidence(
					conflict.fact,
					policy.version,
					ingredientPresentation,
				),
			),
		);
	}

	return warnings;
};

const getActivePreferenceValues = (profile: FoodPreferenceProfile | null) =>
	getResolvedFoodPreferences(profile)
		.map((resolution) => resolution.tag?.slug.trim() ?? "")
		.filter(Boolean);

const getSavedPreferenceCount = (profile: FoodPreferenceProfile | null) =>
	profile
		? [...profile.allergens, ...profile.dietaryRestrictions]
				.map((value) => value.trim())
				.filter(Boolean).length
		: 0;

const getPreferenceResolutionContext = (
	profile: FoodPreferenceProfile | null,
): FoodCompatibilityPreferenceResolutionContext => {
	const resolvedPreferences = getResolvedFoodPreferences(profile);
	return {
		resolvedCount: resolvedPreferences.length,
		resolvedPreferences: resolvedPreferences.flatMap((resolution) =>
			resolution.tag
				? [
						{
							tagId: resolution.tag.id,
							tagSlug: resolution.tag.slug,
							label: resolution.tag.label,
							rawValue: resolution.rawValue,
							type: resolution.ruleType,
						},
					]
				: [],
		),
		unresolvedPreferences: getUnresolvedFoodPreferences(profile).map(
			(resolution) => ({
				label: resolution.rawValue,
				type: resolution.ruleType,
			}),
		),
	};
};

const policyCoversPreferences = (
	preferences: string[],
	policy: FoodSafetyPolicy,
) => {
	const coveredPreferences = new Set(
		policy.preferenceConflictRules.flatMap((rule) => [
			normalizeValue(rule.preferenceSlug),
			normalizeValue(rule.preferenceLabel),
		]),
	);
	return preferences.every((preference) =>
		coveredPreferences.has(normalizeValue(preference)),
	);
};

const policyCoversFoodLanguages = (
	food: FoodItem,
	policy: FoodSafetyPolicy,
) => {
	if (resolveFoodIdentityType(food) === "generic") return true;
	const languages = getFoodLanguageCodes(food);
	const hasIngredientLanguageSensitiveEvidence = Boolean(
		food.ingredients?.trim() ||
		food.ingredientList?.length ||
		food.structuredIngredients?.length,
	);
	if (languages.length === 0) return !hasIngredientLanguageSensitiveEvidence;
	const supportedLanguages = new Set(policy.supportedIngredientLanguages);
	return languages.every((language) => supportedLanguages.has(language));
};

const getRegionalProfileTagForPreference = (
	preference: FoodPreferenceResolution,
	policy: FoodSafetyPolicy,
	profile: FoodSafetyPolicy["regionalProfiles"][number],
) => {
	const normalizedPreference = normalizeValue(preference.tag?.slug ?? "");
	const directMatch = profile.tags.find((tag) =>
		[tag.slug, tag.label, tag.sourceLabel].some(
			(value) => normalizeValue(value) === normalizedPreference,
		),
	);
	if (directMatch) return directMatch;

	const relatedFactKeys = new Set(
		policy.preferenceConflictRules
			.filter(
				(rule) =>
					rule.preferenceCategory === "allergen" &&
					[rule.preferenceSlug, rule.preferenceLabel].some(
						(value) => normalizeValue(value) === normalizedPreference,
					),
			)
			.flatMap((rule) => [
				normalizeValue(rule.factSlug),
				normalizeValue(rule.factLabel),
			]),
	);

	return profile.tags.find(
		(tag) =>
			relatedFactKeys.has(normalizeValue(tag.slug)) ||
			relatedFactKeys.has(normalizeValue(tag.label)),
	);
};

export const getFoodCompatibilityRegulatoryContext = (
	profile: FoodPreferenceProfile | null,
	policy: FoodSafetyPolicy,
): FoodCompatibilityRegulatoryContext => {
	const requestedRegionCode = profile?.regulatoryRegionCode ?? null;
	const selectionSource = profile?.regulatoryRegionSource ?? null;
	if (!requestedRegionCode) {
		return {
			status: "not_selected",
			requestedRegionCode: null,
			selectionSource: null,
			profile: null,
			coveredPreferences: [],
			uncoveredPreferences: [],
		};
	}

	const regionalProfile = policy.regionalProfiles.find(
		(candidate) => candidate.regionCode === requestedRegionCode,
	);
	if (!regionalProfile) {
		return {
			status: "unsupported",
			requestedRegionCode,
			selectionSource,
			profile: null,
			coveredPreferences: [],
			uncoveredPreferences: getResolvedFoodPreferences(profile, "allergen").map(
				(resolution) => resolution.rawValue,
			),
		};
	}

	const coveredPreferences: FoodCompatibilityRegulatoryContext["coveredPreferences"] =
		[];
	const uncoveredPreferences: string[] = [];
	for (const preference of getResolvedFoodPreferences(profile, "allergen")) {
		const matchedTag = getRegionalProfileTagForPreference(
			preference,
			policy,
			regionalProfile,
		);
		if (!matchedTag) {
			uncoveredPreferences.push(preference.rawValue);
			continue;
		}
		coveredPreferences.push({
			preference: preference.rawValue,
			regulatedLabel: matchedTag.sourceLabel,
			classification: matchedTag.classification,
		});
	}

	return {
		status: "applied",
		requestedRegionCode,
		selectionSource,
		profile: {
			key: regionalProfile.key,
			regionCode: regionalProfile.regionCode,
			displayName: regionalProfile.displayName,
			authority: regionalProfile.authority,
			policyReference: regionalProfile.policyReference,
			sourceUrl: regionalProfile.sourceUrl,
			reviewedAt: regionalProfile.reviewedAt,
		},
		coveredPreferences,
		uncoveredPreferences,
	};
};

const formatAllergenLabel = (value: string) => {
	const normalized = value
		.trim()
		.replace(/^[a-z]{2}:/i, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ");
	return normalized
		? `${normalized.charAt(0).toLocaleUpperCase()}${normalized.slice(1)}`
		: "";
};

const getUniqueAllergenDisclosureEntries = (facts: FoodCompatibilityFact[]) => {
	const canonicalKeyBySource = new Map<string, string>();
	for (const fact of facts) {
		const sourceKey = normalizeKey(fact.sourceText || fact.label || fact.slug);
		const sourceSlug = normalizeKey(fact.sourceText || fact.label || fact.slug);
		const factSlug = normalizeKey(fact.slug);
		if (factSlug && factSlug !== sourceSlug) {
			canonicalKeyBySource.set(sourceKey, factSlug);
		}
	}

	const seen = new Set<string>();
	return facts.flatMap((fact) => {
		const sourceValue = fact.sourceText || fact.label || fact.slug;
		const sourceKey = normalizeKey(sourceValue);
		const key = canonicalKeyBySource.get(sourceKey) ?? normalizeKey(fact.slug);
		const label = formatAllergenLabel(fact.label || sourceValue);
		if (!label || seen.has(key)) return [];
		seen.add(key);
		return [{ key, label }];
	});
};

const getAllergenDisclosure = (
	facts: FoodCompatibilityFact[],
): FoodAllergenDisclosure => {
	const containsEntries = getUniqueAllergenDisclosureEntries(
		facts.filter(
			(fact) => fact.category === "allergen" && fact.factType === "contains",
		),
	);
	const containsKeys = new Set(containsEntries.map(({ key }) => key));
	const mayContainEntries = getUniqueAllergenDisclosureEntries(
		facts.filter(
			(fact) => fact.category === "allergen" && fact.factType === "may_contain",
		),
	).filter(({ key }) => !containsKeys.has(key));

	return {
		contains: containsEntries.map(({ label }) => label),
		mayContain: mayContainEntries.map(({ label }) => label),
	};
};

const buildCompatibilitySummary = (
	facts: FoodCompatibilityFact[],
	policyVersion: number,
	currentSummary?: FoodCompatibilitySummary,
): FoodCompatibilitySummary => ({
	version: currentSummary?.version ?? 1,
	policyVersion,
	generatedAt: currentSummary?.generatedAt ?? new Date().toISOString(),
	allFacts: facts,
	contains: facts.filter((fact) => fact.factType === "contains"),
	mayContain: facts.filter((fact) => fact.factType === "may_contain"),
	dietaryClaims: facts.filter((fact) => fact.factType === "dietary_claim"),
	ingredientSignals: facts.filter(
		(fact) => fact.factType === "ingredient_present",
	),
});

export type FoodSafetyEvaluationContext = {
	profile: FoodPreferenceProfile | null;
	policy: FoodSafetyPolicy;
};

export const annotateFoodWithFoodSafety = (
	food: FoodItem,
	context: FoodSafetyEvaluationContext,
): FoodItem => {
	const facts = getCompatibilityFacts(food, context.policy);
	const ingredientPresentation = buildFoodIngredientPresentation(food);
	const preferenceWarnings = getFoodPreferenceWarnings(
		facts,
		context.profile,
		context.policy,
		ingredientPresentation,
	);
	const activePreferences = getActivePreferenceValues(context.profile);
	const preferenceResolution = getPreferenceResolutionContext(context.profile);
	const regulatoryContext = getFoodCompatibilityRegulatoryContext(
		context.profile,
		context.policy,
	);
	return {
		...food,
		compatibilitySummary: buildCompatibilitySummary(
			facts,
			context.policy.version,
			food.compatibilitySummary,
		),
		allergenDisclosure: getAllergenDisclosure(facts),
		ingredientPresentation,
		preferenceWarnings,
		compatibilityEvaluation: getFoodCompatibilityEvaluation({
			food,
			policyVersion: context.policy.version,
			hasActivePreferences: getSavedPreferenceCount(context.profile) > 0,
			policyCoversPreferences:
				policyCoversPreferences(activePreferences, context.policy) &&
				policyCoversFoodLanguages(food, context.policy) &&
				preferenceResolution.unresolvedPreferences.length === 0,
			conflictCount: preferenceWarnings.length,
			regulatoryContext,
			preferenceResolution,
		}),
	};
};

export const annotateFoodsWithFoodSafety = (
	foods: FoodItem[],
	context: FoodSafetyEvaluationContext,
) => foods.map((food) => annotateFoodWithFoodSafety(food, context));
