import type { StatusMessageTone } from "$lib/components/common/feedback/StatusMessage/types";
import type {
	FoodCompatibilityEvaluation,
	FoodCompatibilityEvaluationStatus,
} from "$lib/utils/food/quality/compatibility";

export type FoodCompatibilityEvaluationMessage = {
	tone: StatusMessageTone;
	title: string;
	message: string;
};

export const CURRENT_PACKAGE_LABEL_REMINDER =
	"Ingredients and labels can change. The current package label is the final authority—check it before eating.";

const messages: Record<
	FoodCompatibilityEvaluationStatus,
	FoodCompatibilityEvaluationMessage
> = {
	conflict: {
		tone: "danger",
		title: "This food conflicts with your settings",
		message:
			"Review the warning details. When this food is packaged, the current package label is always the final authority.",
	},
	checked: {
		tone: "success",
		title: "No conflict found in available information",
		message: CURRENT_PACKAGE_LABEL_REMINDER,
	},
	incomplete: {
		tone: "warning",
		title: "Some food details could not be checked",
		message:
			"No conflict was found in the information available, but required ingredient or allergen details are missing. Check the current package label when this food is packaged.",
	},
	not_checked: {
		tone: "info",
		title: "Not checked against food settings",
		message:
			"Add allergen or dietary settings to compare this food. When this food is packaged, the current package label is always the final authority.",
	},
};

export const getFoodCompatibilityEvaluationMessage = (
	evaluation: FoodCompatibilityEvaluation,
) => messages[evaluation.status];
