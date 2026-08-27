import { redirect } from "@sveltejs/kit";

export const requireAuthenticatedProfileUser = async (locals: App.Locals) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw redirect(303, "/auth?next=%2Fprofile");
	return user;
};
