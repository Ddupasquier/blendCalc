import type { FdcFood } from "$lib/utils/food/types";

export type NutrientMeta = {
	id: string | number;
	label?: string;
	unit?: string;
};

export type NutrientContributor = {
	label: string;
	amount: number;
	grams: number;
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
	goalRatio: number;
	totalRatio: number;
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
};

export type NutrientAdjustmentSuggestion = {
	food: FdcFood;
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
