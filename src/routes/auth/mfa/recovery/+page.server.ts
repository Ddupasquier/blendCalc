import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { requireMfaAuthenticatedUser } from "$lib/server/auth/mfaAccess.server";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ "cache-control": "private, no-store" });
	const next = getSafeAuthNextPath(url.searchParams.get("next"));
	const { status } = await requireMfaAuthenticatedUser(locals, next);

	if (status.currentLevel === "aal2") throw redirect(303, next);
	if (status.verifiedTotpFactors.length === 0) {
		throw redirect(303, `/auth/mfa/enroll?next=${encodeURIComponent(next)}`);
	}

	return { next };
};
