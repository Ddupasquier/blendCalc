import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { loadProfilePageData } from "$lib/server/profile/profilePageData.server";

export const load: LayoutServerLoad = async ({ locals, parent }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw redirect(303, "/auth?next=%2Fprofile");
	const { authUser } = await parent();

	return loadProfilePageData({
		supabase: locals.supabase,
		userId: user.id,
		appRole: authUser?.role ?? null,
	});
};
