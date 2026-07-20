import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FdcFood } from "$lib/utils/food/types";
import type { NutrientChartMetric, NutrientMeta } from "./nutrientTypes";
import { getDefaultNutrientGoal, getNutrientTotalResult } from "./nutrientTotals";

const CHART_COLORS = {
	atGoal: { fill: "var(--mix-chart-success-fill)", stroke: "var(--mix-chart-success-stroke)" },
	barelyOver: { fill: "var(--mix-chart-caution-fill)", stroke: "var(--mix-chart-caution-stroke)" },
	midwayOver: { fill: "var(--mix-chart-warning-fill)", stroke: "var(--mix-chart-warning-stroke)" },
	wayOver: { fill: "var(--mix-chart-danger-fill)", stroke: "var(--mix-chart-danger-stroke)" },
} as const;

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
		const result = getNutrientTotalResult(foods, nutrientId, servingGrams);

		return {
			goalRatio: goal / safeBaselineGoal,
			totalRatio: result.total / safeBaselineGoal,
			incomplete: result.missingFoodIds.length > 0,
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

export const clampChartValue = (value: number) => {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(value, 1));
};
