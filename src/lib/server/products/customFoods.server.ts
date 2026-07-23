import type { Database } from "$lib/types/database.types";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood } from "$lib/utils/food/types";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import type { IngredientProvenanceFilters } from "$lib/utils/ingredients/ingredientProvenance";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import { readFoodServingsByParent } from "$lib/utils/storage/supabase/servings";
import type { SupabaseClient } from "@supabase/supabase-js";

const CUSTOM_SEARCH_CANDIDATE_LIMIT = 100;
const MAX_SEARCH_TERMS = 6;

export const searchUserCustomFoods = async (
	supabase: SupabaseClient<Database>,
	userId: string,
	query: string,
	filters: IngredientProvenanceFilters = {},
) => {
	const terms = tokenizeIngredientSearchText(query).slice(0, MAX_SEARCH_TERMS);
	if (terms.length === 0) return [];

	let request = supabase
		.from("custom_foods")
		.select("id, food, source_key, trust_status")
		.eq("user_id", userId)
		.order("name_key", { ascending: true })
		.limit(CUSTOM_SEARCH_CANDIDATE_LIMIT);
	if (filters.sourceFilter && filters.sourceFilter !== "all") {
		request = request.eq("source_key", filters.sourceFilter);
	}
	if (filters.trustFilter && filters.trustFilter !== "any") {
		request = request.eq("trust_status", filters.trustFilter);
	}
	for (const term of terms) {
		request = request.ilike("search_text", `%${term}%`);
	}

	const { data, error } = await request;
	if (error) throw error;
	const rows = data ?? [];
	const [normalizedRows, servingRows] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"custom_food_id",
			rows.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"custom_food_id",
			rows.map((row) => row.id),
		),
	]);
	return rows.map((row) => {
		const catalogFood = hydrateFoodWithCatalogState(
			row.food as unknown as FdcFood,
			{
				shared_product_id:
					(row.food as unknown as FdcFood).sharedProductId ?? null,
				shared_product_submission_id:
					(row.food as unknown as FdcFood).sharedProductSubmissionId ?? null,
				source_key: row.source_key,
				trust_status: row.trust_status,
			},
		);
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			catalogFood,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
	});
};
