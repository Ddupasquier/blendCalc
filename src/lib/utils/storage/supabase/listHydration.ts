import type { Database } from "$lib/types/database.types";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFoodProductName } from "$lib/utils/products/productNameFormatting.js";
import { hydrateFoodsWithCachedImages } from "./foodImages";
import { readNormalizedNutrientsByParent } from "./normalizedNutrients";
import { readFoodServingsByParent } from "./servings";

export type CloudFoodListHydrationRow = Pick<
	Database["public"]["Tables"]["user_food_list_items"]["Row"],
	| "id"
	| "food"
	| "created_at"
	| "shared_product_id"
	| "shared_product_submission_id"
	| "source_key"
	| "trust_status"
>;

export const hydrateCloudFoodListRows = async (
	supabase: SupabaseClient<Database>,
	rows: CloudFoodListHydrationRow[],
) => {
	const baseFoods = rows.map((row) =>
		hydrateFoodWithCatalogState(
			normalizeFoodProductName({
				...(row.food as unknown as FdcFood),
				listAddedAt:
					(row.food as unknown as FdcFood).listAddedAt ??
					new Date(row.created_at).getTime(),
			}) as FdcFood,
			row,
		),
	);
	const [normalizedRows, servingRows, foodsWithImages] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"user_food_list_item_id",
			rows.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"user_food_list_item_id",
			rows.map((row) => row.id),
		),
		hydrateFoodsWithCachedImages(supabase, baseFoods),
	]);

	return foodsWithImages.map((food, index) => {
		const row = rows[index];
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			food,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
	});
};
