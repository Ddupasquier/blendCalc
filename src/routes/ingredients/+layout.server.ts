import { loadIngredientPageData } from "$lib/server/user-data/pageData.server";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return {};

	return {
		ingredientData: await loadIngredientPageData({
			supabase: locals.supabase,
			userId: user.id,
		}),
	};
};
