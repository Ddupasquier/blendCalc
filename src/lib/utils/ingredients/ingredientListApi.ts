import type { UserFoodListPage } from "$lib/types/userData";
import { LIST_PAGE_LIMITS } from "$lib/config/listPagination";
import type { FoodListSort } from "$lib/utils/list/listNavigation";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type { CloudIngredientListPageOptions } from "$lib/utils/storage/supabase/lists";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const getListPath = (key: IngredientListKey) =>
	key === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping-list";

export const readIngredientListPage = async (
	key: IngredientListKey,
	options: CloudIngredientListPageOptions,
	fetcher: typeof fetch = fetch,
): Promise<UserFoodListPage> => {
	const parameters = new URLSearchParams({
		limit: String(options.limit),
		offset: String(options.offset ?? 0),
		sort: options.sort ?? "recent",
		source: options.sourceFilter ?? "all",
		trust: options.trustFilter ?? "any",
	});
	if (options.query?.trim()) parameters.set("q", options.query.trim());

	const response = await fetcher(
		`/api/user-food-lists/${getListPath(key)}?${parameters}`,
	);
	if (!response.ok) {
		throw new Error("Saved ingredients could not be loaded.");
	}
	return await response.json() as UserFoodListPage;
};

export const readIngredientListWindow = async (
	key: IngredientListKey,
	options: CloudIngredientListPageOptions,
	fetcher: typeof fetch = fetch,
): Promise<UserFoodListPage> => {
	const foods: UserFoodListPage["foods"] = [];
	const targetCount = Math.max(1, options.limit);
	const startingOffset = options.offset ?? 0;
	let totalCount = Number.POSITIVE_INFINITY;

	while (
		foods.length < targetCount &&
		startingOffset + foods.length < totalCount
	) {
		const page = await readIngredientListPage(
			key,
			{
				...options,
				limit: Math.min(
					LIST_PAGE_LIMITS.userFoodListRequest,
					targetCount - foods.length,
				),
				offset: startingOffset + foods.length,
			},
			fetcher,
		);
		foods.push(...page.foods);
		totalCount = page.totalCount;
		if (page.foods.length === 0) break;
	}

	return { foods, totalCount };
};

export const readIngredientList = async (
	key: IngredientListKey,
	fetcher: typeof fetch = fetch,
) => {
	const foods: UserFoodListPage["foods"] = [];
	let totalCount = Number.POSITIVE_INFINITY;

	while (foods.length < totalCount) {
		const page = await readIngredientListPage(
			key,
			{
				limit: LIST_PAGE_LIMITS.userFoodListRequest,
				offset: foods.length,
				sort: "recent" satisfies FoodListSort,
			},
			fetcher,
		);
		foods.push(...page.foods);
		totalCount = page.totalCount;
		if (page.foods.length === 0) break;
	}

	return foods;
};
