import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomFoodCategoryOption = Pick<
	Database["public"]["Tables"]["custom_food_category_options"]["Row"],
	"id" | "label" | "observation_count" | "source_count"
>;

const CATEGORY_OPTION_PAGE_SIZE = 1_000;

export const readCustomFoodCategoryOptions = async (
	supabase: SupabaseClient<Database> | null = getSupabaseBrowserClient(),
): Promise<CustomFoodCategoryOption[] | null> => {
	if (!supabase) return null;

	const optionsById = new Map<string, CustomFoodCategoryOption>();
	let offset = 0;
	let expectedCount: number | null = null;

	do {
		const { data, error, count } = await supabase
			.from("custom_food_category_options")
			.select(
				"id, label, observation_count, source_count",
				offset === 0 ? { count: "exact" } : undefined,
			)
			.eq("enabled", true)
			.order("label", { ascending: true })
			.order("id", { ascending: true })
			.range(offset, offset + CATEGORY_OPTION_PAGE_SIZE - 1);

		if (error) return null;

		const page = data ?? [];
		if (offset === 0 && typeof count === "number") expectedCount = count;
		if (page.length === 0) {
			return expectedCount !== null && offset < expectedCount ? null : [];
		}

		for (const option of page) optionsById.set(option.id, option);
		offset += page.length;

		if (expectedCount === null && page.length < CATEGORY_OPTION_PAGE_SIZE) break;
	} while (expectedCount === null || offset < expectedCount);

	return [...optionsById.values()].sort((first, second) =>
		first.label.localeCompare(second.label),
	);
};
