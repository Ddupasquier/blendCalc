import type { Database } from "$lib/types/database.types";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import type { FdcFood } from "$lib/utils/food/types";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import type { SupabaseClient } from "@supabase/supabase-js";

const CUSTOM_SEARCH_CANDIDATE_LIMIT = 100;
const MAX_SEARCH_TERMS = 6;

export const searchUserCustomFoods = async (
	supabase: SupabaseClient<Database>,
	userId: string,
	query: string,
) => {
	const terms = tokenizeIngredientSearchText(query).slice(0, MAX_SEARCH_TERMS);
	if (terms.length === 0) return [];

	let request = supabase
		.from("custom_foods")
		.select("id, food")
		.eq("user_id", userId)
		.order("name_key", { ascending: true })
		.limit(CUSTOM_SEARCH_CANDIDATE_LIMIT);
	for (const term of terms) {
		request = request.ilike("search_text", `%${term}%`);
	}

	const { data, error } = await request;
	if (error) throw error;
	const rows = data ?? [];
	const normalizedRows = await readNormalizedNutrientsByParent(
		supabase,
		"custom_food_id",
		rows.map((row) => row.id),
	);

	return rows.map((row) =>
		hydrateFoodWithNormalizedNutrients(
			row.food as unknown as FdcFood,
			normalizedRows?.get(row.id),
		),
	);
};
