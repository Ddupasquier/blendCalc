import type { FoodItem } from "$lib/utils/food/types";
import type {
	FoodCompatibilityConfidence,
	FoodCompatibilityFactType,
	FoodCompatibilitySourceType,
} from "$lib/utils/food/quality/compatibility";
import {
	getAppIssueMessage,
	type AppIssueCode,
	type AppIssueParams,
} from "$lib/utils/errors/appIssues";

export type FoodPreferenceWarningLevel = "warning" | "potential";

export type FoodPreferenceWarningEvidence = {
	factType: FoodCompatibilityFactType;
	sourceType: FoodCompatibilitySourceType;
	sourceText: string;
	confidence: FoodCompatibilityConfidence;
	policyVersion: number;
	ingredientPath: string[];
	percentageLabel: string | null;
};

export type FoodPreferenceWarning = {
	id: string;
	level: FoodPreferenceWarningLevel;
	category: "allergen" | "restriction";
	label: string;
	code: AppIssueCode;
	params: AppIssueParams;
	evidence?: FoodPreferenceWarningEvidence;
};

export const FOOD_PREFERENCE_WARNING_TITLE = "Check this ingredient";

export const getFoodPreferenceWarningMessage = (
	warning: Pick<FoodPreferenceWarning, "code" | "params">,
) => getAppIssueMessage(warning.code, warning.params);

const quoteEvidence = (value: string) => `“${value}”`;

export const getFoodPreferenceWarningEvidenceMessage = (
	warning: Pick<FoodPreferenceWarning, "evidence">,
) => {
	const evidence = warning.evidence;
	if (!evidence) return "";
	const sourceText = quoteEvidence(evidence.sourceText);
	const path = evidence.ingredientPath.length > 1
		? ` under ${evidence.ingredientPath
			.slice(0, -1)
			.map(quoteEvidence)
			.join(" → ")}`
		: "";
	const percentage = evidence.percentageLabel
		? ` The source reports it as ${evidence.percentageLabel}.`
		: "";

	switch (evidence.sourceType) {
		case "label_allergen_field":
			return `The package’s Contains information lists ${sourceText}.`;
		case "label_trace_field":
			return `The package’s precautionary information says ${sourceText}.`;
		case "label_ingredient_field":
			return `Found in the ingredient list${path}: ${sourceText}.${percentage}`;
		case "label_dietary_field":
			return `The package’s dietary information includes ${sourceText}.`;
		case "source_dietary_analysis":
			return `The source’s ingredient analysis identifies ${sourceText}.`;
		case "food_identity_taxonomy":
			return `This generic food is classified as ${sourceText}.`;
		default:
			return `The stored product evidence includes ${sourceText}.`;
	}
};

export const getFoodPreferenceWarningEvidenceReviewMessage = (
	warning: Pick<FoodPreferenceWarning, "evidence">,
) => {
	const evidence = warning.evidence;
	if (!evidence) return "";
	const confidence = evidence.confidence === "confirmed"
		? "This match is confirmed."
		: evidence.confidence === "inferred"
			? "This is a source-backed possible match."
			: "This possible match may need review.";
	return `${confidence} Current food-check rules: version ${evidence.policyVersion}.`;
};

export const getFoodDownrankScore = (
	food: FoodItem,
): number =>
	(food.preferenceWarnings ?? []).reduce(
		(total, warning) => total + (warning.level === "warning" ? 6 : 3),
		0,
	);

export const getFoodWarningLabel = (food: FoodItem) => {
	const warnings = food.preferenceWarnings ?? [];
	return warnings.length === 0 ? null : "⚠";
};
