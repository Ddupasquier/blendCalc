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
		basis: "generic-taxonomy" | "packaged-label" | "private-entry";
		identity: FoodCompatibilityEvidenceState;
		ingredients: FoodCompatibilityEvidenceState;
		allergens: FoodCompatibilityEvidenceState;
		traces: FoodCompatibilityEvidenceState;
		policy: FoodCompatibilityEvidenceState;
	};
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
