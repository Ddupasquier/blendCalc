import { loadIngredientPageData } from "$lib/server/user-data/pageData.server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return {};

	return {
		ingredientData: await loadIngredientPageData({
			supabase: locals.supabase,
			userId: user.id,
		}),
	};
};
