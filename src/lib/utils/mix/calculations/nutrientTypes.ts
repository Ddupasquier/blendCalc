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

export type NutrientFoodSuggestion = {
	food: FdcFood;
	action: "add" | "increase";
	nutrientId: number;
	nutrientLabel: string;
	unit: string;
	amountPer100g: number;
	remainingAmount: number;
	servingGramsToTarget: number;
	currentServingGrams: number;
	nextServingGrams: number;
	targetAddedAmount: number;
	conflicts: NutrientFoodSuggestionConflict[];
	sourceLabel: string;
};

export type NutrientFoodSuggestionConflict = {
	nutrientId: number;
	label: string;
	unit: string;
	amountAdded: number;
	nextTotal: number;
	goal: number;
	reason: "already-over" | "would-exceed";
};

export type NutrientReductionSuggestion = {
	food: FdcFood;
	nutrientId: number;
	nutrientLabel: string;
	unit: string;
	currentServingGrams: number;
	nextServingGrams: number;
	reduceByGrams: number;
	targetReducedAmount: number;
	overageAmount: number;
	percentOfOverageResolved: number;
	conflicts: NutrientReductionSuggestionConflict[];
	sourceLabel: string;
};

export type NutrientReductionSuggestionConflict = {
	nutrientId: number;
	label: string;
	unit: string;
	amountRemoved: number;
	nextTotal: number;
	goal: number;
	reason: "already-under" | "would-drop-below";
};
