import type { FdcFood } from "$lib/utils/food/types";
import { getFoodPreferenceWarningMessage } from "$lib/utils/profile/foodPreferenceWarnings";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";

export type SmartWarningTone = "danger" | "warning" | "info";

export type SmartWarning = {
	id: string;
	tone: SmartWarningTone;
	symbol: string;
	title: string;
	message: string;
	detailSummary?: string;
	details?: SmartWarningDetail[];
};

export type SmartWarningDetail = {
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
): SmartWarning[] => {
	return nutrients.flatMap((nutrient): SmartWarning[] => {
		const unit = nutrient.unit ?? "";
		const total = Math.max(0, nutrient.total);
		const evaluation = evaluateMixGoal(nutrient.goal, total);
		const difference = evaluation.difference;

		if (evaluation.status === "over") {
			return [
				{
					id: `over-${nutrient.id}`,
					tone: "danger",
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
					tone: "warning",
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

export const getFoodPreferenceSmartWarnings = (
	foods: FdcFood[],
): SmartWarning[] => {
	return foods.flatMap((food) => {
		const warnings = food.preferenceWarnings ?? [];
		if (warnings.length === 0) return [];

		const hasWarning = warnings.some((warning) => warning.level === "warning");
		return [
			{
				id: `food-preference-${food.fdcId}`,
				tone: hasWarning ? "warning" : "info",
				symbol: hasWarning ? "!" : "?",
				title: food.description,
				message: warnings.map(getFoodPreferenceWarningMessage).join(" "),
			},
		];
	});
};
