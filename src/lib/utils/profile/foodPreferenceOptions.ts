import type { Database } from "$lib/types/database.types";

export type FoodPreferenceOptionRecord =
	Database["public"]["Tables"]["food_preference_option_catalog"]["Row"];

type FoodPreferenceOptionRecordLike = Pick<
	FoodPreferenceOptionRecord,
	| "category"
	| "label"
	| "normalized_value"
	| "source_values"
	| "tag_id"
	| "usage_count"
>;

export type FoodPreferenceOptionCategory =
	FoodPreferenceOptionRecord["category"];

export type FoodPreferenceOption = {
	label: string;
	normalizedValue: string;
	category: FoodPreferenceOptionCategory;
	usageCount: number;
	sourceValues: string[];
	tagId: string | null;
};

export type FoodPreferenceOptionSets = {
	allergens: FoodPreferenceOption[];
	dietaryRestrictions: FoodPreferenceOption[];
	ingredients: FoodPreferenceOption[];
};

const FOOD_PREFERENCE_OPTION_LIMITS = {
	allergen: 24,
	dietary: 24,
	ingredient: 48,
} as const;

const ALLERGEN_PRIORITY = [
	"peanut",
	"tree nut",
	"tree-nut",
	"dairy",
	"milk",
	"egg",
	"soy",
	"wheat",
	"gluten",
	"fish",
	"shellfish",
	"sesame",
] as const;

const DIETARY_PRIORITY = [
	"vegan",
	"vegetarian",
	"gluten-free",
	"dairy-free",
	"nut-free",
	"soy-free",
	"egg-free",
	"halal",
	"kosher",
] as const;

const getPriorityIndex = (
	option: FoodPreferenceOption,
	priorityValues: readonly string[],
) => {
	const normalizedPriority = priorityValues.map((value) => value.toLocaleLowerCase());
	const normalizedLabel = option.normalizedValue.toLocaleLowerCase();
	const index = normalizedPriority.indexOf(normalizedLabel);
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const sortByPriorityUsageAndLabel = (
	options: FoodPreferenceOption[],
	priorityValues: readonly string[],
) =>
	[...options].sort((left, right) => {
		const leftPriority = getPriorityIndex(left, priorityValues);
		const rightPriority = getPriorityIndex(right, priorityValues);

		if (leftPriority !== rightPriority) return leftPriority - rightPriority;
		if (left.usageCount !== right.usageCount) {
			return right.usageCount - left.usageCount;
		}
		return left.label.localeCompare(right.label);
	});

const sortByUsageAndLabel = (options: FoodPreferenceOption[]) =>
	[...options].sort((left, right) => {
		if (left.usageCount !== right.usageCount) {
			return right.usageCount - left.usageCount;
		}
		return left.label.localeCompare(right.label);
	});

export const getFoodPreferenceOption = (
	record: FoodPreferenceOptionRecordLike,
): FoodPreferenceOption => ({
	label: record.label,
	normalizedValue: record.normalized_value,
	category: record.category,
	usageCount: record.usage_count,
	sourceValues: [...(record.source_values ?? [])],
	tagId: record.tag_id,
});

export const getFoodPreferenceOptionSets = (
	records: FoodPreferenceOptionRecordLike[] | null | undefined,
): FoodPreferenceOptionSets => {
	const options = (records ?? []).map(getFoodPreferenceOption);

	return {
		allergens: sortByPriorityUsageAndLabel(
			options.filter((option) => option.category === "allergen"),
			ALLERGEN_PRIORITY,
		)
			.slice(0, FOOD_PREFERENCE_OPTION_LIMITS.allergen),
		dietaryRestrictions: sortByPriorityUsageAndLabel(
			options.filter((option) => option.category === "dietary"),
			DIETARY_PRIORITY,
		)
			.slice(0, FOOD_PREFERENCE_OPTION_LIMITS.dietary),
		ingredients: sortByUsageAndLabel(
			options.filter((option) => option.category === "ingredient"),
		)
			.slice(0, FOOD_PREFERENCE_OPTION_LIMITS.ingredient),
	};
};

export const isMissingFoodPreferenceOptionCatalogError = (
	error: { code?: string; message?: string } | null | undefined,
) => {
	const message = error?.message?.toLowerCase() ?? "";

	return (
		error?.code === "42P01" ||
		error?.code === "PGRST205" ||
		message.includes("food_preference_option_catalog") ||
		message.includes("could not find the table")
	);
};
