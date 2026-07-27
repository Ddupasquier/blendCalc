import type { FdcFood } from "$lib/utils/food/types";
import {
	getAppIssueMessage,
	type AppIssueCode,
	type AppIssueParams,
} from "$lib/utils/errors/appIssues";

export type FoodPreferenceWarningLevel = "warning" | "potential";

export type FoodPreferenceWarning = {
	id: string;
	level: FoodPreferenceWarningLevel;
	category: "allergen" | "restriction";
	label: string;
	code: AppIssueCode;
	params: AppIssueParams;
};

export const FOOD_PREFERENCE_WARNING_TITLE = "Check this ingredient";

export const getFoodPreferenceWarningMessage = (
	warning: Pick<FoodPreferenceWarning, "code" | "params">,
) => getAppIssueMessage(warning.code, warning.params);

export const getFoodDownrankScore = (
	food: FdcFood,
): number =>
	(food.preferenceWarnings ?? []).reduce(
		(total, warning) => total + (warning.level === "warning" ? 6 : 3),
		0,
	);

export const getFoodWarningLabel = (food: FdcFood) => {
	const warnings = food.preferenceWarnings ?? [];
	return warnings.length === 0 ? null : "⚠";
};
