import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import {
	getMfaVerificationRoute,
	requireMfaAuthenticatedUser,
} from "$lib/server/auth/mfaAccess.server";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = getSafeAuthNextPath(url.searchParams.get("next"));
	const { status } = await requireMfaAuthenticatedUser(locals, next);

	if (status.currentLevel === "aal2") throw redirect(303, next);
	throw redirect(303, getMfaVerificationRoute(status, next));
};
