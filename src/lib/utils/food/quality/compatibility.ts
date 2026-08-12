export type FoodCompatibilityFactType =
	| "contains"
	| "may_contain"
	| "free_from"
	| "dietary_claim"
	| "ingredient_present"
	| "dietary_conflict";

export type FoodCompatibilitySourceType =
	| "shared_product_metadata"
	| "shared_observation_metadata"
	| "shared_submission_metadata"
	| "label_allergen_field"
	| "label_trace_field"
	| "label_dietary_field"
	| "label_ingredient_field"
	| "food_identity_taxonomy"
	| "source_dietary_analysis";

export type FoodCompatibilityConfidence = "confirmed" | "inferred" | "uncertain";

export type FoodCompatibilityEvaluationStatus =
	| "conflict"
	| "checked"
	| "incomplete"
	| "not_checked";

export type FoodCompatibilityEvidenceState =
	| "available"
	| "missing"
	| "not_required";

export type FoodCompatibilityEvaluation = {
	version: 1;
	status: FoodCompatibilityEvaluationStatus;
	policyVersion: number | null;
	profileApplied: boolean;
	conflictCount: number;
	coverage: {
		basis:
			| "generic-taxonomy"
			| "packaged-label"
			| "private-entry"
			| "unknown-identity";
		identity: FoodCompatibilityEvidenceState;
		ingredients: FoodCompatibilityEvidenceState;
		allergens: FoodCompatibilityEvidenceState;
		traces: FoodCompatibilityEvidenceState;
		policy: FoodCompatibilityEvidenceState;
	};
	regulatoryContext: FoodCompatibilityRegulatoryContext;
	preferenceResolution: FoodCompatibilityPreferenceResolutionContext;
};

export type FoodCompatibilityPreferenceResolutionContext = {
	resolvedCount: number;
	resolvedPreferences: Array<{
		tagId: string;
		tagSlug: string;
		label: string;
		rawValue: string;
		type: "allergen" | "dietary_restriction";
	}>;
	unresolvedPreferences: Array<{
		label: string;
		type: "allergen" | "dietary_restriction";
	}>;
};

export type FoodCompatibilityRegulatoryContext = {
	status: "applied" | "unsupported" | "not_selected";
	requestedRegionCode: string | null;
	selectionSource: "account" | "device" | null;
	profile: {
		key: string;
		regionCode: string;
		displayName: string;
		authority: string;
		policyReference: string;
		sourceUrl: string;
		reviewedAt: string;
	} | null;
	coveredPreferences: Array<{
		preference: string;
		regulatedLabel: string;
		classification:
			| "major_allergen"
			| "priority_allergen"
			| "regulated_allergen"
			| "gluten_source"
			| "regulated_sulphite";
	}>;
	uncoveredPreferences: string[];
};

export type FoodCompatibilityFact = {
	slug: string;
	label: string;
	category: "allergen" | "dietary" | "ingredient" | "avoidance";
	factType: FoodCompatibilityFactType;
	sourceType: FoodCompatibilitySourceType;
	sourceText: string | null;
	confidence: FoodCompatibilityConfidence;
};

export type FoodCompatibilitySummary = {
	version: number;
	policyVersion: number;
	generatedAt: string;
	allFacts: FoodCompatibilityFact[];
	contains: FoodCompatibilityFact[];
	mayContain: FoodCompatibilityFact[];
	dietaryClaims: FoodCompatibilityFact[];
	ingredientSignals: FoodCompatibilityFact[];
};
