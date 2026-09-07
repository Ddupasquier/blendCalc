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

type FoodCompatibilityCoverage = FoodCompatibilityEvaluation["coverage"];

const PACKAGE_EVIDENCE_LABELS: ReadonlyArray<{
	key: "identity" | "ingredients" | "allergens" | "traces";
	label: string;
}> = [
	{ key: "identity", label: "product identity" },
	{ key: "ingredients", label: "ingredient list" },
	{ key: "allergens", label: "allergen declaration" },
	{ key: "traces", label: "cross-contact statement" },
];

const formatReadableList = (values: string[]) => {
	if (values.length <= 1) return values[0] ?? "";
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
};

const getMissingPackageEvidenceLabels = (coverage: FoodCompatibilityCoverage) =>
	PACKAGE_EVIDENCE_LABELS.filter(({ key }) => coverage[key] === "missing").map(
		({ label }) => label,
	);

const getMissingPackageEvidenceSentence = (
	coverage: FoodCompatibilityCoverage,
) => {
	const missingLabels = getMissingPackageEvidenceLabels(coverage);
	if (!missingLabels.length) return null;

	return `The ${formatReadableList(missingLabels)} ${missingLabels.length === 1 ? "is" : "are"} missing.`;
};

const getMissingPolicyCoverageSentence = (
	evaluation: FoodCompatibilityEvaluation,
) => {
	if (evaluation.coverage.policy !== "missing") return null;

	const unresolvedLabels = evaluation.preferenceResolution.unresolvedPreferences
		.map(({ label }) => label.trim())
		.filter(Boolean);
	if (unresolvedLabels.length) {
		return `An exact reviewed food-check rule is unavailable for ${formatReadableList(unresolvedLabels)}.`;
	}

	return "An exact reviewed food-check rule is unavailable for one or more saved food settings.";
};

const getIncompleteEvaluationMessage = (
	evaluation: FoodCompatibilityEvaluation,
) => {
	const missingDetails = [
		getMissingPackageEvidenceSentence(evaluation.coverage),
		getMissingPolicyCoverageSentence(evaluation),
	].filter((detail): detail is string => Boolean(detail));

	return [
		"No conflict was found in the information available.",
		...missingDetails,
		missingDetails.length
			? CURRENT_PACKAGE_LABEL_REMINDER
			: "The stored food-check result is incomplete. Check the current package label before eating.",
	].join(" ");
};

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
			"The stored food-check result is incomplete. Check the current package label before eating.",
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
) =>
	evaluation.status === "incomplete"
		? {
				...messages.incomplete,
				message: getIncompleteEvaluationMessage(evaluation),
			}
		: messages[evaluation.status];

export const getRegulatedAlcoholMissingSafetyDetailsMessage = (
	food: FoodItem,
): FoodCompatibilityEvaluationMessage | null => {
	const disclosureProfile = getRegulatedAlcoholDisclosureProfileForFood(food);
	if (!disclosureProfile) return null;

	const coverage =
		food.compatibilityEvaluation?.coverage ??
		getFoodCompatibilityEvidenceCoverage(food);
	const safetyCoverage = {
		...coverage,
		identity: "not_required" as const,
	};
	const missingSafetyDetails =
		getMissingPackageEvidenceSentence(safetyCoverage);
	if (!missingSafetyDetails) return null;

	return {
		tone: "warning",
		title: "Federal alcohol labels leave gaps",
		message: `Federal alcohol-label rules let most alcoholic beverages skip major-allergen disclosure. ${missingSafetyDetails} Check the current package and contact the maker before drinking.`,
	};
};
