import type { FoodItem } from "$lib/utils/food/types";
import { getFoodPreferenceWarningMessage } from "$lib/utils/profile/foodPreferenceWarnings";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";

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
		if (warnings.length === 0) return [];

		const hasWarning = warnings.some((warning) => warning.level === "warning");
		return [
			{
				id: `food-preference-${food.fdcId}`,
				severity: hasWarning ? "warning" : "info",
				symbol: hasWarning ? "!" : "?",
				title: food.description,
				message: warnings.map(getFoodPreferenceWarningMessage).join(" "),
			},
		];
	});
};
