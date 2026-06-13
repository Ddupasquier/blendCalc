import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw redirect(303, "/auth?error=recovery_session");
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const formData = await request.formData();
		const password = String(formData.get("password") ?? "");
		const confirmation = String(formData.get("passwordConfirmation") ?? "");

		if (password.length < 8) {
			return fail(400, {
				message: "Password must be at least 8 characters.",
			});
		}
		if (password !== confirmation) {
			return fail(400, { message: "Passwords do not match." });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) {
			console.warn("[auth] Password update failed", {
				code: error.code,
				status: error.status,
			});
			return fail(400, {
				message: "Unable to update your password. Request a new reset link.",
			});
		}

		throw redirect(303, "/fridge");
	},
};
