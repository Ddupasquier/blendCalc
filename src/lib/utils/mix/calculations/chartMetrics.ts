import {
	NUTRIENT_POINT_COLORS,
	NUTRIENT_POINT_GOAL_TOLERANCE,
	NUTRIENT_PROGRESS_COLORS,
	NUTRIENT_PROGRESS_THRESHOLDS,
} from "../../../../defaults/mixDefaults";
import type { FdcFood } from "$lib/utils/food/types";
import type { NutrientChartMetric, NutrientMeta } from "./nutrientTypes";
import { getDefaultNutrientGoal, getNutrientTotal } from "./nutrientTotals";

export const getNutrientChartMetrics = (
	nutrients: NutrientMeta[],
	foods: FdcFood[],
	nutrientGoals: Record<number, number>,
	servingGrams: Record<number, number>,
): NutrientChartMetric[] => {
	return nutrients.map((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const baselineGoal = getDefaultNutrientGoal(nutrient);
		const safeBaselineGoal = baselineGoal > 0 ? baselineGoal : 1;
		const goal = nutrientGoals[nutrientId] ?? baselineGoal;
		const total = getNutrientTotal(foods, nutrientId, servingGrams);

		return {
			goalRatio: goal / safeBaselineGoal,
			totalRatio: total / safeBaselineGoal,
		};
	});
};

export const getChartReferenceRatio = (metrics: NutrientChartMetric[]) => {
	return Math.max(1, ...metrics.map((metric) => metric.goalRatio));
};

export const getChartValues = (metrics: NutrientChartMetric[]) => {
	const referenceRatio = getChartReferenceRatio(metrics);
	return metrics.map((metric) =>
		clampChartValue(metric.totalRatio / referenceRatio),
	);
};

export const getGoalValues = (metrics: NutrientChartMetric[]) => {
	const referenceRatio = getChartReferenceRatio(metrics);
	return metrics.map((metric) =>
		clampChartValue(metric.goalRatio / referenceRatio),
	);
};

export const getChartColors = (progress: number) => {
	if (progress <= NUTRIENT_PROGRESS_THRESHOLDS.atGoal) {
		return NUTRIENT_PROGRESS_COLORS.atGoal;
	}

	if (progress <= NUTRIENT_PROGRESS_THRESHOLDS.barelyOver) {
		return NUTRIENT_PROGRESS_COLORS.barelyOver;
	}

	if (progress <= NUTRIENT_PROGRESS_THRESHOLDS.midwayOver) {
		return NUTRIENT_PROGRESS_COLORS.midwayOver;
	}

	return NUTRIENT_PROGRESS_COLORS.wayOver;
};

export const getPointColors = (progressValues: number[]) => {
	return progressValues.map((progress) => {
		if (progress > 1 + NUTRIENT_POINT_GOAL_TOLERANCE) {
			return NUTRIENT_POINT_COLORS.overGoal;
		}

		if (progress >= 1 - NUTRIENT_POINT_GOAL_TOLERANCE) {
			return NUTRIENT_POINT_COLORS.nearGoal;
		}

		return NUTRIENT_POINT_COLORS.belowGoal;
	});
};

export const clampChartValue = (value: number) => {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(value, 1));
};
