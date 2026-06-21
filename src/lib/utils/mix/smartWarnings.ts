import type { FdcFood } from "$lib/utils/food/types";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import { getFoodPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";

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
	goal: number;
};

const formatAmount = (value: number) => {
	const absoluteValue = Math.abs(value);
	if (absoluteValue >= 100) return String(Math.round(value));
	if (absoluteValue >= 10) return value.toFixed(1).replace(/\.0$/, "");
	return value.toFixed(1).replace(/\.0$/, "");
};

export const getNutrientGoalWarnings = (
	nutrients: NutrientGoalWarningInput[],
	{ includeUnderTargets = true } = {},
): SmartWarning[] => {
	return nutrients.flatMap((nutrient): SmartWarning[] => {
		const unit = nutrient.unit ?? "";
		const goal = Math.max(0, nutrient.goal);
		const total = Math.max(0, nutrient.total);
		const difference = total - goal;
		const tolerance = Math.max(goal * 0.05, 0.05);

		if (difference > tolerance) {
			return [
				{
					id: `over-${nutrient.id}`,
					tone: "danger",
					symbol: "!",
					title: `${nutrient.label} exceeds goal`,
					message: `${nutrient.label} exceeds goal by ${formatAmount(
						difference,
					)}${unit}.`,
				},
			];
		}

		if (includeUnderTargets && goal > 0 && difference < -tolerance) {
			return [
				{
					id: `under-${nutrient.id}`,
					tone: "warning",
					symbol: "↓",
					title: `${nutrient.label} under target`,
					message: `${nutrient.label} is under target by ${formatAmount(
						Math.abs(difference),
					)}${unit}.`,
				},
			];
		}

		return [];
	});
};

export const getFoodPreferenceSmartWarnings = (
	foods: FdcFood[],
	profile: FoodPreferenceProfile | null | undefined,
): SmartWarning[] => {
	if (!profile) return [];

	return foods.flatMap((food) => {
		const warnings = getFoodPreferenceWarnings(food, profile);
		if (warnings.length === 0) return [];

		const hasWarning = warnings.some((warning) => warning.level === "warning");
		return [
			{
				id: `food-preference-${food.fdcId}`,
				tone: hasWarning ? "warning" : "info",
				symbol: hasWarning ? "!" : "?",
				title: food.description,
				message: warnings.map((warning) => warning.reason).join(" "),
			},
		];
	});
};
