import type { FoodItem } from "$lib/utils/food/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";
import type { MixGoalMap } from "$lib/utils/mix/goals/types";
import {
	type NutrientOverageDetail,
	type SaveGoalDiff,
	withOverageDetails,
} from "$lib/utils/mix/ui/mixUi";
import { formatMixGoalValueComparison } from "$lib/utils/mix/formatting/mixGoalPresentation";
import {
	getFoodPreferenceWarningsForMix,
	getNutrientGoalWarnings,
} from "$lib/utils/mix/warnings/mixWarnings";
import {
	getChartValues,
	getEvaluationChartColors,
	getEvaluationPointColors,
	getGoalValues,
	getNutrientChartMetrics,
} from "./chartMetrics";
import { getNutrientAdjustmentSuggestions } from "./nutrientSuggestions";
import {
	getNutrientContributionBreakdowns,
	getNutrientContributors,
	getNutrientGoalEvaluations,
	getNutrientTotal,
	type MixServingConversionMap,
} from "./nutrientTotals";
import type { NutrientMeta } from "./nutrientTypes";

type MixAnalysisInput = {
	nutrients: NutrientMeta[];
	foods: FoodItem[];
	goals: MixGoalMap;
	servingGrams: Record<number, number>;
	servingConversions?: MixServingConversionMap;
};

export const getMixAnalysis = ({
	nutrients,
	foods,
	goals,
	servingGrams,
	servingConversions,
}: MixAnalysisInput) => {
	const goalNutrients = nutrients.filter(
		(nutrient) => goals[Number(nutrient.id)] !== undefined,
	);
	const totalFor = (nutrientId: number) =>
		getNutrientTotal(foods, nutrientId, servingGrams, servingConversions);
	const evaluations = getNutrientGoalEvaluations(
		goalNutrients,
		foods,
		goals,
		servingGrams,
		servingConversions,
	);
	const chartMetrics = getNutrientChartMetrics(
		goalNutrients,
		foods,
		goals,
		servingGrams,
		servingConversions,
	);
	const diffs: SaveGoalDiff[] = goalNutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const total = totalFor(nutrientId);
		const goal = goals[nutrientId];
		if (!goal) return [];
		const evaluation = evaluateMixGoal(goal, total);
		return [
			{
				nutrientId,
				label: nutrient.label ?? String(nutrient.id),
				unit: nutrient.unit ?? "",
				total,
				goal: goal.targetAmount,
				upperGoal: goal.upperAmount,
				goalType: goal.goalType,
				difference: evaluation.difference,
				percentOfGoal: evaluation.percent,
				status: evaluation.status,
			},
		];
	});
	const overages: NutrientOverageDetail[] = goalNutrients.flatMap(
		(nutrient) => {
			const nutrientId = Number(nutrient.id);
			const total = totalFor(nutrientId);
			const goal = goals[nutrientId];
			if (!goal) return [];
			const evaluation = evaluateMixGoal(goal, total);
			if (evaluation.status !== "over") return [];
			return [
				{
					nutrientId,
					label: nutrient.label ?? String(nutrient.id),
					unit: nutrient.unit ?? "",
					total,
					goal: goal.upperAmount ?? goal.targetAmount,
					overage: evaluation.difference,
					contributors: getNutrientContributors(
						foods,
						nutrientId,
						servingGrams,
						servingConversions,
					),
				},
			];
		},
	);
	const warnings = [
		...getNutrientGoalWarnings(
			goalNutrients.flatMap((nutrient) => {
				const goal = goals[Number(nutrient.id)];
				return goal
					? [
							{
								id: nutrient.id,
								label: nutrient.label ?? String(nutrient.id),
								unit: nutrient.unit ?? "",
								total: totalFor(Number(nutrient.id)),
								goal,
							},
						]
					: [];
			}),
			{ includeUnderTargets: foods.length > 0 },
		).map((warning) => withOverageDetails(warning, overages)),
		...getFoodPreferenceWarningsForMix(foods),
	];

	return {
		chartValues: getChartValues(chartMetrics),
		goalValues: getGoalValues(chartMetrics),
		chartColors: getEvaluationChartColors(evaluations),
		axisColors: getEvaluationPointColors(evaluations),
		nutrientLabels: goalNutrients.map((nutrient) =>
			(nutrient.label ?? String(nutrient.id)).replace("Total ", ""),
		),
		nutrientValueLabels: goalNutrients.flatMap((nutrient) => {
			const goal = goals[Number(nutrient.id)];
			if (!goal) return [];
			const unit = nutrient.unit ?? "";
			return [
				formatMixGoalValueComparison(totalFor(Number(nutrient.id)), goal, unit),
			];
		}),
		diffs,
		contributionBreakdowns: getNutrientContributionBreakdowns(
			goalNutrients,
			foods,
			servingGrams,
			2,
			servingConversions,
		),
		adjustmentSuggestions: Object.values(servingConversions ?? {}).some(
			(conversion) => conversion.grams === null,
		)
			? []
			: getNutrientAdjustmentSuggestions({
					nutrients: goalNutrients,
					selectedFoods: foods,
					nutrientGoals: goals,
					servingGrams,
				}),
		warnings,
	};
};
