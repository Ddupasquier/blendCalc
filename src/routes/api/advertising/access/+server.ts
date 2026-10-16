import { json } from "@sveltejs/kit";
import { readAdvertisingEligibility } from "$lib/server/advertising/advertising.server";
import { getUserAppRole } from "$lib/utils/moderation/moderation";
import type { AdEligibility } from "$lib/utils/advertising/adPolicy";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
	const user = await locals.getVerifiedUser();
	let eligibility: AdEligibility = "unknown";
	if (user) {
		try {
			// Disposable auth verifies the current user record instead of a JWT role claim.
			const elevated =
				user.appRoleClaim === null
					? await getUserAppRole(locals.supabase, user.id)
					: user.appRoleClaim !== "user";
			if (!elevated)
				eligibility = await readAdvertisingEligibility({
					supabase: locals.supabase,
					userId: user.id,
				});
		} catch {
			/* A failed role lookup must not permit advertising. */
		}
	}
	return json(
		{ eligibility },
		{
			status: user ? 200 : 401,
			headers: { "cache-control": "private, no-store" },
		},
	);
};
