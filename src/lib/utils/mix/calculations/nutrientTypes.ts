import type { FoodItem } from "$lib/utils/food/types";

export type NutrientMeta = {
	id: string | number;
	label?: string;
	unit?: string;
};

export type NutrientContributor = {
	label: string;
	amount: number;
	servingAmountLabel: string;
};

export type NutrientContribution = NutrientContributor & {
	percentOfTotal: number;
};

export type NutrientContributionBreakdown = {
	nutrientId: number;
	label: string;
	unit: string;
	total: number;
	contributors: NutrientContribution[];
};

export type NutrientChartMetric = {
	configuredGoalToReferenceGoalRatio: number;
	actualAmountToReferenceGoalRatio: number;
};

export type NutrientAdjustmentImpact = {
	nutrientId: number;
	label: string;
	unit: string;
	amountChange: number;
	currentTotal: number;
	nextTotal: number;
	goal: number;
	distanceImprovement: number;
	weightedDistanceImprovement: number;
};

export type NutrientAdjustmentSuggestion = {
	food: FoodItem;
	direction: "increase" | "decrease";
	currentServingGrams: number;
	nextServingGrams: number;
	changeGrams: number;
	incrementLabel: string;
	incrementSource: "source-serving" | "configured-default";
	primaryImpact: NutrientAdjustmentImpact;
	impacts: NutrientAdjustmentImpact[];
	goalDistanceImprovement: number;
};
