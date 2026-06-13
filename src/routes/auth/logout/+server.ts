import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
	const { error } = await locals.supabase.auth.signOut();
	if (error) {
		console.warn("[auth] Sign out failed", {
			code: error.code,
			status: error.status,
		});
	}
	throw redirect(303, "/");
};
