import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
import type { FoodItem } from "$lib/utils/food/types";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { IngredientPageInitialData } from "$lib/types/pageData/ingredientPageData";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import {
	readCloudCustomFoodByFdcId,
	type CloudDataContext,
	type CloudIngredientListIndex,
} from "$lib/utils/storage/supabase";
import {
	readCloudIngredientListCount,
	readCloudIngredientListFood,
	readCloudIngredientListPage,
} from "$lib/server/user-data/foodLists.server";
import {
	annotateFoodsWithFoodSafety,
	type FoodSafetyEvaluationContext,
} from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import { getApprovedCatalogRecordByApplicationFoodId } from "$lib/server/products/catalogRead.server";
import { readCanonicalFoodCatalogMetadata } from "$lib/server/products/catalogRecordMetadata.server";
import { readGenericFoodByApplicationId } from "$lib/server/products/genericFoods.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";

type LoadIngredientPageDataOptions = {
	routeFoodId?: number | null;
	routeListKey?: IngredientListKey | null;
};

const createEmptyIngredientListIndex = (): CloudIngredientListIndex => ({
	[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
	[MIX_STORAGE_KEYS.shoppingList]: { foodIds: [], foodIdentityKeys: [] },
});

const getOppositeListKey = (listKey: IngredientListKey) =>
	listKey === MIX_STORAGE_KEYS.fridge
		? MIX_STORAGE_KEYS.shoppingList
		: MIX_STORAGE_KEYS.fridge;

const createInitialIngredientListIndex = (
	listKey: IngredientListKey,
	foods: FoodItem[],
) => {
	const index = createEmptyIngredientListIndex();
	index[listKey] = {
		foodIds: foods.map((food) => food.fdcId),
		foodIdentityKeys: foods.map(getFoodIdentityKey),
	};
	return index;
};

const annotateIngredientListPageWithFoodSafety = (
	ingredientListPage: NonNullable<
		Awaited<ReturnType<typeof readCloudIngredientListPage>>
	>,
	foodSafetyContext: FoodSafetyEvaluationContext,
) => ({
	...ingredientListPage,
	foods: annotateFoodsWithFoodSafety(
		ingredientListPage.foods,
		foodSafetyContext,
	),
});

const readInitialIngredientListPage = (
	cloudDataContext: CloudDataContext,
	listKey: IngredientListKey,
) =>
	readCloudIngredientListPage(
		listKey,
		{
			limit: LIST_PAGE_SIZES.ingredientPills,
			offset: 0,
			sort: "recent",
			sourceFilter: "all",
			trustFilter: "any",
		},
		cloudDataContext,
	);

const readIngredientRouteFoodByApplicationId = async (
	cloudDataContext: CloudDataContext,
	options: LoadIngredientPageDataOptions,
) => {
	const applicationFoodId = options.routeFoodId;
	if (
		!Number.isSafeInteger(applicationFoodId) ||
		Number(applicationFoodId) === 0
	) {
		return null;
	}

	let routeFood: FoodItem | null = null;
	if (options.routeListKey) {
		routeFood = await readCloudIngredientListFood(
			options.routeListKey,
			Number(applicationFoodId),
			cloudDataContext,
		);
	}

	if (routeFood && !routeFood.sharedProductId) return routeFood;

	const catalogClient = getSupabaseAdminClient();
	if (!routeFood) {
		const [customFood, approvedCatalogRecord, genericFood] = await Promise.all([
			readCloudCustomFoodByFdcId(Number(applicationFoodId), cloudDataContext),
			getApprovedCatalogRecordByApplicationFoodId(
				catalogClient,
				Number(applicationFoodId),
			),
			readGenericFoodByApplicationId(catalogClient, Number(applicationFoodId)),
		]);
		routeFood = customFood ?? approvedCatalogRecord?.food ?? genericFood;
	}
	if (!routeFood?.sharedProductId) return routeFood;

	const canonicalCatalogMetadata = await readCanonicalFoodCatalogMetadata(
		catalogClient,
		routeFood.sharedProductId,
	);
	return canonicalCatalogMetadata
		? { ...routeFood, canonicalCatalogMetadata }
		: routeFood;
};

export const loadIngredientPageData = async (
	cloudDataContext: CloudDataContext,
	options: LoadIngredientPageDataOptions = {},
): Promise<IngredientPageInitialData> => {
	const initialListKey = options.routeListKey ?? MIX_STORAGE_KEYS.fridge;
	const deferredListKey = getOppositeListKey(initialListKey);
	try {
		const [initialList, deferredListCount, foodSafetyContext, routeFood] =
			await Promise.all([
				readInitialIngredientListPage(cloudDataContext, initialListKey),
				readCloudIngredientListCount(deferredListKey, cloudDataContext),
				getUserFoodSafetyContext(
					cloudDataContext.supabase,
					cloudDataContext.userId,
				),
				readIngredientRouteFoodByApplicationId(cloudDataContext, options),
			]);

		if (!initialList || deferredListCount === null) {
			throw new Error("Authenticated ingredient data was unavailable.");
		}
		const annotatedInitialList = annotateIngredientListPageWithFoodSafety(
			initialList,
			foodSafetyContext,
		);
		const deferredList = { foods: [], totalCount: deferredListCount };
		const fridge =
			initialListKey === MIX_STORAGE_KEYS.fridge
				? annotatedInitialList
				: deferredList;
		const shoppingList =
			initialListKey === MIX_STORAGE_KEYS.shoppingList
				? annotatedInitialList
				: deferredList;

		return {
			fridge,
			shoppingList,
			customFoods: [],
			routeFood: routeFood
				? (annotateFoodsWithFoodSafety([routeFood], foodSafetyContext)[0] ??
					null)
				: null,
			listIndex: createInitialIngredientListIndex(
				initialListKey,
				annotatedInitialList.foods,
			),
			provenanceOptions: [],
			initialListKey,
			deferredDataPending: true,
			loadError: "",
			provenanceError: "",
		};
	} catch (error) {
		console.error("[user-data] Ingredient page data could not load.", error);
		return {
			fridge: { foods: [], totalCount: 0 },
			shoppingList: { foods: [], totalCount: 0 },
			customFoods: [],
			routeFood: null,
			listIndex: createEmptyIngredientListIndex(),
			provenanceOptions: [],
			initialListKey,
			deferredDataPending: false,
			loadError: "Saved ingredients could not be loaded. Try again.",
			provenanceError: "",
		};
	}
};
