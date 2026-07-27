import type { UserFoodListPage } from "$lib/types/userData";
import type { FoodListSort } from "$lib/utils/list/listNavigation";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import type { CloudSmoothieListPageOptions } from "$lib/utils/storage/supabase/lists";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const FULL_LIST_PAGE_SIZE = 100;

const getListPath = (key: SmoothieListKey) =>
	key === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping-list";

export const readIngredientListPage = async (
	key: SmoothieListKey,
	options: CloudSmoothieListPageOptions,
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

export const readIngredientList = async (
	key: SmoothieListKey,
	fetcher: typeof fetch = fetch,
) => {
	const foods: UserFoodListPage["foods"] = [];
	let totalCount = Number.POSITIVE_INFINITY;

	while (foods.length < totalCount) {
		const page = await readIngredientListPage(
			key,
			{
				limit: FULL_LIST_PAGE_SIZE,
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
