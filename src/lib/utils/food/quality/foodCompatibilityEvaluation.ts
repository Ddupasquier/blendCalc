import {
	getAuthoritativeGenericFoodIdentity,
	resolveFoodIdentityType,
} from "$lib/utils/food/identity/foodIdentity";
import type {
	FoodCompatibilityEvaluation,
	FoodCompatibilityEvidenceState,
	FoodCompatibilityPreferenceResolutionContext,
	FoodCompatibilityRegulatoryContext,
} from "$lib/utils/food/quality/compatibility";
import type { FdcFood } from "$lib/utils/food/types";

export type FoodCompatibilityEvaluationInput = {
	food: FdcFood;
	policyVersion?: number | null;
	hasActivePreferences: boolean;
	policyCoversPreferences: boolean;
	conflictCount: number;
	regulatoryContext?: FoodCompatibilityRegulatoryContext;
	preferenceResolution?: FoodCompatibilityPreferenceResolutionContext;
};

const emptyRegulatoryContext: FoodCompatibilityRegulatoryContext = {
	status: "not_selected",
	requestedRegionCode: null,
	selectionSource: null,
	profile: null,
	coveredPreferences: [],
	uncoveredPreferences: [],
};

const emptyPreferenceResolution: FoodCompatibilityPreferenceResolutionContext = {
	resolvedCount: 0,
	resolvedPreferences: [],
	unresolvedPreferences: [],
};

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

const hasValues = (values: unknown[] | null | undefined) =>
	Boolean(values?.length);

const getPackagedEvidenceState = (
	food: FdcFood,
	field: "ingredients" | "allergens" | "traces",
): FoodCompatibilityEvidenceState => {
	if (food.fieldProvenance?.[field]) return "available";
	if (field === "ingredients") {
		return hasText(food.ingredients) ||
			hasValues(food.ingredientList) ||
			hasValues(food.structuredIngredients)
			? "available"
			: "missing";
	}
	return hasValues(food[field]) ? "available" : "missing";
};

export const getFoodCompatibilityEvidenceCoverage = (
	food: FdcFood,
): FoodCompatibilityEvaluation["coverage"] => {
	const identityType = resolveFoodIdentityType(food);
	if (identityType === "generic") {
		return {
			basis: "generic-taxonomy",
			identity: hasText(getAuthoritativeGenericFoodIdentity(food))
				? "available"
				: "missing",
			ingredients: "not_required",
			allergens: "not_required",
			traces: "not_required",
			policy: "missing",
		};
	}

	return {
		basis: identityType === "private-custom"
			? "private-entry"
			: "packaged-label",
		identity: "not_required",
		ingredients: getPackagedEvidenceState(food, "ingredients"),
		allergens: getPackagedEvidenceState(food, "allergens"),
		traces: getPackagedEvidenceState(food, "traces"),
		policy: "missing",
	};
};

const hasCompleteEvidence = (
	coverage: FoodCompatibilityEvaluation["coverage"],
) =>
	Object.entries(coverage)
		.filter(([key]) => key !== "basis")
		.every(([, state]) => state !== "missing");

export const getFoodCompatibilityEvaluation = ({
	food,
	policyVersion,
	hasActivePreferences,
	policyCoversPreferences,
	conflictCount,
	regulatoryContext = emptyRegulatoryContext,
	preferenceResolution = emptyPreferenceResolution,
}: FoodCompatibilityEvaluationInput): FoodCompatibilityEvaluation => {
	const normalizedPolicyVersion =
		Number.isSafeInteger(policyVersion) && (policyVersion ?? 0) > 0
			? Number(policyVersion)
			: null;
	const coverage = {
		...getFoodCompatibilityEvidenceCoverage(food),
		policy: normalizedPolicyVersion !== null && policyCoversPreferences
			? "available" as const
			: "missing" as const,
	};
	const profileApplied = hasActivePreferences &&
		normalizedPolicyVersion !== null;
	const normalizedConflictCount =
		Number.isSafeInteger(conflictCount) && conflictCount > 0
			? conflictCount
			: 0;

	let status: FoodCompatibilityEvaluation["status"] = "not_checked";
	if (profileApplied && normalizedConflictCount > 0) {
		status = "conflict";
	} else if (profileApplied && hasCompleteEvidence(coverage)) {
		status = "checked";
	} else if (profileApplied) {
		status = "incomplete";
	}

	return {
		version: 1,
		status,
		policyVersion: normalizedPolicyVersion,
		profileApplied,
		conflictCount: normalizedConflictCount,
		coverage,
		regulatoryContext,
		preferenceResolution,
	};
};
