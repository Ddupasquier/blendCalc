import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomFoodCategoryOption = Pick<
	Database["public"]["Tables"]["custom_food_category_options"]["Row"],
	"id" | "label" | "observation_count" | "source_count"
>;

export const readCustomFoodCategoryOptions = async (
	supabase: SupabaseClient<Database> | null = getSupabaseBrowserClient(),
): Promise<CustomFoodCategoryOption[] | null> => {
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("custom_food_category_options")
		.select("id, label, observation_count, source_count")
		.eq("enabled", true)
		.order("label", { ascending: true });

	if (error) return null;

	return [...(data ?? [])].sort((first, second) =>
		first.label.localeCompare(second.label),
	);
};
