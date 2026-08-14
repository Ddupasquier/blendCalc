import type { MixGoalEvaluationStatus } from "$lib/utils/mix/goals/goalEvaluation";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { getMixGoalOperator } from "$lib/utils/mix/goals/goalEvaluation";
import { formatMixQuantity } from "./mixQuantity";

export type MixGoalTarget = Pick<
	MixNutrientGoal,
	"goalType" | "targetAmount" | "upperAmount"
>;

export const formatMixGoalTarget = (
	goal: MixGoalTarget,
	unit: string,
) => {
	if (goal.goalType === "range") {
		return `${formatMixQuantity(goal.targetAmount)}–${formatMixQuantity(
			goal.upperAmount ?? goal.targetAmount,
			{ unit },
		)}`;
	}

	return `${getMixGoalOperator(goal)}${formatMixQuantity(
		goal.targetAmount,
		{ unit },
	)}`;
};

export const formatMixGoalValueComparison = (
	actualAmount: number,
	goal: MixGoalTarget,
	unit: string,
) =>
	`${formatMixQuantity(actualAmount, { unit })} / ${formatMixGoalTarget(goal, unit)}`;

export const getMixGoalStatusTone = (status: MixGoalEvaluationStatus) => {
	if (status === "met") return "success" as const;
	if (status === "over") return "danger" as const;
	return "warning" as const;
};
