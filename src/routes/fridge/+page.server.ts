import { loadIngredientPageData } from "$lib/server/user-data/pageData.server";
import { getCanonicalIngredientRouteHref } from "$lib/utils/ingredients/ingredientRouteState";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const canonicalHref = getCanonicalIngredientRouteHref(url);
	if (canonicalHref) throw redirect(308, canonicalHref);

	const user = await locals.getVerifiedUser();
	if (!user) return {};

	return {
		ingredientData: await loadIngredientPageData({
			supabase: locals.supabase,
			userId: user.id,
		}),
	};
};
