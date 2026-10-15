import type { CloudDataContext } from "$lib/utils/storage/supabase/shared";
import type { FoodItem } from "$lib/utils/food/types";
import type { FavoriteState } from "$lib/utils/favorites/types";
import { readCloudCustomFoodByFdcId } from "$lib/utils/storage/supabase";
import { getApprovedCatalogRecordByApplicationFoodId } from "$lib/server/products/catalogRead.server";
import { readGenericFoodByApplicationId } from "$lib/server/products/genericFoods.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { annotateFoodsWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";

export const annotateFoodFavorites = async (
	foods: FoodItem[],
	context: CloudDataContext,
) => {
	if (!foods.length) return foods;
	const states: Record<string, FavoriteState> = {};
	for (let offset = 0; offset < foods.length; offset += 100) {
		const { data, error } = await context.supabase.rpc(
			"read_user_food_favorite_states",
			{
				p_food_ids: foods.slice(offset, offset + 100).map((food) => food.fdcId),
			},
		);
		if (error) throw error;
		Object.assign(states, data);
	}
	return foods.map((food) => ({
		...food,
		favoriteState: states[String(food.fdcId)] ?? null,
	}));
};

export const readFavoriteFoodPage = async (
	context: CloudDataContext,
	query = "",
	sort = "recent",
	limit = 15,
	offset = 0,
) => {
	const { data, error } = await context.supabase
		.rpc("read_user_favorite_food_page", {
			p_query: query,
			p_sort: sort,
			p_limit: limit,
			p_offset: offset,
		})
		.abortSignal(AbortSignal.timeout(10_000));
	if (error) throw error;
	const result = data as unknown as {
		items: { food_id: number }[];
		totalCount: number;
	};
	const catalog = getSupabaseAdminClient();
	const foods: (FoodItem | null)[] = [];
	for (let offset = 0; offset < result.items.length; offset += 8) {
		foods.push(
			...(await Promise.all(
				result.items.slice(offset, offset + 8).map(async (item) => {
					const privateFood = await readCloudCustomFoodByFdcId(
						item.food_id,
						context,
					);
					if (privateFood) return privateFood;
					return (
						(
							await getApprovedCatalogRecordByApplicationFoodId(
								catalog,
								item.food_id,
							)
						)?.food ??
						(await readGenericFoodByApplicationId(catalog, item.food_id))
					);
				}),
			)),
		);
	}
	if (foods.some((food) => !food))
		throw new Error("Favorite target changed during read");
	const safety = await getUserFoodSafetyContext(
		context.supabase,
		context.userId,
	);
	return {
		foods: annotateFoodsWithFoodSafety(
			foods
				.filter((food): food is FoodItem => Boolean(food))
				.map((food) => ({ ...food, favoriteState: { favorite: true } })),
			safety,
		),
		totalCount: result.totalCount,
	};
};
