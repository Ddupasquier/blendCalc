import { loadSavedRecipesPageData } from "$lib/server/user-data/savedRecipesPageData.server";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return {};

	return {
		savedData: await loadSavedRecipesPageData({
			supabase: locals.supabase,
			userId: user.id,
		}),
	};
};
