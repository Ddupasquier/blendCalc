import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import type { FdcFood } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IngredientSourceOption = Pick<
	Database["public"]["Tables"]["ingredient_source_options"]["Row"],
	| "value"
	| "filter_label"
	| "badge_label"
	| "display_order"
	| "filter_enabled"
	| "badge_enabled"
>;

export const getFoodSourceValue = (food: FdcFood) => {
	if (food.customFood) return "custom";
	if (food.sharedProductId) return "shared";
	return "fdc";
};

export const readIngredientSourceOptions = async (
	supabase: SupabaseClient<Database> | null = getSupabaseBrowserClient(),
): Promise<IngredientSourceOption[] | null> => {
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("ingredient_source_options")
		.select(
			"value, filter_label, badge_label, display_order, filter_enabled, badge_enabled",
		)
		.order("display_order", { ascending: true });

	if (error) return null;
	return data ?? [];
};

export const getIngredientSourceFilterOptions = (
	options: readonly IngredientSourceOption[],
) =>
	options
		.filter((option) => option.filter_enabled)
		.map((option) => ({
			value: option.value,
			label: option.filter_label,
		}));

export const getIngredientSourceBadgeLabel = (
	food: FdcFood,
	options: readonly IngredientSourceOption[],
) => {
	const sourceValue = getFoodSourceValue(food);
	const sourceOption = options.find(
		(option) => option.value === sourceValue && option.badge_enabled,
	);
	return sourceOption?.badge_label ?? sourceValue.toUpperCase();
};
