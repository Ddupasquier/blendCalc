import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { clearPasswordUpgrade } from "$lib/utils/auth/passwordUpgrade";

export const POST: RequestHandler = async ({ locals, cookies }) => {
	const { error } = await locals.supabase.auth.signOut();
	clearPasswordUpgrade(cookies);
	if (error) {
		console.warn("[auth] Sign out failed", {
			code: error.code,
			status: error.status,
		});
	}
	throw redirect(303, "/");
};
