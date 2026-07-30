import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { clearPasswordUpgrade } from "$lib/utils/auth/passwordUpgrade";
import { trackServerAppInteraction } from "$lib/server/analytics/appInteractionTracking.server";
import { APP_INTERACTION_METRICS } from "$lib/utils/analytics/appInteractionMetrics";

export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	const { error } = await locals.supabase.auth.signOut();
	clearPasswordUpgrade(cookies);
	if (error) {
		console.warn("[auth] Sign out failed", {
			code: error.code,
			status: error.status,
		});
	} else {
		await trackServerAppInteraction(
			APP_INTERACTION_METRICS.LOGOUT_SUCCESS,
			request,
		);
	}
	throw redirect(303, "/");
};
