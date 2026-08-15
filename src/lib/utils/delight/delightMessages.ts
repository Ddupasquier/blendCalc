import type { AppDelightMessage } from "$lib/utils/food/reference/appReferenceCatalog";
import {
	getConfiguredAppReferenceCatalog,
	resolveFoodSymbolKey,
} from "$lib/utils/food/reference/appReferenceCatalog";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import type { SaveGoalDiff } from "$lib/utils/mix/ui/mixUi";

export type DelightMessageSelection = {
	contextKey: AppDelightMessage["contextKey"];
	triggerKey: string;
	matchKeys?: readonly string[];
	numericValue?: number | null;
};

export type DelightMessageResolutionOptions = {
	allowCheekyMessages?: boolean;
	catalog?: ReturnType<typeof getConfiguredAppReferenceCatalog>;
};

const CHEEKY_MESSAGE_TRIGGER_KEYS = new Set([
	"ingredients:food-added",
	"mix:goal-progress",
	"saved:recipe-saved",
]);

const isEligibleCheekyMessage = (entry: AppDelightMessage) =>
	CHEEKY_MESSAGE_TRIGGER_KEYS.has(`${entry.contextKey}:${entry.triggerKey}`);

const matchesSelection = (
	entry: AppDelightMessage,
	selection: DelightMessageSelection,
) => {
	if (
		entry.contextKey !== selection.contextKey ||
		entry.triggerKey !== selection.triggerKey
	) {
		return false;
	}
	if (
		entry.matchKey !== null &&
		!selection.matchKeys?.includes(entry.matchKey)
	) {
		return false;
	}
	if (entry.minimumValue !== null) {
		if (
			selection.numericValue === null ||
			selection.numericValue === undefined ||
			selection.numericValue < entry.minimumValue
		) {
			return false;
		}
	}
	if (entry.maximumValue !== null) {
		if (
			selection.numericValue === null ||
			selection.numericValue === undefined ||
			selection.numericValue > entry.maximumValue
		) {
			return false;
		}
	}
	return true;
};

export const resolveDelightMessage = (
	selections: readonly DelightMessageSelection[],
	{
		allowCheekyMessages = false,
		catalog = getConfiguredAppReferenceCatalog(),
	}: DelightMessageResolutionOptions = {},
) => {
	const matchingEntries = catalog.delightMessages.filter(
		(entry) =>
			(entry.tone === "standard" ||
				(allowCheekyMessages && isEligibleCheekyMessage(entry))) &&
			selections.some((selection) => matchesSelection(entry, selection)),
	);
	matchingEntries.sort(
		(left, right) =>
			left.priority - right.priority || left.key.localeCompare(right.key),
	);
	return matchingEntries[0]?.message ?? null;
};

export const resolveFoodAddedDelightMessage = (
	food: FoodItem,
	allowCheekyMessages = false,
) =>
	resolveDelightMessage([
		{
			contextKey: "ingredients",
			triggerKey: "food-added",
			matchKeys: [resolveFoodSymbolKey(food)],
		},
	], { allowCheekyMessages });

const isFoodNamedOnly = (foods: FoodItem[], expectedName: string) =>
	foods.length > 0 &&
	foods.every(
		(food) => food.description.trim().toLowerCase() === expectedName,
	);

const findGoalDifference = (
	differences: SaveGoalDiff[],
	nutrientId: number,
) => differences.find((difference) => difference.nutrientId === nutrientId);

const getGoalProgressMatchKeys = (differences: SaveGoalDiff[]) => {
	if (differences.length === 0) return [];
	const matchKeys: string[] = [];
	const metGoalCount = differences.filter(
		(difference) => difference.status === "met",
	).length;
	if (metGoalCount === differences.length) matchKeys.push("all-met");
	else if (metGoalCount / differences.length >= 0.75) matchKeys.push("balanced");

	const protein = findGoalDifference(differences, NUTRIENT_IDS.PROTEIN);
	if (
		protein?.status === "over" &&
		protein.goal > 0 &&
		protein.total >= protein.goal * 1.5
	) {
		matchKeys.push("protein-far-over");
	} else if (protein?.status === "met") {
		matchKeys.push("protein-met");
	}

	const fiber = findGoalDifference(differences, NUTRIENT_IDS.FIBER);
	if (
		fiber?.status === "under" &&
		fiber.goal > 0 &&
		fiber.total < fiber.goal * 0.75
	) {
		matchKeys.push("fiber-low");
	}
	if (findGoalDifference(differences, NUTRIENT_IDS.CARBS)?.status === "over") {
		matchKeys.push("carbs-high");
	}
	if (findGoalDifference(differences, NUTRIENT_IDS.SODIUM)?.status === "over") {
		matchKeys.push("sodium-high");
	}
	return matchKeys;
};

export const resolveMixDelightMessage = ({
	foods,
	servingGrams,
	goalDifferences,
	hasDangerWarning,
	allowCheekyMessages = false,
}: {
	foods: FoodItem[];
	servingGrams: Record<number, number>;
	goalDifferences: SaveGoalDiff[];
	hasDangerWarning: boolean;
	allowCheekyMessages?: boolean;
}) => {
	if (foods.length === 0 || hasDangerWarning) return null;
	const recipeCompositionMatchKeys = [
		...(foods.every((food) => resolveFoodSymbolKey(food) === "water")
			? ["water-only"]
			: []),
		...(isFoodNamedOnly(foods, "ice") ? ["ice-only"] : []),
	];
	const totalServingGrams = foods.reduce((total, food) => {
		const grams = servingGrams[food.fdcId];
		return total + (Number.isFinite(grams) && grams > 0 ? grams : 0);
	}, 0);

	return resolveDelightMessage([
		{
			contextKey: "mix",
			triggerKey: "recipe-composition",
			matchKeys: recipeCompositionMatchKeys,
		},
		{
			contextKey: "mix",
			triggerKey: "goal-progress",
			matchKeys: getGoalProgressMatchKeys(goalDifferences),
		},
		{
			contextKey: "mix",
			triggerKey: "total-serving-grams",
			numericValue: totalServingGrams,
		},
	], { allowCheekyMessages });
};
