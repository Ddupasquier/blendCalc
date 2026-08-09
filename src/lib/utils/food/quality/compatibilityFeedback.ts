import type { AppIssueCode, AppIssueParams } from "$lib/utils/errors/appIssues";
import type { FoodItem } from "$lib/utils/food/types";
import type { FoodPreferenceWarning } from "$lib/utils/profile/foodPreferenceWarnings";
import type { FoodCompatibilityFact } from "./compatibility";

export type FoodCompatibilityFeedbackReason =
	| "incorrect_match"
	| "outdated_source_data"
	| "wrong_evidence_type"
	| "other";

export type FoodCompatibilityFeedbackRequest = {
	sharedProductId: string | null;
	sourceKey: string | null;
	sourceId: string;
	barcode: string | null;
	foodDescription: string;
	warningId: string;
	issueCode: AppIssueCode;
	issueParams: AppIssueParams;
	factSnapshot: FoodCompatibilityFact[];
	reportReason: FoodCompatibilityFeedbackReason;
	reportDetails: string | null;
};

export type FoodCompatibilityFeedbackResponse = {
	status: "submitted" | "already_pending";
};

const normalizeComparable = (value: unknown) =>
	typeof value === "string"
		? value.trim().toLocaleLowerCase()
		: "";

const getWarningFacts = (
	food: FoodItem,
	warning: FoodPreferenceWarning,
) => {
	const factLabel = normalizeComparable(warning.params.factLabel);
	if (!factLabel) return [];

	return (food.compatibilitySummary?.allFacts ?? []).filter((fact) =>
		[
			normalizeComparable(fact.slug),
			normalizeComparable(fact.label),
			normalizeComparable(fact.sourceText),
		].includes(factLabel)
	);
};

export const createFoodCompatibilityFeedbackRequest = (
	food: FoodItem,
	warning: FoodPreferenceWarning,
	reportReason: FoodCompatibilityFeedbackReason = "incorrect_match",
	reportDetails: string | null = null,
): FoodCompatibilityFeedbackRequest => ({
	sharedProductId: food.sharedProductId ?? null,
	sourceKey: food.sourceKey ?? null,
	sourceId: String(
		food.sourceIdentifiers?.[food.sourceKey ?? ""] ??
		food.fdcId,
	),
	barcode: food.barcode ?? food.gtinUpc ?? null,
	foodDescription: food.canonicalDescription ?? food.description,
	warningId: warning.id,
	issueCode: warning.code,
	issueParams: warning.params,
	factSnapshot: getWarningFacts(food, warning),
	reportReason,
	reportDetails,
});
