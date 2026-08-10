import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { loadProfilePageData } from "$lib/server/profile/profilePageData.server";

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw redirect(303, "/auth?next=%2Fprofile");

	return loadProfilePageData({
		supabase: locals.supabase,
		userId: user.id,
	});
};
