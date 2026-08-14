import type { StatusMessageTone } from "$lib/components/common/feedback/StatusMessage/types";
import type {
	FoodCompatibilityEvaluation,
	FoodCompatibilityEvaluationStatus,
} from "$lib/utils/food/quality/compatibility";
import { getFoodCompatibilityEvidenceCoverage } from "$lib/utils/food/quality/foodCompatibilityEvaluation";
import { getRegulatedAlcoholDisclosureProfileForFood } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type { FoodItem } from "$lib/utils/food/types";

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

export const getRegulatedAlcoholMissingSafetyDetailsMessage = (
	food: FoodItem,
): FoodCompatibilityEvaluationMessage | null => {
	const disclosureProfile = getRegulatedAlcoholDisclosureProfileForFood(food);
	if (!disclosureProfile) return null;

	const coverage = food.compatibilityEvaluation?.coverage ??
		getFoodCompatibilityEvidenceCoverage(food);
	const isSafetyDetailMissing = [
		coverage.ingredients,
		coverage.allergens,
		coverage.traces,
	].some((state) => state === "missing");
	if (!isSafetyDetailMissing) return null;

	return {
		tone: "warning",
		title: "Federal alcohol labels leave gaps",
		message:
			"Federal alcohol-label rules let most alcoholic beverages skip major-allergen disclosure, and we couldn't verify every ingredient, allergen, or cross-contact detail for this drink. Check the current package and contact the maker before drinking.",
	};
};
