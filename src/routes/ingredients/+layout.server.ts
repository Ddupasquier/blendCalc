import { loadIngredientPageData } from "$lib/server/user-data/ingredientPageData.server";
import {
	getIngredientListTab,
	parseIngredientApplicationFoodId,
} from "$lib/utils/ingredients/ingredientRouteState";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return {};
	const routeFoodId = parseIngredientApplicationFoodId(params.foodId);

	return {
		ingredientData: await loadIngredientPageData(
			{
				supabase: locals.supabase,
				userId: user.id,
			},
			{
				routeFoodId,
				routeListKey: getIngredientListTab(url),
			},
		),
	};
};
