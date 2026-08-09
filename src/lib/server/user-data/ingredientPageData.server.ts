import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { IngredientPageInitialData } from "$lib/types/pageData/ingredientPageData";
import { readIngredientProvenanceOptions } from "$lib/utils/ingredients/ingredientProvenance";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import {
	readCloudCustomFoods,
	readCloudCustomFoodByFdcId,
	readCloudIngredientListIndex,
	type CloudDataContext,
	type CloudIngredientListIndex,
} from "$lib/utils/storage/supabase";
import {
	readCloudIngredientListFood,
	readCloudIngredientListPage,
} from "$lib/server/user-data/foodLists.server";
import {
	annotateFoodsWithFoodSafety,
	type FoodSafetyEvaluationContext,
} from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import { getApprovedCatalogRecordByApplicationFoodId } from "$lib/server/products/catalogRead.server";
import { readGenericFoodByApplicationId } from "$lib/server/products/genericFoods.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

type LoadIngredientPageDataOptions = {
	routeFoodId?: number | null;
	routeListKey?: IngredientListKey | null;
};

const createEmptyIngredientListIndex = (): CloudIngredientListIndex => ({
	[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
	[MIX_STORAGE_KEYS.shoppingList]: { foodIds: [], foodIdentityKeys: [] },
});

const annotateIngredientListPageWithFoodSafety = (
	ingredientListPage: NonNullable<Awaited<ReturnType<typeof readCloudIngredientListPage>>>,
	foodSafetyContext: FoodSafetyEvaluationContext,
) => ({
	...ingredientListPage,
	foods: annotateFoodsWithFoodSafety(ingredientListPage.foods, foodSafetyContext),
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
	if (!Number.isSafeInteger(applicationFoodId) || Number(applicationFoodId) <= 0) {
		return null;
	}

	if (options.routeListKey) {
		const foodFromRequestedList = await readCloudIngredientListFood(
			options.routeListKey,
			Number(applicationFoodId),
			cloudDataContext,
		);
		if (foodFromRequestedList) return foodFromRequestedList;
	}

	const catalogClient = getSupabaseAdminClient();
	const [customFood, approvedCatalogRecord, genericFood] = await Promise.all([
		readCloudCustomFoodByFdcId(Number(applicationFoodId), cloudDataContext),
		getApprovedCatalogRecordByApplicationFoodId(
			catalogClient,
			Number(applicationFoodId),
		),
		readGenericFoodByApplicationId(catalogClient, Number(applicationFoodId)),
	]);
	return customFood ?? approvedCatalogRecord?.food ?? genericFood;
};

export const loadIngredientPageData = async (
	cloudDataContext: CloudDataContext,
	options: LoadIngredientPageDataOptions = {},
): Promise<IngredientPageInitialData> => {
	try {
		const [
			fridge,
			shoppingList,
			customFoods,
			listIndex,
			provenanceOptions,
			foodSafetyContext,
			routeFood,
		] = await Promise.all([
			readInitialIngredientListPage(cloudDataContext, MIX_STORAGE_KEYS.fridge),
			readInitialIngredientListPage(cloudDataContext, MIX_STORAGE_KEYS.shoppingList),
			readCloudCustomFoods(cloudDataContext),
			readCloudIngredientListIndex(cloudDataContext),
			readIngredientProvenanceOptions(cloudDataContext.supabase),
			getUserFoodSafetyContext(
				cloudDataContext.supabase,
				cloudDataContext.userId,
			),
			readIngredientRouteFoodByApplicationId(cloudDataContext, options),
		]);

		if (!fridge || !shoppingList || !customFoods || !listIndex) {
			throw new Error("Authenticated ingredient data was unavailable.");
		}

		return {
			fridge: annotateIngredientListPageWithFoodSafety(fridge, foodSafetyContext),
			shoppingList: annotateIngredientListPageWithFoodSafety(
				shoppingList,
				foodSafetyContext,
			),
			customFoods: annotateFoodsWithFoodSafety(customFoods, foodSafetyContext),
			routeFood: routeFood
				? annotateFoodsWithFoodSafety([routeFood], foodSafetyContext)[0] ?? null
				: null,
			listIndex,
			provenanceOptions: provenanceOptions ?? [],
			loadError: "",
			provenanceError: provenanceOptions?.length
				? ""
				: "Ingredient source and review filters could not load. Try again after refreshing.",
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
			loadError: "Saved ingredients could not be loaded. Try again.",
			provenanceError: "",
		};
	}
};
