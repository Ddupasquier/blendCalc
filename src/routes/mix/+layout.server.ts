import { loadMixPageData } from "$lib/server/user-data/mixPageData.server";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return {};

	return {
		mixData: await loadMixPageData({
			supabase: locals.supabase,
			userId: user.id,
		}),
	};
};
