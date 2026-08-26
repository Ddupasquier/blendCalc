import type { FoodItem } from "$lib/utils/food/types";
import {
	getFoodPreferenceWarningEvidenceMessage,
	getFoodPreferenceWarningEvidenceReviewMessage,
	getFoodPreferenceWarningMessage,
} from "$lib/utils/profile/foodPreferenceWarnings";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
import {
	formatMixGoalTarget,
	formatMixGoalValueComparison,
} from "$lib/utils/mix/formatting/mixGoalPresentation";

export type MixWarningSeverity = "danger" | "warning" | "info";

export type MixWarning = {
	id: string;
	severity: MixWarningSeverity;
	symbol: string;
	title: string;
	message: string;
	detailSummary?: string;
	details?: MixWarningDetail[];
};

export type MixWarningDetail = {
	label: string;
	value: string;
};

export type NutrientGoalWarningInput = {
	id: string | number;
	label: string;
	unit?: string;
	total: number;
	goal: MixNutrientGoal;
};

export const getNutrientGoalWarnings = (
	nutrients: NutrientGoalWarningInput[],
	{ includeUnderTargets = true } = {},
): MixWarning[] => {
	return nutrients.flatMap((nutrient): MixWarning[] => {
		const unit = nutrient.unit ?? "";
		const total = Math.max(0, nutrient.total);
		const evaluation = evaluateMixGoal(nutrient.goal, total);
		const difference = evaluation.difference;
		const differenceLabel = formatMixQuantity(Math.abs(difference), { unit });
		const warningDetails: MixWarningDetail[] = [
			{
				label: "Current Mix",
				value: formatMixQuantity(total, { unit }),
			},
			{
				label: "Goal",
				value: formatMixGoalTarget(nutrient.goal, unit),
			},
		];

		if (evaluation.status === "over") {
			return [
				{
					id: `over-${nutrient.id}`,
					severity: "danger",
					symbol: "!",
					title: `${nutrient.label} exceeds goal`,
					message: `${nutrient.label} exceeds goal by ${formatMixQuantity(
						difference,
						{ unit },
					)}.`,
					detailSummary: formatMixGoalValueComparison(
						total,
						nutrient.goal,
						unit,
					),
					details: [
						...warningDetails,
						{ label: "Overage", value: differenceLabel },
					],
				},
			];
		}

		if (includeUnderTargets && evaluation.status === "under") {
			return [
				{
					id: `under-${nutrient.id}`,
					severity: "warning",
					symbol: "↓",
					title: `${nutrient.label} under target`,
					message: `${nutrient.label} is under target by ${formatMixQuantity(
						Math.abs(difference),
						{ unit },
					)}.`,
					detailSummary: formatMixGoalValueComparison(
						total,
						nutrient.goal,
						unit,
					),
					details: [
						...warningDetails,
						{ label: "Shortfall", value: differenceLabel },
					],
				},
			];
		}

		return [];
	});
};

export const getFoodPreferenceWarningsForMix = (
	foods: FoodItem[],
): MixWarning[] => {
	return foods.flatMap((food) => {
		const warnings = food.preferenceWarnings ?? [];
		return warnings.map((warning) => {
			const evidenceMessage = getFoodPreferenceWarningEvidenceMessage(warning);
			const evidenceReviewMessage =
				getFoodPreferenceWarningEvidenceReviewMessage(warning);
			const details: MixWarningDetail[] = [
				{
					label:
						warning.category === "allergen"
							? "Selected allergen"
							: "Selected preference",
					value: warning.label,
				},
			];
			if (evidenceMessage) {
				details.push({ label: "Evidence", value: evidenceMessage });
			}
			if (evidenceReviewMessage) {
				details.push({
					label: "Evidence review",
					value: evidenceReviewMessage,
				});
			}

			return {
				id: `food-preference-${food.fdcId}-${warning.id}`,
				severity: warning.level === "warning" ? "warning" : "info",
				symbol: warning.level === "warning" ? "!" : "?",
				title: food.description,
				message: getFoodPreferenceWarningMessage(warning),
				detailSummary:
					warning.category === "allergen"
						? `Selected allergen: ${warning.label}`
						: `Selected preference: ${warning.label}`,
				details,
			};
		});
	});
};
