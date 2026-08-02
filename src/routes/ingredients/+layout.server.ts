import { loadIngredientPageData } from "$lib/server/user-data/pageData.server";
import { getIngredientListTab } from "$lib/utils/ingredients/ingredientRouteState";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return {};
	const routeFoodId = params.foodId ? Number(params.foodId) : null;

	return {
		ingredientData: await loadIngredientPageData(
			{
				supabase: locals.supabase,
				userId: user.id,
			},
			{
				routeFoodId:
					Number.isSafeInteger(routeFoodId) && Number(routeFoodId) > 0
						? routeFoodId
						: null,
				routeListKey: getIngredientListTab(url),
			},
		),
	};
};
