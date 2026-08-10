import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodItem } from "$lib/utils/food/types";
import type { NutrientChartMetric, NutrientMeta } from "./nutrientTypes";
import { getNutrientTotal } from "./nutrientTotals";
import type { MixGoalMap } from "$lib/utils/mix/goals/types";
import type { MixGoalEvaluation } from "$lib/utils/mix/goals/goalEvaluation";

const NUTRIENT_CHART_BOUNDARY_HEADROOM_MULTIPLIER = 1.1;

const CHART_COLORS = {
	atGoal: {
		fill: "var(--mix-chart-success-fill)",
		stroke: "var(--mix-chart-success-stroke)",
	},
	barelyOver: {
		fill: "var(--mix-chart-caution-fill)",
		stroke: "var(--mix-chart-caution-stroke)",
	},
	midwayOver: {
		fill: "var(--mix-chart-warning-fill)",
		stroke: "var(--mix-chart-warning-stroke)",
	},
	wayOver: {
		fill: "var(--mix-chart-danger-fill)",
		stroke: "var(--mix-chart-danger-stroke)",
	},
} as const;

export const getNutrientChartMetrics = (
	nutrients: NutrientMeta[],
	foods: FoodItem[],
	nutrientGoals: MixGoalMap,
	servingGrams: Record<number, number>,
): NutrientChartMetric[] => {
	return nutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const goal = nutrientGoals[nutrientId];
		if (!goal) return [];
		const total = getNutrientTotal(foods, nutrientId, servingGrams);
		const hasPositiveGoal = goal.targetAmount > 0;
		const actualAmountToGoalRatio = hasPositiveGoal
			? total / goal.targetAmount
			: total > 0
				? 1
				: 0;

		return [
			{
				actualAmountToGoalRatio,
				hasPositiveGoal,
			},
		];
	});
};

export const getChartReferenceRatio = (metrics: NutrientChartMetric[]) => {
	const highestGoalRelativeValue = Math.max(
		1,
		...metrics.map((metric) => metric.actualAmountToGoalRatio),
	);

	return highestGoalRelativeValue * NUTRIENT_CHART_BOUNDARY_HEADROOM_MULTIPLIER;
};

export const getChartValues = (metrics: NutrientChartMetric[]) => {
	const referenceRatio = getChartReferenceRatio(metrics);
	return metrics.map((metric) =>
		clampChartValue(metric.actualAmountToGoalRatio / referenceRatio),
	);
};

export const getGoalValues = (metrics: NutrientChartMetric[]) => {
	const referenceRatio = getChartReferenceRatio(metrics);
	return metrics.map((metric) =>
		metric.hasPositiveGoal ? 1 / referenceRatio : 0,
	);
};

export const getChartColors = (progress: number) => {
	const thresholds = getMixRuntimeConfiguration().progressThresholds;
	if (progress <= thresholds.atGoal) {
		return CHART_COLORS.atGoal;
	}

	if (progress <= thresholds.barelyOver) {
		return CHART_COLORS.barelyOver;
	}

	if (progress <= thresholds.midwayOver) {
		return CHART_COLORS.midwayOver;
	}

	return CHART_COLORS.wayOver;
};

export const getPointColors = (progressValues: number[]) => {
	const tolerance = getMixRuntimeConfiguration().pointGoalTolerance;
	return progressValues.map((progress) => {
		if (progress > 1 + tolerance) {
			return CHART_COLORS.wayOver;
		}

		if (progress >= 1 - tolerance) {
			return CHART_COLORS.atGoal;
		}

		return CHART_COLORS.barelyOver;
	});
};

export const getEvaluationChartColors = (evaluations: MixGoalEvaluation[]) => {
	if (evaluations.some((evaluation) => evaluation.tone === "danger")) {
		return CHART_COLORS.wayOver;
	}
	if (evaluations.some((evaluation) => evaluation.tone === "warning")) {
		return CHART_COLORS.barelyOver;
	}
	return CHART_COLORS.atGoal;
};

export const getEvaluationPointColors = (evaluations: MixGoalEvaluation[]) =>
	evaluations.map((evaluation) => {
		if (evaluation.tone === "danger") return CHART_COLORS.wayOver;
		if (evaluation.tone === "warning") return CHART_COLORS.barelyOver;
		return CHART_COLORS.atGoal;
	});

export const clampChartValue = (value: number) => {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(value, 1));
};
